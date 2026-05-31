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

      {!isLoading && (
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="text-sm font-semibold text-foreground">
              <th scope="col" className="text-left py-3 px-3 w-[100px]">Дата</th>
              <th scope="col" className="text-left py-3 px-3 w-[200px]">Маршрут</th>
              <th scope="col" className="text-left py-3 px-3">Позиции</th>
              <th scope="col" className="text-center py-3 px-3 w-[128px]" />
              <th scope="col" className="w-[80px]" />
              <th scope="col" className="w-[36px]" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                  {search ? 'Ничего не найдено' : 'Нет перемещений. Нажмите «+ Перемещение»'}
                </td>
              </tr>
            ) : (
              filtered.map((tr: TransferRow) => {
                const isCancelled = tr.status === 'Отменено';
                const isDraft = tr.status === 'Черновик';
                const isPosted = tr.status === 'Проведено';
                const editUrl = `/warehouse/transfers/${tr.id}/edit`;
                const n = tr.items.length;
                const singleItem = n === 1 ? tr.items[0] : null;
                const canExpand = n > 1;

                return (
                  <>
                    <tr
                      key={tr.id}
                      className={`group cursor-pointer ${expandedId === tr.id && canExpand ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'} transition-colors ${isCancelled ? 'opacity-60 text-muted-foreground' : ''}`}
                      onClick={canExpand ? () => setExpandedId(expandedId === tr.id ? null : tr.id) : undefined}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && canExpand) {
                          e.preventDefault();
                          setExpandedId(expandedId === tr.id ? null : tr.id);
                        }
                      }}
                    >
                      <td className={`py-2 px-3 text-sm ${isCancelled ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                        {new Date(tr.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className={`py-2 px-3 text-sm font-semibold truncate ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {tr.fromWarehouse && tr.toWarehouse ? `${tr.fromWarehouse} → ${tr.toWarehouse}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-sm min-w-0 max-w-md">
                        {singleItem ? (
                          <span
                            className={`text-sm truncate block ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                            title={`${singleItem.name} — ${singleItem.quantity} ${singleItem.unit}`}
                          >
                            <span className="font-medium">{singleItem.name}</span>
                            {' — '}{singleItem.quantity} {singleItem.unit}
                          </span>
                        ) : canExpand ? (
                          <span className={`text-sm ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {`${n} ${getPositionPlural(n)}`}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {isDraft && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); postTransfer.mutate(tr.id); }} disabled={postTransfer.isPending} className={STATUS_ACTION_CLASS}>
                            <Check className="w-4 h-4 shrink-0" aria-hidden />Провести
                          </button>
                        )}
                        {isPosted && (
                          <span className="inline-flex min-w-[6.5rem] shrink-0 items-center justify-center px-3 py-1 text-sm font-semibold text-green-600">Проведено</span>
                        )}
                        {isCancelled && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); restoreTransfer.mutate(tr.id); }} disabled={restoreTransfer.isPending} className={STATUS_ACTION_CLASS}>
                            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden />Восстановить
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(editUrl); }} className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer">
                          Изменить
                        </button>
                      </td>
                      <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isCancelled && (
                          <button type="button" className="cursor-pointer p-1 text-red-500 opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); cancelTransfer.mutate(tr.id); }}>
                            <img src={crossIcon} className="w-4 h-4" alt="" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === tr.id && canExpand && (
                      <tr key={`${tr.id}-detail`} className="bg-[#EFF0F4]">
                        <td colSpan={6} className="pb-2 pt-0 pl-10">
                          <div className="max-w-sm space-y-0.5">
                            {tr.items.map((item) => (
                              <div key={item.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                                <span className="text-foreground font-medium">{item.name}</span>
                                {' — '}{item.quantity} {item.unit}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
