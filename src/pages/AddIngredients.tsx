import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { upsertIngredientStockItems } from '@/lib/ingredientStock';
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

function SegmentedRow({
 options,
 value,
 onChange,
}: {
 options: readonly string[];
 value: string;
 onChange: (v: string) => void;
}) {
 return (
  <div
   className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
   style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
  >
   {options.map((opt) => (
    <button
     key={opt}
     type="button"
     onClick={() => onChange(value === opt ? '' : opt)}
     className={`px-4 py-1.5 rounded-md text-sm transition-all ${
      value === opt ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'
     }`}
     style={value === opt ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
    >
     {opt}
    </button>
   ))}
  </div>
 );
}

interface IngredientDraft {
 key: number;
 name: string;
 unit: string;
 stockQuantity: string;
 workshopId: string;
 warehouseIds: string[];
}

function emptyDraft(
 key: number,
 defaultWorkshopId: string,
 defaultWarehouseId: string
): IngredientDraft {
 return {
  key,
  name: '',
  unit: 'кг',
  stockQuantity: '',
  workshopId: defaultWorkshopId,
  warehouseIds: defaultWarehouseId ? [defaultWarehouseId] : [],
 };
}

let nextKey = 1;

export function AddIngredients() {
 const navigate = useNavigate();
 const [params] = useSearchParams();
 const defaultWorkshop = params.get('workshop') ?? '';
 const defaultWarehouse = params.get('warehouse') ?? '';
 const returnToWarehouse = params.get('back') === 'warehouse' && defaultWarehouse;

 const { data: workshops = [], isPending: workshopsPending } = useWorkshops();
 const { data: warehouses = [], isPending: warehousesPending } = useWarehouses();
 const { invalidateAll } = useInvalidateMenu();

 const [blocks, setBlocks] = useState<IngredientDraft[]>(() => [
  emptyDraft(nextKey++, defaultWorkshop, defaultWarehouse),
 ]);
 const [saving, setSaving] = useState(false);

 const addBlock = useCallback(() => {
  setBlocks((prev) => [...prev, emptyDraft(nextKey++, defaultWorkshop, defaultWarehouse)]);
 }, [defaultWorkshop, defaultWarehouse]);

 const removeBlock = useCallback(
  (key: number) => {
   setBlocks((prev) => {
    if (prev.length === 1) return [emptyDraft(nextKey++, defaultWorkshop, defaultWarehouse)];
    return prev.filter((b) => b.key !== key);
   });
  },
  [defaultWorkshop, defaultWarehouse]
 );

 const patchBlock = useCallback((key: number, patch: Partial<IngredientDraft>) => {
  setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
 }, []);

 async function handleSave() {
  const valid = blocks.filter((b) => b.name.trim());
  if (valid.length === 0) {
   toast.error('Введите хотя бы одно название');
   return;
  }

  const unitOrDefault = (u: string) => (UNITS as readonly string[]).includes(u) ? u : 'кг';

  setSaving(true);
  const payload = valid.map((b) => ({
   venue_id: VENUE_ID,
   type: 'ingredient' as const,
   name: b.name.trim(),
   unit: unitOrDefault(b.unit),
   stock_quantity: parseFloat(b.stockQuantity) || 0,
   workshop_id: b.workshopId || null,
   price: 0,
  }));

  const { data: inserted, error } = await supabase
   .from('products')
   .insert(payload)
   .select('id, workshop_id, unit');

  setSaving(false);

  if (error) {
   toast.error('Ошибка: ' + error.message);
   return;
  }

  const visibilityRows: { warehouse_id: string; product_id: string }[] = [];
  for (let i = 0; i < (inserted ?? []).length; i++) {
   const row = inserted![i]!;
   const b = valid[i]!;
   for (const warehouse_id of b.warehouseIds) {
    visibilityRows.push({ warehouse_id, product_id: row.id });
   }
  }
  if (visibilityRows.length > 0) {
   const { error: visErr } = await supabase
    .from('warehouse_products')
    .upsert(visibilityRows, { onConflict: 'warehouse_id,product_id' });
   if (visErr) {
    toast.error('Доступ к складам: ' + visErr.message);
    return;
   }
  }

  for (let i = 0; i < (inserted ?? []).length; i++) {
   const row = inserted![i]!;
   const b = valid[i]!;
   const q = parseFloat(b.stockQuantity) || 0;
   const u = unitOrDefault(b.unit);
   const res = await upsertIngredientStockItems(row.id, row.workshop_id, q, u);
   if (!res.ok) {
    toast.error('Склад: ' + res.message);
    return;
   }
  }

  toast.success(
   valid.length === 1
    ? `Ингредиент «${valid[0].name}» добавлен`
    : `Добавлено ${valid.length} ингредиентов`
  );
  invalidateAll();
  navigate(returnToWarehouse ? `/warehouse/${defaultWarehouse}` : '/menu/ingredients');
 }

 return (
  <div className="p-8 pb-24 max-w-[640px] [&_button]:cursor-pointer">
   <button
    type="button"
    onClick={() => navigate(returnToWarehouse ? `/warehouse/${defaultWarehouse}` : '/menu/ingredients')}
    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
   >
    <ArrowLeft className="w-4 h-4" />
    Назад к ингредиентам
   </button>

   <h2 className="text-2xl font-bold mb-1">Добавить ингредиенты</h2>
   <p className="text-sm text-muted-foreground mb-8">
    Заполните карточки и нажмите «Сохранить». Пустые названия будут пропущены.
   </p>

   <div className="space-y-6 mb-8">
    {blocks.map((block, index) => (
     <div
      key={block.key}
      className="rounded-xl border border-border/60 bg-background p-6 space-y-4 shadow-sm"
     >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
       <span className="text-sm font-medium text-muted-foreground">
        {blocks.length > 1 ? `Ингредиент ${index + 1}` : 'Новый ингредиент'}
       </span>
       {blocks.length > 1 && (
        <button
         type="button"
         onClick={() => removeBlock(block.key)}
         className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
        >
         <Trash2 className="w-3.5 h-3.5" />
         Удалить
        </button>
       )}
      </div>

      <Field label="Название">
       <input
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
        placeholder="Например: Куриное филе"
        value={block.name}
        onChange={(e) => patchBlock(block.key, { name: e.target.value })}
       />
      </Field>

      <Field label="Ед. измерения">
       <SegmentedRow
        options={UNITS}
        value={block.unit}
        onChange={(u) => patchBlock(block.key, { unit: u || 'кг' })}
       />
      </Field>

      <Field label="Остаток на складе">
       <input
        type="number"
        className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm bg-background text-right tabular-nums"
        placeholder="0"
        value={block.stockQuantity}
        onChange={(e) => patchBlock(block.key, { stockQuantity: e.target.value })}
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
           onClick={() =>
            patchBlock(block.key, {
             workshopId: block.workshopId === w.id ? '' : w.id,
            })
           }
           className={`px-4 py-1.5 rounded-md text-sm transition-all ${
            block.workshopId === w.id
             ? 'bg-white text-foreground'
             : 'text-muted-foreground hover:text-foreground'
           }`}
           style={
            block.workshopId === w.id
             ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' }
             : {}
           }
          >
           {w.name}
          </button>
         ))}
        </div>
       ) : (
        <p className="text-sm text-muted-foreground">Нет цехов — добавьте их на странице ингредиентов.</p>
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
          const active = block.warehouseIds.includes(w.id);
          return (
           <label
            key={w.id}
            className="flex items-center gap-2 text-sm text-foreground"
           >
            <input
             type="checkbox"
             checked={active}
             onChange={() =>
              patchBlock(block.key, {
               warehouseIds: active
                ? block.warehouseIds.filter((id) => id !== w.id)
                : [...block.warehouseIds, w.id],
              })
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
     </div>
    ))}
   </div>

   <button
    type="button"
    onClick={addBlock}
    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground border border-dashed rounded-lg hover:border-foreground hover:text-foreground transition-colors mb-10"
   >
    <Plus className="w-4 h-4" />
    Добавить ещё один
   </button>

   <div className="flex items-center justify-end gap-3 pt-4 border-t">
    <button
     type="button"
     onClick={() => navigate(returnToWarehouse ? `/warehouse/${defaultWarehouse}` : '/menu/ingredients')}
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
 );
}
