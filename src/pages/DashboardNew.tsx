import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Banknote, Receipt, Users, Calculator, Wallet } from 'lucide-react';
import { useDashboardNewData } from '@/hooks/useDashboardNewData';
import { ActionBar } from '@/components/dashboard/ActionBar';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertCard } from '@/components/dashboard/AlertCard';
import { ChronologyFeed } from '@/components/dashboard/ChronologyFeed';
import { WarehouseThreats } from '@/components/dashboard/WarehouseThreats';
import { YesterdayBar } from '@/components/dashboard/YesterdayBar';
import { OperationalResultCard } from '@/components/dashboard/OperationalResultCard';
import { TopDishesCard } from '@/components/dashboard/TopDishesCard';

const metricIcons = [Banknote, Receipt, Users, Calculator, Wallet];

export function Dashboard() {
  const { data, isPending, isError, error } = useDashboardNewData();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Merge real alerts + filter dismissed
  const alerts = useMemo(() => {
    if (!data) return [];
    return data.alerts.filter((a) => !dismissedIds.has(a.id));
  }, [data, dismissedIds]);

  const handleDismiss = (id: string) => {
    const alert = data?.alerts.find((a) => a.id === id);
    setDismissedIds((prev) => new Set(prev).add(id));
    if (alert) {
      toast('Алерт скрыт', {
        action: {
          label: 'Отменить',
          onClick: () => setDismissedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          }),
        },
        duration: 5000,
      });
    }
  };

  if (isError) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Ошибка загрузки дашборда</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу'}
          </p>
        </div>
      </div>
    );
  }

  // Show skeleton/metric placeholders while loading
  const metrics = data?.metrics ?? [];
  const yesterday = data?.yesterday;
  const operationalResult = data?.operationalResult;
  const warehouseThreats = data?.warehouseThreats ?? [];
  const topDishes = data?.topDishes ?? [];
  const chronology = data?.chronology ?? [];

  return (
    <div className="min-h-full bg-gray-50">
      {/* Sticky action bar */}
      <ActionBar />

      <div className="p-6 space-y-6">
        {/* BLOCK 1 — Alerts (only if present) */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                type={alert.type}
                message={alert.message}
                actionLabel={alert.actionLabel}
                actionHref={alert.actionHref}
                onDismiss={() => handleDismiss(alert.id)}
              />
            ))}
          </div>
        )}

        {/* BLOCK 2 — Yesterday summary */}
        {yesterday && <YesterdayBar data={yesterday} />}

        {/* BLOCK 3 — KPI today (single wide card) */}
        {metrics.length > 0 && (
          <div className="bg-card rounded-xl hover:shadow-md transition-shadow p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border/50">
              {metrics.map((metric, i) => (
                <div key={metric.label} className={i === 0 ? 'pr-4' : i === metrics.length - 1 ? 'pl-4' : 'px-4'}>
                  <MetricCard
                    label={metric.label}
                    value={metric.value}
                    format={metric.format}
                    trend={metric.trend}
                    tooltip={metric.tooltip}
                    icon={metricIcons[i]}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading state for metrics */}
        {isPending && (
          <div className="bg-card rounded-xl p-5 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border/50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={i === 0 ? 'pr-4' : i === 4 ? 'pl-4' : 'px-4'}>
                  <div className="h-4 bg-muted rounded w-20 mb-2" />
                  <div className="h-7 bg-muted rounded w-24 mb-1" />
                  <div className="h-3 bg-muted rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BLOCK 4 & 5 — Operational result + Warehouse (2-col, both compact) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {operationalResult && <OperationalResultCard data={operationalResult} />}
          <WarehouseThreats threats={warehouseThreats} loaded={!isPending} />
        </div>

        {/* BLOCK 6 & 7 — Top dishes + Chronology (2-col, both variable height) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <TopDishesCard dishes={topDishes} minRevenueShare={0.03} />
          <ChronologyFeed events={chronology} />
        </div>
      </div>
    </div>
  );
}
