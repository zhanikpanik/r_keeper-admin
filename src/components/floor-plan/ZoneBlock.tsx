import { cn } from '@/lib/utils';
import type { Zone } from '../../../types/floor-plan';

const CELL_SIZE = 48;

interface ZoneBlockProps {
  zone: Zone;
}

export function ZoneBlock({ zone }: ZoneBlockProps) {
  return (
    <div
      className={cn(
        'absolute flex items-center justify-center',
        'pointer-events-none select-none',
        'text-white font-medium text-sm'
      )}
      style={{
        left: zone.x * CELL_SIZE,
        top: zone.y * CELL_SIZE,
        width: zone.width * CELL_SIZE,
        height: zone.height * CELL_SIZE,
        backgroundColor: zone.color,
        opacity: 0.5,
      }}
    >
      {zone.name}
    </div>
  );
}
