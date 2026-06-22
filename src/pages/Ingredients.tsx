import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/EmptyState';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { EditButton } from '@/components/ui/EditButton';
import { somRounded } from '@/lib/formatSom';
import { SearchInput } from '@/components/ui/SearchInput'
import { AddButton } from '@/components/ui/ActionButtons';
import {
 useInvalidateMenu,
 useIngredients,
 useIngredientUsageMap,
} from '@/hooks/useMenuData';

const ROW_ACTION =
  'opacity-40 group-hover:opacity-100 transition-opacity';

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
  await supabase.from('products').delete().eq('id', id);
  invalidateIngredients();
  invalidateIngredientUsage();
  toast.success('Ингредиент удалён');
 }

 const getStockStatus = (qty: number) => {
  if (qty <= 0) return { color: 'bg-red-500', label: 'Закончился' };
  if (qty < 5) return { color: 'bg-amber-500', label: 'Мало' };
  return { color: 'bg-green-500', label: 'В норме' };
 };

 return (
  <div className="p-8">
   <div className="flex items-start justify-between mb-6">
    <div>
     <h2 className="text-2xl font-bold">Ингредиенты</h2>
     <p className="text-sm text-muted-foreground mt-0.5">
      Всего в закупке:{' '}
      {Math.round(totalCapital).toLocaleString()} сом
     </p>
    </div>
    <AddButton onClick={() => navigate('/menu/ingredients/add')} label="Добавить ингредиент" />
   </div>

   <div className="flex items-center gap-2 mb-4">
    <SearchInput value={search} onChange={setSearch} className="w-56" />
   </div>

   <div className="max-w-4xl">
   <table className="table-fixed border-separate border-spacing-0 w-full">
    <thead className="sticky top-0 z-10 bg-background">
     <tr className="text-sm font-medium text-foreground">
      <th scope="col" className="w-[40px] py-1.5 px-3" />
      <th scope="col" className="text-left py-1.5 px-3 w-[220px]">Название</th>
      <th scope="col" className="text-right py-1.5 px-3 w-[120px]">На складах</th>
      <th scope="col" className="text-right py-1.5 px-3 w-[120px]">Себестоимость</th>
      <th scope="col" className="text-right py-1.5 px-3 w-[150px]">Сумма остатков</th>
      <th scope="col" className="py-1.5 w-[56px]" />
      <th scope="col" className="py-1.5 w-[56px] pr-3" />
     </tr>
    </thead>
    <tbody>
     {ingredientsPending && <tr><td colSpan={7} className="py-12 text-center text-sm">Загрузка…</td></tr>}
     {ingredientsError && <tr><td colSpan={7} className="py-12 text-center text-sm text-destructive">{ingredientsErr instanceof Error ? ingredientsErr.message : 'Не удалось загрузить'}</td></tr>}
     {!ingredientsPending && !ingredientsError && filtered.length === 0 && (
      <tr><td colSpan={7}>
       <EmptyState
        title={search ? 'Ничего не найдено' : 'Ингредиентов пока нет'}
        hint={search ? 'Попробуйте изменить поисковый запрос' : 'Добавьте ингредиенты, чтобы начать составлять блюда и отслеживать остатки'}
        action={!search ? { label: 'Добавить ингредиент', onClick: () => navigate('/menu/ingredients/add') } : undefined}
       />
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
         className={`group cursor-pointer transition-colors
           ${isExpanded ? 'bg-black/[0.03]' : 'hover:bg-black/[0.03]'}`}
         onClick={canExpand ? () => setExpandedId(isExpanded ? null : item.id) : undefined}
         tabIndex={canExpand ? 0 : -1}
         onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canExpand) { e.preventDefault(); setExpandedId(isExpanded ? null : item.id); } }}
        >
         <td className="py-1.5 px-3 text-center"><div className={`w-1.5 h-1.5 rounded-full ${status.color} mx-auto`} title={status.label} /></td>
         <td className="py-1.5 px-3 text-sm truncate">{item.name}</td>
         <td className={`py-1.5 px-3 text-sm text-right tabular-nums whitespace-nowrap ${item.stock_quantity <= 0 ? 'text-red-600 font-medium' : ''}`}>{item.stock_quantity} {item.unit}</td>
         <td className="py-1.5 px-3 text-sm text-right tabular-nums whitespace-nowrap">{somRounded(item.price)} сом</td>
         <td className="py-1.5 px-3 text-sm text-right tabular-nums whitespace-nowrap text-foreground">{somRounded(item.stock_quantity * item.price)} сом</td>
         <td className={`py-1.5 px-3 ${ROW_ACTION}`}>
          <EditButton onClick={() => navigate(`/menu/ingredients/${item.id}`)} />
         </td>
         <td className={`py-1.5 pr-4 ${ROW_ACTION}`}>
          <DeleteButton variant="row" onClick={() => handleDelete(item.id)} />
         </td>
        </tr>
        {isExpanded && canExpand && (
         <tr key={`${item.id}-detail`} className="bg-black/[0.03]">
          <td colSpan={7} className="py-2 pl-8 pr-3">
           <div className="max-w-xs space-y-3">
            {item.warehouse_breakdown.length > 0 && (
             <div className="space-y-0.5">
              <p className="text-sm font-medium text-muted-foreground">По складам</p>
              {item.warehouse_breakdown.map((w) => (
               <div key={w.warehouse_id} className="text-sm py-0.5 flex justify-between gap-4"><span>{w.warehouse_name}</span><span className="tabular-nums whitespace-nowrap">{w.quantity} {item.unit}</span></div>
              ))}
             </div>
            )}
            {dishes.length > 0 && (
             <div className="space-y-0.5">
              <p className="text-sm font-medium text-muted-foreground">Используется в блюдах</p>
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
  </div>
 );
}
