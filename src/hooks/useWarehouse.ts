import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

/** PostgREST uses PGRST202 / 404-style messages when RPC is missing; PG uses 42883. */
function shouldUseWarehouseStockRpcFallback(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42883' || err.code === 'PGRST202') return true;
  const m = (err.message || '').toLowerCase();
  return (
    m.includes('could not find the function') ||
    m.includes('schema cache') ||
    m.includes('404') ||
    m.includes('not found')
  );
}

/** After first "missing RPC" response, skip calling RPC for this tab — avoids repeated 404 noise in DevTools. */
const WAREHOUSE_STOCK_RPC_SESSION_KEY = 'rk_admin_wh_stock_rpc';

function readWarehouseStockRpcSessionCache(): 'missing' | 'ok' | 'unset' {
  try {
    const v = sessionStorage.getItem(WAREHOUSE_STOCK_RPC_SESSION_KEY);
    if (v === 'missing') return 'missing';
    if (v === 'ok') return 'ok';
  } catch {
    /* private mode */
  }
  return 'unset';
}

function markWarehouseStockRpcMissing() {
  try {
    sessionStorage.setItem(WAREHOUSE_STOCK_RPC_SESSION_KEY, 'missing');
  } catch {
    /* */
  }
}

function markWarehouseStockRpcOk() {
  try {
    sessionStorage.setItem(WAREHOUSE_STOCK_RPC_SESSION_KEY, 'ok');
  } catch {
    /* */
  }
}

const Q_DEL = ['warehouse_deliveries', VENUE_ID] as const;
const Q_WO = ['warehouse_write_offs', VENUE_ID] as const;
export const Q_INV = ['warehouse_inventory_sessions', VENUE_ID] as const;
const Q_TR = ['warehouse_transfers', VENUE_ID] as const;
const Q_WH = ['warehouses', VENUE_ID] as const;
const Q_WH_VIS = ['warehouse_visibility', VENUE_ID] as const;

export interface WarehouseItem {
  id: string;
  name: string;
}

export interface WarehouseIngredientVisibilityRow {
  product_id: string;
  name: string;
  unit: string;
  enabled: boolean;
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('warehouses')
        .insert({
          venue_id: VENUE_ID,
          name: name.trim(),
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q_WH });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useRenameWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('warehouses')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q_WH });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (warehouseId: string) => {
      const { data: stockRows, error: stockErr } = await supabase
        .from('stock_items')
        .select('product_id, quantity')
        .eq('warehouse_id', warehouseId)
        .neq('quantity', 0)
        .limit(1);
      if (stockErr) throw stockErr;
      if ((stockRows || []).length > 0) {
        throw new Error('Нельзя удалить склад: есть ненулевые остатки');
      }

      const { data: deliveryRows, error: delErr } = await supabase
        .from('warehouse_deliveries')
        .select('id')
        .eq('warehouse_id', warehouseId)
        .neq('status', 'cancelled')
        .limit(1);
      if (delErr) throw delErr;
      if ((deliveryRows || []).length > 0) {
        throw new Error('Нельзя удалить склад: есть активные поставки');
      }

      const { data: writeOffRows, error: woErr } = await supabase
        .from('warehouse_write_offs')
        .select('id')
        .eq('warehouse_id', warehouseId)
        .neq('status', 'cancelled')
        .limit(1);
      if (woErr) throw woErr;
      if ((writeOffRows || []).length > 0) {
        throw new Error('Нельзя удалить склад: есть активные списания');
      }

      const { data: inventoryRows, error: invErr } = await supabase
        .from('warehouse_inventory_sessions')
        .select('id')
        .eq('warehouse_id', warehouseId)
        .neq('status', 'cancelled')
        .limit(1);
      if (invErr) throw invErr;
      if ((inventoryRows || []).length > 0) {
        throw new Error('Нельзя удалить склад: есть активные инвентаризации');
      }

      const { data: transferOutRows, error: trOutErr } = await supabase
        .from('warehouse_transfers')
        .select('id')
        .eq('from_warehouse_id', warehouseId)
        .neq('status', 'cancelled')
        .limit(1);
      if (trOutErr) throw trOutErr;
      if ((transferOutRows || []).length > 0) {
        throw new Error('Нельзя удалить склад: есть активные перемещения');
      }

      const { data: transferInRows, error: trInErr } = await supabase
        .from('warehouse_transfers')
        .select('id')
        .eq('to_warehouse_id', warehouseId)
        .neq('status', 'cancelled')
        .limit(1);
      if (trInErr) throw trInErr;
      if ((transferInRows || []).length > 0) {
        throw new Error('Нельзя удалить склад: есть активные перемещения');
      }

      const { error: deleteErr } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', warehouseId)
        .eq('venue_id', VENUE_ID);
      if (deleteErr) throw deleteErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q_WH });
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients'] });
    },
  });
}

export function useWarehouseIngredientVisibility(warehouseId: string | null) {
  return useQuery({
    queryKey: [...Q_WH_VIS, warehouseId ?? 'none'],
    enabled: Boolean(warehouseId),
    queryFn: async (): Promise<WarehouseIngredientVisibilityRow[]> => {
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, unit')
        .eq('venue_id', VENUE_ID)
        .eq('type', 'ingredient')
        .order('name');
      if (prodErr) throw prodErr;

      const ids = (products || []).map((p) => p.id);
      if (ids.length === 0) return [];

      const { data: links, error: linksErr } = await supabase
        .from('warehouse_products')
        .select('product_id')
        .eq('warehouse_id', warehouseId!)
        .in('product_id', ids);
      if (linksErr) throw linksErr;

      const enabled = new Set((links || []).map((l) => l.product_id as string));
      return (products || []).map((p) => ({
        product_id: p.id,
        name: p.name as string,
        unit: (p.unit as string) || 'кг',
        enabled: enabled.has(p.id),
      }));
    },
  });
}

export function useSetWarehouseIngredientVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      warehouseId,
      productId,
      enabled,
    }: {
      warehouseId: string;
      productId: string;
      enabled: boolean;
    }) => {
      if (enabled) {
        const { error } = await supabase
          .from('warehouse_products')
          .upsert(
            { warehouse_id: warehouseId, product_id: productId },
            { onConflict: 'warehouse_id,product_id' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('warehouse_products')
          .delete()
          .eq('warehouse_id', warehouseId)
          .eq('product_id', productId);
        if (error) throw error;
      }
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: [...Q_WH_VIS, vars.warehouseId] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients', vars.warehouseId] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients'] });
    },
  });
}

export function useWarehouseProductIds(warehouseId: string | null) {
  return useQuery({
    queryKey: ['warehouse-product-ids', VENUE_ID, warehouseId ?? 'none'],
    enabled: Boolean(warehouseId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('warehouse_products')
        .select('product_id')
        .eq('warehouse_id', warehouseId!);
      if (error) throw error;
      return (data || []).map((row) => row.product_id as string);
    },
  });
}

export function useUpsertWarehouseProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      warehouseId,
      productIds,
    }: {
      warehouseId: string;
      productIds: string[];
    }) => {
      const { error: deleteErr } = await supabase
        .from('warehouse_products')
        .delete()
        .eq('warehouse_id', warehouseId);
      if (deleteErr) throw deleteErr;

      if (productIds.length > 0) {
        const payload = productIds.map((productId) => ({
          warehouse_id: warehouseId,
          product_id: productId,
        }));
        const { error: insertErr } = await supabase
          .from('warehouse_products')
          .insert(payload);
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: [...Q_WH_VIS, vars.warehouseId] });
      qc.invalidateQueries({ queryKey: ['warehouse-product-ids', VENUE_ID, vars.warehouseId] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients', vars.warehouseId] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients'] });
    },
  });
}

interface DeliveryDbRow {
  id: string;
  supplier: string | null;
  delivery_date: string;
  amount: string | number | null;
  status: string;
  source: string | null;
  comment: string | null;
  warehouse_id?: string | null;
  workshop_id?: string | null;
  warehouses?: { name?: string | null } | { name?: string | null }[] | null;
}

interface DeliveryItemDbRow {
  id: string;
  delivery_id: string;
  name: string;
  quantity: string | number | null;
  unit: string;
  price: string | number | null;
  product_id: string | null;
}

interface WriteOffDbRow {
  id: string;
  reason_summary: string | null;
  write_off_date: string;
  status: string;
  created_by_name: string | null;
  comment: string | null;
  warehouse_id?: string | null;
  workshop_id?: string | null;
  warehouses?: { name?: string | null } | { name?: string | null }[] | null;
}

interface WriteOffItemDbRow {
  id: string;
  write_off_id: string;
  name: string;
  quantity: string | number | null;
  unit: string;
  reason: string | null;
  product_id: string | null;
}

interface InventorySessionDbRow {
  id: string;
  conducted_at: string;
  status: string;
  result_delta: string | number | null;
  warehouse_id: string | null;
  warehouses: { name?: string | null } | { name?: string | null }[] | null;
  workshop_id: string | null;
  workshops: { name?: string | null } | { name?: string | null }[] | null;
}

function workshopLabel(
  w: InventorySessionDbRow['workshops']
): string {
  if (!w) return '—';
  if (Array.isArray(w)) return w[0]?.name || '—';
  return w.name || '—';
}

function warehouseLabel(
  w: InventorySessionDbRow['warehouses']
): string {
  if (!w) return '—';
  if (Array.isArray(w)) return w[0]?.name || '—';
  return w.name || '—';
}

function deliveryWarehouseLabel(
  w: DeliveryDbRow['warehouses']
): string {
  if (!w) return '—';
  if (Array.isArray(w)) return w[0]?.name || '—';
  return w.name || '—';
}

// --- Deliveries ---

export type DeliveryUiStatus = 'Черновик' | 'В пути' | 'Принято' | 'Отменено';

const statusToUi: Record<string, DeliveryUiStatus> = {
  draft: 'Черновик',
  in_transit: 'В пути',
  received: 'Принято',
  cancelled: 'Отменено',
};

export interface DeliveryRow {
  id: string;
  supplier: string;
  date: string;
  amount: number;
  status: DeliveryUiStatus;
  source: 'Manual' | 'Procurement App';
  comment: string;
  warehouse_id: string | null;
  warehouse_name: string;
  workshop_id: string | null;
  items: { id: string; product_id: string | null; name: string; quantity: number; unit: string; price: number }[];
}

function mapDelivery(d: DeliveryDbRow, items: DeliveryItemDbRow[]): DeliveryRow {
  return {
    id: d.id,
    supplier: d.supplier || '',
    date: d.delivery_date,
    amount: Number(d.amount) || 0,
    status: statusToUi[d.status] ?? 'Черновик',
    source: d.source === 'procurement_app' ? 'Procurement App' : 'Manual',
    comment: d.comment || '',
    warehouse_id: d.warehouse_id ?? null,
    warehouse_name: deliveryWarehouseLabel(d.warehouses),
    workshop_id: d.workshop_id ?? null,
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id ?? null,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
      price: Number(i.price),
    })),
  };
}

export function useWarehouseDeliveries() {
  return useQuery({
    queryKey: Q_DEL,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('warehouse_deliveries')
        .select('*, warehouses(name)')
        .eq('venue_id', VENUE_ID)
        .order('delivery_date', { ascending: false });
      if (error) throw error;
      if (!rows?.length) return [] as DeliveryRow[];

      const ids = rows.map((r) => r.id);
      const { data: lineRows } = await supabase
        .from('warehouse_delivery_items')
        .select('*')
        .in('delivery_id', ids);

      const byDel: Record<string, DeliveryItemDbRow[]> = {};
      for (const l of (lineRows || []) as DeliveryItemDbRow[]) {
        if (!byDel[l.delivery_id]) byDel[l.delivery_id] = [];
        byDel[l.delivery_id].push(l);
      }

      return (rows as DeliveryDbRow[]).map((d) => mapDelivery(d, byDel[d.id] || []));
    },
  });
}

export function useWarehouseDelivery(deliveryId: string | undefined) {
  return useQuery({
    queryKey: ['warehouse_delivery', VENUE_ID, deliveryId ?? ''],
    enabled: Boolean(deliveryId),
    queryFn: async (): Promise<DeliveryRow> => {
      const { data: row, error } = await supabase
        .from('warehouse_deliveries')
        .select('*, warehouses(name)')
        .eq('id', deliveryId!)
        .eq('venue_id', VENUE_ID)
        .single();
      if (error) throw error;
      const { data: lineRows, error: linesErr } = await supabase
        .from('warehouse_delivery_items')
        .select('*')
        .eq('delivery_id', deliveryId!);
      if (linesErr) throw linesErr;
      return mapDelivery(row as DeliveryDbRow, (lineRows || []) as DeliveryItemDbRow[]);
    },
  });
}

function invalidateDeliveryListAndDetails(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: Q_DEL });
  qc.invalidateQueries({ queryKey: ['warehouse_delivery', VENUE_ID] });
}

export interface CreateDeliveryPayload {
  supplier: string;
  date: string;
  comment: string;
  warehouse_id?: string;
  workshop_id?: string;
  items: { product_id: string; name: string; quantity: number; unit: string; price: number }[];
}

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: CreateDeliveryPayload) => {
      const amount = p.items.reduce((s, i) => s + i.quantity * i.price, 0);
      const { data, error } = await supabase
        .from('warehouse_deliveries')
        .insert({
          venue_id: VENUE_ID,
          supplier: p.supplier,
          delivery_date: p.date,
          amount,
          status: 'draft',
          source: 'manual',
          comment: p.comment,
          warehouse_id: p.warehouse_id || null,
          workshop_id: p.workshop_id || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (p.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('warehouse_delivery_items')
          .insert(p.items.map((i) => ({
            delivery_id: data.id,
            product_id: i.product_id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            price: i.price,
          })));
        if (itemsErr) throw itemsErr;
        await finalizeWarehouseDelivery(data.id);
      }
      return data.id;
    },
    onSettled: () => {
      invalidateDeliveryListAndDetails(qc);
      qc.invalidateQueries({ queryKey: ['ingredients'] });
      qc.invalidateQueries({ queryKey: ['dishes'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats', VENUE_ID] });
    },
  });
}

export interface UpdateDeliveryPayload {
  id: string;
  supplier: string;
  date: string;
  comment: string;
  warehouse_id?: string;
  workshop_id?: string;
  items: { product_id: string; name: string; quantity: number; unit: string; price: number }[];
}

export function useUpdateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: UpdateDeliveryPayload) => {
      const { data: doc, error: selErr } = await supabase
        .from('warehouse_deliveries')
        .select('status')
        .eq('id', p.id)
        .eq('venue_id', VENUE_ID)
        .single();
      if (selErr) throw selErr;
      const st = doc?.status as string | undefined;
      if (st === 'cancelled') throw new Error('Отменённую поставку нельзя редактировать');
      if (!st) throw new Error('Документ не найден');

      const amount = p.items.reduce((s, i) => s + i.quantity * i.price, 0);

      if (st === 'received') {
        await reverseDeliveryStock(p.id);
      }

      const { error: delErr } = await supabase
        .from('warehouse_delivery_items')
        .delete()
        .eq('delivery_id', p.id);
      if (delErr) throw delErr;

      if (p.items.length > 0) {
        const { error: insErr } = await supabase.from('warehouse_delivery_items').insert(
          p.items.map((i) => ({
            delivery_id: p.id,
            product_id: i.product_id || null,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            price: i.price,
          }))
        );
        if (insErr) throw insErr;
      }

      const { error: upErr } = await supabase
        .from('warehouse_deliveries')
        .update({
          supplier: p.supplier,
          delivery_date: p.date,
          amount,
          comment: p.comment,
          warehouse_id: p.warehouse_id || null,
          workshop_id: p.workshop_id || null,
        })
        .eq('id', p.id)
        .eq('venue_id', VENUE_ID);
      if (upErr) throw upErr;

      if (st === 'received') {
        await applyDeliveryStockFallback(p.id);
      }
    },
    onSettled: () => {
      invalidateDeliveryListAndDetails(qc);
      invalidateStockCaches(qc);
    },
  });
}

// --- Status mutation factory ---
// Eliminates 300 lines of boilerplate across 14 mutations.
// Each status-change mutation (post/cancel/restore/send/receive) shares the same
// onMutate + onError structure; only mutationFn + onSettled vary.
function useStatusMutation<T extends { id: string }>(config: {
  mutationFn: (id: string) => Promise<void>;
  queryKey: readonly string[];
  statusLabel: string;
  onSettled: (qc: ReturnType<typeof useQueryClient>) => void;
}) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: config.mutationFn,
      onMutate: async (id: string) => {
        await qc.cancelQueries({ queryKey: config.queryKey });
        const prev = qc.getQueryData<T[]>(config.queryKey);
        qc.setQueryData<T[]>(config.queryKey, (old) =>
          (old || []).map((item) =>
            item.id === id ? { ...item, status: config.statusLabel } as unknown as T : item
          )
        );
        return { prev };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prev) qc.setQueryData(config.queryKey, ctx.prev);
      },
      onSettled: () => config.onSettled(qc),
    });
  };
}

export const useSendDeliveryInTransit = useStatusMutation<DeliveryRow>({
  mutationFn: async (id) => {
    const { error } = await supabase
      .from('warehouse_deliveries').update({ status: 'in_transit' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_DEL,
  statusLabel: 'В пути',
  onSettled: (qc) => invalidateDeliveryListAndDetails(qc),
});

export const useReceiveDelivery = useStatusMutation<DeliveryRow>({
  mutationFn: async (id) => { await finalizeWarehouseDelivery(id); },
  queryKey: Q_DEL,
  statusLabel: 'Принято',
  onSettled: (qc) => {
    invalidateDeliveryListAndDetails(qc);
    qc.invalidateQueries({ queryKey: ['dishes'] });
    qc.invalidateQueries({ queryKey: ['ingredients'] });
    qc.invalidateQueries({ queryKey: ['dashboard_stats', VENUE_ID] });
  },
});

async function applyStockDelta(
  warehouseId: string,
  productId: string,
  delta: number,
  unit: string
) {
  const { data: row } = await supabase
    .from('stock_items')
    .select('quantity')
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId)
    .maybeSingle();
  const cur = Number(row?.quantity) || 0;
  const next = Math.max(0, cur + delta);
  const { error } = await supabase.from('stock_items').upsert(
    {
      warehouse_id: warehouseId,
      product_id: productId,
      quantity: next,
      unit: unit || 'кг',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'warehouse_id,product_id' }
  );
  if (error) throw error;
}

async function applyDeliveryStockFallback(deliveryId: string) {
  const { data: doc } = await supabase
    .from('warehouse_deliveries')
    .select('warehouse_id')
    .eq('id', deliveryId)
    .eq('venue_id', VENUE_ID)
    .single();
  const warehouseId = doc?.warehouse_id as string | null;
  if (!warehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_delivery_items')
    .select('product_id, quantity, unit')
    .eq('delivery_id', deliveryId);

  for (const line of lines || []) {
    if (!line.product_id) continue;
    const add = Number(line.quantity) || 0;
    await applyStockDelta(warehouseId, line.product_id, add, line.unit || 'кг');
  }
}

/** Bump ingredient stock from delivery lines and mark document received. Safe to call again if already received. */
async function finalizeWarehouseDelivery(deliveryId: string): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from('warehouse_deliveries')
    .select('status')
    .eq('id', deliveryId)
    .eq('venue_id', VENUE_ID)
    .single();
  if (selErr) throw selErr;
  if (row?.status === 'received') return;

  const rpcHint = readWarehouseStockRpcSessionCache();
  if (rpcHint === 'missing') {
    await applyDeliveryStockFallback(deliveryId);
  } else {
    const { error: rpcErr } = await supabase.rpc('apply_delivery_stock', { p_delivery_id: deliveryId });
    if (!rpcErr) {
      markWarehouseStockRpcOk();
      const { data: rpcDoc } = await supabase
        .from('warehouse_deliveries')
        .select('warehouse_id')
        .eq('id', deliveryId)
        .eq('venue_id', VENUE_ID)
        .single();
      const rpcWarehouseId = (rpcDoc as { warehouse_id?: string | null } | null)?.warehouse_id ?? null;
      const { data: rpcLines } = await supabase
        .from('warehouse_delivery_items')
        .select('product_id, quantity')
        .eq('delivery_id', deliveryId);
      const rpcProductIds = [...new Set((rpcLines || []).map((l) => l.product_id).filter(Boolean))] as string[];
      const rpcLineQtySum = (rpcLines || []).reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

      let rpcStockRows: { product_id: string; quantity: number }[] = [];
      if (rpcWarehouseId && rpcProductIds.length > 0) {
        const { data: rows } = await supabase
          .from('stock_items')
          .select('product_id, quantity')
          .eq('warehouse_id', rpcWarehouseId)
          .in('product_id', rpcProductIds);
        rpcStockRows = (rows || []) as { product_id: string; quantity: number }[];
      }

      if (rpcLineQtySum > 0 && rpcProductIds.length > 0 && rpcStockRows.length === 0) {
        await applyDeliveryStockFallback(deliveryId);
      }
    } else if (shouldUseWarehouseStockRpcFallback(rpcErr)) {
      markWarehouseStockRpcMissing();
      await applyDeliveryStockFallback(deliveryId);
    } else {
      throw rpcErr;
    }
  }
  const { error } = await supabase
    .from('warehouse_deliveries')
    .update({ status: 'received' })
    .eq('id', deliveryId)
    .eq('venue_id', VENUE_ID);
  if (error) throw error;
}

/** Reverse delivery stock: subtract each line's quantity from the ingredient. */
async function reverseDeliveryStock(deliveryId: string) {
  const { data: doc } = await supabase
    .from('warehouse_deliveries')
    .select('warehouse_id')
    .eq('id', deliveryId)
    .eq('venue_id', VENUE_ID)
    .single();
  const warehouseId = doc?.warehouse_id as string | null;
  if (!warehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_delivery_items')
    .select('product_id, quantity, unit')
    .eq('delivery_id', deliveryId);

  for (const line of lines || []) {
    if (!line.product_id) continue;
    const sub = Number(line.quantity) || 0;
    await applyStockDelta(warehouseId, line.product_id, -sub, line.unit || 'кг');
  }
}

const INVALIDATE_STOCK_KEYS = [
  ['dishes'],
  ['ingredients'],
  ['warehouse-ingredients'],
  ['dashboard_stats', VENUE_ID],
] as const;

function invalidateStockCaches(qc: ReturnType<typeof useQueryClient>) {
  for (const key of INVALIDATE_STOCK_KEYS) {
    qc.invalidateQueries({ queryKey: [...key] });
  }
}

export const useCancelDelivery = useStatusMutation<DeliveryRow>({
  mutationFn: async (id) => {
    const { data: row } = await supabase
      .from('warehouse_deliveries').select('status')
      .eq('id', id).eq('venue_id', VENUE_ID).single();
    if (row?.status === 'received') await reverseDeliveryStock(id);
    const { error } = await supabase
      .from('warehouse_deliveries').update({ status: 'cancelled' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_DEL,
  statusLabel: 'Отменено',
  onSettled: (qc) => { invalidateDeliveryListAndDetails(qc); invalidateStockCaches(qc); },
});

export const useRestoreDelivery = useStatusMutation<DeliveryRow>({
  mutationFn: async (id) => {
    await applyDeliveryStockFallback(id);
    const { error } = await supabase
      .from('warehouse_deliveries').update({ status: 'received' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_DEL,
  statusLabel: 'Принято',
  onSettled: (qc) => { invalidateDeliveryListAndDetails(qc); invalidateStockCaches(qc); },
});

// --- Write-offs ---

export type WriteOffUiStatus = 'Черновик' | 'Проведено' | 'Отменено';

const woStatusToUi: Record<string, WriteOffUiStatus> = {
  draft: 'Черновик',
  posted: 'Проведено',
  cancelled: 'Отменено',
};

export interface WriteOffRow {
  id: string;
  date: string;
  reason_summary: string;
  comment: string;
  status: WriteOffUiStatus;
  created_by: string;
  warehouse_id: string | null;
  warehouse_name: string;
  workshop_id: string | null;
  items: { id: string; product_id: string | null; name: string; quantity: number; unit: string; reason: string }[];
}

function mapWriteOff(w: WriteOffDbRow, items: WriteOffItemDbRow[]): WriteOffRow {
  const wh = w.warehouses;
  const whName = wh
    ? (Array.isArray(wh) ? wh[0]?.name : wh.name) || '—'
    : '—';

  return {
    id: w.id,
    date: w.write_off_date,
    reason_summary: w.reason_summary || '',
    comment: w.comment || '',
    status: woStatusToUi[w.status] ?? 'Черновик',
    created_by: w.created_by_name || '—',
    warehouse_id: w.warehouse_id ?? null,
    warehouse_name: whName,
    workshop_id: w.workshop_id ?? null,
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id ?? null,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
      reason: i.reason || '',
    })),
  };
}

export function useWarehouseWriteOffs() {
  return useQuery({
    queryKey: Q_WO,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('warehouse_write_offs')
        .select('*, warehouses(name)')
        .eq('venue_id', VENUE_ID)
        .order('write_off_date', { ascending: false });
      if (error) throw error;
      if (!rows?.length) return [] as WriteOffRow[];

      const ids = rows.map((r) => r.id);
      const { data: lineRows } = await supabase
        .from('warehouse_write_off_items')
        .select('*')
        .in('write_off_id', ids);

      const byWo: Record<string, WriteOffItemDbRow[]> = {};
      for (const l of (lineRows || []) as WriteOffItemDbRow[]) {
        if (!byWo[l.write_off_id]) byWo[l.write_off_id] = [];
        byWo[l.write_off_id].push(l);
      }

      return (rows as WriteOffDbRow[]).map((w) => mapWriteOff(w, byWo[w.id] || []));
    },
  });
}

export function useWarehouseWriteOff(writeOffId: string | undefined) {
  return useQuery({
    queryKey: ['warehouse_write_off', VENUE_ID, writeOffId ?? ''],
    enabled: Boolean(writeOffId),
    queryFn: async (): Promise<WriteOffRow> => {
      const { data: row, error } = await supabase
        .from('warehouse_write_offs')
        .select('*, warehouses(name)')
        .eq('id', writeOffId!)
        .eq('venue_id', VENUE_ID)
        .single();
      if (error) throw error;
      const { data: lineRows, error: linesErr } = await supabase
        .from('warehouse_write_off_items')
        .select('*')
        .eq('write_off_id', writeOffId!);
      if (linesErr) throw linesErr;
      return mapWriteOff(row as WriteOffDbRow, (lineRows || []) as WriteOffItemDbRow[]);
    },
  });
}

function invalidateWriteOffListAndDetails(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: Q_WO });
  qc.invalidateQueries({ queryKey: ['warehouse_write_off', VENUE_ID] });
}

export interface CreateWriteOffPayload {
  date: string;
  comment: string;
  warehouse_id?: string;
  workshop_id?: string;
  items: { product_id: string; name: string; quantity: number; unit: string; reason: string }[];
}

export function useCreateWriteOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: CreateWriteOffPayload) => {
      const reasons = [...new Set(p.items.map((i) => i.reason).filter(Boolean))];
      const { data, error } = await supabase
        .from('warehouse_write_offs')
        .insert({
          venue_id: VENUE_ID,
          reason_summary: reasons.join(', '),
          created_by_name: 'Админ',
          write_off_date: p.date,
          status: 'draft',
          comment: p.comment,
          warehouse_id: p.warehouse_id || null,
          workshop_id: p.workshop_id || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (p.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('warehouse_write_off_items')
          .insert(p.items.map((i) => ({
            write_off_id: data.id,
            product_id: i.product_id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            reason: i.reason,
          })));
        if (itemsErr) throw itemsErr;
        await finalizeWarehouseWriteOff(data.id);
      }
      return data.id;
    },
    onSettled: () => {
      invalidateWriteOffListAndDetails(qc);
      qc.invalidateQueries({ queryKey: ['ingredients'] });
      qc.invalidateQueries({ queryKey: ['dishes'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats', VENUE_ID] });
    },
  });
}

export interface UpdateWriteOffPayload {
  id: string;
  date: string;
  comment: string;
  warehouse_id?: string;
  workshop_id?: string;
  items: { product_id: string; name: string; quantity: number; unit: string; reason: string }[];
}

export function useUpdateWriteOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: UpdateWriteOffPayload) => {
      const { data: doc, error: selErr } = await supabase
        .from('warehouse_write_offs')
        .select('status')
        .eq('id', p.id)
        .eq('venue_id', VENUE_ID)
        .single();
      if (selErr) throw selErr;
      const st = doc?.status as string | undefined;
      if (st === 'cancelled') throw new Error('Отменённое списание нельзя редактировать');
      if (!st) throw new Error('Документ не найден');

      const reasons = [...new Set(p.items.map((i) => i.reason).filter(Boolean))];
      const reason_summary = reasons.join(', ');

      if (st === 'posted') {
        await reverseWriteOffStock(p.id);
      }

      const { error: delErr } = await supabase
        .from('warehouse_write_off_items')
        .delete()
        .eq('write_off_id', p.id);
      if (delErr) throw delErr;

      if (p.items.length > 0) {
        const { error: insErr } = await supabase.from('warehouse_write_off_items').insert(
          p.items.map((i) => ({
            write_off_id: p.id,
            product_id: i.product_id || null,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            reason: i.reason,
          }))
        );
        if (insErr) throw insErr;
      }

      const { error: upErr } = await supabase
        .from('warehouse_write_offs')
        .update({
          write_off_date: p.date,
          comment: p.comment,
          reason_summary,
          warehouse_id: p.warehouse_id || null,
          workshop_id: p.workshop_id || null,
        })
        .eq('id', p.id)
        .eq('venue_id', VENUE_ID);
      if (upErr) throw upErr;

      if (st === 'posted') {
        await subtractWriteOffStockFallback(p.id);
      }
    },
    onSettled: () => {
      invalidateWriteOffListAndDetails(qc);
      invalidateStockCaches(qc);
    },
  });
}

export const usePostWriteOff = useStatusMutation<WriteOffRow>({
  mutationFn: async (id) => { await finalizeWarehouseWriteOff(id); },
  queryKey: Q_WO,
  statusLabel: 'Проведено',
  onSettled: (qc) => {
    invalidateWriteOffListAndDetails(qc);
    qc.invalidateQueries({ queryKey: ['dishes'] });
    qc.invalidateQueries({ queryKey: ['ingredients'] });
    qc.invalidateQueries({ queryKey: ['dashboard_stats', VENUE_ID] });
  },
});

/** Reduce ingredient stock from write-off lines and mark document posted. Safe if already posted. */
async function finalizeWarehouseWriteOff(writeOffId: string): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from('warehouse_write_offs')
    .select('status')
    .eq('id', writeOffId)
    .eq('venue_id', VENUE_ID)
    .single();
  if (selErr) throw selErr;
  if (row?.status === 'posted') return;

  const rpcHint = readWarehouseStockRpcSessionCache();
  if (rpcHint === 'missing') {
    await subtractWriteOffStockFallback(writeOffId);
  } else {
    const { error: rpcErr } = await supabase.rpc('apply_writeoff_stock', { p_writeoff_id: writeOffId });
    if (!rpcErr) {
      markWarehouseStockRpcOk();
    } else if (shouldUseWarehouseStockRpcFallback(rpcErr)) {
      markWarehouseStockRpcMissing();
      await subtractWriteOffStockFallback(writeOffId);
    } else {
      throw rpcErr;
    }
  }
  const { error } = await supabase
    .from('warehouse_write_offs')
    .update({ status: 'posted' })
    .eq('id', writeOffId)
    .eq('venue_id', VENUE_ID);
  if (error) throw error;
}

async function subtractWriteOffStockFallback(writeOffId: string) {
  const { data: doc } = await supabase
    .from('warehouse_write_offs')
    .select('warehouse_id')
    .eq('id', writeOffId)
    .eq('venue_id', VENUE_ID)
    .single();
  const warehouseId = doc?.warehouse_id as string | null;
  if (!warehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_write_off_items')
    .select('product_id, quantity, unit')
    .eq('write_off_id', writeOffId);

  for (const line of lines || []) {
    if (!line.product_id) continue;
    const sub = Number(line.quantity) || 0;
    await applyStockDelta(warehouseId, line.product_id, -sub, line.unit || 'кг');
  }
}

/** Reverse write-off stock: add each line's quantity back to the ingredient. */
async function reverseWriteOffStock(writeOffId: string) {
  const { data: doc } = await supabase
    .from('warehouse_write_offs')
    .select('warehouse_id')
    .eq('id', writeOffId)
    .eq('venue_id', VENUE_ID)
    .single();
  const warehouseId = doc?.warehouse_id as string | null;
  if (!warehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_write_off_items')
    .select('product_id, quantity, unit')
    .eq('write_off_id', writeOffId);

  for (const line of lines || []) {
    if (!line.product_id) continue;
    const add = Number(line.quantity) || 0;
    await applyStockDelta(warehouseId, line.product_id, add, line.unit || 'кг');
  }
}

export const useCancelWriteOff = useStatusMutation<WriteOffRow>({
  mutationFn: async (id) => {
    const { data: row } = await supabase
      .from('warehouse_write_offs').select('status')
      .eq('id', id).eq('venue_id', VENUE_ID).single();
    if (row?.status === 'posted') await reverseWriteOffStock(id);
    const { error } = await supabase
      .from('warehouse_write_offs').update({ status: 'cancelled' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_WO,
  statusLabel: 'Отменено',
  onSettled: (qc) => { invalidateWriteOffListAndDetails(qc); invalidateStockCaches(qc); },
});

export const useRestoreWriteOff = useStatusMutation<WriteOffRow>({
  mutationFn: async (id) => {
    await subtractWriteOffStockFallback(id);
    const { error } = await supabase
      .from('warehouse_write_offs').update({ status: 'posted' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_WO,
  statusLabel: 'Проведено',
  onSettled: (qc) => { invalidateWriteOffListAndDetails(qc); invalidateStockCaches(qc); },
});

// --- Inventory ---

export type InventoryUiStatus = 'Черновик' | 'Проведено' | 'Отменено';

const invStatusToUi: Record<string, InventoryUiStatus> = {
  draft: 'Черновик',
  posted: 'Проведено',
  cancelled: 'Отменено',
};

export interface InventoryActRow {
  id: string;
  date: string;
  workshop: string;
  warehouse: string;
  workshop_id: string | null;
  warehouse_id: string | null;
  result: number;
  status: InventoryUiStatus;
}

export function useInventoryLines(sessionId: string | null) {
  return useQuery({
    queryKey: ['warehouse_inventory_lines', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_inventory_lines')
        .select('*')
        .eq('session_id', sessionId!);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(sessionId),
  });
}

export function useWarehouseInventorySessions() {
  return useQuery({
    queryKey: Q_INV,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('warehouse_inventory_sessions')
        .select('id, conducted_at, status, result_delta, warehouse_id, warehouses(name), workshop_id, workshops(name)')
        .eq('venue_id', VENUE_ID)
        .order('conducted_at', { ascending: false });
      if (error) throw error;
      return ((rows ?? []) as InventorySessionDbRow[]).map((r) => ({
        id: r.id,
        date: r.conducted_at?.slice(0, 10) || '',
        workshop: workshopLabel(r.workshops),
        warehouse: warehouseLabel(r.warehouses) === '—' ? workshopLabel(r.workshops) : warehouseLabel(r.warehouses),
        workshop_id: r.workshop_id,
        warehouse_id: r.warehouse_id,
        result: Number(r.result_delta) || 0,
        status: invStatusToUi[r.status] ?? 'Черновик',
      })) as InventoryActRow[];
    },
  });
}

export function useCreateInventorySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      warehouse_id?: string;
      workshop_id?: string;
      inventory_type: 'full' | 'partial';
      conducted_at: string;
    }) => {
      const { data, error } = await supabase
        .from('warehouse_inventory_sessions')
        .insert({
          venue_id: VENUE_ID,
          warehouse_id: p.warehouse_id || null,
          workshop_id: p.workshop_id || null,
          inventory_type: p.inventory_type,
          conducted_at: p.conducted_at,
          status: 'draft',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: Q_INV }),
  });
}

export function useSaveInventoryLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      sessionId: string;
      lines: {
        product_id: string | null;
        name: string;
        unit: string;
        theoretical: number;
        actual: number | null;
        unit_price: number;
      }[];
    }) => {
      await supabase.from('warehouse_inventory_lines').delete().eq('session_id', p.sessionId);
      if (p.lines.length === 0) return;
      const { error } = await supabase.from('warehouse_inventory_lines').insert(
        p.lines.map((l) => ({
          session_id: p.sessionId,
          product_id: l.product_id,
          name: l.name,
          unit: l.unit,
          theoretical: l.theoretical,
          actual: l.actual,
          unit_price: l.unit_price,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: Q_INV }),
  });
}

export function usePostInventorySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const rpcHint = readWarehouseStockRpcSessionCache();
      if (rpcHint === 'missing') {
        await applyInventoryStockFallback(sessionId);
      } else {
        const { error: rpcErr } = await supabase.rpc('apply_inventory_stock', { p_session_id: sessionId });
        if (!rpcErr) {
          markWarehouseStockRpcOk();
        } else if (shouldUseWarehouseStockRpcFallback(rpcErr)) {
          markWarehouseStockRpcMissing();
          await applyInventoryStockFallback(sessionId);
        } else {
          throw rpcErr;
        }
      }

      const { data: lines } = await supabase
        .from('warehouse_inventory_lines')
        .select('theoretical, actual, unit_price')
        .eq('session_id', sessionId);

      let deltaSum = 0;
      for (const line of lines || []) {
        const actual = line.actual != null ? Number(line.actual) : null;
        if (actual == null) continue;
        const theo = Number(line.theoretical) || 0;
        const price = Number(line.unit_price) || 0;
        deltaSum += (actual - theo) * price;
      }

      const { error } = await supabase
        .from('warehouse_inventory_sessions')
        .update({ status: 'posted', result_delta: deltaSum })
        .eq('id', sessionId)
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q_INV });
      invalidateStockCaches(qc);
    },
  });
}

async function applyInventoryStockFallback(sessionId: string) {
  const { data: session } = await supabase
    .from('warehouse_inventory_sessions')
    .select('warehouse_id')
    .eq('id', sessionId)
    .eq('venue_id', VENUE_ID)
    .single();
  const warehouseId = session?.warehouse_id as string | null;
  if (!warehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_inventory_lines')
    .select('product_id, actual, unit')
    .eq('session_id', sessionId);

  for (const line of lines || []) {
    const actual = line.actual != null ? Number(line.actual) : null;
    if (actual == null || !line.product_id) continue;
    const { error } = await supabase.from('stock_items').upsert(
      {
        warehouse_id: warehouseId,
        product_id: line.product_id,
        quantity: Math.max(0, actual),
        unit: line.unit || 'кг',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'warehouse_id,product_id' }
    );
    if (error) throw error;
  }
}

// --- Transfers ---

export type TransferUiStatus = 'Черновик' | 'Проведено' | 'Отменено';

const trStatusToUi: Record<string, TransferUiStatus> = {
  draft: 'Черновик',
  posted: 'Проведено',
  cancelled: 'Отменено',
};

export interface TransferRow {
  id: string;
  fromWarehouse: string;
  fromWarehouseId: string;
  toWarehouse: string;
  toWarehouseId: string;
  fromWorkshop?: string;
  fromWorkshopId?: string;
  toWorkshop?: string;
  toWorkshopId?: string;
  date: string;
  comment: string;
  status: TransferUiStatus;
  items: { id: string; product_id: string | null; name: string; quantity: number; unit: string }[];
}

interface TransferDbRow {
  id: string;
  transfer_date: string;
  status: string;
  comment: string | null;
  from_workshop_id?: string | null;
  to_workshop_id?: string | null;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  from_workshop?: { name?: string | null } | { name?: string | null }[] | null;
  to_workshop?: { name?: string | null } | { name?: string | null }[] | null;
  from_warehouse?: { name?: string | null } | { name?: string | null }[] | null;
  to_warehouse?: { name?: string | null } | { name?: string | null }[] | null;
}

interface TransferItemDbRow {
  id: string;
  transfer_id: string;
  name: string;
  quantity: string | number | null;
  unit: string;
  product_id: string | null;
}

function transferEntityName(
  w: { name?: string | null } | { name?: string | null }[] | null | undefined
): string {
  if (!w) return '—';
  if (Array.isArray(w)) return w[0]?.name || '—';
  return w.name || '—';
}

function mapTransfer(t: TransferDbRow, items: TransferItemDbRow[]): TransferRow {
  return {
    id: t.id,
    fromWarehouse:
      transferEntityName(t.from_warehouse) === '—'
        ? transferEntityName(t.from_workshop)
        : transferEntityName(t.from_warehouse),
    fromWarehouseId: t.from_warehouse_id || t.from_workshop_id || '',
    toWarehouse:
      transferEntityName(t.to_warehouse) === '—'
        ? transferEntityName(t.to_workshop)
        : transferEntityName(t.to_warehouse),
    toWarehouseId: t.to_warehouse_id || t.to_workshop_id || '',
    fromWorkshop: transferEntityName(t.from_workshop),
    fromWorkshopId: t.from_workshop_id || '',
    toWorkshop: transferEntityName(t.to_workshop),
    toWorkshopId: t.to_workshop_id || '',
    date: t.transfer_date,
    comment: t.comment || '',
    status: trStatusToUi[t.status] ?? 'Черновик',
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id ?? null,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
    })),
  };
}

export function useWarehouseTransfers() {
  return useQuery({
    queryKey: Q_TR,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('warehouse_transfers')
        .select('*, from_workshop:workshops!warehouse_transfers_from_workshop_id_fkey(name), to_workshop:workshops!warehouse_transfers_to_workshop_id_fkey(name), from_warehouse:warehouses!warehouse_transfers_from_warehouse_id_fkey(name), to_warehouse:warehouses!warehouse_transfers_to_warehouse_id_fkey(name)')
        .eq('venue_id', VENUE_ID)
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      if (!rows?.length) return [] as TransferRow[];

      const ids = rows.map((r: any) => r.id);
      const { data: items, error: itemErr } = await supabase
        .from('warehouse_transfer_items')
        .select('*')
        .in('transfer_id', ids);
      if (itemErr) throw itemErr;

      const byId: Record<string, TransferItemDbRow[]> = {};
      for (const it of (items || []) as TransferItemDbRow[]) {
        if (!byId[it.transfer_id]) byId[it.transfer_id] = [];
        byId[it.transfer_id]!.push(it);
      }
      return rows.map((r: any) => mapTransfer(r as TransferDbRow, byId[r.id] || []));
    },
  });
}

export function useWarehouseTransfer(transferId: string | undefined) {
  return useQuery({
    queryKey: ['warehouse_transfer', VENUE_ID, transferId ?? ''],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('warehouse_transfers')
        .select('*, from_workshop:workshops!warehouse_transfers_from_workshop_id_fkey(name), to_workshop:workshops!warehouse_transfers_to_workshop_id_fkey(name), from_warehouse:warehouses!warehouse_transfers_from_warehouse_id_fkey(name), to_warehouse:warehouses!warehouse_transfers_to_warehouse_id_fkey(name)')
        .eq('id', transferId!)
        .eq('venue_id', VENUE_ID)
        .single();
      if (error) throw error;
      const { data: items, error: itemErr } = await supabase
        .from('warehouse_transfer_items')
        .select('*')
        .eq('transfer_id', transferId!);
      if (itemErr) throw itemErr;
      return mapTransfer(row as TransferDbRow, (items || []) as TransferItemDbRow[]);
    },
    enabled: Boolean(transferId),
  });
}

function invalidateTransferListAndDetails(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: Q_TR });
  qc.invalidateQueries({ queryKey: ['warehouse_transfer', VENUE_ID] });
}

async function ensureDestinationWarehouseProducts(
  toWarehouseId: string,
  items: { product_id: string }[]
) {
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  if (productIds.length === 0) return;
  const rows = productIds.map((productId) => ({
    warehouse_id: toWarehouseId,
    product_id: productId,
  }));
  const { error } = await supabase
    .from('warehouse_products')
    .upsert(rows, { onConflict: 'warehouse_id,product_id' });
  if (error) throw error;
}

export interface CreateTransferPayload {
  from_warehouse_id: string;
  to_warehouse_id: string;
  from_workshop_id?: string;
  to_workshop_id?: string;
  date: string;
  comment: string;
  items: { product_id: string; name: string; quantity: number; unit: string }[];
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: CreateTransferPayload) => {
      const { data, error } = await supabase
        .from('warehouse_transfers')
        .insert({
          venue_id: VENUE_ID,
          from_warehouse_id: p.from_warehouse_id,
          to_warehouse_id: p.to_warehouse_id,
          from_workshop_id: p.from_workshop_id || null,
          to_workshop_id: p.to_workshop_id || null,
          transfer_date: p.date,
          comment: p.comment,
          status: 'draft',
        })
        .select('id')
        .single();
      if (error) throw error;
      if (p.items.length > 0) {
        const { error: itemErr } = await supabase.from('warehouse_transfer_items').insert(
          p.items.map((i) => ({
            transfer_id: data.id,
            product_id: i.product_id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          }))
        );
        if (itemErr) throw itemErr;
      }
      await ensureDestinationWarehouseProducts(p.to_warehouse_id, p.items);
      return data.id as string;
    },
    onSettled: (_d, _e, vars) => {
      invalidateTransferListAndDetails(qc);
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients', vars?.to_warehouse_id] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients'] });
    },
  });
}

export interface UpdateTransferPayload {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  from_workshop_id?: string;
  to_workshop_id?: string;
  date: string;
  comment: string;
  items: { product_id: string; name: string; quantity: number; unit: string }[];
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: UpdateTransferPayload) => {
      const { data: row } = await supabase
        .from('warehouse_transfers')
        .select('status')
        .eq('id', p.id)
        .eq('venue_id', VENUE_ID)
        .single();
      const st = row?.status;
      if (st === 'posted') {
        await reverseTransferStockFallback(p.id);
      }

      const { error: upErr } = await supabase
        .from('warehouse_transfers')
        .update({
          from_warehouse_id: p.from_warehouse_id,
          to_warehouse_id: p.to_warehouse_id,
          from_workshop_id: p.from_workshop_id || null,
          to_workshop_id: p.to_workshop_id || null,
          transfer_date: p.date,
          comment: p.comment,
        })
        .eq('id', p.id)
        .eq('venue_id', VENUE_ID);
      if (upErr) throw upErr;

      await supabase.from('warehouse_transfer_items').delete().eq('transfer_id', p.id);
      if (p.items.length > 0) {
        const { error: insErr } = await supabase.from('warehouse_transfer_items').insert(
          p.items.map((i) => ({
            transfer_id: p.id,
            product_id: i.product_id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
          }))
        );
        if (insErr) throw insErr;
      }
      await ensureDestinationWarehouseProducts(p.to_warehouse_id, p.items);

      if (st === 'posted') {
        await applyTransferStockFallback(p.id);
      }
    },
    onSettled: (_d, _e, vars) => {
      invalidateTransferListAndDetails(qc);
      invalidateStockCaches(qc);
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients', vars?.to_warehouse_id] });
      qc.invalidateQueries({ queryKey: ['warehouse-ingredients'] });
    },
  });
}

export const usePostTransfer = useStatusMutation<TransferRow>({
  mutationFn: async (id) => { await finalizeWarehouseTransfer(id); },
  queryKey: Q_TR,
  statusLabel: 'Проведено',
  onSettled: (qc) => { invalidateTransferListAndDetails(qc); invalidateStockCaches(qc); },
});

export const useCancelTransfer = useStatusMutation<TransferRow>({
  mutationFn: async (id) => {
    const { data: row } = await supabase
      .from('warehouse_transfers').select('status')
      .eq('id', id).eq('venue_id', VENUE_ID).single();
    if (row?.status === 'posted') await reverseTransferStockFallback(id);
    const { error } = await supabase
      .from('warehouse_transfers').update({ status: 'cancelled' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_TR,
  statusLabel: 'Отменено',
  onSettled: (qc) => { invalidateTransferListAndDetails(qc); invalidateStockCaches(qc); },
});

export const useRestoreTransfer = useStatusMutation<TransferRow>({
  mutationFn: async (id) => {
    await applyTransferStockFallback(id);
    const { error } = await supabase
      .from('warehouse_transfers').update({ status: 'posted' })
      .eq('id', id).eq('venue_id', VENUE_ID);
    if (error) throw error;
  },
  queryKey: Q_TR,
  statusLabel: 'Проведено',
  onSettled: (qc) => { invalidateTransferListAndDetails(qc); invalidateStockCaches(qc); },
});

async function applyTransferStockFallback(transferId: string) {
  const { data: transfer } = await supabase
    .from('warehouse_transfers')
    .select('from_warehouse_id, to_warehouse_id')
    .eq('id', transferId)
    .single();
  if (!transfer) return;
  const fromWarehouseId = transfer.from_warehouse_id as string | null;
  const toWarehouseId = transfer.to_warehouse_id as string | null;
  if (!fromWarehouseId || !toWarehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_transfer_items')
    .select('id, product_id, unit, quantity')
    .eq('transfer_id', transferId);

  for (const line of lines || []) {
    if (!line.product_id) continue;
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    await applyStockDelta(fromWarehouseId, line.product_id, -qty, line.unit || 'кг');
    await applyStockDelta(toWarehouseId, line.product_id, qty, line.unit || 'кг');
  }
}

async function reverseTransferStockFallback(transferId: string) {
  const { data: transfer } = await supabase
    .from('warehouse_transfers')
    .select('from_warehouse_id, to_warehouse_id')
    .eq('id', transferId)
    .single();
  if (!transfer) return;
  const fromWarehouseId = transfer.from_warehouse_id as string | null;
  const toWarehouseId = transfer.to_warehouse_id as string | null;
  if (!fromWarehouseId || !toWarehouseId) return;

  const { data: lines } = await supabase
    .from('warehouse_transfer_items')
    .select('product_id, quantity, unit')
    .eq('transfer_id', transferId);

  for (const line of lines || []) {
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    if (!line.product_id) continue;
    await applyStockDelta(fromWarehouseId, line.product_id, qty, line.unit || 'кг');
    await applyStockDelta(toWarehouseId, line.product_id, -qty, line.unit || 'кг');
  }
}

async function finalizeWarehouseTransfer(transferId: string): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from('warehouse_transfers')
    .select('status')
    .eq('id', transferId)
    .eq('venue_id', VENUE_ID)
    .single();
  if (selErr) throw selErr;
  if (row?.status === 'posted') return;

  const rpcHint = readWarehouseStockRpcSessionCache();
  if (rpcHint === 'missing') {
    await applyTransferStockFallback(transferId);
  } else {
    const { error: rpcErr } = await supabase.rpc('apply_transfer_stock', { p_transfer_id: transferId });
    if (!rpcErr) {
      markWarehouseStockRpcOk();
    } else if (shouldUseWarehouseStockRpcFallback(rpcErr)) {
      markWarehouseStockRpcMissing();
      await applyTransferStockFallback(transferId);
    } else {
      throw rpcErr;
    }
  }
  const { error } = await supabase
    .from('warehouse_transfers')
    .update({ status: 'posted' })
    .eq('id', transferId)
    .eq('venue_id', VENUE_ID);
  if (error) throw error;
}
