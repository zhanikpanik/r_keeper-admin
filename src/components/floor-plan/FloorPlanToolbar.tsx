import { Plus, Save, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloorPlanToolbarProps {
  onAddClick: () => void;
  onSaveClick: () => void;
  onSyncClick?: () => void;
}

export function FloorPlanToolbar({ onAddClick, onSaveClick, onSyncClick }: FloorPlanToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Основной зал</h2>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onAddClick}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md',
            'bg-gray-800 text-white hover:bg-gray-700 transition-colors'
          )}
        >
          <Plus className="w-4 h-4" />
          <span>Добавить стол</span>
        </button>
        <button
          onClick={onSaveClick}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md',
            'bg-green-600 text-white hover:bg-green-700 transition-colors'
          )}
        >
          <Save className="w-4 h-4" />
          <span>Сохранить</span>
        </button>
        {onSyncClick && (
          <button
            onClick={onSyncClick}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md',
              'bg-blue-600 text-white hover:bg-blue-700 transition-colors'
            )}
          >
            <Upload className="w-4 h-4" />
            <span>Синхронизировать с POS</span>
          </button>
        )}
      </div>
    </div>
  );
}
