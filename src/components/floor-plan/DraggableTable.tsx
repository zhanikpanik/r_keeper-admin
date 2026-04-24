import { cn } from '@/lib/utils';
import type { FloorTable } from '../../../types/floor-plan';

const CELL_SIZE = 48;
const TABLE_SIZE = 96; // 2x2 cells

interface DraggableTableProps {
  table: FloorTable;
  isDragging: boolean;
  isNew?: boolean;
  onMouseDown: (e: React.MouseEvent, table: FloorTable) => void;
  onDoubleClick?: (table: FloorTable) => void;
}

export function DraggableTable({
  table,
  isDragging,
  isNew,
  onMouseDown,
  onDoubleClick,
}: DraggableTableProps) {
  const baseX = table.x * CELL_SIZE;
  const baseY = table.y * CELL_SIZE;

  return (
    <div
      data-table-id={table.id}
      onMouseDown={(e) => onMouseDown(e, table)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(table);
      }}
      className={cn(
        'absolute flex items-center justify-center cursor-grab will-change-transform',
        'transition-shadow', // Only transition shadow (for ring)
        table.shape === 'square' ? 'rounded-lg' : 'rounded-full',
        isDragging && 'cursor-grabbing scale-105 z-50 transition-none',
        isNew && !isDragging && 'ring-4 ring-blue-400'
      )}
      style={{
        left: baseX,
        top: baseY,
        width: TABLE_SIZE,
        height: TABLE_SIZE,
        backgroundColor: '#6B7280',
        // Use CSS variables for drag position - updated directly via DOM for 60fps
        transform: isDragging
          ? 'translate3d(var(--drag-x, 0px), var(--drag-y, 0px), 0)'
          : 'translate3d(0, 0, 0)',
      }}
    >
      <span className="text-white font-semibold text-lg select-none">
        {table.name}
      </span>
    </div>
  );
}
