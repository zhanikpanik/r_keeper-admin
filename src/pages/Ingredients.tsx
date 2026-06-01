import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, X } from 'lucide-react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import { SearchInput } from '@/components/ui/SearchInput'
import { AddButton } from '@/components/ui/ActionButtons';
import {
 useInvalidateMenu,
 useIngredients,
 useIngredientUsageMap,
} from '@/hooks/useMenuData';

const ROW_ACTION =
  'opacity-60 group-hover:opacity-100 transition-opacity p-1 cursor-pointer rounded hover:bg-muted/50';

export function Ingredients() {
 const navigate = useNavigate();
 const {
  data: ingredients = [],
  isPending: ingredientsPending,
  isError: ingredientsError,
  error: ingredientsErr,
 } = useIngredients(null);
 const { data: usageMap = {} } = useIngredientUsageMap();
 const { invalidateIngredients, invalidateIngredientUsage } = useInvalidateMenu();
 const [search, setSearch] = useState('');
 const [expandedId, setExpandedId] = useState<string | null>(null);

 const totalCapital = ingredients.reduce((sum, i) => sum + (i.stock_quantity * i.price), 0);

 const filtered = ingredients.filter(
  (i) => !search || i.name.toLowerCase().includes(search.toLowerCase()),
 );

 async function handleDelete(id: string) {
  if (!confirm('Удалить ингредиент?')) return;
  await supabase.from('products').delete().eq('id', id);
  invalidateIngredients();
  invalidateIngredientUsage();
 }

 const getStockStatus = (qty: number) => {
  if (qty <= 0) return { color: 'bg-red-500', label: 'Закончился', border: 'border-l-red-500' };
  if (qty < 5) return { color: 'bg-amber-500', label: 'Мало', border: 'border-l-amber-500' };
  return { color: 'bg-green-500', label: 'В норме', border: '' };
 };

 return (
  <div className="p-8">
   <div className="flex items-center justify-between mb-6">
    <div>
     <h2 className="text-2xl font-bold">Ингредиенты</h2>
     <p className="text-sm text-muted-foreground mt-1">
      Блюда привязаны к цехам, а остатки ингредиентов считаются суммарно по складам.
     </p>
    </div>
    <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
     Всего в закупке: <span className="text-foreground font-bold">{Math.round(totalCapital).toLocaleString()} сом</span>
    </div>
   </div>

   <div className="flex items-center gap-2 mb-4">
    <SearchInput value={search} onChange={setSearch} className="w-56" />
    <AddButton onClick={() => navigate('/menu/ingredients/add')} />
   </div>

   <table className="table-fixed border-separate border-spacing-0">
    <thead>
     <tr className="text-sm font-semibold text-foreground">
      <th scope="col" className="w-[40px] py-3 px-3" />
      <th scope="col" className="text-left py-3 px-3 w-[220px]">Название</th>
      <th scope="col" className="text-left py-3 px-3 w-[130px]">Цех</th>
      <th scope="col" className="text-right py-3 px-3 w-[120px]">На складах</th>
      <th scope="col" className="text-right py-3 px-3 w-[120px]">Себестоимость</th>
      <th scope="col" className="text-right py-3 px-3 w-[150px]">Сумма остатков</th>
      <th scope="col" className="w-[80px]" />
      <th scope="col" className="w-[36px]" />
     </tr>
    </thead>
    <tbody>
     {ingredientsPending && <tr><td colSpan={8} className="py-12 text-center text-sm">Загрузка…</td></tr>}
     {ingredientsError && <tr><td colSpan={8} className="py-12 text-center text-sm text-destructive">{ingredientsErr instanceof Error ? ingredientsErr.message : 'Не удалось загрузить'}</td></tr>}
     {!ingredientsPending && !ingredientsError && filtered.length === 0 && (
      <tr><td colSpan={8} className="py-16 text-center">
       <p className="text-sm font-medium mb-1">
        {search ? 'Ничего не найдено' : 'Ингредиентов пока нет'}
       </p>
       <p className="text-xs text-muted-foreground mb-4">
        {search ? 'Попробуйте изменить поисковый запрос' : 'Добавьте ингредиенты, чтобы начать составлять блюда и отслеживать остатки'}
       </p>
       {!search && (
        <button onClick={() => navigate('/menu/ingredients/add')} className="text-sm text-primary hover:underline">
          Добавить ингредиент →
        </button>
       )}
      </td></tr>
     )}
     {!ingredientsPending && !ingredientsError && filtered.map((item) => {
      const dishes = usageMap[item.id] || [];
      const hasWarehouses = item.warehouse_breakdown.length > 0;
      const status = getStockStatus(item.stock_quantity);
      const canExpand = dishes.length > 0 || hasWarehouses;
      const isExpanded = expandedId === item.id;
      return (
       <>
        <tr
         key={item.id}
         className={`group cursor-pointer border-l-3 transition-colors
           ${isExpanded ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'}
           ${item.stock_quantity <= 0 ? 'border-l-red-500 bg-red-50/20' : item.stock_quantity < 5 ? 'border-l-amber-500 bg-amber-50/10' : 'border-l-transparent'}`}
         onClick={canExpand ? () => setExpandedId(isExpanded ? null : item.id) : undefined}
         tabIndex={canExpand ? 0 : -1}
         onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canExpand) { e.preventDefault(); setExpandedId(isExpanded ? null : item.id); } }}
        >
         <td className="py-2 px-3 text-center"><div className={`w-2 h-2 rounded-full ${status.color} mx-auto`} title={status.label} /></td>
         <td className="py-2 px-3 text-sm truncate">{item.name}</td>
         <td className="py-2 px-3 text-sm truncate">{item.workshop_name || '—'}</td>
         <td className={`py-2 px-3 text-sm text-right tabular-nums ${item.stock_quantity <= 0 ? 'text-red-600 font-semibold' : ''}`}>{item.stock_quantity} {item.unit}</td>
         <td className="py-2 px-3 text-sm text-right tabular-nums">{somRounded(item.price)} сом</td>
         <td className="py-2 px-3 text-sm text-right tabular-nums text-foreground">{somRounded(item.stock_quantity * item.price)} сом</td>
         <td className={`py-2 px-3 ${ROW_ACTION}`}>
          <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/menu/ingredients/${item.id}`); }} title="Редактировать">
           <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
         </td>
         <td className={`py-2 px-3 ${ROW_ACTION}`}>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} title="Удалить">
           <X className="w-4 h-4 text-muted-foreground hover:text-red-600" />
          </button>
         </td>
        </tr>
        {isExpanded && canExpand && (
         <tr key={`${item.id}-detail`} className={`bg-[#EFF0F4] ${item.stock_quantity <= 0 ? 'border-l-red-500' : item.stock_quantity < 5 ? 'border-l-amber-500' : ''}`}>
          <td colSpan={8} className="pb-4 pt-0 pl-6">
           <div className="max-w-xs space-y-3">
            {item.warehouse_breakdown.length > 0 && (
             <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">По складам</p>
              {item.warehouse_breakdown.map((w) => (
               <div key={w.warehouse_id} className="text-sm py-0.5 flex justify-between gap-4"><span>{w.warehouse_name}</span><span className="tabular-nums">{w.quantity} {item.unit}</span></div>
              ))}
             </div>
            )}
            {dishes.length > 0 && (
             <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Используется в блюдах</p>
              {dishes.map((dish) => <div key={dish.id} className="text-sm py-0.5">{dish.name}</div>)}
             </div>
            )}
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
