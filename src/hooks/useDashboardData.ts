import { useQuery } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export interface DashboardStats {
  revenue: number;
  openOrders: number;
  stockRisks: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  // Today's date boundaries (local timezone)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  // Revenue: sum of total_amount for paid orders today
  const { data: paidOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', todayStart)
    .lt('opened_at', todayEnd);

  const revenue = (paidOrders || []).reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  // Open orders count
  const { count: openOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', VENUE_ID)
    .eq('status', 'active');

  // Stock risks: ingredients with low stock
  const { count: stockRisks } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', VENUE_ID)
    .eq('type', 'ingredient')
    .lt('stock_quantity', 5);

  return {
    revenue,
    openOrders: openOrders ?? 0,
    stockRisks: stockRisks ?? 0,
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats', VENUE_ID],
    queryFn: fetchDashboardStats,
    staleTime: 30 * 1000,
  });
}
