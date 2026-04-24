import { useEffect, useState } from 'react';
import { supabase, VENUE_ID } from '@/lib/supabase';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import { useWorkshops, useInvalidateMenu } from '@/hooks/useMenuData';

interface Ingredient {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  unit: string;
  is_active: boolean;
  workshop_id: string | null;
  workshop_name?: string;
}

interface DishRef {
  id: string;
  name: string;
}

interface Workshop {
  id: string;
  name: string;
}

function getDishPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'блюд';
  if (n1 > 1 && n1 < 5) return 'блюда';
  if (n1 === 1) return 'блюдо';
  return 'блюд';
}

export function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const { data: workshops = [] } = useWorkshops();
  const [selectedWorkshop, setSelectedWorkshop] = useState<string | null>(null);
  const [showAddWorkshop, setShowAddWorkshop] = useState(false);
  const [newWorkshop, setNewWorkshop] = useState({ name: '' });
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const { invalidateWorkshops } = useInvalidateMenu();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '' });
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [search, setSearch] = useState('');
  const [usageMap, setUsageMap] = useState<Record<string, DishRef[]>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stats
  const totalCapital = ingredients.reduce((sum, i) => sum + (i.stock_quantity * i.price), 0);

  async function fetchIngredients() {
    const query = supabase
      .from('products')
      .select('id, name, price, stock_quantity, unit, is_active, workshop_id, workshops(name)')
      .eq('venue_id', VENUE_ID)
      .eq('type', 'ingredient')
      .order('name');
    
    if (selectedWorkshop) {
      query.eq('workshop_id', selectedWorkshop);
    }

    const { data } = await query;
    setIngredients(data?.map((i: any) => ({
      ...i,
      workshop_name: i.workshops?.name || ''
    })) || []);
  }

  async function fetchUsageMap() {
    const { data: recipeItems } = await supabase
      .from('recipe_items')
      .select('ingredient_id, product_id');

    if (!recipeItems?.length) return;

    const dishIds = [...new Set(recipeItems.map(r => r.product_id))];
    const { data: dishes } = await supabase
      .from('products')
      .select('id, name')
      .in('id', dishIds);

    const dishMap = new Map((dishes || []).map(d => [d.id, d.name]));

    const map: Record<string, DishRef[]> = {};
    for (const item of recipeItems) {
      const name = dishMap.get(item.product_id);
      if (!name) continue;
      if (!map[item.ingredient_id]) map[item.ingredient_id] = [];
      map[item.ingredient_id].push({ id: item.product_id, name });
    }
    setUsageMap(map);
  }

  useEffect(() => {
    fetchIngredients();
    fetchUsageMap();
  }, [selectedWorkshop]);

  async function handleAddWorkshop() {
    if (!newWorkshop.name) return;
    const { error } = await supabase.from('workshops').insert({
      venue_id: VENUE_ID,
      name: newWorkshop.name,
      sort_order: workshops.length + 1,
    });
    if (error) { alert('Ошибка: ' + error.message); return; }
    setNewWorkshop({ name: '' });
    setShowAddWorkshop(false);
    invalidateWorkshops();
  }

  async function handleUpdateWorkshop(workshop: Workshop) {
    const { error } = await supabase.from('workshops')
      .update({ name: workshop.name })
      .eq('id', workshop.id);
    if (error) { alert('Ошибка: ' + error.message); return; }
    setEditingWorkshop(null);
    invalidateWorkshops();
  }

  async function handleDeleteWorkshop(id: string) {
    if (!confirm('Удалить цех?')) return;
    await supabase.from('workshops').delete().eq('id', id);
    if (selectedWorkshop === id) setSelectedWorkshop(null);
    invalidateWorkshops();
  }

  const filtered = ingredients
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!newItem.name) return;
    const { error } = await supabase.from('products').insert({
      venue_id: VENUE_ID,
      name: newItem.name,
      price: parseFloat(newItem.price) || 0,
      type: 'ingredient',
    });
    if (error) { alert('Ошибка: ' + error.message); return; }
    setNewItem({ name: '', price: '' });
    setShowAddForm(false);
    fetchIngredients();
  }

  async function handleUpdate(item: Ingredient) {
    const { error } = await supabase.from('products')
      .update({ name: item.name, price: item.price, stock_quantity: item.stock_quantity })
      .eq('id', item.id);
    if (error) { alert('Ошибка: ' + error.message); return; }
    setEditingItem(null);
    fetchIngredients();
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить ингредиент?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchIngredients();
  }

  const getStockStatus = (qty: number) => {
    if (qty <= 0) return { color: 'bg-red-500', label: 'Закончился' };
    if (qty < 5) return { color: 'bg-amber-500', label: 'Мало' };
    return { color: 'bg-green-500', label: 'В норме' };
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Ингредиенты</h2>
        <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
          Всего в закупке: <span className="text-foreground font-bold">{Math.round(totalCapital).toLocaleString()} сом</span>
        </div>
      </div>

      {/* Workshop tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedWorkshop(null)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
            selectedWorkshop === null
              ? 'bg-foreground text-background'
              : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'
          }`}
        >
          Все цеха
        </button>
        {workshops.map((workshop) => (
          editingWorkshop?.id === workshop.id ? (
            <div key={workshop.id} className="flex items-center gap-1 border rounded-md px-2 py-0.5">
              <input
                className="w-24 px-1 py-0.5 text-sm bg-transparent outline-none"
                value={editingWorkshop!.name}
                onChange={(e) => setEditingWorkshop({ ...editingWorkshop!, name: e.target.value })}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && editingWorkshop && handleUpdateWorkshop(editingWorkshop)}
              />
              <button onClick={() => editingWorkshop && handleUpdateWorkshop(editingWorkshop)} className="text-sm text-green-600 font-bold px-1">✓</button>
              <button onClick={() => setEditingWorkshop(null)} className="text-sm text-muted-foreground px-1">✕</button>
            </div>
          ) : (
            <div key={workshop.id} className="relative group">
              <button
                onClick={() => setSelectedWorkshop(workshop.id)}
                onDoubleClick={() => setEditingWorkshop(workshop)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  selectedWorkshop === workshop.id
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'
                }`}
              >
                {workshop.name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteWorkshop(workshop.id); }}
                className="hidden group-hover:flex absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center text-[10px] leading-none hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          )
        ))}

        {/* Add workshop */}
        {showAddWorkshop ? (
          <div className="flex items-center gap-1 border rounded-md px-2 py-0.5">
            <input
              className="w-24 px-1 py-0.5 text-sm bg-transparent outline-none"
              value={newWorkshop.name}
              onChange={(e) => setNewWorkshop(p => ({ ...p, name: e.target.value }))}
              placeholder="Название"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddWorkshop()}
            />
            <button onClick={handleAddWorkshop} className="text-sm text-green-600 font-bold px-1">✓</button>
            <button onClick={() => { setShowAddWorkshop(false); setNewWorkshop({ name: '' }); }} className="text-sm text-muted-foreground px-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddWorkshop(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-md text-sm text-muted-foreground border border-dashed hover:border-foreground hover:text-foreground transition-colors"
          >
            + Цех
          </button>
        )}
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
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="flex gap-3 items-end py-3">
          <div className="flex-1">
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newItem.name}
              onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
              placeholder="Например: Куриное филе"
              autoFocus
            />
          </div>
          <div className="w-32">
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newItem.price}
              onChange={(e) => setNewItem((p) => ({ ...p, price: e.target.value }))}
              placeholder="Себестоимость"
              type="number"
            />
          </div>
          <button onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Сохранить</button>
          <button onClick={() => { setShowAddForm(false); setNewItem({ name: '', price: '' }); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Отмена</button>
        </div>
      )}

      {/* Table header */}
      <div className="w-fit -mx-3">
        <div className="flex items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="w-6 shrink-0 mr-4"></div>
          <div className="w-[150px] shrink-0 pr-4">Название</div>
          <div className="w-[100px] shrink-0 pr-4">Склад</div>
          <div className="w-[100px] shrink-0 pr-4 text-right">Остатки</div>
          <div className="w-[120px] shrink-0 pr-4 text-right">Себестоимость</div>
          <div className="w-[140px] shrink-0 pr-4 text-right">Сумма остатков</div>
          <div className="w-24 shrink-0 text-left">Используется</div>
          <div className="w-12 shrink-0"></div>
        </div>

        {/* Rows */}
        <div className="">
          {filtered.map((item) => {
            const dishes = usageMap[item.id] || [];
            const status = getStockStatus(item.stock_quantity);
            return (
              <div key={item.id} className={`group ${expandedId === item.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}>
                {editingItem?.id === item.id ? (
                  <div className="flex items-center py-1.5 px-3">
                    <div className="w-6 shrink-0 mr-4 flex justify-center">
                      <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
                    </div>
                    <div className="w-[150px] shrink-0 pr-4">
                      <input
                        className="w-full px-2 py-0.5 border rounded text-sm bg-background"
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(editingItem)}
                      />
                    </div>
                    <div className="w-[100px] shrink-0 pr-4">
                      <div className="text-sm text-muted-foreground truncate">{item.workshop_name || '—'}</div>
                    </div>
                    <div className="w-[100px] shrink-0 pr-4">
                      <input
                        className="w-full px-2 py-0.5 border rounded text-sm bg-background text-right tabular-nums"
                        value={editingItem.stock_quantity}
                        onChange={(e) => setEditingItem({ ...editingItem, stock_quantity: parseFloat(e.target.value) || 0 })}
                        type="number"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(editingItem)}
                      />
                    </div>
                    <div className="w-[120px] shrink-0 pr-4">
                      <input
                        className="w-full px-2 py-0.5 border rounded text-sm bg-background text-right tabular-nums"
                        value={editingItem.price}
                        onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                        type="number"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(editingItem)}
                      />
                    </div>
                    <div className="w-[140px] shrink-0 pr-4 text-sm text-right text-muted-foreground tabular-nums">
                      {Math.round(editingItem.stock_quantity * editingItem.price)} сом
                    </div>
                    <div className="w-24 shrink-0 text-left"></div>
                    <div className="w-12 shrink-0 flex gap-1 justify-end">
                      <button onClick={() => handleUpdate(editingItem)} className="px-2 py-0.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors">✓</button>
                      <button onClick={() => setEditingItem(null)} className="px-2 py-0.5 bg-secondary text-muted-foreground rounded text-xs font-medium hover:text-foreground transition-colors">✕</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center py-1.5 px-3 cursor-pointer" onClick={() => setEditingItem(item)}>
                    <div className="w-6 shrink-0 mr-4 flex justify-center">
                      <div className={`w-2 h-2 rounded-full ${status.color}`} title={status.label}></div>
                    </div>
                    <div className="w-[150px] shrink-0 pr-4 text-sm font-medium truncate">
                      {item.name}
                    </div>
                    <div className="w-[100px] shrink-0 pr-4 text-sm text-muted-foreground truncate">
                      {item.workshop_name || '—'}
                    </div>
                    <div className={`w-[100px] shrink-0 pr-4 text-sm text-right tabular-nums font-medium ${item.stock_quantity <= 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {item.stock_quantity} {item.unit}
                    </div>
                    <div className="w-[120px] shrink-0 pr-4 text-sm text-right text-muted-foreground tabular-nums">{item.price} сом</div>
                    <div className="w-[140px] shrink-0 pr-4 text-sm text-right tabular-nums">{Math.round(item.stock_quantity * item.price)} сом</div>
                    <div className="w-24 shrink-0 text-left text-sm">
                      {dishes.length > 0 ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === item.id ? null : item.id); }}
                          className="text-[#5D4FF1] hover:text-[#F70000] font-medium transition-colors cursor-pointer"
                        >
                          {expandedId === item.id ? 'Скрыть' : `${dishes.length} ${getDishPlural(dishes.length)}`}
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                    <div className="w-12 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="opacity-40 hover:opacity-100 transition-opacity p-1 text-red-500"><img src={crossIcon} className="w-4 h-4 grayscale brightness-50 hover:grayscale-0 hover:brightness-100" /></button>
                    </div>
                  </div>
                )}

                {/* Expanded dish list */}
                {expandedId === item.id && dishes.length > 0 && (
                  <div className="pb-2 pl-4 mt-1 pt-1 ml-6 border-l-2 border-[#5D4FF1]">
                    <div className="max-w-sm space-y-0.5">
                      {dishes.map((dish) => (
                        <div key={dish.id} className="text-sm py-0.5 text-muted-foreground pl-3">
                          {dish.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {search ? 'Ничего не найдено' : 'Нет ингредиентов. Нажмите "+ Добавить"'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
