/**
 * ═══ РЕАЛЬНОСТЬ ДАННЫХ (Δλ Шаг 1) ═══
 *
 * В кофейне Alto Coffee (Бишкек) бариста открывают смену, принимают заказы
 * от посетителей и готовят напитки по технологическим картам. Кассир фиксирует
 * приход и расход наличных. Кладовщик принимает поставки, списывает продукты,
 * проводит инвентаризации.
 *
 * Менеджер несколько раз в день открывает дашборд чтобы за 3 секунды понять:
 * всё ли в порядке? Если нет — какая конкретно проблема и что с ней делать?
 *
 * Частица данных: событие с денежным следом (заказ, кассовая операция,
 * складское движение). У каждого события: что, когда, сколько денег,
 * к какому домену относится (касса / склад / чеки).
 *
 * Три фазы дашборда:
 *   Фаза 1 (Импорт): миграционные карточки — провести за руку через чистку
 *   Фаза 2 (Чистка): алерты тают, прогресс виден
 *   Фаза 3 (Работа): спокойное состояние — выручка, хронология, нет красного
 *
 * Алерты группируются по ДОМЕНАМ (Склад / Касса / Чеки), не по severity.
 * Info-алерты (dead dishes, dead ingredients) — не daily, убраны.
 * Stock-алерты (negative/zero/low) объединены в один с раскрытием.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';
import type {
  DashboardData, Metric, Alert, AlertGroup, ChronologyEvent,
  WarehouseThreat, YesterdaySummary, TopDish,
  MigrationCard, NegativeStockItem,
} from '@/types/dashboard';
import { ALERT_GROUP_THRESHOLD } from '@/types/dashboard';

export type DashboardPeriod = 'today' | 'week' | 'month';

function fmtSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

const CASH_NOTE_LABELS: Record<string, string> = {
  payment_insert: 'Внесение наличных',
  float_in: 'Приход',
  float_out: 'Расход',
  sale: 'Продажа',
  refund: 'Возврат',
  opening_balance: 'Открытие смены',
  closing_balance: 'Закрытие смены',
};

function humanizeCashNote(note: string | null): string {
  if (!note) return 'Операция';
  const trimmed = note.trim();
  return CASH_NOTE_LABELS[trimmed] || trimmed.replace(/_/g, ' ');
}

function getPeriodRange(period: DashboardPeriod) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today':
      return { start: today.toISOString(), end: new Date(today.getTime() + 86400000).toISOString() };
    case 'week':
      return { start: new Date(today.getTime() - 7 * 86400000).toISOString(), end: new Date(today.getTime() + 86400000).toISOString() };
    case 'month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), end: new Date(today.getTime() + 86400000).toISOString() };
  }
}

function getPeriodLabel(period: DashboardPeriod): string {
  switch (period) {
    case 'today': return 'сегодня';
    case 'week': return 'неделю';
    case 'month': return 'месяц';
  }
}

/** Get baseline date from localStorage — problems before this date are hidden */
function getBaselineDate(): string | null {
  try {
    return localStorage.getItem('rkeeper_baseline_date');
  } catch {
    return null;
  }
}

/** Build migration cards when domains have >10 problems before baseline */
function buildMigrationCards(
  negativeStockCount: number,
  zeroStockCount: number,
  anomalousChecks: number,
  zeroAmountChecks: number,
  shiftsWithDiscrepancy: number,
): MigrationCard[] {
  const baseline = getBaselineDate();
  // If user already set a baseline, no migration cards needed
  if (baseline) return [];

  const cards: MigrationCard[] = [];
  const baselineDate = '2026-06-01'; // default boundary for imported Poster data

  // Warehouse migration — negative or zero stock in bulk
  const warehouseProblems = negativeStockCount + zeroStockCount;
  if (warehouseProblems >= 3) {
    cards.push({
      id: 'migrate-warehouse',
      domain: 'Склад',
      problemCount: warehouseProblems,
      problems: [
        ...(negativeStockCount > 0 ? [`${negativeStockCount} ингредиентов в минусе`] : []),
        ...(zeroStockCount > 0 ? [`${zeroStockCount} ингредиентов на нуле`] : []),
      ],
      contextMessage: 'Это нормально после импорта. Проведите инвентаризацию — она зафиксирует реальные остатки и снимет все алерты разом.',
      actionLabel: 'Начать инвентаризацию',
      actionHref: '/warehouse/inventory',
      actionType: 'inventory',
      baselineDate,
    });
  }

  // Checks migration — anomalous or zero-amount checks in bulk
  const checkProblems = anomalousChecks + zeroAmountChecks;
  if (checkProblems >= 5) {
    cards.push({
      id: 'migrate-checks',
      domain: 'Чеки',
      problemCount: checkProblems,
      problems: [
        ...(anomalousChecks > 0 ? [`${anomalousChecks} аномально больших чеков`] : []),
        ...(zeroAmountChecks > 0 ? [`${zeroAmountChecks} чеков с нулевой суммой`] : []),
      ],
      contextMessage: 'Импортированные чеки могут содержать ошибки. После проверки промаркируйте всё до 01.06.2026 — алерты по старым чекам уйдут.',
      actionLabel: 'Смотреть чеки',
      actionHref: '/checks',
      actionType: 'mark_checked',
      baselineDate,
    });
  }

  // Cash shifts migration
  if (shiftsWithDiscrepancy >= 3) {
    cards.push({
      id: 'migrate-cash',
      domain: 'Касса',
      problemCount: shiftsWithDiscrepancy,
      problems: [`${shiftsWithDiscrepancy} смен с расхождением`],
      contextMessage: 'Старые смены из Poster. Закройте период — все смены до 01.06.2026 будут заархивированы и не повлияют на текущие алерты.',
      actionLabel: 'Закрыть период до 01.06',
      actionHref: '/cash-shifts',
      actionType: 'close_period',
      baselineDate,
    });
  }

  return cards;
}

/** Group alerts by severity when there are many */
function groupAlerts(alerts: Alert[]): AlertGroup[] | null {
  if (alerts.length <= ALERT_GROUP_THRESHOLD) return null;

  const critical = alerts.filter(a => a.type === 'critical');
  const warning = alerts.filter(a => a.type === 'warning');
  const info = alerts.filter(a => a.type === 'info');

  const groups: AlertGroup[] = [];
  if (critical.length > 0) {
    groups.push({
      severity: 'critical',
      label: `КРИТИЧЕСКОЕ (${critical.length})`,
      alerts: critical,
      defaultExpanded: true,
    });
  }
  if (warning.length > 0) {
    groups.push({
      severity: 'warning',
      label: `ПРЕДУПРЕЖДЕНИЯ (${warning.length})`,
      alerts: warning,
      defaultExpanded: false,
    });
  }
  if (info.length > 0) {
    groups.push({
      severity: 'info',
      label: `ИНФОРМАЦИЯ (${info.length})`,
      alerts: info,
      defaultExpanded: false,
    });
  }
  return groups.length > 0 ? groups : null;
}

async function fetchDashboardNewData(period: DashboardPeriod = 'today'): Promise<DashboardData> {
  const { start, end } = getPeriodRange(period);
  const baseline = getBaselineDate();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000).toISOString();
  const yesterdayEnd = todayStart.toISOString();

  // ═══ TODAY ═══
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('id, total_amount, table_number, status, opened_at')
    .eq('venue_id', VENUE_ID)
    .in('status', ['paid', 'active', 'alert'])
    .gte('opened_at', todayStart.toISOString())
    .lt('opened_at', new Date(todayStart.getTime() + 86400000).toISOString());

  const paidToday = (todayOrders || []).filter(o => o.status === 'paid');
  const openToday = (todayOrders || []).filter(o => o.status === 'active' || o.status === 'alert');

  // All open orders (not just today — operational metric)
  const { count: openNowCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', VENUE_ID)
    .in('status', ['active', 'alert']);
  const openNow = openNowCount ?? openToday.length;

  const todayRevenue = paidToday.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const todayChecks = paidToday.length;

  const todayOrderIds = paidToday.map(o => o.id);

  // ═══ FALLBACK: last 7 days (for empty today state) ═══
  const weekAgo = new Date(todayStart.getTime() - 7 * 86400000).toISOString();
  const { data: weekOrders } = await supabase
    .from('orders')
    .select('id, total_amount, opened_at')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', weekAgo)
    .lt('opened_at', new Date(todayStart.getTime() + 86400000).toISOString());

  const weekRevenue = (weekOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const weekChecks = (weekOrders || []).length;

  // ═══ YESTERDAY ═══
  const { data: yesterdayOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', yesterdayStart)
    .lt('opened_at', yesterdayEnd);

  const yesterdayRevenue = (yesterdayOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const yesterdayChecks = (yesterdayOrders || []).length;

  // ═══ PERIOD (for week/month view) ═══
  let periodRevenue = todayRevenue;
  let periodChecks = todayChecks;
  let periodOrderIds = todayOrderIds;

  if (period !== 'today') {
    const { data: periodOrders } = await supabase
      .from('orders')
      .select('id, total_amount')
      .eq('venue_id', VENUE_ID)
      .eq('status', 'paid')
      .gte('opened_at', start)
      .lt('opened_at', end);

    periodRevenue = (periodOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    periodChecks = (periodOrders || []).length;
    periodOrderIds = (periodOrders || []).map(o => o.id);
  }

  // Previous period for trend
  const prevStart = period === 'today' ? yesterdayStart : period === 'week'
    ? new Date(todayStart.getTime() - 14 * 86400000).toISOString()
    : new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1).toISOString();
  const prevEnd = period === 'today' ? yesterdayEnd : period === 'week'
    ? new Date(todayStart.getTime() - 7 * 86400000).toISOString()
    : new Date(todayStart.getFullYear(), todayStart.getMonth(), 1).toISOString();

  const { data: prevOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', prevStart)
    .lt('opened_at', prevEnd);

  const prevRevenue = (prevOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const prevChecks = (prevOrders || []).length;

  // ═══ ACTIVE SHIFT ═══
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

  // ═══ TODAY EXPENSES ═══
  const { data: todayExpenses } = await supabase
    .from('cash_movements')
    .select('amount')
    .eq('venue_id', VENUE_ID)
    .eq('movement_type', 'float_out')
    .gte('occurred_at', todayStart.toISOString())
    .lt('occurred_at', new Date(todayStart.getTime() + 86400000).toISOString());

  const todayExpenseTotal = (todayExpenses || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // ═══ PERIOD EXPENSES (для всех периодов, не только today) ═══
  let periodExpenseTotal = todayExpenseTotal;
  if (period !== 'today') {
    const { data: periodExps } = await supabase
      .from('cash_movements')
      .select('amount')
      .eq('venue_id', VENUE_ID)
      .eq('movement_type', 'float_out')
      .gte('occurred_at', start)
      .lt('occurred_at', end);
    periodExpenseTotal = (periodExps || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }

  // ═══ STOCK THREATS (with negative detection) ═══
  const { data: lowStockItems } = await supabase
    .from('stock_items')
    .select('product_id, quantity, unit, warehouse_id, warehouses(name)')
    .lt('quantity', 10)
    .order('quantity')
    .limit(15);

  // Also check for negative stock
  const { data: negativeStockItems } = await supabase
    .from('stock_items')
    .select('product_id, quantity, unit, warehouse_id, warehouses(name)')
    .lt('quantity', 0)
    .order('quantity')
    .limit(10);

  const allLowItems = [...(lowStockItems || []), ...(negativeStockItems || [])];
  const uniqueLowIds = [...new Set(allLowItems.map(s => s.product_id))];

  let productNames: Record<string, { name: string; unit: string }> = {};
  if (uniqueLowIds.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, unit')
      .in('id', uniqueLowIds);
    for (const p of prods || []) {
      productNames[p.id as string] = { name: p.name as string, unit: (p.unit as string) || 'кг' };
    }
  }

  function _whName(s: any): string | null {
    const w = s.warehouses;
    if (!w) return null;
    if (Array.isArray(w)) return w[0]?.name || null;
    return (w as any).name || null;
  }

  /** Query with .in() on a large ID array — chunks to avoid Supabase/postgREST limits */
  async function chunkedInQuery<T extends Record<string, any>>(
    table: string,
    columns: string,
    ids: string[],
    idColumn: string,
    extraFilter?: (q: any) => any,
  ): Promise<T[]> {
    const CHUNK = 200;
    const results: T[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      let query = supabase.from(table).select(columns).in(idColumn, chunk);
      if (extraFilter) query = extraFilter(query);
      const { data, error } = await query;
      if (error) {
        console.error(`chunkedInQuery ${table} chunk ${i}:`, error.message);
        continue;
      }
      if (data) results.push(...(data as T[]));
    }
    return results;
  }

  const warehouseThreats: WarehouseThreat[] = allLowItems.map(s => {
    const info = productNames[s.product_id as string];
    const qty = Number(s.quantity) || 0;
    const unit = info?.unit || (s.unit as string) || 'кг';
    const isNegative = qty < 0;
    return {
      name: info?.name || (s.product_id as string).slice(0, 8),
      remaining: `${qty} ${unit}`,
      daysLeft: null,
      level: (isNegative || qty <= 0 ? 'critical' : 'warning') as 'critical' | 'warning',
      affectedDishes: [],
      warehouseName: _whName(s),
      negative: isNegative,
      lastDelivery: null, // filled below
    };
  });

  // ═══ LAST DELIVERY per product ═══
  const threatProductIds = [...new Set(allLowItems.map(s => s.product_id as string))];
  // Build name → product_id map for reliable matching
  const nameToId = new Map<string, string>();
  for (const s of allLowItems) {
    const info = productNames[s.product_id as string];
    if (info) nameToId.set(info.name, s.product_id as string);
  }
  if (threatProductIds.length > 0) {
    const { data: lastDeliveries, error: _ldErr } = await supabase
      .from('warehouse_delivery_items')
      .select('product_id, quantity, unit, delivery:delivery_id(created_at, supplier)')
      .in('product_id', threatProductIds)
      .order('delivery_id', { ascending: false })
      .limit(500);

    if (lastDeliveries && !_ldErr) {
      const latestByProduct = new Map<string, { date: string; qty: number; unit: string }>();
      for (const d of lastDeliveries as any[]) {
        const pid = d.product_id as string;
        if (latestByProduct.has(pid)) continue;
        const delivery = d.delivery;
        const dateStr = delivery?.created_at
          ? new Date(delivery.created_at as string).toLocaleString('ru-RU', { day: 'numeric', month: 'short' })
          : null;
        if (dateStr) {
          latestByProduct.set(pid, {
            date: dateStr,
            qty: Number(d.quantity) || 0,
            unit: (d.unit as string) || 'кг',
          });
        }
      }
      for (const t of warehouseThreats) {
        const prodId = nameToId.get(t.name);
        if (!prodId) continue;
        const ld = latestByProduct.get(prodId);
        if (ld) {
          t.lastDelivery = `${ld.date}, ${ld.qty} ${ld.unit}`;
        }
      }
    }
  }

  const negativeCount = warehouseThreats.filter(t => t.negative).length;
  const zeroCount = warehouseThreats.filter(t => t.level === 'critical' && !t.negative).length;
  const lowOnly = warehouseThreats.filter(t => !t.negative && Number.parseFloat(t.remaining) > 0);

  // ═══ NEGATIVE STOCK ITEMS (raw data for inline correction) ═══
  const negativeStockForCorrection: NegativeStockItem[] = (negativeStockItems || []).map(s => {
    const info = productNames[s.product_id as string];
    return {
      productId: s.product_id as string,
      productName: info?.name || (s.product_id as string).slice(0, 8),
      quantity: Number(s.quantity) || 0,
      unit: info?.unit || (s.unit as string) || 'кг',
      warehouseId: s.warehouse_id as string,
      warehouseName: _whName(s),
    };
  });

  // ═══ TOP DISHES (for food cost KPI — period-based) ═══
  let periodTopDishes: TopDish[] = [];

  const topDishSourceIds = period === 'today' && todayOrderIds.length > 0
    ? todayOrderIds
    : periodOrderIds.length > 0
      ? periodOrderIds
      : (weekOrders || []).map((o: any) => o.id);

  // Map dish product_id → { name, total qty, total revenue }
  const dishMap = new Map<string, { name: string; qty: number; revenue: number }>();

  if (topDishSourceIds.length > 0) {
    const items = await chunkedInQuery<{ product_id: string; product_name: string; quantity: number; product_price: number }>(
      'order_items',
      'product_id, product_name, quantity, product_price',
      topDishSourceIds,
      'order_id',
    );

    for (const item of items || []) {
      const pid = item.product_id as string;
      const qty = Number(item.quantity) || 1;
      const price = Number(item.product_price) || 0;
      const existing = dishMap.get(pid) || { name: item.product_name as string, qty: 0, revenue: 0 };
      existing.qty += qty;
      existing.revenue += qty * price;
      dishMap.set(pid, existing);
    }
  }

  // Compute ingredient cost per dish from recipe_items × products.cost_price
  const dishIds = [...dishMap.keys()];
  const costByDishId = new Map<string, number>();

  if (dishIds.length > 0) {
    const { data: recipes } = await supabase
      .from('recipe_items')
      .select('product_id, ingredient_id, quantity, unit')
      .in('product_id', dishIds);

    if (recipes && recipes.length > 0) {
      const ingredientIds = [...new Set(recipes.map(r => r.ingredient_id as string))];
      const { data: ingredients } = await supabase
        .from('products')
        .select('id, cost_price, unit')
        .in('id', ingredientIds);

      const costByIngredient = new Map<string, number>();
      const unitByIngredient = new Map<string, string>();
      for (const ing of ingredients || []) {
        costByIngredient.set(ing.id as string, Number(ing.cost_price) || 0);
        unitByIngredient.set(ing.id as string, (ing.unit as string) || 'кг');
      }

      /** Convert recipe quantity to match cost_price unit basis */
      const unitFactor = (recipeUnit: string, ingredientUnit: string): number => {
        const ru = (recipeUnit || 'г').toLowerCase();
        const iu = (ingredientUnit || '').toLowerCase();
        // If ingredient is priced per kg but recipe uses grams
        if ((ru === 'г' || ru === 'мл') && (iu === 'кг' || iu === 'л')) return 1 / 1000;
        // Same unit or unknown — no conversion
        return 1;
      };

      for (const r of recipes) {
        const dishId = r.product_id as string;
        const ingId = r.ingredient_id as string;
        const ingCost = (costByIngredient.get(ingId) || 0) / 100; // kopecks → som
        const ingUnit = unitByIngredient.get(ingId) || 'кг';
        const recipeUnit = (r.unit as string) || 'г';
        const perPortionQty = Number(r.quantity) || 0;
        const totalSold = dishMap.get(dishId)?.qty || 0;
        const factor = unitFactor(recipeUnit, ingUnit);
        const ingredientTotalCost = perPortionQty * ingCost * factor * totalSold;
        costByDishId.set(dishId, (costByDishId.get(dishId) || 0) + ingredientTotalCost);
      }
    }
  }

  periodTopDishes = Array.from(dishMap.entries())
    .map(([id, { name, qty, revenue }]) => {
      const cost = costByDishId.get(id) || 0;
      return { name, qty, revenue, cost, margin: revenue - cost };
    })
    .sort((a, b) => b.margin - a.margin);

  // Total food cost for the period (from period-based dishes)
  const totalFoodCost = periodTopDishes.reduce((sum, d) => sum + d.cost, 0);

  // ═══ TOP DISHES — всегда за месяц (для показа) ═══
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1).toISOString();
  const monthEnd = new Date(todayStart.getTime() + 86400000).toISOString();

  const { data: monthOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', monthStart)
    .lt('opened_at', monthEnd);

  const monthOrderIds = (monthOrders || []).map((o: any) => o.id);
  const monthDishMap = new Map<string, { name: string; qty: number; revenue: number }>();

  if (monthOrderIds.length > 0) {
    const monthItems = await chunkedInQuery<{ product_id: string; product_name: string; quantity: number; product_price: number }>(
      'order_items',
      'product_id, product_name, quantity, product_price',
      monthOrderIds,
      'order_id',
    );

    for (const item of monthItems || []) {
      const pid = item.product_id as string;
      const qty = Number(item.quantity) || 1;
      const price = Number(item.product_price) || 0;
      const existing = monthDishMap.get(pid) || { name: item.product_name as string, qty: 0, revenue: 0 };
      existing.qty += qty;
      existing.revenue += qty * price;
      monthDishMap.set(pid, existing);
    }
  }

  // Compute ingredient cost for month dishes
  const monthDishIds = [...monthDishMap.keys()];
  const monthCostByDishId = new Map<string, number>();

  if (monthDishIds.length > 0) {
    const { data: monthRecipes } = await supabase
      .from('recipe_items')
      .select('product_id, ingredient_id, quantity, unit')
      .in('product_id', monthDishIds);

    if (monthRecipes && monthRecipes.length > 0) {
      const ingredientIds = [...new Set(monthRecipes.map(r => r.ingredient_id as string))];
      const { data: monthIngredients } = await supabase
        .from('products')
        .select('id, cost_price, unit')
        .in('id', ingredientIds);

      const costByIngredient = new Map<string, number>();
      const unitByIngredient = new Map<string, string>();
      for (const ing of monthIngredients || []) {
        costByIngredient.set(ing.id as string, Number(ing.cost_price) || 0);
        unitByIngredient.set(ing.id as string, (ing.unit as string) || 'кг');
      }

      const unitFactor = (recipeUnit: string, ingredientUnit: string): number => {
        const ru = (recipeUnit || 'г').toLowerCase();
        const iu = (ingredientUnit || '').toLowerCase();
        if ((ru === 'г' || ru === 'мл') && (iu === 'кг' || iu === 'л')) return 1 / 1000;
        return 1;
      };

      for (const r of monthRecipes) {
        const dishId = r.product_id as string;
        const ingId = r.ingredient_id as string;
        const ingCost = (costByIngredient.get(ingId) || 0) / 100;
        const ingUnit = unitByIngredient.get(ingId) || 'кг';
        const recipeUnit = (r.unit as string) || 'г';
        const perPortionQty = Number(r.quantity) || 0;
        const totalSold = monthDishMap.get(dishId)?.qty || 0;
        const factor = unitFactor(recipeUnit, ingUnit);
        const ingredientTotalCost = perPortionQty * ingCost * factor * totalSold;
        monthCostByDishId.set(dishId, (monthCostByDishId.get(dishId) || 0) + ingredientTotalCost);
      }
    }
  }

  const topDishesMonth: TopDish[] = Array.from(monthDishMap.entries())
    .map(([id, { name, qty, revenue }]) => {
      const cost = monthCostByDishId.get(id) || 0;
      return { name, qty, revenue, cost, margin: revenue - cost };
    })
    .sort((a, b) => b.margin - a.margin);

  const antiTopMonth = topDishesMonth
    .filter(d => d.margin <= 0 || (d.revenue > 0 && d.margin / d.revenue < 0.05))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 3);

  // ═══ CHRONOLOGY — всегда сегодня (не зависит от периода) ═══
  const chronology: ChronologyEvent[] = [];
  const chronoStart = todayStart.toISOString();
  const chronoEnd = new Date(todayStart.getTime() + 86400000).toISOString();

  // Cash transactions (expenses + deposits)
  const { data: recentTx } = await supabase
    .from('cash_movements')
    .select('id, movement_type, amount, note, occurred_at')
    .eq('venue_id', VENUE_ID)
    .gte('occurred_at', chronoStart)
    .lt('occurred_at', chronoEnd)
    .order('occurred_at', { ascending: false })
    .limit(6);

  for (const tx of recentTx || []) {
    const txTime = new Date(tx.occurred_at as string);
    const isFloatOut = (tx.movement_type as string) === 'float_out';
    const note = humanizeCashNote(tx.note as string | null);
    chronology.push({
      id: `tx-${tx.id}`,
      time: txTime.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Кассир',
      action: isFloatOut ? 'Расход' : 'Приход',
      detail: `${note}: ${fmtSom(Number(tx.amount) || 0)} сом`,
      actionLabel: 'Касса',
      actionHref: '/transactions',
      type: 'expense',
    });
  }

  // Deliveries
  const { data: recentDeliveries } = await supabase
    .from('warehouse_deliveries')
    .select('id, supplier, amount, created_at')
    .eq('venue_id', VENUE_ID)
    .gte('created_at', chronoStart)
    .lt('created_at', chronoEnd)
    .order('created_at', { ascending: false })
    .limit(4);

  for (const del of recentDeliveries || []) {
    chronology.push({
      id: `del-${del.id}`,
      time: new Date(del.created_at as string).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Склад',
      action: 'Поставка',
      detail: `${del.supplier || 'Поставщик'}: ${fmtSom(Number(del.amount) || 0)} сом`,
      actionLabel: 'Склад',
      actionHref: '/warehouse/operations',
      type: 'delivery',
    });
  }

  // Write-offs
  const { data: recentWriteOffs } = await supabase
    .from('warehouse_write_offs')
    .select('id, reason_summary, created_at, warehouse_write_off_items(name, quantity, unit)')
    .eq('venue_id', VENUE_ID)
    .gte('created_at', chronoStart)
    .lt('created_at', chronoEnd)
    .order('created_at', { ascending: false })
    .limit(4);

  for (const wo of recentWriteOffs || []) {
    const items = wo.warehouse_write_off_items as { name: string; quantity: number; unit: string }[] | undefined;
    const firstItem = items?.[0];
    const desc = firstItem ? `${firstItem.name}: ${firstItem.quantity} ${firstItem.unit}` : (wo.reason_summary as string) || 'Списание';
    chronology.push({
      id: `wo-${wo.id}`,
      time: new Date(wo.created_at as string).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Склад',
      action: 'Списание',
      detail: desc,
      actionLabel: 'Склад',
      actionHref: '/warehouse/operations',
      type: 'write_off',
    });
  }

  const sortedChronology = chronology
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 12);

  // Prepend shift status as first chronology event
  if (activeShift) {
    const hoursText = shiftOpenHours >= 1
      ? `${Math.round(shiftOpenHours)} ч`
      : `${Math.round(shiftOpenHours * 60)} мин`;
    sortedChronology.unshift({
      id: 'shift-status',
      time: new Date(activeShift.opened_at as string).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      actor: 'Смена',
      action: `Открыта · ${hoursText}`,
      detail: null,
      type: 'shift_open',
    });
  }

  // ═══ ALERTS ═══
  // Grouped by DOMAIN (Склад / Касса / Чеки), not by severity.
  // Info-level alerts (dead dishes, dead ingredients) — removed from daily dashboard.
  // Stock alerts (negative/zero/low) merged into ONE grouped alert.
  const alerts: Alert[] = [];

  // Helper: only add alert if it's after baseline date
  const afterBaseline = (dateStr: string) => {
    if (!baseline) return true; // no baseline — show everything
    return dateStr >= baseline;
  };

  // ═══ WAREHOUSE DOMAIN ═══

  // Stock — one alert summarizing all issues (negative + zero + low)
  const totalStockProblems = negativeCount + zeroCount + lowOnly.length;
  if (totalStockProblems > 0) {
    const parts: string[] = [];
    if (negativeCount > 0) parts.push(`${negativeCount} в минусе`);
    if (zeroCount > 0) parts.push(`${zeroCount} на нуле`);
    if (lowOnly.length > 0) parts.push(`${lowOnly.length} на исходе`);
    const worstType = negativeCount > 0 ? 'critical' : 'warning';
    alerts.push({
      id: 'stock',
      type: worstType,
      message: `Остатки: ${parts.join(', ')}`,
      actionLabel: 'Исправить →',
      actionHref: '/warehouse',
      domain: 'warehouse',
    });
  }

  // No inventory
  const { data: lastInventory } = await supabase
    .from('warehouse_inventory_sessions')
    .select('conducted_at')
    .eq('venue_id', VENUE_ID)
    .order('conducted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const daysSinceInventory = lastInventory?.conducted_at
    ? Math.floor((Date.now() - new Date(lastInventory.conducted_at as string).getTime()) / 86400000)
    : null;

  if (daysSinceInventory === null) {
    alerts.push({
      id: 'no-inventory',
      type: 'warning',
      message: 'Инвентаризация ни разу не проводилась',
      actionLabel: 'Начать →',
      actionHref: '/warehouse/inventory',
      domain: 'warehouse',
    });
  } else if (daysSinceInventory > 30) {
    alerts.push({
      id: 'stale-inventory',
      type: 'warning',
      message: `Последняя инвентаризация ${daysSinceInventory} дн. назад`,
      actionLabel: 'Начать →',
      actionHref: '/warehouse/inventory',
      domain: 'warehouse',
    });
  }

  // ═══ CHECKS DOMAIN ═══

  // Stuck orders (>60 min)
  const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: stuckCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', VENUE_ID)
    .eq('status', 'active')
    .lt('opened_at', sixtyMinAgo);

  if (stuckCount && stuckCount > 0 && stuckCount <= 20) {
    alerts.push({
      id: 'stuck-orders',
      type: stuckCount > 5 ? 'critical' : 'warning',
      message: `${stuckCount} заказ${stuckCount === 1 ? '' : stuckCount < 5 ? 'а' : 'ов'} висит больше 1 ч`,
      actionLabel: 'Проверить →',
      actionHref: '/checks',
      domain: 'checks',
    });
  }

  // ═══ CASH DOMAIN ═══

  // Long shift (>14h)
  if (shiftOpenHours > 14) {
    alerts.push({
      id: 'shift-long',
      type: 'info',
      message: `Смена открыта ${Math.round(shiftOpenHours)} ч. Попросите кассира закрыть.`,
      actionLabel: null,
      actionHref: null,
      domain: 'cash',
    });
  }

  // Expenses without description
  const { data: blankExpenses } = await supabase
    .from('cash_movements')
    .select('id')
    .eq('venue_id', VENUE_ID)
    .eq('movement_type', 'float_out')
    .or('note.is.null,note.eq.')
    .gte('occurred_at', chronoStart)
    .lt('occurred_at', chronoEnd);

  const blankExpenseCount = (blankExpenses || []).length;
  if (blankExpenseCount > 0) {
    alerts.push({
      id: 'blank-expense',
      type: 'warning',
      message: `${blankExpenseCount} расходов без описания`,
      actionLabel: 'Добавить описание →',
      actionHref: '/transactions',
      domain: 'cash',
    });
  }

  // ═══ SUSPICIOUS CHECKS (paid << sum of item_added, via order_events) ═══
  if (paidToday.length > 0) {
    const paidOrderIds = paidToday.map(o => o.id);
    const addedEvents = await chunkedInQuery<{ order_id: string; quantity: number; unit_price: number }>(
      'order_events',
      'order_id, quantity, unit_price',
      paidOrderIds,
      'order_id',
      (q) => q.eq('action', 'item_added'),
    );

    if (addedEvents && addedEvents.length > 0) {
      const addedByOrder = new Map<string, number>();
      for (const e of addedEvents as any[]) {
        const amt = (Number(e.quantity) || 1) * (Number(e.unit_price) || 0);
        addedByOrder.set(e.order_id, (addedByOrder.get(e.order_id) || 0) + amt);
      }

      for (const o of paidToday) {
        const addedTotal = addedByOrder.get(o.id);
        const paidTotal = Number(o.total_amount) || 0;
        if (addedTotal && addedTotal > 200 && paidTotal < addedTotal * 0.2) {
          alerts.push({
            id: `suspicious-check-${o.id}`,
            type: 'warning',
            message: `Чек ...${o.id.slice(-6)}: оплачено ${fmtSom(paidTotal)} из ${fmtSom(Math.round(addedTotal))}`,
            actionLabel: 'Проверить чек →',
            actionHref: `/checks`,
            domain: 'checks',
          });
        }
      }
    }
  }

  // Many refunds today
  const refundCount = paidToday.filter(o => Number(o.total_amount) < 0).length;
  if (refundCount >= 3) {
    alerts.push({
      id: 'many-refunds',
      type: 'warning',
      message: `${refundCount} возвратов за смену`,
      actionLabel: 'Проверить →',
      actionHref: '/checks',
      domain: 'checks',
    });
  }

  // ═══ SHIFT DISCREPANCY (>5% of revenue AND >200 som) ═══
  // Get closed shifts with cash_difference_at_close, sorted by most recent
  const { data: closedShifts } = await supabase
    .from('shifts')
    .select('id, opened_at, closed_at, cash_difference_at_close')
    .eq('venue_id', VENUE_ID)
    .not('closed_at', 'is', null)
    .not('cash_difference_at_close', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(10);

  const shiftsWithDiscrepancy = (closedShifts || []).filter(
    (s: any) => Math.abs(Number(s.cash_difference_at_close) || 0) > 200
  ).length;

  // Check each closed shift for proportional discrepancy
  for (const shift of (closedShifts || [])) {
    const diff = Math.abs(Number(shift.cash_difference_at_close) || 0);
    if (diff <= 200) continue;
    // Calculate shift revenue from paid orders during shift period
    const { data: shiftOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('venue_id', VENUE_ID)
      .eq('status', 'paid')
      .gte('opened_at', shift.opened_at)
      .lte('opened_at', shift.closed_at);
    const shiftRevenue = (shiftOrders || []).reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    if (shiftRevenue > 0 && diff > shiftRevenue * 0.05) {
      if (afterBaseline(shift.closed_at as string)) {
        alerts.push({
          id: `shift-discrepancy-${shift.id}`,
          type: 'critical',
          message: `Расхождение ${fmtSom(diff)} сом (${Math.round(diff / shiftRevenue * 100)}% от выручки)`,
          actionLabel: 'Проверить смену →',
          actionHref: `/cash-shifts?shift=${shift.id}`,
          domain: 'cash',
        });
        break; // Only show the most recent one
      }
    }
  }

  // ═══ STAFF RETURN RATE (anomalous vs restaurant avg) ═══
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: allPaidOrders } = await supabase
    .from('orders')
    .select('id, total_amount, waiter_id')
    .eq('venue_id', VENUE_ID)
    .eq('status', 'paid')
    .gte('opened_at', fourteenDaysAgo)
    .limit(500);

  if (allPaidOrders && allPaidOrders.length > 20) {
    const staffStats = new Map<string, { name: string; total: number; refunds: number }>();
    for (const o of allPaidOrders as any[]) {
      const sid = o.waiter_id;
      if (!sid) continue;
      const existing = staffStats.get(sid) || { name: sid.slice(0, 8), total: 0, refunds: 0 };
      existing.total++;
      if (Number(o.total_amount) < 0) existing.refunds++;
      staffStats.set(sid, existing);
    }

    // Calculate restaurant average refund rate
    let totalAll = 0, refundsAll = 0;
    for (const s of staffStats.values()) { totalAll += s.total; refundsAll += s.refunds; }
    const avgRate = totalAll > 0 ? refundsAll / totalAll : 0;

    for (const [sid, stats] of staffStats) {
      if (stats.total < 5) continue;
      const rate = stats.refunds / stats.total;
      if (stats.refunds >= 3 && rate > avgRate * 2 && avgRate > 0) {
        alerts.push({
          id: `staff-refunds-${sid}`,
          type: 'warning',
          message: `${stats.name}: ${Math.round(rate * 100)}% возвратов (среднее ${Math.round(avgRate * 100)}%)`,
          actionLabel: 'Проверить официанта →',
          actionHref: `/checks`,
          domain: 'staff',
        });
      }
    }
  }

  // ═══ ANOMALOUS DELIVERIES (qty > 3x avg, min 3 past deliveries) ═══
  const { data: deliveryItems } = await supabase
    .from('warehouse_delivery_items')
    .select('product_id, quantity, delivery_id, delivery:delivery_id(created_at)')
    .limit(500);

  if (deliveryItems && deliveryItems.length > 0) {
    // Sort by delivery created_at descending (newest first)
    const sorted = [...(deliveryItems as any[])].sort((a, b) => {
      const aDate = a.delivery?.created_at || '';
      const bDate = b.delivery?.created_at || '';
      return bDate.localeCompare(aDate);
    });

    const byProduct = new Map<string, number[]>();
    for (const item of sorted) {
      if (!item.product_id) continue;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      const arr = byProduct.get(item.product_id) || [];
      arr.push(qty);
      byProduct.set(item.product_id, arr);
    }

    for (const [productId, quantities] of byProduct) {
      if (quantities.length < 4) continue;
      const latest = quantities[0];
      const past = quantities.slice(1);
      const avg = past.reduce((s, q) => s + q, 0) / past.length;
      if (avg > 0 && latest > avg * 3) {
        const { data: prodInfo } = await supabase
          .from('products')
          .select('name, unit')
          .eq('id', productId)
          .single();
        const name = prodInfo?.name || productId.slice(0, 8);
        const unit = prodInfo?.unit || 'кг';
        alerts.push({
          id: `anomaly-delivery-${productId}`,
          type: 'warning',
          message: `${name}: ${latest} ${unit} (обычно ${Math.round(avg)} ${unit})`,
          actionLabel: 'Проверить →',
          actionHref: '/warehouse/operations?type=delivery',
          domain: 'warehouse',
        });
      }
    }
  }

  // ═══ MIGRATION CARDS ═══
  const migrationCards = buildMigrationCards(
    negativeCount,
    zeroCount,
    0, // anomalousChecks — removed detector
    0, // zeroAmountChecks — removed detector (100% discount = breakfast)
    shiftsWithDiscrepancy,
  );

  // ═══ ALERT GROUPING ═══
  const alertGroups = groupAlerts(alerts);
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const totalAlertCount = alerts.length;

  // ═══ METRICS ═══
  const displayRevenue = period === 'today' ? todayRevenue : periodRevenue;
  const displayChecks = period === 'today' ? todayChecks : periodChecks;
  const avgCheckRounded = displayChecks > 0 ? Math.round(displayRevenue / displayChecks) : 0;
  const prevAvgCheck = prevChecks > 0 ? Math.round(prevRevenue / prevChecks) : 0;

  const revenueTrend = prevRevenue > 0 ? Math.round(((displayRevenue - prevRevenue) / prevRevenue) * 100) : displayRevenue > 0 ? 100 : 0;
  const avgCheckTrend = prevAvgCheck > 0 ? Math.round(((avgCheckRounded - prevAvgCheck) / prevAvgCheck) * 100) : avgCheckRounded > 0 ? 100 : 0;

  const prevLabel = period === 'today' ? 'вчера' : period === 'week' ? 'прошл. нед.' : 'прошл. мес.';
  const isTodayEmpty = period === 'today' && todayChecks === 0;

  const foodCostPercent = displayRevenue > 0 ? Math.round((totalFoodCost / displayRevenue) * 100) : 0;

  const metrics: Metric[] = [
    {
      label: 'Выручка',
      value: displayRevenue,
      format: 'som',
      trend: isTodayEmpty ? null : { value: revenueTrend, prevPeriod: prevRevenue },
      tooltip: isTodayEmpty && yesterdayRevenue > 0
        ? `Заказов сегодня нет. Вчера: ${fmtSom(yesterdayRevenue)} сом`
        : `vs ${prevLabel}: ${fmtSom(prevRevenue)} сом`,
    },
    {
      label: 'Себестоимость',
      value: Math.round(totalFoodCost),
      format: 'som',
      trend: null,
      tooltip: totalFoodCost > 0
        ? `Фудкост ${foodCostPercent}% от выручки`
        : 'Нет данных о себестоимости',
    },
    {
      label: 'Средний чек',
      value: avgCheckRounded,
      format: 'som',
      trend: isTodayEmpty ? null : { value: avgCheckTrend, prevPeriod: prevAvgCheck },
    },
    {
      label: 'Расходы',
      value: periodExpenseTotal,
      format: 'som',
      trend: null,
      tooltip: 'Расходы из кассы за период',
    },
    {
      label: 'Открыто',
      value: openNow,
      format: 'count',
      trend: null,
      tooltip: 'Активных заказов прямо сейчас',
    },
    {
      label: 'В кассе',
      value: cashInDrawer,
      format: 'som',
      trend: null,
      tooltip: 'Старт + нал. оплаты − нал. расходы',
    },
  ];

  // ═══ DAILY REVENUE SPARKLINE (last 7 days) ═══
  const dailyRevenues: number[] = [];
  for (let d = 6; d >= 0; d--) {
    const dayStart = new Date(todayStart.getTime() - d * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    // Count from already fetched weekOrders if available
    const daySum = (weekOrders || []).filter((o: any) => {
      const t = new Date(o.opened_at || o.created_at || 0).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);
    dailyRevenues.push(daySum);
  }

  // ═══ YESTERDAY SUMMARY ═══
  const yesterday: YesterdaySummary = {
    revenue: yesterdayRevenue || null,
    checks: yesterdayChecks || null,
    shiftClosed: null,
    cashDifference: null,
    status: yesterdayRevenue > 0 ? 'normal' : 'unavailable',
  };

  return {
    metrics,
    alerts,
    alertGroups,
    totalAlertCount,
    criticalCount,
    chronology: sortedChronology,
    warehouseThreats,
    shiftStatus: {
      isOpen: !!activeShift,
      openedAt: activeShift?.opened_at
        ? new Date(activeShift.opened_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : null,
      hoursOpen: shiftOpenHours || null,
      cashier: null,
    },
    yesterday,
    topDishes: topDishesMonth,
    isTodayEmpty,
    weekRevenue,
    weekChecks,
    antiTop: antiTopMonth,
    migrationCards,
    periodLabel: getPeriodLabel(period),
    negativeStockItems: negativeStockForCorrection,
    foodCost: totalFoodCost,
    dailyRevenues,
  };
}

export function useDashboardNewData(period: DashboardPeriod = 'today') {
  return useQuery({
    queryKey: ['dashboard_new', VENUE_ID, period],
    queryFn: () => fetchDashboardNewData(period),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
