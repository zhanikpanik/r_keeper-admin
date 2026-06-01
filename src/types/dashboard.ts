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
export type AlertType = 'critical' | 'warning';

/** Один алерт на дашборде — проблема + целевое действие */
export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  /** Текст на кнопке действия (если null — алерт только информационный) */
  actionLabel: string | null;
  /** Куда ведёт кнопка */
  actionHref: string | null;
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
}

export interface OperationalResult {
  revenue: number;
  expenses: number;
  writeOffs: number;
  net: number;
}

export interface DashboardData {
  metrics: Metric[];
  alerts: Alert[];
  chronology: ChronologyEvent[];
  warehouseThreats: WarehouseThreat[];
  shiftStatus: ShiftAlertStatus;
  yesterday: YesterdaySummary;
  topDishes: TopDish[];
  operationalResult: OperationalResult;
}
