-- Align admin period aggregates with POS: inventory_movements (+ warehouse_id).
-- Documents (deliveries/write-offs/transfers) still use workshop_id on headers;
-- they are scoped via workshop_warehouses for the given warehouse.
--
-- Replaces previous admin_inventory_period_movements implementation (inventory_ledger + p_workshop_id semantic).
-- Parameter types unchanged (uuid, uuid, timestamptz, timestamptz); arg2 is now warehouse_id.

CREATE OR REPLACE FUNCTION public.admin_inventory_period_movements(
  p_venue_id uuid,
  p_warehouse_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  product_id uuid,
  consumption numeric,
  incoming_delivery numeric,
  writeoff_qty numeric,
  transfer_net numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  -- POS schema (r_keeper): quantity_delta (negative on sale), reason enum (sale | waste | supply | adjustment).
  cons AS (
    SELECT im.product_id,
           COALESCE(SUM(ABS(COALESCE(im.quantity_delta, 0))), 0)::numeric AS qty
    FROM public.inventory_movements im
    WHERE im.venue_id = p_venue_id
      AND im.warehouse_id = p_warehouse_id
      AND im.occurred_at >= p_from
      AND im.occurred_at < p_to
      AND im.reason IN ('sale', 'waste')
      AND im.product_id IS NOT NULL
    GROUP BY im.product_id
  ),
  deliv AS (
    SELECT di.product_id,
           COALESCE(SUM(di.quantity), 0)::numeric AS qty
    FROM public.warehouse_delivery_items di
    JOIN public.warehouse_deliveries d ON d.id = di.delivery_id
    WHERE d.venue_id = p_venue_id
      AND d.status = 'received'
      AND d.delivery_date >= p_from
      AND d.delivery_date < p_to
      AND di.product_id IS NOT NULL
      AND d.warehouse_id = p_warehouse_id
    GROUP BY di.product_id
  ),
  woff AS (
    SELECT wi.product_id,
           COALESCE(SUM(wi.quantity), 0)::numeric AS qty
    FROM public.warehouse_write_off_items wi
    JOIN public.warehouse_write_offs w ON w.id = wi.write_off_id
    WHERE w.venue_id = p_venue_id
      AND w.status = 'posted'
      AND w.write_off_date >= p_from
      AND w.write_off_date < p_to
      AND wi.product_id IS NOT NULL
      AND w.warehouse_id = p_warehouse_id
    GROUP BY wi.product_id
  ),
  xfer AS (
    SELECT x.product_id,
           COALESCE(SUM(x.signed_qty), 0)::numeric AS net
    FROM (
      SELECT ti.dest_product_id AS product_id,
             ti.quantity AS signed_qty
      FROM public.warehouse_transfer_items ti
      JOIN public.warehouse_transfers t ON t.id = ti.transfer_id
      WHERE t.venue_id = p_venue_id
        AND t.status = 'posted'
        AND t.transfer_date >= p_from
        AND t.transfer_date < p_to
        AND ti.dest_product_id IS NOT NULL
        AND t.to_warehouse_id = p_warehouse_id

      UNION ALL

      SELECT ti.product_id AS product_id,
             -ti.quantity AS signed_qty
      FROM public.warehouse_transfer_items ti
      JOIN public.warehouse_transfers t ON t.id = ti.transfer_id
      WHERE t.venue_id = p_venue_id
        AND t.status = 'posted'
        AND t.transfer_date >= p_from
        AND t.transfer_date < p_to
        AND ti.product_id IS NOT NULL
        AND t.from_warehouse_id = p_warehouse_id
    ) x
    GROUP BY x.product_id
  ),
  all_p AS (
    SELECT cons.product_id FROM cons
    UNION SELECT deliv.product_id FROM deliv
    UNION SELECT woff.product_id FROM woff
    UNION SELECT xfer.product_id FROM xfer
  )
  SELECT ap.product_id,
         COALESCE(c.qty, 0)::numeric AS consumption,
         COALESCE(d.qty, 0)::numeric AS incoming_delivery,
         COALESCE(w.qty, 0)::numeric AS writeoff_qty,
         COALESCE(x.net, 0)::numeric AS transfer_net
  FROM all_p ap
  LEFT JOIN cons c ON c.product_id = ap.product_id
  LEFT JOIN deliv d ON d.product_id = ap.product_id
  LEFT JOIN woff w ON w.product_id = ap.product_id
  LEFT JOIN xfer x ON x.product_id = ap.product_id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_inventory_period_movements(uuid, uuid, timestamptz, timestamptz)
  TO anon, authenticated;
