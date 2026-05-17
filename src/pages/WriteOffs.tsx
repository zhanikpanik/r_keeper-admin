import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import {
  useWarehouseWriteOffs,
  usePostWriteOff,
  useCancelWriteOff,
  useRestoreWriteOff,
  type WriteOffRow,
  type WriteOffUiStatus,
} from '@/hooks/useWarehouse';

/** Same layout pattern as Menu: grid + subgrid; `auto` = actions; last = 32px for ✕ */
const WRITEOFF_GRID_TEMPLATE = '100px 200px 7rem 100px 120px auto 32px';

const WO_ACTION_CLASS =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium text-[#5D4FF1] hover:text-[#4538c4] hover:bg-[#5D4FF1]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function getPositionPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'позиций';
  if (n1 === 1) return 'позиция';
  if (n1 > 1 && n1 < 5) return 'позиции';
  return 'позиций';
}

function getStatusColor(status: WriteOffUiStatus) {
  switch (status) {
    case 'Проведено':
      return 'text-green-600 bg-green-50 border-green-100';
    case 'Черновик':
      return 'text-amber-600 bg-amber-50 border-amber-100';
    case 'Отменено':
      return 'text-red-600 bg-red-50 border-red-100';
    default:
      return 'text-muted-foreground bg-secondary';
  }
}

export function WriteOffs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: writeOffs = [], isLoading, isError, error } = useWarehouseWriteOffs();
  const postWo = usePostWriteOff();
  const cancelWo = useCancelWriteOff();
  const restoreWo = useRestoreWriteOff();

  const q = search.toLowerCase().trim();
  const filtered = writeOffs.filter((w) => {
    if (!q) return true;
    if (w.reason_summary.toLowerCase().includes(q) || w.date.includes(search)) return true;
    return w.items.some((i) => i.name.toLowerCase().includes(q));
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Списания</h2>
      </div>

      {isError && (
        <p className="text-sm text-destructive mb-4">
          {(error as Error)?.message}. Примените миграцию warehouse.
        </p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
          <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" alt="" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Причина, дата или позиция…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link
          to="/warehouse/write-offs/new"
          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          + Списать
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4">Загрузка…</p>}

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: WRITEOFF_GRID_TEMPLATE }}
      >
        <div className="col-span-7 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="pr-6">Дата</div>
          <div className="pr-6">Причина</div>
          <div className="pr-6 text-left">Позиции</div>
          <div className="pr-6 text-center">Статус</div>
          <div className="pr-6 text-center">Создал</div>
          <div className="min-w-0 px-4" aria-hidden />
          <div />
        </div>

        <div className="col-span-7 grid grid-cols-subgrid">
          {filtered.map((wo: WriteOffRow) => {
            const isCancelled = wo.status === 'Отменено';
            const editUrl = `/warehouse/write-offs/${wo.id}/edit`;
            const n = wo.items.length;
            const canExpand = n > 0;

            return (
              <div
                key={wo.id}
                className={`col-span-7 grid grid-cols-subgrid group ${expandedId === wo.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}
              >
                <div
                  role="link"
                  tabIndex={0}
                  className={`grid grid-cols-subgrid col-span-7 items-center py-2 px-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm ${isCancelled ? 'opacity-50' : ''}`}
                  onClick={() => navigate(editUrl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(editUrl);
                    }
                  }}
                >
                  <div className={`pr-6 text-sm text-muted-foreground ${isCancelled ? 'line-through' : ''}`}>
                    {new Date(wo.date).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </div>
                  <div className={`pr-6 text-sm font-semibold truncate ${isCancelled ? 'line-through' : ''}`}>
                    {wo.reason_summary || '—'}
                  </div>
                  <div className="pr-6 text-left text-sm">
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === wo.id ? null : wo.id);
                        }}
                        className="text-sm font-medium text-[#5D4FF1] hover:text-[#F70000] transition-colors cursor-pointer"
                      >
                        {`${n} ${getPositionPlural(n)}`}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="pr-6 flex justify-center">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(wo.status)}`}
                    >
                      {wo.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="pr-6 text-sm text-center text-muted-foreground uppercase font-medium truncate">
                    {wo.created_by}
                  </div>
                  <div className="min-w-0 px-4 flex gap-1 justify-end">
                    {wo.status === 'Черновик' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          postWo.mutate(wo.id);
                        }}
                        disabled={postWo.isPending}
                        className={WO_ACTION_CLASS}
                      >
                        <Check className="w-4 h-4 shrink-0" aria-hidden />
                        Провести
                      </button>
                    )}
                    {isCancelled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreWo.mutate(wo.id);
                        }}
                        disabled={restoreWo.isPending}
                        className={WO_ACTION_CLASS}
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" aria-hidden />
                        Восстановить
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isCancelled && (
                      <button
                        type="button"
                        className="p-1 text-red-500 opacity-40 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelWo.mutate(wo.id);
                        }}
                      >
                        <img src={crossIcon} className="w-4 h-4" alt="" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === wo.id && canExpand && (
                  <div className="col-span-7 pb-2 pl-4 mt-1 pt-1 ml-6">
                    <div className="max-w-sm space-y-0.5">
                      {wo.items.map((item) => (
                        <div key={item.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                          <span className="text-foreground font-medium">{item.name}</span>
                          {' — '}
                          {item.quantity} {item.unit}
                          {item.reason ? (
                            <>
                              {' '}
                              <span className="italic">({item.reason})</span>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-7 py-12 text-center text-muted-foreground text-sm">
              {search ? 'Ничего не найдено' : 'Нет списаний. Нажмите «+ Списать»'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
