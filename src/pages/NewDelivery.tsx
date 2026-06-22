import { useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, matchPath } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { EditPage } from '@/components/ui/EditPage';
import { Field } from '@/components/ui/Field';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { SearchableSelect } from '@/components/shadcn/searchable-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import { DatePicker } from '@/components/shadcn/date-picker';
import { TimePicker } from '@/components/shadcn/time-picker';
import { useWarehouseIngredients, useWarehouses } from '@/hooks/useMenuData';
import {
 useCreateDelivery,
 useUpdateDelivery,
 useWarehouseDelivery,
 type DeliveryRow,
} from '@/hooks/useWarehouse';
import { useWarehouseLines } from '@/hooks/useWarehouseLines';
import { toast } from 'sonner';
import { DecimalSuffixInput } from '@/components/DecimalSuffixInput';
import { parseDecimalField, quantitySuffix } from '@/lib/decimalMask';
import { localDateTimeFromIso, qtyToString } from '@/lib/warehouse-form-utils';

interface LineItem {
 key: number;
 product_id: string;
 name: string;
 unit: string;
 quantity: string;
 price: string;
 sum: string;
}

function roundMoney(n: number): string {
 if (!Number.isFinite(n)) return '';
 return String(Math.round(n * 100) / 100);
}

let nextKey = 1;

function emptyLine(): LineItem {
 return { key: nextKey++, product_id: '', name: '', unit: '', quantity: '', price: '', sum: '' };
}

function linesFromDeliveryItems(items: DeliveryRow['items']): LineItem[] {
 if (!items.length) return [emptyLine()];
 return items.map((it) => {
  const q = it.quantity;
  const p = it.price;
  return {
   key: nextKey++,
   product_id: it.product_id || '',
   name: it.name,
   unit: it.unit,
   quantity: qtyToString(q),
   price: roundMoney(p),
   sum: roundMoney(q * p),
  };
 });
}

function DeliveryFormInner({
 initialDelivery,
 preselectedWarehouseId,
}: {
 initialDelivery: DeliveryRow | null;
 preselectedWarehouseId?: string;
}) {
 const navigate = useNavigate();
 const [warehouseId, setWarehouseId] = useState(
  () => (initialDelivery as any)?.warehouse_id || preselectedWarehouseId || ''
 );
 const {
  data: ingRows = [],
  isPending: ingredientsListPending,
  isError: ingredientsListError,
 } = useWarehouseIngredients(warehouseId || null, { enabled: Boolean(warehouseId) });
 const ingredients = useMemo(
  () =>
   ingRows.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit || 'кг',
    price: Number(i.price) || 0,
   })),
  [ingRows],
 );
 const { data: warehouses = [], isPending: warehousesPending } = useWarehouses();
 const createDelivery = useCreateDelivery();
 const updateDelivery = useUpdateDelivery();

 const editId = initialDelivery?.id ?? null;

 const [supplier, setSupplier] = useState(() => initialDelivery?.supplier ?? '');
 const [date, setDate] = useState(() =>
  initialDelivery ? localDateTimeFromIso(initialDelivery.date).date : new Date().toISOString().slice(0, 10)
 );
 const [time, setTime] = useState(() =>
  initialDelivery ? localDateTimeFromIso(initialDelivery.date).time : new Date().toTimeString().slice(0, 5)
 );
 const [comment, setComment] = useState(() => initialDelivery?.comment ?? '');
 const [saving, setSaving] = useState(false);

 const { lines, setLines, addRow, removeLine, usedIds } = useWarehouseLines(
  emptyLine,
  linesFromDeliveryItems,
  initialDelivery?.items,
 );

 function pickIngredient(key: number, ingredientId: string) {
  const ing = ingredients.find((i) => i.id === ingredientId);
  if (!ing) return;
  setLines((prev) =>
   prev.map((l) => {
    if (l.key !== key) return l;
    const q = parseDecimalField(l.quantity);
    const p = Number(ing.price) || 0;
    const priceStr = roundMoney(Number(ing.price) || 0);
    const sumStr = q > 0 && p ? roundMoney(q * p) : l.sum;
    return {
     ...l,
     product_id: ing.id,
     name: ing.name,
     unit: ing.unit,
     price: priceStr,
     sum: sumStr,
    };
   })
  );
 }

 function updateQuantity(key: number, quantity: string) {
  setLines((prev) =>
   prev.map((l) => {
    if (l.key !== key) return l;
    const q = parseDecimalField(quantity);
    const p = parseDecimalField(l.price);
    const s = parseDecimalField(l.sum);
    if (q > 0 && p > 0) {
     return { ...l, quantity, sum: roundMoney(q * p) };
    }
    if (q > 0 && s > 0) {
     return { ...l, quantity, price: roundMoney(s / q) };
    }
    return { ...l, quantity };
   })
  );
 }

 function updatePrice(key: number, price: string) {
  setLines((prev) =>
   prev.map((l) => {
    if (l.key !== key) return l;
    const q = parseDecimalField(l.quantity);
    const p = parseDecimalField(price);
    if (q > 0) {
     return { ...l, price, sum: roundMoney(q * p) };
    }
    return { ...l, price };
   })
  );
 }

 function updateSum(key: number, sum: string) {
  setLines((prev) =>
   prev.map((l) => {
    if (l.key !== key) return l;
    const q = parseDecimalField(l.quantity);
    const s = parseDecimalField(sum);
    if (q > 0 && sum.trim() !== '') {
     return { ...l, sum, price: roundMoney(s / q) };
    }
    return { ...l, sum };
   })
  );
 }

 const total = lines.reduce((acc, l) => {
  const q = parseDecimalField(l.quantity);
  const p = parseDecimalField(l.price);
  if (q > 0) return acc + q * p;
  return acc;
 }, 0);

 function goBack() {
  navigate('/warehouse/operations');
 }

 async function handleSave() {
  const validLines = lines.filter((l) => l.product_id && parseDecimalField(l.quantity) > 0);
  if (validLines.length === 0) {
   toast.error('Добавьте хотя бы один ингредиент');
   return;
  }
  if (!supplier.trim()) {
   toast.error('Укажите поставщика');
   return;
  }
  if (!warehouseId) {
   toast.error('Выберите склад');
   return;
  }

  setSaving(true);
  try {
   const payloadItems = validLines.map((l) => ({
    product_id: l.product_id,
    name: l.name,
    quantity: parseDecimalField(l.quantity),
    unit: l.unit,
    price: parseDecimalField(l.price),
   }));

   if (editId) {
    await updateDelivery.mutateAsync({
     id: editId,
     supplier: supplier.trim(),
     date: `${date}T${time}`,
     comment: comment.trim(),
     warehouse_id: warehouseId || undefined,
     workshop_id: undefined,
     items: payloadItems,
    });
    toast.success('Изменения сохранены');
    navigate('/warehouse/operations');
   } else {
    const id = await createDelivery.mutateAsync({
     supplier: supplier.trim(),
     date: `${date}T${time}`,
     comment: comment.trim(),
     warehouse_id: warehouseId || undefined,
     workshop_id: undefined,
     items: payloadItems,
    });
    toast.success('Поставка создана');
    navigate('/warehouse/operations');
   }
  } catch (e: unknown) {
   toast.error('Ошибка: ' + ((e as Error)?.message || 'неизвестная'));
  } finally {
   setSaving(false);
  }
 }

 return (
  <EditPage
   title={editId ? 'Редактирование поставки' : 'Новая поставка'}
   backTo={goBack}
   onSave={handleSave}
   saving={saving}
  >
   <div className="space-y-4">
    <div className="flex items-center gap-4">
     <label className="w-32 text-sm text-foreground shrink-0 sm:w-36">Дата и время</label>
     <div className="flex items-center gap-2">
      <DatePicker value={date} onChange={setDate} />
      <TimePicker value={time} onChange={setTime} />
     </div>
    </div>

    <Field label="Поставщик">
     <input
      className="w-full max-w-sm px-3 py-2 border border-border rounded-lg text-sm "
      placeholder="Название компании"
      value={supplier}
      onChange={(e) => setSupplier(e.target.value)}
     />
    </Field>

    <Field label="Склад">
     {warehousesPending ? (
      <p className="text-sm text-muted-foreground">Загрузка…</p>
     ) : (
      <Tabs value={warehouseId} onValueChange={setWarehouseId}>
       <TabsList className="flex-wrap h-auto">
        {warehouses.map((w) => (
         <TabsTrigger key={w.id} value={w.id}>
          {w.name}
         </TabsTrigger>
        ))}
       </TabsList>
      </Tabs>
     )}
    </Field>

    <Field label="Комментарий" topLabel>
     <textarea
      className="w-full max-w-sm px-3 py-2 border border-border rounded-lg text-sm resize-none"
      rows={2}
      placeholder="Необязательно"
      value={comment}
      onChange={(e) => setComment(e.target.value)}
     />
    </Field>
   </div>

   <div className="mb-8">
    {!warehouseId && (
     <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Выберите склад, чтобы открыть список ингредиентов.
     </div>
    )}
    {warehouseId && !ingredientsListPending && !ingredientsListError && ingredients.length === 0 && (
     <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-center justify-between gap-3">
      <span>Для этого склада пока не назначены ингредиенты.</span>
      <button
       type="button"
       onClick={() => navigate('/warehouse/settings')}
       className="px-3 py-1 text-sm font-medium border rounded-md hover:bg-secondary transition-colors whitespace-nowrap"
      >
       Назначить в настройках складов
      </button>
     </div>
    )}

    <div className="flex items-center gap-2 pb-2 mb-1 text-xs font-normal text-foreground">
     <div className="flex-[3] min-w-0">Ингредиент</div>
     <div className="w-24 shrink-0 text-right">Кол-во</div>
     <div className="w-28 shrink-0 text-right">Цена</div>
     <div className="w-28 shrink-0 text-right">Сумма</div>
     <div className="w-9 shrink-0" />
    </div>

    <div className="space-y-2">
     {lines.map((line) => (
      <div key={line.key} className="flex items-center gap-2">
       <div className="flex-[3] min-w-0">
        <SearchableSelect
         ingredients={ingredients}
         valueId={line.product_id || null}
         onSelect={(id) => pickIngredient(line.key, id)}
         excludeIds={usedIds}
         disabled={!warehouseId}
        />
       </div>
       <div className="w-24 shrink-0">
        <DecimalSuffixInput
         value={line.quantity}
         onChange={(v) => updateQuantity(line.key, v)}
         suffix={quantitySuffix(line.unit)}
        />
       </div>
       <div className="w-28 shrink-0">
        <DecimalSuffixInput
         value={line.price}
         onChange={(v) => updatePrice(line.key, v)}
         suffix="сом"
        />
       </div>
       <div className="w-28 shrink-0">
        <DecimalSuffixInput
         value={line.sum}
         onChange={(v) => updateSum(line.key, v)}
         suffix="сом"
         bold
        />
       </div>
       <div className="w-9 flex justify-center">
        <DeleteButton variant="line" onClick={() => removeLine(line.key)} />
       </div>
      </div>
     ))}
    </div>

    <button
     type="button"
     onClick={addRow}
     className="flex items-center gap-1.5 mt-6 px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-secondary transition-colors"
    >
     <Plus className="w-4 h-4" />
     Добавить строку
    </button>
   </div>

   {total > 0 && (
    <div className="flex justify-end mb-8">
     <div className="text-sm text-muted-foreground">
      Итого:{' '}
      <span className="text-foreground font-bold text-base">
       {total.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сом
      </span>
     </div>
    </div>
   )}
  </EditPage>
 );
}

export function NewDelivery() {
 const navigate = useNavigate();
 const { pathname } = useLocation();
 const [searchParams] = useSearchParams();
 const editMatch = matchPath({ path: '/warehouse/deliveries/:id/edit', end: true }, pathname);
 const editId = editMatch?.params.id;
 const isEdit = Boolean(editId);
 const { data: d, isLoading, isError, error } = useWarehouseDelivery(isEdit ? editId : undefined);
 const preselectedWarehouseId = searchParams.get('warehouse') || undefined;

 if (isEdit && isLoading) {
  return <div className="p-8 text-muted-foreground">Загрузка…</div>;
 }

 if (isEdit && (isError || !d)) {
  return (
   <div className="p-8 space-y-4">
    <p className="text-muted-foreground">
     {isError ? String((error as Error)?.message ?? 'Ошибка') : 'Поставка не найдена'}
    </p>
    <button
     type="button"
     onClick={() => navigate('/warehouse/operations')}
     className="text-sm text-primary font-medium"
    >
     Все операции
    </button>
   </div>
  );
 }

 if (isEdit && d?.status === 'Отменено') {
  return (
   <div className="p-8 max-w-lg space-y-4">
    <p className="text-muted-foreground">Отменённую поставку нельзя редактировать.</p>
    <button
     type="button"
     onClick={() => navigate('/warehouse/operations')}
     className="text-sm text-primary font-medium"
    >
     Все операции
    </button>
   </div>
  );
 }

 return (
  <DeliveryFormInner
   key={isEdit ? d!.id : 'new'}
   initialDelivery={isEdit ? d! : null}
   preselectedWarehouseId={preselectedWarehouseId}
  />
 );
}
