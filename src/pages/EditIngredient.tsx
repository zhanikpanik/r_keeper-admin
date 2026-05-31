import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { upsertIngredientStockItems } from '@/lib/ingredientStock';
import { useWorkshops, useInvalidateMenu, useWarehouses } from '@/hooks/useMenuData';
import { EditPage } from '@/components/ui/EditPage';
import { Field } from '@/components/ui/Field';
import { toast } from 'sonner';

const UNITS = ['кг', 'л', 'шт'] as const;

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
 const [workshopId, setWorkshopId] = useState('');
 const [warehouseIds, setWarehouseIds] = useState<string[]>([]);

 useEffect(() => {
  if (!id) return;
  let cancelled = false;
  (async () => {
   setLoading(true);
   const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, workshop_id, type, venue_id')
    .eq('id', id)
    .maybeSingle();
   if (cancelled) return;
   setLoading(false);
   if (error || !data) { toast.error('Не удалось загрузить ингредиент'); navigate('/menu/ingredients'); return; }
   if (data.venue_id !== VENUE_ID || data.type !== 'ingredient') { toast.error('Запись не найдена'); navigate('/menu/ingredients'); return; }
   setName(data.name || '');
   setUnit(normalizeUnitFromDb(data.unit));
   setWorkshopId(data.workshop_id || '');
   const { data: linkedWarehouses } = await supabase.from('warehouse_products').select('warehouse_id').eq('product_id', data.id);
   setWarehouseIds((linkedWarehouses || []).map((r) => r.warehouse_id as string));
  })();
  return () => { cancelled = true; };
 }, [id, navigate]);

 async function handleSave() {
  if (!id || !name.trim()) { toast.error('Укажите название'); return; }
  const u = (UNITS as readonly string[]).includes(unit) ? unit : 'кг';
  setSaving(true);
  const { error } = await supabase.from('products').update({
   name: name.trim(), unit: u, workshop_id: workshopId || null,
  }).eq('id', id).eq('venue_id', VENUE_ID).eq('type', 'ingredient');
  if (error) { setSaving(false); toast.error('Ошибка: ' + error.message); return; }
  await supabase.from('warehouse_products').delete().eq('product_id', id);
  if (warehouseIds.length > 0) {
   await supabase.from('warehouse_products').upsert(
    warehouseIds.map((warehouse_id) => ({ warehouse_id, product_id: id })),
    { onConflict: 'warehouse_id,product_id' }
   );
  }
  setSaving(false);
  toast.success('Сохранено');
  invalidateAll();
  navigate(returnToWarehouse ? `/warehouse/${warehouseIdFromContext}` : '/menu/ingredients');
 }

 async function handleDelete() {
  if (!id || !confirm('Удалить ингредиент?')) return;
  const { error } = await supabase.from('products').delete().eq('id', id).eq('venue_id', VENUE_ID);
  if (error) { toast.error('Ошибка: ' + error.message); return; }
  toast.success('Удалено');
  invalidateAll();
  navigate('/menu/ingredients');
 }

 if (loading) return <div className="p-8 text-muted-foreground">Загрузка…</div>;

 return (
  <EditPage
   title="Редактирование ингредиента"
   backTo={returnToWarehouse ? `/warehouse/${warehouseIdFromContext}` : '/menu/ingredients'}
   onDelete={handleDelete}
   onSave={handleSave}
   saving={saving}
  >
   <Field label="Название">
    <input className="w-full px-3 py-2 border border-[#E6E5E3] rounded-lg text-sm " value={name} onChange={(e) => setName(e.target.value)} />
   </Field>

   <Field label="Ед. измерения">
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
     {UNITS.map((opt) => (
      <button key={opt} type="button" onClick={() => setUnit(unit === opt ? 'кг' : opt)}
       className={`px-4 py-1.5 rounded-md text-sm transition-all ${unit === opt ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
       style={unit === opt ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}>
       {opt}
      </button>
     ))}
    </div>
   </Field>

   <Field label="Цех">
    {workshopsPending ? <p className="text-sm text-muted-foreground">Загрузка…</p> :
     workshops.length > 0 ? (
     <div className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
      {workshops.map((w) => (
       <button key={w.id} type="button" onClick={() => setWorkshopId(workshopId === w.id ? '' : w.id)}
        className={`px-4 py-1.5 rounded-md text-sm transition-all ${workshopId === w.id ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        style={workshopId === w.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}>
        {w.name}
       </button>
      ))}
     </div>
    ) : <p className="text-sm text-muted-foreground">Нет цехов.</p>}
    <p className="text-xs text-muted-foreground mt-1">Цех нужен для привязки блюд, не для хранения на складе.</p>
   </Field>

   <Field label="Склады">
    {warehousesPending ? <p className="text-sm text-muted-foreground">Загрузка…</p> :
     warehouses.length > 0 ? (
     <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Можно выбрать несколько складов</p>
      {warehouses.map((w) => {
       const active = warehouseIds.includes(w.id);
       return (
        <label key={w.id} className="flex items-center gap-2 text-sm text-foreground">
         <input type="checkbox" checked={active} onChange={() => setWarehouseIds((prev) => active ? prev.filter((id) => id !== w.id) : [...prev, w.id])} className="w-4 h-4" />
         {w.name}
        </label>
       );
      })}
     </div>
    ) : <p className="text-sm text-muted-foreground">Нет складов.</p>}
   </Field>
  </EditPage>
 );
}
