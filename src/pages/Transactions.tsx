import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { EditTransactionModal } from '@/pages/CashShifts';
import {
 useTransactions,
 useAddTransaction,
 useDeleteTransaction,
 type TransactionType,
 type CreatableTransactionType,
 type PaymentMethod,
} from '@/hooks/useCashTransactions';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useShifts, type CashShift } from '@/hooks/useShiftsData';
import { matchShiftIdForTimestamp } from '@/lib/matchShiftForTimestamp';
import { VENUE_ID } from '@/lib/supabase';

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

function formatCurrency(amount: number) {
 return amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' с';
}

function nowLocalISO() {
 const d = new Date();
 const pad = (n: number) => String(n).padStart(2, '0');
 return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateLabel(isoDate: string) {
 const d = new Date(isoDate);
 return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function toDateKey(iso: string) {
 return iso.slice(0, 10);
}

function formatTime(iso: string) {
 const d = new Date(iso);
 return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
 shifts: CashShift[];
 onClose: () => void;
}

function AddTransactionModal({ shifts, onClose }: ModalProps) {
 const [type, setType] = useState<CreatableTransactionType>('expense');
 const [amount, setAmount] = useState('');
 const [datetime, setDatetime] = useState(nowLocalISO());
 const [note, setNote] = useState('');
 const [categoryId, setCategoryId] = useState<string | null>(null);
 const [error, setError] = useState('');
 const [linkToShift, setLinkToShift] = useState(true);

 const addTx = useAddTransaction();
 const catType = type === 'collection' ? undefined : type;
 const { data: categories = [] } = useTransactionCategories(catType);

 async function handleSave() {
  const amt = parseFloat(amount);
  if (!amount || isNaN(amt) || amt <= 0) { setError('Введите корректную сумму'); return; }
  try {
   const atIso = new Date(datetime).toISOString();
   const shiftId =
    linkToShift ? matchShiftIdForTimestamp(atIso, shifts) : null;
   await addTx.mutateAsync({
    type,
    payment_method: 'cash',
    amount: amt,
    note: note.trim(),
    transaction_at: atIso,
    shift_id: shiftId,
    category_id: type === 'collection' ? null : categoryId,
   });
   toast.success('Транзакция добавлена');
   onClose();
  } catch (e: unknown) {
   toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
  }
 }

 return (
  <Modal title="Новая транзакция" onClose={onClose}>
    {/* Type */}
    <div className="mb-4">
     <label className="text-xs text-foreground mb-2 block">Тип</label>
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
     <label className="text-xs text-foreground mb-2 block">Сумма</label>
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

    {/* Category (income/expense only) */}
    {type !== 'collection' && categories.length > 0 && (
     <div className="mb-4">
      <label className="text-xs text-foreground mb-2 block">Категория</label>
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
     <label className="text-xs text-foreground mb-2 block">Дата и время</label>
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
      const s = shifts.find((x) => x.id === sid);
      if (!linkToShift) {
       return <p className="text-xs text-muted-foreground mt-1">Без привязки к смене</p>;
      }
      return sid ? (
       <p className="text-xs text-green-700 mt-1 font-medium">→ Смена: {s?.openTime ?? sid}</p>
      ) : (
       <p className="text-xs text-amber-600 mt-1">Не попадает ни в одну смену (смена не будет указана)</p>
      );
     })()}
    </div>

    <div className="mb-4">
     <label className="flex items-center gap-2 text-sm">
      <input
       type="checkbox"
       checked={linkToShift}
       onChange={(e) => setLinkToShift(e.target.checked)}
       className="rounded border-muted-foreground"
      />
      <span className="text-muted-foreground">Привязать к смене по дате и времени</span>
     </label>
    </div>

    {/* Note */}
    <div className="mb-6">
     <label className="text-xs text-foreground mb-2 block">Комментарий</label>
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
  </Modal>
 );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Transactions() {
 const [showModal, setShowModal] = useState(false);
 const { data: txs = [], isLoading, isError, error } = useTransactions();
 const { data: shifts = [] } = useShifts();
 const { data: allCats = [] } = useTransactionCategories();
 const catMap = Object.fromEntries(allCats.map((c) => [c.id, c.name]));
 const deleteTx = useDeleteTransaction();
 const [editTx, setEditTx] = useState<{ id: string; type: string; payment_method: string; amount: number; note: string | null; category_id: string | null; transaction_at: string } | null>(null);

 const shiftById = useMemo(
  () => new Map(shifts.map((s) => [s.id.toLowerCase(), s])),
  [shifts],
 );

 // Group by date key (YYYY-MM-DD), preserving order (already sorted desc by transaction_at)
 const groups: { dateKey: string; dateLabel: string; items: typeof txs }[] = [];
 for (const tx of txs) {
  const dk = toDateKey(tx.transaction_at);
  const last = groups[groups.length - 1];
  if (last && last.dateKey === dk) {
   last.items.push(tx);
  } else {
   groups.push({ dateKey: dk, dateLabel: formatDateLabel(tx.transaction_at), items: [tx] });
  }
 }

 return (
  <div className="p-8">
   {showModal && <AddTransactionModal shifts={shifts} onClose={() => setShowModal(false)} />}
   {editTx && <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} />}

   <div className="flex items-center justify-between mb-6">
    <h2 className="text-2xl font-bold">Транзакции</h2>
    <button
     onClick={() => setShowModal(true)}
     className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm cursor-pointer hover:bg-green-700 transition-colors"
    >
     <Plus className="w-4 h-4" />
     Добавить
    </button>
   </div>

   {isError && (
    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
     {error instanceof Error ? error.message : 'Не удалось загрузить транзакции'}
    </div>
   )}

   {isLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
   {!isLoading && !isError && txs.length === 0 && (
    <div className="text-sm text-muted-foreground py-8 text-center space-y-2 max-w-lg mx-auto">
     <p>Нет транзакций для заведения с id:</p>
     <p className="font-mono text-xs break-all text-foreground">{VENUE_ID}</p>
     <p className="text-xs leading-relaxed">
      Если POS пишет в другой <code className="text-foreground">venue_id</code>, выставьте{' '}
      <code className="text-foreground">VITE_VENUE_ID</code> как у POS. Если в SQL строки есть, а здесь пусто —
      проверьте RLS на <code className="text-foreground">cash_transactions</code> (SELECT для anon/authenticated).
     </p>
    </div>
   )}

   {groups.length > 0 && (
    <table className="w-full table-fixed border-separate border-spacing-0">
     <thead>
      <tr className="text-sm font-semibold text-foreground">
       <th scope="col" className="text-left py-3 px-3 w-[160px]">Дата</th>
       <th scope="col" className="text-left py-3 px-3 w-[140px]">Смена</th>
       <th scope="col" className="text-left py-3 px-3 w-[140px]">Тип</th>
       <th scope="col" className="text-right py-3 px-3 w-[130px]">Сумма</th>
       <th scope="col" className="text-left py-3 px-3 w-[220px]">Комментарий</th>
       <th scope="col" className="w-[80px]" />
       <th scope="col" className="w-[36px]" />
      </tr>
     </thead>
     <tbody>
      {groups.flatMap(({ dateLabel, items }) =>
       items.map((tx, idx) => {
        const shift = tx.shift_id ? shiftById.get(tx.shift_id.toLowerCase()) : undefined;
        return (
        <tr
         key={tx.id}
         className="group border-t border-border hover:bg-muted/30 transition-colors"
        >
         <td className="py-2 px-3 text-sm">
          {idx === 0 ? (
           <span className="text-sm text-foreground">{dateLabel}</span>
          ) : null}
         </td>
         <td className="py-2 px-3 text-sm min-w-0">
          {tx.shift_id ? (
           shift ? (
           <Link
            to={`/cash-shifts?shift=${tx.shift_id}`}
            className="text-primary hover:text-primary/70 font-medium truncate block"
            title={`${shift.openTime} — ${shift.closeTime ?? '…'}`}
           >
            {shift.openTime}
           </Link>
           ) : (
            <Link
             to={`/cash-shifts?shift=${tx.shift_id}`}
             className="text-primary hover:text-primary/70 text-xs truncate block"
             title="Смена"
            >
             Открыть смену
            </Link>
           )
          ) : (
           <span>—</span>
          )}
         </td>
         <td className="py-2 px-3">
          <span className="text-sm">
           {TYPE_LABELS[tx.type]}
          </span>
          {tx.category_id && catMap[tx.category_id] && (
           <span className="block text-xs truncate">{catMap[tx.category_id]}</span>
          )}
         </td>
         <td
          className={`py-2 px-3 text-sm text-right tabular-nums ${TYPE_COLOR[tx.type]}`}
         >
          {formatCurrency(tx.amount)}
         </td>
         <td className="py-2 px-3 text-sm">
          <div className="truncate">{tx.note || '—'}</div>
         </td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
           type="button"
           onClick={() => setEditTx(tx)}
           className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer"
          >
           Изменить
          </button>
         </td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <DeleteButton onClick={() => deleteTx.mutate(tx.id)} />
         </td>
        </tr>
       );
       })
      )}
     </tbody>
    </table>
   )}
  </div>
 );
}
