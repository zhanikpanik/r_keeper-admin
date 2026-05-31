import { CheckCircle, AlertTriangle, Calendar, WifiOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { YesterdaySummary } from '@/types/dashboard';

interface Props {
  data: YesterdaySummary;
}

export function YesterdayBar({ data }: Props) {
  const navigate = useNavigate();

  // Выходной — вчера не работали
  if (data.status === 'dayoff') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/50 bg-muted/30 text-sm">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Вчера — выходной</span>
      </div>
    );
  }

  // Данные недоступны
  if (data.status === 'unavailable') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/50 bg-muted/30 text-sm">
        <WifiOff className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Вчера — данные недоступны</span>
      </div>
    );
  }

  // Нормальное состояние
  const formattedRevenue = (data.revenue ?? 0).toLocaleString('ru-RU');
  const checks = data.checks ?? 0;
  const diff = data.cashDifference;
  const isClean = data.shiftClosed && diff !== null && Math.abs(diff) <= 500;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/50 bg-muted/30 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => navigate('/cash-shifts')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/cash-shifts'); }}
    >
      <span className="text-muted-foreground">Вчера:</span>

      <span className="font-medium text-foreground">
        {formattedRevenue} сом
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-foreground">
        {checks} чеков
      </span>

      <span className="text-muted-foreground">·</span>

      {isClean ? (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="w-3.5 h-3.5" />
          смена закрыта
          {diff !== null && diff !== 0 && (
            <span className="text-muted-foreground ml-1">
              (расхождение {diff} сом)
            </span>
          )}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5" />
          {!data.shiftClosed
            ? 'смена не закрыта'
            : diff !== null
              ? `расхождение ${diff.toLocaleString('ru-RU')} сом`
              : 'проверьте кассу'}
        </span>
      )}

      <Link
        to="/cash-shifts"
        className="ml-auto text-xs text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Все смены →
      </Link>
    </div>
  );
}
