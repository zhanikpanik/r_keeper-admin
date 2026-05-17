import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';
import {
  parseCashTxAmount,
  parseCashTxPaymentMethod,
  parseCashTxShiftId,
  parseCashTxType,
} from '@/lib/cashTransactionParse';

export interface CashShift {
  id: string;
  openTime: string;
  closeTime: string | null;
  openIso: string;
  closeIso: string | null;
  startBalance: number;
  collection: number | null;
  /**
   * Expected cash in drawer: POS `expected_cash_at_close` when set, else
   * starting_cash + cash_total + net cash from shift cash_transactions (cash only).
   */
  expectedCash: number;
  /** POS `cash_difference_at_close` when set, else actual − expected when both known */
  difference: number | null;
  /**
   * Cash physically in drawer: admin `closing_cash_count` if set, else POS `counted_cash`.
   */
  closingCashCount: number | null;
  openingNote: string | null;
  closingNote: string | null;
  cashierName: string;
}

/** Parse DB numeric / string (incl. comma decimals) to number or null */
function parseNumericField(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function formatShiftTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
    ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

async function fetchShifts(): Promise<CashShift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select(
      [
        'id',
        'opened_at',
        'closed_at',
        'starting_cash',
        'total_revenue',
        'cash_total',
        'card_total',
        'other_total',
        'total_orders',
        'cashier_id',
        'closing_cash_count',
        'counted_cash',
        'expected_cash_at_close',
        'cash_difference_at_close',
        'cash_collections_total',
        'opening_note',
        'closing_note',
        'users(name)',
      ].join(', '),
    )
    .eq('venue_id', VENUE_ID)
    .order('opened_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const shiftIds = data.map((s: any) => s.id as string);

  // Single journal fetch per venue + shifts (normalize type/payment in JS for POS / legacy)
  const { data: cashTxRows } = shiftIds.length > 0
    ? await supabase
        .from('cash_transactions')
        .select('shift_id, type, payment_method, amount')
        .eq('venue_id', VENUE_ID)
        .in('shift_id', shiftIds)
    : { data: [] };

  const collectionByShift: Record<string, number> = {};
  const cashTxDeltaByShift: Record<string, number> = {};
  for (const tx of cashTxRows || []) {
    const sid = parseCashTxShiftId((tx as { shift_id?: unknown }).shift_id);
    if (!sid) continue;
    const sidKey = sid.toLowerCase();
    const pm = parseCashTxPaymentMethod((tx as { payment_method?: unknown }).payment_method);
    const typ = parseCashTxType((tx as { type?: unknown }).type);
    const amt = parseCashTxAmount((tx as { amount?: unknown }).amount);
    if (typ === 'collection' && pm === 'cash') {
      collectionByShift[sidKey] = (collectionByShift[sidKey] || 0) + amt;
    }
    if (pm !== 'cash') continue;
    if (typ === 'income') cashTxDeltaByShift[sidKey] = (cashTxDeltaByShift[sidKey] || 0) + amt;
    else if (typ === 'expense') cashTxDeltaByShift[sidKey] = (cashTxDeltaByShift[sidKey] || 0) - amt;
    else if (typ === 'collection') cashTxDeltaByShift[sidKey] = (cashTxDeltaByShift[sidKey] || 0) - amt;
  }

  return data.map((s: any) => {
    const startBalance = Number(s.starting_cash) || 0;
    const cashTotal = Number(s.cash_total) || 0;
    const txDelta = cashTxDeltaByShift[s.id.toLowerCase()] || 0;
    const expectedComputed = startBalance + cashTotal + txDelta;
    const expectedFromPos = parseNumericField(s.expected_cash_at_close);
    const expectedCash = expectedFromPos ?? expectedComputed;

    const journalCollectionSum = collectionByShift[s.id.toLowerCase()];
    const collectionsFromPos = parseNumericField(s.cash_collections_total);
    /** Prefer journal sum (same source as /transactions); fallback to shifts.cash_collections_total */
    const collection =
      journalCollectionSum !== undefined ? journalCollectionSum : collectionsFromPos;

    const closingAdmin = parseNumericField(s.closing_cash_count);
    const countedPos = parseNumericField(s.counted_cash);
    const actualInDrawer = closingAdmin ?? countedPos;

    const diffFromPos = parseNumericField(s.cash_difference_at_close);
    const isClosed = Boolean(s.closed_at);
    let difference: number | null = null;
    if (isClosed) {
      if (diffFromPos !== null) {
        difference = diffFromPos;
      } else if (actualInDrawer !== null) {
        difference = actualInDrawer - expectedCash;
      }
    }

    return {
      id: s.id,
      openTime: formatShiftTime(s.opened_at),
      closeTime: s.closed_at ? formatShiftTime(s.closed_at) : null,
      openIso: s.opened_at,
      closeIso: s.closed_at || null,
      startBalance,
      collection,
      expectedCash,
      difference,
      closingCashCount: actualInDrawer,
      openingNote: (s.opening_note as string | null) ?? null,
      closingNote: (s.closing_note as string | null) ?? null,
      cashierName: (s.users as any)?.name || '—',
    } satisfies CashShift;
  });
}

const SHIFTS_QUERY_KEY: ['shifts', string] = ['shifts', VENUE_ID];

export function useShifts() {
  return useQuery({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: fetchShifts,
    staleTime: 30 * 1000,
  });
}

export function useUpdateShiftCashFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      shiftId: string;
      starting_cash?: number;
      closing_cash_count?: number | null;
      opening_note?: string | null;
      closing_note?: string | null;
    }) => {
      const patch: Record<string, string | number | null> = {};
      if (payload.starting_cash !== undefined) {
        patch.starting_cash = payload.starting_cash;
      }
      if (payload.closing_cash_count !== undefined) {
        patch.closing_cash_count = payload.closing_cash_count;
      }
      if (payload.opening_note !== undefined) {
        patch.opening_note = payload.opening_note;
      }
      if (payload.closing_note !== undefined) {
        patch.closing_note = payload.closing_note;
      }
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase
        .from('shifts')
        .update(patch)
        .eq('id', payload.shiftId)
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
    },
  });
}
