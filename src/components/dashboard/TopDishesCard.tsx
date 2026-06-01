import type { TopDish } from '@/types/dashboard';

interface Props {
  dishes: TopDish[];
  /** Минимальная доля выручки для отображения (0–1), по умолчанию 0 = все */
  minRevenueShare?: number;
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU');
}

export function TopDishesCard({ dishes, minRevenueShare = 0 }: Props) {
  const totalRevenue = dishes.reduce((sum, d) => sum + d.revenue, 0);

  const visible = minRevenueShare > 0
    ? dishes.filter((d) => d.revenue / totalRevenue >= minRevenueShare)
    : dishes;

  if (visible.length === 0) {
    return (
      <div className="bg-card rounded-xl p-4 hover:shadow-md transition-shadow">
        <h2 className="text-base font-semibold text-foreground mb-3">Что продаётся сегодня</h2>
        <p className="text-sm text-muted-foreground">Продаж пока нет</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 hover:shadow-md transition-shadow">
      <h2 className="text-base font-semibold text-foreground mb-3">Что продаётся сегодня</h2>

      <div className="space-y-0">
        {visible.map((dish, i) => {
          const share = totalRevenue > 0 ? ((dish.revenue / totalRevenue) * 100).toFixed(0) : '0';
          return (
            <div
              key={dish.name}
              className="flex items-baseline gap-3 py-1.5 text-sm"
            >
              {/* Name + share */}
              <span className="text-foreground flex-1 min-w-0 truncate">
                {dish.name}
                <span className="text-muted-foreground ml-1 text-xs">({share}%)</span>
              </span>

              {/* Qty */}
              <span className="text-muted-foreground shrink-0 w-10 text-right tabular-nums">
                ×{dish.qty}
              </span>

              {/* Revenue */}
              <span className="text-foreground font-medium shrink-0 w-16 text-right tabular-nums">
                {fmt(dish.revenue)} сом
              </span>

              {/* Mini bar */}
              <div className="w-12 shrink-0 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/40 rounded-full"
                  style={{ width: `${Math.min((dish.revenue / totalRevenue) * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
