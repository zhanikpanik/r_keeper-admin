import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { SearchInput } from '@/components/ui/SearchInput'
import { AddButton } from '@/components/ui/ActionButtons';
import {
 useInvalidateMenu,
 useIngredients,
 useIngredientUsageMap,
} from '@/hooks/useMenuData';

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
  if (qty <= 0) return { color: 'bg-red-500', label: 'Закончился' };
  if (qty < 5) return { color: 'bg-amber-500', label: 'Мало' };
  return { color: 'bg-green-500', label: 'В норме' };
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

   <table className="w-full table-fixed border-separate border-spacing-0">
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
      <tr><td colSpan={8} className="py-12 text-center text-sm">{search ? 'Ничего не найдено' : 'Нет ингредиентов. Нажмите "+ Добавить"'}</td></tr>
     )}
     {!ingredientsPending && !ingredientsError && filtered.map((item) => {
      const dishes = usageMap[item.id] || [];
      const hasWarehouses = item.warehouse_breakdown.length > 0;
      const status = getStockStatus(item.stock_quantity);
      const canExpand = dishes.length > 0 || hasWarehouses;
      return (
       <>
        <tr
         key={item.id}
         className={`group cursor-pointer ${expandedId === item.id ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'} transition-colors`}
         onClick={canExpand ? () => setExpandedId(expandedId === item.id ? null : item.id) : undefined}
         tabIndex={0}
         onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canExpand) { e.preventDefault(); setExpandedId(expandedId === item.id ? null : item.id); } }}
        >
         <td className="py-2 px-3 text-center"><div className={`w-2 h-2 rounded-full ${status.color} mx-auto`} title={status.label} /></td>
         <td className="py-2 px-3 text-sm truncate">{item.name}</td>
         <td className="py-2 px-3 text-sm truncate">{item.workshop_name || '—'}</td>
         <td className={`py-2 px-3 text-sm text-right tabular-nums ${item.stock_quantity <= 0 ? 'text-red-600' : ''}`}>{item.stock_quantity} {item.unit}</td>
         <td className="py-2 px-3 text-sm text-right tabular-nums">{somRounded(item.price)} сом</td>
         <td className="py-2 px-3 text-sm text-right tabular-nums text-foreground">{somRounded(item.stock_quantity * item.price)} сом</td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/menu/ingredients/${item.id}`); }} className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer">Изменить</button>
         </td>
         <td className="py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteButton onClick={() => handleDelete(item.id)} /></td>
        </tr>
        {expandedId === item.id && canExpand && (
         <tr key={`${item.id}-detail`} className="bg-[#EFF0F4]">
          <td colSpan={8} className="pb-4 pt-0 pl-6">
           <div className="max-w-xs space-y-3">
            {item.warehouse_breakdown.length > 0 && (
             <div className="space-y-0.5">
              <p className="text-sm">По складам</p>
              {item.warehouse_breakdown.map((w) => (
               <div key={w.warehouse_id} className="text-sm py-0.5 flex justify-between gap-4"><span>{w.warehouse_name}</span><span className="tabular-nums">{w.quantity} {item.unit}</span></div>
              ))}
             </div>
            )}
            {dishes.length > 0 && (
             <div className="space-y-0.5">
              <p className="text-sm">Используется в блюдах</p>
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
