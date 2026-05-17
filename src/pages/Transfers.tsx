import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import {
  useWarehouseTransfers,
  usePostTransfer,
  useCancelTransfer,
  useRestoreTransfer,
  type TransferRow,
} from '@/hooks/useWarehouse';

/** Positions column `auto` so it doesn’t stretch and leave a gap before actions */
const TRANSFER_GRID_TEMPLATE = '100px minmax(160px, 1fr) auto 8rem 32px';

/** Aligned width for status column action buttons (no border) */
const STATUS_ACTION_CLASS =
  'inline-flex min-w-[6.5rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium text-[#5D4FF1] hover:text-[#4538c4] hover:bg-[#5D4FF1]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function getPositionPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'позиций';
  if (n1 === 1) return 'позиция';
  if (n1 > 1 && n1 < 5) return 'позиции';
  return 'позиций';
}

export function Transfers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: transfers = [], isLoading, isError, error } = useWarehouseTransfers();
  const postTransfer = usePostTransfer();

  const cancelTransfer = useCancelTransfer();
  const restoreTransfer = useRestoreTransfer();

  const q = search.toLowerCase().trim();
  const filtered = transfers.filter((t) => {
    if (!q) return true;
    if (
      t.fromWarehouse.toLowerCase().includes(q) ||
      t.toWarehouse.toLowerCase().includes(q) ||
      `${t.fromWarehouse} → ${t.toWarehouse}`.toLowerCase().includes(q) ||
      t.date.includes(search)
    )
      return true;
    return t.items.some((i) => i.name.toLowerCase().includes(q));
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Перемещения</h2>
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
            placeholder="Склад, дата или позиция…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link
          to="/warehouse/transfers/new"
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + Перемещение
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-4">Загрузка…</p>}

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: TRANSFER_GRID_TEMPLATE }}
      >
        <div className="col-span-5 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="pr-6">Дата</div>
          <div className="pr-6">Маршрут</div>
          <div className="pr-6 text-left">Позиции</div>
          <div className="pr-6 text-center" aria-hidden />
          <div />
        </div>

        <div className="col-span-5 grid grid-cols-subgrid">
          {filtered.map((tr: TransferRow) => {
            const isCancelled = tr.status === 'Отменено';
            const isDraft = tr.status === 'Черновик';
            const isPosted = tr.status === 'Проведено';
            const editUrl = `/warehouse/transfers/${tr.id}/edit`;
            const n = tr.items.length;
            const singleItem = n === 1 ? tr.items[0] : null;
            const canExpand = n > 1;

            return (
              <div
                key={tr.id}
                className={`col-span-5 grid grid-cols-subgrid group ${expandedId === tr.id && canExpand ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}
              >
                <div
                  role="link"
                  tabIndex={0}
                  className={`grid grid-cols-subgrid col-span-5 items-center py-2 px-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm ${isCancelled ? 'opacity-60 text-muted-foreground' : ''}`}
                  onClick={() => navigate(editUrl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(editUrl);
                    }
                  }}
                >
                  <div className={`pr-6 text-sm ${isCancelled ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                    {new Date(tr.date).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </div>
                  <div
                    className={`pr-6 text-sm font-semibold truncate ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                  >
                    {tr.fromWarehouse && tr.toWarehouse ? `${tr.fromWarehouse} → ${tr.toWarehouse}` : '—'}
                  </div>
                  <div className="pr-3 text-left text-sm min-w-0 max-w-md">
                    {singleItem ? (
                      <span
                        className={`text-sm truncate block ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        title={`${singleItem.name} — ${singleItem.quantity} ${singleItem.unit}`}
                      >
                        <span className="font-medium">{singleItem.name}</span>
                        {' — '}
                        {singleItem.quantity} {singleItem.unit}
                      </span>
                    ) : canExpand ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === tr.id ? null : tr.id);
                        }}
                        className={`text-sm font-medium text-[#5D4FF1] hover:text-[#F70000] transition-colors cursor-pointer ${isCancelled ? 'line-through' : ''}`}
                      >
                        {`${n} ${getPositionPlural(n)}`}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex justify-center items-center">
                    {isDraft && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          postTransfer.mutate(tr.id);
                        }}
                        disabled={postTransfer.isPending}
                        className={STATUS_ACTION_CLASS}
                      >
                        <Check className="w-4 h-4 shrink-0" aria-hidden />
                        Провести
                      </button>
                    )}
                    {isPosted && (
                      <span className="inline-flex min-w-[6.5rem] shrink-0 items-center justify-center px-3 py-1 text-sm font-semibold text-green-600">
                        Проведено
                      </span>
                    )}
                    {isCancelled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreTransfer.mutate(tr.id);
                        }}
                        disabled={restoreTransfer.isPending}
                        className={STATUS_ACTION_CLASS}
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
                        className="cursor-pointer p-1 text-red-500 opacity-40 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelTransfer.mutate(tr.id);
                        }}
                      >
                        <img src={crossIcon} className="w-4 h-4" alt="" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === tr.id && n > 1 && (
                  <div className="col-span-5 pb-2 pl-4 mt-1 pt-1 ml-6">
                    <div className="max-w-sm space-y-0.5">
                      {tr.items.map((item) => (
                        <div key={item.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                          <span className="text-foreground font-medium">{item.name}</span>
                          {' — '}
                          {item.quantity} {item.unit}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-5 py-12 text-center text-muted-foreground text-sm">
              {search ? 'Ничего не найдено' : 'Нет перемещений. Нажмите «+ Перемещение»'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
