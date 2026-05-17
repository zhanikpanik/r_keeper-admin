import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
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
  const {
    data: categories = [],
    isPending: categoriesPending,
    isError: categoriesError,
    error: categoriesErr,
  } = useCategories();
  const {
    data: products = [],
    isPending: dishesPending,
    isError: dishesError,
    error: dishesErr,
  } = useDishes();
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
  const menuErrorMessage =
    (dishesErr instanceof Error && dishesErr.message) ||
    (categoriesErr instanceof Error && categoriesErr.message) ||
    'Не удалось загрузить';

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
    for (const ws of workshops) {
      next[ws.id] = {
        name: ws.name || '',
        defaultWarehouseId: ws.default_warehouse_id || '',
      };
    }
    setWorkshopDrafts(next);
  }, [showWorkshopDrawer, workshops]);

  const filteredProducts = products
    .filter(p => selectedCategory === null || p.category_id === selectedCategory)
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const showMenuEmpty =
    !menuPending && !menuError && filteredProducts.length === 0;

  const getOnlineStatus = (product: Product) => {
    if (!product.is_active) return { color: 'bg-slate-300', label: 'Скрыто' };
    // Simulated stop-list logic: if it has a recipe but very low cost_price (just an example)
    if (product.recipe_count === 0 && product.cost_price === 0) return { color: 'bg-red-500', label: 'СТОП-ЛИСТ' };
    return { color: 'bg-green-500', label: 'Доступно онлайн' };
  };

  async function handleDeleteProduct(id: string) {
    if (!confirm('Удалить блюдо?')) return;
    const { error: rpcErr } = await supabase.rpc('delete_product', {
      p_product_id: id,
      p_venue_id: VENUE_ID,
    });
    if (rpcErr) {
      if (rpcErr.code === '42883') {
        await supabase.from('recipe_items').delete().eq('product_id', id);
        await supabase.from('product_modifier_groups').delete().eq('product_id', id);
        const { error } = await supabase.from('products').delete().eq('id', id).eq('venue_id', VENUE_ID);
        if (error) {
          alert(error.message);
          return;
        }
      } else {
        alert(rpcErr.message);
        return;
      }
    }
    invalidateDishes();
  }

  async function handleCreateCategory() {
    try {
      await createCategory.mutateAsync({
        name: newCategory.name,
        colorHex: newCategory.color_hex,
      });
      setNewCategory({ name: '', color_hex: '#1B5E20' });
    } catch (error) {
      alert((error as Error)?.message || 'Не удалось создать категорию');
    }
  }

  async function handleUpdateCategory() {
    if (!editingCategory) return;
    try {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        name: editingCategory.name,
        colorHex: editingCategory.color_hex,
      });
      setEditingCategory(null);
    } catch (error) {
      alert((error as Error)?.message || 'Не удалось обновить категорию');
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Удалить категорию? У блюд из этой категории будет «Без категории».')) return;
    try {
      await deleteCategory.mutateAsync(categoryId);
      if (selectedCategory === categoryId) setSelectedCategory(null);
      if (editingCategory?.id === categoryId) setEditingCategory(null);
    } catch (error) {
      alert((error as Error)?.message || 'Не удалось удалить категорию');
    }
  }

  async function handleCreateWorkshop() {
    try {
      await createWorkshop.mutateAsync({
        name: newWorkshop.name,
        defaultWarehouseId: newWorkshop.defaultWarehouseId || null,
      });
      setNewWorkshop({ name: '', defaultWarehouseId: '' });
      alert('Цех создан');
    } catch (error) {
      alert((error as Error)?.message || 'Не удалось создать цех');
    }
  }

  async function handleSaveWorkshop(workshopId: string) {
    const draft = workshopDrafts[workshopId];
    if (!draft) return;
    try {
      await updateWorkshop.mutateAsync({
        id: workshopId,
        name: draft.name,
        defaultWarehouseId: draft.defaultWarehouseId || null,
      });
      alert('Цех обновлён');
    } catch (error) {
      alert((error as Error)?.message || 'Не удалось обновить цех');
    }
  }

  async function handleDeleteWorkshop(workshopId: string) {
    if (!confirm('Удалить цех?')) return;
    try {
      await deleteWorkshop.mutateAsync(workshopId);
      alert('Цех удалён');
    } catch (error) {
      alert((error as Error)?.message || 'Не удалось удалить цех');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Блюда и категории</h2>
        <div className="flex items-center gap-4">
           <button
             type="button"
             onClick={() => setShowWorkshopDrawer(true)}
             className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-background hover:bg-secondary/40 transition-colors"
           >
             Цеха
           </button>
           <button
             type="button"
             onClick={() => setShowAddCategory((prev) => !prev)}
             className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-background hover:bg-secondary/40 transition-colors"
           >
             Категории
           </button>
           <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
             <div className="w-2 h-2 rounded-full bg-green-500"></div> Онлайн
           </div>
           <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
             <div className="w-2 h-2 rounded-full bg-red-500"></div> Стоп-лист
           </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
            selectedCategory === null ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'
          }`}
        >
          Все
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="relative group">
            <button
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                selectedCategory === cat.id ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'
              }`}
            >
              {cat.name}
            </button>
          </div>
        ))}
      </div>

      {showAddCategory && (
        <div className="mb-5 rounded-lg border p-3 space-y-3 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
            <input
              value={newCategory.name}
              onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
              placeholder="Новая категория"
            />
            <input
              value={newCategory.color_hex}
              onChange={(e) => setNewCategory((prev) => ({ ...prev, color_hex: e.target.value }))}
              className="px-3 py-2 border rounded-lg text-sm"
              placeholder="#1B5E20"
            />
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={createCategory.isPending}
              className="px-3 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              Добавить
            </button>
          </div>

          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto_auto] gap-2 items-center">
                {(() => {
                  const draft = editingCategory?.id === cat.id ? editingCategory : cat;
                  return (
                    <>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setEditingCategory({
                      id: cat.id,
                      name: e.target.value,
                      color_hex: draft.color_hex,
                      sort_order: cat.sort_order,
                    })
                  }
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  value={draft.color_hex}
                  onChange={(e) =>
                    setEditingCategory({
                      id: cat.id,
                      name: draft.name,
                      color_hex: e.target.value,
                      sort_order: cat.sort_order,
                    })
                  }
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={handleUpdateCategory}
                  disabled={updateCategory.isPending || editingCategory?.id !== cat.id}
                  className="px-3 py-2 rounded-lg text-sm bg-foreground text-background disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  disabled={deleteCategory.isPending}
                  className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Удалить
                </button>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-56 bg-secondary/30">
          <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Быстрый поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => navigate('/menu/dish/new')}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          + Добавить
        </button>
      </div>

      {/* Table */}
      <div className="-mx-3 w-fit" style={{ display: 'grid', gridTemplateColumns: '40px 180px auto auto auto auto auto 32px' }}>
        <div className="col-span-8 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div></div>
          <div className="pr-6">Название</div>
          <div className="pr-6">Категория</div>
          <div className="pr-6 text-right">Затраты</div>
          <div className="pr-6 text-right">Цена</div>
          <div className="pr-6 text-right">Наценка</div>
          <div className="px-4">Техкарта</div>
          <div></div>
        </div>

        <div className="col-span-8 grid grid-cols-subgrid">
          {menuPending && (
            <div className="col-span-8 py-12 text-center text-sm text-muted-foreground">
              Загрузка…
            </div>
          )}
          {menuError && (
            <div className="col-span-8 py-12 text-center text-sm text-destructive">
              {menuErrorMessage}
            </div>
          )}
          {!menuPending && !menuError && filteredProducts.map((product) => {
            const onlineStatus = getOnlineStatus(product);
            return (
              <div key={product.id} className={`col-span-8 grid grid-cols-subgrid group ${expandedRecipe === product.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} ${!product.is_active ? 'opacity-50' : ''} transition-colors even:bg-muted/10`}>
                <div className="grid grid-cols-subgrid col-span-8 items-center py-2 px-3 cursor-pointer" onClick={() => navigate(`/menu/dish/${product.id}`)}>
                  <div className="flex justify-center">
                    <div className={`w-2 h-2 rounded-full ${onlineStatus.color}`} title={onlineStatus.label}></div>
                  </div>
                  <div className="text-sm font-semibold truncate pr-6">
                    {product.name}
                  </div>
                  <div className="whitespace-nowrap text-sm text-muted-foreground pr-6">
                    {product.category_name || '—'}
                  </div>
                  <div className="whitespace-nowrap text-sm text-right text-muted-foreground tabular-nums pr-6">
                    {somRounded(product.cost_price)} сом
                  </div>
                  <div className="whitespace-nowrap text-sm text-right tabular-nums font-medium text-foreground pr-6">
                    {somRounded(product.price)} сом
                  </div>
                  <div className="whitespace-nowrap text-right pr-6 text-sm tabular-nums text-muted-foreground">
                    {product.cost_price > 0
                      ? <span className={`${((product.price - product.cost_price) / product.cost_price * 100) > 200 ? 'text-green-600' : 'text-foreground'}`}>
                          {Math.round((product.price - product.cost_price) / product.cost_price * 100)}%
                        </span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </div>
                  <div className="whitespace-nowrap text-sm px-4">
                    {(product.recipe_count || 0) > 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); setExpandedRecipe(expandedRecipe === product.id ? null : product.id); }} className="cursor-pointer text-sm font-medium text-[#5D4FF1] hover:text-[#F70000] transition-colors">
                        {product.recipe_count} {getIngredientPlural(product.recipe_count || 0)}
                      </button>
                    ) : <span className="text-muted-foreground opacity-30">Без рецепта</span>}
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} className="p-1 text-red-500">
                      <img src={crossIcon} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedRecipe === product.id && (product.recipe_items?.length ?? 0) > 0 && (
                  <div className="col-span-8 pb-2 pl-4 mt-1 pt-1 ml-6">
                    <div className="max-w-sm space-y-0.5">
                      {(product.recipe_items || []).map((item: DishRecipeLine) => (
                        <div key={item.id} className="flex items-center text-sm py-0.5">
                          <div className="w-40 text-muted-foreground">{item.ingredient_name}</div>
                          <div className="w-16 text-right tabular-nums text-muted-foreground">{item.quantity} {item.unit}</div>
                          <div className="w-20 text-right text-muted-foreground tabular-nums">{somRounded(item.ingredient_cost)} сом</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {showMenuEmpty && (
            <div className="col-span-8 py-12 text-center text-sm text-muted-foreground">
              {search.trim()
                ? 'Ничего не найдено'
                : selectedCategory
                    ? 'Нет блюд в этой категории'
                    : 'Нет блюд'}
            </div>
          )}
        </div>
      </div>

      {showWorkshopDrawer && (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Цеха и склад списания</h3>
              <button
                type="button"
                onClick={() => setShowWorkshopDrawer(false)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Закрыть
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-5">
              Склад по умолчанию используется POS для автосписания ингредиентов блюд этого цеха.
            </p>

            <div className="space-y-3 mb-6">
              {workshops.map((ws) => {
                const draft = workshopDrafts[ws.id] || { name: ws.name, defaultWarehouseId: ws.default_warehouse_id || '' };
                return (
                  <div key={ws.id} className="border rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-2 items-center">
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          setWorkshopDrafts((prev) => ({
                            ...prev,
                            [ws.id]: {
                              ...draft,
                              name: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 border rounded-lg text-sm"
                        placeholder="Название цеха"
                      />
                      <select
                        value={draft.defaultWarehouseId}
                        onChange={(e) =>
                          setWorkshopDrafts((prev) => ({
                            ...prev,
                            [ws.id]: {
                              ...draft,
                              defaultWarehouseId: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 border rounded-lg text-sm bg-background"
                      >
                        <option value="">Без склада</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveWorkshop(ws.id)}
                        disabled={updateWorkshop.isPending}
                        className="px-3 py-2 rounded-lg text-sm bg-foreground text-background disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkshop(ws.id)}
                        disabled={deleteWorkshop.isPending}
                        className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Новый цех</h4>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2">
                <input
                  value={newWorkshop.name}
                  onChange={(e) => setNewWorkshop((prev) => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm"
                  placeholder="Название цеха"
                />
                <select
                  value={newWorkshop.defaultWarehouseId}
                  onChange={(e) => setNewWorkshop((prev) => ({ ...prev, defaultWarehouseId: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm bg-background"
                >
                  <option value="">Без склада</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateWorkshop}
                  disabled={createWorkshop.isPending}
                  className="px-3 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
