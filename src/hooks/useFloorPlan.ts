import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { FloorTable, Zone } from '../../types/floor-plan';

const STORAGE_KEY = 'rkeeper-floor-plan';

const initialTables: FloorTable[] = [
  { id: '1', name: '1', shape: 'square', x: 1, y: 1, seats: 4 },
  { id: '2', name: '2', shape: 'square', x: 3, y: 1, seats: 4 },
  { id: '3', name: '3', shape: 'circle', x: 1, y: 3, seats: 6 },
  { id: '4', name: '4', shape: 'circle', x: 3, y: 3, seats: 6 },
  { id: '5', name: '5', shape: 'square', x: 1, y: 5, seats: 4 },
  { id: '6', name: '6', shape: 'square', x: 3, y: 5, seats: 4 },
  { id: '7', name: '7', shape: 'circle', x: 5, y: 5, seats: 8 },
  { id: 'lounge', name: 'Лаунж', shape: 'square', x: 0, y: 9, seats: 0 },
  { id: 'bar', name: 'Бар', shape: 'square', x: 6, y: 9, seats: 0 },
  { id: 'takeout', name: 'Навынос', shape: 'square', x: 12, y: 9, seats: 0 },
];

const initialZones: Zone[] = [];

export function useFloorPlan() {
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

  const saveToStorage = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tables }));
  }, [tables]);

  useEffect(() => {
    saveToStorage();
  }, [tables, saveToStorage]);

  const moveTable = useCallback((id: string, x: number, y: number) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === id ? { ...table, x, y } : table
      )
    );
  }, []);

  const findEmptySpot = useCallback((currentTables: FloorTable[]) => {
    const maxX = 18; // 20 cols - 2 (table width)
    const maxY = 13; // 15 rows - 2 (table height)

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX; x++) {
        // Check if this 2x2 spot is free
        const isOccupied = currentTables.some((t) => {
          const tRight = t.x + 2;
          const tBottom = t.y + 2;
          const newRight = x + 2;
          const newBottom = y + 2;
          // Check overlap
          return x < tRight && newRight > t.x && y < tBottom && newBottom > t.y;
        });

        if (!isOccupied) {
          return { x, y };
        }
      }
    }

    // Fallback to (0, 0) if grid is full
    return { x: 0, y: 0 };
  }, []);

  const addTable = useCallback(
    (table: Omit<FloorTable, 'id' | 'x' | 'y' | 'seats'> & { seats?: number }) => {
      const newId = String(Date.now());
      const { x, y } = findEmptySpot(tables);
      const newTable = { seats: 0, ...table, id: newId, x, y };
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
      prev.map((table) =>
        table.id === id ? { ...table, ...updates } : table
      )
    );
  }, []);

  const getNextTableNumber = useCallback(() => {
    const numbers = tables
      .map((t) => parseInt(t.name, 10))
      .filter((n) => !isNaN(n));
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return String(max + 1);
  }, [tables]);

  // Sync tables to Supabase for POS app
  const syncToSupabase = useCallback(async () => {
    const VENUE_ID = '00000000-0000-0000-0000-000000000010';
    const ZONE_ID = '00000000-0000-0000-0000-000000000100';

    // Ensure zone exists
    const { error: zoneError } = await supabase
      .from('zones')
      .upsert({
        id: ZONE_ID,
        venue_id: VENUE_ID,
        name: 'Основной зал',
        grid_cols: 24,
        grid_rows: 14,
        sort_order: 0,
      });

    if (zoneError) throw zoneError;

    // Delete existing tables for this venue/zone
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .eq('venue_id', VENUE_ID)
      .eq('zone_id', ZONE_ID);

    if (deleteError) {
      console.warn('Delete warning (may be empty):', deleteError);
      // Continue anyway — might be no existing tables
    }

    // Convert admin tables to POS format
    const posTables = tables.map((t) => ({
      venue_id: VENUE_ID,
      zone_id: ZONE_ID,
      number: t.name,
      capacity: t.seats || 0,
      col: t.x,
      row: t.y,
      size: 'regular', // Both shapes same size in POS (2x1)
    }));

    // Insert new tables
    const { error: insertError } = await supabase
      .from('tables')
      .insert(posTables);

    if (insertError) throw insertError;

    return posTables.length;
  }, [tables]);

  return {
    tables,
    zones,
    moveTable,
    addTable,
    removeTable,
    updateTable,
    saveToStorage,
    getNextTableNumber,
    syncToSupabase,
  };
}
