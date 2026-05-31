import { useState, useMemo } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { EditPage } from '@/components/ui/EditPage';
import { Field } from '@/components/ui/Field';
import { DeleteLineButton } from '@/components/ui/DeleteButton';
import { SearchableSelect } from '@/components/shadcn/searchable-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import { DatePicker } from '@/components/shadcn/date-picker';
import { TimePicker } from '@/components/shadcn/time-picker';
import { useWarehouseIngredients, useWarehouses } from '@/hooks/useMenuData';
import {
 useCreateWriteOff,
 useUpdateWriteOff,
 useWarehouseWriteOff,
 type WriteOffRow,
} from '@/hooks/useWarehouse';
import { useWarehouseLines } from '@/hooks/useWarehouseLines';
import { toast } from 'sonner';
import { DecimalSuffixInput } from '@/components/DecimalSuffixInput';
import { parseDecimalField, quantitySuffix } from '@/lib/decimalMask';
import { localDateTimeFromIso, qtyToString } from '@/lib/warehouse-form-utils';

const REASONS = ['Испорчено', 'Просрочка', 'Служебное питание', 'Пересорт', 'Другое'] as const;

interface LineItem {
 key: number;
 product_id: string;
 name: string;
 unit: string;
 quantity: string;
 reason: string;
}

let nextKey = 1;

function emptyLine(): LineItem {
 return { key: nextKey++, product_id: '', name: '', unit: '', quantity: '', reason: REASONS[0] };
}

function linesFromWriteOffItems(items: WriteOffRow['items']): LineItem[] {
 if (!items.length) return [emptyLine()];
 return items.map((it) => ({
  key: nextKey++,
  product_id: it.product_id || '',
  name: it.name,
  unit: it.unit,
  quantity: qtyToString(it.quantity),
  reason: it.reason?.trim() || REASONS[0],
 }));
}

function WriteOffFormInner({ initialWriteOff }: { initialWriteOff: WriteOffRow | null }) {
 const navigate = useNavigate();
 const [warehouseId, setWarehouseId] = useState(() => (initialWriteOff as any)?.warehouse_id ?? '');
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
   })),
  [ingRows],
 );
 const { data: warehouses = [], isPending: warehousesPending } = useWarehouses();
 const createWriteOff = useCreateWriteOff();
 const updateWriteOff = useUpdateWriteOff();

 const editId = initialWriteOff?.id ?? null;

 const [date, setDate] = useState(() =>
  initialWriteOff ? localDateTimeFromIso(initialWriteOff.date).date : new Date().toISOString().slice(0, 10)
 );
 const [time, setTime] = useState(() =>
  initialWriteOff ? localDateTimeFromIso(initialWriteOff.date).time : new Date().toTimeString().slice(0, 5)
 );
 const [comment, setComment] = useState(() => initialWriteOff?.comment ?? '');
 const [saving, setSaving] = useState(false);

 const { lines, setLines, addRow, removeLine, patchLine, usedIds } = useWarehouseLines(
  emptyLine,
  linesFromWriteOffItems,
  initialWriteOff?.items,
 );

 const reasonOptions = useMemo(() => {
  const o: string[] = [...REASONS];
  for (const l of lines) {
   const r = l.reason?.trim();
   if (r && !o.includes(r)) o.push(r);
  }
  return o;
 }, [lines]);

 function pickIngredient(key: number, ingredientId: string) {
  const ing = ingredients.find((i) => i.id === ingredientId);
  if (!ing) return;
  setLines((prev) =>
   prev.map((l) =>
    l.key === key ? { ...l, product_id: ing.id, name: ing.name, unit: ing.unit } : l
   )
  );
 }

 function goBack() {
  if (editId) navigate(`/warehouse/write-offs/${editId}`);
  else navigate('/warehouse/write-offs');
 }

 async function handleSave() {
  const validLines = lines.filter((l) => l.product_id && parseDecimalField(l.quantity) > 0);
  if (validLines.length === 0) {
   toast.error('Добавьте хотя бы один ингредиент');
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
    reason: l.reason,
   }));

   if (editId) {
    await updateWriteOff.mutateAsync({
     id: editId,
     date: `${date}T${time}`,
     comment: comment.trim(),
     warehouse_id: warehouseId || undefined,
     workshop_id: undefined,
     items: payloadItems,
    });
    toast.success('Изменения сохранены');
    navigate(`/warehouse/write-offs/${editId}`);
   } else {
    const id = await createWriteOff.mutateAsync({
     date: `${date}T${time}`,
     comment: comment.trim(),
     warehouse_id: warehouseId || undefined,
     workshop_id: undefined,
     items: payloadItems,
    });
    toast.success('Списание создано');
    navigate(`/warehouse/write-offs/${id}`);
   }
  } catch (e: unknown) {
   toast.error('Ошибка: ' + ((e as Error)?.message || 'неизвестная'));
  } finally {
   setSaving(false);
  }
 }

 return (
  <EditPage
   title={editId ? 'Редактирование списания' : 'Новое списание'}
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

    <Field label="Склад">
     {warehousesPending ? (
      <p className="text-sm text-muted-foreground">Загрузка…</p>
     ) : (
      <Tabs value={warehouseId} onValueChange={setWarehouseId}>
       <TabsList className="flex-wrap h-auto">
        {warehouses.map((w) => (
         <TabsTrigger key={w.id} value={w.id}>{w.name}</TabsTrigger>
        ))}
       </TabsList>
      </Tabs>
     )}
    </Field>

    <Field label="Комментарий" topLabel>
     <textarea
      className="w-full max-w-sm px-3 py-2 border border-[#E6E5E3] rounded-lg text-sm resize-none"
      rows={2}
      placeholder="Необязательно"
      value={comment}
      onChange={(e) => setComment(e.target.value)}
     />
    </Field>
   </div>

   <div className="mb-8">
    <div className="flex items-center gap-2 pb-2 mb-1 text-xs font-normal text-foreground">
     <div className="flex-[3] min-w-0">Ингредиент</div>
     <div className="w-24 shrink-0 text-right">Кол-во</div>
     <div className="w-40">Причина</div>
     <div className="w-9" />
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
        />
       </div>
       <div className="w-24 shrink-0">
        <DecimalSuffixInput
         value={line.quantity}
         onChange={(v) => patchLine(line.key, 'quantity', v)}
         suffix={quantitySuffix(line.unit)}
        />
       </div>
       <div className="w-40">
        <select
         className="w-full px-2 py-1.5 border border-[#E6E5E3] rounded-lg text-sm "
         value={line.reason}
         onChange={(e) => patchLine(line.key, 'reason', e.target.value)}
        >
         {reasonOptions.map((r) => (
          <option key={r} value={r}>
           {r}
          </option>
         ))}
        </select>
       </div>
       <div className="w-9 flex justify-center">
        <DeleteLineButton onClick={() => removeLine(line.key)} />
       </div>
      </div>
     ))}
    </div>

    <button
     type="button"
     onClick={addRow}
     className="flex items-center gap-1.5 mt-6 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer hover:opacity-80"
     style={{ color: '#5D4FF1' }}
    >
     <Plus className="w-4 h-4" />
     Добавить строку
    </button>
   </div>
  </EditPage>
 );
}

export function NewWriteOff() {
 const navigate = useNavigate();
 const { pathname } = useLocation();
 const editMatch = matchPath({ path: '/warehouse/write-offs/:id/edit', end: true }, pathname);
 const editId = editMatch?.params.id;
 const isEdit = Boolean(editId);
 const { data: w, isLoading, isError, error } = useWarehouseWriteOff(isEdit ? editId : undefined);

 if (isEdit && isLoading) {
  return <div className="p-8 text-muted-foreground">Загрузка…</div>;
 }

 if (isEdit && (isError || !w)) {
  return (
   <div className="p-8 space-y-4">
    <p className="text-muted-foreground">
     {isError ? String((error as Error)?.message ?? 'Ошибка') : 'Списание не найдено'}
    </p>
    <button
     type="button"
     onClick={() => navigate('/warehouse/write-offs')}
     className="text-sm text-primary font-medium"
    >
     К списку списаний
    </button>
   </div>
  );
 }

 if (isEdit && w?.status === 'Отменено') {
  return (
   <div className="p-8 max-w-lg space-y-4">
    <p className="text-muted-foreground">Отменённое списание нельзя редактировать.</p>
    <button
     type="button"
     onClick={() => navigate(`/warehouse/write-offs/${w.id}`)}
     className="text-sm text-primary font-medium"
    >
     К документу
    </button>
   </div>
  );
 }

 return <WriteOffFormInner key={isEdit ? w!.id : 'new'} initialWriteOff={isEdit ? w! : null} />;
}
