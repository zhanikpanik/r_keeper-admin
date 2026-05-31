import { useQuery } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export interface DashboardStats {
  revenue: number;
  revenueYesterday: number;
  expenses: number;
  expensesYesterday: number;
  stockAlerts: { name: string; quantity: number; unit: string }[];
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    note: string | null;
    transaction_at: string;
  }[];
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

  // Revenue today
  const { data: paidOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', todayStart)
    .lt('opened_at', todayEnd);
  const revenue = (paidOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Revenue yesterday
  const { data: paidOrdersYesterday } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', yesterdayStart)
    .lt('opened_at', todayStart);
  const revenueYesterday = (paidOrdersYesterday || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Expenses today
  const { data: expensesToday } = await supabase
    .from('cash_transactions')
    .select('amount')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'expense')
    .gte('transaction_at', todayStart)
    .lt('transaction_at', todayEnd);
  const expenses = (expensesToday || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Expenses yesterday
  const { data: expensesYesterdayRows } = await supabase
    .from('cash_transactions')
    .select('amount')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'expense')
    .gte('transaction_at', yesterdayStart)
    .lt('transaction_at', todayStart);
  const expensesYesterday = (expensesYesterdayRows || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Low stock ingredients (quantity < 5)
  const { data: lowStock } = await supabase
    .from('products')
    .select('name, stock_quantity, unit')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'ingredient')
    .lt('stock_quantity', 5)
    .gt('stock_quantity', -999)
    .order('stock_quantity')
    .limit(5);
  const stockAlerts = (lowStock || []).map((p) => ({
    name: p.name as string,
    quantity: Number(p.stock_quantity) || 0,
    unit: (p.unit as string) || 'кг',
  }));

  // Recent transactions (last 5)
  const { data: recentTx } = await supabase
    .from('cash_transactions')
    .select('id, type, amount, note, transaction_at')
    .eq('venue_id', VENUE_ID)
    .order('transaction_at', { ascending: false })
    .limit(5);
  const recentTransactions = (recentTx || []).map((t) => ({
    id: t.id as string,
    type: t.type as string,
    amount: Number(t.amount) || 0,
    note: t.note as string | null,
    transaction_at: t.transaction_at as string,
  }));

  return { revenue, revenueYesterday, expenses, expensesYesterday, stockAlerts, recentTransactions };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats', VENUE_ID],
    queryFn: fetchDashboardStats,
    // 2 min: dashboard is the landing page, viewed constantly
    staleTime: 2 * 60 * 1000,
  });
}
