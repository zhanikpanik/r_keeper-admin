import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import type { FloorTable } from '../../types/floor-plan';

const GRID_COLS = 24;
const GRID_ROWS = 14;

const initialTables: FloorTable[] = [];

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
  const shape: FloorTable['shape'] = size === 'circle' ? 'circle' : 'square';
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

interface ZoneItem {
  id: string;
  name: string;
}

async function fetchZones(): Promise<ZoneItem[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('id, name')
    .eq('venue_id', VENUE_ID)
    .order('name');

  if (error) {
    devLog('[floor plan] zones error', error);
    return [];
  }
  return (data || []) as ZoneItem[];
}

async function loadTablesFromSupabase(zoneId: string): Promise<FloorTable[]> {
  const { data, error } = await supabase
    .from('tables')
    .select('id, number, col, row, col_span, row_span, capacity, size')
    .eq('venue_id', VENUE_ID)
    .eq('zone_id', zoneId)
    .order('number');

  if (error) {
    devLog('[floor plan] hydrate error', error);
    return [];
  }
  if (!data?.length) return [];
  return data.map((row) => mapDbRowToFloorTable(row as Parameters<typeof mapDbRowToFloorTable>[0]));
}

async function saveTablesToSupabaseRef(tables: FloorTable[], zoneId: string) {
  const { error: delErr } = await supabase
    .from('tables')
    .delete()
    .eq('venue_id', VENUE_ID)
    .eq('zone_id', zoneId);

  if (delErr) throw delErr;

  if (tables.length > 0) {
    const rows = tables.map((t) => ({
      venue_id: VENUE_ID,
      zone_id: zoneId,
      number: t.name,
      col: t.x,
      row: t.y,
      col_span: t.width || 2,
      row_span: t.height || 2,
      capacity: t.seats,
      size: t.shape === 'circle' ? 'circle' : 'square',
    }));
    const { error: insErr } = await supabase.from('tables').insert(rows);
    if (insErr) throw insErr;
  }
}

export function useFloorPlan(zoneId: string | null) {
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [tables, setTables] = useState<FloorTable[]>(initialTables);
  const zoneIdRef = useRef(zoneId);
  zoneIdRef.current = zoneId;

  // Load zones on mount
  useEffect(() => {
    let cancelled = false;
    fetchZones().then((z) => {
      if (!cancelled) {
        setZones(z);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Load tables when zone changes
  useEffect(() => {
    if (!zoneId) {
      setTables(initialTables);
      return;
    }

    let cancelled = false;
    loadTablesFromSupabase(zoneId).then((fromDb) => {
      if (cancelled) return;
      setTables(fromDb.length > 0 ? fromDb : initialTables);
    });

    return () => { cancelled = true; };
  }, [zoneId]);

  const moveTable = useCallback((id: string, x: number, y: number) => {
    setTables((prev) => {
      const next = prev.map((table) => (table.id === id ? { ...table, x, y } : table));
      saveTablesToSupabase(next);
      return next;
    });
  }, [zoneId]);

  const resizeTable = useCallback((id: string, width: number, height: number) => {
    setTables((prev) => {
      const next = prev.map((table) =>
        table.id === id ? { ...table, width: Math.max(2, width), height: Math.max(2, height) } : table
      );
      saveTablesToSupabase(next);
      return next;
    });
  }, [zoneId]);

  const findEmptySpot = useCallback((currentTables: FloorTable[]) => {
    for (let y = 0; y <= GRID_ROWS - 2; y++) {
      for (let x = 0; x <= GRID_COLS - 2; x++) {
        const isOccupied = currentTables.some((t) => {
          const tRight = t.x + (t.width || 2);
          const tBottom = t.y + (t.height || 2);
          return x < tRight && x + 2 > t.x && y < tBottom && y + 2 > t.y;
        });
        if (!isOccupied) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }, []);

  const getNextTableNumber = useCallback(() => {
    const nums = tables
      .map((t) => parseInt(t.name, 10))
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1);
  }, [tables]);

  const addTable = useCallback((shape: FloorTable['shape'], seats: number) => {
    setTables((prev) => {
      const spot = findEmptySpot(prev);
      const nums = prev.map((t) => parseInt(t.name, 10)).filter((n) => !isNaN(n));
      const number = String((nums.length > 0 ? Math.max(...nums) : 0) + 1);
      const newTable: FloorTable = {
        id: crypto.randomUUID(),
        name: number,
        shape,
        x: spot.x,
        y: spot.y,
        width: 2,
        height: 2,
        seats,
      };
      const next = [...prev, newTable];
      saveTablesToSupabase(next);
      return next;
    });
  }, [findEmptySpot, zoneId]);

  const removeTable = useCallback((id: string) => {
    setTables((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTablesToSupabase(next);
      return next;
    });
  }, [zoneId]);

  const updateTable = useCallback((id: string, updates: Partial<FloorTable>) => {
    setTables((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      saveTablesToSupabase(next);
      return next;
    });
  }, [zoneId]);

  const saveTablesToSupabase = useCallback((currentTables: FloorTable[]) => {
    const zid = zoneIdRef.current;
    if (!zid) return;
    saveTablesToSupabaseRef(currentTables, zid).catch(() => {});
  }, []);

  // Zone CRUD
  const createZone = useCallback(async (name: string): Promise<string> => {
    const { data, error } = await supabase
      .from('zones')
      .insert({ venue_id: VENUE_ID, name: name.trim() })
      .select('id')
      .single();

    if (error) throw error;
    const id = (data as { id: string }).id;
    setZones((prev) => [...prev, { id, name: name.trim() }]);
    return id;
  }, []);

  const renameZone = useCallback(async (id: string, name: string) => {
    const { error } = await supabase
      .from('zones')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('venue_id', VENUE_ID);

    if (error) throw error;
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, name: name.trim() } : z)));
  }, []);

  const deleteZone = useCallback(async (id: string) => {
    // Delete tables first
    await supabase.from('tables').delete().eq('zone_id', id).eq('venue_id', VENUE_ID);
    const { error } = await supabase
      .from('zones')
      .delete()
      .eq('id', id)
      .eq('venue_id', VENUE_ID);

    if (error) throw error;
    setZones((prev) => prev.filter((z) => z.id !== id));
    hydratedRef.current[id] = false;
  }, []);

  return {
    tables,
    zones,
    moveTable,
    resizeTable,
    addTable,
    removeTable,
    updateTable,
    getNextTableNumber,
    createZone,
    renameZone,
    deleteZone,
  };
}
