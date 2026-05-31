import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, RotateCcw } from 'lucide-react';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { SearchInput } from '@/components/ui/SearchInput';
import {
 useWarehouseWriteOffs,
 usePostWriteOff,
 useCancelWriteOff,
 useRestoreWriteOff,
 type WriteOffRow,
 type WriteOffUiStatus,
} from '@/hooks/useWarehouse';

const WO_ACTION_CLASS =
 'inline-flex cursor-pointer items-center justify-center gap-1.5 px-3 py-1 rounded-md text-sm text-[#5D4FF1] hover:text-[#4538c4] hover:bg-[#5D4FF1]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

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
    <SearchInput value={search} onChange={setSearch} placeholder="Причина, дата или позиция…" className="w-64" />
    <Link
     to="/warehouse/write-offs/new"
     className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
    >
     + Списать
    </Link>
   </div>

   {isLoading && <p className="text-sm text-muted-foreground py-4">Загрузка…</p>}

   {!isLoading && (
    <table className="w-full table-fixed border-separate border-spacing-0">
     <thead>
      <tr className="text-sm font-semibold text-foreground">
       <th scope="col" className="text-left py-3 px-3 w-[100px]">Дата</th>
       <th scope="col" className="text-left py-3 px-3 w-[200px]">Причина</th>
       <th scope="col" className="text-left py-3 px-3 w-[112px]">Позиции</th>
       <th scope="col" className="text-center py-3 px-3 w-[100px]">Статус</th>
       <th scope="col" className="text-center py-3 px-3 w-[120px]">Создал</th>
       <th scope="col" className="py-3 px-3" />
       <th scope="col" className="w-[80px]" />
       <th scope="col" className="w-[36px]" />
      </tr>
     </thead>
     <tbody>
      {filtered.length === 0 ? (
       <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
        {search ? 'Ничего не найдено' : 'Нет списаний. Нажмите «+ Списать»'}
       </td></tr>
      ) : (
       filtered.map((wo: WriteOffRow) => {
        const isCancelled = wo.status === 'Отменено';
        const editUrl = `/warehouse/write-offs/${wo.id}/edit`;
        const n = wo.items.length;
        const canExpand = n > 0;

        return (
         <>
          <tr
           key={wo.id}
           className={`group cursor-pointer ${expandedId === wo.id ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'} transition-colors ${isCancelled ? 'opacity-50' : ''}`}
           onClick={canExpand ? () => setExpandedId(expandedId === wo.id ? null : wo.id) : undefined}
           tabIndex={0}
           onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && canExpand) {
             e.preventDefault();
             setExpandedId(expandedId === wo.id ? null : wo.id);
            }
           }}
          >
           <td className={`py-2 px-3 text-sm ${isCancelled ? 'line-through' : ''}`}>
            {new Date(wo.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
           </td>
           <td className={`py-2 px-3 text-sm truncate ${isCancelled ? 'line-through' : ''}`}>
            {wo.reason_summary || '—'}
           </td>
           <td className="py-2 px-3 text-sm">
            {canExpand ? (
             <span className={`text-sm ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {`${n} ${getPositionPlural(n)}`}
             </span>
            ) : (
             <span className="text-sm text-muted-foreground">—</span>
            )}
           </td>
           <td className="py-2 px-3 text-center">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(wo.status)}`}>
             {wo.status}
            </span>
           </td>
           <td className="py-2 px-3 text-sm text-center truncate">{wo.created_by}</td>
           <td className="py-2 px-3">
            <div className="flex gap-1 justify-end">
             {wo.status === 'Черновик' && (
              <button type="button" onClick={(e) => { e.stopPropagation(); postWo.mutate(wo.id); }} disabled={postWo.isPending} className={WO_ACTION_CLASS}>
               <Check className="w-4 h-4 shrink-0" aria-hidden />Провести
              </button>
             )}
             {isCancelled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); restoreWo.mutate(wo.id); }} disabled={restoreWo.isPending} className={WO_ACTION_CLASS}>
               <RotateCcw className="w-4 h-4 shrink-0" aria-hidden />Восстановить
              </button>
             )}
            </div>
           </td>
           <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={(e) => { e.stopPropagation(); navigate(editUrl); }} className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer">
             Изменить
            </button>
           </td>
           <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isCancelled && <DeleteButton onClick={() => cancelWo.mutate(wo.id)} />}
           </td>
          </tr>
          {expandedId === wo.id && canExpand && (
           <tr key={`${wo.id}-detail`} className="bg-[#EFF0F4]">
            <td colSpan={8} className="pb-2 pt-0 pl-10">
             <div className="max-w-sm space-y-0.5">
              {wo.items.map((item) => (
               <div key={item.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                <span className="text-foreground font-medium">{item.name}</span>
                {' — '}{item.quantity} {item.unit}
                {item.reason ? <><span className="italic"> ({item.reason})</span></> : null}
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
