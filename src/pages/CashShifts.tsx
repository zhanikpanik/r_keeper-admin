import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, ChevronDown, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useShiftTransactions,
  useAddTransaction,
  useDeleteTransaction,
  type TransactionType,
  type CreatableTransactionType,
  type PaymentMethod,
} from '@/hooks/useCashTransactions';
import { DecimalSuffixInput } from '@/components/DecimalSuffixInput';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useShifts, useUpdateShiftCashFields, type CashShift } from '@/hooks/useShiftsData';
import { matchShiftIdForTimestamp } from '@/lib/matchShiftForTimestamp';

function formatCurrency(amount: number | null) {
  if (amount === null) return '';
  const formatted = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} с`;
}

function formatDatetime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nowLocalISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Приход',
  expense: 'Расход',
  collection: 'Инкассация',
  other: 'Прочее',
};

const TYPE_COLOR: Record<TransactionType, string> = {
  income: 'text-green-600',
  expense: 'text-red-600',
  collection: 'text-muted-foreground',
  other: 'text-muted-foreground',
};

const TYPE_SIGN: Record<TransactionType, string> = {
  income: '+',
  expense: '−',
  collection: '',
  other: '',
};

/** Main shifts list: grid + subgrid (replaces table layout) */
const SHIFT_GRID_TEMPLATE = 'minmax(220px,300px) 120px 120px 120px 120px 40px';

// ─── Add Transaction Modal ────────────────────────────────────────────────────

interface AddModalProps {
  shifts: CashShift[];
  defaultDatetime?: string;
  onClose: () => void;
}

function AddTransactionModal({ shifts, defaultDatetime, onClose }: AddModalProps) {
  const [type, setType] = useState<CreatableTransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [datetime, setDatetime] = useState(defaultDatetime ?? nowLocalISO());
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const addTx = useAddTransaction();
  const catType = type === 'collection' ? undefined : type;
  const { data: categories = [] } = useTransactionCategories(catType);

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    const shiftId = matchShiftIdForTimestamp(new Date(datetime).toISOString(), shifts);
    try {
      await addTx.mutateAsync({
        type,
        payment_method: paymentMethod,
        amount: amt,
        note: note.trim(),
        transaction_at: new Date(datetime).toISOString(),
        shift_id: shiftId,
        category_id: type === 'collection' ? null : categoryId,
      });
      toast.success('Транзакция добавлена');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Не удалось сохранить';
      toast.error(msg);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-[420px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Новая транзакция</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Тип</label>
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
          >
            {(['expense', 'income', 'collection'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  type === t
                    ? 'bg-white text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={type === t ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Сумма</label>
          <div className="relative">
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background pr-10 outline-none focus:border-primary transition-colors"
              placeholder="0"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">сом</span>
          </div>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        {/* Payment method */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Способ оплаты</label>
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
          >
            {(['cash', 'card'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  paymentMethod === m
                    ? 'bg-white text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={paymentMethod === m ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
              >
                {m === 'cash' ? 'Наличные' : 'Безналичные'}
              </button>
            ))}
          </div>
        </div>

        {/* Category (income/expense only) */}
        {type !== 'collection' && categories.length > 0 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Категория</label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
            >
              <option value="">Без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Datetime */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Дата и время</label>
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
              value={datetime.slice(0, 10)}
              onChange={(e) => setDatetime(e.target.value + 'T' + (datetime.slice(11) || '00:00'))}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0} max={23}
                className="w-14 px-2 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors text-center"
                value={datetime.slice(11, 13)}
                onChange={(e) => {
                  const h = String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2, '0');
                  setDatetime(datetime.slice(0, 11) + h + ':' + datetime.slice(14, 16));
                }}
              />
              <span className="text-muted-foreground font-medium">:</span>
              <input
                type="number"
                min={0} max={59}
                className="w-14 px-2 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors text-center"
                value={datetime.slice(14, 16)}
                onChange={(e) => {
                  const m = String(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))).padStart(2, '0');
                  setDatetime(datetime.slice(0, 11) + datetime.slice(11, 13) + ':' + m);
                }}
              />
            </div>
          </div>
          {(() => {
            const sid = matchShiftIdForTimestamp(new Date(datetime).toISOString(), shifts);
            const s = shifts.find(x => x.id === sid);
            return sid ? (
              <p className="text-xs text-green-700 mt-1 font-medium">→ Смена ({s?.openTime})</p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">Не попадает ни в одну смену</p>
            );
          })()}
        </div>

        {/* Note */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Комментарий</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
            placeholder="Например: оплата поставщику"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={addTx.isPending}
            className="flex-1 py-2.5 bg-foreground text-background rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {addTx.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border-2 rounded-xl font-bold text-sm hover:bg-secondary transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

type ShiftBoundaryEditMode = 'open' | 'close';

function ShiftBoundaryEditModal({
  mode,
  shift,
  onClose,
}: {
  mode: ShiftBoundaryEditMode;
  shift: CashShift;
  onClose: () => void;
}) {
  const updateShiftCash = useUpdateShiftCashFields();
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');

  useEffect(() => {
    if (mode === 'open') {
      setAmountStr(String(shift.startBalance).replace('.', ','));
      setNoteStr(shift.openingNote?.trim() ? shift.openingNote : '');
    } else {
      setAmountStr(
        shift.closingCashCount != null
          ? String(shift.closingCashCount).replace('.', ',')
          : '',
      );
      setNoteStr(shift.closingNote?.trim() ? shift.closingNote : '');
    }
  }, [mode, shift.id, shift.startBalance, shift.closingCashCount, shift.openingNote, shift.closingNote]);

  async function handleSave() {
    const noteTrim = noteStr.trim() || null;
    try {
      if (mode === 'open') {
        const normalized = amountStr.trim().replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(normalized);
        if (normalized === '' || Number.isNaN(n) || n < 0) {
          toast.error('Введите неотрицательную сумму');
          return;
        }
        await updateShiftCash.mutateAsync({
          shiftId: shift.id,
          starting_cash: n,
          opening_note: noteTrim,
        });
      } else {
        const normalized = amountStr.trim().replace(/\s/g, '').replace(',', '.');
        let value: number | null = null;
        if (normalized !== '') {
          const n = parseFloat(normalized);
          if (Number.isNaN(n) || n < 0) {
            toast.error('Введите неотрицательное число или очистите сумму');
            return;
          }
          value = n;
        }
        await updateShiftCash.mutateAsync({
          shiftId: shift.id,
          closing_cash_count: value,
          closing_note: noteTrim,
        });
      }
      toast.success('Сохранено');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
    }
  }

  const title = mode === 'open' ? 'Открытие смены' : 'Закрытие смены';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[420px] p-6"
        role="dialog"
        aria-labelledby="shift-boundary-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 id="shift-boundary-edit-title" className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">
            {mode === 'open' ? 'Наличные в кассе' : 'Наличные при закрытии'}
          </label>
          <DecimalSuffixInput value={amountStr} onChange={setAmountStr} suffix="с" />
        </div>
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Комментарий кассира</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background resize-none outline-none focus:border-primary transition-colors"
            value={noteStr}
            onChange={(e) => setNoteStr(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateShiftCash.isPending}
            className="flex-1 py-2.5 bg-foreground text-background rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {updateShiftCash.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border-2 rounded-xl font-bold text-sm hover:bg-secondary transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shift Detail Panel ───────────────────────────────────────────────────────

function ShiftDetail({ shift, onAddTransaction }: { shift: CashShift; onAddTransaction: (dt?: string) => void }) {
  const {
    data: txs = [],
    isPending: txsPending,
    isError: txsError,
    error: txsErr,
  } = useShiftTransactions(shift.id);
  const { data: allCats = [] } = useTransactionCategories();
  const catMap = Object.fromEntries(allCats.map((c) => [c.id, c.name]));
  const deleteTx = useDeleteTransaction();
  const [boundaryEdit, setBoundaryEdit] = useState<ShiftBoundaryEditMode | null>(null);

  /** Drawer-relevant totals: POS RPC writes float in/out/collection as payment_method = cash */
  const totalIncome = txs
    .filter((t) => t.type === 'income' && t.payment_method === 'cash')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs
    .filter((t) => t.type === 'expense' && t.payment_method === 'cash')
    .reduce((s, t) => s + t.amount, 0);
  const totalCollection = txs
    .filter((t) => t.type === 'collection' && t.payment_method === 'cash')
    .reduce((s, t) => s + t.amount, 0);

  const txsChrono = [...txs].sort(
    (a, b) => new Date(a.transaction_at).getTime() - new Date(b.transaction_at).getTime(),
  );

  const defaultDt = shift.openIso
    ? (() => {
        const d = new Date(shift.openIso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : undefined;

  const showTxTable = !txsPending && !txsError;

  return (
    <div className="pl-3 pr-3 py-6 border-t border-b border-muted/20">
      {boundaryEdit && (
        <ShiftBoundaryEditModal
          mode={boundaryEdit}
          shift={shift}
          onClose={() => setBoundaryEdit(null)}
        />
      )}
      {/* Summary Grid */}
      <div className="mb-8">
        <div className="grid grid-cols-3 gap-8 mb-4 max-w-[600px]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Баланс:</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(shift.startBalance)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ожидаемо в кассе:</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(shift.expectedCash)}</span>
          </div>
          <div></div>
        </div>
        <div className="grid grid-cols-3 gap-8 max-w-[600px]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Приход:</span>
            <span className="text-sm font-medium tabular-nums text-green-600">{formatCurrency(totalIncome)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Расход:</span>
            <span className="text-sm font-medium tabular-nums text-red-600">{formatCurrency(totalExpense)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Инкассация:</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(totalCollection)}</span>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="max-w-[800px]">
        <button
          onClick={() => onAddTransaction(defaultDt)}
          className="flex items-center gap-1 text-[#5D4FF1] hover:text-[#F70000] text-sm font-medium mb-3 transition-colors"
        >
          <Plus className="w-4 h-4" /> Добавить транзакцию
        </button>

        {txsPending && (
          <p className="text-sm text-muted-foreground py-2">Загрузка…</p>
        )}
        {txsError && (
          <p className="text-sm text-destructive py-2">
            {txsErr instanceof Error ? txsErr.message : 'Не удалось загрузить'}
          </p>
        )}

        {showTxTable && (
          <div className="overflow-hidden rounded-lg border border-muted/20">
            <div className="flex items-center px-4 py-2 text-[12px] font-semibold text-muted-foreground bg-muted/5">
              <div className="w-[160px] shrink-0">Тип</div>
              <div className="w-[160px] shrink-0">Дата/время</div>
              <div className="w-[100px] shrink-0">Способ</div>
              <div className="w-[140px] shrink-0 text-right">Сумма</div>
              <div className="flex-1 pl-4">Комментарий</div>
              <div className="w-[88px] shrink-0 text-right" />
            </div>
            <div>
              <div className="group flex items-center px-4 py-2 text-sm hover:bg-muted/5 transition-colors">
                <div className="w-[160px] shrink-0 font-semibold text-sky-800">Открытие</div>
                <div className="w-[160px] shrink-0 text-muted-foreground">{formatDatetime(shift.openIso)}</div>
                <div className="w-[100px] shrink-0 text-muted-foreground text-xs uppercase font-semibold">—</div>
                <div className="w-[140px] shrink-0 text-right tabular-nums font-medium text-foreground">
                  {formatCurrency(shift.startBalance)}
                </div>
                <div className="flex-1 pl-4 text-muted-foreground truncate text-sm">
                  {shift.openingNote?.trim() ? shift.openingNote : '—'}
                </div>
                <div className="w-[88px] shrink-0 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBoundaryEdit('open')}
                    className="text-xs font-semibold text-[#5D4FF1] hover:text-[#F70000] transition-colors"
                  >
                    Изменить
                  </button>
                </div>
              </div>

              {txsChrono.map((tx) => (
                <div key={tx.id} className="group flex items-center px-4 py-2 text-sm hover:bg-muted/5 transition-colors">
                  <div className="w-[160px] shrink-0">
                    <span className={`font-semibold ${TYPE_COLOR[tx.type]}`}>{TYPE_LABELS[tx.type]}</span>
                    {tx.category_id && catMap[tx.category_id] && (
                      <span className="block text-xs text-muted-foreground truncate">{catMap[tx.category_id]}</span>
                    )}
                  </div>
                  <div className="w-[160px] shrink-0 text-muted-foreground">{formatDatetime(tx.transaction_at)}</div>
                  <div className="w-[100px] shrink-0 text-muted-foreground text-xs uppercase font-semibold">
                    {tx.payment_method === 'cash' ? 'Нал' : 'Безнал'}
                  </div>
                  <div className={`w-[140px] shrink-0 text-right tabular-nums font-semibold ${TYPE_COLOR[tx.type]}`}>
                    {TYPE_SIGN[tx.type]}{formatCurrency(tx.amount)}
                  </div>
                  <div className="flex-1 pl-4 text-muted-foreground truncate">{tx.note || '—'}</div>
                  <div className="w-[88px] shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteTx.mutateAsync(tx.id);
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : 'Не удалось удалить');
                        }
                      }}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {shift.closeIso && (
                <div className="group flex items-center px-4 py-2 text-sm hover:bg-muted/5 transition-colors">
                  <div className="w-[160px] shrink-0 font-semibold text-violet-900">Закрытие</div>
                  <div className="w-[160px] shrink-0 text-muted-foreground">{formatDatetime(shift.closeIso)}</div>
                  <div className="w-[100px] shrink-0 text-muted-foreground text-xs uppercase font-semibold">—</div>
                  <div className="w-[140px] shrink-0 text-right tabular-nums font-medium text-foreground">
                    {shift.closingCashCount != null ? formatCurrency(shift.closingCashCount) : '—'}
                  </div>
                  <div className="flex-1 pl-4 text-muted-foreground truncate text-sm">
                    {shift.closingNote?.trim() ? shift.closingNote : '—'}
                  </div>
                  <div className="w-[88px] shrink-0 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setBoundaryEdit('close')}
                      className="text-xs font-semibold text-[#5D4FF1] hover:text-[#F70000] transition-colors"
                    >
                      Изменить
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CashShifts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: shifts = [], isLoading, isError, error } = useShifts();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalDefaultDt, setModalDefaultDt] = useState<string | undefined>(undefined);

  useEffect(() => {
    const sid = searchParams.get('shift');
    if (!sid) return;
    setExpandedId(sid);
    const next = new URLSearchParams(searchParams);
    next.delete('shift');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  function openModal(dt?: string) {
    setModalDefaultDt(dt);
    setShowModal(true);
  }

  return (
    <div className="p-8">
      {showModal && (
        <AddTransactionModal
          shifts={shifts}
          defaultDatetime={modalDefaultDt}
          onClose={() => setShowModal(false)}
        />
      )}

      {isError && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Не удалось загрузить смены'}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Кассовые смены</h2>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-[#5D4FF1] font-medium hover:bg-secondary/50 transition-colors">
            <Printer className="w-4 h-4" />
            Распечатать
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-[#5D4FF1] font-medium hover:bg-secondary/50 transition-colors">
            12 марта — 12 апреля
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: SHIFT_GRID_TEMPLATE }}
      >
        <div className="col-span-6 grid grid-cols-subgrid items-end pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="pr-6">Смена</div>
          <div className="pr-6 text-right">Начало</div>
          <div className="pr-6 text-right">В кассе</div>
          <div className="pr-6 text-right">Разница</div>
          <div className="pr-6 text-right">Инкассация</div>
          <div />
        </div>

        <div className="col-span-6 grid grid-cols-subgrid">
          {isLoading && (
            <div className="col-span-6 px-3 py-8 text-sm text-muted-foreground">Загрузка...</div>
          )}
          {!isLoading && shifts.length === 0 && (
            <div className="col-span-6 px-3 py-12 text-center text-sm text-muted-foreground">
              Нет кассовых смен
            </div>
          )}
          {shifts.map((shift, idx) => {
            const isExpanded = expandedId === shift.id;
            let rowClass = 'transition-colors cursor-pointer ';
            if (isExpanded) {
              rowClass += 'bg-[#FAFAFA] ';
            } else if (!shift.closeTime) {
              rowClass += 'bg-[#FDF6E3] hover:bg-[#F9EED4] ';
            } else if (shift.difference != null && shift.difference !== 0) {
              rowClass += 'bg-[#FCE8E8] hover:bg-[#FAD5D5] ';
            } else {
              rowClass += (idx % 2 === 1 ? 'bg-muted/10 ' : '') + 'hover:bg-[#EFF0F4] ';
            }

            return (
              <div key={shift.id} className="col-span-6 grid grid-cols-subgrid">
                <div
                  role="button"
                  tabIndex={0}
                  className={`grid grid-cols-subgrid col-span-6 items-center py-2 px-3 group ${rowClass}`}
                  onClick={() => toggleExpand(shift.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(shift.id);
                    }
                  }}
                >
                  <div className="pr-6 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate text-sm">{shift.openTime}</span>
                      <span className="text-muted-foreground opacity-30">—</span>
                      <span className="text-muted-foreground truncate text-sm">
                        {shift.closeTime || 'Не закрыта'}
                      </span>
                    </div>
                  </div>
                  <div className="pr-6 text-right tabular-nums text-sm text-muted-foreground">
                    {formatCurrency(shift.startBalance)}
                  </div>
                  <div className="pr-6 text-right tabular-nums text-sm font-medium text-foreground">
                    {shift.closeIso
                      ? shift.closingCashCount != null
                        ? formatCurrency(shift.closingCashCount)
                        : '—'
                      : ''}
                  </div>
                  <div
                    className={`pr-6 text-right tabular-nums text-sm ${
                      shift.difference != null && shift.difference !== 0
                        ? shift.difference > 0
                          ? 'font-medium text-green-600'
                          : 'font-medium text-red-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {shift.difference != null
                      ? `${shift.difference > 0 ? '+' : ''}${formatCurrency(shift.difference)}`
                      : shift.closeIso
                        ? '—'
                        : ''}
                  </div>
                  <div className="pr-6 text-right tabular-nums text-sm text-muted-foreground">
                    {formatCurrency(shift.collection)}
                  </div>
                  <div className="flex justify-end" />
                </div>

                {isExpanded && (
                  <div className="col-span-6 bg-[#FAFAFA]">
                    <ShiftDetail shift={shift} onAddTransaction={openModal} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
