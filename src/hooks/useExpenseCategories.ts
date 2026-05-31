import { useQuery } from '@tanstack/react-query';
import { VENUE_ID } from '@/lib/supabase';

export interface ExpenseCategory {
  name: string;
  amount: number;
  color: string;
  children?: ExpenseCategory[]; // подкатегории для drill-down
}

// Realistic categories for a medium restaurant, as they'd be tracked in cash_transaction_categories
const MOCK_CATEGORIES: ExpenseCategory[] = [
  {
    name: 'Продукты',
    amount: 62_000,
    color: '#f97316',
    children: [
      { name: 'Кофе и зёрна', amount: 18_000, color: '#f97316' },
      { name: 'Молоко и сливки', amount: 14_000, color: '#fb923c' },
      { name: 'Мука, сахар, яйца', amount: 10_000, color: '#fdba74' },
      { name: 'Мясо и птица', amount: 8_000, color: '#fed7aa' },
      { name: 'Овощи и фрукты', amount: 7_000, color: '#ffedd5' },
      { name: 'Напитки (соки, вода)', amount: 5_000, color: '#fff7ed' },
    ],
  },
  {
    name: 'Персонал',
    amount: 48_000,
    color: '#3b82f6',
    children: [
      { name: 'Бариста и официанты', amount: 30_000, color: '#3b82f6' },
      { name: 'Повара', amount: 12_000, color: '#60a5fa' },
      { name: 'Администратор', amount: 6_000, color: '#93c5fd' },
    ],
  },
  {
    name: 'Аренда',
    amount: 28_000,
    color: '#8b5cf6',
  },
  {
    name: 'Коммунальные',
    amount: 16_500,
    color: '#06b6d4',
    children: [
      { name: 'Электричество', amount: 9_000, color: '#06b6d4' },
      { name: 'Вода и канализация', amount: 3_500, color: '#22d3ee' },
      { name: 'Интернет и связь', amount: 2_500, color: '#67e8f9' },
      { name: 'Вывоз мусора', amount: 1_500, color: '#a5f3fc' },
    ],
  },
  {
    name: 'Хозтовары',
    amount: 11_000,
    color: '#eab308',
    children: [
      { name: 'Одноразовая посуда', amount: 4_500, color: '#eab308' },
      { name: 'Чистящие средства', amount: 3_000, color: '#facc15' },
      { name: 'Салфетки и бумага', amount: 2_000, color: '#fef08a' },
      { name: 'Прочие расходники', amount: 1_500, color: '#fef9c3' },
    ],
  },
  {
    name: 'Обслуживание',
    amount: 8_500,
    color: '#ef4444',
    children: [
      { name: 'Ремонт кофемашины', amount: 4_000, color: '#ef4444' },
      { name: 'Холодильники и печи', amount: 3_000, color: '#f87171' },
      { name: 'Мелкий инвентарь', amount: 1_500, color: '#fca5a5' },
    ],
  },
  {
    name: 'Маркетинг',
    amount: 4_500,
    color: '#a855f7',
    children: [
      { name: 'SMM и реклама', amount: 3_000, color: '#a855f7' },
      { name: 'Полиграфия', amount: 1_500, color: '#c084fc' },
    ],
  },
  {
    name: 'Транспорт',
    amount: 3_200,
    color: '#64748b',
  },
  {
    name: 'Прочее',
    amount: 2_800,
    color: '#94a3b8',
  },
];

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense_categories', VENUE_ID],
    queryFn: () => MOCK_CATEGORIES,
    staleTime: 5 * 60 * 1000,
  });
}
