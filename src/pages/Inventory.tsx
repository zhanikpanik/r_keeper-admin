import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { toast } from 'sonner';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import { useWarehouses, useWarehouseIngredients } from '@/hooks/useMenuData';
import {
 useWarehouseInventorySessions,
 useCreateInventorySession,
 useSaveInventoryLines,
 usePostInventorySession,
 Q_INV,
 type InventoryActRow,
 type InventoryUiStatus,
} from '@/hooks/useWarehouse';
import {
 fetchAdminInventoryPeriodMovements,
 mergePeriodMovementsIntoCountRows,
 resolveInventoryMovementWindow,
 resolveWorkshopToWarehouseId,
} from '@/lib/inventoryPeriodMovements';

type InventoryStep = 'history' | 'setup' | 'counting';

interface CountRow {
 id: string;
 name: string;
 unit: string;
 start: number;
 incoming: number;
 consumption: number;
 writeoff: number;
 theoretical: number;
 actual: string;
 price: number;
}

interface InventoryLineRow {
 id: string;
 product_id: string | null;
 name: string;
 unit: string | null;
 theoretical: string | number | null;
 actual: string | number | null;
 unit_price: string | number | null;
}

const INVENTORY_HISTORY_GRID = '100px minmax(140px,200px) 120px 120px 140px 32px';
const INVENTORY_COUNTING_GRID = '200px 80px 80px 80px 80px 90px 110px 90px 120px';

function getStatusColor(status: InventoryUiStatus) {
 switch (status) {
  case 'Проведено':
   return 'text-green-600';
  case 'Черновик':
   return 'text-amber-600';
  case 'Отменено':
   return 'text-red-600';
  default:
   return 'text-muted-foreground';
 }
}

function SetupField({ label, children }: { label: string; children: React.ReactNode }) {
 return (
  <div className="flex items-start gap-4">
   <label className="w-32 text-sm shrink-0 pt-2 sm:w-36">{label}</label>
   <div className="min-w-0 flex-1">{children}</div>
  </div>
 );
}

async function fetchIngredients(warehouseId: string, productIds?: string[]): Promise<CountRow[]> {
 if (!warehouseId) return [];

 let q = supabase
  .from('warehouse_products')
  .select('product_id, products!inner(id, name, unit, price, cost_price)')
  .eq('warehouse_id', warehouseId);

 if (productIds?.length) {
  q = q.in('product_id', productIds);
 }

 const { data, error } = await q;
 if (error) throw error;

 const productIdsInWarehouse = (data ?? []).map((r: any) => r.product_id as string).filter(Boolean);
 if (productIdsInWarehouse.length === 0) return [];

 const { data: stockRows, error: stockErr } = await supabase
  .from('stock_items')
  .select('product_id, quantity')
  .eq('warehouse_id', warehouseId)
  .in('product_id', productIdsInWarehouse);
 if (stockErr) throw stockErr;

 const stockByProduct = new Map<string, number>();
 for (const row of stockRows ?? []) {
  stockByProduct.set((row as any).product_id, Number((row as any).quantity) || 0);
 }

 const rows: CountRow[] = [];
 for (const raw of data ?? []) {
  const p = Array.isArray((raw as any).products) ? (raw as any).products[0] : (raw as any).products;
  if (!p) continue;
  const id = (raw as any).product_id as string;
  const stock = stockByProduct.get(id) ?? 0;
  const price = Number(p.cost_price ?? p.price) || 0;
  rows.push({
   id,
   name: p.name,
   unit: p.unit || 'кг',
   start: stock,
   incoming: 0,
   consumption: 0,
   writeoff: 0,
   theoretical: stock,
   actual: '',
   price,
  });
 }
 return rows;
}

type LoadCountingOpts = { mode: 'full' | 'partial'; partialIds: string[] };

export function Inventory() {
 const [step, setStep] = useState<InventoryStep>('history');
 const [search, setSearch] = useState('');
 const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
 const [inventoryType, setInventoryType] = useState<'full' | 'partial'>('full');
 const [partialSelectedIds, setPartialSelectedIds] = useState<string[]>([]);
 const [partialSearch, setPartialSearch] = useState('');
 const [conductDate, setConductDate] = useState(() => new Date().toISOString().slice(0, 10));
 const [conductTime, setConductTime] = useState(() => new Date().toTimeString().slice(0, 5));
 const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
 const [countingItems, setCountingItems] = useState<CountRow[]>([]);
 const [countingRowsLoading, setCountingRowsLoading] = useState(false);
 const [countingError, setCountingError] = useState<string | null>(null);
 const [movementPeriodHint, setMovementPeriodHint] = useState<string | null>(null);

 const { data: warehouses = [] } = useWarehouses();
 const { data: inventories = [], isLoading: invLoading } = useWarehouseInventorySessions();
 const {
  data: partialIngredientList = [],
  isPending: partialListPending,
 } = useWarehouseIngredients(selectedWorkshopId || null, {
  enabled:
   step === 'setup' && inventoryType === 'partial' && Boolean(selectedWorkshopId),
 });
 const createSession = useCreateInventorySession();
 const saveLines = useSaveInventoryLines();
 const postSession = usePostInventorySession();
 const queryClient = useQueryClient();
 const [searchParams, setSearchParams] = useSearchParams();

 // Quick-start from dashboard: skip setup, auto-create partial session
 useEffect(() => {
   const quick = searchParams.get('quick');
   const products = searchParams.get('products');
   const warehouse = searchParams.get('warehouse');
   if (quick !== 'true' || !products || !warehouse || activeSessionId) return;

   const productIds = products.split(',').filter(Boolean);
   if (productIds.length === 0) return;

   let cancelled = false;
   setSelectedWorkshopId(warehouse);
   setInventoryType('partial');
   setPartialSelectedIds(productIds);

   (async () => {
     try {
       const id = await createSession.mutateAsync({
         warehouse_id: warehouse,
         workshop_id: undefined,
         inventory_type: 'partial',
         conducted_at: new Date().toISOString(),
       });
       if (cancelled) return;
       setActiveSessionId(id);
       setStep('counting');
       setCountingRowsLoading(true);
       try {
         await loadCountingRows(id, warehouse, { mode: 'partial', partialIds: productIds });
       } finally {
         if (!cancelled) setCountingRowsLoading(false);
       }
       setSearchParams({}, { replace: true });
     } catch (err) {
       if (!cancelled) {
         toast.error('Не удалось создать быструю инвентаризацию');
         setStep('history');
         setSearchParams({}, { replace: true });
       }
     }
   })();

   return () => { cancelled = true; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const ingredientsForPartialSelect = useMemo(() => {
  const q = partialSearch.trim().toLowerCase();
  const sel = new Set(partialSelectedIds);
  return [...partialIngredientList]
   .filter((i) => sel.has(i.id) || i.name.toLowerCase().includes(q))
   .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
 }, [partialIngredientList, partialSearch, partialSelectedIds]);

 const loadCountingRows = useCallback(
  async (sessionId: string, workshopId: string, opts?: LoadCountingOpts) => {
   setCountingError(null);
   try {
    const attachPeriodMovements = async (baseRows: CountRow[]): Promise<CountRow[]> => {
     if (baseRows.length === 0) {
      setMovementPeriodHint(null);
      return baseRows;
     }
     // selectedWorkshopId is actually a warehouse_id (misnamed variable).
     // It's set from the warehouses list in the setup form.
     const warehouseId = selectedWorkshopId;
     if (!warehouseId) {
      setMovementPeriodHint(null);
      return baseRows;
     }
     const window = await resolveInventoryMovementWindow(sessionId, warehouseId);
     if (!window) {
      setMovementPeriodHint(null);
      return baseRows;
     }
     const map = await fetchAdminInventoryPeriodMovements(
      VENUE_ID,
      warehouseId,
      window.pFrom,
      window.pTo
     );
     setMovementPeriodHint(window.label);
     return mergePeriodMovementsIntoCountRows(baseRows, map);
    };

    const { data: lines } = await supabase
     .from('warehouse_inventory_lines')
     .select('*')
     .eq('session_id', sessionId);

    if (lines && lines.length > 0) {
     const baseRows = (lines as InventoryLineRow[]).map((l) => {
      const theo = Number(l.theoretical) || 0;
      return {
       id: l.product_id || l.id,
       name: l.name,
       unit: l.unit || 'кг',
       start: theo,
       incoming: 0,
       consumption: 0,
       writeoff: 0,
       theoretical: theo,
       actual: l.actual != null ? String(l.actual) : '',
       price: Number(l.unit_price) || 0,
      };
     });
     const merged = await attachPeriodMovements(baseRows);
     setCountingItems(merged);
     return;
    }

    if (opts?.mode === 'partial') {
     if (!opts.partialIds.length) {
      setMovementPeriodHint(null);
      setCountingItems([]);
      return;
     }
     const baseRows = await fetchIngredients(workshopId, opts.partialIds);
     const merged = await attachPeriodMovements(baseRows);
     setCountingItems(merged);
     return;
    }

    const baseRows = await fetchIngredients(workshopId);
    const merged = await attachPeriodMovements(baseRows);
    setCountingItems(merged);
   } catch (err) {
    setCountingError(err instanceof Error ? err.message : 'Не удалось загрузить позиции');
   }
  },
  []
 );

 const handleActualChange = (id: string, value: string) => {
  setCountingItems((items) =>
   items.map((item) => (item.id === id ? { ...item, actual: value } : item))
  );
 };

 const handleStartFromSetup = async () => {
  if (!selectedWorkshopId) return;
  if (inventoryType === 'partial' && partialSelectedIds.length === 0) return;
  const id = await createSession.mutateAsync({
   warehouse_id: selectedWorkshopId,
   workshop_id: undefined,
   inventory_type: inventoryType,
   conducted_at: new Date(`${conductDate}T${conductTime}`).toISOString(),
  });
  setActiveSessionId(id);
  setStep('counting');
  setCountingRowsLoading(true);
  try {
   await loadCountingRows(id, selectedWorkshopId, {
    mode: inventoryType,
    partialIds: partialSelectedIds,
   });
  } finally {
   setCountingRowsLoading(false);
  }
 };

 const handleContinueDraft = async (inv: InventoryActRow) => {
  if (!inv.warehouse_id) return;
  setActiveSessionId(inv.id);
  setSelectedWorkshopId(inv.warehouse_id);
  setStep('counting');
  setCountingRowsLoading(true);
  try {
   await loadCountingRows(inv.id, inv.warehouse_id);
  } finally {
   setCountingRowsLoading(false);
  }
 };

 const handleDeleteSession = async (id: string) => {
  const { error: linesErr } = await supabase
   .from('warehouse_inventory_lines')
   .delete()
   .eq('session_id', id);
  if (linesErr) {
   toast.error('Ошибка: ' + linesErr.message);
   return;
  }
  const { error: sessionErr } = await supabase
   .from('warehouse_inventory_sessions')
   .delete()
   .eq('id', id);
  if (sessionErr) {
   toast.error('Ошибка: ' + sessionErr.message);
   return;
  }
  await queryClient.invalidateQueries({ queryKey: Q_INV });
  if (activeSessionId === id) {
   setActiveSessionId(null);
   setCountingItems([]);
  }
 };

 const handlePostCounting = async () => {
  if (!activeSessionId) return;
  await saveLines.mutateAsync({
   sessionId: activeSessionId,
   lines: countingItems.map((i) => ({
    product_id: i.id,
    name: i.name,
    unit: i.unit,
    theoretical: i.theoretical,
    actual: i.actual === '' ? null : parseFloat(i.actual),
    unit_price: i.price,
   })),
  });
  await postSession.mutateAsync(activeSessionId);
  setMovementPeriodHint(null);
  setStep('history');
  setActiveSessionId(null);
  setCountingItems([]);
 };

 // --- History columns ---
 const historyColumns = useMemo<ColumnDef<InventoryActRow, any>[]>(() => [
  {
   id: 'date',
   header: 'Дата',
   cell: ({ row }) => (
    <span className="text-sm">
     {new Date(row.original.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
    </span>
   ),
  },
  {
   id: 'warehouse',
   header: 'Склад',
   meta: { align: 'text-left', className: 'text-left' },
   cell: ({ row }) => <span className="text-sm truncate block">{row.original.warehouse}</span>,
  },
  {
   id: 'status',
   header: 'Статус',
   meta: { align: 'text-left', className: 'text-left' },
   cell: ({ row }) => <span className={`text-sm ${getStatusColor(row.original.status)}`}>{row.original.status}</span>,
  },
  {
   id: 'result',
   header: 'Результат',
   cell: ({ row }) => {
    const inv = row.original;
    return (
     <span className={`text-sm font-medium ${inv.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
      {inv.result > 0 ? '+' : ''}{somRounded(inv.result).toLocaleString()} сом
     </span>
    );
   },
   meta: { align: 'text-right' },
  },
  {
   id: 'actions',
   header: '',
   cell: ({ row }) => {
    const inv = row.original;
    if (inv.status !== 'Черновик') return null;
    return (
     <div className="flex items-center gap-1">
      <button
       type="button"
       onClick={(e) => { e.stopPropagation(); handleContinueDraft(inv); }}
       className="text-sm font-medium text-primary hover:text-primary/70 transition-colors px-2"
      >
       Продолжить
      </button>
      <DeleteButton onClick={(e) => { e.stopPropagation(); handleDeleteSession(inv.id); }} />
     </div>
    );
   },
  },
 ], [handleContinueDraft, handleDeleteSession]);

 // --- History ---
 if (step === 'history') {
  const filtered = inventories.filter(
   (inv) =>
    inv.warehouse.toLowerCase().includes(search.toLowerCase()) ||
    inv.date.includes(search)
  );

  return (
   <div className="p-8 [&_button]:cursor-pointer">
   <div className="flex items-center justify-between mb-6">
     <h2 className="text-2xl font-bold">Инвентаризация</h2>
     <button
      onClick={() => {
       setPartialSelectedIds([]);
       setPartialSearch('');
       setStep('setup');
      }}
      className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
     >
      + Начать инвентаризацию
     </button>
    </div>

    <div className="flex items-center gap-2 mb-4">
     <SearchInput value={search} onChange={setSearch} placeholder="Поиск по складу или дате..." className="w-64" />
    </div>

    {invLoading && <p className="text-sm text-muted-foreground py-4">Загрузка…</p>}

    {!invLoading && (
     <DataTable
      data={filtered}
      columns={historyColumns}
      dense
      emptyMessage="Нет записей"
      className="max-w-4xl"
     />
    )}
   </div>
  );
 }

 // --- Setup ---
 if (step === 'setup') {
  return (
   <div className="p-8 pb-24 max-w-3xl [&_button]:cursor-pointer">
    <button
     type="button"
     onClick={() => {
      setPartialSelectedIds([]);
      setPartialSearch('');
      setStep('history');
     }}
     className="flex items-center gap-1.5 text-sm hover:text-foreground transition-colors mb-8"
    >
     <ArrowLeft className="w-4 h-4" />
     Инвентаризации
    </button>

    <h2 className="text-2xl font-bold mb-8">Новая инвентаризация</h2>

    <div className="space-y-4 mb-10">
     <SetupField label="Дата">
      <input
       type="date"
       className="w-40 px-3 py-2 border rounded-lg text-sm bg-background"
       value={conductDate}
       onChange={(e) => setConductDate(e.target.value)}
      />
     </SetupField>

     <SetupField label="Время">
      <input
       type="time"
       className="w-32 px-3 py-2 border rounded-lg text-sm bg-background"
       value={conductTime}
       onChange={(e) => setConductTime(e.target.value)}
      />
     </SetupField>

     <SetupField label="Склад">
      <div
       className="inline-flex flex-wrap gap-0.5 rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"

      >
       {warehouses.map((w) => (
        <button
         key={w.id}
         type="button"
         onClick={() => {
          setSelectedWorkshopId(w.id);
          setPartialSelectedIds([]);
         }}
         className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
          selectedWorkshopId === w.id
           ? 'bg-white text-foreground shadow-sm'
           : 'text-muted-foreground hover:text-foreground'
         }`}
         
        >
         {w.name}
        </button>
       ))}
      </div>
     </SetupField>

     <SetupField label="Тип">
      <div
       className="inline-flex flex-wrap gap-0.5 rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"

      >
       <button
        type="button"
        onClick={() => {
         setInventoryType('full');
         setPartialSelectedIds([]);
        }}
        className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
         inventoryType === 'full'
          ? 'bg-white text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
        }`}
        
       >
        Полная
       </button>
       <button
        type="button"
        onClick={() => setInventoryType('partial')}
        className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
         inventoryType === 'partial'
          ? 'bg-white text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
        }`}
        style={inventoryType === 'partial' ? {  } : {}}
       >
        Частичная
       </button>
      </div>
     </SetupField>

     {inventoryType === 'partial' && selectedWorkshopId && (
      <SetupField label="Позиции">
       <div className="space-y-2 max-w-md">
        <p className="text-sm text-muted-foreground">
         Удерживайте Cmd (Mac) или Ctrl (Windows) для нескольких позиций.
        </p>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
         <Search className="w-3.5 h-3.5 text-muted-foreground opacity-40 shrink-0" alt="" />
         <input
          className="bg-transparent text-sm outline-none flex-1 min-w-0"
          placeholder="Поиск по названию…"
          value={partialSearch}
          onChange={(e) => setPartialSearch(e.target.value)}
         />
        </div>
        {partialListPending ? (
         <p className="text-sm text-muted-foreground py-2">Загрузка…</p>
        ) : (
         <select
          multiple
          size={12}
          className="w-full min-h-[12rem] px-2 py-1 border rounded-lg text-sm bg-background"
          value={partialSelectedIds}
          onChange={(e) =>
           setPartialSelectedIds(
            Array.from(e.target.selectedOptions, (o) => o.value)
           )
          }
         >
          {ingredientsForPartialSelect.map((i) => (
           <option key={i.id} value={i.id}>
            {i.name} · {i.unit}
           </option>
          ))}
         </select>
        )}
       </div>
      </SetupField>
     )}
    </div>

    <div className="flex gap-3">
     <button
      type="button"
      disabled={
       !selectedWorkshopId ||
       createSession.isPending ||
       (inventoryType === 'partial' && partialSelectedIds.length === 0)
      }
      onClick={handleStartFromSetup}
      className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
     >
      Начать инвентаризацию
     </button>
     <button
      type="button"
      onClick={() => setStep('history')}
      className="px-6 py-2.5 border rounded-lg text-sm hover:bg-secondary transition-colors"
     >
      Отмена
     </button>
    </div>
   </div>
  );
 }

 // --- Counting columns ---
 const countingColumns = useMemo<ColumnDef<CountRow, any>[]>(() => [
  {
   id: 'name',
   header: 'Наименование',
   meta: { align: 'text-left', className: 'text-left' },
   cell: ({ row }) => <div className="text-sm font-medium truncate">{row.original.name}</div>,
  },
  {
   id: 'start',
   header: 'Нач. ост.',
   cell: ({ row }) => <span className="text-sm">{row.original.start} {row.original.unit}</span>,
   meta: { align: 'text-right' },
  },
  {
   id: 'incoming',
   header: 'Поступл.',
   cell: ({ row }) => <span className="text-sm text-blue-600 font-medium">+{row.original.incoming} {row.original.unit}</span>,
   meta: { align: 'text-right' },
  },
  {
   id: 'consumption',
   header: 'Расход',
   cell: ({ row }) => <span className="text-sm text-amber-600 font-medium">-{row.original.consumption} {row.original.unit}</span>,
   meta: { align: 'text-right' },
  },
  {
   id: 'writeoff',
   header: 'Списано',
   cell: ({ row }) => <span className="text-sm text-red-600 font-medium">-{row.original.writeoff} {row.original.unit}</span>,
   meta: { align: 'text-right' },
  },
  {
   id: 'theoretical',
   header: 'План. ост.',
   cell: ({ row }) => <span className="text-sm bg-blue-50/50 py-1 rounded">{row.original.theoretical} {row.original.unit}</span>,
   meta: { align: 'text-right' },
  },
  {
   id: 'actual',
   header: 'Факт. ост.',
   cell: ({ row }) => {
    const item = row.original;
    return (
     <div className="relative">
      <input
       type="number"
       className="w-full pl-2 pr-8 py-0.5 border rounded text-sm bg-background text-right outline-none focus:border-primary"
       placeholder="0.00"
       value={item.actual}
       onChange={(e) => handleActualChange(item.id, e.target.value)}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
       {item.unit}
      </span>
     </div>
    );
   },
   meta: { align: 'text-right' },
  },
  {
   id: 'diff',
   header: 'Разница',
   cell: ({ row }) => {
    const item = row.original;
    if (item.actual === '') return <span className="text-muted-foreground text-sm">—</span>;
    const actualNum = parseFloat(item.actual) || 0;
    const diff = actualNum - item.theoretical;
    const color = diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-muted-foreground';
    const label = (diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)) + ` ${item.unit}`;
    return <span className={`text-sm ${color}`}>{label}</span>;
   },
   meta: { align: 'text-right' },
  },
  {
   id: 'diffSom',
   header: 'Разница, сом',
   cell: ({ row }) => {
    const item = row.original;
    if (item.actual === '') return <span className="text-muted-foreground text-sm">—</span>;
    const actualNum = parseFloat(item.actual) || 0;
    const diff = actualNum - item.theoretical;
    const diffSom = diff * item.price;
    const roundedSom = somRounded(diffSom);
    const color = diffSom < 0 ? 'text-red-600' : diffSom > 0 ? 'text-green-600' : 'text-muted-foreground';
    const label = (roundedSom > 0 ? `+${roundedSom.toLocaleString()}` : roundedSom.toLocaleString()) + ' сом';
    return <span className={`text-sm ${color}`}>{label}</span>;
   },
   meta: { align: 'text-right' },
  },
 ], [handleActualChange]);

 // --- Counting ---
 const selectedSkladName =
  warehouses.find((w) => w.id === selectedWorkshopId)?.name || 'Склад';

 return (
  <div className="p-8 [&_button]:cursor-pointer">
   <div className="flex items-center justify-between mb-6">
    <div>
     <button
      type="button"
      onClick={() => {
       setMovementPeriodHint(null);
       setStep('history');
      }}
      className="flex items-center gap-1.5 text-sm hover:text-foreground transition-colors mb-2"
     >
      <ArrowLeft className="w-4 h-4" />
      Инвентаризации
     </button>
     <h2 className="text-2xl font-bold">Инвентаризация: {selectedSkladName}</h2>
     {movementPeriodHint && (
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{movementPeriodHint}</p>
     )}
    </div>
    <div className="flex gap-2">
     <button
      type="button"
      disabled={saveLines.isPending || postSession.isPending}
      onClick={handlePostCounting}
      className="inline-flex cursor-pointer items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
     >
      <Check className="w-4 h-4 shrink-0" aria-hidden />
      Провести
     </button>
    </div>
   </div>

   {countingError && (
    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
     {countingError}
    </div>
   )}

   <DataTable
    data={countingItems}
    columns={countingColumns}
    dense
    isLoading={countingRowsLoading}
    error={countingError ? new Error(countingError) : null}
    emptyMessage="Нет позиций для сверки"
    className="max-w-4xl"
   />
  </div>
 );
}
