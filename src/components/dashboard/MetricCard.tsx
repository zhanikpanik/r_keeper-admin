import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import type { ElementType } from 'react';
import { cn } from '@/lib/utils';
import { SomIcon } from '@/components/dashboard/SomIcon';

interface MetricCardProps {
  label: string;
  value: number;
  format: 'som' | 'count';
  trend: { value: number; prevPeriod: number } | null;
  /** Пояснение к значению (tooltip при наведении) */
  tooltip?: string;
  /** Иконка в tinted circle (например, Banknote, Users) */
  icon?: ElementType;
}

function formatValue(n: number, fmt: 'som' | 'count', approximate?: boolean): string {
  const prefix = approximate ? '≈ ' : '';
  if (fmt === 'count') return prefix + n.toLocaleString('ru-RU');
  return prefix + n.toLocaleString('ru-RU');
}

export function MetricCard({ label, value, format, trend, tooltip, icon }: MetricCardProps) {
  const trendDirection = trend
    ? trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat'
    : null;

  const trendMeta = trendDirection
    ? {
        up: { Icon: ArrowUp, color: 'text-green-600' },
        down: { Icon: ArrowDown, color: 'text-destructive' },
        flat: { Icon: ArrowRight, color: 'text-muted-foreground' },
      }[trendDirection]
    : null;

  const IconComponent = icon;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Label row: icon circle + label */}
      <div className="flex items-center gap-2 min-w-0">
        {IconComponent && (
          <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-primary bg-primary/10">
            <IconComponent className="w-3.5 h-3.5" />
          </span>
        )}
        <p className="text-sm text-muted-foreground truncate">{label}</p>
      </div>

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

        {trendMeta && (
          <span className={cn('flex items-center gap-0.5 text-xs shrink-0', trendMeta.color)}>
            <trendMeta.Icon className="w-3.5 h-3.5" />
            <span>{trend!.value > 0 ? '+' : ''}{trend!.value}%</span>
          </span>
        )}
      </div>

    </div>
  );
}
