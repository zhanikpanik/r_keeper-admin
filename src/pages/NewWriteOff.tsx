import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, Plus } from 'lucide-react';
import { useWarehouseIngredients, useWarehouses } from '@/hooks/useMenuData';
import {
  useCreateWriteOff,
  useUpdateWriteOff,
  useWarehouseWriteOff,
  type WriteOffRow,
} from '@/hooks/useWarehouse';
import { toast } from 'sonner';
import { DecimalSuffixInput } from '@/components/DecimalSuffixInput';
import { parseDecimalField, quantitySuffix } from '@/lib/decimalMask';

const REASONS = ['Испорчено', 'Просрочка', 'Служебное питание', 'Пересорт', 'Другое'] as const;

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

interface LineItem {
  key: number;
  product_id: string;
  name: string;
  unit: string;
  quantity: string;
  reason: string;
}

function localDateTimeFromIso(iso: string) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function qtyToString(q: number): string {
  if (!Number.isFinite(q)) return '';
  const s = String(q);
  if (s.includes('e')) return String(Math.round(q * 10000) / 10000);
  return s;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <label className="w-32 text-sm text-muted-foreground shrink-0 pt-2 sm:w-36">{label}</label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function InlineIngredientPicker({
  ingredients,
  excludeIds,
  value,
  onPick,
  onReplace,
  listPending = false,
  listError = false,
}: {
  ingredients: IngredientOption[];
  excludeIds: Set<string>;
  value: string;
  onPick: (ing: IngredientOption) => void;
  onReplace: () => void;
  listPending?: boolean;
  listError?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = ingredients.filter(
    (i) =>
      !excludeIds.has(i.id) &&
      (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (value) {
    return (
      <div className="flex items-center gap-2 py-1.5 min-w-0">
        <div className="text-sm font-medium truncate flex-1 min-w-0">{value}</div>
        <button type="button" className="text-xs text-primary shrink-0 hover:underline" onClick={onReplace}>
          Заменить
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 border rounded-lg px-2 py-1.5 bg-background">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          className="bg-transparent text-sm outline-none flex-1 min-w-0"
          placeholder="Ингредиент…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && listPending && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20 px-3 py-3 text-sm text-muted-foreground">
          Загрузка…
        </div>
      )}
      {open && listError && !listPending && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20 px-3 py-3 text-sm text-destructive">
          Не удалось загрузить список
        </div>
      )}
      {open && !listPending && !listError && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20 max-h-48 overflow-auto min-w-[200px]">
          {filtered.map((ing) => (
            <button
              key={ing.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFF0F4] transition-colors flex items-center justify-between"
              onClick={() => {
                onPick(ing);
                setSearch('');
                setOpen(false);
              }}
            >
              <span>{ing.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{ing.unit}</span>
            </button>
          ))}
        </div>
      )}
      {open && !listPending && !listError && filtered.length === 0 && search && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20 px-3 py-3 text-sm text-muted-foreground">
          Не найдено
        </div>
      )}
      {open && !listPending && !listError && filtered.length === 0 && !search && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20 px-3 py-3 text-sm text-muted-foreground">
          Нет ингредиентов
        </div>
      )}
    </div>
  );
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
  const [lines, setLines] = useState<LineItem[]>(() =>
    initialWriteOff?.items?.length ? linesFromWriteOffItems(initialWriteOff.items) : [emptyLine()]
  );
  const [saving, setSaving] = useState(false);

  const usedIds = useMemo(
    () => new Set(lines.filter((l) => l.product_id).map((l) => l.product_id)),
    [lines]
  );

  const reasonOptions = useMemo(() => {
    const o: string[] = [...REASONS];
    for (const l of lines) {
      const r = l.reason?.trim();
      if (r && !o.includes(r)) o.push(r);
    }
    return o;
  }, [lines]);

  function pickIngredient(key: number, ing: IngredientOption) {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, product_id: ing.id, name: ing.name, unit: ing.unit } : l
      )
    );
  }

  function replaceIngredientLine(key: number) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, product_id: '', name: '', unit: '' } : l))
    );
  }

  function addRow() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: number) {
    setLines((prev) => {
      if (prev.length === 1) return [emptyLine()];
      return prev.filter((l) => l.key !== key);
    });
  }

  function patchLine(key: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
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
    <div className="p-8 pb-24 max-w-3xl [&_button]:cursor-pointer">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        {editId ? 'Назад к документу' : 'Назад к списаниям'}
      </button>

      <h2 className="text-2xl font-bold mb-8">{editId ? 'Редактирование списания' : 'Новое списание'}</h2>

      <div className="space-y-4 mb-10">
        <Field label="Дата">
          <input
            type="date"
            className="w-40 px-3 py-2 border rounded-lg text-sm bg-background"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Время">
          <input
            type="time"
            className="w-32 px-3 py-2 border rounded-lg text-sm bg-background"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>

        <Field label="Склад">
          {warehousesPending ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : warehouses.length > 0 ? (
            <div
              className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
              style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
            >
              {warehouses.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWarehouseId(warehouseId === w.id ? '' : w.id)}
                  className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                    warehouseId === w.id ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={warehouseId === w.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
                >
                  {w.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет складов</p>
          )}
        </Field>

        <Field label="Комментарий">
          <textarea
            className="w-full max-w-md px-3 py-2 border rounded-lg text-sm bg-background resize-none"
            rows={2}
            placeholder="Необязательно"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Field>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Позиции</h3>

        <div className="flex items-center gap-2 pb-2 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="flex-[3] min-w-0">Ингредиент</div>
          <div className="w-24 shrink-0 text-right">Кол-во</div>
          <div className="w-40">Причина</div>
          <div className="w-9" />
        </div>

        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <div className="flex-[3] min-w-0">
                <InlineIngredientPicker
                  ingredients={ingredients}
                  excludeIds={usedIds}
                  value={line.name}
                  onPick={(ing) => pickIngredient(line.key, ing)}
                  onReplace={() => replaceIngredientLine(line.key)}
                  listPending={ingredientsListPending}
                  listError={ingredientsListError}
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
                  className="w-full px-2 py-1.5 border rounded-lg text-sm bg-background"
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
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить строку
        </button>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={goBack}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : editId ? 'Сохранить' : 'Списать'}
        </button>
      </div>
    </div>
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
