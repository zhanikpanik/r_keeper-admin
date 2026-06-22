import { useState, useRef, useEffect, useMemo } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { useChecks, type Check, type OrderSource, type OrderEvent } from '@/hooks/useChecksData';
import { useQueryClient } from '@tanstack/react-query';
import { CHECK_ITEMS_TABLE_GRID, checkItemPositionTitle } from '@/lib/checkItemsTableGrid';
import { DatePresetPicker } from '@/components/ui/DatePresetPicker';
import {
  analyzeChecks,
  countBySeverity,
  severityLabel,
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
type ExpandTab = 'details' | 'history';

/** Human-readable labels for order event actions */
const EVENT_LABELS: Record<string, string> = {
  item_added: 'Добавлено блюдо',
  item_removed: 'Удалено блюдо',
  precheck_printed: 'Пречек',
  paid: 'Закрытие чека',
  cancelled: 'Отмена чека',
  refunded: 'Возврат',
};

function formatEventDetail(ev: OrderEvent): string {
  switch (ev.action) {
    case 'item_added':
    case 'item_removed':
      return ev.productName
        ? `${ev.productName}${ev.quantity != null ? ` × ${ev.quantity}` : ''}${ev.unitPrice != null ? ` — ${Number(ev.unitPrice).toLocaleString('ru-RU')} с` : ''}`
        : '';
    case 'paid':
      return '';
    case 'cancelled':
      return '';
    case 'precheck_printed':
      return 'Пречек распечатан';
    default:
      return '';
  }
}

function isEventSuspicious(ev: OrderEvent): boolean {
  return ev.action === 'item_removed';
}

function SeverityDot({ severity }: { severity: Severity | null }) {
  if (!severity) return <div />;
  const color = severity === 'critical' ? 'bg-red-500' : severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400';
  return <div className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

// ─── Main component ─────────────────────────────────────

export function Checks() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandTab, setExpandTab] = useState<ExpandTab>('details');
  const [paidOverrides, setPaidOverrides] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [waiterFilter, setWaiterFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Default to today
  const todayStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }, []);
  const [fromDate, setFromDate] = useState<string>(todayStr);

  useEffect(() => { if (editingId) inputRef.current?.select(); }, [editingId]);

  function startEdit(id: string, current: number) { setEditingId(id); setEditValue(String(current)); }
  function commitEdit(id: string) { const val = parseFloat(editValue); if (!isNaN(val) && val >= 0) setPaidOverrides((prev) => ({ ...prev, [id]: val })); setEditingId(null); }

  const fromDateIso = fromDate ? new Date(fromDate).toISOString() : undefined;
  const { data: checks = [], isLoading, isError, error: checksError } = useChecks(fromDateIso);

  // ── Analysis ──
  const analyses = useMemo(() => {
    const result = analyzeChecks(checks);
    // Rule: items removed after precheck
    for (const c of checks) {
      if (!c.events || c.events.length === 0) continue;
      const precheckIdx = c.events.findIndex(ev => ev.action === 'precheck_printed');
      if (precheckIdx === -1) continue;
      const hasRemovalAfter = c.events.slice(precheckIdx + 1).some(ev => ev.action === 'item_removed');
      if (!hasRemovalAfter) continue;
      const a = result.get(c.id)!;
      a.findings = [{
        severity: 'warning' as Severity,
        reason: 'Удаление блюд после пречека',
        detail: 'Блюда удалены из чека после отправки на кухню. Возможно, часть заказа не пробита.',
      }, ...a.findings];
      if (!a.maxSeverity || a.maxSeverity === 'info') {
        a.maxSeverity = 'warning';
      }
    }
    return result;
  }, [checks]);
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
          <p className="text-sm text-muted-foreground mt-1">
            {severityCounts.critical + severityCounts.warning > 0 ? (
              <>
                {severityCounts.critical > 0 && (
                  <span className="text-red-600 font-medium">{severityCounts.critical} критичных</span>
                )}
                {severityCounts.critical > 0 && severityCounts.warning > 0 && <span> · </span>}
                {severityCounts.warning > 0 && (
                  <span className="text-amber-600 font-medium">{severityCounts.warning} странных</span>
                )}
              </>
            ) : (
              <span>0 проблем</span>
            )}
          </p>
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {checksError instanceof Error ? checksError.message : 'Не удалось загрузить чеки'}
        </div>
      )}

      {/* Period */}
      <DatePresetPicker value={fromDate} onChange={setFromDate} className="mb-6" />

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select className="px-3 py-1.5 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors" value={waiterFilter} onChange={(e) => setWaiterFilter(e.target.value)}>
          <option value="all">Все официанты</option>
          {WAITERS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <div className="inline-flex rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          {(['all', 'cash', 'card'] as PaymentFilter[]).map((v) => (
            <button key={v} onClick={() => setPaymentFilter(v)} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${paymentFilter === v ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {v === 'all' ? 'Все' : v === 'cash' ? 'Наличные' : 'Безналичные'}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          {(['all', 'open', 'closed'] as StatusFilter[]).map((v) => (
            <button key={v} onClick={() => setStatusFilter(v)} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${statusFilter === v ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {v === 'all' ? 'Все' : v === 'open' ? 'Открытые' : 'Закрытые'}
            </button>
          ))}
        </div>
        {/* Severity filter pills — only when there are problems */}
        {severityCounts.critical + severityCounts.warning > 0 && (
        <div className="inline-flex rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          <button onClick={() => setSeverityFilter('all')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer ${severityFilter === 'all' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Все</button>
          {severityCounts.critical > 0 && (
            <button onClick={() => setSeverityFilter('critical')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 ${severityFilter === 'critical' ? 'bg-white text-red-700 shadow-sm' : 'text-muted-foreground hover:text-red-600'}`}>
              <ShieldAlert className="w-3.5 h-3.5" />{severityCounts.critical}
            </button>
          )}
          {severityCounts.warning > 0 && (
            <button onClick={() => setSeverityFilter('warning')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 ${severityFilter === 'warning' ? 'bg-white text-amber-700 shadow-sm' : 'text-muted-foreground hover:text-amber-600'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />{severityCounts.warning}
            </button>
          )}
        </div>
        )}
      </div>

      {/* Table */}
      <div className="max-w-4xl">
      <table className="table-fixed border-separate border-spacing-0 w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="text-sm font-medium text-foreground">
            <th scope="col" className="w-[20px]" />
            <th scope="col" className="text-left py-1.5 px-3 w-[130px]">Официант</th>
            <th scope="col" className="text-left py-1.5 px-3 w-[110px]">Стол</th>
            <th scope="col" className="text-left py-1.5 px-3">Период</th>
            <th scope="col" className="text-left py-1.5 px-3 w-[70px]">Статус</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Оплачено</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Прибыль</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[90px]">Скидка</th>
            <th scope="col" className="py-1.5 w-[56px] pr-3" />
          </tr>
        </thead>
        <tbody>
          {isLoading && <tr><td colSpan={9} className="py-8 px-3 text-sm">Загрузка...</td></tr>}
          {!isLoading && !isError && filtered.length === 0 && (
            <tr><td colSpan={9}>
              <EmptyState
                title={severityFilter !== 'all'
                  ? `Нет чеков с уровнем «${severityLabel(severityFilter as Severity).toLowerCase()}»`
                  : 'Чеков пока нет'}
                hint={severityFilter !== 'all'
                  ? 'Попробуйте выбрать другой фильтр'
                  : 'Чеки появятся, когда официанты начнут принимать заказы через POS-терминал'}
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Info className="w-6 h-6 text-muted-foreground/40" />
                </div>
              </EmptyState>
            </td></tr>
          )}

          {!isLoading && !isError && filtered.map((c) => {
            const paid = paidOverrides[c.id] ?? c.paid;
            const analysis = analyses.get(c.id);
            const isExpanded = expandedId === c.id;
            const subtotalVal = c.items.reduce((s, i) => s + i.qty * i.price, 0);

            return (
              <>
                <tr
                  key={c.id}
                  onClick={() => { setExpandedId(isExpanded ? null : c.id); if (!isExpanded) setExpandTab('details'); }}
                  className={`group cursor-pointer transition-colors
                    ${isExpanded ? 'bg-black/[0.03]' : 'hover:bg-black/[0.03]'}`}
                >
                  <td className="py-1.5 px-3">
                    <SeverityDot severity={analysis?.maxSeverity ?? null} />
                  </td>
                  <td className="py-1.5 px-3 text-sm truncate">{c.waiter}</td>
                  <td className="py-1.5 px-3 text-sm">
                    {(() => { const t = formatTable(c); return <span className={t.className}>{t.label}</span>; })()}
                  </td>
                  <td className="py-1.5 px-3 text-sm whitespace-nowrap leading-snug">
                    {formatCheckPeriod(c.openedAt, c.closedAt || undefined, c.status)}
                  </td>
                  <td className="py-1.5 px-3 text-sm">
                    {c.status === 'open' ? (
                      <span className="text-amber-600 font-medium">Открыт</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 px-3 text-sm tabular-nums whitespace-nowrap text-right">
                    {editingId === c.id ? (
                      <input ref={inputRef} type="number" className="w-full text-right bg-white border border-border rounded px-1 py-0.5 text-sm outline-none tabular-nums whitespace-nowrap" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitEdit(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(c.id); if (e.key === 'Escape') setEditingId(null); }} />
                    ) : (
                      <span className="cursor-pointer hover:text-primary transition-colors" title="Нажмите для редактирования" onClick={(e) => { e.stopPropagation(); startEdit(c.id, paid); }}>
                        {c.status === 'open' ? '—' : formatMoney(paid)}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-sm tabular-nums whitespace-nowrap text-right text-green-600" title={c.profitIncomplete ? 'Прибыль по позициям с заполненной себестоимостью' : 'Сумма (цена − себестоимость) × кол-во'}>
                    {formatCheckProfit(c)}
                  </td>
                  <td className="py-1.5 px-3 text-sm tabular-nums whitespace-nowrap text-right">
                    {c.discount > 0 ? <span>−{formatMoney(c.discount)}</span> : '—'}
                  </td>
                  <td className="py-1.5 pr-4 opacity-40 group-hover:opacity-100 transition-opacity">
                    <DeleteButton onClick={() => handleDeleteCheck(c.id)} />
                  </td>
                </tr>

                {/* Expanded: tabs with items or history, findings at bottom */}
                {isExpanded && (
                  <tr key={`${c.id}-expand`} className="bg-black/[0.03]">
                    <td colSpan={9} className="py-2 pl-[32px] pr-3">
                      <div className="inline-flex rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] mb-3">
                        <button onClick={() => setExpandTab('details')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${expandTab === 'details' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Состав</button>
                        <button onClick={() => setExpandTab('history')} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${expandTab === 'history' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>История</button>
                      </div>
                      {expandTab === 'details' ? (
                        <div className="w-full min-w-0 max-w-xs space-y-0 pr-2">
                          <div className={`${CHECK_ITEMS_TABLE_GRID} pb-1 text-sm text-muted-foreground`}>
                            <div className="min-w-0">Позиция</div><div className="text-right">Цена</div><div className="text-right tabular-nums whitespace-nowrap">Сумма</div><div className="text-right tabular-nums whitespace-nowrap">Маржа</div>
                          </div>
                          {c.items.map((item, idx) => (
                            <div key={idx} className={`${CHECK_ITEMS_TABLE_GRID} py-0.5 text-sm`}>
                              <div className="min-w-0 flex items-baseline gap-1" title={checkItemPositionTitle(item.qty, item.name)}>
                                <span className="tabular-nums whitespace-nowrap shrink-0">{item.qty}×</span><span className="min-w-0 truncate">{item.name}</span>
                              </div>
                              <div className="text-right tabular-nums whitespace-nowrap">{formatMoney(item.price)}</div>
                              <div className="text-right tabular-nums whitespace-nowrap">{formatMoney(item.qty * item.price)}</div>
                              <div className="text-right tabular-nums whitespace-nowrap text-green-600">
                                {item.unitCost === null ? <span className="text-sm">—</span> : formatMoney(item.qty * (item.price - item.unitCost))}
                              </div>
                            </div>
                          ))}
                          <div className={`${CHECK_ITEMS_TABLE_GRID} pt-2 mt-1 border-t border-border text-sm`}>
                            <div className="min-w-0">Итого</div><div /><div className="text-right tabular-nums whitespace-nowrap">{formatMoney(subtotalVal)}</div><div className="text-right tabular-nums whitespace-nowrap text-green-600">{formatCheckProfit(c)}</div>
                          </div>
                          {c.discount > 0 && (
                            <div className={`${CHECK_ITEMS_TABLE_GRID} text-sm text-amber-600`}>
                              <div className="min-w-0">Скидка</div><div /><div className="text-right tabular-nums whitespace-nowrap">−{formatMoney(c.discount)}</div><div />
                            </div>
                          )}
                          {c.status === 'closed' && (
                            <div className={`${CHECK_ITEMS_TABLE_GRID} text-sm text-foreground`}>
                              <div className="min-w-0">К оплате</div><div /><div className="text-right tabular-nums whitespace-nowrap">{formatMoney(paid)}</div><div />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="max-w-lg space-y-0">
                          {!c.events || c.events.length === 0 && (
                            <p className="text-sm text-muted-foreground py-4">Нет событий</p>
                          )}
                          {(c.events ?? []).map((ev) => {
                            const t = new Date(ev.occurredAt);
                            const timeStr = t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const suspicious = isEventSuspicious(ev);
                            const label = EVENT_LABELS[ev.action] || ev.action;
                            const detail = formatEventDetail(ev);
                            return (
                            <div key={ev.id} className={`flex items-start gap-3 py-1.5 pl-3 text-sm ${suspicious ? 'bg-amber-50 rounded-lg -mx-1 px-4' : ''}`}>
                              <div className="w-[70px] shrink-0 tabular-nums whitespace-nowrap text-muted-foreground text-sm pt-0.5">{timeStr}</div>
                              <div className="flex-1 min-w-0">
                                <span className={`font-medium ${suspicious ? 'text-amber-700' : ev.action === 'item_removed' ? 'text-red-600' : ev.action === 'item_added' ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {suspicious && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}{label}
                                </span>
                                {detail && <span className="text-muted-foreground ml-2">{detail}</span>}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                      {analysis && analysis.findings.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border space-y-1">
                          {analysis.findings.map((f, i) => (
                            <p key={i} className="text-sm">
                              <span className={`font-medium ${f.severity === 'critical' ? 'text-red-600' : f.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}>{f.reason}</span>
                              <span className="text-muted-foreground ml-2">{f.detail}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
