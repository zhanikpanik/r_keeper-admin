import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, RotateCcw, Search, X } from 'lucide-react';
import {
  useWarehouseDeliveries,
  useReceiveDelivery,
  useCancelDelivery,
  useRestoreDelivery,
  useSendDeliveryInTransit,
  useWarehouseWriteOffs,
  usePostWriteOff,
  useCancelWriteOff,
  useRestoreWriteOff,
  useWarehouseTransfers,
  usePostTransfer,
  useCancelTransfer,
  useRestoreTransfer,
  useWarehouseInventorySessions,
  type DeliveryRow,
  type WriteOffRow,
  type TransferRow,
  type InventoryActRow,
} from '@/hooks/useWarehouse';
import { useWarehouses } from '@/hooks/useMenuData';
import { somRounded } from '@/lib/formatSom';

// ─── Helpers ───

function getPositionPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'позиций';
  if (n1 === 1) return 'позиция';
  if (n1 > 1 && n1 < 5) return 'позиции';
  return 'позиций';
}

const ROW_ACTION =
  'opacity-60 group-hover:opacity-100 transition-opacity p-2.5 cursor-pointer hover:bg-accent';

const ACTION_PRIMARY =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/80';

// ─── Period filter ───

type Period = 'today' | 'week' | 'month' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё' },
];

function isInPeriod(dateStr: string, period: Period): boolean {
  if (period === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return d >= today;
  if (period === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }
  if (period === 'month') {
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return d >= monthAgo;
  }
  return true;
}

// ─── Unified operation type ───

type OpType = 'delivery' | 'write-off' | 'transfer' | 'inventory';

interface UnifiedOp {
  id: string;
  date: string;
  warehouseId: string | null;
  warehouseName: string;
  type: OpType;
  typeLabel: string;
  typeClass: string;
  details: string;
  status: string;
  statusClass: string;
  amount: number | null;
  items: { name: string; quantity: number; unit: string; price?: number; reason?: string; total?: number }[];
  // For actions — these are specific to each type
  editUrl: string;
}

const TYPE_STYLE: Record<OpType, { label: string; cls: string }> = {
  'delivery':  { label: 'Поставка',      cls: 'text-blue-700 bg-blue-50' },
  'write-off': { label: 'Списание',      cls: 'text-red-700 bg-red-50' },
  'transfer':  { label: 'Перемещение',   cls: 'text-amber-700 bg-amber-50' },
  'inventory': { label: 'Инвентаризация',cls: 'text-emerald-700 bg-emerald-50' },
};

function statusBadge(status: string) {
  if (status === 'Принято' || status === 'Проведено') return 'text-green-600 bg-green-50';
  if (status === 'В пути') return 'text-blue-600 bg-blue-50';
  if (status === 'Черновик') return 'text-amber-600 bg-amber-50';
  if (status === 'Отменено') return 'text-red-600 bg-red-50';
  return 'text-muted-foreground bg-secondary';
}

// ─── Merging ───

function mergeOps(
  deliveries: DeliveryRow[],
  writeOffs: WriteOffRow[],
  transfers: TransferRow[],
  inventories: InventoryActRow[],
): UnifiedOp[] {
  const ops: UnifiedOp[] = [];

  for (const d of deliveries) {
    ops.push({
      id: d.id, date: d.date, warehouseId: d.warehouse_id,
      warehouseName: d.warehouse_name || '—',
      type: 'delivery', typeLabel: TYPE_STYLE['delivery'].label,
      typeClass: TYPE_STYLE['delivery'].cls,
      details: `${d.supplier || '—'}, ${d.items.length} ${getPositionPlural(d.items.length)}`,
      status: d.status, statusClass: statusBadge(d.status),
      amount: d.amount,
      items: d.items.map(i => ({
        name: i.name, quantity: i.quantity, unit: i.unit,
        price: i.price, total: i.quantity * i.price,
      })),
      editUrl: `/warehouse/deliveries/${d.id}/edit`,
    });
  }

  for (const w of writeOffs) {
    ops.push({
      id: w.id, date: w.date, warehouseId: w.warehouse_id,
      warehouseName: '—', // write-offs don't have warehouse_name in the row
      type: 'write-off', typeLabel: TYPE_STYLE['write-off'].label,
      typeClass: TYPE_STYLE['write-off'].cls,
      details: `${w.reason_summary || '—'}, ${w.items.length} ${getPositionPlural(w.items.length)}`,
      status: w.status, statusClass: statusBadge(w.status),
      amount: null,
      items: w.items.map(i => ({
        name: i.name, quantity: i.quantity, unit: i.unit, reason: i.reason,
      })),
      editUrl: `/warehouse/write-offs/${w.id}/edit`,
    });
  }

  for (const t of transfers) {
    const dir = `${t.fromWarehouse || '—'} → ${t.toWarehouse || '—'}`;
    ops.push({
      id: t.id, date: t.date, warehouseId: t.fromWarehouseId,
      warehouseName: `${t.fromWarehouse || '—'} → ${t.toWarehouse || '—'}`,
      type: 'transfer', typeLabel: TYPE_STYLE['transfer'].label,
      typeClass: TYPE_STYLE['transfer'].cls,
      details: `${dir}, ${t.items.length} ${getPositionPlural(t.items.length)}`,
      status: t.status, statusClass: statusBadge(t.status),
      amount: null,
      items: t.items.map(i => ({
        name: i.name, quantity: i.quantity, unit: i.unit,
      })),
      editUrl: `/warehouse/transfers/${t.id}/edit`,
    });
  }

  for (const inv of inventories) {
    ops.push({
      id: inv.id, date: inv.date, warehouseId: inv.warehouse_id,
      warehouseName: inv.warehouse || inv.workshop || '—',
      type: 'inventory', typeLabel: TYPE_STYLE['inventory'].label,
      typeClass: TYPE_STYLE['inventory'].cls,
      details: `Результат: ${inv.result > 0 ? '+' : ''}${somRounded(inv.result).toLocaleString()} сом`,
      status: inv.status, statusClass: statusBadge(inv.status),
      amount: inv.result,
      items: [],
      editUrl: `/warehouse/inventory`,
    });
  }

  ops.sort((a, b) => b.date.localeCompare(a.date));
  return ops;
}

// ─── Component ───

export function AllOperations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [period, setPeriod] = useState<Period>(
    () => (searchParams.get('period') as Period) || 'month'
  );
  const [typeFilter, setTypeFilter] = useState<OpType | 'all'>(
    () => (searchParams.get('type') as OpType | 'all') || 'all'
  );
  const [whFilter, setWhFilter] = useState<string>(
    () => searchParams.get('warehouse') || 'all'
  );
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: warehouses = [] } = useWarehouses();
  const { data: deliveries = [] } = useWarehouseDeliveries();
  const { data: writeOffs = [] } = useWarehouseWriteOffs();
  const { data: transfers = [] } = useWarehouseTransfers();
  const { data: inventories = [] } = useWarehouseInventorySessions();

  const receiveDelivery = useReceiveDelivery();
  const cancelDelivery = useCancelDelivery();
  const restoreDelivery = useRestoreDelivery();
  const sendTransit = useSendDeliveryInTransit();
  const postWo = usePostWriteOff();
  const cancelWo = useCancelWriteOff();
  const restoreWo = useRestoreWriteOff();
  const postTransfer = usePostTransfer();
  const cancelTransfer = useCancelTransfer();
  const restoreTransfer = useRestoreTransfer();

  const allOps = useMemo(
    () => mergeOps(deliveries, writeOffs, transfers, inventories),
    [deliveries, writeOffs, transfers, inventories]
  );

  // Filter
  const q = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    return allOps.filter((op) => {
      if (!isInPeriod(op.date, period)) return false;
      if (typeFilter !== 'all' && op.type !== typeFilter) return false;
      if (whFilter !== 'all' && op.warehouseId !== whFilter) return false;
      if (q) {
        const details = op.details.toLowerCase();
        const wh = op.warehouseName.toLowerCase();
        if (!details.includes(q) && !wh.includes(q)) {
          return op.items.some(i => i.name.toLowerCase().includes(q));
        }
      }
      return true;
    });
  }, [allOps, period, typeFilter, whFilter, q]);

  // Sync URL
  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === 'all' || value === 'month') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  const isCancelledStatus = (op: UnifiedOp) => op.status === 'Отменено';

  return (
    <div className="p-8 space-y-8">

      {/* ═══ HEADER ═══ */}
      <h2 className="text-2xl font-bold">Все операции</h2>

      {/* ═══ PERIOD ═══ */}
      <div className="flex items-center gap-1.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setPeriod(opt.value); updateParam('period', opt.value); }}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
              period === opt.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-border/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ═══ FILTERS ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Type filter */}
        <div className="flex items-center gap-0.5">
          {([
            { value: 'all' as const, label: 'Все' },
            { value: 'delivery' as const, label: 'Поставки' },
            { value: 'write-off' as const, label: 'Списания' },
            { value: 'transfer' as const, label: 'Перемещения' },
            { value: 'inventory' as const, label: 'Инвентаризации' },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setTypeFilter(opt.value); updateParam('type', opt.value); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                typeFilter === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border/40" />

        {/* Warehouse filter */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => { setWhFilter('all'); updateParam('warehouse', 'all'); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              whFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Все
          </button>
          {warehouses.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { setWhFilter(w.id); updateParam('warehouse', w.id); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                whFilter === w.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search — separate row */}
      <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64">
        <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
        <input
          className="bg-transparent text-sm outline-none flex-1"
          placeholder="Поиск по складу, поставщику, позиции…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="max-w-4xl">
        {/* ColHeader — no divider */}
        <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
          <span className="shrink-0 w-[62px]">Дата</span>
          <span className="shrink-0 w-[72px]">Склад</span>
          <span className="shrink-0 w-[110px]">Тип</span>
          <span className="flex-1 min-w-0">Детали</span>
          <span className="shrink-0 w-[90px] text-right">Статус</span>
          <span className="shrink-0 w-[90px] text-right">Сумма</span>
          <span className="shrink-0 w-[36px]" />
          <span className="shrink-0 w-[36px]" />
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8">Ничего не найдено</p>
        )}

        {filtered.map((op) => {
          const isCancelled = isCancelledStatus(op);
          const canExpand = op.items.length > 0;
          const isExpanded = expandedId === `${op.type}-${op.id}`;

          return (
            <div key={`${op.type}-${op.id}`}>
              <div
                className={`flex items-center gap-3 py-1.5 text-sm group cursor-pointer hover:bg-accent transition-colors ${
                  isCancelled ? 'opacity-50' : ''
                } ${isExpanded ? 'bg-[#EFF0F4]' : ''}`}
                onClick={canExpand ? () => setExpandedId(isExpanded ? null : `${op.type}-${op.id}`) : () => navigate(op.editUrl)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (canExpand) setExpandedId(isExpanded ? null : `${op.type}-${op.id}`);
                    else navigate(op.editUrl);
                  }
                }}
              >
                {/* Date */}
                <span className={`shrink-0 w-[62px] text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                  {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </span>

                {/* Warehouse */}
                <span className={`shrink-0 w-[72px] text-muted-foreground truncate ${isCancelled ? 'line-through' : ''}`}>
                  {op.warehouseName}
                </span>

                {/* Type badge */}
                <span className="shrink-0 w-[110px]">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${op.typeClass}`}>
                    {op.typeLabel}
                  </span>
                </span>

                {/* Details */}
                <span className={`flex-1 min-w-0 truncate ${isCancelled ? 'line-through' : ''}`}>
                  {op.details}
                </span>

                {/* Status */}
                <span className="shrink-0 w-[90px] text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${op.statusClass}`}>
                    {op.status}
                  </span>
                </span>

                {/* Amount */}
                <span className={`shrink-0 w-[90px] text-right tabular-nums font-medium ${isCancelled ? 'line-through' : ''}`}>
                  {op.amount != null
                    ? (op.amount > 0 ? `+${op.amount.toLocaleString()}` : op.amount.toLocaleString()) + ' сом'
                    : '—'}
                </span>

                {/* Edit */}
                <span className={`shrink-0 w-[36px] ${ROW_ACTION}`}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(op.editUrl); }}
                    className="group p-2.5 hover:bg-accent cursor-pointer"
                    title="Редактировать"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  </button>
                </span>

                {/* Cancel / Restore */}
                <span className={`shrink-0 w-[36px] ${ROW_ACTION}`}>
                  {isCancelled ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (op.type === 'delivery') restoreDelivery.mutate(op.id);
                        else if (op.type === 'write-off') restoreWo.mutate(op.id);
                        else if (op.type === 'transfer') restoreTransfer.mutate(op.id);
                      }}
                      className="group p-2.5 hover:bg-accent cursor-pointer"
                      title="Восстановить"
                    >
                      <RotateCcw className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (op.type === 'delivery') cancelDelivery.mutate(op.id);
                        else if (op.type === 'write-off') cancelWo.mutate(op.id);
                        else if (op.type === 'transfer') cancelTransfer.mutate(op.id);
                      }}
                      className="group p-2.5 hover:bg-accent cursor-pointer"
                      title="Отменить"
                    >
                      <X className="w-4 h-4 text-muted-foreground group-hover:text-red-600" />
                    </button>
                  )}
                </span>
              </div>

              {/* Expanded items */}
              {isExpanded && canExpand && (
                <div className="bg-[#EFF0F4] pb-2 pt-0 pl-[62px]">
                  <div className="space-y-0.5">
                    {op.items.map((item, idx) => (
                      <div key={idx} className="text-sm py-0.5 pl-3 text-muted-foreground">
                        <span className="text-foreground font-medium">{item.name}</span>
                        {' — '}{item.quantity} {item.unit}
                        {item.price != null && (
                          <>, {item.price.toLocaleString('ru-RU')} сом, итого{' '}
                            {(item.total ?? item.quantity * item.price).toLocaleString('ru-RU')} сом</>
                        )}
                        {item.reason && (
                          <> <span className="italic">({item.reason})</span></>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
