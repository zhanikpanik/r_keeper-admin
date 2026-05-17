import { useState, useRef, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useChecks, type Check } from '@/hooks/useChecksData';
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

/** e.g. «30 апреля, 19:45 — 19:47» same day; «30 апреля, 18:03 — 1 мая, 19:51» across midnight */
function formatCheckPeriod(openedAt: string, closedAt: string | undefined, status: 'open' | 'closed'): string {
  const o = new Date(openedAt);
  const dayOpen = o.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const timeOpen = o.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  if (status === 'open' || !closedAt) {
    return `${dayOpen}, ${timeOpen}`;
  }

  const c = new Date(closedAt);
  const sameDay =
    o.getFullYear() === c.getFullYear() &&
    o.getMonth() === c.getMonth() &&
    o.getDate() === c.getDate();

  const timeClose = c.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  if (sameDay) {
    return `${dayOpen}, ${timeOpen} — ${timeClose}`;
  }

  const dayClose = c.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${dayOpen}, ${timeOpen} — ${dayClose}, ${timeClose}`;
}

function formatMoney(n: number) {
  return n.toLocaleString('ru-RU') + ' с';
}

/** Маржа по чеку: только строки с известной себестоимостью; * = неполные данные */
function formatCheckProfit(c: Check): string {
  if (c.items.length === 0) return '—';
  if (c.items.every((i) => i.unitCost === null)) return '—';
  const base = formatMoney(c.profit);
  return c.profitIncomplete ? `${base}*` : base;
}

type PaymentFilter = 'all' | 'cash' | 'card';
type StatusFilter = 'all' | 'open' | 'closed';

const CHECK_GRID_TEMPLATE = '32px 130px minmax(200px,280px) 110px 110px 90px minmax(7rem,auto)';

type ExpandMode = 'details' | 'history';

// ─── Mock history ────────────────────────────────────────────────────────────

interface HistoryEvent {
  time: string;
  action: string;
  detail: string;
  user: string;
  suspicious?: boolean;
}

function generateMockHistory(c: Check): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const opened = new Date(c.openedAt);
  const addMin = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  events.push({
    time: fmtTime(opened),
    action: 'Открытие чека',
    detail: `Стол ${c.tableNumber}`,
    user: c.waiter,
  });

  let minute = 2;
  for (const item of c.items) {
    events.push({
      time: fmtTime(addMin(opened, minute)),
      action: 'Добавлено блюдо',
      detail: `${checkItemPositionTitle(item.qty, item.name)} — ${item.price.toLocaleString('ru-RU')} с`,
      user: c.waiter,
    });
    minute += 1;
  }

  if (c.items.length > 2) {
    const removedItem = c.items[c.items.length - 1];
    const precheckTime = addMin(opened, minute + 5);
    events.push({
      time: fmtTime(precheckTime),
      action: 'Пречек',
      detail: 'Пречек распечатан',
      user: c.waiter,
    });

    const deleteTime = addMin(opened, minute + 8);
    events.push({
      time: fmtTime(deleteTime),
      action: 'Удалено блюдо',
      detail: `${removedItem.name} × 1`,
      user: c.waiter,
      suspicious: true,
    });
  } else if (c.status === 'closed') {
    events.push({
      time: fmtTime(addMin(opened, minute + 5)),
      action: 'Пречек',
      detail: 'Пречек распечатан',
      user: c.waiter,
    });
  }

  if (c.discount > 0) {
    events.push({
      time: fmtTime(addMin(opened, minute + 10)),
      action: 'Скидка',
      detail: `−${c.discount.toLocaleString('ru-RU')} с`,
      user: c.waiter,
      suspicious: c.discount / c.items.reduce((s, i) => s + i.qty * i.price, 0) > 0.2,
    });
  }

  if (c.status === 'closed' && c.closedAt) {
    const closed = new Date(c.closedAt);
    events.push({
      time: fmtTime(addMin(closed, -1)),
      action: 'Чек распечатан',
      detail: `Итого: ${c.paid.toLocaleString('ru-RU')} с`,
      user: c.waiter,
    });
    events.push({
      time: fmtTime(closed),
      action: 'Закрытие чека',
      detail: c.paymentMethod === 'cash' ? 'Наличные' : c.paymentMethod === 'card' ? 'Безнал' : '—',
      user: c.waiter,
    });
  }

  return events;
}

function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  return (
    <div className="max-w-lg space-y-0">
      {events.map((ev, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-3 py-1.5 pl-3 text-sm ${
            ev.suspicious ? 'bg-amber-50 rounded-lg -mx-1 px-4' : ''
          }`}
        >
          <div className="w-[70px] shrink-0 tabular-nums text-muted-foreground text-xs pt-0.5">
            {ev.time}
          </div>
          <div className="flex-1 min-w-0">
            <span
              className={`font-semibold ${
                ev.suspicious
                  ? 'text-amber-700'
                  : ev.action === 'Удалено блюдо'
                    ? 'text-red-600'
                    : ev.action === 'Добавлено блюдо'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
              }`}
            >
              {ev.suspicious && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}
              {ev.action}
            </span>
            <span className="text-muted-foreground ml-2">{ev.detail}</span>
          </div>
          <div className="w-[80px] shrink-0 text-xs text-muted-foreground text-right truncate pt-0.5">
            {ev.user}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Checks() {
  const [expanded, setExpanded] = useState<{ id: string; mode: ExpandMode } | null>(null);
  const [paidOverrides, setPaidOverrides] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [waiterFilter, setWaiterFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlySuspicious, setOnlySuspicious] = useState(false);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function startEdit(id: string, current: number) { setEditingId(id); setEditValue(String(current)); }
  function commitEdit(id: string) {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) setPaidOverrides((prev) => ({ ...prev, [id]: val }));
    setEditingId(null);
  }

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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Чеки</h2>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {checksError instanceof Error ? checksError.message : 'Не удалось загрузить чеки'}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          className="px-3 py-1.5 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
          value={waiterFilter}
          onChange={(e) => setWaiterFilter(e.target.value)}
        >
          <option value="all">Все официанты</option>
          {WAITERS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>

        <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
          {(['all', 'cash', 'card'] as PaymentFilter[]).map((v) => (
            <button key={v} onClick={() => setPaymentFilter(v)}
              className={`px-3 py-1 rounded-md text-sm transition-all ${paymentFilter === v ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              style={paymentFilter === v ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
            >
              {v === 'all' ? 'Все' : v === 'cash' ? 'Наличные' : 'Безналичные'}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}>
          {(['all', 'open', 'closed'] as StatusFilter[]).map((v) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1 rounded-md text-sm transition-all ${statusFilter === v ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              style={statusFilter === v ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
            >
              {v === 'all' ? 'Все' : v === 'open' ? 'Открытые' : 'Закрытые'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setOnlySuspicious(!onlySuspicious)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
            onlySuspicious ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Подозрительные
          {suspiciousCount > 0 && (
            <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${onlySuspicious ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700'}`}>
              {suspiciousCount}
            </span>
          )}
        </button>
      </div>

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: CHECK_GRID_TEMPLATE }}
      >
        <div className="col-span-7 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div />
          <div className="pr-6">Официант</div>
          <div className="pr-6 min-w-0">Период</div>
          <div className="pr-6 text-right">Оплачено</div>
          <div className="pr-6 text-right">Прибыль</div>
          <div className="pr-6 text-right">Скидка</div>
          <div className="min-w-0 flex justify-end" />
        </div>

        <div className="col-span-7 grid grid-cols-subgrid">
          {isLoading && (
            <div className="col-span-7 py-8 px-3 text-sm text-muted-foreground">Загрузка...</div>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="col-span-7 py-12 text-center text-sm text-muted-foreground">
              Нет чеков по выбранным фильтрам
            </div>
          )}

          {!isLoading && !isError &&
            filtered.map((c) => {
              const paid = paidOverrides[c.id] ?? c.paid;
              const isExpanded = expanded?.id === c.id;
              const expandMode = expanded?.mode ?? 'details';
              const subtotal = c.items.reduce((s, i) => s + i.qty * i.price, 0);
              const { suspicious, reasons } = isSuspicious(c);
              return (
                <div
                  key={c.id}
                  className={`col-span-7 grid grid-cols-subgrid group ${isExpanded ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}
                >
                  <div className="grid grid-cols-subgrid col-span-7 items-center py-2 px-3">
                    <div className="flex justify-center">
                      {suspicious && (
                        <span title={reasons.join(', ')}>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold truncate pr-6">{c.waiter}</div>
                    <div className="text-sm text-muted-foreground pr-6 min-w-0 whitespace-normal leading-snug">
                      {formatCheckPeriod(c.openedAt, c.closedAt || undefined, c.status)}
                    </div>
                    <div className="text-sm tabular-nums text-right font-medium pr-6">
                      {editingId === c.id ? (
                        <input
                          ref={inputRef}
                          type="number"
                          className="w-full text-right bg-white border border-primary rounded px-1 py-0.5 text-sm font-medium outline-none tabular-nums"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(c.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-primary transition-colors"
                          title="Нажмите для редактирования"
                          onClick={() => startEdit(c.id, paid)}
                        >
                          {c.status === 'open' ? '—' : formatMoney(paid)}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-sm tabular-nums text-right pr-6 text-green-600 font-medium"
                      title={
                        c.profitIncomplete
                          ? 'Прибыль по позициям с заполненной себестоимостью (cost_price). Часть строк без учёта.'
                          : 'Сумма (цена − себестоимость) × кол-во по всем позициям с cost_price'
                      }
                    >
                      {formatCheckProfit(c)}
                    </div>
                    <div className="text-sm tabular-nums text-right pr-6 text-muted-foreground">
                      {c.discount > 0 ? <span>−{formatMoney(c.discount)}</span> : '—'}
                    </div>
                    <div className="min-w-0 flex justify-end items-center gap-5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            isExpanded && expandMode === 'history' ? null : { id: c.id, mode: 'history' },
                          )
                        }
                        className={`text-sm font-medium transition-colors ${
                          isExpanded && expandMode === 'history'
                            ? 'text-[#F70000]'
                            : 'text-[#5D4FF1] hover:text-[#F70000]'
                        }`}
                      >
                        История
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            isExpanded && expandMode === 'details' ? null : { id: c.id, mode: 'details' },
                          )
                        }
                        className={`text-sm font-medium transition-colors ${
                          isExpanded && expandMode === 'details'
                            ? 'text-[#F70000]'
                            : 'text-[#5D4FF1] hover:text-[#F70000]'
                        }`}
                      >
                        Детали
                      </button>
                    </div>
                  </div>

                  {isExpanded && expandMode === 'details' && (
                    <div className="col-span-7 pb-2 pl-4 mt-1 pt-1 ml-6">
                      {suspicious && (
                        <div className="flex items-center gap-1.5 pl-3 pb-2 text-sm text-amber-600 font-semibold">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {reasons.join(' · ')}
                        </div>
                      )}
                      <div className="w-full min-w-0 max-w-xl space-y-0 pr-2">
                        <div className={`${CHECK_ITEMS_TABLE_GRID} pl-3 pb-1 text-xs font-semibold text-muted-foreground`}>
                          <div className="min-w-0">Позиция</div>
                          <div className="text-right">Цена</div>
                          <div className="text-right tabular-nums">Сумма</div>
                          <div className="text-right tabular-nums">Маржа</div>
                        </div>
                        {c.items.map((item, idx) => (
                          <div key={idx} className={`${CHECK_ITEMS_TABLE_GRID} py-0.5 pl-3 text-sm`}>
                            <div
                              className="min-w-0 flex items-baseline gap-1"
                              title={checkItemPositionTitle(item.qty, item.name)}
                            >
                              <span className="tabular-nums shrink-0 text-muted-foreground font-medium">
                                {item.qty}×
                              </span>
                              <span className="min-w-0 truncate text-muted-foreground font-medium">
                                {item.name}
                              </span>
                            </div>
                            <div className="text-right tabular-nums text-muted-foreground">
                              {formatMoney(item.price)}
                            </div>
                            <div className="text-right tabular-nums font-medium">
                              {formatMoney(item.qty * item.price)}
                            </div>
                            <div className="text-right tabular-nums text-green-600">
                              {item.unitCost === null ? (
                                <span className="text-muted-foreground text-xs">—</span>
                              ) : (
                                formatMoney(item.qty * (item.price - item.unitCost))
                              )}
                            </div>
                          </div>
                        ))}
                        <div className={`${CHECK_ITEMS_TABLE_GRID} pl-3 pt-2 mt-1 border-t border-muted text-sm font-medium`}>
                          <div className="min-w-0 text-muted-foreground">Итого</div>
                          <div />
                          <div className="text-right tabular-nums">{formatMoney(subtotal)}</div>
                          <div className="text-right tabular-nums text-green-600">{formatCheckProfit(c)}</div>
                        </div>
                        {c.discount > 0 && (
                          <div className={`${CHECK_ITEMS_TABLE_GRID} pl-3 text-sm text-amber-600`}>
                            <div className="min-w-0">Скидка</div>
                            <div />
                            <div className="text-right tabular-nums font-medium">
                              −{formatMoney(c.discount)}
                            </div>
                            <div />
                          </div>
                        )}
                        {c.status === 'closed' && (
                          <div className={`${CHECK_ITEMS_TABLE_GRID} pl-3 text-sm font-medium text-foreground`}>
                            <div className="min-w-0">К оплате</div>
                            <div />
                            <div className="text-right tabular-nums">{formatMoney(paid)}</div>
                            <div />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isExpanded && expandMode === 'history' && (
                    <div className="col-span-7 pb-3 pl-4 mt-1 pt-1 ml-6">
                      <HistoryTimeline events={generateMockHistory(c)} />
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
