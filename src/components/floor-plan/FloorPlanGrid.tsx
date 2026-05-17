import { useRef, useState, useEffect, useCallback } from 'react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { FloorPlanToolbar } from './FloorPlanToolbar';
import { ZoneBlock } from './ZoneBlock';
import { DraggableTable } from './DraggableTable';
import { AddTableModal } from './AddTableModal';
import type { FloorTable } from '../../../types/floor-plan';
import { toast } from 'sonner';

const CELL_SIZE = 36;
const GRID_COLS = 24;
const GRID_ROWS = 14;
const MIN_CELLS = 2;

export function FloorPlanGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [resizingTableId, setResizingTableId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggedTableRef = useRef<FloorTable | null>(null);
  const resizedTableRef = useRef<FloorTable | null>(null);
  const [newTableId, setNewTableId] = useState<string | null>(null);

  const {
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
  } = useFloorPlan();

  // ── Drag handling ──
  const handleMouseDown = useCallback((e: React.MouseEvent, table: FloorTable) => {
    e.preventDefault();
    e.stopPropagation();

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

      const tw = draggedTableRef.current.width || 2;
      const th = draggedTableRef.current.height || 2;
      const snappedX = Math.max(0, Math.min(GRID_COLS - tw, Math.round(rawX / CELL_SIZE)));
      const snappedY = Math.max(0, Math.min(GRID_ROWS - th, Math.round(rawY / CELL_SIZE)));

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

  // ── Resize handling ──
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, table: FloorTable) => {
    e.preventDefault();
    e.stopPropagation();
    resizedTableRef.current = table;
    setResizingTableId(table.id);
  }, []);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!resizingTableId || !gridRef.current || !resizedTableRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const table = resizedTableRef.current;
      const mouseX = e.clientX - gridRect.left;
      const mouseY = e.clientY - gridRect.top;

      // Calculate new width/height in cells from table origin
      const newW = Math.max(MIN_CELLS, Math.round((mouseX - table.x * CELL_SIZE) / CELL_SIZE));
      const newH = Math.max(MIN_CELLS, Math.round((mouseY - table.y * CELL_SIZE) / CELL_SIZE));

      // Clamp to grid bounds
      const clampedW = Math.min(newW, GRID_COLS - table.x);
      const clampedH = Math.min(newH, GRID_ROWS - table.y);

      // Live DOM update for smooth feedback
      const tableEl = document.querySelector(`[data-table-id="${resizingTableId}"]`) as HTMLElement;
      if (tableEl) {
        tableEl.style.width = `${clampedW * CELL_SIZE}px`;
        tableEl.style.height = `${clampedH * CELL_SIZE}px`;
        // Update border-radius for circles
        if (table.shape === 'circle') {
          tableEl.style.borderRadius = `${Math.min(clampedW, clampedH) * CELL_SIZE / 2}px`;
        }
      }
    };

    const handleResizeUp = (e: MouseEvent) => {
      if (!resizingTableId || !gridRef.current || !resizedTableRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const table = resizedTableRef.current;
      const mouseX = e.clientX - gridRect.left;
      const mouseY = e.clientY - gridRect.top;

      const newW = Math.max(MIN_CELLS, Math.round((mouseX - table.x * CELL_SIZE) / CELL_SIZE));
      const newH = Math.max(MIN_CELLS, Math.round((mouseY - table.y * CELL_SIZE) / CELL_SIZE));
      const clampedW = Math.min(newW, GRID_COLS - table.x);
      const clampedH = Math.min(newH, GRID_ROWS - table.y);

      resizeTable(resizingTableId, clampedW, clampedH);
      setResizingTableId(null);
      resizedTableRef.current = null;
    };

    if (resizingTableId) {
      window.addEventListener('mousemove', handleResizeMove, { passive: true });
      window.addEventListener('mouseup', handleResizeUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
  }, [resizingTableId, resizeTable]);

  const handleAddTable = useCallback((tableData: {
    name: string;
    shape: 'square' | 'circle';
  }) => {
    const newTable = addTable(tableData);
    setNewTableId(newTable.id);
    toast.success(`Стол ${newTable.name} добавлен`);

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

  const handleDeleteTable = useCallback((table: FloorTable) => {
    removeTable(table.id);
    toast.success(`Стол ${table.name} удалён`);
  }, [removeTable]);

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
            isResizing={resizingTableId === table.id}
            isNew={newTableId === table.id}
            onMouseDown={handleMouseDown}
            onResizeMouseDown={handleResizeMouseDown}
            onDoubleClick={handleTableDoubleClick}
            onDelete={handleDeleteTable}
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
