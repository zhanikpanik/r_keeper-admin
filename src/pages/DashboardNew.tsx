import { useState, useMemo } from 'react';
import { ArrowDownRight, Banknote, Receipt, Users, Calculator, Wallet, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import warehouseIcon from '@/assets/icons/warehouse.svg?raw';
import clockIcon from '@/assets/icons/clock.svg?raw';
import receiptIcon from '@/assets/icons/sheet-of-paper.svg?raw';
import walletIcon from '@/assets/icons/wallet.svg?raw';
import undoIcon from '@/assets/icons/undo.svg?raw';
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
import type { Alert } from '@/types/dashboard';

const metricIcons = [Banknote, Calculator, Receipt, ArrowDownRight, Users, Wallet];

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

/** Domain display config */
const DOMAINS: Record<string, { label: string; iconRaw?: string; icon: typeof AlertTriangle }> = {
  warehouse: { label: 'Склад', iconRaw: warehouseIcon, icon: Package },
  cash: { label: 'Касса', iconRaw: walletIcon, icon: Wallet },
  checks: { label: 'Чеки', iconRaw: receiptIcon, icon: Receipt },
  staff: { label: 'Персонал', iconRaw: undoIcon, icon: Users },
  menu: { label: 'Меню', icon: AlertTriangle },
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
  if (id.startsWith('stock') || id === 'stock') return warehouseIcon;
  if (id.startsWith('shift-') || id === 'no-shift-orders') return clockIcon;
  if (id.startsWith('anomaly-check') || id.startsWith('suspicious-check')) return receiptIcon;
  if (id.startsWith('shift-discrepancy') || id.startsWith('blank-expense')) return walletIcon;
  if (id.startsWith('many-refund') || id.startsWith('staff-refund')) return undoIcon;
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

  // Group alerts by DOMAIN (not severity)
  const alertsByDomain = useMemo(() => {
    if (!data) return new Map<string, Alert[]>();
    const cards = data.migrationCards ?? [];
    const migrationDomains = new Set<string>(cards
      .filter((c) => !dismissedMigrationIds.has(c.id))
      .map((c) => {
        if (c.id === 'migrate-warehouse') return 'warehouse';
        if (c.id === 'migrate-checks') return 'checks';
        if (c.id === 'migrate-cash') return 'cash';
        return '';
      }));

    const active = (data.alerts ?? []).filter(
      (a) => !dismissedAlertIds.has(a.id) && !migrationDomains.has(a.domain),
    );

    const map = new Map<string, Alert[]>();
    for (const a of active) {
      const domain = a.domain || 'other';
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(a);
    }
    return map;
  }, [data, dismissedAlertIds, dismissedMigrationIds]);

  const totalAlerts = [...alertsByDomain.values()].reduce((s, arr) => s + arr.length, 0);

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

  const hasAlerts = totalAlerts > 0;
  const hasMigration = migrationCards.length > 0;
  const periodRange = formatPeriodRange(period);
  const hasYesterday = period === 'today' && yesterday && yesterday.revenue != null;

  // Status bar data
  const statusRevenue = metrics.length > 0 ? metrics[0] : null;
  const openOrdersMetric = metrics.find(m => m.label === 'Открыто');
  const shiftHoursMetric = data?.shiftStatus?.hoursOpen;
  const isAllGood = !hasAlerts && !hasMigration;

  return (
    <div className="min-h-full bg-background">
      <ActionBar criticalCount={criticalCount} totalAlertCount={totalAlertCount} />

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

        {/* ═══ STATUS BAR ═══ */}
        <div className={`
          rounded-xl px-5 py-3.5 flex items-center gap-4 text-sm
          ${isAllGood
            ? 'bg-[#EFF1F3] text-foreground'
            : 'bg-[#FFF3E0] text-foreground'
          }
        `}>
          {isAllGood ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}

          <span className="font-medium">
            {isAllGood ? 'Всё штатно' : `${totalAlerts} проблем${totalAlerts === 1 ? 'а' : totalAlerts < 5 ? 'ы' : ''}`}
          </span>

          {statusRevenue && (
            <span className="text-muted-foreground">
              {fmtSom(statusRevenue.value)} сом
            </span>
          )}

          {openOrdersMetric && openOrdersMetric.value > 0 && (
            <span className="text-muted-foreground">
              · {openOrdersMetric.value} заказ{openOrdersMetric.value === 1 ? '' : openOrdersMetric.value < 5 ? 'а' : 'ов'}
            </span>
          )}

          {shiftHoursMetric != null && shiftHoursMetric > 0 && (
            <span className="text-muted-foreground">
              · Смена {Math.round(shiftHoursMetric)}ч
            </span>
          )}

          {!isAllGood && (
            <span className="text-muted-foreground ml-auto text-xs">
              {[...alertsByDomain.keys()].map(d => DOMAINS[d]?.label || d).join(', ')}
            </span>
          )}
        </div>

        {/* ═══ PERIOD SELECTOR ═══ */}
        <div>
          <SegmentTabs options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          <p className="text-sm text-muted-foreground mt-2 ml-1">{periodRange}</p>
        </div>

        {/* ═══ LOADING ═══ */}
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

        {/* ═══ METRICS + YESTERDAY + ALERTS (один контейнер) ═══ */}
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
                    sparklineData={i === 0 ? data?.dailyRevenues : undefined}
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

            {/* Alerts — grouped by DOMAIN */}
            {hasAlerts && (
              <div className={hasYesterday ? 'mt-3 pt-3 border-t border-border/30' : 'mt-3'}>
                {[...alertsByDomain.entries()].map(([domain, domainAlerts]) => {
                  const domainCfg = DOMAINS[domain] || { label: domain, icon: AlertTriangle };
                  return (
                    <div key={domain} className="mb-2 last:mb-0">
                      <div className="flex items-center gap-1.5 mb-1 px-4">
                        <domainCfg.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {domainCfg.label}
                        </span>
                      </div>
                      {domainAlerts.map((alert) => (
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
                  );
                })}
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
