import { useEffect, useState } from 'react';
import { supabase, VENUE_ID } from '@/lib/supabase';

interface Dish {
  id: string;
  name: string;
  price: number;
  category_name?: string;
}

interface Ingredient {
  id: string;
  name: string;
}

interface RecipeItem {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient_name?: string;
}

export function Recipes() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [search, setSearch] = useState('');
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: '', unit: 'г' });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDish) fetchRecipe(selectedDish);
  }, [selectedDish]);

  async function fetchData() {
    const [dishRes, ingRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, price, categories(name)')
        .eq('venue_id', VENUE_ID)
        .eq('type', 'dish')
        .order('name'),
      supabase
        .from('products')
        .select('id, name')
        .eq('venue_id', VENUE_ID)
        .eq('type', 'ingredient')
        .order('name'),
    ]);

    setDishes((dishRes.data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      price: d.price,
      category_name: d.categories?.name,
    })));
    setIngredients(ingRes.data || []);
  }

  async function fetchRecipe(dishId: string) {
    const { data } = await supabase
      .from('recipe_items')
      .select('id, product_id, ingredient_id, quantity, unit')
      .eq('product_id', dishId);

    const items: RecipeItem[] = (data || []).map((r: any) => ({
      ...r,
      ingredient_name: ingredients.find((i) => i.id === r.ingredient_id)?.name || '—',
    }));
    setRecipeItems(items);
  }

  async function handleAddRecipeItem() {
    if (!selectedDish || !newRecipeItem.ingredient_id || !newRecipeItem.quantity) return;

    const { error } = await supabase.from('recipe_items').insert({
      product_id: selectedDish,
      ingredient_id: newRecipeItem.ingredient_id,
      quantity: parseFloat(newRecipeItem.quantity),
      unit: newRecipeItem.unit,
    });

    if (error) { alert('Ошибка: ' + error.message); return; }
    setNewRecipeItem({ ingredient_id: '', quantity: '', unit: 'г' });
    setAddingIngredient(false);
    fetchRecipe(selectedDish);
  }

  async function handleRemoveRecipeItem(id: string) {
    await supabase.from('recipe_items').delete().eq('id', id);
    if (selectedDish) fetchRecipe(selectedDish);
  }

  const filteredDishes = search
    ? dishes.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : dishes;

  const selectedDishData = dishes.find((d) => d.id === selectedDish);

  // Check which dishes have recipes
  const [dishesWithRecipes, setDishesWithRecipes] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function checkRecipes() {
      const { data } = await supabase
        .from('recipe_items')
        .select('product_id');
      if (data) {
        setDishesWithRecipes(new Set(data.map((r: any) => r.product_id)));
      }
    }
    checkRecipes();
  }, [recipeItems]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Тех. карты</h2>

      <div className="flex gap-6">
        {/* Dishes list */}
        <div className="w-72">
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background mb-3"
            placeholder="Поиск блюда..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="bg-card border rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
            {filteredDishes.map((dish) => (
              <button
                key={dish.id}
                onClick={() => setSelectedDish(dish.id)}
                className={`w-full text-left px-4 py-3 border-b last:border-0 text-sm transition-colors ${
                  selectedDish === dish.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{dish.name}</span>
                  {dishesWithRecipes.has(dish.id) && (
                    <span className="text-xs opacity-60">📋</span>
                  )}
                </div>
                <div className={`text-xs mt-0.5 ${selectedDish === dish.id ? 'opacity-70' : 'text-muted-foreground'}`}>
                  {dish.category_name || 'Без категории'} · {dish.price} сом
                </div>
              </button>
            ))}
            {filteredDishes.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                Нет блюд
              </div>
            )}
          </div>
        </div>

        {/* Recipe detail */}
        <div className="flex-1">
          {selectedDishData ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedDishData.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDishData.category_name} · Цена: {selectedDishData.price} сом
                  </p>
                </div>
                <button
                  onClick={() => setAddingIngredient(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                >
                  + Добавить ингредиент
                </button>
              </div>

              {/* Add ingredient form */}
              {addingIngredient && (
                <div className="bg-card border rounded-xl p-4 mb-4 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Ингредиент</label>
                    <select
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                      value={newRecipeItem.ingredient_id}
                      onChange={(e) => setNewRecipeItem((p) => ({ ...p, ingredient_id: e.target.value }))}
                    >
                      <option value="">Выберите...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-muted-foreground">Кол-во</label>
                    <input
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                      value={newRecipeItem.quantity}
                      onChange={(e) => setNewRecipeItem((p) => ({ ...p, quantity: e.target.value }))}
                      type="number"
                      placeholder="0"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground">Ед.</label>
                    <select
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background"
                      value={newRecipeItem.unit}
                      onChange={(e) => setNewRecipeItem((p) => ({ ...p, unit: e.target.value }))}
                    >
                      <option value="г">г</option>
                      <option value="кг">кг</option>
                      <option value="мл">мл</option>
                      <option value="л">л</option>
                      <option value="шт">шт</option>
                    </select>
                  </div>
                  <button onClick={handleAddRecipeItem} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                    Сохранить
                  </button>
                  <button onClick={() => setAddingIngredient(false)} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm">
                    Отмена
                  </button>
                </div>
              )}

              {/* Recipe items table */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Ингредиент</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase w-28">Кол-во</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase w-20">Ед.</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="px-4 py-3 text-sm">{item.ingredient_name}</td>
                        <td className="px-4 py-3 text-sm">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm">{item.unit}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveRecipeItem(item.id)}
                            className="px-2 py-1 text-xs text-red-500 hover:text-red-700"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                    {recipeItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                          Нет ингредиентов. Нажмите "+ Добавить ингредиент"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Выберите блюдо слева, чтобы увидеть или создать тех. карту
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
