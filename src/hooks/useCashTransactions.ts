import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

export type TransactionType = 'expense' | 'income' | 'collection';
export type PaymentMethod = 'cash' | 'card';

export interface CashTransaction {
  id: string;
  venue_id: string;
  shift_id: number | null;
  type: TransactionType;
  payment_method: PaymentMethod;
  amount: number;
  note: string | null;
  transaction_at: string;
  created_at: string;
}

export interface NewTransaction {
  type: TransactionType;
  payment_method: PaymentMethod;
  amount: number;
  note: string;
  transaction_at: string;
  shift_id: number | null;
}

const QUERY_KEY = ['cash_transactions', VENUE_ID];

export function useTransactions(from?: string, to?: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, from, to],
    queryFn: async () => {
      let q = supabase
        .from('cash_transactions')
        .select('*')
        .eq('venue_id', VENUE_ID)
        .order('transaction_at', { ascending: false });

      if (from) q = q.gte('transaction_at', from);
      if (to) q = q.lte('transaction_at', to);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CashTransaction[];
    },
  });
}

export function useShiftTransactions(shiftId: number | null) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'shift', shiftId],
    queryFn: async () => {
      if (shiftId === null) return [];
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('venue_id', VENUE_ID)
        .eq('shift_id', shiftId)
        .order('transaction_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CashTransaction[];
    },
    enabled: shiftId !== null,
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: NewTransaction) => {
      const { error } = await supabase.from('cash_transactions').insert({
        venue_id: VENUE_ID,
        shift_id: tx.shift_id,
        type: tx.type,
        payment_method: tx.payment_method,
        amount: tx.amount,
        note: tx.note || null,
        transaction_at: tx.transaction_at,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
