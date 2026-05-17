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

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: DELIVERY_GRID_TEMPLATE }}
      >
        <div className="col-span-8 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="pr-6">Дата</div>
          <div className="pr-6">Поставщик</div>
          <div className="pr-6">Склад</div>
          <div className="pr-6 text-left">Позиции</div>
          <div className="pr-6 text-center">Статус</div>
          <div className="pr-6 text-right">Сумма</div>
          <div className="min-w-0 px-4" aria-hidden />
          <div />
        </div>

        <div className="col-span-8 grid grid-cols-subgrid">
          {filteredDeliveries.map((delivery: DeliveryRow) => {
            const isCancelled = delivery.status === 'Отменено';
            const editUrl = `/warehouse/deliveries/${delivery.id}/edit`;
            const n = delivery.items.length;
            const canExpand = n > 0;

            return (
              <div
                key={delivery.id}
                className={`col-span-8 grid grid-cols-subgrid group ${expandedId === delivery.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}
              >
                <div
                  role="link"
                  tabIndex={0}
                  className={`grid grid-cols-subgrid col-span-8 items-center py-2 px-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm ${isCancelled ? 'opacity-50' : ''}`}
                  onClick={() => navigate(editUrl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(editUrl);
                    }
                  }}
                >
                  <div className={`pr-6 text-sm text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                    {new Date(delivery.date).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </div>
                  <div className={`pr-6 text-sm font-semibold truncate ${isCancelled ? 'line-through' : ''}`}>
                    {delivery.supplier}
                  </div>
                  <div className={`pr-6 text-sm truncate ${isCancelled ? 'line-through' : ''}`}>
                    {delivery.warehouse_name || '—'}
                  </div>
                  <div className="pr-6 text-left text-sm">
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === delivery.id ? null : delivery.id);
                        }}
                        className="text-sm font-medium text-[#5D4FF1] hover:text-[#F70000] transition-colors cursor-pointer"
                      >
                        {`${n} ${getPositionPlural(n)}`}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="pr-6 flex justify-center">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(delivery.status)}`}
                    >
                      {delivery.status.toUpperCase()}
                    </span>
                  </div>
                  <div className={`pr-6 text-sm text-right tabular-nums font-medium text-foreground ${isCancelled ? 'line-through' : ''}`}>
                    {delivery.amount.toLocaleString()}
                  </div>
                  <div className="min-w-0 px-4 flex flex-wrap gap-1 justify-end">
                    {delivery.status === 'Черновик' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sendTransit.mutate(delivery.id);
                        }}
                        disabled={sendTransit.isPending}
                        className={DELIVERY_ACTION_CLASS}
                      >
                        <Truck className="w-4 h-4 shrink-0" aria-hidden />
                        В путь
                      </button>
                    )}
                    {delivery.status === 'В пути' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          receiveDelivery.mutate(delivery.id);
                        }}
                        disabled={receiveDelivery.isPending}
                        className={DELIVERY_ACTION_CLASS}
                      >
                        <PackageCheck className="w-4 h-4 shrink-0" aria-hidden />
                        Принять
                      </button>
                    )}
                    {isCancelled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreDelivery.mutate(delivery.id);
                        }}
                        disabled={restoreDelivery.isPending}
                        className={DELIVERY_ACTION_CLASS}
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" aria-hidden />
                        Восстановить
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isCancelled && (
                      <button
                        type="button"
                        className="p-1 text-red-500 opacity-40 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelDelivery.mutate(delivery.id);
                        }}
                        title="Отменить"
                      >
                        <img src={crossIcon} className="w-4 h-4" alt="" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === delivery.id && canExpand && (
                  <div className="col-span-8 pb-2 pl-4 mt-1 pt-1 ml-6">
                    <div className="max-w-sm space-y-0.5">
                      {delivery.items.map((item) => (
                        <div key={item.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                          <span className="text-foreground font-medium">{item.name}</span>
                          {' — '}
                          {item.quantity} {item.unit},{' '}
                          {item.price.toLocaleString('ru-RU')} сом, итого{' '}
                          {(item.quantity * item.price).toLocaleString('ru-RU')} сом
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && filteredDeliveries.length === 0 && (
            <div className="col-span-8 py-12 text-center text-muted-foreground text-sm">
              {search ? 'Ничего не найдено' : 'Нет поставок. Нажмите «+ Добавить»'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
