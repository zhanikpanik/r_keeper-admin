import { useState, useRef, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { toast } from 'sonner';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { useChecks, type Check } from '@/hooks/useChecksData';
import { useQueryClient } from '@tanstack/react-query';
import { CHECK_ITEMS_TABLE_GRID, checkItemPositionTitle } from '@/lib/checkItemsTableGrid';

function isSuspicious(c: Check): { suspicious: boolean; reasons: string[] } {
 const subtotal = c.items.reduce((s, i) => s + i.qty * i.price, 0);
 const reasons: string[] = [];
 if (subtotal > 0 && c.discount / subtotal > 0.2) reasons.push('Скидка > 20%');
 if (c.paid === 0 && c.status === 'closed') reasons.push('Оплачено 0');
 if (c.status === 'open') {
  const openMs = Date.now() - new Date(c.openedAt).getTime();
  if (openMs > 3 * 60 * 60 * 1000) reasons.push('Открыт > 3 ч');
 }
 return { suspicious: reasons.length > 0, reasons };
}

function formatCheckPeriod(openedAt: string, closedAt: string | undefined, status: 'open' | 'closed'): string {
 const o = new Date(openedAt);
 const dayOpen = o.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
 const timeOpen = o.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
 if (status === 'open' || !closedAt) return `${dayOpen}, ${timeOpen}`;
 const c = new Date(closedAt);
 const sameDay = o.getFullYear() === c.getFullYear() && o.getMonth() === c.getMonth() && o.getDate() === c.getDate();
 const timeClose = c.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
 if (sameDay) return `${dayOpen}, ${timeOpen} — ${timeClose}`;
 const dayClose = c.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
 return `${dayOpen}, ${timeOpen} — ${dayClose}, ${timeClose}`;
}

function formatMoney(n: number) { return n.toLocaleString('ru-RU') + ' с'; }

function formatCheckProfit(c: Check): string {
 if (c.items.length === 0) return '—';
 if (c.items.every((i) => i.unitCost === null)) return '—';
 const base = formatMoney(c.profit);
 return c.profitIncomplete ? `${base}*` : base;
}

type PaymentFilter = 'all' | 'cash' | 'card';
type StatusFilter = 'all' | 'open' | 'closed';
type ExpandMode = 'details' | 'history';

interface HistoryEvent {
 time: string; action: string; detail: string; user: string; suspicious?: boolean;
}

function generateMockHistory(c: Check): HistoryEvent[] {
 const events: HistoryEvent[] = [];
 const opened = new Date(c.openedAt);
 const addMin = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);
 const fmtTime = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
 events.push({ time: fmtTime(opened), action: 'Открытие чека', detail: `Стол ${c.tableNumber}`, user: c.waiter });
 let minute = 2;
 for (const item of c.items) {
  events.push({ time: fmtTime(addMin(opened, minute)), action: 'Добавлено блюдо', detail: `${checkItemPositionTitle(item.qty, item.name)} — ${item.price.toLocaleString('ru-RU')} с`, user: c.waiter });
  minute += 1;
 }
 if (c.items.length > 2) {
  const removedItem = c.items[c.items.length - 1];
  events.push({ time: fmtTime(addMin(opened, minute + 5)), action: 'Пречек', detail: 'Пречек распечатан', user: c.waiter });
  events.push({ time: fmtTime(addMin(opened, minute + 8)), action: 'Удалено блюдо', detail: `${removedItem.name} × 1`, user: c.waiter, suspicious: true });
 } else if (c.status === 'closed') {
  events.push({ time: fmtTime(addMin(opened, minute + 5)), action: 'Пречек', detail: 'Пречек распечатан', user: c.waiter });
 }
 if (c.discount > 0) {
  events.push({ time: fmtTime(addMin(opened, minute + 10)), action: 'Скидка', detail: `−${c.discount.toLocaleString('ru-RU')} с`, user: c.waiter, suspicious: c.discount / c.items.reduce((s, i) => s + i.qty * i.price, 0) > 0.2 });
 }
 if (c.status === 'closed' && c.closedAt) {
  const closed = new Date(c.closedAt);
  events.push({ time: fmtTime(addMin(closed, -1)), action: 'Чек распечатан', detail: `Итого: ${c.paid.toLocaleString('ru-RU')} с`, user: c.waiter });
  events.push({ time: fmtTime(closed), action: 'Закрытие чека', detail: c.paymentMethod === 'cash' ? 'Наличные' : c.paymentMethod === 'card' ? 'Безнал' : '—', user: c.waiter });
 }
 return events;
}

function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
 return (
  <div className="max-w-lg space-y-0">
   {events.map((ev, idx) => (
    <div key={idx} className={`flex items-start gap-3 py-1.5 pl-3 text-sm ${ev.suspicious ? 'bg-amber-50 rounded-lg -mx-1 px-4' : ''}`}>
     <div className="w-[70px] shrink-0 tabular-nums text-muted-foreground text-xs pt-0.5">{ev.time}</div>
     <div className="flex-1 min-w-0">
      <span className={`font-semibold ${ev.suspicious ? 'text-amber-700' : ev.action === 'Удалено блюдо' ? 'text-red-600' : ev.action === 'Добавлено блюдо' ? 'text-foreground' : 'text-muted-foreground'}`}>
       {ev.suspicious && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}{ev.action}
      </span>
      <span className="text-muted-foreground ml-2">{ev.detail}</span>
     </div>
     <div className="w-[80px] shrink-0 text-xs text-muted-foreground text-right truncate pt-0.5">{ev.user}</div>
    </div>
   ))}
  </div>
 );
}

export function Checks() {
 const qc = useQueryClient();
 const [expanded, setExpanded] = useState<{ id: string; mode: ExpandMode } | null>(null);
 const [paidOverrides, setPaidOverrides] = useState<Record<string, number>>({});
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editValue, setEditValue] = useState('');
 const inputRef = useRef<HTMLInputElement>(null);
 const [waiterFilter, setWaiterFilter] = useState('all');
 const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [onlySuspicious, setOnlySuspicious] = useState(false);

 useEffect(() => { if (editingId) inputRef.current?.select(); }, [editingId]);

 function startEdit(id: string, current: number) { setEditingId(id); setEditValue(String(current)); }
 function commitEdit(id: string) { const val = parseFloat(editValue); if (!isNaN(val) && val >= 0) setPaidOverrides((prev) => ({ ...prev, [id]: val })); setEditingId(null); }

 const { data: checks = [], isLoading, isError, error: checksError } = useChecks();
 const WAITERS = useMemo(() => Array.from(new Set(checks.map((c) => c.waiter).filter(w => w !== '—'))), [checks]);
 const suspiciousCount = checks.filter((c) => isSuspicious(c).suspicious).length;

 const filtered = checks.filter((c) => {
  if (waiterFilter !== 'all' && c.waiter !== waiterFilter) return false;
  if (paymentFilter !== 'all' && c.paymentMethod !== paymentFilter) return false;
  if (statusFilter !== 'all' && c.status !== statusFilter) return false;
  if (onlySuspicious && !isSuspicious(c).suspicious) return false;
  return true;
 });

 async function handleDeleteCheck(id: string) {
  if (!confirm('Удалить чек?')) return;
  const { error } = await supabase.from('orders').delete().eq('id', id).eq('venue_id', VENUE_ID);
  if (error) { toast.error('Не удалось удалить чек'); return; }
  qc.invalidateQueries({ queryKey: ['checks', VENUE_ID] });
  toast.success('Чек удален');
 }

 return (
  <div className="p-8">
   <div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold">Чеки</h2></div>
   {isError && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{checksError instanceof Error ? checksError.message : 'Не удалось загрузить чеки'}</div>}

   <div className="flex items-center gap-3 mb-6 flex-wrap">
    <select className="px-3 py-1.5 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors" value={waiterFilter} onChange={(e) => setWaiterFilter(e.target.value)}>
     <option value="all">Все официанты</option>
     {WAITERS.map((w) => <option key={w} value={w}>{w}</option>)}
    </select>
    <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
     {(['all', 'cash', 'card'] as PaymentFilter[]).map((v) => (
      <button key={v} onClick={() => setPaymentFilter(v)} className={`px-3 py-1 rounded-md text-sm transition-all cursor-pointer ${paymentFilter === v ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`} style={paymentFilter === v ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}>
       {v === 'all' ? 'Все' : v === 'cash' ? 'Наличные' : 'Безналичные'}
      </button>
     ))}
    </div>
    <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
     {(['all', 'open', 'closed'] as StatusFilter[]).map((v) => (
      <button key={v} onClick={() => setStatusFilter(v)} className={`px-3 py-1 rounded-md text-sm transition-all cursor-pointer ${statusFilter === v ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`} style={statusFilter === v ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}>
       {v === 'all' ? 'Все' : v === 'open' ? 'Открытые' : 'Закрытые'}
      </button>
     ))}
    </div>
    <button onClick={() => setOnlySuspicious(!onlySuspicious)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all cursor-pointer ${onlySuspicious ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600'}`}>
     <AlertTriangle className="w-3.5 h-3.5" />Подозрительные{suspiciousCount > 0 && <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${onlySuspicious ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700'}`}>{suspiciousCount}</span>}
    </button>
   </div>

   <table className="w-full table-fixed border-separate border-spacing-0">
    <thead>
     <tr className="text-sm font-semibold text-foreground">
      <th scope="col" className="w-[32px] py-3 px-3" />
      <th scope="col" className="text-left py-3 px-3 w-[130px]">Официант</th>
      <th scope="col" className="text-left py-3 px-3">Период</th>
      <th scope="col" className="text-right py-3 px-3 w-[110px]">Оплачено</th>
      <th scope="col" className="text-right py-3 px-3 w-[110px]">Прибыль</th>
      <th scope="col" className="text-right py-3 px-3 w-[90px]">Скидка</th>
      <th scope="col" className="w-[80px]" />
      <th scope="col" className="w-[80px]" />
      <th scope="col" className="w-[36px]" />
     </tr>
    </thead>
    <tbody>
     {isLoading && <tr><td colSpan={9} className="py-8 px-3 text-sm">Загрузка...</td></tr>}
     {!isLoading && !isError && filtered.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-sm">Нет чеков по выбранным фильтрам</td></tr>}
     {!isLoading && !isError && filtered.map((c) => {
      const paid = paidOverrides[c.id] ?? c.paid;
      const isExpanded = expanded?.id === c.id;
      const expandMode = expanded?.mode ?? 'details';
      const subtotal = c.items.reduce((s, i) => s + i.qty * i.price, 0);
      const { suspicious, reasons } = isSuspicious(c);
      return (
       <>
        <tr key={c.id} onClick={() => setExpanded(isExpanded && expandMode === 'details' ? null : { id: c.id, mode: 'details' })} className={`group cursor-pointer ${isExpanded ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'} transition-colors`}>
         <td className="py-2 px-3 text-center">{suspicious && <span title={reasons.join(', ')}><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></span>}</td>
         <td className="py-2 px-3 text-sm truncate">{c.waiter}</td>
         <td className="py-2 px-3 text-sm whitespace-normal leading-snug">{formatCheckPeriod(c.openedAt, c.closedAt || undefined, c.status)}</td>
         <td className="py-2 px-3 text-sm tabular-nums text-right">
          {editingId === c.id ? (
           <input ref={inputRef} type="number" className="w-full text-right bg-white border border-primary rounded px-1 py-0.5 text-sm outline-none tabular-nums" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitEdit(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(c.id); if (e.key === 'Escape') setEditingId(null); }} />
          ) : (
           <span className="cursor-pointer hover:text-primary transition-colors" title="Нажмите для редактирования" onClick={(e) => { e.stopPropagation(); startEdit(c.id, paid); }}>{c.status === 'open' ? '—' : formatMoney(paid)}</span>
          )}
         </td>
         <td className="py-2 px-3 text-sm tabular-nums text-right text-green-600" title={c.profitIncomplete ? 'Прибыль по позициям с заполненной себестоимостью' : 'Сумма (цена − себестоимость) × кол-во'}>{formatCheckProfit(c)}</td>
         <td className="py-2 px-3 text-sm tabular-nums text-right">{c.discount > 0 ? <span>−{formatMoney(c.discount)}</span> : '—'}</td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded && expandMode === 'history' ? null : { id: c.id, mode: 'history' }); }} className={`text-xs font-semibold transition-colors cursor-pointer ${isExpanded && expandMode === 'history' ? 'text-[#F70000]' : 'text-primary hover:text-primary/70'}`}>История</button>
         </td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded && expandMode === 'details' ? null : { id: c.id, mode: 'details' }); }} className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer">Изменить</button>
         </td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteButton onClick={() => handleDeleteCheck(c.id)} /></td>
        </tr>
        {isExpanded && expandMode === 'details' && (
         <tr key={`${c.id}-details`} className="bg-[#EFF0F4]"><td colSpan={9} className="pb-4 pt-0 pl-6">
          {suspicious && <div className="flex items-center gap-1.5 pb-2 text-sm text-amber-600 font-semibold"><AlertTriangle className="w-3 h-3 shrink-0" />{reasons.join(' · ')}</div>}
          <div className="w-full min-w-0 max-w-xs space-y-0 pr-2">
           <div className={`${CHECK_ITEMS_TABLE_GRID} pb-1 text-xs text-foreground`}><div className="min-w-0">Позиция</div><div className="text-right">Цена</div><div className="text-right tabular-nums">Сумма</div><div className="text-right tabular-nums">Маржа</div></div>
           {c.items.map((item, idx) => (
            <div key={idx} className={`${CHECK_ITEMS_TABLE_GRID} py-0.5 text-sm`}>
             <div className="min-w-0 flex items-baseline gap-1" title={checkItemPositionTitle(item.qty, item.name)}><span className="tabular-nums shrink-0">{item.qty}×</span><span className="min-w-0 truncate">{item.name}</span></div>
             <div className="text-right tabular-nums">{formatMoney(item.price)}</div>
             <div className="text-right tabular-nums">{formatMoney(item.qty * item.price)}</div>
             <div className="text-right tabular-nums text-green-600">{item.unitCost === null ? <span className="text-xs">—</span> : formatMoney(item.qty * (item.price - item.unitCost))}</div>
            </div>
           ))}
           <div className={`${CHECK_ITEMS_TABLE_GRID} pt-2 mt-1 border-t border-border text-sm`}><div className="min-w-0">Итого</div><div /><div className="text-right tabular-nums">{formatMoney(subtotal)}</div><div className="text-right tabular-nums text-green-600">{formatCheckProfit(c)}</div></div>
           {c.discount > 0 && <div className={`${CHECK_ITEMS_TABLE_GRID} text-sm text-amber-600`}><div className="min-w-0">Скидка</div><div /><div className="text-right tabular-nums">−{formatMoney(c.discount)}</div><div /></div>}
           {c.status === 'closed' && <div className={`${CHECK_ITEMS_TABLE_GRID} text-sm text-foreground`}><div className="min-w-0">К оплате</div><div /><div className="text-right tabular-nums">{formatMoney(paid)}</div><div /></div>}
          </div>
         </td></tr>
        )}
        {isExpanded && expandMode === 'history' && (
         <tr key={`${c.id}-history`} className="bg-[#EFF0F4]"><td colSpan={9} className="pb-4 pt-0 pl-6"><HistoryTimeline events={generateMockHistory(c)} /></td></tr>
        )}
       </>
      );
     })}
    </tbody>
   </table>
  </div>
 );
}
