import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWarehouseDelivery, type DeliveryUiStatus } from '@/hooks/useWarehouse';

function formatDateTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: DeliveryUiStatus) {
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

export function DeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: d, isLoading, isError, error } = useWarehouseDelivery(id);

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  }

  if (isError || !d) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-muted-foreground">
          {isError ? String((error as Error)?.message ?? 'Ошибка') : 'Поставка не найдена'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/warehouse/deliveries')}
          className="text-sm text-primary font-medium"
        >
          К списку поставок
        </button>
      </div>
    );
  }

  const lineTotal = d.items.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <div className="p-8 max-w-3xl [&_button]:cursor-pointer">
      <button
        type="button"
        onClick={() => navigate('/warehouse/deliveries')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к поставкам
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-2">Поставка</h2>
          <p className="text-sm text-muted-foreground">{formatDateTime(d.date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.status !== 'Отменено' && (
            <Link
              to={`/warehouse/deliveries/${d.id}/edit`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-input bg-background hover:bg-muted/60 transition-colors"
            >
              Редактировать
            </Link>
          )}
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusBadgeClass(d.status)}`}
          >
            {d.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-4 text-sm mb-10">
        <div className="flex gap-4">
          <span className="w-36 shrink-0 text-muted-foreground pt-0.5">Поставщик</span>
          <span className="font-medium">{d.supplier || '—'}</span>
        </div>
        <div className="flex gap-4">
          <span className="w-36 shrink-0 text-muted-foreground pt-0.5">Источник</span>
          <span>{d.source}</span>
        </div>
        <div className="flex gap-4">
          <span className="w-36 shrink-0 text-muted-foreground pt-0.5">Сумма документа</span>
          <span className="font-semibold tabular-nums">{d.amount.toLocaleString('ru-RU')} сом</span>
        </div>
        <div className="flex gap-4 items-start">
          <span className="w-36 shrink-0 text-muted-foreground pt-0.5">Комментарий</span>
          <span className="whitespace-pre-wrap">{d.comment?.trim() ? d.comment : '—'}</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3">Позиции</h3>
      {d.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет строк</p>
      ) : (
        <>
          <div className="flex items-center pb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="flex-1 min-w-0">Наименование</div>
            <div className="w-24 text-right shrink-0">Кол-во</div>
            <div className="w-24 text-right shrink-0">Цена</div>
            <div className="w-28 text-right shrink-0">Сумма</div>
          </div>
          <div className="divide-y">
            {d.items.map((item) => (
              <div key={item.id} className="flex items-center py-2.5 text-sm">
                <div className="flex-1 min-w-0 font-medium pr-2">{item.name}</div>
                <div className="w-24 text-right tabular-nums text-muted-foreground shrink-0">
                  {item.quantity} {item.unit}
                </div>
                <div className="w-24 text-right tabular-nums text-muted-foreground shrink-0">
                  {item.price.toLocaleString('ru-RU')}
                </div>
                <div className="w-28 text-right tabular-nums font-medium shrink-0">
                  {(item.quantity * item.price).toLocaleString('ru-RU')}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 text-sm text-muted-foreground">
            Итого по строкам:{' '}
            <span className="ml-2 font-bold text-foreground tabular-nums">
              {lineTotal.toLocaleString('ru-RU')} сом
            </span>
          </div>
        </>
      )}
    </div>
  );
}
