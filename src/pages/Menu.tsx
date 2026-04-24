import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { useCategories, useDishes, useRecipeItems, useInvalidateMenu } from '@/hooks/useMenuData';

interface Category {
  id: string;
  name: string;
  color_hex: string;
  sort_order: number;
}

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
  category_name?: string;
  workshop_name?: string;
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
  const { data: categories = [] } = useCategories();
  const { data: products = [] } = useDishes();
  const { invalidateAll, invalidateCategories, invalidateDishes } = useInvalidateMenu();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const [newProduct, setNewProduct] = useState({ name: '', price: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [sortBy, setSortBy] = useState<'price' | 'cost_price' | 'output_weight' | 'markup' | null>(null);

  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [newCategory, setNewCategory] = useState({ name: '', color_hex: '#1B5E20' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: expandedRecipeItems = [], isLoading: recipeLoading } = useRecipeItems(expandedRecipe);

  const filteredProducts = products
    .filter(p => selectedCategory === null || p.category_id === selectedCategory)
    .filter(p => {
      if (statusFilter === 'active') return p.is_active;
      if (statusFilter === 'hidden') return !p.is_active;
      return true;
    })
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortBy) return a.name.localeCompare(b.name);
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'price') return (a.price - b.price) * dir;
      return 0;
    });

  const getOnlineStatus = (product: Product) => {
    if (!product.is_active) return { color: 'bg-slate-300', label: 'Скрыто' };
    // Simulated stop-list logic: if it has a recipe but very low cost_price (just an example)
    if (product.recipe_count === 0 && product.cost_price === 0) return { color: 'bg-red-500', label: 'СТОП-ЛИСТ' };
    return { color: 'bg-green-500', label: 'Доступно онлайн' };
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Блюда и категории</h2>
        <div className="flex items-center gap-4">
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
          onClick={() => setShowAddForm(true)}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
          disabled={!selectedCategory}
        >
          + Добавить
        </button>
      </div>

      {/* Table */}
      <div className="w-fit -mx-3">
        <div className="flex items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="w-6 shrink-0 mr-4"></div>
          <div className="w-[180px] shrink-0 pr-4">Название</div>
          <div className="w-[120px] shrink-0 pr-4">Категория</div>
          <div className="w-[100px] shrink-0 pr-4 text-right">Затраты</div>
          <div className="w-[100px] shrink-0 text-right pr-4">Цена</div>
          <div className="w-[100px] shrink-0 text-right pr-4">Наценка</div>
          <div className="w-[140px] shrink-0 text-left px-4">Техкарта</div>
          <div className="w-12 shrink-0"></div>
        </div>

        <div className="">
          {filteredProducts.map((product) => {
            const onlineStatus = getOnlineStatus(product);
            return (
              <div key={product.id} className={`group ${expandedRecipe === product.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} ${!product.is_active ? 'opacity-50' : ''} transition-colors even:bg-muted/10`}>
                <div className="flex items-center py-2 px-3 cursor-pointer" onClick={() => navigate(`/menu/dish/${product.id}`)}>
                  <div className="w-6 shrink-0 mr-4 flex justify-center">
                    <div className={`w-2 h-2 rounded-full ${onlineStatus.color}`} title={onlineStatus.label}></div>
                  </div>
                  <div className="w-[180px] shrink-0 text-sm font-medium truncate pr-4">
                    {product.name}
                  </div>
                  <div className="w-[120px] shrink-0 text-xs text-muted-foreground truncate pr-4 font-semibold uppercase tracking-tight">
                    {product.category_name || '—'}
                  </div>
                  <div className="w-[100px] shrink-0 text-sm text-right text-muted-foreground tabular-nums pr-4">{product.cost_price || 0}</div>
                  <div className="w-[100px] shrink-0 text-sm text-right tabular-nums font-bold pr-4">{product.price}</div>
                  <div className="w-[100px] shrink-0 text-right pr-4 text-sm tabular-nums font-medium">
                    {product.cost_price > 0
                      ? <span className={`${((product.price - product.cost_price) / product.cost_price * 100) > 200 ? 'text-green-600' : 'text-foreground'}`}>
                          {Math.round((product.price - product.cost_price) / product.cost_price * 100)}%
                        </span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </div>
                  <div className="w-[140px] shrink-0 text-left text-[11px] font-bold px-4">
                    {(product.recipe_count || 0) > 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); setExpandedRecipe(expandedRecipe === product.id ? null : product.id); }} className="text-[#5D4FF1] hover:text-[#F70000] transition-colors uppercase">
                        {expandedRecipe === product.id ? 'Скрыть' : `${product.recipe_count} ${getIngredientPlural(product.recipe_count || 0)}`}
                      </button>
                    ) : <span className="text-muted-foreground opacity-30">БЕЗ РЕЦЕПТА</span>}
                  </div>
                  <div className="w-12 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} className="p-1 text-red-500">
                      <img src={crossIcon} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedRecipe === product.id && (
                  <div className="pb-2 pl-4 mt-1 pt-1 ml-6 border-l-2 border-[#5D4FF1]">
                    <div className="max-w-sm space-y-0.5">
                      {expandedRecipeItems.map((item: any) => (
                        <div key={item.id} className="flex items-center text-xs py-0.5 pl-3">
                          <div className="w-40 text-muted-foreground font-medium">{item.ingredient_name}</div>
                          <div className="w-16 text-right tabular-nums">{item.quantity} {item.unit}</div>
                          <div className="w-20 text-right text-muted-foreground tabular-nums">{item.ingredient_cost} сом</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
