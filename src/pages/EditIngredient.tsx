import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import {
  fetchIngredientStockTotals,
  upsertIngredientStockItems,
} from '@/lib/ingredientStock';
import { useWorkshops, useInvalidateMenu, useWarehouses } from '@/hooks/useMenuData';
import { toast } from 'sonner';

const UNITS = ['кг', 'л', 'шт'] as const;

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <label className="w-32 text-sm text-muted-foreground shrink-0 sm:w-36">{label}</label>
      <div className="min-w-0 flex-1 max-w-md">{children}</div>
    </div>
  );
}

function normalizeUnitFromDb(unit: string | null | undefined): string {
  const u = unit?.trim() || 'кг';
  if ((UNITS as readonly string[]).includes(u)) return u;
  if (u === 'г' || u === 'мл') return u === 'мл' ? 'л' : 'кг';
  return 'кг';
}

export function EditIngredient() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: workshops = [], isPending: workshopsPending } = useWorkshops();
  const { data: warehouses = [], isPending: warehousesPending } = useWarehouses();
  const { invalidateAll } = useInvalidateMenu();
  const warehouseIdFromContext = params.get('warehouse') ?? '';
  const returnToWarehouse = params.get('back') === 'warehouse' && warehouseIdFromContext;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('кг');
  const [stockQuantity, setStockQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  const [warehouseIds, setWarehouseIds] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit, stock_quantity, price, workshop_id, type, venue_id')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;
      setLoading(false);

      if (error || !data) {
        toast.error('Не удалось загрузить ингредиент');
        navigate('/menu/ingredients');
        return;
      }
      if (data.venue_id !== VENUE_ID || data.type !== 'ingredient') {
        toast.error('Запись не найдена');
        navigate('/menu/ingredients');
        return;
      }

      setName(data.name || '');
      setUnit(normalizeUnitFromDb(data.unit));
      let displayStock = Number(data.stock_quantity) || 0;
      try {
        const totals = await fetchIngredientStockTotals(
          [{ id: data.id, workshop_id: data.workshop_id }]
        );
        displayStock = totals.get(data.id) ?? 0;
      } catch {
        // keep products.stock_quantity if stock query fails
      }
      setStockQuantity(String(displayStock));
      setPrice(String(data.price ?? ''));
      setWorkshopId(data.workshop_id || '');

      const { data: linkedWarehouses } = await supabase
        .from('warehouse_products')
        .select('warehouse_id')
        .eq('product_id', data.id);
      const whIds = (linkedWarehouses || []).map((r) => r.warehouse_id as string);
      setWarehouseIds(whIds);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  async function handleSave() {
    if (!id || !name.trim()) {
      toast.error('Укажите название');
      return;
    }

    const u = (UNITS as readonly string[]).includes(unit) ? unit : 'кг';
    const qty = parseFloat(stockQuantity) || 0;

    setSaving(true);
    const { error } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        unit: u,
        stock_quantity: qty,
        price: parseFloat(price) || 0,
        workshop_id: workshopId || null,
      })
      .eq('id', id)
      .eq('venue_id', VENUE_ID)
      .eq('type', 'ingredient');

    if (error) {
      setSaving(false);
      toast.error('Ошибка: ' + error.message);
      return;
    }

    const { error: delVisErr } = await supabase
      .from('warehouse_products')
      .delete()
      .eq('product_id', id);
    if (delVisErr) {
      setSaving(false);
      toast.error('Доступ к складам: ' + delVisErr.message);
      return;
    }

    if (warehouseIds.length > 0) {
      const rows = warehouseIds.map((warehouse_id) => ({
        warehouse_id,
        product_id: id,
      }));
      const { error: visErr } = await supabase
        .from('warehouse_products')
        .upsert(rows, { onConflict: 'warehouse_id,product_id' });
      if (visErr) {
        setSaving(false);
        toast.error('Доступ к складам: ' + visErr.message);
        return;
      }
    }

    const stockRes = await upsertIngredientStockItems(id, workshopId || null, qty, u);
    setSaving(false);

    if (!stockRes.ok) {
      toast.error('Ошибка склада: ' + stockRes.message);
      return;
    }

    toast.success('Сохранено');
    invalidateAll();
    navigate(returnToWarehouse ? `/warehouse/${warehouseIdFromContext}` : '/menu/ingredients');
  }

  async function handleDelete() {
    if (!id || !confirm('Удалить ингредиент?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id).eq('venue_id', VENUE_ID);
    if (error) {
      toast.error('Ошибка: ' + error.message);
      return;
    }
    toast.success('Удалено');
    invalidateAll();
    navigate('/menu/ingredients');
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="p-8 pb-24 max-w-[640px] [&_button]:cursor-pointer">
      <button
        type="button"
        onClick={() => navigate(returnToWarehouse ? `/warehouse/${warehouseIdFromContext}` : '/menu/ingredients')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к ингредиентам
      </button>

      <h2 className="text-2xl font-bold mb-8">Редактирование</h2>

      <div className="space-y-4 mb-10">
        <Field label="Название">
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Ед. измерения">
          <div
            className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
            style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
          >
            {UNITS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setUnit(unit === opt ? 'кг' : opt)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  unit === opt ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                style={unit === opt ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Остаток на складе">
          <input
            type="number"
            className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm bg-background text-right tabular-nums"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
          />
        </Field>

        <Field label="Цех">
          {workshopsPending ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : workshops.length > 0 ? (
            <div
              className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
              style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
            >
              {workshops.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWorkshopId(workshopId === w.id ? '' : w.id)}
                  className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                    workshopId === w.id ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={workshopId === w.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
                >
                  {w.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет цехов.</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Цех нужен для привязки блюд, не для хранения на складе.</p>
        </Field>

        <Field label="Склады">
          {warehousesPending ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : warehouses.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Можно выбрать несколько складов</p>
              {warehouses.map((w) => {
                const active = warehouseIds.includes(w.id);
                return (
                  <label
                    key={w.id}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        setWarehouseIds((prev) =>
                          active ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                        )
                      }
                      className="w-4 h-4"
                    />
                    {w.name}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет складов.</p>
          )}
        </Field>

        <div className="flex items-center gap-4">
          <label className="w-32 text-sm text-muted-foreground shrink-0 sm:w-36">Себестоимость</label>
          <div className="w-36 relative">
            <input
              className="w-full pl-3 pr-10 py-2 border rounded-lg text-sm bg-background text-right tabular-nums"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              сом
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-700 transition-colors"
        >
          Удалить
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(returnToWarehouse ? `/warehouse/${warehouseIdFromContext}` : '/menu/ingredients')}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
