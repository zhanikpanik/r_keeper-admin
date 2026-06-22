import { useState, useMemo } from 'react';
import { ArrowDownRight, Banknote, Receipt, Users, Calculator, Wallet } from 'lucide-react';
import warehouseIcon from '@/assets/icons/warehouse.svg?raw';
import clockIcon from '@/assets/icons/clock.svg?raw';
import receiptIcon from '@/assets/icons/sheet-of-paper.svg?raw';
import walletIcon from '@/assets/icons/wallet.svg?raw';
import undoIcon from '@/assets/icons/undo.svg?raw';
import trashIcon from '@/assets/icons/trashcan.svg?raw';
import clipboardIcon from '@/assets/icons/clipboard.svg?raw';
import truckIcon from '@/assets/icons/truck.svg?raw';
import { useDashboardNewData, type DashboardPeriod } from '@/hooks/useDashboardNewData';
import { getMockData } from '@/hooks/useDashboardMockData';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { ActionBar } from '@/components/dashboard/ActionBar';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertCard } from '@/components/dashboard/AlertCard';
import { MigrationCard } from '@/components/dashboard/MigrationCard';
import { ChronologyFeed } from '@/components/dashboard/ChronologyFeed';

const metricIcons = [Banknote, Calculator, Receipt, ArrowDownRight, Users, Wallet];

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

const severityOrder: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function fmtSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

function formatPeriodRange(period: DashboardPeriod): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  switch (period) {
    case 'today':
      return fmt(today);
    case 'week': {
      const weekAgo = new Date(today.getTime() - 6 * 86400000);
      return `${fmt(weekAgo)} – ${fmt(today)}`;
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return `${fmt(monthStart)} – ${fmt(today)}`;
    }
  }
}

function alertIconSrc(id: string): string | undefined {
  if (id.startsWith('stock-') || id === 'stock-negative' || id === 'stock-zero' || id === 'stock-low') return warehouseIcon;
  if (id.startsWith('stuck-orders') || id.startsWith('shift-') || id === 'no-shift-orders') return clockIcon;
  if (id.startsWith('anomaly-check') || id.startsWith('zero-check') || id.startsWith('suspicious-check')) return receiptIcon;
  if (id.startsWith('shift-discrepancy') || id.startsWith('blank-expense')) return walletIcon;
  if (id.startsWith('many-refund') || id.startsWith('staff-refund')) return undoIcon;
  if (id.startsWith('dead-dish') || id.startsWith('dead-ingredient')) return trashIcon;
  if (id.startsWith('no-inventory') || id.startsWith('stale-inventory')) return clipboardIcon;
  if (id.startsWith('anomaly-delivery')) return truckIcon;
  return undefined;
}

const MOCK = false;

export function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('today');

  const realQuery = useDashboardNewData(period);
  const mockData = MOCK ? getMockData(period) : null;

  const data = mockData ?? realQuery.data;
  const isPending = MOCK ? false : realQuery.isPending;
  const isError = MOCK ? false : realQuery.isError;
  const error = MOCK ? null : realQuery.error;

  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [dismissedMigrationIds, setDismissedMigrationIds] = useState<Set<string>>(new Set());

  const alerts = useMemo(() => {
    if (!data) return [];
    const cards = data.migrationCards ?? [];
    const migrationDomains = new Set<string>(cards
      .filter((c) => !dismissedMigrationIds.has(c.id))
      .map((c) => {
        if (c.id === 'migrate-warehouse') return 'warehouse';
        if (c.id === 'migrate-checks') return 'checks';
        if (c.id === 'migrate-cash') return 'cash';
        return '';
      }));
    return (data.alerts ?? [])
      .filter((a) => !dismissedAlertIds.has(a.id) && !migrationDomains.has(a.domain))
      .sort((a, b) => (severityOrder[a.type] ?? 99) - (severityOrder[b.type] ?? 99));
  }, [data, dismissedAlertIds, dismissedMigrationIds]);

  const migrationCards = useMemo(() => {
    if (!data) return [];
    return (data.migrationCards ?? []).filter((c) => !dismissedMigrationIds.has(c.id));
  }, [data, dismissedMigrationIds]);

  if (isError) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Ошибка загрузки дашборда</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу'}
          </p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics ?? [];
  const yesterday = data?.yesterday;
  const chronology = data?.chronology ?? [];
  const totalAlertCount = data?.totalAlertCount ?? 0;
  const criticalCount = data?.criticalCount ?? 0;

  const showAlerts = alerts.length > 0;
  const hasMigration = migrationCards.length > 0;
  const periodRange = formatPeriodRange(period);

  const hasYesterday = period === 'today' && yesterday && yesterday.revenue != null;

  return (
    <div className="min-h-full bg-background">
      <ActionBar criticalCount={criticalCount} totalAlertCount={totalAlertCount} />

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">

        {/* ═══ PERIOD SELECTOR ═══ */}
        <div>
          <SegmentTabs options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          <p className="text-sm text-muted-foreground mt-2 ml-1">{periodRange}</p>
        </div>

        {/* ═══ METRICS + YESTERDAY + ALERTS (один контейнер) ═══ */}
        {isPending && (
          <div className="bg-[#EFF1F3] rounded-xl p-5 opacity-60">
            <p className="text-sm text-muted-foreground mb-4">Загрузка данных...</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/30">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={i === 0 ? 'pr-4' : i === 5 ? 'pl-4' : 'px-4'}>
                  <div className="h-4 bg-muted rounded w-20 mb-2" />
                  <div className="h-7 bg-muted rounded w-24 mb-1" />
                  <div className="h-3 bg-muted rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {metrics.length > 0 && (
          <div className="bg-[#EFF1F3] rounded-xl p-4 sm:p-5 transition-opacity duration-300">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/30">
              {metrics.map((metric, i) => (
                <div key={metric.label} className={i === 0 ? 'pr-3 sm:pr-4' : i === metrics.length - 1 ? 'pl-3 sm:pl-4' : 'px-3 sm:px-4'}>
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

            {/* Yesterday bar */}
            {hasYesterday && (
              <div className="mt-3 pt-3 border-t border-border/30 text-sm text-muted-foreground">
                Вчера: <span className="font-medium text-foreground">{fmtSom(yesterday.revenue!)} сом</span>
                {yesterday.checks != null && (
                  <> · <span className="text-foreground">{yesterday.checks} чеков</span></>
                )}
              </div>
            )}

            {/* Alerts — inside the same container, below yesterday */}
            {showAlerts && (
              <div className={hasYesterday ? 'mt-3 pt-3 border-t border-border/30' : 'mt-3'}>
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    type={alert.type}
                    message={alert.message}
                    actionLabel={alert.actionLabel}
                    actionHref={alert.actionHref}
                    onDismiss={() => setDismissedAlertIds((prev) => new Set(prev).add(alert.id))}
                    iconRaw={alertIconSrc(alert.id)}
                    grouped
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ CHRONOLOGY ═══ */}
        <ChronologyFeed
          events={chronology}
          title="События"
        />

        {/* ═══ MIGRATION CARDS ═══ */}
        {hasMigration && (
          <div className="space-y-2">
            {migrationCards.map((card) => (
              <MigrationCard
                key={card.id}
                card={card}
                onDismiss={(id) => {
                  setDismissedMigrationIds((prev) => new Set(prev).add(id));
                }}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
