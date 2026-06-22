import type { DashboardPeriod } from './useDashboardNewData';
import type { WarehouseThreat, ChronologyEvent, MigrationCard, Alert, Trend, YesterdaySummary, TopDish } from '@/types/dashboard';

// Realistic Alto Coffee Bishkek mock data

export interface MockDashboardData {
  metrics: Array<{ label: string; value: number; format: 'som' | 'count'; trend: Trend | null; tooltip?: string }>;
  yesterday: YesterdaySummary | null;
  alerts: Alert[];
  migrationCards: MigrationCard[];
  warehouseThreats: WarehouseThreat[];
  chronology: ChronologyEvent[];
  topDishes: TopDish[];
  antiTop: TopDish[];
  isTodayEmpty: boolean;
  weekRevenue: number;
  weekChecks: number;
  totalAlertCount: number;
  criticalCount: number;
  periodLabel: string;
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

export function getMockData(period: DashboardPeriod): MockDashboardData {
  const isToday = period === 'today';
  const isWeek = period === 'week';

  const multiplier = isToday ? 0.04 : isWeek ? 0.28 : 1;
  const revenue = Math.round(275630 * multiplier);
  const foodCost = Math.round(82100 * multiplier);
  const checks = Math.round(154 * multiplier);
  const avgCheck = checks > 0 ? Math.round(revenue / checks) : 0;

  const metrics = [
    { label: 'Выручка', value: revenue, format: 'som' as const, trend: { value: -17, prevPeriod: Math.round(revenue / 0.83) }, tooltip: `${fmt(revenue)} сом за период` },
    { label: 'Себестоимость', value: foodCost, format: 'som' as const, trend: null, tooltip: `${Math.round((foodCost / revenue) * 100)}% от выручки` },
    { label: 'Средний чек', value: avgCheck, format: 'som' as const, trend: { value: -5, prevPeriod: Math.round(avgCheck / 0.95) }, tooltip: `${checks} чеков` },
    { label: 'Расходы', value: Math.round(revenue * 0.06), format: 'som' as const, trend: null, tooltip: 'Расходы из кассы за период' },
    { label: 'Открыто', value: 4, format: 'count' as const, trend: null, tooltip: 'Открытых смен' },
    { label: 'В кассе', value: isToday ? 5000 : Math.round(5000 + revenue * 0.15), format: 'som' as const, trend: null, tooltip: 'Наличные в кассе' },
  ];

  const yesterday: YesterdaySummary | null = isToday
    ? { revenue: 12850, checks: 43, shiftClosed: true, cashDifference: 0, status: 'normal' }
    : null;

  const alerts: Alert[] = [
    { id: 'stock-low-coffee', type: 'warning', message: 'Арабика: осталось 2.3 кг (min 5 кг)', actionLabel: 'Заказать →', actionHref: '/warehouse', domain: 'warehouse' },
    { id: 'stock-low-milk', type: 'warning', message: 'Молоко: осталось 8 л (min 20 л)', actionLabel: 'Заказать →', actionHref: '/warehouse', domain: 'warehouse' },
    { id: 'shift-discrepancy-1', type: 'warning', message: 'Смена №42: расхождение 1 200 сом', actionLabel: 'Смотреть →', actionHref: '/cash-shifts', domain: 'cash' },
    { id: 'stuck-orders-1', type: 'critical', message: '3 заказа открыты более 12 часов', actionLabel: 'Смотреть →', actionHref: '/checks', domain: 'checks' },
    { id: 'zero-check-1', type: 'info', message: 'Чек #1087 закрыт на 0 сом (100% скидка)', actionLabel: 'Смотреть →', actionHref: '/checks', domain: 'checks' },
  ];

  const migrationCards: MigrationCard[] = [
    { id: 'migrate-warehouse', domain: 'Склад', problemCount: 25, problems: ['25 ингредиентов в минусе'], contextMessage: 'После импорта данных часть остатков ушла в минус. Проведите инвентаризацию, чтобы зафиксировать реальные остатки.', actionLabel: 'Начать инвентаризацию', actionHref: '/warehouse/inventory', actionType: 'inventory', baselineDate: '2026-06-01' },
    { id: 'migrate-cash', domain: 'Касса', problemCount: 6, problems: ['6 смен с расхождением'], contextMessage: 'Старые смены из предыдущей системы. Закройте период, чтобы они не влияли на текущие показатели.', actionLabel: 'Закрыть период до 01.06', actionHref: '/cash-shifts', actionType: 'close_period', baselineDate: '2026-06-01' },
    { id: 'migrate-checks', domain: 'Чеки', problemCount: 8, problems: ['60% возвратов (среднее 18%)'], contextMessage: 'Аномальная доля возвратов за период. Проверьте чеки — возможно, технический сбой.', actionLabel: 'К чекам', actionHref: '/checks', actionType: 'mark_checked', baselineDate: '2026-06-01' },
  ];

  const warehouseThreats: WarehouseThreat[] = [
    { name: 'Арабика Sergio', remaining: '2.3 кг', daysLeft: 2, level: 'critical', affectedDishes: ['Капучино', 'Латте', 'Американо'], warehouseName: 'Бар', negative: false, lastDelivery: '09.06 — 15 кг' },
    { name: 'Молоко 3.2%', remaining: '8 л', daysLeft: 3, level: 'warning', affectedDishes: ['Капучино', 'Латте', 'Какао'], warehouseName: 'Бар', negative: false, lastDelivery: '10.06 — 40 л' },
    { name: 'Сливки 33%', remaining: '1.5 л', daysLeft: 1, level: 'critical', affectedDishes: ['Раф', 'Флэт уайт'], warehouseName: 'Бар', negative: false, lastDelivery: null },
    { name: 'Сироп ванильный', remaining: '0.8 л', daysLeft: 4, level: 'warning', affectedDishes: ['Латте ванильный'], warehouseName: 'Бар', negative: false, lastDelivery: '05.06 — 3 л' },
    { name: 'Мята свежая', remaining: '0.2 кг', daysLeft: 1, level: 'critical', affectedDishes: ['Мохито', 'Лимонад'], warehouseName: 'Бар', negative: false, lastDelivery: null },
    { name: 'Масло сливочное', remaining: '1.2 кг', daysLeft: 2, level: 'critical', affectedDishes: ['Круассан', 'Сэндвич'], warehouseName: 'Кухня', negative: false, lastDelivery: '08.06 — 5 кг' },
    { name: 'Яйца', remaining: '24 шт', daysLeft: 3, level: 'warning', affectedDishes: ['Омлет', 'Сэндвич', 'Чизкейк'], warehouseName: 'Кухня', negative: false, lastDelivery: '10.06 — 120 шт' },
    { name: 'Мука', remaining: '5 кг', daysLeft: 7, level: 'warning', affectedDishes: ['Круассан', 'Чизкейк'], warehouseName: 'Кухня', negative: false, lastDelivery: '01.06 — 25 кг' },
  ];

  const chronology: ChronologyEvent[] = [
    { id: 'e1', time: '14:32', actor: 'Айжан', action: 'Провела расход', detail: 'Проезд курьера: 500 сом', actionLabel: 'К кассе', actionHref: '/transactions', type: 'expense' },
    { id: 'e2', time: '13:48', actor: 'Айжан', action: 'Приняла поставку', detail: 'Арабика Sergio +15 кг', actionLabel: 'К складу', actionHref: '/warehouse/operations', type: 'delivery' },
    { id: 'e3', time: '12:55', actor: 'Айжан', action: 'Списала продукты', detail: 'Молоко: 3 л, Сливки: 1 л', actionLabel: 'К складу', actionHref: '/warehouse/operations', type: 'write_off' },
    { id: 'e4', time: '11:45', actor: 'Айжан', action: 'Открыла смену', detail: null, actionLabel: null, actionHref: null, type: 'shift_open' },
    { id: 'e5', time: '11:30', actor: 'Бекжан', action: 'Внёс в кассу', detail: 'Размен: 5 000 сом', actionLabel: 'К кассе', actionHref: '/transactions', type: 'expense' },
    { id: 'e6', time: '08:50', actor: 'Бекжан', action: 'Открыл смену', detail: null, actionLabel: null, actionHref: null, type: 'shift_open' },
  ];

  const topDishes: TopDish[] = [
    { name: 'Капучино', qty: 42, revenue: 16800, cost: 3360, margin: 13440 },
    { name: 'Латте', qty: 38, revenue: 15200, cost: 3040, margin: 12160 },
    { name: 'Американо', qty: 35, revenue: 10500, cost: 1575, margin: 8925 },
    { name: 'Сэндвич с курицей', qty: 28, revenue: 19600, cost: 10780, margin: 8820 },
    { name: 'Чизкейк', qty: 22, revenue: 13200, cost: 3960, margin: 9240 },
  ];

  const antiTop: TopDish[] = [
    { name: 'Греческий салат', qty: 5, revenue: 3000, cost: 3450, margin: -450 },
    { name: 'Суп-пюре грибной', qty: 4, revenue: 2400, cost: 2520, margin: -120 },
    { name: 'Круассан с миндалём', qty: 8, revenue: 5600, cost: 5460, margin: 140 },
  ];

  return {
    metrics,
    yesterday,
    alerts,
    migrationCards,
    warehouseThreats,
    chronology,
    topDishes,
    antiTop,
    isTodayEmpty: false,
    weekRevenue: 275630,
    weekChecks: 154,
    totalAlertCount: 8,
    criticalCount: 2,
    periodLabel: isToday ? 'сегодня' : isWeek ? 'за неделю' : 'за месяц',
  };
}
