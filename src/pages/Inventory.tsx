import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import searchIcon from '@/assets/icons/search.svg';
import crossIcon from '@/assets/icons/cross.svg';
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
      <label className="w-32 text-sm text-muted-foreground shrink-0 pt-2 sm:w-36">{label}</label>
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
          const window = await resolveInventoryMovementWindow(sessionId, workshopId);
          if (!window) {
            setMovementPeriodHint(null);
            return baseRows;
          }
          const map = await fetchAdminInventoryPeriodMovements(
            VENUE_ID,
            workshopId,
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
    if (!confirm('Удалить инвентаризацию?')) return;
    const { error: linesErr } = await supabase
      .from('warehouse_inventory_lines')
      .delete()
      .eq('session_id', id);
    if (linesErr) {
      alert('Ошибка: ' + linesErr.message);
      return;
    }
    const { error: sessionErr } = await supabase
      .from('warehouse_inventory_sessions')
      .delete()
      .eq('id', id);
    if (sessionErr) {
      alert('Ошибка: ' + sessionErr.message);
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
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
            <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" alt="" />
            <input
              className="bg-transparent text-sm outline-none flex-1"
              placeholder="Поиск по складу или дате..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setPartialSelectedIds([]);
              setPartialSearch('');
              setStep('setup');
            }}
            className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            + Начать инвентаризацию
          </button>
        </div>

        {invLoading && <p className="text-sm text-muted-foreground py-4">Загрузка…</p>}

        <div
          className="-mx-3 w-fit"
          style={{ display: 'grid', gridTemplateColumns: INVENTORY_HISTORY_GRID }}
        >
          <div className="col-span-6 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
            <div className="pr-6">Дата</div>
            <div className="pr-6">Склад</div>
            <div className="pr-6 text-center">Статус</div>
            <div className="pr-6 text-right">Результат</div>
            <div className="min-w-0 px-4" />
            <div />
          </div>
          <div className="col-span-6 grid grid-cols-subgrid">
            {filtered.map((inv) => {
              const isDraft = inv.status === 'Черновик';
              return (
                <div
                  key={inv.id}
                  className="col-span-6 grid grid-cols-subgrid group hover:bg-[#EFF0F4] transition-colors even:bg-muted/10"
                >
                  <div className="grid grid-cols-subgrid col-span-6 items-center py-2 px-3">
                    <div className="pr-6 text-sm text-muted-foreground">
                      {new Date(inv.date).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </div>
                    <div className="pr-6 text-sm font-semibold truncate">{inv.warehouse}</div>
                    <div className="pr-6 flex justify-center text-sm">
                      <span className={getStatusColor(inv.status)}>{inv.status}</span>
                    </div>
                    <div
                      className={`pr-6 text-sm text-right tabular-nums font-medium ${
                        inv.result < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {inv.result > 0 ? '+' : ''}
                      {somRounded(inv.result).toLocaleString()} сом
                    </div>
                    <div className="min-w-0 px-4">
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => handleContinueDraft(inv)}
                          className="text-sm font-medium text-[#5D4FF1] hover:text-[#F70000] transition-colors"
                        >
                          Продолжить
                        </button>
                      )}
                    </div>
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {isDraft && (
                        <button
                          type="button"
                          className="p-1 text-red-500 opacity-40 hover:opacity-100"
                          onClick={() => handleDeleteSession(inv.id)}
                        >
                          <img src={crossIcon} className="w-4 h-4" alt="" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!invLoading && filtered.length === 0 && (
              <div className="col-span-6 py-12 text-center text-sm text-muted-foreground">
                Нет записей
              </div>
            )}
          </div>
        </div>
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
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к инвентаризациям
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
              className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
              style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
            >
              {warehouses.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setSelectedWorkshopId(w.id);
                    setPartialSelectedIds([]);
                  }}
                  className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                    selectedWorkshopId === w.id
                      ? 'bg-white text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={selectedWorkshopId === w.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </SetupField>

          <SetupField label="Тип">
            <div
              className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
              style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setInventoryType('full');
                  setPartialSelectedIds([]);
                }}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  inventoryType === 'full'
                    ? 'bg-white text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={inventoryType === 'full' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
              >
                Полная
              </button>
              <button
                type="button"
                onClick={() => setInventoryType('partial')}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  inventoryType === 'partial'
                    ? 'bg-white text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={inventoryType === 'partial' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
              >
                Частичная
              </button>
            </div>
          </SetupField>

          {inventoryType === 'partial' && selectedWorkshopId && (
            <SetupField label="Позиции">
              <div className="space-y-2 max-w-md">
                <p className="text-xs text-muted-foreground">
                  Удерживайте Cmd (Mac) или Ctrl (Windows) для нескольких позиций.
                </p>
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-secondary/30">
                  <img src={searchIcon} className="w-3.5 h-3.5 opacity-40 shrink-0" alt="" />
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
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Начать инвентаризацию
          </button>
          <button
            type="button"
            onClick={() => setStep('history')}
            className="px-6 py-2.5 border rounded-lg text-sm font-semibold hover:bg-secondary transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

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
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к инвентаризациям
          </button>
          <h2 className="text-2xl font-bold">Инвентаризация: {selectedSkladName}</h2>
          {movementPeriodHint && (
            <p className="text-xs text-muted-foreground mt-2 max-w-2xl">{movementPeriodHint}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saveLines.isPending || postSession.isPending}
            onClick={handlePostCounting}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md text-[#5D4FF1] hover:text-[#4538c4] hover:bg-[#5D4FF1]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: INVENTORY_COUNTING_GRID }}
      >
        <div className="col-span-9 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white border-b">
          <div className="pr-6">Наименование</div>
          <div className="pr-2 text-right">Нач. ост.</div>
          <div className="pr-2 text-right">Поступл.</div>
          <div className="pr-2 text-right">Расход</div>
          <div className="pr-2 text-right">Списано</div>
          <div className="pr-2 text-right">План. ост.</div>
          <div className="px-2 text-center">Факт. ост.</div>
          <div className="pr-2 text-right">Разница</div>
          <div className="pr-6 text-right">Разница, сом</div>
        </div>

        <div className="col-span-9 grid grid-cols-subgrid">
          {countingRowsLoading && (
            <div className="col-span-9 py-12 text-center text-sm text-muted-foreground">
              Загрузка позиций…
            </div>
          )}
          {!countingRowsLoading &&
            countingItems.map((item) => {
            const actualNum = parseFloat(item.actual) || 0;
            const diff = item.actual === '' ? 0 : actualNum - item.theoretical;
            const diffSom = diff * item.price;
            const roundedSom = somRounded(diffSom);

            return (
              <div
                key={item.id}
                className="col-span-9 grid grid-cols-subgrid group hover:bg-[#EFF0F4] transition-colors even:bg-muted/10 border-b border-muted/30"
              >
                <div className="grid grid-cols-subgrid col-span-9 items-center py-2 px-3">
                  <div className="pr-6 min-w-0">
                    <div className="text-sm font-semibold truncate">{item.name}</div>
                  </div>
                  <div className="pr-2 text-right tabular-nums text-sm text-muted-foreground">
                    {item.start} {item.unit}
                  </div>
                  <div className="pr-2 text-right tabular-nums text-sm text-blue-600 font-medium">
                    +{item.incoming} {item.unit}
                  </div>
                  <div className="pr-2 text-right tabular-nums text-sm text-amber-600 font-medium">
                    -{item.consumption} {item.unit}
                  </div>
                  <div className="pr-2 text-right tabular-nums text-sm text-red-600 font-medium">
                    -{item.writeoff} {item.unit}
                  </div>
                  <div className="pr-2 text-right tabular-nums text-sm font-medium bg-blue-50/50 py-1 rounded">
                    {item.theoretical} {item.unit}
                  </div>
                  <div className="px-2 relative min-w-0">
                    <input
                      type="number"
                      className="w-full pl-2 pr-8 py-0.5 border rounded text-sm bg-background text-right tabular-nums outline-none focus:border-primary"
                      placeholder="0.00"
                      value={item.actual}
                      onChange={(e) => handleActualChange(item.id, e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                      {item.unit}
                    </span>
                  </div>
                  <div
                    className={`pr-2 text-right tabular-nums text-sm font-medium ${
                      diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  >
                    {item.actual === ''
                      ? '—'
                      : (diff > 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)) + ` ${item.unit}`}
                  </div>
                  <div
                    className={`pr-6 text-right tabular-nums text-sm font-medium ${
                      diffSom < 0 ? 'text-red-600' : diffSom > 0 ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  >
                    {item.actual === ''
                      ? '—'
                      : (roundedSom > 0 ? `+${roundedSom.toLocaleString()}` : roundedSom.toLocaleString())}{' '}
                    сом
                  </div>
                </div>
              </div>
            );
          })}
          {!countingRowsLoading && countingItems.length === 0 && !countingError && (
            <div className="col-span-9 py-12 text-center text-sm text-muted-foreground">
              Нет позиций для сверки
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
