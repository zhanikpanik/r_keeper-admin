import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, X, PackageCheck, Check } from 'lucide-react';
import { EditButton } from '@/components/ui/EditButton';
import { useQuery } from '@tanstack/react-query';
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
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { Badge } from '@/components/ui/Badge';

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
  'opacity-40 group-hover:opacity-100 transition-opacity';

const ACTION_PRIMARY =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/80';

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

/** Poster stores cost_price in kopecks — divide by 100 for som. Falls back to price. */
function resolveProductCost(costMap: Map<string, number>, productId: string | null): number {
  if (!productId) return 0;
  return costMap.get(productId) ?? 0;
}

function mergeOps(
  deliveries: DeliveryRow[],
  writeOffs: WriteOffRow[],
  transfers: TransferRow[],
  inventories: InventoryActRow[],
  costMap: Map<string, number>,
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
    const woAmount = w.items.reduce(
      (sum, i) => sum + i.quantity * resolveProductCost(costMap, i.product_id),
      0,
    );
    ops.push({
      id: w.id, date: w.date, warehouseId: w.warehouse_id,
      warehouseName: w.warehouse_name || '—',
      type: 'write-off', typeLabel: TYPE_STYLE['write-off'].label,
      typeClass: TYPE_STYLE['write-off'].cls,
      details: `${w.reason_summary || '—'}, ${w.items.length} ${getPositionPlural(w.items.length)}`,
      status: w.status, statusClass: statusBadge(w.status),
      amount: woAmount > 0 ? -woAmount : null,
      items: w.items.map(i => ({
        name: i.name, quantity: i.quantity, unit: i.unit, reason: i.reason,
      })),
      editUrl: `/warehouse/write-offs/${w.id}/edit`,
    });
  }

  for (const t of transfers) {
    ops.push({
      id: t.id, date: t.date, warehouseId: t.fromWarehouseId,
      warehouseName: `${t.fromWarehouse || '—'} → ${t.toWarehouse || '—'}`,
      type: 'transfer', typeLabel: TYPE_STYLE['transfer'].label,
      typeClass: TYPE_STYLE['transfer'].cls,
      details: `${t.fromWarehouse || '—'} → ${t.toWarehouse || '—'}, ${t.items.length} ${getPositionPlural(t.items.length)}`,
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

// ─── Column widths — single source of truth ───

const COL = {
  date: 'w-[62px]',
  warehouse: 'w-[72px]',
  type: 'w-[110px]',
  status: 'w-[90px]',
  amount: 'w-[90px]',
  action: 'w-[36px]',
} as const;

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

  // Product cost map for write-off amount calculation
  // Poster stores cost_price in kopecks — divide by 100 for som, fall back to price
  const { data: costMap = new Map<string, number>() } = useQuery({
    queryKey: ['product_costs', VENUE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, price, cost_price')
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const p of data || []) {
        const cost = (p as any).cost_price != null
          ? Number((p as any).cost_price) / 100
          : Number((p as any).price) || 0;
        map.set((p as any).id, cost);
      }
      return map;
    },
    staleTime: 5 * 60_000,
  });

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
    () => mergeOps(deliveries, writeOffs, transfers, inventories, costMap),
    [deliveries, writeOffs, transfers, inventories, costMap]
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

  // Summary
  const summary = useMemo(() => {
    const active = filtered.filter(op => !isCancelledStatus(op));
    const deliveries = active.filter(op => op.type === 'delivery');
    const writeOffs = active.filter(op => op.type === 'write-off');
    const inventories = active.filter(op => op.type === 'inventory');

    const delTotal = deliveries.reduce((s, op) => s + (op.amount ?? 0), 0);
    const woTotal = writeOffs.reduce((s, op) => s + (op.amount ?? 0), 0);
    const invTotal = inventories.reduce((s, op) => s + (op.amount ?? 0), 0);

    return { deliveries: deliveries.length, delTotal, writeOffs: writeOffs.length, woTotal, inventories: inventories.length, invTotal };
  }, [filtered]);

  return (
    <div className="p-8 space-y-8">

      {/* ═══ HEADER ═══ */}
      <h2 className="text-2xl font-bold">Все операции</h2>

      {/* ═══ PERIOD ═══ */}
      <SegmentTabs
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(v) => { setPeriod(v); updateParam('period', v); }}
      />

      {/* ═══ FILTERS ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Type filter */}
        <SegmentTabs
          options={[
            { value: 'all' as const, label: 'Все' },
            { value: 'delivery' as const, label: 'Поставки' },
            { value: 'write-off' as const, label: 'Списания' },
            { value: 'transfer' as const, label: 'Перемещения' },
            { value: 'inventory' as const, label: 'Инвентаризации' },
          ]}
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); updateParam('type', v); }}
        />

        <div className="w-px h-6 bg-border/40" />

        {/* Warehouse filter */}
        <SegmentTabs
          options={[
            { value: 'all', label: 'Все' },
            ...warehouses.map((w) => ({ value: w.id, label: w.name })),
          ]}
          value={whFilter}
          onChange={(v) => { setWhFilter(v); updateParam('warehouse', v); }}
        />

        <div className="w-px h-6 bg-border/40" />

        {/* Search — inline with filters */}
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-56">
          <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="max-w-4xl">
        {/* ColHeader — subtle divider */}
        <div className="flex items-center gap-3 py-1.5 text-sm text-muted-foreground ">
          <span className={`shrink-0 ${COL.date}`}>Дата</span>
          <span className={`shrink-0 ${COL.warehouse}`}>Склад</span>
          <span className={`shrink-0 ${COL.type}`}>Тип</span>
          <span className="flex-1 min-w-0">Детали</span>
          <span className={`shrink-0 ${COL.status} text-right`}>Статус</span>
          <span className={`shrink-0 ${COL.amount} text-right`}>Сумма</span>
          <span className={`shrink-0 ${COL.action}`} />
          <span className={`shrink-0 ${COL.action}`} />
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8">
            {q || typeFilter !== 'all' || whFilter !== 'all'
              ? 'Ничего не найдено — попробуйте изменить фильтры'
              : 'Операций за период нет — создайте поставку или списание'}
          </p>
        )}

        {filtered.map((op) => {
          const isCancelled = isCancelledStatus(op);
          const canExpand = op.items.length > 0;
          const isExpanded = expandedId === `${op.type}-${op.id}`;

          return (
            <div key={`${op.type}-${op.id}`}>
              <div
                className={`flex items-center gap-3 py-1.5 text-sm group ${
                  canExpand ? 'cursor-pointer hover:bg-accent' : (op.type === 'inventory' ? 'cursor-pointer hover:bg-accent' : '')
                } transition-colors ${
                  isCancelled ? 'opacity-50' : ''
                } ${isExpanded ? 'bg-black/[0.03]' : ''}`}
                onClick={
                  canExpand
                    ? () => setExpandedId(isExpanded ? null : `${op.type}-${op.id}`)
                    : op.type === 'inventory'
                      ? () => navigate(op.editUrl)
                      : undefined
                }
                tabIndex={canExpand || op.type === 'inventory' ? 0 : -1}
                onKeyDown={canExpand
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : `${op.type}-${op.id}`);
                      }
                    }
                  : op.type === 'inventory'
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(op.editUrl);
                        }
                      }
                    : undefined
                }
              >
                {/* Date */}
                <span className={`shrink-0 ${COL.date} text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                  {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </span>

                {/* Warehouse */}
                <span className={`shrink-0 ${COL.warehouse} text-muted-foreground truncate ${isCancelled ? 'line-through' : ''}`}>
                  {op.warehouseName}
                </span>

                {/* Type badge */}
                <span className={`shrink-0 ${COL.type}`}>
                  <Badge className={op.typeClass}>
                    {op.typeLabel}
                  </Badge>
                </span>

                {/* Details */}
                <span className={`flex-1 min-w-0 truncate ${isCancelled ? 'line-through' : ''}`}>
                  {op.details}
                </span>

                {/* Status */}
                <span className={`shrink-0 ${COL.status} text-right`}>
                  <span className={`text-sm font-medium ${
                    op.status === 'Принято' || op.status === 'Проведено' ? 'text-green-600' :
                    op.status === 'В пути' ? 'text-blue-600' :
                    op.status === 'Черновик' ? 'text-amber-600' :
                    op.status === 'Отменено' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {op.status}
                  </span>
                </span>

                {/* Amount */}
                <span className={`shrink-0 ${COL.amount} text-right tabular-nums font-medium ${isCancelled ? 'line-through' : ''}`}>
                  {op.amount != null
                    ? (op.amount > 0 ? `+${op.amount.toLocaleString()}` : op.amount.toLocaleString()) + ' сом'
                    : '—'}
                </span>

                {/* Primary action — context-dependent */}
                <span className={`shrink-0 ${COL.action} ${ROW_ACTION}`}>
                  {op.type === 'delivery' && op.status === 'В пути' ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); receiveDelivery.mutate(op.id); }}
                      className="p-2 cursor-pointer bg-transparent"
                      title="Принять поставку"
                    >
                      <PackageCheck className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600" />
                    </button>
                  ) : (op.type === 'write-off' || op.type === 'transfer') && op.status === 'Черновик' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (op.type === 'write-off') postWo.mutate(op.id);
                        else postTransfer.mutate(op.id);
                      }}
                      className="p-2 cursor-pointer bg-transparent"
                      title="Провести"
                    >
                      <Check className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600" />
                    </button>
                  ) : !isCancelled ? (
                    <EditButton onClick={() => navigate(op.editUrl)} />
                  ) : (
                    <span />
                  )}
                </span>

                {/* Cancel / Restore */}
                <span className={`shrink-0 ${COL.action} ${ROW_ACTION}`}>
                  {isCancelled ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (op.type === 'delivery') restoreDelivery.mutate(op.id);
                        else if (op.type === 'write-off') restoreWo.mutate(op.id);
                        else if (op.type === 'transfer') restoreTransfer.mutate(op.id);
                      }}
                      className="p-2 cursor-pointer bg-transparent"
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
                      className="p-2 cursor-pointer bg-transparent"
                      title="Отменить"
                    >
                      <X className="w-4 h-4 text-muted-foreground group-hover:text-red-600" />
                    </button>
                  )}
                </span>
              </div>

              {/* Expanded items */}
              {isExpanded && canExpand && (
                <div className="bg-black/[0.03] py-2 pl-8 pr-3">
                  <table className="w-full max-w-lg text-sm">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-medium py-0.5 pr-2">Ингредиент</th>
                        <th className="text-right font-medium py-0.5 px-2 w-16">Кол-во</th>
                        <th className="text-right font-medium py-0.5 px-2 w-16">Цена</th>
                        <th className="text-right font-medium py-0.5 pl-2 w-20">Итого</th>
                      </tr>
                    </thead>
                    <tbody className="before:content-[''] before:block before:h-1">
                      {op.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-0.5 pr-2">{item.name}{item.reason && <span className="text-muted-foreground"> ({item.reason})</span>}</td>
                          <td className="py-0.5 px-2 text-right tabular-nums">{item.quantity} {item.unit}</td>
                          <td className="py-0.5 px-2 text-right tabular-nums">{item.price != null ? `${item.price.toLocaleString('ru-RU')} сом` : '—'}</td>
                          <td className="py-0.5 pl-2 text-right tabular-nums">{item.total != null ? `${(item.total ?? item.quantity * (item.price ?? 0)).toLocaleString('ru-RU')} сом` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* ─── Summary ─── */}
        {(summary.deliveries > 0 || summary.writeOffs > 0 || summary.inventories > 0) && (
          <div className="flex items-center gap-3 py-2 text-sm border-t border-border/40 mt-1 text-muted-foreground">
            <span className={`shrink-0 ${COL.date}`} />
            <span className={`shrink-0 ${COL.warehouse}`} />
            <span className={`shrink-0 ${COL.type}`} />
            <span className="flex-1 min-w-0">Итого за период</span>
            <span className={`shrink-0 ${COL.status} text-right`} />
            <span className={`shrink-0 ${COL.amount} text-right tabular-nums font-medium text-foreground`}>
              {(() => {
                const parts: string[] = [];
                if (summary.deliveries > 0) parts.push(`+${Math.round(summary.delTotal).toLocaleString()}`);
                if (summary.writeOffs > 0) parts.push(`${Math.round(summary.woTotal).toLocaleString()}`);
                if (summary.inventories > 0) parts.push((summary.invTotal >= 0 ? '+' : '') + Math.round(summary.invTotal).toLocaleString());
                return parts.length > 0 ? parts.join(' ') + ' сом' : '—';
              })()}
            </span>
            <span className={`shrink-0 ${COL.action}`} />
            <span className={`shrink-0 ${COL.action}`} />
          </div>
        )}
      </div>

    </div>
  );
}
