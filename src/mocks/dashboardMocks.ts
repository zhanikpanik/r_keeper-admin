import type { DashboardData } from '@/types/dashboard';

export const mockDashboard: DashboardData = {
  metrics: [
    { label: 'Выручка', value: 54200, format: 'som', trend: { value: 12, prevPeriod: 48400 } },
    { label: 'Чеков', value: 38, format: 'count', trend: { value: 5, prevPeriod: 36 } },
    { label: 'Гостей', value: 94, format: 'count', trend: { value: -3, prevPeriod: 97 } },
    { label: 'Средний чек', value: 576, format: 'som', trend: { value: 8, prevPeriod: 533 } },
    { label: 'В кассе', value: 12400, format: 'som', trend: null, tooltip: 'стартовый остаток + наличные оплаты − наличные расходы' },
  ],

  alerts: [
    {
      id: 'shift-long',
      type: 'critical',
      message: 'Смена открыта 14 часов. Кассир не закрыл смену.',
      actionLabel: 'Проверить смену →',
      actionHref: '/cash-shifts',
    },
    {
      id: 'stuck-orders',
      type: 'critical',
      message: '3 заказа висят больше 30 минут (столы 5, 7, 12)',
      actionLabel: 'Посмотреть заказы →',
      actionHref: '/checks',
    },
    {
      id: 'delivery-pending',
      type: 'warning',
      message: 'Кассир принял поставку от «Белая река» — требуется оформить',
      actionLabel: 'Оформить…',
      actionHref: '/warehouse/deliveries',
    },
    {
      id: 'stock-low',
      type: 'critical',
      message: '2 ингредиента на исходе',
      actionLabel: 'К складу →',
      actionHref: '/warehouse/inventory',
    },
  ],

  chronology: [
    {
      id: 'ev1',
      time: '09:30',
      actor: 'Айгуль',
      action: 'Открыла смену',
      detail: 'Старт: 5 000 сом',
      actionLabel: null,
      actionHref: null,
    },
    {
      id: 'ev2',
      time: '11:00',
      actor: 'Айгуль',
      action: 'Внесла расход',
      detail: 'Салфетки: 350 сом',
      actionLabel: 'Проверить',
      actionHref: '/transactions',
    },
    {
      id: 'ev3',
      time: '12:30',
      actor: 'Айгуль',
      action: 'Приняла поставку',
      detail: 'Белая река: 3 500 сом (5 поз.)',
      actionLabel: 'Оформить',
      actionHref: '/warehouse/deliveries',
    },
    {
      id: 'ev4',
      time: '13:15',
      actor: 'Айгуль',
      action: 'Списание',
      detail: 'Кофе: 0.2 кг',
      actionLabel: 'Проверить',
      actionHref: '/warehouse/write-offs',
    },
    {
      id: 'ev5',
      time: '14:05',
      actor: 'Айгуль',
      action: 'Внесла расход',
      detail: 'Такси: 200 сом',
      actionLabel: null,
      actionHref: null,
    },
  ],

  warehouseThreats: [
    {
      name: 'Молоко 3.2%',
      remaining: '2 л',
      daysLeft: 1,
      level: 'critical',
      affectedDishes: ['Латте', 'Капучино'],
    },
    {
      name: 'Кофе в зёрнах',
      remaining: '0.5 кг',
      daysLeft: 2,
      level: 'warning',
      affectedDishes: ['Американо', 'Эспрессо'],
    },
    {
      name: 'Сироп карамельный',
      remaining: '0.3 л',
      daysLeft: 3,
      level: 'warning',
      affectedDishes: ['Карамельный латте'],
    },
  ],

  shiftStatus: {
    isOpen: true,
    openedAt: '09:30',
    hoursOpen: 4.5,
    cashier: 'Айгуль',
  },

  yesterday: {
    revenue: 48300,
    checks: 42,
    shiftClosed: true,
    cashDifference: 200,
    status: 'normal',
  },
};
