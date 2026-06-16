import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Pencil } from 'lucide-react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import {
  useCategories,
  useDishes,
  useInvalidateMenu,
  type DishRecipeLine,
} from '@/hooks/useMenuData';

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  category_id: string;
  workshop_id: string | null;
  output_weight: string | null;
  is_active: boolean;
  has_modifiers: boolean;
  sort_order: number;
  recipe_count?: number;
  recipe_items?: DishRecipeLine[];
  category_name?: string;
  workshop_name?: string;
}

export function Menu() {
  const { data: categories = [], isPending: categoriesPending, isError: categoriesError, error: categoriesErr } = useCategories();
  const { data: products = [], isPending: dishesPending, isError: dishesError, error: dishesErr } = useDishes();
  const { invalidateDishes } = useInvalidateMenu();

  const menuPending = categoriesPending || dishesPending;
  const menuError = categoriesError || dishesError;
  const menuErrorMessage = (dishesErr instanceof Error && dishesErr.message) || (categoriesErr instanceof Error && categoriesErr.message) || 'Не удалось загрузить';

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredProducts = products
    .filter(p => selectedCategory === null || p.category_id === selectedCategory)
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const showMenuEmpty = !menuPending && !menuError && filteredProducts.length === 0;

  const getOnlineStatus = (product: Product) => {
    if (!product.is_active) return { color: 'bg-slate-300', label: 'Скрыто' };
    if (product.recipe_count === 0 && product.cost_price === 0) return { color: 'bg-red-500', label: 'СТОП-ЛИСТ' };
    return { color: 'bg-green-500', label: 'Доступно онлайн' };
  };

  async function handleDeleteProduct(id: string) {
    if (!confirm('Удалить блюдо?')) return;
    const { error: rpcErr } = await supabase.rpc('delete_product', { p_product_id: id, p_venue_id: VENUE_ID });
    if (rpcErr) {
      if (rpcErr.code === '42883') {
        await supabase.from('recipe_items').delete().eq('product_id', id);
        await supabase.from('product_modifier_groups').delete().eq('product_id', id);
        const { error } = await supabase.from('products').delete().eq('id', id).eq('venue_id', VENUE_ID);
        if (error) { alert(error.message); return; }
      } else { alert(rpcErr.message); return; }
    }
    invalidateDishes();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Блюда</h2>
      </div>

      {/* Category filter — dropdown (compact for many categories) */}
      <div className="flex items-center gap-2 mb-4">
        <select
          className="px-3 py-1.5 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors min-w-[160px]"
          value={selectedCategory ?? ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
        >
          <option value="">Все категории</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-56">
          <Search className="w-3.5 h-3.5 opacity-40" />
          <input className="bg-transparent text-sm outline-none flex-1" placeholder="Быстрый поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => navigate('/menu/dish/new')} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50">+ Добавить</button>
      </div>

      {/* Table */}
      <div className="max-w-4xl">
      <table className="table-fixed border-separate border-spacing-0 w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="text-sm font-semibold text-foreground">
            <th scope="col" className="w-[40px] py-1.5 px-3" />
            <th scope="col" className="text-left py-1.5 px-3 w-[180px]">Название</th>
            <th scope="col" className="text-left py-1.5 px-3 w-[160px]">Категория</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Затраты</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Цена</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Наценка</th>
            <th scope="col" className="w-[80px]" />
            <th scope="col" className="w-[56px] pr-3" />
          </tr>
        </thead>
        <tbody>
          {menuPending && <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Загрузка…</td></tr>}
          {menuError && <tr><td colSpan={8} className="py-12 text-center text-sm text-destructive">{menuErrorMessage}</td></tr>}
          {!menuPending && !menuError && filteredProducts.length === 0 && (
            <tr><td colSpan={8} className="py-16 text-center">
              <p className="text-sm font-medium mb-1">
                {search.trim() ? 'Ничего не найдено' : selectedCategory ? 'Нет блюд в этой категории' : 'Блюд пока нет'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {search.trim() ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первое блюдо, чтобы начать составлять меню'}
              </p>
              {!search.trim() && (
                <button onClick={() => navigate('/menu/dish/new')} className="text-sm text-primary hover:underline">
                  Добавить блюдо →
                </button>
              )}
            </td></tr>
          )}
          {!menuPending && !menuError && filteredProducts.map((product) => {
            const onlineStatus = getOnlineStatus(product);
            const hasRecipe = (product.recipe_count || 0) > 0;
            const canExpand = hasRecipe && (product.recipe_items?.length || 0) > 0;
            return (
              <>
                <tr key={product.id} className={`group cursor-pointer ${expandedRecipe === product.id ? 'bg-[#EFF0F4]' : 'hover:bg-accent'} ${!product.is_active ? 'opacity-50' : ''} transition-colors`}
                  onClick={canExpand ? () => setExpandedRecipe(expandedRecipe === product.id ? null : product.id) : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canExpand) { e.preventDefault(); setExpandedRecipe(expandedRecipe === product.id ? null : product.id); } }}
                >
                  <td className="py-1.5 px-3 text-center"><div className={`w-2 h-2 rounded-full ${onlineStatus.color} mx-auto`} title={onlineStatus.label} /></td>
                  <td className="py-1.5 px-3 text-sm font-medium truncate">{product.name}</td>
                  <td className="py-1.5 px-3 text-sm text-muted-foreground whitespace-nowrap">{product.category_name || '—'}</td>
                  <td className="py-1.5 px-3 text-sm text-right text-muted-foreground tabular-nums whitespace-nowrap">{somRounded(product.cost_price)} сом</td>
                  <td className="py-1.5 px-3 text-sm text-right tabular-nums font-medium text-foreground whitespace-nowrap">{somRounded(product.price)} сом</td>
                  <td className="py-1.5 px-3 text-sm text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {product.cost_price > 0
                      ? <span className={((product.price - product.cost_price) / product.cost_price * 100) > 200 ? 'text-green-600' : 'text-foreground'}>{Math.round((product.price - product.cost_price) / product.cost_price * 100)}%</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-1.5 px-3 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/menu/dish/${product.id}`); }} className="p-2.5 cursor-pointer bg-transparent" title="Редактировать"><Pencil className="w-4 h-4 text-muted-foreground group-hover:text-foreground" /></button>
                  </td>
                  <td className="py-1.5 pr-4 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} className="p-2.5 cursor-pointer bg-transparent" title="Удалить"><X className="w-4 h-4 text-muted-foreground group-hover:text-red-600" /></button>
                  </td>
                </tr>
                {expandedRecipe === product.id && canExpand && (
                  <tr key={`${product.id}-detail`} className="bg-[#EFF0F4]">
                    <td colSpan={8} className="pb-2 pt-0 pl-10">
                      <div className="max-w-sm space-y-0.5">
                        {(product.recipe_items || []).map((item: DishRecipeLine) => (
                          <div key={item.id} className="flex items-center text-sm py-0.5">
                            <div className="w-40 text-muted-foreground">{item.ingredient_name}</div>
                            <div className="w-16 text-right tabular-nums text-muted-foreground">{item.quantity} {item.unit}</div>
                            <div className="w-20 text-right text-muted-foreground tabular-nums">{somRounded(item.ingredient_cost)} сом</div>
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
    </div>
  );
}
