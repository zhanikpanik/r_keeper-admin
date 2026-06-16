import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useWarehouses, useWarehouseIngredients } from '@/hooks/useMenuData';
import {
  useDeleteWarehouse,
  useRenameWarehouse,
  useWarehouseDeliveries,
  useWarehouseWriteOffs,
  useWarehouseTransfers,
  useWarehouseInventorySessions,
} from '@/hooks/useWarehouse';
import { somRounded } from '@/lib/formatSom';

const ROW_ACTION =
  'opacity-60 group-hover:opacity-100 transition-opacity p-2.5 cursor-pointer hover:bg-accent';

function getPositionPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'позиций';
  if (n1 === 1) return 'позиция';
  if (n1 > 1 && n1 < 5) return 'позиции';
  return 'позиций';
}

const RECENT_COUNT = 5;

/** Unified row for the recent-operations table */
interface RecentOp {
  id: string;
  date: string;
  type: 'delivery' | 'write-off' | 'transfer' | 'inventory';
  typeLabel: string;
  typeClass: string;
  details: string;
  status: string;
  statusClass: string;
  amount: number | null;
}

const TYPE_STYLE: Record<RecentOp['type'], { label: string; cls: string }> = {
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

export function WarehouseWorkspace() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();

  const { data: warehouses = [] } = useWarehouses();
  const renameWarehouse = useRenameWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  const selected = warehouses.find((w) => w.id === warehouseId) || null;

  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: ingredients = [], isPending: ingPending } = useWarehouseIngredients(
    warehouseId ?? null,
    { enabled: Boolean(warehouseId) }
  );

  const { data: deliveries = [] } = useWarehouseDeliveries();
  const { data: writeOffs = [] } = useWarehouseWriteOffs();
  const { data: transfers = [] } = useWarehouseTransfers();
  const { data: inventories = [] } = useWarehouseInventorySessions();

  // --- Stock table ---
  const q = search.trim().toLowerCase();
  const filtered = q
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q))
    : ingredients;

  const totalValue = filtered.reduce((sum, i) => sum + i.stock_quantity * i.price, 0);

  // --- Recent operations ---
  const recentOps = useMemo<RecentOp[]>(() => {
    const ops: RecentOp[] = [];

    for (const d of deliveries) {
      if (d.warehouse_id !== warehouseId) continue;
      ops.push({
        id: d.id, date: d.date, type: 'delivery',
        typeLabel: TYPE_STYLE['delivery'].label, typeClass: TYPE_STYLE['delivery'].cls,
        details: `${d.supplier || '—'}, ${d.items.length} ${getPositionPlural(d.items.length)}`,
        status: d.status, statusClass: statusBadge(d.status),
        amount: d.amount,
      });
    }
    for (const w of writeOffs) {
      if (w.warehouse_id !== warehouseId) continue;
      ops.push({
        id: w.id, date: w.date, type: 'write-off',
        typeLabel: TYPE_STYLE['write-off'].label, typeClass: TYPE_STYLE['write-off'].cls,
        details: `${w.reason_summary || '—'}, ${w.items.length} ${getPositionPlural(w.items.length)}`,
        status: w.status, statusClass: statusBadge(w.status),
        amount: null,
      });
    }
    for (const t of transfers) {
      if (t.fromWarehouseId !== warehouseId && t.toWarehouseId !== warehouseId) continue;
      const dir = t.fromWarehouseId === warehouseId ? `→ ${t.toWarehouse}` : `← ${t.fromWarehouse}`;
      ops.push({
        id: t.id, date: t.date, type: 'transfer',
        typeLabel: TYPE_STYLE['transfer'].label, typeClass: TYPE_STYLE['transfer'].cls,
        details: `${dir}, ${t.items.length} ${getPositionPlural(t.items.length)}`,
        status: t.status, statusClass: statusBadge(t.status),
        amount: null,
      });
    }
    for (const inv of inventories) {
      if (inv.warehouse_id !== warehouseId) continue;
      ops.push({
        id: inv.id, date: inv.date, type: 'inventory',
        typeLabel: TYPE_STYLE['inventory'].label, typeClass: TYPE_STYLE['inventory'].cls,
        details: `Результат: ${inv.result > 0 ? '+' : ''}${somRounded(inv.result).toLocaleString()} сом`,
        status: inv.status, statusClass: statusBadge(inv.status),
        amount: inv.result,
      });
    }

    ops.sort((a, b) => b.date.localeCompare(a.date));
    return ops.slice(0, RECENT_COUNT);
  }, [deliveries, writeOffs, transfers, inventories, warehouseId]);

  async function handleRename() {
    const name = window.prompt('Новое название склада', selected?.name)?.trim();
    if (!name || !warehouseId || name === selected?.name) return;
    try {
      await renameWarehouse.mutateAsync({ id: warehouseId, name });
      toast.success('Склад переименован');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось переименовать');
    }
  }

  async function handleDelete() {
    if (!confirm('Удалить склад? Разрешено только если нет остатков и активных документов.')) return;
    if (!warehouseId) return;
    try {
      await deleteWarehouse.mutateAsync(warehouseId);
      toast.success('Склад удалён');
      navigate('/warehouse/operations');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось удалить');
    }
  }

  if (!selected && warehouses.length > 0) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Выберите склад в боковом меню.
      </div>
    );
  }

  if (!selected) return null;

  return (
    <div className="p-8 space-y-8">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/warehouse/operations')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            К складам
          </button>
          <h2 className="text-2xl font-bold">{selected.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Остатков на {somRounded(totalValue).toLocaleString()} сом
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-md hover:bg-accent transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); handleRename(); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                Переименовать
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); handleDelete(); }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-accent transition-colors"
              >
                Удалить склад
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ QUICK ACTIONS ═══ */}
      <div className="flex items-center gap-2">
        <Link
          to={`/warehouse/deliveries/new?warehouse=${warehouseId}`}
          className="inline-flex items-center gap-1.5 px-4 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Поставка
        </Link>
        <Link
          to={`/warehouse/write-offs/new?warehouse=${warehouseId}`}
          className="inline-flex items-center gap-1.5 px-4 h-9 bg-white border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
          Списание
        </Link>
        <Link
          to={`/warehouse/transfers/new?from=${warehouseId}`}
          className="inline-flex items-center gap-1.5 px-4 h-9 bg-white border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
          Перемещение
        </Link>
        <Link
          to={`/warehouse/inventory?warehouse=${warehouseId}`}
          className="inline-flex items-center gap-1.5 px-4 h-9 bg-white border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-accent transition-colors"
        >
          Инвентаризация
        </Link>
      </div>

      {/* ═══ STOCK TABLE ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-medium">Остатки</h3>
          <Link
            to={`/menu/ingredients/add?warehouse=${warehouseId}&back=warehouse`}
            className="inline-flex items-center gap-1.5 px-3 h-8 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </Link>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-56">
            <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
            <input
              className="bg-transparent text-sm outline-none flex-1"
              placeholder="Поиск по названию…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="max-w-xl">
          {/* ColHeader — no divider */}
          <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
            <span className="flex-1 min-w-0">Наименование</span>
            <span className="shrink-0 w-[52px] text-right">Ед.</span>
            <span className="shrink-0 w-[72px] text-right">Остаток</span>
            <span className="shrink-0 w-[100px] text-right">Стоимость</span>
          </div>

          {ingPending && (
            <p className="text-sm text-muted-foreground py-8">Загрузка…</p>
          )}

          {!ingPending && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8">
              {search ? 'Ничего не найдено' : 'На этом складе пока нет ингредиентов'}
            </p>
          )}

          {!ingPending && filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-1.5 text-sm group cursor-pointer hover:bg-accent transition-colors"
              onClick={() => navigate(`/menu/ingredients/${item.id}?warehouse=${warehouseId}&back=warehouse`)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/menu/ingredients/${item.id}?warehouse=${warehouseId}&back=warehouse`);
                }
              }}
            >
              <span className="flex-1 min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 w-[52px] text-right text-muted-foreground">{item.unit}</span>
              <span className="shrink-0 w-[72px] text-right tabular-nums">{item.stock_quantity}</span>
              <span className="shrink-0 w-[100px] text-right tabular-nums font-medium">
                {somRounded(item.price * item.stock_quantity).toLocaleString()} сом
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ RECENT OPERATIONS ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-medium">Последние операции</h3>
          <Link
            to={`/warehouse/operations?warehouse=${warehouseId}`}
            className="text-sm text-primary hover:underline"
          >
            Все операции →
          </Link>
        </div>

        <div className="max-w-2xl">
          {/* ColHeader — no divider */}
          <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
            <span className="shrink-0 w-[58px]">Дата</span>
            <span className="shrink-0 w-[100px]">Тип</span>
            <span className="flex-1 min-w-0">Детали</span>
            <span className="shrink-0 w-[90px] text-right">Статус</span>
            <span className="shrink-0 w-[90px] text-right">Сумма</span>
          </div>

          {recentOps.length === 0 && (
            <p className="text-sm text-muted-foreground py-8">Операций пока нет</p>
          )}

          {recentOps.map((op) => (
            <div
              key={`${op.type}-${op.id}`}
              className={`flex items-center gap-3 py-1.5 text-sm group cursor-pointer hover:bg-accent transition-colors ${
                op.status === 'Отменено' ? 'opacity-50' : ''
              }`}
              onClick={() => {
                // Navigate to edit/view based on type
                const base = op.type === 'delivery' ? '/warehouse/deliveries'
                  : op.type === 'write-off' ? '/warehouse/write-offs'
                  : op.type === 'transfer' ? '/warehouse/transfers'
                  : '/warehouse/inventory';
                navigate(`${base}/${op.id}/edit`);
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const base = op.type === 'delivery' ? '/warehouse/deliveries'
                    : op.type === 'write-off' ? '/warehouse/write-offs'
                    : op.type === 'transfer' ? '/warehouse/transfers'
                    : '/warehouse/inventory';
                  navigate(`${base}/${op.id}/edit`);
                }
              }}
            >
              <span className={`shrink-0 w-[58px] text-muted-foreground ${op.status === 'Отменено' ? 'line-through' : ''}`}>
                {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="shrink-0 w-[100px]">
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${op.typeClass}`}>
                  {op.typeLabel}
                </span>
              </span>
              <span className={`flex-1 min-w-0 truncate ${op.status === 'Отменено' ? 'line-through' : ''}`}>
                {op.details}
              </span>
              <span className="shrink-0 w-[90px] text-right">
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${op.statusClass}`}>
                  {op.status}
                </span>
              </span>
              <span className={`shrink-0 w-[90px] text-right tabular-nums font-medium ${op.status === 'Отменено' ? 'line-through' : ''}`}>
                {op.amount != null ? `${op.amount.toLocaleString()} сом` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
