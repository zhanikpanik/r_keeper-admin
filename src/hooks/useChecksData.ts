import { useQuery } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export interface CheckItem {
  name: string;
  qty: number;
  price: number;
  /** null если в order_items нет product_id */
  productId: string | null;
  /**
   * Себестоимость единицы из products.cost_price на момент загрузки.
   * null — нет product_id, продукт не найден или cost_price не задан в БД.
   */
  unitCost: number | null;
}

export interface Check {
  id: string;
  tableNumber: string;
  waiter: string;
  paymentMethod: 'cash' | 'card' | 'none';
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string;
  paid: number;
  discount: number;
  items: CheckItem[];
  /** Сумма qty×(price−unitCost) только по строкам с известной себестоимостью */
  profit: number;
  /** true если есть позиции без учёта в прибыли (нет id / cost_price) */
  profitIncomplete: boolean;
}

interface OrderRow {
  id: string;
  table_number?: string | null;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  total_amount?: number | string | null;
  users?: { name?: string | null } | { name?: string | null }[] | null;
}

interface OrderItemRow {
  order_id: string;
  product_name: string;
  product_price: number | string;
  quantity: number;
  product_id?: string | null;
}

function orderWaiterName(users: OrderRow['users']): string {
  if (!users) return '—';
  if (Array.isArray(users)) return users[0]?.name || '—';
  return users.name || '—';
}

async function fetchProductCostMap(productIds: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, number>();
  if (unique.length === 0) return map;

  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('products')
      .select('id, cost_price')
      .eq('venue_id', VENUE_ID)
      .in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      const id = String((row as { id: string }).id);
      const cp = (row as { cost_price?: unknown }).cost_price;
      if (cp === null || cp === undefined) continue;
      const n = Number(cp);
      if (!Number.isFinite(n)) continue;
      map.set(id, n);
    }
  }
  return map;
}

function buildItemsByOrder(
  rows: OrderItemRow[],
  costByProduct: Map<string, number>,
): Record<string, CheckItem[]> {
  const itemsByOrder: Record<string, CheckItem[]> = {};
  for (const item of rows) {
    const oid = item.order_id;
    if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
    const pid = item.product_id != null && item.product_id !== '' ? String(item.product_id) : null;
    const unitCost = pid != null && costByProduct.has(pid) ? costByProduct.get(pid)! : null;
    itemsByOrder[oid].push({
      name: item.product_name,
      qty: item.quantity,
      price: Number(item.product_price),
      productId: pid,
      unitCost,
    });
  }
  return itemsByOrder;
}

function profitFromItems(items: CheckItem[]): { profit: number; incomplete: boolean } {
  if (items.length === 0) return { profit: 0, incomplete: false };
  let profit = 0;
  let incomplete = false;
  for (const i of items) {
    if (i.unitCost === null) {
      incomplete = true;
      continue;
    }
    profit += i.qty * (i.price - i.unitCost);
  }
  return { profit, incomplete };
}

function mapOrderToCheck(
  o: OrderRow,
  itemsByOrder: Record<string, CheckItem[]>,
  paymentByOrder: Record<string, { method: string; amount: number } | undefined>,
): Check {
  const payment = paymentByOrder[o.id];
  const method = payment?.method || 'none';

  const paid =
    payment != null ? Number(payment.amount) : Number(o.total_amount ?? 0);

  const items = itemsByOrder[o.id] || [];
  const { profit, incomplete: profitIncomplete } = profitFromItems(items);

  return {
    id: o.id,
    tableNumber: o.table_number || '—',
    waiter: orderWaiterName(o.users),
    paymentMethod: method === 'cash' || method === 'card' ? method : 'none',
    status: o.status === 'active' || o.status === 'alert' ? 'open' : 'closed',
    openedAt: o.opened_at,
    closedAt: o.closed_at || '',
    paid,
    discount: 0,
    items,
    profit,
    profitIncomplete,
  };
}

async function fetchChecks(): Promise<Check[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, table_number, zone_name, status, opened_at, closed_at, total_amount, waiter_id, is_quick_check, users(name)',
    )
    .eq('venue_id', VENUE_ID)
    .order('opened_at', { ascending: false });

  if (error) throw error;
  if (!orders || orders.length === 0) return [];

  const orderRows = orders as OrderRow[];
  const orderIds = orderRows.map((o) => o.id);
  const { data: itemRows, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id, product_name, product_price, quantity, product_id')
    .in('order_id', orderIds);

  if (itemsError) throw itemsError;

  const rawItems = (itemRows ?? []) as OrderItemRow[];
  const productIds = rawItems.map((r) => (r.product_id != null ? String(r.product_id) : '')).filter(Boolean);
  const costByProduct = await fetchProductCostMap(productIds);

  const itemsByOrder = buildItemsByOrder(rawItems, costByProduct);

  const { data: payments } = await supabase
    .from('payments')
    .select('order_id, method, amount')
    .in('order_id', orderIds);

  const paymentByOrder: Record<string, { method: string; amount: number }> = {};
  for (const p of payments || []) {
    paymentByOrder[p.order_id] = { method: p.method, amount: Number(p.amount) };
  }

  const seen = new Set<string>();
  const uniqueOrders = orderRows.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  return uniqueOrders.map((o) => mapOrderToCheck(o, itemsByOrder, paymentByOrder));
}

export async function fetchCheckById(orderId: string): Promise<Check | null> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, table_number, zone_name, status, opened_at, closed_at, total_amount, waiter_id, is_quick_check, users(name)',
    )
    .eq('venue_id', VENUE_ID)
    .eq('id', orderId)
    .limit(1);

  if (error) throw error;
  const o = orders?.[0] as OrderRow | undefined;
  if (!o) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id, product_name, product_price, quantity, product_id')
    .eq('order_id', orderId);

  if (itemsError) throw itemsError;

  const rawItems = (itemRows ?? []) as OrderItemRow[];
  const productIds = rawItems.map((r) => (r.product_id != null ? String(r.product_id) : '')).filter(Boolean);
  const costByProduct = await fetchProductCostMap(productIds);
  const itemsByOrder = buildItemsByOrder(rawItems, costByProduct);

  const { data: payments } = await supabase
    .from('payments')
    .select('order_id, method, amount')
    .eq('order_id', orderId);

  const paymentByOrder: Record<string, { method: string; amount: number }> = {};
  for (const p of payments || []) {
    paymentByOrder[p.order_id] = { method: p.method, amount: Number(p.amount) };
  }

  return mapOrderToCheck(o, itemsByOrder, paymentByOrder);
}

export function useChecks() {
  return useQuery({
    queryKey: ['checks', VENUE_ID],
    queryFn: fetchChecks,
    staleTime: 30 * 1000,
  });
}

export function useCheck(orderId: string | undefined) {
  return useQuery({
    queryKey: ['check', VENUE_ID, orderId],
    queryFn: () => fetchCheckById(orderId!),
    enabled: Boolean(orderId),
    staleTime: 30 * 1000,
  });
}
