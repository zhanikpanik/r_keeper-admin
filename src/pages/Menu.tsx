import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Pencil } from 'lucide-react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useCreateWorkshop,
  useDeleteWorkshop,
  useDishes,
  useInvalidateMenu,
  useUpdateCategory,
  useUpdateWorkshop,
  useWarehouses,
  useWorkshops,
  type CategoryItem,
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

interface WorkshopDraft {
  name: string;
  defaultWarehouseId: string;
}

function getIngredientPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'ингредиентов';
  if (n1 > 1 && n1 < 5) return 'ингредиента';
  if (n1 === 1) return 'ингредиент';
  return 'ингредиентов';
}

export function Menu() {
  const { data: categories = [], isPending: categoriesPending, isError: categoriesError, error: categoriesErr } = useCategories();
  const { data: products = [], isPending: dishesPending, isError: dishesError, error: dishesErr } = useDishes();
  const { data: workshops = [] } = useWorkshops();
  const { data: warehouses = [] } = useWarehouses();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createWorkshop = useCreateWorkshop();
  const updateWorkshop = useUpdateWorkshop();
  const deleteWorkshop = useDeleteWorkshop();
  const { invalidateDishes } = useInvalidateMenu();

  const menuPending = categoriesPending || dishesPending;
  const menuError = categoriesError || dishesError;
  const menuErrorMessage = (dishesErr instanceof Error && dishesErr.message) || (categoriesErr instanceof Error && categoriesErr.message) || 'Не удалось загрузить';

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newCategory, setNewCategory] = useState({ name: '', color_hex: '#1B5E20' });
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [showWorkshopDrawer, setShowWorkshopDrawer] = useState(false);
  const [workshopDrafts, setWorkshopDrafts] = useState<Record<string, WorkshopDraft>>({});
  const [newWorkshop, setNewWorkshop] = useState({ name: '', defaultWarehouseId: '' });

  useEffect(() => {
    if (!showWorkshopDrawer) return;
    const next: Record<string, WorkshopDraft> = {};
    for (const ws of workshops) { next[ws.id] = { name: ws.name || '', defaultWarehouseId: ws.default_warehouse_id || '' }; }
    setWorkshopDrafts(next);
  }, [showWorkshopDrawer, workshops]);

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

  async function handleCreateCategory() {
    try { await createCategory.mutateAsync({ name: newCategory.name, colorHex: newCategory.color_hex }); setNewCategory({ name: '', color_hex: '#1B5E20' }); }
    catch (error) { alert((error as Error)?.message || 'Не удалось создать категорию'); }
  }

  async function handleUpdateCategory() {
    if (!editingCategory) return;
    try { await updateCategory.mutateAsync({ id: editingCategory.id, name: editingCategory.name, colorHex: editingCategory.color_hex }); setEditingCategory(null); }
    catch (error) { alert((error as Error)?.message || 'Не удалось обновить категорию'); }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Удалить категорию? У блюд из этой категории будет «Без категории».')) return;
    try { await deleteCategory.mutateAsync(categoryId); if (selectedCategory === categoryId) setSelectedCategory(null); if (editingCategory?.id === categoryId) setEditingCategory(null); }
    catch (error) { alert((error as Error)?.message || 'Не удалось удалить категорию'); }
  }

  async function handleCreateWorkshop() {
    try { await createWorkshop.mutateAsync({ name: newWorkshop.name, defaultWarehouseId: newWorkshop.defaultWarehouseId || null }); setNewWorkshop({ name: '', defaultWarehouseId: '' }); alert('Цех создан'); }
    catch (error) { alert((error as Error)?.message || 'Не удалось создать цех'); }
  }

  async function handleSaveWorkshop(workshopId: string) {
    const draft = workshopDrafts[workshopId]; if (!draft) return;
    try { await updateWorkshop.mutateAsync({ id: workshopId, name: draft.name, defaultWarehouseId: draft.defaultWarehouseId || null }); alert('Цех обновлён'); }
    catch (error) { alert((error as Error)?.message || 'Не удалось обновить цех'); }
  }

  async function handleDeleteWorkshop(workshopId: string) {
    if (!confirm('Удалить цех?')) return;
    try { await deleteWorkshop.mutateAsync(workshopId); alert('Цех удалён'); }
    catch (error) { alert((error as Error)?.message || 'Не удалось удалить цех'); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Блюда и категории</h2>
        <div className="flex items-center gap-4">
           <button type="button" onClick={() => setShowWorkshopDrawer(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-background hover:bg-secondary/40 transition-colors">Цеха</button>
           <button type="button" onClick={() => setShowAddCategory((prev) => !prev)} className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-background hover:bg-secondary/40 transition-colors">Категории</button>
           <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><div className="w-2 h-2 rounded-full bg-green-500"></div> Онлайн</div>
           <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><div className="w-2 h-2 rounded-full bg-red-500"></div> Стоп-лист</div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${selectedCategory === null ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'}`}>Все</button>
        {categories.map((cat) => (
          <div key={cat.id} className="relative group">
            <button onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${selectedCategory === cat.id ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'}`}>{cat.name}</button>
          </div>
        ))}
      </div>

      {showAddCategory && (
        <div className="mb-5 rounded-lg border p-3 space-y-3 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
            <input value={newCategory.name} onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Новая категория" />
            <input value={newCategory.color_hex} onChange={(e) => setNewCategory((prev) => ({ ...prev, color_hex: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="#1B5E20" />
            <button type="button" onClick={handleCreateCategory} disabled={createCategory.isPending} className="px-3 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Добавить</button>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto_auto] gap-2 items-center">
                {(() => {
                  const draft = editingCategory?.id === cat.id ? editingCategory : cat;
                  return (<>
                    <input value={draft.name} onChange={(e) => setEditingCategory({ id: cat.id, name: e.target.value, color_hex: draft.color_hex, sort_order: cat.sort_order })} className="px-3 py-2 border rounded-lg text-sm" />
                    <input value={draft.color_hex} onChange={(e) => setEditingCategory({ id: cat.id, name: draft.name, color_hex: e.target.value, sort_order: cat.sort_order })} className="px-3 py-2 border rounded-lg text-sm" />
                    <button type="button" onClick={handleUpdateCategory} disabled={updateCategory.isPending || editingCategory?.id !== cat.id} className="px-3 py-2 rounded-lg text-sm bg-foreground text-background disabled:opacity-50">Сохранить</button>
                    <button type="button" onClick={() => handleDeleteCategory(cat.id)} disabled={deleteCategory.isPending} className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Удалить</button>
                  </>);
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-56 bg-secondary/30">
          <Search className="w-3.5 h-3.5 opacity-40" />
          <input className="bg-transparent text-sm outline-none flex-1" placeholder="Быстрый поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => navigate('/menu/dish/new')} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">+ Добавить</button>
      </div>

      {/* Table */}
      <table className="table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-sm font-semibold text-foreground">
            <th scope="col" className="w-[40px] py-3 px-3" />
            <th scope="col" className="text-left py-3 px-3 w-[180px]">Название</th>
            <th scope="col" className="text-left py-3 px-3">Категория</th>
            <th scope="col" className="text-right py-3 px-3 w-[110px]">Затраты</th>
            <th scope="col" className="text-right py-3 px-3 w-[110px]">Цена</th>
            <th scope="col" className="text-right py-3 px-3 w-[110px]">Наценка</th>
            <th scope="col" className="text-left py-3 px-3 w-[110px]">Техкарта</th>
            <th scope="col" className="w-[80px]" />
            <th scope="col" className="w-[36px]" />
          </tr>
        </thead>
        <tbody>
          {menuPending && <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">Загрузка…</td></tr>}
          {menuError && <tr><td colSpan={9} className="py-12 text-center text-sm text-destructive">{menuErrorMessage}</td></tr>}
          {!menuPending && !menuError && filteredProducts.length === 0 && (
            <tr><td colSpan={9} className="py-16 text-center">
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
                <tr key={product.id} className={`group cursor-pointer ${expandedRecipe === product.id ? 'bg-[#EFF0F4]' : 'hover:bg-muted/30'} ${!product.is_active ? 'opacity-50' : ''} transition-colors`}
                  onClick={canExpand ? () => setExpandedRecipe(expandedRecipe === product.id ? null : product.id) : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canExpand) { e.preventDefault(); setExpandedRecipe(expandedRecipe === product.id ? null : product.id); } }}
                >
                  <td className="py-2 px-3 text-center"><div className={`w-2 h-2 rounded-full ${onlineStatus.color} mx-auto`} title={onlineStatus.label} /></td>
                  <td className="py-2 px-3 text-sm font-semibold truncate">{product.name}</td>
                  <td className="py-2 px-3 text-sm text-muted-foreground whitespace-nowrap">{product.category_name || '—'}</td>
                  <td className="py-2 px-3 text-sm text-right text-muted-foreground tabular-nums whitespace-nowrap">{somRounded(product.cost_price)} сом</td>
                  <td className="py-2 px-3 text-sm text-right tabular-nums font-medium text-foreground whitespace-nowrap">{somRounded(product.price)} сом</td>
                  <td className="py-2 px-3 text-sm text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {product.cost_price > 0
                      ? <span className={((product.price - product.cost_price) / product.cost_price * 100) > 200 ? 'text-green-600' : 'text-foreground'}>{Math.round((product.price - product.cost_price) / product.cost_price * 100)}%</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 px-3 text-sm whitespace-nowrap">
                    {hasRecipe ? (
                      <button onClick={(e) => { e.stopPropagation(); setExpandedRecipe(expandedRecipe === product.id ? null : product.id); }} className="cursor-pointer text-sm font-medium text-primary hover:text-primary/70 transition-colors">
                        {product.recipe_count} {getIngredientPlural(product.recipe_count || 0)}
                      </button>
                    ) : <span className="text-muted-foreground opacity-30">Без рецепта</span>}
                  </td>
                  <td className="py-2 px-3 opacity-60 group-hover:opacity-100 transition-opacity rounded hover:bg-muted/50">
                    <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/menu/dish/${product.id}`); }} className="p-1 cursor-pointer" title="Редактировать"><Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
                  </td>
                  <td className="py-2 px-3 opacity-60 group-hover:opacity-100 transition-opacity rounded hover:bg-muted/50">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} className="p-1 cursor-pointer" title="Удалить"><X className="w-4 h-4 text-muted-foreground hover:text-red-600" /></button>
                  </td>
                </tr>
                {expandedRecipe === product.id && canExpand && (
                  <tr key={`${product.id}-detail`} className="bg-[#EFF0F4]">
                    <td colSpan={9} className="pb-2 pt-0 pl-10">
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

      {showWorkshopDrawer && (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Цеха и склад списания</h3>
              <button type="button" onClick={() => setShowWorkshopDrawer(false)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Закрыть</button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Склад по умолчанию используется POS для автосписания ингредиентов блюд этого цеха.</p>
            <div className="space-y-3 mb-6">
              {workshops.map((ws) => {
                const draft = workshopDrafts[ws.id] || { name: ws.name, defaultWarehouseId: ws.default_warehouse_id || '' };
                return (
                  <div key={ws.id} className="border rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-2 items-center">
                      <input value={draft.name} onChange={(e) => setWorkshopDrafts((prev) => ({ ...prev, [ws.id]: { ...draft, name: e.target.value } }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Название цеха" />
                      <select value={draft.defaultWarehouseId} onChange={(e) => setWorkshopDrafts((prev) => ({ ...prev, [ws.id]: { ...draft, defaultWarehouseId: e.target.value } }))} className="px-3 py-2 border rounded-lg text-sm bg-background">
                        <option value="">Без склада</option>
                        {warehouses.map((wh) => (<option key={wh.id} value={wh.id}>{wh.name}</option>))}
                      </select>
                      <button type="button" onClick={() => handleSaveWorkshop(ws.id)} disabled={updateWorkshop.isPending} className="px-3 py-2 rounded-lg text-sm bg-foreground text-background disabled:opacity-50">Сохранить</button>
                      <button type="button" onClick={() => handleDeleteWorkshop(ws.id)} disabled={deleteWorkshop.isPending} className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">Удалить</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Новый цех</h4>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2">
                <input value={newWorkshop.name} onChange={(e) => setNewWorkshop((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" placeholder="Название цеха" />
                <select value={newWorkshop.defaultWarehouseId} onChange={(e) => setNewWorkshop((prev) => ({ ...prev, defaultWarehouseId: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm bg-background">
                  <option value="">Без склада</option>
                  {warehouses.map((wh) => (<option key={wh.id} value={wh.id}>{wh.name}</option>))}
                </select>
                <button type="button" onClick={handleCreateWorkshop} disabled={createWorkshop.isPending} className="px-3 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Добавить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
