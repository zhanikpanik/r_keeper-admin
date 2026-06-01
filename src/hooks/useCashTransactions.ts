import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';
import {
  parseCashTxAmount,
  parseCashTxPaymentMethod,
  parseCashTxShiftId,
  parseCashTxType,
  txTypeToMovementType,
} from '@/lib/cashTransactionParse';

/** POS RPC uses income / expense / collection; `other` = unknown legacy values */
export type TransactionType = 'expense' | 'income' | 'collection' | 'other';
export type PaymentMethod = 'cash' | 'card';

export type CreatableTransactionType = Exclude<TransactionType, 'other'>;

export interface CashTransaction {
  id: string;
  venue_id: string;
  shift_id: string | null;
  type: TransactionType;
  payment_method: PaymentMethod;
  amount: number;
  note: string | null;
  category_id: string | null;
  transaction_at: string;
  created_at: string;
}

export interface NewTransaction {
  type: CreatableTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  note: string;
  transaction_at: string;
  shift_id: string | null;
  category_id: string | null;
}

const QUERY_KEY = ['cash_transactions', VENUE_ID];
const SHIFTS_QUERY_KEY: ['shifts', string] = ['shifts', VENUE_ID];

function invalidateCashAndShifts(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: QUERY_KEY });
  qc.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
}

/** Map a cash_movements row into the admin CashTransaction shape */
function mapCashMovementRow(row: Record<string, unknown>): CashTransaction {
  return {
    id: String(row.id ?? ''),
    venue_id: String(row.venue_id ?? ''),
    shift_id: parseCashTxShiftId(row.shift_id),
    type: parseCashTxType(row.movement_type),         // movement_type → type
    payment_method: parseCashTxPaymentMethod(null),    // cash_movements has no payment_method — default cash
    amount: parseCashTxAmount(row.amount),
    note: row.note != null && row.note !== '' ? String(row.note) : null,
    category_id: null,                                  // cash_movements has no category_id
    transaction_at: String(row.occurred_at ?? row.created_at ?? ''), // occurred_at → transaction_at
    created_at: String(row.created_at ?? ''),
  };
}

export function useTransactions(from?: string, to?: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, from, to],
    queryFn: async () => {
      let q = supabase
        .from('cash_movements')                          // real table
        .select('*')
        .eq('venue_id', VENUE_ID)
        .order('occurred_at', { ascending: false });     // real column

      if (from) q = q.gte('occurred_at', from);
      if (to) q = q.lte('occurred_at', to);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .map((r) => mapCashMovementRow(r as Record<string, unknown>))
        .filter((t) => t.id.length > 0);
    },
  });
}

export function useShiftTransactions(shiftId: string | number | null) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'shift', shiftId],
    queryFn: async () => {
      if (shiftId === null) return [];
      const sid = String(shiftId);
      const { data, error } = await supabase
        .from('cash_movements')                          // real table
        .select('*')
        .eq('venue_id', VENUE_ID)
        .eq('shift_id', sid)
        .order('occurred_at', { ascending: false });     // real column
      if (error) throw error;
      return (data ?? [])
        .map((r) => mapCashMovementRow(r as Record<string, unknown>))
        .filter((t) => t.id.length > 0);
    },
    enabled: shiftId !== null,
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: NewTransaction) => {
      const { error } = await supabase.from('cash_movements').insert({
        venue_id: VENUE_ID,
        shift_id: tx.shift_id,
        movement_type: txTypeToMovementType(tx.type),  // type → movement_type
        amount: tx.amount,
        note: tx.note || null,
        occurred_at: tx.transaction_at,                  // transaction_at → occurred_at
        // payment_method and category_id not on cash_movements
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCashAndShifts(qc);
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cash_movements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCashAndShifts(qc);
    },
  });
}

export interface UpdateTransaction {
  type: CreatableTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  note: string;
  category_id: string | null;
  transaction_at: string;
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...tx }: UpdateTransaction & { id: string }) => {
      const { error } = await supabase
        .from('cash_movements')                          // real table
        .update({
          movement_type: txTypeToMovementType(tx.type),  // type → movement_type
          amount: tx.amount,
          note: tx.note || null,
          occurred_at: tx.transaction_at,                 // transaction_at → occurred_at
          // payment_method and category_id not on cash_movements
        })
        .eq('id', id)
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCashAndShifts(qc);
    },
  });
}
