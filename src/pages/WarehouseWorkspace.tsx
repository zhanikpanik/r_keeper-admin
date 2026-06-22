import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
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
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { AddButton } from '@/components/ui/ActionButtons';
import { EditButton } from '@/components/ui/EditButton';

function getPositionPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'позиций';
  if (n1 === 1) return 'позиция';
  if (n1 > 1 && n1 < 5) return 'позиции';
  return 'позиций';
}

const RECENT_COUNT = 5;

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

function statusText(status: string) {
  if (status === 'Отменено') return 'text-red-600';
  if (status === 'Черновик') return 'text-amber-600';
  return 'text-muted-foreground';
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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q))
    : ingredients;

  const totalValue = useMemo(() => {
    return filtered.reduce((sum, i) => sum + i.stock_quantity * i.price, 0);
  }, [filtered]);

  const recentOps: RecentOp[] = useMemo(() => {
    const ops: RecentOp[] = [];

    deliveries.filter((d) => d.warehouse_id === warehouseId).forEach((d) => {
      ops.push({
        id: d.id,
        date: d.date,
        type: 'delivery',
        typeLabel: TYPE_STYLE.delivery.label,
        typeClass: TYPE_STYLE.delivery.cls,
        details: `${d.supplier} · ${d.items.length} ${getPositionPlural(d.items.length)}`,
        status: d.status,
        statusClass: statusText(d.status),
        amount: d.amount,
      });
    });

    writeOffs.filter((w) => w.warehouse_id === warehouseId).forEach((w) => {
      ops.push({
        id: w.id,
        date: w.date,
        type: 'write-off',
        typeLabel: TYPE_STYLE['write-off'].label,
        typeClass: TYPE_STYLE['write-off'].cls,
        details: `${w.reason_summary} · ${w.items.length} ${getPositionPlural(w.items.length)}`,
        status: w.status,
        statusClass: statusText(w.status),
        amount: null,
      });
    });

    transfers.filter((t) => t.from_warehouse_id === warehouseId || t.to_warehouse_id === warehouseId).forEach((t) => {
      const dir = t.from_warehouse_id === warehouseId ? '→' : '←';
      ops.push({
        id: t.id,
        date: t.date,
        type: 'transfer',
        typeLabel: TYPE_STYLE.transfer.label,
        typeClass: TYPE_STYLE.transfer.cls,
        details: `${t.from_warehouse_name ?? '—'} ${dir} ${t.to_warehouse_name ?? '—'} · ${t.items.length} ${getPositionPlural(t.items.length)}`,
        status: t.status,
        statusClass: statusText(t.status),
        amount: null,
      });
    });

    inventories.filter((inv) => inv.warehouse_id === warehouseId).forEach((inv) => {
      ops.push({
        id: inv.id,
        date: inv.date || '',
        type: 'inventory',
        typeLabel: TYPE_STYLE.inventory.label,
        typeClass: TYPE_STYLE.inventory.cls,
        details: inv.warehouse_name ?? '—',
        status: inv.status ?? '—',
        statusClass: statusText(inv.status ?? ''),
        amount: null,
      });
    });

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
    <div className="p-8">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{selected.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Остатки на {somRounded(totalValue).toLocaleString()} сом
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
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

      {/* ═══ RECENT OPERATIONS (above stock, so they're visible) ═══ */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-base font-medium">Последние операции</h3>
          <Link
            to="/warehouse/operations"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            Все операции →
          </Link>
        </div>

        {recentOps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Операций пока нет</p>
        ) : (
          <div className="max-w-2xl">
            <table className="table-fixed border-separate border-spacing-0 w-full">
              <thead>
                <tr className="text-sm font-medium text-foreground">
                  <th scope="col" className="text-left py-1.5 px-3 w-[60px]">Дата</th>
                  <th scope="col" className="text-left py-1.5 px-3 w-[120px]">Тип</th>
                  <th scope="col" className="text-left py-1.5 px-3">Детали</th>
                  <th scope="col" className="text-right py-1.5 px-3 w-[90px]">Статус</th>
                  <th scope="col" className="text-right py-1.5 px-3 w-[90px]">Сумма</th>
                  <th scope="col" className="py-1.5 w-[56px]" />
                </tr>
              </thead>
              <tbody>
                {recentOps.map((op) => (
                  <tr
                    key={`${op.type}-${op.id}`}
                    className={`group cursor-pointer hover:bg-black/[0.03] transition-colors ${op.status === 'Отменено' ? 'opacity-50' : ''}`}
                    onClick={() => {
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
                    <td className={`py-1.5 px-3 text-sm text-muted-foreground ${op.status === 'Отменено' ? 'line-through' : ''}`}>
                      {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-1.5 px-3 text-sm">
                      <Badge className={op.typeClass}>
                        {op.typeLabel}
                      </Badge>
                    </td>
                    <td className={`py-1.5 px-3 text-sm truncate ${op.status === 'Отменено' ? 'line-through' : ''}`}>
                      {op.details}
                    </td>
                    <td className={`py-1.5 px-3 text-sm text-right font-medium ${op.statusClass}`}>
                      {op.status}
                    </td>
                    <td className={`py-1.5 px-3 text-sm text-right tabular-nums font-medium ${op.status === 'Отменено' ? 'line-through' : ''}`}>
                      {op.amount != null ? `${op.amount.toLocaleString()} сом` : '—'}
                    </td>
                    <td className="py-1.5 px-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <EditButton onClick={() => {
                        const base = op.type === 'delivery' ? '/warehouse/deliveries'
                          : op.type === 'write-off' ? '/warehouse/write-offs'
                          : op.type === 'transfer' ? '/warehouse/transfers'
                          : '/warehouse/inventory';
                        navigate(`${base}/${op.id}/edit`);
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ STOCK TABLE ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium">Остатки</h3>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию…" className="w-56" />
          <AddButton
            onClick={() => navigate(`/menu/ingredients/add?warehouse=${warehouseId}&back=warehouse`)}
            label="Добавить ингредиент"
          />
        </div>

        <div className="max-w-2xl">
          <table className="table-fixed border-separate border-spacing-0 w-full">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="text-sm font-medium text-foreground">
                <th scope="col" className="text-left py-1.5 px-3">Наименование</th>
                <th scope="col" className="text-right py-1.5 px-3 w-[100px]">Остаток</th>
                <th scope="col" className="text-right py-1.5 px-3 w-[120px]">Стоимость</th>
                <th scope="col" className="py-1.5 w-[56px]" />
              </tr>
            </thead>
            <tbody>
              {ingPending && (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">Загрузка…</td></tr>
              )}

              {!ingPending && filtered.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  {search ? 'Ничего не найдено' : 'На этом складе пока нет ингредиентов'}
                </td></tr>
              )}

              {!ingPending && filtered.map((item) => (
                <tr
                  key={item.id}
                  className="group cursor-pointer hover:bg-black/[0.03] transition-colors"
                  onClick={() => navigate(`/menu/ingredients/${item.id}?warehouse=${warehouseId}&back=warehouse`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/menu/ingredients/${item.id}?warehouse=${warehouseId}&back=warehouse`);
                    }
                  }}
                >
                  <td className="py-1.5 px-3 text-sm truncate">{item.name}</td>
                  <td className="py-1.5 px-3 text-sm text-right tabular-nums">
                    <span className={item.stock_quantity < 0 ? 'text-red-600' : ''}>
                      {item.stock_quantity} {item.unit}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-sm text-right tabular-nums font-medium">
                    {somRounded(item.price * item.stock_quantity).toLocaleString()} сом
                  </td>
                  <td className="py-1.5 px-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <EditButton onClick={() => navigate(`/menu/ingredients/${item.id}?warehouse=${warehouseId}&back=warehouse`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
