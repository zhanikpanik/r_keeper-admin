import { useState } from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface DeadItemAlertProps {
  id: string;
  message: string;
  productId: string;
}

export function DeadItemAlert({ id, message, productId }: DeadItemAlertProps) {
  const [deactivating, setDeactivating] = useState(false);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const handleDeactivate = async () => {
    setDeactivating(true);
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);
    if (error) {
      setDeactivating(false);
      return;
    }
    setDone(true);
    queryClient.invalidateQueries({ queryKey: ['dashboard_new'] });
  };

  if (done) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-info/20 bg-info/5 text-sm">
      <Archive className="w-4 h-4 text-info shrink-0" />
      <span className="text-foreground flex-1 min-w-0">{message}</span>
      <button
        type="button"
        onClick={handleDeactivate}
        disabled={deactivating}
        className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg bg-info/10 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
      >
        {deactivating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Деактивировать'}
      </button>
    </div>
  );
}
