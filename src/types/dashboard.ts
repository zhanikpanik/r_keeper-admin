/** Тренд: положительный — зелёный ↑, отрицательный — красный ↓, ноль — серый → */
export interface Trend {
  value: number;
  /** vs тот же день прошлой недели */
  prevPeriod: number;
}

/** Одна KPI-карточка */
export interface Metric {
  label: string;
  value: number;
  format: 'som' | 'count';
  trend: Trend | null;
  /** Пояснение к значению (tooltip) */
  tooltip?: string;
}

/** Тип алерта */
export type AlertType = 'critical' | 'warning' | 'info';

/** Один алерт на дашборде — проблема + целевое действие */
export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  /** Текст на кнопке действия (если null — алерт только информационный) */
  actionLabel: string | null;
  /** Куда ведёт кнопка */
  actionHref: string | null;
  /** Домен для группировки: 'warehouse' | 'checks' | 'cash' | 'staff' */
  domain: string;
}

/** Группа алертов по severity — для фазы «много проблем» */
export interface AlertGroup {
  severity: AlertType;
  label: string;
  alerts: Alert[];
  /** Раскрыта по умолчанию? */
  defaultExpanded: boolean;
}

/** Карточка миграции — одно действие на весь домен */
export type MigrationActionType = 'inventory' | 'mark_checked' | 'close_period';

export interface MigrationCard {
  id: string;
  domain: string;
  problemCount: number;
  problems: string[];
  contextMessage: string;
  actionLabel: string;
  actionHref?: string;
  actionType: MigrationActionType;
  /** Граничная дата для baseline */
  baselineDate: string;
}

/** Тип события в хронологии — для выбора иконки */
export type ChronologyEventType = 'shift_open' | 'expense' | 'delivery' | 'write_off';

/** Одно событие в хронологии дня */
export interface ChronologyEvent {
  id: string;
  time: string;
  actor: string;
  action: string;
  /** Детали (сумма, количество, поставщик) */
  detail: string | null;
  /** Если событие требует действия менеджера — кнопка */
  actionLabel: string | null;
  actionHref: string | null;
  /** Тип события (для выбора иконки) */
  type?: ChronologyEventType;
}

/** Ингредиент под угрозой — с привязкой к блюдам */
export interface WarehouseThreat {
  name: string;
  remaining: string;
  daysLeft: number | null; // null = неизвестно (пока consumption не работает)
  level: 'critical' | 'warning';
  /** Блюда, которые под угрозой */
  affectedDishes: string[];
  /** Склад, на котором лежит ингредиент */
  warehouseName: string | null;
  /** Минусовой остаток */
  negative?: boolean;
  /** Последняя поставка: дата + количество */
  lastDelivery: string | null;
}

/** Статус текущей смены (для алерта) */
export interface ShiftAlertStatus {
  isOpen: boolean;
  openedAt: string | null;
  hoursOpen: number | null;
  cashier: string | null;
}

/** Корневая модель дашборда */
export interface YesterdaySummary {
  revenue: number | null;
  checks: number | null;
  shiftClosed: boolean | null;
  cashDifference: number | null;
  /** 'normal' | 'dayoff' | 'unavailable' */
  status: 'normal' | 'dayoff' | 'unavailable';
}

export interface TopDish {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  margin: number;
}

export interface OperationalResult {
  revenue: number;
  expenses: number;
  writeOffs: number;
  net: number;
}

/** Ингредиент с отрицательным остатком — для inline-корректировки */
export interface NegativeStockItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  warehouseId: string;
  warehouseName: string | null;
}

export interface DashboardData {
  metrics: Metric[];
  alerts: Alert[];
  /** Сгруппированные алерты — когда их > ALERT_GROUP_THRESHOLD */
  alertGroups: AlertGroup[] | null;
  /** Всего алертов (для health bar) */
  totalAlertCount: number;
  /** Критических алертов */
  criticalCount: number;
  chronology: ChronologyEvent[];
  warehouseThreats: WarehouseThreat[];
  shiftStatus: ShiftAlertStatus;
  yesterday: YesterdaySummary;
  topDishes: TopDish[];
  /** true если сегодня нет оплаченных заказов */
  isTodayEmpty: boolean;
  /** Выручка за 7 дней (для фолбека) */
  weekRevenue: number;
  /** Чеков за 7 дней (для фолбека) */
  weekChecks: number;
  /** Анти-топ: блюда с отрицательной или низкой маржой (за месяц) */
  antiTop: TopDish[];
  /** Карточки миграции — только при переходе с Poster */
  migrationCards: MigrationCard[];
  /** Метка периода для хронологии: «сегодня», «неделя», «месяц» */
  periodLabel: string;
  /** Сырые данные минусовых остатков для inline-корректировки */
  negativeStockItems: NegativeStockItem[];
  /** Общая себестоимость проданных блюд за период (сом) */
  foodCost: number;
}

/** Порог: больше этого числа — алерты группируются */
export const ALERT_GROUP_THRESHOLD = 5;
