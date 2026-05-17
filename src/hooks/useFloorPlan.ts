import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, VENUE_ID, FLOOR_PLAN_ZONE_ID, LEGACY_ADMIN_ZONE_ID } from '@/lib/supabase';
import type { FloorTable, Zone } from '../../types/floor-plan';

const STORAGE_KEY = 'rkeeper-floor-plan';

const initialTables: FloorTable[] = [
  { id: '1', name: '1', shape: 'square', x: 1, y: 1, width: 2, height: 2, seats: 4 },
  { id: '2', name: '2', shape: 'square', x: 3, y: 1, width: 2, height: 2, seats: 4 },
  { id: '3', name: '3', shape: 'circle', x: 1, y: 3, width: 2, height: 2, seats: 6 },
  { id: '4', name: '4', shape: 'circle', x: 3, y: 3, width: 2, height: 2, seats: 6 },
  { id: '5', name: '5', shape: 'square', x: 1, y: 5, width: 2, height: 2, seats: 4 },
  { id: '6', name: '6', shape: 'square', x: 3, y: 5, width: 2, height: 2, seats: 4 },
  { id: '7', name: '7', shape: 'circle', x: 5, y: 5, width: 2, height: 2, seats: 8 },
  { id: 'lounge', name: 'Лаунж', shape: 'square', x: 0, y: 9, width: 2, height: 2, seats: 0 },
  { id: 'bar', name: 'Бар', shape: 'square', x: 6, y: 9, width: 2, height: 2, seats: 0 },
  { id: 'takeout', name: 'Навынос', shape: 'square', x: 12, y: 9, width: 2, height: 2, seats: 0 },
];

const initialZones: Zone[] = [];

function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) console.log(...args);
}

function mapDbRowToFloorTable(row: {
  id: string;
  number: string;
  col: number;
  row: number;
  col_span?: number | null;
  row_span?: number | null;
  capacity?: number | null;
  size?: string | null;
}): FloorTable {
  const size = (row.size || '').toLowerCase();
  const shape: FloorTable['shape'] =
    size === 'circle' ? 'circle' : 'square';
  return {
    id: row.id,
    name: row.number,
    shape,
    x: row.col ?? 0,
    y: row.row ?? 0,
    width: row.col_span ?? 2,
    height: row.row_span ?? 2,
    seats: row.capacity ?? 0,
  };
}

async function loadTablesFromSupabase(): Promise<FloorTable[] | null> {
  const { data, error } = await supabase
    .from('tables')
    .select('id, number, col, row, col_span, row_span, capacity, size')
    .eq('venue_id', VENUE_ID)
    .eq('zone_id', FLOOR_PLAN_ZONE_ID)
    .order('number');

  if (error) {
    devLog('[floor plan] hydrate error', error);
    return null;
  }
  if (!data?.length) return null;
  return data.map((row) => mapDbRowToFloorTable(row as Parameters<typeof mapDbRowToFloorTable>[0]));
}

export function useFloorPlan() {
  const hydratedRef = useRef(false);

  const [tables, setTables] = useState<FloorTable[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.tables || initialTables;
      } catch {
        return initialTables;
      }
    }
    return initialTables;
  });

  const [zones] = useState<Zone[]>(initialZones);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    let cancelled = false;
    (async () => {
      const fromDb = await loadTablesFromSupabase();
      if (cancelled || !fromDb?.length) return;
      setTables(fromDb);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ tables: fromDb }));
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveToStorage = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tables }));
  }, [tables]);

  useEffect(() => {
    saveToStorage();
  }, [tables, saveToStorage]);

  const moveTable = useCallback((id: string, x: number, y: number) => {
    setTables((prev) =>
      prev.map((table) => (table.id === id ? { ...table, x, y } : table))
    );
  }, []);

  const resizeTable = useCallback((id: string, width: number, height: number) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === id ? { ...table, width: Math.max(2, width), height: Math.max(2, height) } : table
      )
    );
  }, []);

  const findEmptySpot = useCallback((currentTables: FloorTable[]) => {
    const maxX = 22;
    const maxY = 12;

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX; x++) {
        const isOccupied = currentTables.some((t) => {
          const tRight = t.x + (t.width || 2);
          const tBottom = t.y + (t.height || 2);
          const newRight = x + 2;
          const newBottom = y + 2;
          return x < tRight && newRight > t.x && y < tBottom && newBottom > t.y;
        });

        if (!isOccupied) {
          return { x, y };
        }
      }
    }

    return { x: 0, y: 0 };
  }, []);

  const addTable = useCallback(
    (table: Omit<FloorTable, 'id' | 'x' | 'y' | 'width' | 'height' | 'seats'> & { seats?: number }) => {
      const newId = String(Date.now());
      const { x, y } = findEmptySpot(tables);
      const newTable = { seats: 0, width: 2, height: 2, ...table, id: newId, x, y };
      setTables((prev) => [...prev, newTable]);
      return newTable;
    },
    [tables, findEmptySpot]
  );

  const removeTable = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTable = useCallback((id: string, updates: Partial<Omit<FloorTable, 'id'>>) => {
    setTables((prev) =>
      prev.map((table) => (table.id === id ? { ...table, ...updates } : table))
    );
  }, []);

  const getNextTableNumber = useCallback(() => {
    const numbers = tables
      .map((t) => parseInt(t.name, 10))
      .filter((n) => !isNaN(n));
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return String(max + 1);
  }, [tables]);

  const lastSyncedAtRef = useRef<string | null>(null);

  const syncToSupabase = useCallback(async () => {
    const ZONE_ID = FLOOR_PLAN_ZONE_ID;

    // 1. Read zone's updated_at for optimistic lock (if column exists)
    const { data: zoneRow } = await supabase
      .from('zones')
      .select('updated_at')
      .eq('id', ZONE_ID)
      .maybeSingle();

    const remoteUpdatedAt = (zoneRow as { updated_at?: string } | null)?.updated_at ?? null;

    if (lastSyncedAtRef.current && remoteUpdatedAt && remoteUpdatedAt !== lastSyncedAtRef.current) {
      const overwrite = confirm(
        'Схема зала была изменена другим пользователем с момента вашей последней синхронизации.\n\nПерезаписать?'
      );
      if (!overwrite) return tables.length;
    }

    const { data: zoneTables } = await supabase
      .from('tables')
      .select('id, number')
      .eq('zone_id', ZONE_ID);

    const { data: allVenueTables } = await supabase
      .from('tables')
      .select('id, number')
      .eq('venue_id', VENUE_ID);

    const { data: oldTables } = await supabase
      .from('tables')
      .select('id, number')
      .eq('zone_id', LEGACY_ADMIN_ZONE_ID);

    const seedByNumber: Record<string, string> = {};
    for (const t of allVenueTables || []) {
      seedByNumber[t.number] = t.id;
    }

    devLog('[sync] zoneTables in DB:', zoneTables?.map((t) => t.number));
    devLog('[sync] admin tables:', tables.map((t) => t.name));

    if (oldTables && oldTables.length > 0) {
      for (const old of oldTables) {
        const seedId = seedByNumber[old.number];
        if (seedId) {
          await supabase.from('orders').update({ table_id: seedId }).eq('table_id', old.id);
        }
      }
      for (const old of oldTables) {
        await supabase.from('tables').delete().eq('id', old.id);
      }
      await supabase.from('zones').delete().eq('id', LEGACY_ADMIN_ZONE_ID);
    }

    const { error: zoneError } = await supabase.from('zones').upsert({
      id: ZONE_ID,
      venue_id: VENUE_ID,
      name: 'Основной зал',
      grid_cols: 24,
      grid_rows: 14,
      sort_order: 0,
    });

    if (zoneError) throw zoneError;

    const adminNumbers = new Set(tables.map((t) => t.name));

    for (const t of tables) {
      const existingId = seedByNumber[t.name];
      const payload = {
        capacity: t.seats || 0,
        col: t.x,
        row: t.y,
        col_span: t.width || 2,
        row_span: t.height || 2,
        size: t.shape === 'circle' ? 'circle' : 'square',
      };

      if (existingId) {
        await supabase.from('tables').update(payload).eq('id', existingId);
      } else {
        await supabase.from('tables').insert({
          venue_id: VENUE_ID,
          zone_id: ZONE_ID,
          number: t.name,
          ...payload,
        });
      }
    }

    for (const zoneTable of zoneTables || []) {
      if (!adminNumbers.has(zoneTable.number)) {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('table_id', zoneTable.id)
          .in('status', ['active', 'alert']);

        devLog(`[sync] delete candidate: ${zoneTable.number}, orders count: ${count}`);

        if ((count ?? 0) === 0) {
          await supabase.from('orders').update({ table_id: null }).eq('table_id', zoneTable.id);

          const { error: delError } = await supabase.from('tables').delete().eq('id', zoneTable.id);
          devLog(`[sync] deleted table ${zoneTable.number}:`, delError ?? 'ok');
        }
      }
    }

    // Record the zone's updated_at after sync for next conflict check
    const { data: afterZone } = await supabase
      .from('zones')
      .select('updated_at')
      .eq('id', ZONE_ID)
      .maybeSingle();
    lastSyncedAtRef.current = (afterZone as { updated_at?: string } | null)?.updated_at ?? null;

    return tables.length;
  }, [tables]);

  return {
    tables,
    zones,
    moveTable,
    resizeTable,
    addTable,
    removeTable,
    updateTable,
    saveToStorage,
    getNextTableNumber,
    syncToSupabase,
  };
}
