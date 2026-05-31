import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SomIcon } from '@/components/dashboard/SomIcon';

interface MetricCardProps {
  label: string;
  value: number;
  format: 'som' | 'count';
  trend: { value: number; prevPeriod: number } | null;
  /** Пояснение к значению (tooltip при наведении) */
  tooltip?: string;
}

function formatValue(n: number, fmt: 'som' | 'count', approximate?: boolean): string {
  const prefix = approximate ? '≈ ' : '';
  if (fmt === 'count') return prefix + n.toLocaleString('ru-RU');
  return prefix + n.toLocaleString('ru-RU');
}

export function MetricCard({ label, value, format, trend, tooltip }: MetricCardProps) {
  const TrendIcon = trend
    ? trend.value > 0
      ? ArrowUp
      : trend.value < 0
        ? ArrowDown
        : ArrowRight
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? 'text-green-600'
      : trend.value < 0
        ? 'text-red-600'
        : 'text-muted-foreground'
    : '';

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 flex flex-col gap-2 min-w-0">
      <p className="text-sm text-muted-foreground truncate">{label}</p>

      <div className="flex items-baseline gap-1 min-w-0">
        <span className="flex items-baseline gap-1 min-w-0">
          <span
            className="text-2xl font-bold text-foreground truncate"
            title={tooltip}
          >
            {formatValue(value, format, !trend)}
          </span>
          {format === 'som' && (
            <SomIcon className="w-[1em] h-[1em] shrink-0 text-foreground" />
          )}
        </span>

        {trend && TrendIcon && (
          <span className={cn('flex items-center gap-0.5 text-xs shrink-0', trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
          </span>
        )}
      </div>

    </div>
  );
}
