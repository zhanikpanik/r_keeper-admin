import { useState } from 'react';
import { toast } from 'sonner';
import { mockDashboard } from '@/mocks/dashboardMocks';
import { ActionBar } from '@/components/dashboard/ActionBar';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertCard } from '@/components/dashboard/AlertCard';
import { ChronologyFeed } from '@/components/dashboard/ChronologyFeed';
import { WarehouseThreats } from '@/components/dashboard/WarehouseThreats';
import { YesterdayBar } from '@/components/dashboard/YesterdayBar';
import type { Alert } from '@/types/dashboard';

export function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>(mockDashboard.alerts);

  const handleDismiss = (id: string) => {
    const dismissedAlert = alerts.find((a) => a.id === id);
    if (!dismissedAlert) return;
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast('Алерт скрыт', {
      action: {
        label: 'Отменить',
        onClick: () => setAlerts((prev) => [...prev, dismissedAlert]),
      },
      duration: 5000,
    });
  };

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
        <YesterdayBar data={mockDashboard.yesterday} />

        {/* BLOCK 3 — KPI today (5 cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {mockDashboard.metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              format={metric.format}
              trend={metric.trend}
              tooltip={metric.tooltip}
            />
          ))}
        </div>

        {/* BLOCK 4 & 5 — Chronology + Warehouse Threats (2-col) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ChronologyFeed events={mockDashboard.chronology} />
          <WarehouseThreats threats={mockDashboard.warehouseThreats} loaded />
        </div>
      </div>
    </div>
  );
}
