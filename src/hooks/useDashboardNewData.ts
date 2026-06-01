import { useQuery } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';
import type { DashboardData, Metric, Alert, ChronologyEvent, WarehouseThreat, YesterdaySummary, TopDish, OperationalResult } from '@/types/dashboard';

// ── Helpers ──

function fmtSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
  };
}

function getYesterdayRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
  };
}

async function fetchDashboardNewData(): Promise<DashboardData> {
  const { start: todayStart, end: todayEnd } = getTodayRange();
  const { start: yesterdayStart, end: yesterdayEnd } = getYesterdayRange();

  // ── 1. Today's orders (paid) ──
  const { data: todayOrders, error: todayOrdersErr } = await supabase
    .from('orders')
    .select('id, total_amount, table_number')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', todayStart)
    .lt('opened_at', todayEnd);

  if (todayOrdersErr) console.warn('todayOrders error:', todayOrdersErr);

  const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const todayChecks = (todayOrders || []).length;

  // Guests: distinct tables served today (proxy)
  const tableSet = new Set((todayOrders || []).map((o) => o.table_number).filter(Boolean));
  const guests = tableSet.size > 0 ? tableSet.size * 2 : 0; // rough estimate: ~2 guests per table

  const todayOrderIds = (todayOrders || []).map((o) => o.id);

  // ── 2. Yesterday's orders ──
  const { data: yesterdayOrders, error: yesterdayOrdersErr } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', yesterdayStart)
    .lt('opened_at', yesterdayEnd);

  if (yesterdayOrdersErr) console.warn('yesterdayOrders error:', yesterdayOrdersErr);

  const yesterdayRevenue = (yesterdayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const yesterdayChecks = (yesterdayOrders || []).length;

  // ── 3. Active shift ──
  const { data: activeShift } = await supabase
    .from('shifts')
    .select('id, opened_at, expected_cash_at_close, starting_cash')
    .eq('venue_id', VENUE_ID)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cashInDrawer = activeShift
    ? (Number(activeShift.expected_cash_at_close) || Number(activeShift.starting_cash) || 0)
    : 0;

  const shiftOpenHours = activeShift?.opened_at
    ? (Date.now() - new Date(activeShift.opened_at).getTime()) / (1000 * 60 * 60)
    : 0;

  // ── 4. Yesterday's shift ──
  const { data: yesterdayShift } = await supabase
    .from('shifts')
    .select('id, closed_at, cash_difference_at_close, counted_cash, expected_cash_at_close, opened_at')
    .eq('venue_id', VENUE_ID)
    .gte('opened_at', yesterdayStart)
    .lt('opened_at', yesterdayEnd)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const yesterdayShiftClosed = yesterdayShift ? yesterdayShift.closed_at != null : null;
  const yesterdayCashDiff =
    yesterdayShift?.cash_difference_at_close != null
      ? Number(yesterdayShift.cash_difference_at_close)
      : null;

  // Determine yesterday status
  let yesterdayStatus: YesterdaySummary['status'] = 'unavailable';
  if (yesterdayOrders && yesterdayOrders.length > 0) {
    yesterdayStatus = 'normal';
  } else if (yesterdayShift) {
    // Shift existed but no orders — could be day off
    yesterdayStatus = 'dayoff';
  }

  // ── 5. Today's expenses ──
  const { data: todayExpenses } = await supabase
    .from('cash_movements')
    .select('amount')
    .eq('venue_id', VENUE_ID)
    .eq('movement_type', 'float_out')
    .gte('occurred_at', todayStart)
    .lt('occurred_at', todayEnd);

  const todayExpenseTotal = (todayExpenses || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // ── 6. Today's write-offs (approximate from items × product cost_price) ──
  // warehouse_write_off_items has no price column — skip monetary value for now
  const todayWriteOffTotal = 0;

  // ── 7. Low stock ──
  const { data: lowStock } = await supabase
    .from('products')
    .select('id, name, stock_quantity, unit')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'ingredient')
    .lt('stock_quantity', 10)
    .order('stock_quantity')
    .limit(6);

  // ── 8. Top dishes (today's order_items) ──
  let topDishes: TopDish[] = [];
  if (todayOrderIds.length > 0) {
    const { data: todayItems } = await supabase
      .from('order_items')
      .select('product_name, quantity, product_price')
      .in('order_id', todayOrderIds);

    const dishMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of todayItems || []) {
      const name = item.product_name as string;
      const qty = Number(item.quantity) || 1;
      const price = Number(item.product_price) || 0;
      const existing = dishMap.get(name) || { qty: 0, revenue: 0 };
      existing.qty += qty;
      existing.revenue += qty * price;
      dishMap.set(name, existing);
    }
    topDishes = Array.from(dishMap.entries())
      .map(([name, { qty, revenue }]) => ({ name, qty, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  // ── 9. Recent chronology events ──
  const chronology: ChronologyEvent[] = [];

  // 9a. Recent shift events
  if (activeShift) {
    chronology.push({
      id: `shift-${activeShift.id}`,
      time: new Date(activeShift.opened_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Система',
      action: 'Открыта смена',
      detail: `Старт: ${fmtSom(Number(activeShift.starting_cash) || 0)} сом`,
      actionLabel: null,
      actionHref: null,
      type: 'shift_open',
    });
  }

  // 9b. Recent cash transactions (last 8)
  const { data: recentTx } = await supabase
    .from('cash_movements')
    .select('id, movement_type, amount, note, occurred_at')
    .eq('venue_id', VENUE_ID)
    .order('occurred_at', { ascending: false })
    .limit(8);

  for (const tx of recentTx || []) {
    const txTime = new Date(tx.occurred_at as string);
    const txDate = txTime.toISOString().slice(0, 10);
    const todayDate = todayStart.slice(0, 10);
    if (txDate !== todayDate) continue; // only today's events

    const isFloatOut = (tx.movement_type as string) === 'float_out';
    chronology.push({
      id: `tx-${tx.id}`,
      time: txTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Кассир',
      action: isExpense ? 'Внёс расход' : 'Внёс приход',
      detail: `${tx.note || '—'}: ${fmtSom(Number(tx.amount) || 0)} сом`,
      actionLabel: 'Проверить',
      actionHref: '/transactions',
      type: isExpense ? 'expense' : 'expense', // both go to transactions
    });
  }

  // 9c. Recent deliveries (today)
  const { data: recentDeliveries } = await supabase
    .from('warehouse_deliveries')
    .select('id, supplier, amount, created_at')
    .eq('venue_id', VENUE_ID)
    .gte('created_at', todayStart)
    .lt('created_at', todayEnd)
    .order('created_at', { ascending: false })
    .limit(5);

  for (const del of recentDeliveries || []) {
    const delTime = new Date(del.created_at as string);
    chronology.push({
      id: `del-${del.id}`,
      time: delTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Кассир',
      action: 'Принял поставку',
      detail: `${del.supplier || 'Поставщик'}: ${fmtSom(Number(del.amount) || 0)} сом`,
      actionLabel: 'Оформить',
      actionHref: '/warehouse/deliveries',
      type: 'delivery',
    });
  }

  // 9d. Recent write-offs (today) — show name/reason since no price column
  const { data: recentWriteOffs } = await supabase
    .from('warehouse_write_offs')
    .select('id, reason_summary, created_at, warehouse_write_off_items(name, quantity, unit)')
    .eq('venue_id', VENUE_ID)
    .gte('created_at', todayStart)
    .lt('created_at', todayEnd)
    .order('created_at', { ascending: false })
    .limit(5);

  for (const wo of recentWriteOffs || []) {
    const woTime = new Date(wo.created_at as string);
    const items = wo.warehouse_write_off_items as { name: string; quantity: number; unit: string }[] | undefined;
    const firstItem = items?.[0];
    const desc = firstItem
      ? `${firstItem.name}: ${firstItem.quantity} ${firstItem.unit}`
      : (wo.reason_summary as string) || 'Списание';
    chronology.push({
      id: `wo-${wo.id}`,
      time: woTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Кассир',
      action: 'Списание',
      detail: desc,
      actionLabel: 'Проверить',
      actionHref: '/warehouse/write-offs',
      type: 'write_off',
    });
  }

  // Sort chronology by time descending (most recent first), then limit
  const sortedChronology = chronology
    .sort((a, b) => {
      const timeA = a.time.split(':').map(Number);
      const timeB = b.time.split(':').map(Number);
      if (timeA[0] !== timeB[0]) return timeB[0] - timeA[0];
      return timeB[1] - timeA[1];
    })
    .slice(0, 12);

  // ── 10. Warehouse threats ──
  const warehouseThreats: WarehouseThreat[] = (lowStock || []).map((p) => ({
    name: p.name as string,
    remaining: `${Number(p.stock_quantity) || 0} ${(p.unit as string) || 'кг'}`,
    daysLeft: null, // unknown until consumption tracking is implemented
    level: (Number(p.stock_quantity) || 0) <= 2 ? 'critical' as const : 'warning' as const,
    affectedDishes: [], // would need recipe_items join — not implemented yet
  }));

  // ── 11. Alerts ──
  const alerts: Alert[] = [];

  // 11a. Long-running shift
  if (shiftOpenHours > 12) {
    alerts.push({
      id: 'shift-long',
      type: 'critical',
      message: `Смена открыта ${Math.round(shiftOpenHours)} часов. Кассир не закрыл смену.`,
      actionLabel: 'Проверить смену →',
      actionHref: '/cash-shifts',
    });
  }

  // 11b. Stuck open orders
  const fifteenMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: stuckCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', VENUE_ID)
    .eq('status', 'open')
    .lt('opened_at', fifteenMinAgo);

  if (stuckCount && stuckCount > 0) {
    alerts.push({
      id: 'stuck-orders',
      type: 'critical',
      message: `${stuckCount} заказ(ов) висят больше 30 минут`,
      actionLabel: 'Посмотреть заказы →',
      actionHref: '/checks',
    });
  }

  // 11c. Low stock alert
  if (warehouseThreats.length > 0) {
    alerts.push({
      id: 'stock-low',
      type: warehouseThreats.some((t) => t.level === 'critical') ? 'critical' : 'warning',
      message: `${warehouseThreats.length} ингредиент(ов) на исходе`,
      actionLabel: 'К складу →',
      actionHref: '/warehouse/inventory',
    });
  }

  // 11d. Pending deliveries (today's deliveries — informational)
  if ((recentDeliveries || []).length > 0) {
    alerts.push({
      id: 'delivery-today',
      type: 'warning',
      message: `Сегодня ${recentDeliveries!.length} поставк(и/а). Проверьте оформление.`,
      actionLabel: 'К поставкам →',
      actionHref: '/warehouse/deliveries',
    });
  }

  // ── 12. Build metrics ──
  const yesterdayRevenueForTrend = yesterdayRevenue || 0;
  const yesterdayChecksForTrend = yesterdayChecks || 0;

  const avgCheck = todayChecks > 0 ? Math.round(todayRevenue / todayChecks) : 0;
  const yesterdayAvgCheck = yesterdayChecksForTrend > 0 ? Math.round(yesterdayRevenueForTrend / yesterdayChecksForTrend) : 0;

  const revenueTrend = yesterdayRevenueForTrend > 0
    ? Math.round(((todayRevenue - yesterdayRevenueForTrend) / yesterdayRevenueForTrend) * 100)
    : todayRevenue > 0 ? 100 : 0;

  const checksTrend = yesterdayChecksForTrend > 0
    ? Math.round(((todayChecks - yesterdayChecksForTrend) / yesterdayChecksForTrend) * 100)
    : todayChecks > 0 ? 100 : 0;

  const avgCheckTrend = yesterdayAvgCheck > 0
    ? Math.round(((avgCheck - yesterdayAvgCheck) / yesterdayAvgCheck) * 100)
    : avgCheck > 0 ? 100 : 0;

  const metrics: Metric[] = [
    {
      label: 'Выручка',
      value: todayRevenue,
      format: 'som',
      trend: { value: revenueTrend, prevPeriod: yesterdayRevenueForTrend },
    },
    {
      label: 'Чеков',
      value: todayChecks,
      format: 'count',
      trend: { value: checksTrend, prevPeriod: yesterdayChecksForTrend },
    },
    {
      label: 'Гостей',
      value: guests,
      format: 'count',
      trend: null,
    },
    {
      label: 'Средний чек',
      value: avgCheck,
      format: 'som',
      trend: { value: avgCheckTrend, prevPeriod: yesterdayAvgCheck },
    },
    {
      label: 'В кассе',
      value: cashInDrawer,
      format: 'som',
      trend: null,
      tooltip: 'стартовый остаток + наличные оплаты − наличные расходы',
    },
  ];

  // ── 13. Assemble ──
  const yesterday: YesterdaySummary = {
    revenue: yesterdayRevenue,
    checks: yesterdayChecks,
    shiftClosed: yesterdayShiftClosed,
    cashDifference: yesterdayCashDiff,
    status: yesterdayStatus,
  };

  const operationalResult: OperationalResult = {
    revenue: todayRevenue,
    expenses: todayExpenseTotal,
    writeOffs: todayWriteOffTotal,
    net: todayRevenue - todayExpenseTotal - todayWriteOffTotal,
  };

  return {
    metrics,
    alerts,
    chronology: sortedChronology,
    warehouseThreats,
    shiftStatus: {
      isOpen: !!activeShift,
      openedAt: activeShift?.opened_at
        ? new Date(activeShift.opened_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : null,
      hoursOpen: shiftOpenHours || null,
      cashier: null, // would need users join
    },
    yesterday,
    topDishes,
    operationalResult,
  };
}

export function useDashboardNewData() {
  return useQuery({
    queryKey: ['dashboard_new', VENUE_ID],
    queryFn: fetchDashboardNewData,
    staleTime: 30 * 1000, // 30s: operational data changes frequently
    refetchInterval: 60 * 1000, // auto-refresh every minute
  });
}
