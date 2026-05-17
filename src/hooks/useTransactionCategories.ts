import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export interface TxCategory {
  id: string;
  venue_id: string;
  name: string;
  type: 'expense' | 'income';
  sort_order: number;
}

const QUERY_KEY = ['tx_categories', VENUE_ID] as const;

export function useTransactionCategories(type?: 'expense' | 'income') {
  return useQuery({
    queryKey: [...QUERY_KEY, type],
    queryFn: async () => {
      let q = supabase
        .from('cash_transaction_categories')
        .select('*')
        .eq('venue_id', VENUE_ID)
        .order('sort_order')
        .order('name');

      if (type) q = q.eq('type', type);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TxCategory[];
    },
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; type: 'expense' | 'income' }) => {
      const { error } = await supabase
        .from('cash_transaction_categories')
        .insert({ venue_id: VENUE_ID, name: cat.name, type: cat.type });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_transaction_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
