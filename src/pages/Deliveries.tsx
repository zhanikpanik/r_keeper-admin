import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageCheck, RotateCcw, Truck } from 'lucide-react';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import {
  useWarehouseDeliveries,
  useReceiveDelivery,
  useCancelDelivery,
  useRestoreDelivery,
  useSendDeliveryInTransit,
  type DeliveryRow,
  type DeliveryUiStatus,
} from '@/hooks/useWarehouse';

/** Same layout pattern as Menu: grid + subgrid; `auto` = actions width from content; last = 32px for ✕ */
const DELIVERY_GRID_TEMPLATE = '100px 140px 120px 7rem 100px 100px auto 32px';

const DELIVERY_ACTION_CLASS =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium text-[#5D4FF1] hover:text-[#4538c4] hover:bg-[#5D4FF1]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function getPositionPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'позиций';
  if (n1 === 1) return 'позиция';
  if (n1 > 1 && n1 < 5) return 'позиции';
  return 'позиций';
}

function getStatusColor(status: DeliveryUiStatus) {
  switch (status) {
    case 'Принято':
      return 'text-green-600 bg-green-50 border-green-100';
    case 'В пути':
      return 'text-blue-600 bg-blue-50 border-blue-100';
    case 'Черновик':
      return 'text-amber-600 bg-amber-50 border-amber-100';
    case 'Отменено':
      return 'text-red-600 bg-red-50 border-red-100';
    default:
      return 'text-muted-foreground bg-secondary';
  }
}

export function Deliveries() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: deliveries = [], isLoading, isError, error } = useWarehouseDeliveries();
  const receiveDelivery = useReceiveDelivery();
  const cancelDelivery = useCancelDelivery();
  const restoreDelivery = useRestoreDelivery();
  const sendTransit = useSendDeliveryInTransit();

  const q = search.toLowerCase().trim();
  const filteredDeliveries = deliveries.filter((d) => {
    if (!q) return true;
    if (d.supplier.toLowerCase().includes(q) || d.date.includes(search)) return true;
    return d.items.some((i) => i.name.toLowerCase().includes(q));
  });

  const totalMonthly = deliveries
    .filter((d) => d.status === 'Принято')
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Поставки</h2>
        <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
          Принято за месяц:{' '}
          <span className="text-foreground font-bold">{totalMonthly.toLocaleString()} сом</span>
        </div>
      </div>

      {isError && (
        <p className="text-sm text-destructive mb-4">
          {(error as Error)?.message}. Примените миграцию{' '}
          <code className="text-xs">supabase/migrations/20260430120000_admin_warehouse.sql</code>.
        </p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
          <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" alt="" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Поставщик или позиция…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link
          to="/warehouse/deliveries/new"
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + Добавить
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4">Загрузка…</p>}

      <table className="w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-sm font-semibold text-foreground">
            <th scope="col" className="text-left py-3 px-3 w-[100px]">Дата</th>
            <th scope="col" className="text-left py-3 px-3 w-[140px]">Поставщик</th>
            <th scope="col" className="text-left py-3 px-3 w-[120px]">Склад</th>
            <th scope="col" className="text-left py-3 px-3 w-[112px]">Позиции</th>
            <th scope="col" className="text-center py-3 px-3 w-[100px]">Статус</th>
            <th scope="col" className="text-right py-3 px-3 w-[100px]">Сумма</th>
            <th scope="col" className="py-3 px-3" />
            <th scope="col" className="w-[32px]" />
          </tr>
        </thead>
        <tbody>
          {filteredDeliveries.map((delivery: DeliveryRow) => {
            const isCancelled = delivery.status === 'Отменено';
            const editUrl = `/warehouse/deliveries/${delivery.id}/edit`;
            const n = delivery.items.length;
            const canExpand = n > 0;

            return (
              <>
              <tr
                key={delivery.id}
                className={`group cursor-pointer ${expandedId === delivery.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10 ${isCancelled ? 'opacity-50' : ''}`}
                onClick={() => navigate(editUrl)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(editUrl);
                  }
                }}
              >
                <td className={`py-2 px-3 text-sm text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                  {new Date(delivery.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </td>
                <td className={`py-2 px-3 text-sm font-semibold truncate ${isCancelled ? 'line-through' : ''}`}>
                  {delivery.supplier}
                </td>
                <td className={`py-2 px-3 text-sm truncate ${isCancelled ? 'line-through' : ''}`}>
                  {delivery.warehouse_name || '—'}
                </td>
                <td className="py-2 px-3 text-sm">
                  {canExpand ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === delivery.id ? null : delivery.id); }} className="text-sm font-medium text-primary hover:text-primary/70 transition-colors cursor-pointer">
                      {`${n} ${getPositionPlural(n)}`}
                    </button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(delivery.status)}`}>
                    {delivery.status.toUpperCase()}
                  </span>
                </td>
                <td className={`py-2 px-3 text-sm text-right tabular-nums font-medium text-foreground ${isCancelled ? 'line-through' : ''}`}>
                  {delivery.amount.toLocaleString()}
                </td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {delivery.status === 'Черновик' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); sendTransit.mutate(delivery.id); }} disabled={sendTransit.isPending} className={DELIVERY_ACTION_CLASS}>
                        <Truck className="w-4 h-4 shrink-0" aria-hidden />В путь
                      </button>
                    )}
                    {delivery.status === 'В пути' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); receiveDelivery.mutate(delivery.id); }} disabled={receiveDelivery.isPending} className={DELIVERY_ACTION_CLASS}>
                        <PackageCheck className="w-4 h-4 shrink-0" aria-hidden />Принять
                      </button>
                    )}
                    {isCancelled && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); restoreDelivery.mutate(delivery.id); }} disabled={restoreDelivery.isPending} className={DELIVERY_ACTION_CLASS}>
                        <RotateCcw className="w-4 h-4 shrink-0" aria-hidden />Восстановить
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isCancelled && (
                    <button type="button" className="p-1 text-red-500 opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); cancelDelivery.mutate(delivery.id); }} title="Отменить">
                      <img src={crossIcon} className="w-4 h-4" alt="" />
                    </button>
                  )}
                </td>
              </tr>
              {expandedId === delivery.id && canExpand && (
                <tr key={`${delivery.id}-detail`} className="bg-[#EFF0F4]">
                  <td colSpan={8} className="pb-2 pt-0 pl-10">
                    <div className="max-w-sm space-y-0.5">
                      {delivery.items.map((item) => (
                        <div key={item.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                          <span className="text-foreground font-medium">{item.name}</span>
                          {' — '}{item.quantity} {item.unit},{' '}
                          {item.price.toLocaleString('ru-RU')} сом, итого{' '}
                          {(item.quantity * item.price).toLocaleString('ru-RU')} сом
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              </>
            );
          })}
          {!isLoading && filteredDeliveries.length === 0 && (
            <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
              {search ? 'Ничего не найдено' : 'Нет поставок. Нажмите «+ Добавить»'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
