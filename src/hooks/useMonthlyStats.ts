import { useQuery } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export interface DailyStats {
  date: string;        // '2026-05-15'
  dayOfWeek: string;   // 'пн'..'вс'
  revenue: number;
  expenses: number;
  net: number;
  orderCount: number;
  avgCheck: number;
}

async function fetchMonthlyStats(monthStart: string, monthEnd: string): Promise<DailyStats[]> {
  // Fetch paid orders for the month
  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount, opened_at')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', monthStart)
    .lt('opened_at', monthEnd)
    .order('opened_at');

  // Fetch expense transactions for the month
  const { data: txns } = await supabase
    .from('cash_transactions')
    .select('amount, transaction_at')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'expense')
    .gte('transaction_at', monthStart)
    .lt('transaction_at', monthEnd)
    .order('transaction_at');

  // Group by date
  const dayMap = new Map<string, { revenue: number; expenses: number; orderCount: number }>();

  for (const o of orders || []) {
    const dateKey = (o.opened_at as string).slice(0, 10);
    const entry = dayMap.get(dateKey) || { revenue: 0, expenses: 0, orderCount: 0 };
    entry.revenue += Number(o.total_amount) || 0;
    entry.orderCount += 1;
    dayMap.set(dateKey, entry);
  }

  for (const t of txns || []) {
    const dateKey = (t.transaction_at as string).slice(0, 10);
    const entry = dayMap.get(dateKey) || { revenue: 0, expenses: 0, orderCount: 0 };
    entry.expenses += Number(t.amount) || 0;
    dayMap.set(dateKey, entry);
  }

  // Generate all days in the range, fill missing with 0
  const days: DailyStats[] = [];
  const start = new Date(monthStart);
  const end = new Date(monthEnd);
  const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().slice(0, 10);
    const entry = dayMap.get(dateKey) || { revenue: 0, expenses: 0, orderCount: 0 };
    const net = entry.revenue - entry.expenses;
    days.push({
      date: dateKey,
      dayOfWeek: dayNames[d.getDay()],
      revenue: entry.revenue,
      expenses: entry.expenses,
      net,
      orderCount: entry.orderCount,
      avgCheck: entry.orderCount > 0 ? Math.round(entry.revenue / entry.orderCount) : 0,
    });
  }

  return days;
}

// ── Mock data for development (removed when real data exists) ──
const MOCK_MODE = true;

// Seeded PRNG so data is consistent between renders
function seededRandom(seed: number): number {
  let s = seed;
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

function generateMockMonthlyStats(monthStart: string, monthEnd: string): DailyStats[] {
  const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const days: DailyStats[] = [];
  const start = new Date(monthStart);
  const end = new Date(monthEnd);

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const dayNum = d.getDate();
    const dayOfWeek = d.getDay(); // 0=Sun
    const dateKey = d.toISOString().slice(0, 10);
    const seed = dayNum * 100 + dayOfWeek;

    const rand = (offset: number) => seededRandom(seed + offset * 31);

    // Base patterns by day type
    const isFriday = dayOfWeek === 5;
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    // Holidays & special days
    const isLaborDay = dayNum === 1;   // May 1 — busy holiday
    const isVictoryDay = dayNum === 9;  // May 9 — busy holiday
    const isHoliday = isLaborDay || isVictoryDay;

    // Base revenue for a Bishkek coffee shop (сом)
    let baseRevenue: number;
    if (isHoliday) {
      baseRevenue = 32000 + Math.round(rand(0) * 6000);
    } else if (isSaturday) {
      baseRevenue = 28000 + Math.round(rand(0) * 8000);
    } else if (isFriday) {
      baseRevenue = 22000 + Math.round(rand(0) * 6000);
    } else if (isSunday) {
      baseRevenue = 20000 + Math.round(rand(0) * 6000);
    } else {
      // Mon-Thu
      baseRevenue = 14000 + Math.round(rand(0) * 6000);
    }

    // Slight growth trend (+0.4% per day, spring → summer weather)
    const growthFactor = 1 + dayNum * 0.004;
    const revenue = Math.round(baseRevenue * growthFactor);

    // Expenses: 25-42% of revenue
    const expenseRatio = 0.25 + rand(1) * 0.17;
    // Delivery day spike every ~5 days
    const isDeliveryDay = dayNum % 5 === 0;
    const expenses = Math.round(revenue * expenseRatio * (isDeliveryDay ? 1.35 : 1));

    // Order count
    const avgCheckBase = 380 + Math.round(rand(2) * 180); // 380-560 som
    const orderCount = Math.round(revenue / avgCheckBase);

    const net = revenue - expenses;

    days.push({
      date: dateKey,
      dayOfWeek: dayNames[dayOfWeek],
      revenue,
      expenses,
      net,
      orderCount,
      avgCheck: Math.round(revenue / orderCount),
    });
  }

  return days;
}

export function useMonthlyStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return useQuery({
    queryKey: ['monthly_stats', VENUE_ID, monthStart.slice(0, 7)],
    queryFn: async () => {
      if (MOCK_MODE) return generateMockMonthlyStats(monthStart, monthEnd);
      const real = await fetchMonthlyStats(monthStart, monthEnd);
      // Fall back to mock if real data is empty
      return real.length > 0 ? real : generateMockMonthlyStats(monthStart, monthEnd);
    },
    staleTime: 60 * 1000,
  });
}
