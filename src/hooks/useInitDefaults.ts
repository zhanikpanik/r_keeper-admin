import { useEffect, useRef } from 'react';
import { supabase, VENUE_ID } from '@/lib/supabase';

/**
 * Ensures default workshops (Кухня, Бар) and their matching warehouses exist.
 * Connects each workshop to its warehouse via default_warehouse_id.
 * Runs once per app session.
 */
export function useInitDefaults() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    initDefaults().catch((err) => {
      console.warn('useInitDefaults: skipped (RLS or missing tables)', err);
    });
  }, []);
}

async function initDefaults() {
  // 1. Ensure default warehouses: Кухня, Бар
  const whNames = ['Кухня', 'Бар'];
  const whIds: Record<string, string> = {};

  for (const name of whNames) {
    // Use .select() instead of .maybeSingle() — the latter returns null
    // when multiple rows exist (PGRST116), causing runaway duplicates.
    const { data: rows } = await supabase
      .from('warehouses')
      .select('id, created_at')
      .eq('venue_id', VENUE_ID)
      .eq('name', name)
      .order('created_at', { ascending: false });

    if (rows && rows.length > 0) {
      // Keep the newest one as canonical
      whIds[name] = (rows[0] as { id: string }).id;

      // Clean up duplicates (keep newest, delete older ones)
      if (rows.length > 1) {
        const duplicates = rows.slice(1).map((r) => (r as { id: string }).id);
        await supabase
          .from('warehouses')
          .delete()
          .in('id', duplicates)
          .eq('venue_id', VENUE_ID);
      }
    } else {
      const { data: created } = await supabase
        .from('warehouses')
        .insert({ venue_id: VENUE_ID, name })
        .select('id')
        .single();

      if (created) {
        whIds[name] = (created as { id: string }).id;
      }
    }
  }

  // 2. Ensure default workshops: Кухня → Кухня warehouse, Бар → Бар warehouse
  const wsEntries: { name: string; warehouseName: string }[] = [
    { name: 'Кухня', warehouseName: 'Кухня' },
    { name: 'Бар', warehouseName: 'Бар' },
  ];

  const existingWsMap = new Map<string, string>();
  {
    const { data: allWs } = await supabase
      .from('workshops')
      .select('id, name')
      .eq('venue_id', VENUE_ID);

    for (const ws of (allWs ?? [])) {
      existingWsMap.set((ws as { name: string }).name, (ws as { id: string }).id);
    }
  }

  for (const { name, warehouseName } of wsEntries) {
    const warehouseId = whIds[warehouseName] || null;

    if (existingWsMap.has(name)) {
      // Update existing workshop's default_warehouse_id
      await supabase
        .from('workshops')
        .update({ default_warehouse_id: warehouseId })
        .eq('id', existingWsMap.get(name)!)
        .eq('venue_id', VENUE_ID);
    } else {
      // Get max sort_order
      const { data: sortRow } = await supabase
        .from('workshops')
        .select('sort_order')
        .eq('venue_id', VENUE_ID)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSort = (Number((sortRow as { sort_order?: number } | null)?.sort_order) || 0) + 1;

      await supabase.from('workshops').insert({
        venue_id: VENUE_ID,
        name,
        sort_order: nextSort,
        default_warehouse_id: warehouseId,
      });
    }
  }
}
