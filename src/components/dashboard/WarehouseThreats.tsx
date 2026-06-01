import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { WarehouseThreat } from '@/types/dashboard';

interface WarehouseThreatsProps {
  threats: WarehouseThreat[];
  /** false = данные ещё не загружены, null = данных нет в системе */
  loaded?: boolean | null;
}

const levelConfig = {
  critical: {
    bg: 'bg-destructive/10 text-destructive',
    label: '< 1 дня',
  },
  warning: {
    bg: 'bg-amber-100 text-amber-700',
    label: '≤ 3 дней',
  },
};

export function WarehouseThreats({ threats, loaded = true }: WarehouseThreatsProps) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-3">Склад под угрозой</h2>

      {threats.length === 0 ? (
        loaded === false ? (
          <p className="text-sm text-muted-foreground">Нет данных — обновите инвентаризацию</p>
        ) : loaded === null ? (
          <p className="text-sm text-muted-foreground">Ингредиенты не заведены</p>
        ) : (
          <p className="text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Запасов хватает
          </p>
        )
      ) : (
        <div>
          {threats.map((threat, i) => (
            <div
              key={threat.name}
              className={cn(
                'py-2',
                i < threats.length - 1 ? 'border-b border-border/30' : '',
              )}
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {threat.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {threat.remaining}
                </span>
                {threat.daysLeft !== null && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded font-medium',
                    levelConfig[threat.level].bg,
                  )}>
                    {levelConfig[threat.level].label}
                  </span>
                )}
              </div>

              {threat.affectedDishes.length > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Под угрозой:{' '}
                  {threat.affectedDishes.map((dish, j) => (
                    <span key={dish}>
                      <span className="text-foreground">{dish}</span>
                      {j < threat.affectedDishes.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        to="/warehouse/inventory"
        className="inline-block mt-2 text-sm font-medium text-primary hover:underline"
      >
        Перейти на склад →
      </Link>
    </div>
  );
}
