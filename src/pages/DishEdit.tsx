import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import crossIcon from '@/assets/icons/cross.svg';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { useCategories, useWorkshops } from '@/hooks/useMenuData';
import {
  useDish, useDishRecipe, useDishModifiers,
  useAllModifierGroups, useIngredients, useInvalidateDish,
} from '@/hooks/useDishData';
import { useWiggle } from '@/hooks/useWiggle';
import type { RecipeItem, ModifierGroup } from '@/hooks/useDishData';

// Simple label+input field wrapper
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <label className="w-24 text-sm text-muted-foreground shrink-0">{label}</label>
      <div className="w-90">{children}</div>
    </div>
  );
}

// Input with suffix like "сом" or "мл" always visible inside
function InputWithSuffix({ suffix, defaultValue, onSave, className = '' }: {
  suffix: string;
  defaultValue: string | number;
  onSave: (val: number) => void;
  className?: string;
}) {
  return (
    <div className={`${className} relative`}>
      <input
        className="w-full pl-2 pr-8 py-0.5 border rounded text-sm bg-background text-right"
        defaultValue={defaultValue}
        inputMode="decimal"
        onBlur={(e) => {
          const val = parseFloat(e.target.value) || 0;
          onSave(val);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (!/[0-9.,]/.test(e.key) && !['Backspace','Tab','ArrowLeft','ArrowRight','Delete'].includes(e.key)) e.preventDefault();
        }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>
    </div>
  );
}

// Custom dropdown for categories (when > 4)
function CategoryDropdown({ categories, value, onChange }: {
  categories: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = categories.find((c: any) => c.id === value);
  const filtered = search
    ? categories.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background text-left flex items-center justify-between"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected?.name || 'Без категории'}
        </span>
        <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-10 max-h-48 overflow-auto">
          <div className="p-1">
            <input
              className="w-full px-2 py-1 border rounded text-sm bg-background mb-1"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#EFF0F4] transition-colors ${
              !value ? 'font-medium' : ''
            }`}
            onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
          >
            Без категории
          </button>
          {filtered.map((c: any) => (
            <button
              key={c.id}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#EFF0F4] transition-colors ${
                value === c.id ? 'font-medium' : ''
              }`}
              onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DishEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dish, isLoading } = useDish(id);
  const { data: recipe = [] } = useDishRecipe(id);
  const { data: dishModGroups = [] } = useDishModifiers(id);
  const { data: categories = [] } = useCategories();
  const { data: workshops = [] } = useWorkshops();
  const { data: allModGroups = [] } = useAllModifierGroups();
  const { data: ingredients = [] } = useIngredients();
  const { invalidate, removeRecipeItem, addRecipeItem, removeModifier, addModifier, addModGroup, removeModGroup } = useInvalidateDish();
  const qc = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  const [outputWeight, setOutputWeight] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Ingredient add
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('г');
  const [selectedIngId, setSelectedIngId] = useState('');
  const [showIngDropdown, setShowIngDropdown] = useState(false);

  // Recipe edit
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [editRecipeQty, setEditRecipeQty] = useState('');

  // Wiggle refs
  const [nameRef, wiggleName] = useWiggle<HTMLInputElement>();
  const [ingSearchRef, wiggleIngSearch] = useWiggle<HTMLInputElement>();
  const [ingQtyRef, wiggleIngQty] = useWiggle<HTMLInputElement>();
  const [modNameRef, wiggleModName] = useWiggle<HTMLInputElement>();
  const [groupNameRef, wiggleGroupName] = useWiggle<HTMLInputElement>();

  // Modifier group add/create
  const [showAddModGroup, setShowAddModGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'single' | 'multi'>('single');

  // Modifier add within a group
  const [addingModToGroup, setAddingModToGroup] = useState<string | null>(null);
  const [modIngSearch, setModIngSearch] = useState('');
  const [modIngId, setModIngId] = useState('');
  const [modIngName, setModIngName] = useState('');
  const [newModPrice, setNewModPrice] = useState('');
  const [newModQty, setNewModQty] = useState('');
  const [showModIngDropdown, setShowModIngDropdown] = useState(false);

  // Init form from dish data
  useEffect(() => {
    if (dish) {
      setName(dish.name);
      setPrice(String(dish.price));
      setCategoryId(dish.category_id || '');
      setWorkshopId(dish.workshop_id || '');
      setOutputWeight(dish.output_weight || '');
      setIsActive(dish.is_active);
    }
  }, [dish]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Загрузка...</div>;
  if (!dish) return <div className="p-8 text-muted-foreground">Блюдо не найдено</div>;

  // Calculations
  const costPrice = recipe.reduce((sum, r) => sum + r.ingredient_price * r.quantity / 1000, 0);
  const outputWeightCalc = recipe.reduce((sum, r) => sum + r.quantity, 0);
  const priceNum = parseFloat(price) || 0;
  const markup = costPrice > 0 ? Math.round((priceNum - costPrice) / costPrice * 100) : 0;

  // Available modifier groups (not yet linked)
  // Hardcoded preset templates
  const PRESETS = [
    { name: 'Молоко', max_select: 1, modifiers: [
      { name: 'Обычное', price: 0 },
      { name: 'Овсяное', price: 30 },
      { name: 'Кокосовое', price: 40 },
      { name: 'Безлактозное', price: 30 },
    ]},
    { name: 'Сироп', max_select: 0, modifiers: [
      { name: 'Ваниль', price: 20 },
      { name: 'Карамель', price: 20 },
      { name: 'Лаванда', price: 25 },
      { name: 'Кокос', price: 20 },
    ]},
    { name: 'Доп. опции', max_select: 0, modifiers: [
      { name: 'Доп. шот', price: 40 },
      { name: 'Взбитые сливки', price: 30 },
    ]},
    { name: 'Соус', max_select: 1, modifiers: [
      { name: 'Кетчуп', price: 0 },
      { name: 'Горчица', price: 0 },
      { name: 'BBQ', price: 20 },
    ]},
    { name: 'Прожарка', max_select: 1, modifiers: [
      { name: 'Rare', price: 0 },
      { name: 'Medium', price: 0 },
      { name: 'Well done', price: 0 },
    ]},
  ];

  // Filter out presets already added to this dish
  const existingGroupNames = dishModGroups.map(g => g.name.toLowerCase());
  const availablePresets = PRESETS.filter(p => !existingGroupNames.includes(p.name.toLowerCase()));

  // Filtered ingredients for recipe search
  const filteredIngredients = ingredientSearch.trim()
    ? ingredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
    : ingredients;

  // Filtered ingredients for modifier search
  const filteredModIngredients = modIngSearch.trim()
    ? ingredients.filter(i => i.name.toLowerCase().includes(modIngSearch.toLowerCase()))
    : ingredients;

  async function handleSave() {
    if (!name.trim()) { wiggleName(); return; }
    const { error } = await supabase.from('products').update({
      name: name.trim(),
      price: parseFloat(price) || 0,
      cost_price: Math.round(costPrice * 100) / 100,
      category_id: categoryId || null,
      workshop_id: workshopId || null,
      output_weight: outputWeightCalc > 0 ? String(outputWeightCalc) : null,
      is_active: isActive,
    }).eq('id', id);

    if (error) { alert('Ошибка: ' + error.message); return; }
    invalidate(id!);
    navigate('/menu');
  }

  async function handleDelete() {
    if (!confirm('Удалить блюдо? Это действие нельзя отменить.')) return;
    await supabase.from('recipe_items').delete().eq('product_id', id);
    await supabase.from('product_modifier_groups').delete().eq('product_id', id);
    await supabase.from('products').delete().eq('id', id);
    invalidate(id!);
    navigate('/menu');
  }

  async function handleAddIngredient() {
    if (!selectedIngId) { wiggleIngSearch(); return; }
    if (!newIngQty) { wiggleIngQty(); return; }
    const qty = parseFloat(newIngQty) || 0;
    const ing = ingredients.find(i => i.id === selectedIngId);
    const tempId = crypto.randomUUID();

    addRecipeItem(id!, {
      id: tempId,
      ingredient_id: selectedIngId,
      ingredient_name: ing?.name || '',
      ingredient_price: ing?.price || 0,
      quantity: qty,
      unit: newIngUnit,
    });

    setShowAddIngredient(false);
    setIngredientSearch('');
    setNewIngQty('');
    setSelectedIngId('');

    supabase.from('recipe_items').insert({
      product_id: id,
      ingredient_id: selectedIngId,
      quantity: qty,
      unit: newIngUnit,
    });
  }

  async function handleRemoveIngredient(recipeItemId: string) {
    removeRecipeItem(id!, recipeItemId);
    supabase.from('recipe_items').delete().eq('id', recipeItemId);
  }

  async function handleUpdateRecipeQty(recipeItemId: string) {
    const qty = parseFloat(editRecipeQty);
    if (!qty || qty <= 0) return;
    await supabase.from('recipe_items').update({ quantity: qty }).eq('id', recipeItemId);
    setEditingRecipeId(null);
    setEditRecipeQty('');
    invalidate(id!);
  }

  async function handleAddPreset(preset: typeof PRESETS[0]) {
    const tempGroupId = crypto.randomUUID();

    // Optimistic: show immediately
    addModGroup(id!, {
      id: tempGroupId,
      name: preset.name,
      is_required: false,
      max_select: preset.max_select,
      modifiers: preset.modifiers.map(m => ({
        id: crypto.randomUUID(),
        name: m.name,
        price: m.price,
        ingredient_id: null,
        quantity: null,
        unit: null,
      })),
    });
    setShowAddModGroup(false);

    // Create group in DB
    supabase.from('modifier_groups').insert({
      venue_id: VENUE_ID,
      name: preset.name,
      is_required: false,
      max_select: preset.max_select,
    }).select('id').single().then(({ data: group }) => {
      if (!group) return;
      // Link to dish
      supabase.from('product_modifier_groups').insert({
        product_id: id,
        modifier_group_id: group.id,
      });
      supabase.from('products').update({ has_modifiers: true }).eq('id', id);
      // Create modifiers
      supabase.from('modifiers').insert(
        preset.modifiers.map((m, i) => ({
          modifier_group_id: group.id,
          name: m.name,
          price: m.price,
          sort_order: i + 1,
        }))
      );
    });
  }

  async function handleCreateModGroup() {
    if (!newGroupName.trim()) { wiggleGroupName(); return; }
    const tempId = crypto.randomUUID();
    const name = newGroupName.trim();
    const maxSelect = newGroupType === 'single' ? 1 : 0;

    // Optimistic
    addModGroup(id!, { id: tempId, name, is_required: false, max_select: maxSelect, modifiers: [] });

    setShowAddModGroup(false);
    setNewGroupName('');
    setNewGroupType('single');
    setAddingModToGroup(tempId);

    // Server: create group, link to product, then refetch for real IDs
    supabase.from('modifier_groups').insert({
      venue_id: VENUE_ID,
      name,
      is_required: false,
      max_select: maxSelect,
    }).select('id').single().then(({ data: group }) => {
      if (!group) return;
      supabase.from('product_modifier_groups').insert({
        product_id: id,
        modifier_group_id: group.id,
      });
      supabase.from('products').update({ has_modifiers: true }).eq('id', id);
    });
  }

  async function handleRemoveModGroup(groupId: string) {
    removeModGroup(id!, groupId);
    supabase.from('product_modifier_groups')
      .delete()
      .eq('product_id', id)
      .eq('modifier_group_id', groupId)
      .then(() => {
        const remaining = dishModGroups.filter(g => g.id !== groupId);
        if (remaining.length === 0) {
          supabase.from('products').update({ has_modifiers: false }).eq('id', id);
        }
      });
  }

  async function handleAddModifier(groupId: string) {
    if (!modIngId) { wiggleModName(); return; }
    const maxSort = dishModGroups.find(g => g.id === groupId)?.modifiers.length || 0;
    const price = parseFloat(newModPrice) || 0;
    const qty = parseFloat(newModQty) || 0;

    addModifier(id!, groupId, {
      id: crypto.randomUUID(),
      name: modIngName,
      price,
      ingredient_id: modIngId,
      quantity: qty || null,
      unit: 'мл',
    });

    setModIngSearch('');
    setModIngId('');
    setModIngName('');
    setNewModPrice('');
    setNewModQty('');

    supabase.from('modifiers').insert({
      modifier_group_id: groupId,
      name: modIngName,
      price,
      ingredient_id: modIngId,
      quantity: qty || null,
      unit: 'мл',
      sort_order: maxSort + 1,
    });
  }

  async function handleRemoveModifier(modId: string) {
    removeModifier(id!, modId);
    supabase.from('modifiers').delete().eq('id', modId);
  }

  const renderModSwitcher = (group: any) => (
    <div
      className="inline-flex rounded-md p-0.5 shrink-0"
      style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)' }}
    >
      <button
        onClick={() => {
          qc.setQueryData(['dish-modifiers', id], (old: any) => old?.map((g: any) => g.id === group.id ? { ...g, max_select: 1 } : g));
          supabase.from('modifier_groups').update({ max_select: 1 }).eq('id', group.id);
        }}
        className={`px-2 py-0.5 rounded text-sm transition-all ${
          group.max_select === 1 ? 'bg-white text-foreground' : 'text-muted-foreground'
        }`}
        style={group.max_select === 1 ? { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}
      >
        один
      </button>
      <button
        onClick={() => {
          qc.setQueryData(['dish-modifiers', id], (old: any) => old?.map((g: any) => g.id === group.id ? { ...g, max_select: 0 } : g));
          supabase.from('modifier_groups').update({ max_select: 0 }).eq('id', group.id);
        }}
        className={`px-2 py-0.5 rounded text-sm transition-all ${
          group.max_select !== 1 ? 'bg-white text-foreground' : 'text-muted-foreground'
        }`}
        style={group.max_select !== 1 ? { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}
      >
        несколько
      </button>
    </div>
  );

  return (
    <div className="p-8 pb-24 max-w-[640px] [&_button]:cursor-pointer">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/menu')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Назад к меню
        </button>
      </div>

      {/* Basic info */}
      <div className="space-y-4 mb-10">
        <Field label="Название">
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Категория">
          {categories.length <= 4 ? (
            <div
              className="inline-flex rounded-lg p-0.5"
              style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
            >
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
                  className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                    categoryId === c.id ? 'bg-white text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={categoryId === c.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : (
            <CategoryDropdown
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          )}
        </Field>

        <Field label="Цех">
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
          >
            {workshops.map((w: any) => (
              <button
                key={w.id}
                onClick={() => setWorkshopId(workshopId === w.id ? '' : w.id)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  workshopId === w.id
                    ? 'bg-white text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={workshopId === w.id ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' } : {}}
              >
                {w.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center gap-4">
          <label className="w-24 text-sm text-muted-foreground shrink-0">Цена</label>
          <div className="w-28 relative">
            <input
              className="w-full pl-3 pr-10 py-2 border rounded-lg text-sm bg-background text-right"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">сом</span>
          </div>
          {costPrice > 0 && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                Себестоимость: <span className="text-foreground font-medium">{Math.round(costPrice)} сом</span>
              </span>
              <span className="text-muted-foreground">
                Наценка: <span className={`font-medium ${markup > 200 ? 'text-green-600' : 'text-foreground'}`}>{markup}%</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Recipe / Состав */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold mb-4">Состав</h3>

        {recipe.length > 0 && (
          <div>

            {recipe.map((item) => (
              <div key={item.id} className="group flex items-center py-1.5 gap-4">
                <div className="w-40 text-sm truncate">{item.ingredient_name}</div>
                <InputWithSuffix
                  suffix="г"
                  className="w-20"
                  defaultValue={item.quantity}
                  onSave={(qty) => {
                    if (qty && qty !== item.quantity) {
                      supabase.from('recipe_items').update({ quantity: qty }).eq('id', item.id);
                    }
                  }}
                />
                <div className="w-16 text-sm text-muted-foreground">
                  {Math.round(item.ingredient_price * item.quantity / 1000)} сом
                </div>
                <div className="w-6 flex justify-end">
                  <button onClick={() => handleRemoveIngredient(item.id)} className="w-5 h-5 flex items-center justify-center rounded bg-secondary hover:bg-red-100 hover:text-red-500 transition-colors">
                    <img src={crossIcon} className="w-3 h-3 opacity-40 hover:opacity-100" />
                  </button>
                </div>
              </div>
            ))}
            {/* Add ingredient inline */}
            {showAddIngredient ? (
              <div className="flex items-center py-1.5 gap-2">
                <div className="w-40 relative">
                  <input
                    id="ing-search"
                    ref={ingSearchRef}
                    className="w-full px-2 py-1 border rounded text-sm bg-background"
                    placeholder="Поиск ингредиента..."
                    value={ingredientSearch}
                    onChange={(e) => { setIngredientSearch(e.target.value); setSelectedIngId(''); setShowIngDropdown(true); }}
                    onFocus={() => setShowIngDropdown(true)}
                    onBlur={() => setTimeout(() => setShowIngDropdown(false), 150)}
                    autoFocus
                  />
                  {showIngDropdown && !selectedIngId && filteredIngredients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-10 max-h-48 overflow-auto">
                      {filteredIngredients.slice(0, 7).map(ing => (
                        <button
                          key={ing.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFF0F4] transition-colors"
                          onClick={() => {
                            setSelectedIngId(ing.id);
                            setIngredientSearch(ing.name);
                            setShowIngDropdown(false);
                            setTimeout(() => document.getElementById('ing-qty')?.focus(), 0);
                          }}
                        >
                          {ing.name}
                          <span className="text-muted-foreground ml-2">{ing.price} сом</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-16">
                  <input
                    id="ing-qty"
                    ref={ingQtyRef}
                    className="w-full px-2 py-0.5 border rounded text-sm bg-background text-right"
                    placeholder="г"
                    inputMode="decimal"
                    value={newIngQty}
                    onChange={(e) => setNewIngQty(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
                  />
                </div>
                <div className="w-16 flex justify-end gap-1">
                  <button onClick={handleAddIngredient} className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors">✓</button>
                  <button onClick={() => { setShowAddIngredient(false); setIngredientSearch(''); setSelectedIngId(''); setShowIngDropdown(false); }} className="px-2.5 py-1 bg-secondary text-muted-foreground rounded text-xs font-medium hover:text-foreground transition-colors">✕</button>
                </div>
                <div className="w-6"></div>
            </div>
            ) : (
              <button
                onClick={() => setShowAddIngredient(true)}
                className="py-1.5 mt-1 text-sm transition-opacity hover:opacity-70"
                style={{ color: '#5D4FF1' }}
              >
                + Добавить
              </button>
            )}

            <div className="mt-2">
              <div className="border-t" style={{ width: 'calc(24rem)' }}></div>
              <div className="flex items-center pt-2 text-sm gap-4">
                <div className="w-40 text-muted-foreground">Выход: {outputWeightCalc} г</div>
                <div className="w-20"></div>
                <div className="font-medium whitespace-nowrap">Итого: {Math.round(costPrice)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modifiers */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold mb-4">Модификаторы</h3>

        {dishModGroups.map((group, gi) => (
          <div key={group.id} className="mb-4">
            {/* Group header */}
            <div className="flex items-center gap-2 mb-1">
              <div className="text-sm font-medium">{group.name}</div>
              {renderModSwitcher(group)}
              <button
                onClick={() => handleRemoveModGroup(group.id)}
                className="w-5 h-5 flex items-center justify-center rounded bg-secondary hover:bg-red-100 transition-colors shrink-0"
              >
                <img src={crossIcon} className="w-3 h-3 opacity-40" />
              </button>
            </div>

            {/* Modifiers list */}
            {group.modifiers.map((mod) => (
              <div key={mod.id} className="flex items-center py-1.5 gap-2">
                <div className="w-40 text-sm truncate">{mod.name}</div>
                <InputWithSuffix
                  suffix="сом"
                  className="w-20"
                  defaultValue={mod.price}
                  onSave={(val) => supabase.from('modifiers').update({ price: val }).eq('id', mod.id)}
                />
                <InputWithSuffix
                  suffix="мл"
                  className="w-20"
                  defaultValue={mod.quantity || ''}
                  onSave={(val) => supabase.from('modifiers').update({ quantity: val || null }).eq('id', mod.id)}
                />
                <button
                  onClick={() => handleRemoveModifier(mod.id)}
                  className="w-5 h-5 flex items-center justify-center rounded bg-secondary hover:bg-red-100 transition-colors"
                >
                  <img src={crossIcon} className="w-3 h-3 opacity-40" />
                </button>
              </div>
            ))}

            {/* Add modifier to this group */}
            {addingModToGroup === group.id || group.modifiers.length === 0 ? (
              <div className="flex items-center py-1.5 gap-2">
                <div className="w-40 relative">
                  <input
                    ref={modNameRef}
                    className="w-full px-2 py-0.5 border rounded text-sm bg-background"
                    placeholder="Поиск ингредиента..."
                    value={modIngSearch}
                    onChange={(e) => { setModIngSearch(e.target.value); setModIngId(''); setShowModIngDropdown(true); }}
                    onFocus={() => setShowModIngDropdown(true)}
                    onBlur={() => setTimeout(() => setShowModIngDropdown(false), 150)}
                    autoFocus
                  />
                  {showModIngDropdown && !modIngId && filteredModIngredients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-10 max-h-48 overflow-auto">
                      {filteredModIngredients.slice(0, 7).map(ing => (
                        <button
                          key={ing.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFF0F4] transition-colors"
                          onClick={() => {
                            setModIngId(ing.id);
                            setModIngName(ing.name);
                            setModIngSearch(ing.name);
                            setShowModIngDropdown(false);
                            setTimeout(() => document.getElementById('mod-price')?.focus(), 0);
                          }}
                        >
                          {ing.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-20 relative">
                  <input
                    id="mod-price"
                    className="w-full pl-2 pr-8 py-0.5 border rounded text-sm bg-background text-right"
                    placeholder="0"
                    inputMode="decimal"
                    value={newModPrice}
                    onChange={(e) => setNewModPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddModifier(group.id)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">сом</span>
                </div>
                <div className="w-20 relative">
                  <input
                    className="w-full pl-2 pr-8 py-0.5 border rounded text-sm bg-background text-right"
                    placeholder="0"
                    inputMode="decimal"
                    value={newModQty}
                    onChange={(e) => setNewModQty(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddModifier(group.id)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">мл</span>
                </div>
                <div className="w-5 flex gap-1">
                  <button onClick={() => handleAddModifier(group.id)} className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors">✓</button>
                  <button onClick={() => { setAddingModToGroup(null); setModIngSearch(''); setModIngId(''); setNewModPrice(''); setNewModQty(''); setShowModIngDropdown(false); }} className="px-2.5 py-1 bg-secondary text-muted-foreground rounded text-xs font-medium hover:text-foreground transition-colors">✕</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingModToGroup(group.id); setModIngSearch(''); setModIngId(''); setNewModPrice(''); setNewModQty(''); }}
                className="py-1 text-sm transition-opacity hover:opacity-70"
                style={{ color: '#5D4FF1' }}
              >
                + Добавить
              </button>
            )}
          </div>
        ))}

        {/* Add group: create new or pick existing */}
        {showAddModGroup ? (
          <div className="mt-2">
            {/* Create new — always on top */}
            <div className="flex items-center gap-2 mb-2">
              <input
                className="flex-1 px-3 py-1.5 border rounded-lg text-sm bg-background"
                ref={groupNameRef}
                placeholder="Название нового набора"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateModGroup()}
                autoFocus
              />
              <div
                className="inline-flex rounded-lg p-0.5 shrink-0"
                style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
              >
                <button
                  onClick={() => setNewGroupType('single')}
                  className={`px-3 py-1 rounded-md text-sm transition-all ${
                    newGroupType === 'single' ? 'bg-white text-foreground' : 'text-muted-foreground'
                  }`}
                  style={newGroupType === 'single' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
                >
                  Один
                </button>
                <button
                  onClick={() => setNewGroupType('multi')}
                  className={`px-3 py-1 rounded-md text-sm transition-all ${
                    newGroupType === 'multi' ? 'bg-white text-foreground' : 'text-muted-foreground'
                  }`}
                  style={newGroupType === 'multi' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
                >
                  Несколько
                </button>
              </div>
              <button onClick={handleCreateModGroup} className="px-2.5 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors">✓</button>
              <button onClick={() => { setShowAddModGroup(false); setNewGroupName(''); }} className="px-2.5 py-1.5 bg-secondary text-muted-foreground rounded text-xs font-medium hover:text-foreground transition-colors">✕</button>
            </div>

            {/* Preset templates */}
            {availablePresets.length > 0 && (
              <div className="border rounded-lg p-1 max-h-36 overflow-auto">
                {availablePresets.map(preset => (
                  <button
                    key={preset.name}
                    className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-[#EFF0F4] transition-colors"
                    onClick={() => handleAddPreset(preset)}
                  >
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-muted-foreground"> — {preset.modifiers.map(m => m.name).join(', ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAddModGroup(true)}
            className="mt-2 text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#EFF0F4', color: '#000', padding: '8px 12px', borderRadius: '6px' }}
          >
            Новый набор модификаторов
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="mt-10 flex justify-start">
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

