import { useRef, useState, useEffect, useCallback } from 'react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { FloorPlanToolbar } from './FloorPlanToolbar';
import { ZoneBlock } from './ZoneBlock';
import { DraggableTable } from './DraggableTable';
import { AddTableModal } from './AddTableModal';
import type { FloorTable } from '../../../types/floor-plan';
import { toast } from 'sonner';

const CELL_SIZE = 48;
const GRID_COLS = 24;
const GRID_ROWS = 14;
const TABLE_CELLS = 2; // Tables are 2x2 cells

export function FloorPlanGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggedTableRef = useRef<FloorTable | null>(null);
  const [newTableId, setNewTableId] = useState<string | null>(null);

  const {
    tables,
    zones,
    moveTable,
    addTable,
    updateTable,
    saveToStorage,
    getNextTableNumber,
    syncToSupabase,
  } = useFloorPlan();

  const handleMouseDown = useCallback((e: React.MouseEvent, table: FloorTable) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear new table highlight when user starts dragging
    if (newTableId === table.id) {
      setNewTableId(null);
    }

    if (!gridRef.current) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    const offsetX = e.clientX - gridRect.left - table.x * CELL_SIZE;
    const offsetY = e.clientY - gridRect.top - table.y * CELL_SIZE;

    dragOffsetRef.current = { x: offsetX, y: offsetY };
    draggedTableRef.current = table;
    setDraggingTableId(table.id);

    // Set initial CSS variable position
    const tableEl = document.querySelector(`[data-table-id="${table.id}"]`) as HTMLElement;
    if (tableEl) {
      tableEl.style.setProperty('--drag-x', '0px');
      tableEl.style.setProperty('--drag-y', '0px');
    }
  }, [newTableId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingTableId || !gridRef.current || !draggedTableRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const rawX = e.clientX - gridRect.left - dragOffsetRef.current.x;
      const rawY = e.clientY - gridRect.top - dragOffsetRef.current.y;

      // Direct DOM update via CSS variables - no React re-render!
      const tableEl = document.querySelector(`[data-table-id="${draggingTableId}"]`) as HTMLElement;
      if (tableEl) {
        const baseX = draggedTableRef.current.x * CELL_SIZE;
        const baseY = draggedTableRef.current.y * CELL_SIZE;
        tableEl.style.setProperty('--drag-x', `${rawX - baseX}px`);
        tableEl.style.setProperty('--drag-y', `${rawY - baseY}px`);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!draggingTableId || !gridRef.current || !draggedTableRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const rawX = e.clientX - gridRect.left - dragOffsetRef.current.x;
      const rawY = e.clientY - gridRect.top - dragOffsetRef.current.y;

      // Snap to grid
      const snappedX = Math.max(0, Math.min(GRID_COLS - TABLE_CELLS, Math.round(rawX / CELL_SIZE)));
      const snappedY = Math.max(0, Math.min(GRID_ROWS - TABLE_CELLS, Math.round(rawY / CELL_SIZE)));

      moveTable(draggingTableId, snappedX, snappedY);
      setDraggingTableId(null);
      draggedTableRef.current = null;
    };

    if (draggingTableId) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTableId, moveTable]);

  const handleAddTable = useCallback((tableData: {
    name: string;
    shape: 'square' | 'circle';
  }) => {
    const newTable = addTable(tableData);
    setNewTableId(newTable.id);
    toast.success(`Стол ${newTable.name} добавлен`);

    // Clear the highlight after 5 seconds
    setTimeout(() => {
      setNewTableId((current) => (current === newTable.id ? null : current));
    }, 5000);
  }, [addTable]);

  const handleEditTable = useCallback((id: string, updates: {
    name: string;
    shape: 'square' | 'circle';
  }) => {
    updateTable(id, updates);
    toast.success(`Стол ${updates.name} обновлен`);
    setEditingTable(null);
  }, [updateTable]);

  const handleTableDoubleClick = useCallback((table: FloorTable) => {
    setEditingTable(table);
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    saveToStorage();
    toast.success('Схема зала сохранена');
  }, [saveToStorage]);

  const handleSync = useCallback(async () => {
    try {
      const count = await syncToSupabase();
      toast.success(`Синхронизировано ${count} столов с POS`);
    } catch (err: any) {
      toast.error('Ошибка синхронизации: ' + err.message);
    }
  }, [syncToSupabase]);

  return (
    <div className="flex flex-col">
      <FloorPlanToolbar
        onAddClick={() => {
          setEditingTable(null);
          setIsModalOpen(true);
        }}
        onSaveClick={handleSave}
        onSyncClick={handleSync}
      />

      <div
        ref={gridRef}
        className="relative bg-white border border-gray-200 rounded-lg overflow-hidden"
        style={{
          width: GRID_COLS * CELL_SIZE,
          height: GRID_ROWS * CELL_SIZE,
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
        }}
      >
        {/* Zones layer */}
        {zones.map((zone) => (
          <ZoneBlock key={zone.id} zone={zone} />
        ))}

        {/* Tables layer */}
        {tables.map((table) => (
          <DraggableTable
            key={table.id}
            table={table}
            isDragging={draggingTableId === table.id}
            isNew={newTableId === table.id}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleTableDoubleClick}
          />
        ))}
      </div>

      <AddTableModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingTable(null);
        }}
        onAdd={handleAddTable}
        onEdit={handleEditTable}
        defaultName={getNextTableNumber()}
        editingTable={editingTable}
      />
    </div>
  );
}
