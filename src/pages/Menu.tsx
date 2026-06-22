import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '@/components/ui/SearchInput';
import { AddButton } from '@/components/ui/ActionButtons';
import { toast } from 'sonner';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { EditButton } from '@/components/ui/EditButton';
import {
  useCategories,
  useDishes,
  useInvalidateMenu,
  type DishRecipeLine,
} from '@/hooks/useMenuData';
import { EmptyState } from '@/components/ui/EmptyState';

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

  const undoRef = useRef<{ id: string; name: string } | null>(null);

  async function handleDeleteProduct(id: string, name: string) {
    const { error: rpcErr } = await supabase.rpc('delete_product', { p_product_id: id, p_venue_id: VENUE_ID });
    if (rpcErr) {
      if (rpcErr.code === '42883') {
        await supabase.from('recipe_items').delete().eq('product_id', id);
        await supabase.from('product_modifier_groups').delete().eq('product_id', id);
        const { error } = await supabase.from('products').delete().eq('id', id).eq('venue_id', VENUE_ID);
        if (error) { toast.error(error.message); return; }
      } else { toast.error(rpcErr.message); return; }
    }
    invalidateDishes();
    undoRef.current = { id, name };
    toast(`«${name}» удалено`, {
      action: {
        label: 'Отменить',
        onClick: async () => {
          if (!undoRef.current || undoRef.current.id !== id) return;
          const { error } = await supabase.from('products').update({ deleted_at: null }).eq('id', id).eq('venue_id', VENUE_ID);
          if (error) { toast.error('Не удалось восстановить'); return; }
          invalidateDishes();
          toast.success(`«${name}» восстановлено`);
          undoRef.current = null;
        },
      },
      duration: 5000,
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Блюда</h2>
        <AddButton onClick={() => navigate('/menu/dish/new')} label="Добавить блюдо" />
      </div>

      {/* Search + category filter */}
      <div className="flex items-center gap-2 mb-4">
        <SearchInput value={search} onChange={setSearch} className="w-56" />
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
      </div>

      {/* Table */}
      <div className="max-w-4xl">
      <table className="table-fixed border-separate border-spacing-0 w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="text-sm font-medium text-foreground">
            <th scope="col" className="w-[40px] py-1.5 px-3" />
            <th scope="col" className="text-left py-1.5 px-3 w-[180px]">Название</th>
            <th scope="col" className="text-left py-1.5 px-3 w-[160px]">Категория</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Затраты</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Цена</th>
            <th scope="col" className="text-right py-1.5 px-3 w-[110px]">Наценка</th>
            <th scope="col" className="py-1.5 w-[56px]" />
            <th scope="col" className="py-1.5 w-[56px] pr-3" />
          </tr>
        </thead>
        <tbody>
          {menuPending && <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">Загрузка…</td></tr>}
          {menuError && <tr><td colSpan={8} className="py-12 text-center text-sm text-destructive">{menuErrorMessage}</td></tr>}
          {!menuPending && !menuError && filteredProducts.length === 0 && (
            <tr><td colSpan={8}>
              <EmptyState
                title={search.trim() ? 'Ничего не найдено' : selectedCategory ? 'Нет блюд в этой категории' : 'Блюд пока нет'}
                hint={search.trim() ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первое блюдо, чтобы начать составлять меню'}
                action={!search.trim() ? { label: 'Добавить блюдо', onClick: () => navigate('/menu/dish/new') } : undefined}
              />
            </td></tr>
          )}
          {!menuPending && !menuError && filteredProducts.map((product) => {
            const onlineStatus = getOnlineStatus(product);
            const hasRecipe = (product.recipe_count || 0) > 0;
            const canExpand = hasRecipe && (product.recipe_items?.length || 0) > 0;
            return (
              <>
                <tr key={product.id} className={`group cursor-pointer ${expandedRecipe === product.id ? 'bg-black/[0.03]' : 'hover:bg-black/[0.03]'} ${!product.is_active ? 'opacity-50' : ''} transition-colors`}
                  onClick={canExpand ? () => setExpandedRecipe(expandedRecipe === product.id ? null : product.id) : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canExpand) { e.preventDefault(); setExpandedRecipe(expandedRecipe === product.id ? null : product.id); } }}
                >
                  <td className="py-1.5 px-3 text-center"><div className={`w-1.5 h-1.5 rounded-full ${onlineStatus.color} mx-auto`} title={onlineStatus.label} /></td>
                  <td className="py-1.5 px-3 text-sm font-medium truncate">{product.name}</td>
                  <td className="py-1.5 px-3 text-sm text-muted-foreground whitespace-nowrap">{product.category_name || '—'}</td>
                  <td className="py-1.5 px-3 text-sm text-right text-muted-foreground tabular-nums whitespace-nowrap">{somRounded(product.cost_price)} сом</td>
                  <td className="py-1.5 px-3 text-sm text-right tabular-nums font-medium text-foreground whitespace-nowrap">{somRounded(product.price)} сом</td>
                  <td className="py-1.5 px-3 text-sm text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {product.cost_price > 0
                      ? <span className={((product.price - product.cost_price) / product.cost_price * 100) > 200 ? 'text-green-600' : 'text-foreground'}>{Math.round((product.price - product.cost_price) / product.cost_price * 100)}%</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-1.5 px-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <EditButton onClick={() => navigate(`/menu/dish/${product.id}`)} />
                  </td>
                  <td className="py-1.5 pr-4 opacity-40 group-hover:opacity-100 transition-opacity">
                    <DeleteButton variant="row" onClick={() => handleDeleteProduct(product.id, product.name)} />
                  </td>
                </tr>
                {expandedRecipe === product.id && canExpand && (
                  <tr key={`${product.id}-detail`} className="bg-black/[0.03]">
                    <td colSpan={8} className="py-2 pl-8 pr-3">
                      <table className="w-full max-w-md text-sm">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left font-medium py-0.5 pr-2">Ингредиент</th>
                            <th className="text-right font-medium py-0.5 px-2 w-16">Кол-во</th>
                            <th className="text-right font-medium py-0.5 pl-2 w-20">Себест.</th>
                          </tr>
                        </thead>
                        <tbody className="before:content-[''] before:block before:h-1">
                          {(product.recipe_items || []).map((item: DishRecipeLine) => (
                            <tr key={item.id}>
                              <td className="py-0.5 pr-2">{item.ingredient_name}</td>
                              <td className="py-0.5 px-2 text-right tabular-nums">{item.quantity} {item.unit}</td>
                              <td className="py-0.5 pl-2 text-right tabular-nums">{somRounded(item.ingredient_cost)} сом</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
