import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageCheck, Pencil, RotateCcw, Search, Truck, X } from 'lucide-react';
import {
  useWarehouseDeliveries,
  useReceiveDelivery,
  useCancelDelivery,
  useRestoreDelivery,
  useSendDeliveryInTransit,
  type DeliveryRow,
  type DeliveryUiStatus,
} from '@/hooks/useWarehouse';

/** Unified action button used across all warehouse tables */
const ACTION_BTN =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const ACTION_PRIMARY = `${ACTION_BTN} text-[#5D4FF1] hover:text-[#4538c4] hover:bg-[#5D4FF1]/10`;
const ROW_ACTION =
  'opacity-60 group-hover:opacity-100 transition-opacity p-1 cursor-pointer rounded hover:bg-muted/50';

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

  const { data: deliveries = [], isLoading, isError, error: loadError } = useWarehouseDeliveries();
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
          {(loadError as Error)?.message}
        </p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
          <Search className="w-3.5 h-3.5 opacity-40" />
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

      <table className="table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-sm font-semibold text-foreground">
            <th scope="col" className="text-left py-3 px-3 w-[100px]">Дата</th>
            <th scope="col" className="text-left py-3 px-3 w-[140px]">Поставщик</th>
            <th scope="col" className="text-left py-3 px-3 w-[120px]">Склад</th>
            <th scope="col" className="text-left py-3 px-3 w-[112px]">Позиции</th>
            <th scope="col" className="text-center py-3 px-3 w-[100px]">Статус</th>
            <th scope="col" className="text-right py-3 px-3 w-[100px]">Сумма</th>
            <th scope="col" className="py-3 px-3" />
            <th scope="col" className="w-[80px]" />
            <th scope="col" className="w-[36px]" />
          </tr>
        </thead>
        <tbody>
          {filteredDeliveries.map((delivery: DeliveryRow) => {
            const isCancelled = delivery.status === 'Отменено';
            const editUrl = `/warehouse/deliveries/${delivery.id}/edit`;
            const n = delivery.items.length;
            const canExpand = n > 0;
            const isExpanded = expandedId === delivery.id;

            return (
              <>
              <tr
                key={delivery.id}
                className={`group cursor-pointer transition-colors
                  ${isExpanded ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'}
                  ${isCancelled ? 'opacity-50' : ''}`}
                onClick={canExpand ? () => setExpandedId(isExpanded ? null : delivery.id) : undefined}
                tabIndex={canExpand ? 0 : -1}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && canExpand) {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : delivery.id);
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
                    <span className="text-sm font-medium">
                      {`${n} ${getPositionPlural(n)}`}
                    </span>
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
                  {delivery.amount.toLocaleString()} сом
                </td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {delivery.status === 'Черновик' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); sendTransit.mutate(delivery.id); }} disabled={sendTransit.isPending} className={ACTION_PRIMARY}>
                        <Truck className="w-3.5 h-3.5 shrink-0" />В путь
                      </button>
                    )}
                    {delivery.status === 'В пути' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); receiveDelivery.mutate(delivery.id); }} disabled={receiveDelivery.isPending} className={ACTION_PRIMARY}>
                        <PackageCheck className="w-3.5 h-3.5 shrink-0" />Принять
                      </button>
                    )}
                    {isCancelled && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); restoreDelivery.mutate(delivery.id); }} disabled={restoreDelivery.isPending} className={ACTION_PRIMARY}>
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />Восстановить
                      </button>
                    )}
                  </div>
                </td>
                <td className={`py-2 px-3 ${ROW_ACTION}`}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); navigate(editUrl); }} title="Редактировать">
                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </td>
                <td className={`py-2 px-3 ${ROW_ACTION}`}>
                  {!isCancelled && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); cancelDelivery.mutate(delivery.id); }} title="Отменить">
                      <X className="w-4 h-4 text-muted-foreground hover:text-red-600" />
                    </button>
                  )}
                </td>
              </tr>
              {isExpanded && canExpand && (
                <tr key={`${delivery.id}-detail`} className="bg-[#EFF0F4]">
                  <td colSpan={9} className="pb-2 pt-0 pl-10">
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
            <tr><td colSpan={9} className="py-16 text-center">
              <p className="text-sm font-medium mb-1">
                {search ? 'Ничего не найдено' : 'Поставок пока нет'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {search ? 'Попробуйте изменить поисковый запрос' : 'Создайте первую поставку, чтобы начать учёт товаров на складе'}
              </p>
              {!search && (
                <Link to="/warehouse/deliveries/new" className="text-sm text-primary hover:underline">
                  Создать поставку →
                </Link>
              )}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
