import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCheck, type Check } from '@/hooks/useChecksData';
import { CHECK_ITEMS_TABLE_GRID, checkItemPositionTitle } from '@/lib/checkItemsTableGrid';

function formatDT(iso: string) {
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

function formatMoney(n: number) {
  return n.toLocaleString('ru-RU') + ' с';
}

function formatCheckProfitLine(c: Check): string {
  if (c.items.length === 0) return '—';
  if (c.items.every((i) => i.unitCost === null)) return '—';
  return formatMoney(c.profit) + (c.profitIncomplete ? '*' : '');
}

export function CheckDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: check, isLoading, isError, error } = useCheck(id);

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  }

  if (isError || !check) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-muted-foreground">
          {isError ? String((error as Error)?.message ?? 'Ошибка') : 'Чек не найден'}
        </p>
        <Link to="/checks" className="text-sm text-primary font-medium">
          К списку чеков
        </Link>
      </div>
    );
  }

  const subtotal = check.items.reduce((s, i) => s + i.qty * i.price, 0);
  const toPay = check.status === 'closed' ? check.paid : subtotal - check.discount;

  return (
    <div className="p-8 max-w-2xl">
      <button
        type="button"
        onClick={() => navigate('/checks')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к чекам
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-lg font-bold mb-1 font-mono break-all">{check.id}</h2>
          <p className="text-sm text-muted-foreground">Стол {check.tableNumber}</p>
          <p className="text-sm text-muted-foreground mt-1">Официант: {check.waiter}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground space-y-1">
          <p>
            <span className="font-semibold text-foreground">Открыт:</span> {formatDT(check.openedAt)}
          </p>
          <p>
            <span className="font-semibold text-foreground">Закрыт:</span>{' '}
            {check.status === 'open' ? '—' : formatDT(check.closedAt)}
          </p>
          <p>
            <span className="font-semibold text-foreground">Статус:</span>{' '}
            {check.status === 'open' ? 'Открыт' : 'Закрыт'}
          </p>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-xl mb-6">
        <div className={`${CHECK_ITEMS_TABLE_GRID} pb-2 border-b text-xs font-semibold text-muted-foreground`}>
          <div className="min-w-0">Позиция</div>
          <div className="text-right">Цена</div>
          <div className="text-right tabular-nums">Сумма</div>
          <div className="text-right tabular-nums">Маржа</div>
        </div>

        {check.items.map((item, idx) => (
          <div
            key={idx}
            className={`${CHECK_ITEMS_TABLE_GRID} py-2.5 border-b border-muted/50 last:border-0`}
          >
            <div
              className="min-w-0 flex items-baseline gap-1 text-sm"
              title={checkItemPositionTitle(item.qty, item.name)}
            >
              <span className="tabular-nums shrink-0 text-muted-foreground font-medium">
                {item.qty}×
              </span>
              <span className="min-w-0 truncate font-medium">{item.name}</span>
            </div>
            <div className="text-right text-sm text-muted-foreground tabular-nums">
              {formatMoney(item.price)}
            </div>
            <div className="text-right text-sm font-semibold tabular-nums">
              {formatMoney(item.qty * item.price)}
            </div>
            <div className="text-right text-sm tabular-nums text-green-600">
              {item.unitCost === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                formatMoney(item.qty * (item.price - item.unitCost))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="ml-auto w-72 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Итого</span>
          <span className="tabular-nums font-medium">{formatMoney(subtotal)}</span>
        </div>
        <div
          className="flex justify-between text-sm text-green-600"
          title={
            check.profitIncomplete
              ? 'Часть позиций без себестоимости; сумма только по строкам с cost_price в меню.'
              : 'Сумма (цена − себестоимость) × количество по позициям с cost_price'
          }
        >
          <span>Маржа</span>
          <span className="tabular-nums font-medium">{formatCheckProfitLine(check)}</span>
        </div>
        {check.discount > 0 && (
          <div className="flex justify-between text-sm text-amber-600">
            <span>Скидка</span>
            <span className="tabular-nums font-medium">−{formatMoney(check.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t pt-2">
          <span>{check.status === 'closed' ? 'К оплате' : 'По позициям'}</span>
          <span className="tabular-nums">{formatMoney(toPay)}</span>
        </div>
      </div>
    </div>
  );
}
