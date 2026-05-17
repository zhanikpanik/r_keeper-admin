/**
 * Normalize PostgREST rows for cash_transactions (POS / legacy admin / schema drift).
 */

export type ParsedTxType = 'expense' | 'income' | 'collection' | 'other';

const TYPE_MAP: Record<string, ParsedTxType> = {
  income: 'income',
  expense: 'expense',
  collection: 'collection',
  float_in: 'income',
  float_out: 'expense',
  in: 'income',
  out: 'expense',
  deposit: 'income',
  withdrawal: 'expense',
  encashment: 'collection',
};

export function parseCashTxType(raw: unknown): ParsedTxType {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase();
  return TYPE_MAP[k] ?? 'other';
}

/** POS RPC defaults to cash; nullable column should still affect the drawer */
export function parseCashTxPaymentMethod(raw: unknown): 'cash' | 'card' {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (k === 'card') return 'card';
  return 'cash';
}

export function parseCashTxAmount(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parseCashTxShiftId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  return String(raw);
}
