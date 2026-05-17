import { supabase } from '@/lib/supabase';

/** workshop_id -> sorted distinct warehouse_ids */
export async function fetchWorkshopToWarehouseIds(
  workshopIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const unique = [...new Set(workshopIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from('workshop_warehouses')
    .select('workshop_id, warehouse_id')
    .in('workshop_id', unique);

  if (error) throw error;

  for (const row of data ?? []) {
    const w = row.workshop_id as string | undefined;
    const wh = row.warehouse_id as string | undefined;
    if (!w || !wh) continue;
    const arr = map.get(w) ?? [];
    arr.push(wh);
    map.set(w, arr);
  }

  for (const [k, whs] of map) {
    map.set(k, [...new Set(whs)].sort());
  }
  return map;
}

export interface IngredientStockKey {
  id: string;
  workshop_id: string | null;
}

/** Per-ingredient totals: sum of stock_items.quantity across all warehouses for each product. */
export async function fetchIngredientStockTotals(
  ingredients: IngredientStockKey[],
  whByWorkshop?: Map<string, string[]>
): Promise<Map<string, number>> {
  void whByWorkshop;
  const totals = new Map<string, number>();
  for (const ing of ingredients) {
    totals.set(ing.id, 0);
  }

  const productIds = ingredients.map((i) => i.id);
  if (productIds.length === 0) return totals;

  const { data: rows, error } = await supabase
    .from('stock_items')
    .select('product_id, quantity')
    .in('product_id', productIds);

  if (error) throw error;

  for (const row of rows ?? []) {
    const pid = row.product_id as string;
    const q = Number(row.quantity) || 0;
    totals.set(pid, (totals.get(pid) ?? 0) + q);
  }

  return totals;
}

/** True when this workshop has at least one linked warehouse (POS path). */
export function workshopHasWarehouse(
  workshopId: string | null | undefined,
  whByWorkshop: Map<string, string[]>
): boolean {
  if (!workshopId) return false;
  return (whByWorkshop.get(workshopId)?.length ?? 0) > 0;
}

/**
 * Writes live stock to stock_items (POS source of truth).
 * When a workshop maps to several warehouses, the full quantity is stored on the first warehouse (sorted id); others are set to 0 for this product.
 */
export async function upsertIngredientStockItems(
  productId: string,
  workshopId: string | null,
  quantity: number,
  unit: string
): Promise<{ ok: false; message: string } | { ok: true }> {
  if (!workshopId) return { ok: true };

  const whByWorkshop = await fetchWorkshopToWarehouseIds([workshopId]);
  const whIds = whByWorkshop.get(workshopId) ?? [];
  if (whIds.length === 0) return { ok: true };

  const now = new Date().toISOString();

  for (let i = 0; i < whIds.length; i++) {
    const wh = whIds[i]!;
    const q = i === 0 ? quantity : 0;
    const { error } = await supabase.from('stock_items').upsert(
      {
        warehouse_id: wh,
        product_id: productId,
        quantity: q,
        unit,
        updated_at: now,
      },
      { onConflict: 'warehouse_id,product_id' }
    );
    if (error) return { ok: false, message: error.message };
  }

  return { ok: true };
}
