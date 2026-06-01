import { useState, useRef, useEffect, useMemo } from 'react';
import { AlertTriangle, Info, ShieldAlert, ChevronDown } from 'lucide-react';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { toast } from 'sonner';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { useChecks, type Check, type OrderSource } from '@/hooks/useChecksData';
import { useQueryClient } from '@tanstack/react-query';
import { CHECK_ITEMS_TABLE_GRID, checkItemPositionTitle } from '@/lib/checkItemsTableGrid';
import {
  analyzeChecks,
  countBySeverity,
  severityLabel,
  severityBorderClass,
  severityBgClass,
  type Severity,
  type Finding,
} from '@/lib/checkAnalysis';

// ─── Format table column ────────────────────────────────

const SOURCE_LABELS: Record<OrderSource, { label: string; className: string }> = {
  pos: { label: '', className: '' },          // handled inline
  glovo: { label: 'Glovo', className: 'text-green-600 font-medium' },
  yandex_eda: { label: 'Яндекс', className: 'text-amber-500 font-medium' },
};

function formatTable(c: Check) {
  if (c.source === 'glovo' || c.source === 'yandex_eda') {
    const s = SOURCE_LABELS[c.source];
    const id = c.externalOrderId ? ` #${c.externalOrderId}` : '';
    return { label: `${s.label}${id}`, className: s.className, isAggregator: true };
  }
  if (c.isQuickCheck) {
    return { label: 'На вынос', className: 'text-muted-foreground/60 italic', isAggregator: false };
  }
  return { label: c.tableNumber === '—' ? '—' : c.tableNumber, className: '', isAggregator: false };
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

// ─── Types ──────────────────────────────────────────────

type PaymentFilter = 'all' | 'cash' | 'card';
type StatusFilter = 'all' | 'open' | 'closed';
type SeverityFilter = 'all' | Severity;
type ExpandMode = 'details' | 'history';

interface HistoryEvent {
  time: string; action: string; detail: string; user: string; suspicious?: boolean;
}

function generateMockHistory(c: Check): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const opened = new Date(c.openedAt);
  const addMin = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);
  const fmtTime = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  events.push({ time: fmtTime(opened), action: 'Открытие чека', detail: c.isQuickCheck ? 'Быстрый чек' : `Стол ${c.tableNumber}`, user: c.waiter });
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
    events.push({ time: fmtTime(addMin(opened, minute + 10)), action: 'Скидка', detail: `−${c.discount.toLocaleString('ru-RU')} с`, user: c.waiter });
  }
  if (c.status === 'closed' && c.closedAt) {
    const closed = new Date(c.closedAt);
    events.push({ time: fmtTime(addMin(closed, -1)), action: 'Чек распечатан', detail: `Итого: ${c.paid.toLocaleString('ru-RU')} с`, user: c.waiter });
    events.push({ time: fmtTime(closed), action: 'Закрытие чека', detail: c.paymentMethod === 'cash' ? 'Наличные' : c.paymentMethod === 'card' ? 'Безнал' : '—', user: c.waiter });
  }
  return events;
}

// ─── Severity icon ──────────────────────────────────────

function SeverityIcon({ severity }: { severity: Severity }) {
  switch (severity) {
    case 'critical':
      return <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
  }
}

function severityTextColor(s: Severity): string {
  switch (s) {
    case 'critical': return 'text-red-700';
    case 'warning': return 'text-amber-700';
    case 'info': return 'text-blue-600';
  }
}

// ─── Findings panel ─────────────────────────────────────

function FindingsPanel({ findings }: { findings: Finding[] }) {
  return (
    <div className="space-y-2">
      {findings.map((f, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <SeverityIcon severity={f.severity} />
          <div>
            <p className={`font-semibold ${severityTextColor(f.severity)}`}>{f.reason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

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
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  useEffect(() => { if (editingId) inputRef.current?.select(); }, [editingId]);

  function startEdit(id: string, current: number) { setEditingId(id); setEditValue(String(current)); }
  function commitEdit(id: string) { const val = parseFloat(editValue); if (!isNaN(val) && val >= 0) setPaidOverrides((prev) => ({ ...prev, [id]: val })); setEditingId(null); }

  const { data: checks = [], isLoading, isError, error: checksError } = useChecks();

  // ── Analysis ──
  const analyses = useMemo(() => analyzeChecks(checks), [checks]);
  const severityCounts = useMemo(() => countBySeverity(analyses), [analyses]);

  const WAITERS = useMemo(() => Array.from(new Set(checks.map((c) => c.waiter).filter(w => w !== '—'))), [checks]);

  const filtered = checks.filter((c) => {
    if (waiterFilter !== 'all' && c.waiter !== waiterFilter) return false;
    if (paymentFilter !== 'all' && c.paymentMethod !== paymentFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (severityFilter !== 'all') {
      const a = analyses.get(c.id);
      if (!a || a.maxSeverity !== severityFilter) return false;
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Чеки</h2>
          {severityCounts.critical + severityCounts.warning > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {severityCounts.critical > 0 && (
                <span className="text-red-600 font-medium">{severityCounts.critical} критичных</span>
              )}
              {severityCounts.critical > 0 && severityCounts.warning > 0 && <span> · </span>}
              {severityCounts.warning > 0 && (
                <span className="text-amber-600 font-medium">{severityCounts.warning} странных</span>
              )}
            </p>
          )}
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {checksError instanceof Error ? checksError.message : 'Не удалось загрузить чеки'}
        </div>
      )}

      {/* Filters row */}
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
        {/* Severity filter pills */}
        <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
          <button onClick={() => setSeverityFilter('all')} className={`px-3 py-1 rounded-md text-sm transition-all cursor-pointer ${severityFilter === 'all' ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`} style={severityFilter === 'all' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}>Все</button>
          {severityCounts.critical > 0 && (
            <button onClick={() => setSeverityFilter('critical')} className={`px-3 py-1 rounded-md text-sm transition-all cursor-pointer flex items-center gap-1.5 ${severityFilter === 'critical' ? 'bg-white text-red-700' : 'text-muted-foreground hover:text-red-600'}`} style={severityFilter === 'critical' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}>
              <ShieldAlert className="w-3.5 h-3.5" />{severityCounts.critical}
            </button>
          )}
          {severityCounts.warning > 0 && (
            <button onClick={() => setSeverityFilter('warning')} className={`px-3 py-1 rounded-md text-sm transition-all cursor-pointer flex items-center gap-1.5 ${severityFilter === 'warning' ? 'bg-white text-amber-700' : 'text-muted-foreground hover:text-amber-600'}`} style={severityFilter === 'warning' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}>
              <AlertTriangle className="w-3.5 h-3.5" />{severityCounts.warning}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <table className="table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-sm font-semibold text-foreground">
            <th scope="col" className="text-left py-3 px-3 w-[130px]">Официант</th>
            <th scope="col" className="text-left py-3 px-3 w-[110px]">Стол</th>
            <th scope="col" className="text-left py-3 px-3">Период / Статус</th>
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
          {!isLoading && !isError && filtered.length === 0 && (
            <tr><td colSpan={9}>
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Info className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium mb-1">
                  {severityFilter !== 'all'
                    ? `Нет чеков с уровнем «${severityLabel(severityFilter as Severity).toLowerCase()}»`
                    : 'Чеков пока нет'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {severityFilter !== 'all'
                    ? 'Попробуйте выбрать другой фильтр'
                    : 'Чеки появятся, когда официанты начнут принимать заказы через POS-терминал'}
                </p>
              </div>
            </td></tr>
          )}

          {!isLoading && !isError && filtered.map((c) => {
            const paid = paidOverrides[c.id] ?? c.paid;
            const analysis = analyses.get(c.id);
            const isExpanded = expanded?.id === c.id;
            const expandMode = expanded?.mode ?? 'details';
            const subtotalVal = c.items.reduce((s, i) => s + i.qty * i.price, 0);

            return (
              <>
                <tr
                  key={c.id}
                  onClick={() => setExpanded(isExpanded && expandMode === 'details' ? null : { id: c.id, mode: 'details' })}
                  className={`group cursor-pointer border-l-3 transition-colors
                    ${isExpanded ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'}
                    ${severityBorderClass(analysis?.maxSeverity ?? null)}
                    ${!isExpanded ? severityBgClass(analysis?.maxSeverity ?? null) : ''}`}
                >
                  <td className="py-2 px-3 text-sm truncate">{c.waiter}</td>
                  <td className="py-2 px-3 text-sm">
                    {(() => { const t = formatTable(c); return <span className={t.className}>{t.label}</span>; })()}
                  </td>
                  <td className="py-2 px-3 text-sm whitespace-normal leading-snug">
                    {formatCheckPeriod(c.openedAt, c.closedAt || undefined, c.status)}
                    {c.status === 'open' && (
                      <span className="ml-2 text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Открыт</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sm tabular-nums text-right">
                    {editingId === c.id ? (
                      <input ref={inputRef} type="number" className="w-full text-right bg-white border border-primary rounded px-1 py-0.5 text-sm outline-none tabular-nums" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitEdit(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(c.id); if (e.key === 'Escape') setEditingId(null); }} />
                    ) : (
                      <span className="cursor-pointer hover:text-primary transition-colors" title="Нажмите для редактирования" onClick={(e) => { e.stopPropagation(); startEdit(c.id, paid); }}>
                        {c.status === 'open' ? '—' : formatMoney(paid)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sm tabular-nums text-right text-green-600" title={c.profitIncomplete ? 'Прибыль по позициям с заполненной себестоимостью' : 'Сумма (цена − себестоимость) × кол-во'}>
                    {formatCheckProfit(c)}
                  </td>
                  <td className="py-2 px-3 text-sm tabular-nums text-right">
                    {c.discount > 0 ? <span>−{formatMoney(c.discount)}</span> : '—'}
                  </td>
                  {/* Always-visible actions (opacity-40, full on hover) */}
                  <td className="py-2 px-3 opacity-60 group-hover:opacity-100 transition-opacity rounded hover:bg-muted/50">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded && expandMode === 'history' ? null : { id: c.id, mode: 'history' }); }} className={`text-xs font-semibold transition-colors cursor-pointer ${isExpanded && expandMode === 'history' ? 'text-[#F70000]' : 'text-primary hover:text-primary/70'}`}>История</button>
                  </td>
                  <td className="py-2 px-3 opacity-60 group-hover:opacity-100 transition-opacity rounded hover:bg-muted/50">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded && expandMode === 'details' ? null : { id: c.id, mode: 'details' }); }} className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer">Состав</button>
                  </td>
                  <td className="py-2 px-3 opacity-60 group-hover:opacity-100 transition-opacity rounded hover:bg-muted/50">
                    <DeleteButton onClick={() => handleDeleteCheck(c.id)} />
                  </td>
                </tr>

                {/* Expanded: findings (if any) + items */}
                {isExpanded && expandMode === 'details' && (
                  <tr key={`${c.id}-details`} className={`bg-[#EFF0F4] ${severityBorderClass(analysis?.maxSeverity ?? null)}`}>
                    <td colSpan={9} className="pb-4 pt-0 pl-6">
                      {analysis && analysis.findings.length > 0 && (
                        <div className="mb-3">
                          <FindingsPanel findings={analysis.findings} />
                        </div>
                      )}
                      <div className="w-full min-w-0 max-w-xs space-y-0 pr-2">
                        <div className={`${CHECK_ITEMS_TABLE_GRID} pb-1 text-xs text-foreground`}>
                          <div className="min-w-0">Позиция</div><div className="text-right">Цена</div><div className="text-right tabular-nums">Сумма</div><div className="text-right tabular-nums">Маржа</div>
                        </div>
                        {c.items.map((item, idx) => (
                          <div key={idx} className={`${CHECK_ITEMS_TABLE_GRID} py-0.5 text-sm`}>
                            <div className="min-w-0 flex items-baseline gap-1" title={checkItemPositionTitle(item.qty, item.name)}>
                              <span className="tabular-nums shrink-0">{item.qty}×</span><span className="min-w-0 truncate">{item.name}</span>
                            </div>
                            <div className="text-right tabular-nums">{formatMoney(item.price)}</div>
                            <div className="text-right tabular-nums">{formatMoney(item.qty * item.price)}</div>
                            <div className="text-right tabular-nums text-green-600">
                              {item.unitCost === null ? <span className="text-xs">—</span> : formatMoney(item.qty * (item.price - item.unitCost))}
                            </div>
                          </div>
                        ))}
                        <div className={`${CHECK_ITEMS_TABLE_GRID} pt-2 mt-1 border-t border-border text-sm`}>
                          <div className="min-w-0">Итого</div><div /><div className="text-right tabular-nums">{formatMoney(subtotalVal)}</div><div className="text-right tabular-nums text-green-600">{formatCheckProfit(c)}</div>
                        </div>
                        {c.discount > 0 && (
                          <div className={`${CHECK_ITEMS_TABLE_GRID} text-sm text-amber-600`}>
                            <div className="min-w-0">Скидка</div><div /><div className="text-right tabular-nums">−{formatMoney(c.discount)}</div><div />
                          </div>
                        )}
                        {c.status === 'closed' && (
                          <div className={`${CHECK_ITEMS_TABLE_GRID} text-sm text-foreground`}>
                            <div className="min-w-0">К оплате</div><div /><div className="text-right tabular-nums">{formatMoney(paid)}</div><div />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expanded: history */}
                {isExpanded && expandMode === 'history' && (
                  <tr key={`${c.id}-history`} className={`bg-[#EFF0F4] ${severityBorderClass(analysis?.maxSeverity ?? null)}`}>
                    <td colSpan={9} className="pb-4 pt-0 pl-6">
                      <div className="max-w-lg space-y-0">
                        {generateMockHistory(c).map((ev, idx) => (
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
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
