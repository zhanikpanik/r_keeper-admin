import { supabase, VENUE_ID } from '@/lib/supabase';
import type { AdminInventoryPeriodMovementRow } from '@/types/inventoryMovements';

/** Resolve a workshop UUID to its default warehouse UUID.
 *  Falls back to workshop_warehouses if default_warehouse_id is null. */
export async function resolveWorkshopToWarehouseId(
  workshopId: string
): Promise<string | null> {
  if (!workshopId) return null;

  const { data: ws } = await supabase
    .from('workshops')
    .select('default_warehouse_id')
    .eq('id', workshopId)
    .maybeSingle();

  if (ws?.default_warehouse_id) return ws.default_warehouse_id as string;

  const { data: ww } = await supabase
    .from('workshop_warehouses')
    .select('warehouse_id')
    .eq('workshop_id', workshopId)
    .limit(1)
    .maybeSingle();

  return (ww?.warehouse_id as string) ?? null;
}

export function formatInventoryMovementPeriodHint(pFrom: string, pTo: string): string {
  const a = new Date(pFrom).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const b = new Date(pTo).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Справочно: движения с ${a} по ${b}`;
}

export async function resolveInventoryMovementWindow(
  sessionId: string,
  warehouseId: string
): Promise<{ pFrom: string; pTo: string; label: string } | null> {
  const { data: sessionRow, error } = await supabase
    .from('warehouse_inventory_sessions')
    .select('conducted_at')
    .eq('id', sessionId)
    .eq('venue_id', VENUE_ID)
    .single();

  if (error || !sessionRow?.conducted_at) return null;

  const pTo = sessionRow.conducted_at as string;

  const { data: prev } = await supabase
    .from('warehouse_inventory_sessions')
    .select('conducted_at')
    .eq('venue_id', VENUE_ID)
    .eq('warehouse_id', warehouseId)
    .eq('status', 'posted')
    .lt('conducted_at', pTo)
    .order('conducted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const pFrom = (prev?.conducted_at as string) ?? '1970-01-01T00:00:00.000Z';
  return {
    pFrom,
    pTo,
    label: formatInventoryMovementPeriodHint(pFrom, pTo),
  };
}

function mergeMovementMaps(
  maps: Map<string, AdminInventoryPeriodMovementRow>[]
): Map<string, AdminInventoryPeriodMovementRow> {
  const out = new Map<string, AdminInventoryPeriodMovementRow>();
  for (const m of maps) {
    for (const [productId, row] of m) {
      const prev = out.get(productId);
      if (!prev) {
        out.set(productId, { ...row });
      } else {
        out.set(productId, {
          product_id: productId,
          consumption: prev.consumption + row.consumption,
          incoming_delivery: prev.incoming_delivery + row.incoming_delivery,
          writeoff_qty: prev.writeoff_qty + row.writeoff_qty,
          transfer_net: prev.transfer_net + row.transfer_net,
        });
      }
    }
  }
  return out;
}

async function fetchAdminInventoryPeriodMovementsForWarehouse(
  venueId: string,
  warehouseId: string,
  pFrom: string,
  pTo: string
): Promise<Map<string, AdminInventoryPeriodMovementRow>> {
  const map = new Map<string, AdminInventoryPeriodMovementRow>();

  const { data, error } = await supabase.rpc('admin_inventory_period_movements', {
    p_venue_id: venueId,
    p_warehouse_id: warehouseId,
    p_from: pFrom,
    p_to: pTo,
  });

  if (error) {
    console.warn('[inventory] admin_inventory_period_movements:', error.message);
    return map;
  }

  for (const raw of data ?? []) {
    const row = raw as AdminInventoryPeriodMovementRow;
    if (!row?.product_id) continue;
    map.set(row.product_id, {
      product_id: row.product_id,
      consumption: Number(row.consumption) || 0,
      incoming_delivery: Number(row.incoming_delivery) || 0,
      writeoff_qty: Number(row.writeoff_qty) || 0,
      transfer_net: Number(row.transfer_net) || 0,
    });
  }

  return map;
}

/** Map product_id -> movement aggregates (all warehouses linked to the workshop). Empty if no mapping or RPC fails. */
export async function fetchAdminInventoryPeriodMovements(
  venueId: string,
  warehouseId: string,
  pFrom: string,
  pTo: string
): Promise<Map<string, AdminInventoryPeriodMovementRow>> {
  if (!warehouseId) return new Map();
  const single = await fetchAdminInventoryPeriodMovementsForWarehouse(
    venueId,
    warehouseId,
    pFrom,
    pTo
  );
  return mergeMovementMaps([single]);
}

export function mergePeriodMovementsIntoCountRows<
  T extends { id: string; incoming: number; consumption: number; writeoff: number },
>(rows: T[], movements: Map<string, AdminInventoryPeriodMovementRow>): T[] {
  return rows.map((r) => {
    const m = movements.get(r.id);
    if (!m) return { ...r };
    const t = m.transfer_net;
    const incoming = m.incoming_delivery + Math.max(t, 0);
    const writeoff = m.writeoff_qty + Math.max(-t, 0);
    return {
      ...r,
      incoming,
      consumption: m.consumption,
      writeoff,
    };
  });
}
