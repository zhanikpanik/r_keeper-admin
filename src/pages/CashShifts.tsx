import React, { useState } from 'react';
import { Printer, MessageCircle, ChevronDown, Plus, X } from 'lucide-react';
import {
  useTransactions,
  useShiftTransactions,
  useAddTransaction,
  useDeleteTransaction,
  type TransactionType,
  type PaymentMethod,
} from '@/hooks/useCashTransactions';

interface CashShift {
  id: number;
  openTime: string;
  closeTime: string | null;
  openIso: string;
  closeIso: string | null;
  startBalance: number;
  collection: number | null;
  expectedCash: number | null;
  difference: number | null;
  hasWarning?: boolean;
  hasComment?: boolean;
}

const mockShifts: CashShift[] = [
  {
    id: 572,
    openTime: '11 апреля, 09:17',
    closeTime: null,
    openIso: '2024-04-11T09:17:00+06:00',
    closeIso: null,
    startBalance: 3150,
    collection: null,
    expectedCash: null,
    difference: null,
  },
  {
    id: 571,
    openTime: '10 апреля, 09:17',
    closeTime: '10 апреля, 23:10',
    openIso: '2024-04-10T09:17:00+06:00',
    closeIso: '2024-04-10T23:10:00+06:00',
    startBalance: 120,
    collection: null,
    expectedCash: 3150,
    difference: null,
  },
  {
    id: 570,
    openTime: '9 апреля, 09:11',
    closeTime: '9 апреля, 23:06',
    openIso: '2024-04-09T09:11:00+06:00',
    closeIso: '2024-04-09T23:06:00+06:00',
    startBalance: 5120,
    collection: null,
    expectedCash: 120,
    difference: null,
  },
  {
    id: 569,
    openTime: '8 апреля, 09:08',
    closeTime: '8 апреля, 22:45',
    openIso: '2024-04-08T09:08:00+06:00',
    closeIso: '2024-04-08T22:45:00+06:00',
    startBalance: 4580,
    collection: null,
    expectedCash: 5120,
    difference: null,
    hasWarning: true,
  },
  {
    id: 568,
    openTime: '8 апреля, 01:29',
    closeTime: '8 апреля, 01:32',
    openIso: '2024-04-08T01:29:00+06:00',
    closeIso: '2024-04-08T01:32:00+06:00',
    startBalance: 1,
    collection: null,
    expectedCash: 1,
    difference: null,
    hasWarning: true,
  },
  {
    id: 567,
    openTime: '7 апреля, 09:01',
    closeTime: '7 апреля, 23:45',
    openIso: '2024-04-07T09:01:00+06:00',
    closeIso: '2024-04-07T23:45:00+06:00',
    startBalance: 1603,
    collection: null,
    expectedCash: 4580,
    difference: 87,
    hasComment: true,
  },
  {
    id: 566,
    openTime: '6 апреля, 10:05',
    closeTime: '6 апреля, 23:10',
    openIso: '2024-04-06T10:05:00+06:00',
    closeIso: '2024-04-06T23:10:00+06:00',
    startBalance: 3609,
    collection: null,
    expectedCash: 1603,
    difference: -6,
    hasWarning: true,
    hasComment: true,
  },
  {
    id: 565,
    openTime: '5 апреля, 08:56',
    closeTime: '5 апреля, 23:09',
    openIso: '2024-04-05T08:56:00+06:00',
    closeIso: '2024-04-05T23:09:00+06:00',
    startBalance: 20263,
    collection: null,
    expectedCash: 3603,
    difference: null,
  },
  {
    id: 564,
    openTime: '4 апреля, 09:08',
    closeTime: '4 апреля, 23:38',
    openIso: '2024-04-04T09:08:00+06:00',
    closeIso: '2024-04-04T23:38:00+06:00',
    startBalance: 19893,
    collection: null,
    expectedCash: 20263,
    difference: null,
  },
  {
    id: 563,
    openTime: '3 апреля, 09:28',
    closeTime: '3 апреля, 22:58',
    openIso: '2024-04-03T09:28:00+06:00',
    closeIso: '2024-04-03T22:58:00+06:00',
    startBalance: 19423,
    collection: null,
    expectedCash: 19893,
    difference: null,
  },
  {
    id: 562,
    openTime: '2 апреля, 09:08',
    closeTime: '2 апреля, 22:47',
    openIso: '2024-04-02T09:08:00+06:00',
    closeIso: '2024-04-02T22:47:00+06:00',
    startBalance: 33968,
    collection: null,
    expectedCash: 19423,
    difference: null,
  },
  {
    id: 561,
    openTime: '1 апреля, 12:00',
    closeTime: '1 апреля, 22:46',
    openIso: '2024-04-01T12:00:00+06:00',
    closeIso: '2024-04-01T22:46:00+06:00',
    startBalance: 32930,
    collection: null,
    expectedCash: 33968,
    difference: null,
  },
  {
    id: 560,
    openTime: '31 марта, 09:09',
    closeTime: '31 марта, 22:33',
    openIso: '2024-03-31T09:09:00+06:00',
    closeIso: '2024-03-31T22:33:00+06:00',
    startBalance: 6100,
    collection: null,
    expectedCash: 32930,
    difference: 21584,
  },
];

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

function matchShiftId(isoDatetime: string, shifts: CashShift[]): number | null {
  const ts = new Date(isoDatetime).getTime();
  for (const s of shifts) {
    const open = new Date(s.openIso).getTime();
    const close = s.closeIso ? new Date(s.closeIso).getTime() : Infinity;
    if (ts >= open && ts <= close) return s.id;
  }
  return null;
}

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Приход',
  expense: 'Расход',
  collection: 'Инкассация',
};

const TYPE_COLOR: Record<TransactionType, string> = {
  income: 'text-green-600',
  expense: 'text-red-600',
  collection: 'text-muted-foreground',
};

const TYPE_SIGN: Record<TransactionType, string> = {
  income: '+',
  expense: '−',
  collection: '',
};

// ─── Add Transaction Modal ────────────────────────────────────────────────────

interface AddModalProps {
  shifts: CashShift[];
  defaultDatetime?: string;
  onClose: () => void;
}

function AddTransactionModal({ shifts, defaultDatetime, onClose }: AddModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [datetime, setDatetime] = useState(defaultDatetime ?? nowLocalISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const addTx = useAddTransaction();

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    const shiftId = matchShiftId(datetime, shifts);
    await addTx.mutateAsync({
      type,
      payment_method: paymentMethod,
      amount: amt,
      note: note.trim(),
      transaction_at: new Date(datetime).toISOString(),
      shift_id: shiftId,
    });
    onClose();
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Тип</label>
          <div className="flex gap-1 p-1 bg-secondary rounded-xl">
            {(['expense', 'income', 'collection'] as TransactionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  type === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Сумма</label>
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Способ оплаты</label>
          <div className="flex gap-2">
            {(['cash', 'card'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                  paymentMethod === m
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                }`}
              >
                {m === 'cash' ? 'Наличные' : 'Безналичные'}
              </button>
            ))}
          </div>
        </div>

        {/* Datetime */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Дата и время</label>
          <input
            type="datetime-local"
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
          {(() => {
            const sid = matchShiftId(datetime, shifts);
            const s = shifts.find(x => x.id === sid);
            return sid ? (
              <p className="text-xs text-green-700 mt-1 font-medium">→ Смена #{sid} ({s?.openTime})</p>
            ) : (
              <p className="text-xs text-amber-600 mt-1">Не попадает ни в одну смену</p>
            );
          })()}
        </div>

        {/* Note */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Комментарий</label>
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

// ─── Shift Detail Panel ───────────────────────────────────────────────────────

function ShiftDetail({ shift, onAddTransaction }: { shift: CashShift; onAddTransaction: (dt?: string) => void }) {
  const { data: txs = [] } = useShiftTransactions(shift.id);
  const deleteTx = useDeleteTransaction();

  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalCollection = txs.filter(t => t.type === 'collection').reduce((s, t) => s + t.amount, 0);

  const defaultDt = shift.openIso
    ? (() => {
        const d = new Date(shift.openIso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : undefined;

  return (
    <div className="pl-3 pr-3 py-6 border-t border-b border-muted/20">
      {/* Summary Grid */}
      <div className="mb-8">
        <div className="grid grid-cols-3 gap-8 mb-4 max-w-[600px]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Баланс:</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(shift.startBalance)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">В кассе:</span>
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

        {txs.length > 0 && (
          <div className="overflow-hidden">
            <div className="flex items-center px-4 py-2 text-[12px] font-semibold text-muted-foreground bg-muted/5">
              <div className="w-[160px] shrink-0">Тип</div>
              <div className="w-[160px] shrink-0">Дата/время</div>
              <div className="w-[100px] shrink-0">Способ</div>
              <div className="w-[120px] shrink-0 text-right">Сумма</div>
              <div className="flex-1 pl-4">Комментарий</div>
              <div className="w-8 shrink-0"></div>
            </div>
            <div>
              {txs.map((tx) => (
                <div key={tx.id} className="group flex items-center px-4 py-2 text-sm hover:bg-muted/5 transition-colors">
                  <div className={`w-[160px] shrink-0 font-semibold ${TYPE_COLOR[tx.type]}`}>{TYPE_LABELS[tx.type]}</div>
                  <div className="w-[160px] shrink-0 text-muted-foreground">{formatDatetime(tx.transaction_at)}</div>
                  <div className="w-[100px] shrink-0 text-muted-foreground text-xs uppercase font-semibold">
                    {tx.payment_method === 'cash' ? 'Нал' : 'Безнал'}
                  </div>
                  <div className={`w-[120px] shrink-0 text-right tabular-nums font-semibold ${TYPE_COLOR[tx.type]}`}>
                    {TYPE_SIGN[tx.type]}{formatCurrency(tx.amount)}
                  </div>
                  <div className="flex-1 pl-4 text-muted-foreground truncate">{tx.note || '—'}</div>
                  <div className="w-8 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => deleteTx.mutate(tx.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {txs.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Нет транзакций для этой смены</p>
        )}
      </div>
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ shifts, onAdd }: { shifts: CashShift[]; onAdd: () => void }) {
  const { data: txs = [], isLoading } = useTransactions();
  const deleteTx = useDeleteTransaction();

  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalCollection = txs.filter(t => t.type === 'collection').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-6 mb-6 p-4 bg-secondary/30 rounded-xl">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Приход</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="w-px bg-border"></div>
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Расход</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="w-px bg-border"></div>
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Инкассация</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalCollection)}</p>
        </div>
        <div className="w-px bg-border"></div>
        <div>
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Итого</p>
          <p className={`text-lg font-bold tabular-nums ${totalIncome - totalExpense - totalCollection >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalIncome - totalExpense - totalCollection)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onAdd}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Добавить транзакцию
        </button>
      </div>

      <div className="w-fit -mx-3">
        <div className="flex items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="w-[160px] shrink-0 pr-4">Тип</div>
          <div className="w-[170px] shrink-0 pr-4">Дата/время</div>
          <div className="w-[80px] shrink-0 pr-4">Смена</div>
          <div className="w-[110px] shrink-0 pr-4">Способ</div>
          <div className="w-[130px] shrink-0 text-right pr-4">Сумма</div>
          <div className="flex-1 pr-4">Комментарий</div>
          <div className="w-8 shrink-0"></div>
        </div>

        {isLoading && (
          <div className="py-12 text-center text-muted-foreground text-sm">Загрузка...</div>
        )}

        {!isLoading && txs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Нет транзакций</div>
        )}

        {txs.map((tx) => {
          const shiftLabel = tx.shift_id
            ? `#${tx.shift_id}`
            : '—';
          return (
            <div key={tx.id} className="group flex items-center py-2 px-3 hover:bg-[#EFF0F4] transition-colors even:bg-muted/10">
              <div className={`w-[160px] shrink-0 pr-4 text-sm font-semibold ${TYPE_COLOR[tx.type]}`}>
                {TYPE_LABELS[tx.type]}
              </div>
              <div className="w-[170px] shrink-0 pr-4 text-sm text-muted-foreground">
                {formatDatetime(tx.transaction_at)}
              </div>
              <div className="w-[80px] shrink-0 pr-4 text-sm text-muted-foreground font-mono">
                {shiftLabel}
              </div>
              <div className="w-[110px] shrink-0 pr-4 text-xs uppercase font-semibold text-muted-foreground">
                {tx.payment_method === 'cash' ? 'Наличные' : 'Безналичные'}
              </div>
              <div className={`w-[130px] shrink-0 text-right pr-4 text-sm font-bold tabular-nums ${TYPE_COLOR[tx.type]}`}>
                {TYPE_SIGN[tx.type]}{formatCurrency(tx.amount)}
              </div>
              <div className="flex-1 pr-4 text-sm text-muted-foreground truncate">{tx.note || '—'}</div>
              <div className="w-8 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => deleteTx.mutate(tx.id)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CashShifts() {
  const [shifts] = useState<CashShift[]>(mockShifts);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'shifts' | 'transactions'>('shifts');
  const [showModal, setShowModal] = useState(false);
  const [modalDefaultDt, setModalDefaultDt] = useState<string | undefined>(undefined);

  const toggleExpand = (id: number) => {
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'shifts'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Смены
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'transactions'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Транзакции
        </button>
      </div>

      {/* Transactions tab */}
      {activeTab === 'transactions' && (
        <TransactionsTab shifts={shifts} onAdd={() => openModal()} />
      )}

      {/* Shifts tab */}
      {activeTab === 'shifts' && (
        <div className="w-fit -mx-3">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-10 text-sm font-semibold text-muted-foreground">
              <tr>
                <th className="w-[300px] font-semibold pt-4 pb-2 px-3 pr-4 align-bottom">Смена</th>
                <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">Начало</th>
                <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">В кассе</th>
                <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">Разница</th>
                <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">Инкассация</th>
                <th className="w-10 pt-4 pb-2 px-3 align-bottom"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => {
                let bgColorClass = 'even:bg-muted/10 hover:bg-[#EFF0F4]';
                if (!shift.closeTime) {
                  bgColorClass = 'bg-[#FDF6E3] hover:bg-[#F9EED4]';
                } else if (shift.difference && shift.difference !== 0) {
                  bgColorClass = 'bg-[#FCE8E8] hover:bg-[#FAD5D5]';
                }

                const isExpanded = expandedId === shift.id;
                if (isExpanded) bgColorClass = 'bg-[#FAFAFA]';

                return (
                  <React.Fragment key={shift.id}>
                    <tr
                      className={`group transition-colors cursor-pointer ${bgColorClass}`}
                      onClick={() => toggleExpand(shift.id)}
                    >
                      <td className="px-3 py-1.5 pr-4 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate text-sm">{shift.openTime}</span>
                          <span className="text-muted-foreground opacity-30">—</span>
                          <span className="text-muted-foreground truncate text-sm">{shift.closeTime || 'Не закрыта'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums">
                        <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                          {formatCurrency(shift.startBalance)}
                          {shift.hasWarning && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums text-sm font-medium">
                        {formatCurrency(shift.expectedCash)}
                      </td>
                      <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums text-sm text-muted-foreground">
                        {formatCurrency(shift.difference)}
                      </td>
                      <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums text-sm text-muted-foreground">
                        {formatCurrency(shift.collection)}
                      </td>
                      <td className="px-3 py-1.5 align-middle">
                        <div className="flex justify-end">
                          {shift.hasComment && (
                            <MessageCircle className="w-4 h-4 text-muted-foreground opacity-50" />
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#FAFAFA]">
                        <td colSpan={6} className="p-0">
                          <ShiftDetail shift={shift} onAddTransaction={openModal} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
