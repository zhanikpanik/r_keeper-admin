import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import type { NegativeStockItem } from '@/types/dashboard';

interface Props {
  items: NegativeStockItem[];
  onSaved?: () => void;
}

interface EditState {
  value: string; // user input
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export function StockCorrection({ items, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, EditState>>({});

  const getEdit = (productId: string, warehouseId: string): EditState => {
    const key = `${productId}:${warehouseId}`;
    return edits[key] || { value: '', saving: false, saved: false, error: null };
  };

  const setEdit = (productId: string, warehouseId: string, update: Partial<EditState>) => {
    const key = `${productId}:${warehouseId}`;
    setEdits(prev => ({ ...prev, [key]: { ...getEdit(productId, warehouseId), ...update } }));
  };

  const handleSave = async (item: NegativeStockItem) => {
    const key = `${item.productId}:${item.warehouseId}`;
    const edit = edits[key];
    const newQty = parseFloat(edit.value);
    if (isNaN(newQty) || newQty < 0) {
      setEdit(item.productId, item.warehouseId, { error: 'Введите ≥ 0' });
      return;
    }

    setEdit(item.productId, item.warehouseId, { saving: true, error: null });

    const { error } = await supabase
      .from('stock_items')
      .update({ quantity: newQty })
      .eq('product_id', item.productId)
      .eq('warehouse_id', item.warehouseId);

    if (error) {
      setEdit(item.productId, item.warehouseId, { saving: false, error: error.message });
      return;
    }

    setEdit(item.productId, item.warehouseId, { saving: false, saved: true });
    queryClient.invalidateQueries({ queryKey: ['dashboard_new'] });
    onSaved?.();
  };

  return (
    <div className="mt-2 space-y-1.5">
      {items.map((item) => {
        const key = `${item.productId}:${item.warehouseId}`;
        const edit = getEdit(item.productId, item.warehouseId);

        return (
          <div key={key} className="flex items-center gap-2 py-1 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
            <span className="text-foreground min-w-0 truncate flex-1">
              {item.productName}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {item.quantity} {item.unit}
            </span>
            <span className="text-muted-foreground">→</span>

            {edit.saved ? (
              <span className="flex items-center gap-1 text-success shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span className="tabular-nums">{parseFloat(edit.value)} {item.unit}</span>
              </span>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={edit.value}
                  onChange={(e) => setEdit(item.productId, item.warehouseId, { value: e.target.value, error: null })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(item); }}
                  placeholder="0"
                  className="w-16 px-1.5 py-0.5 text-sm border border-border rounded bg-background tabular-nums focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">{item.unit}</span>
                <button
                  type="button"
                  onClick={() => handleSave(item)}
                  disabled={edit.saving || !edit.value}
                  className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30"
                >
                  {edit.saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    : <Check className="w-3.5 h-3.5 text-success" />
                  }
                </button>
              </div>
            )}

            {edit.error && (
              <span className="text-xs text-destructive shrink-0">{edit.error}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
