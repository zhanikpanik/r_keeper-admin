import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { EditPage } from '@/components/ui/EditPage';
import { IngredientPicker } from '@/components/ui/IngredientPicker';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { parseDecimalField, sanitizeDecimalString } from '@/lib/decimalMask';
import {
 canonicalUnitFromIngredient,
 ingredientCostForRecipeItem,
 normalizeQuantityToCanonical,
} from '@/lib/units';
import { useCategories, useWorkshops } from '@/hooks/useMenuData';
import {
 useDish, useDishRecipe, useDishModifiers,
 useDishModifierIngredients, useIngredients, useInvalidateDish,
} from '@/hooks/useDishData';
import { useWiggle } from '@/hooks/useWiggle';
import type { RecipeItem, ModifierGroup } from '@/hooks/useDishData';

// Simple label+input field wrapper
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
 return (
  <div className={`flex items-center gap-4 ${className}`}>
   <label className="w-36 text-sm text-foreground shrink-0">{label}</label>
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
 const [value, setValue] = useState(String(defaultValue ?? ''));

 useEffect(() => {
  setValue(String(defaultValue ?? ''));
 }, [defaultValue]);

 return (
  <div className={`${className} relative`}>
   <input
    className="w-full pl-3 pr-8 py-2 border border-[#E6E5E3] rounded-lg text-sm text-right"
    value={value}
    inputMode="decimal"
    onChange={(e) => setValue(sanitizeDecimalString(e.target.value))}
    onBlur={(e) => {
     const val = parseDecimalField(e.target.value);
     setValue(String(val || ''));
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
    className="w-full px-3 py-2 border border-[#E6E5E3] rounded-lg text-sm text-left flex items-center justify-between"
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
 const isCreateMode = !id || id === 'new';
 const currentDishId = isCreateMode ? null : id;
 const navigate = useNavigate();
 const { data: dish, isLoading } = useDish(currentDishId || undefined);
 const { data: recipe = [] } = useDishRecipe(currentDishId || undefined);
 const { data: dishModGroups = [] } = useDishModifiers(currentDishId || undefined);
 const { data: categories = [] } = useCategories();
 const { data: workshops = [] } = useWorkshops();
 const { data: ingredients = [] } = useIngredients();
 const { invalidate, removeRecipeItem, addRecipeItem, removeModifier, addModifier, addModGroup, removeModGroup } = useInvalidateDish();
 const qc = useQueryClient();

 // Form state
 const [name, setName] = useState('');
 const [price, setPrice] = useState('');
 const [categoryId, setCategoryId] = useState('');
 const [workshopId, setWorkshopId] = useState('');
 const [isActive, setIsActive] = useState(true);
 const { data: modifierIngredients = [] } = useDishModifierIngredients(currentDishId || undefined, workshopId || dish?.workshop_id || null);

 // Ingredient add
 const [showAddIngredient, setShowAddIngredient] = useState(false);
 const [ingredientSearch, setIngredientSearch] = useState('');
 const [newIngQty, setNewIngQty] = useState('');
 const [selectedIngId, setSelectedIngId] = useState('');

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
 const [newModPrice, setNewModPrice] = useState('');
 const [newModQty, setNewModQty] = useState('');

 const availableModifierIngredientIds = new Set(modifierIngredients.map((i) => i.id));

 // Init form from dish data
 useEffect(() => {
  if (dish) {
   setName(dish.name);
   setPrice(String(dish.price));
   setCategoryId(dish.category_id || '');
   setWorkshopId(dish.workshop_id || '');
   setIsActive(dish.is_active);
   return;
  }
  if (isCreateMode) {
   setName('');
   setPrice('');
   setCategoryId('');
   setWorkshopId('');
   setIsActive(true);
  }
 }, [dish, isCreateMode]);

 if (!isCreateMode && isLoading) return <div className="p-8 text-muted-foreground">Загрузка...</div>;
 if (!isCreateMode && !dish) return <div className="p-8 text-muted-foreground">Блюдо не найдено</div>;

 // Calculations
 const costPrice = recipe.reduce(
  (sum, r) =>
   sum +
   ingredientCostForRecipeItem({
    ingredientPrice: r.ingredient_price,
    ingredientUnit: r.ingredient_unit,
    recipeQuantity: r.quantity,
    recipeUnit: r.unit,
   }),
  0
 );
 const outputWeightCalc = recipe.reduce((sum, r) => sum + r.quantity, 0);
 const priceNum = parseDecimalField(price);
 const markup = costPrice > 0 ? Math.round((priceNum - costPrice) / costPrice * 100) : 0;

 // Available modifier groups (not yet linked)
 // Hardcoded preset templates
 const filteredIngredients = ingredientSearch.trim()
  ? ingredients.filter((i) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
  : ingredients;
 const selectedIngredient = ingredients.find((i) => i.id === selectedIngId);
 const selectedIngredientUnit = selectedIngredient ? canonicalUnitFromIngredient(selectedIngredient.unit) : 'г';

 // Filtered ingredients for modifier search
 const filteredModIngredients = modIngSearch.trim()
  ? modifierIngredients.filter(i => i.name.toLowerCase().includes(modIngSearch.toLowerCase()))
  : modifierIngredients;
 const selectedModIngredient = modifierIngredients.find((i) => i.id === modIngId);
 const selectedModUnit = selectedModIngredient ? canonicalUnitFromIngredient(selectedModIngredient.unit) : 'мл';

 async function handleSave() {
  if (!name.trim()) { wiggleName(); return; }

  if (isCreateMode) {
   const { data: sortRow } = await supabase
    .from('products')
    .select('sort_order')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'dish')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
   const nextSort = (Number((sortRow as { sort_order?: number } | null)?.sort_order) || 0) + 1;

   const { data, error } = await supabase
    .from('products')
    .insert({
     venue_id: VENUE_ID,
     type: 'dish',
     name: name.trim(),
     price: parseDecimalField(price),
     cost_price: 0,
     category_id: categoryId || null,
     workshop_id: workshopId || null,
     output_weight: null,
     is_active: true,
     has_modifiers: false,
     sort_order: nextSort,
    })
    .select('id')
    .single();
   if (error || !data?.id) {
    toast.error('Ошибка: ' + (error?.message || 'Не удалось создать блюдо'));
    return;
   }
   navigate(`/menu/dish/${data.id}`);
   return;
  }

  if (!currentDishId) return;
  const { error } = await supabase.from('products').update({
   name: name.trim(),
   price: parseDecimalField(price),
   cost_price: Math.round(costPrice * 100) / 100,
   category_id: categoryId || null,
   workshop_id: workshopId || null,
   output_weight: outputWeightCalc > 0 ? String(outputWeightCalc) : null,
   is_active: isActive,
  }).eq('id', currentDishId);

  if (error) { toast.error('Ошибка: ' + error.message); return; }
  invalidate(currentDishId);
  navigate('/menu');
 }

 async function handleDelete() {
  if (!currentDishId) return;
  if (!confirm('Удалить блюдо? Это действие нельзя отменить.')) return;
  const { error: recErr } = await supabase.from('recipe_items').delete().eq('product_id', currentDishId);
  if (recErr) {
   toast.error(`Не удалось удалить состав: ${recErr.message}`);
   return;
  }
  const { error: linkErr } = await supabase.from('product_modifier_groups').delete().eq('product_id', currentDishId);
  if (linkErr) {
   toast.error(`Не удалось удалить связи модификаторов: ${linkErr.message}`);
   return;
  }
  const { error: dishErr } = await supabase.from('products').delete().eq('id', currentDishId);
  if (dishErr) {
   toast.error(`Не удалось удалить блюдо: ${dishErr.message}`);
   return;
  }
  invalidate(currentDishId);
  navigate('/menu');
 }

 async function handleAddIngredient() {
  if (!currentDishId) return;
  if (!selectedIngId) { wiggleIngSearch(); return; }
  if (!newIngQty) { wiggleIngQty(); return; }
  const qty = parseDecimalField(newIngQty);
  const ing = ingredients.find(i => i.id === selectedIngId);
  const normalized = normalizeQuantityToCanonical(qty, selectedIngredientUnit);
  const tempId = crypto.randomUUID();

  addRecipeItem(currentDishId, {
   id: tempId,
   ingredient_id: selectedIngId,
   ingredient_name: ing?.name || '',
   ingredient_price: ing?.price || 0,
   ingredient_unit: ing?.unit || null,
   quantity: normalized.quantity,
   unit: normalized.unit,
  });

  setShowAddIngredient(false);
  setIngredientSearch('');
  setNewIngQty('');
  setSelectedIngId('');

  const { error } = await supabase.from('recipe_items').insert({
   product_id: currentDishId,
   ingredient_id: selectedIngId,
   quantity: normalized.quantity,
   unit: normalized.unit,
  });
  if (error) {
   toast.error(`Не удалось добавить ингредиент: ${error.message}`);
  }
  invalidate(currentDishId);
 }

 async function handleRemoveIngredient(recipeItemId: string) {
  if (!currentDishId) return;
  removeRecipeItem(currentDishId, recipeItemId);
  const { error } = await supabase.from('recipe_items').delete().eq('id', recipeItemId);
  if (error) {
   toast.error(`Не удалось удалить ингредиент: ${error.message}`);
  }
  invalidate(currentDishId);
 }

 async function handleUpdateRecipeIngredient(recipeItemId: string, ingredientId: string) {
  if (!currentDishId) return;
  const ing = ingredients.find((i) => i.id === ingredientId);
  if (!ing) return;
  const { error } = await supabase
   .from('recipe_items')
   .update({ ingredient_id: ingredientId, unit: canonicalUnitFromIngredient(ing.unit) })
   .eq('id', recipeItemId);
  if (error) {
   toast.error(`Не удалось обновить ингредиент: ${error.message}`);
   return;
  }
  invalidate(currentDishId);
 }

 async function handleCreateModGroup() {
  if (!currentDishId) return;
  if (!newGroupName.trim()) { wiggleGroupName(); return; }
  const name = newGroupName.trim();
  const maxSelect = newGroupType === 'single' ? 1 : 0;

  setShowAddModGroup(false);
  setNewGroupName('');
  setNewGroupType('single');
  const { data: group, error: groupErr } = await supabase.from('modifier_groups').insert({
   venue_id: VENUE_ID,
   name,
   is_required: false,
   max_select: maxSelect,
  }).select('id').single();
  if (groupErr || !group?.id) {
   toast.error('Не удалось создать набор модификаторов');
   return;
  }
  const { error: linkErr } = await supabase.from('product_modifier_groups').insert({
   product_id: currentDishId,
   modifier_group_id: group.id,
  });
  if (linkErr) {
   toast.error(`Не удалось привязать группу: ${linkErr.message}`);
   invalidate(currentDishId);
   return;
  }
  const { error: productErr } = await supabase.from('products').update({ has_modifiers: true }).eq('id', currentDishId);
  if (productErr) {
   toast.error(`Не удалось обновить блюдо: ${productErr.message}`);
   invalidate(currentDishId);
   return;
  }
  invalidate(currentDishId);
  setAddingModToGroup(group.id);
 }

 async function handleRemoveModGroup(groupId: string) {
  if (!currentDishId) return;
  removeModGroup(currentDishId, groupId);
  const { error } = await supabase.from('product_modifier_groups')
   .delete()
   .eq('product_id', currentDishId)
   .eq('modifier_group_id', groupId);
  if (error) {
   toast.error(`Не удалось удалить группу: ${error.message}`);
   invalidate(currentDishId);
   return;
  }
  const remaining = dishModGroups.filter(g => g.id !== groupId);
  if (remaining.length === 0) {
   await supabase.from('products').update({ has_modifiers: false }).eq('id', currentDishId);
  }
  invalidate(currentDishId);
 }

 async function handleAddModifier(groupId: string, ingredientIdOverride?: string) {
  if (!currentDishId) return;
  if (!workshopId) { wiggleModName(); return; }
  const nextIngId = ingredientIdOverride || modIngId;
  if (!nextIngId) { wiggleModName(); return; }
  if (!availableModifierIngredientIds.has(nextIngId)) {
   toast.error('Выбранный ингредиент недоступен на складах цеха блюда');
   return;
  }
  const selectedIngredient = modifierIngredients.find((i) => i.id === nextIngId);
  if (!selectedIngredient) {
   toast.error('Ингредиент не найден');
   return;
  }
  const maxSort = dishModGroups.find(g => g.id === groupId)?.modifiers.length || 0;
  const price = parseDecimalField(newModPrice);
  const qty = parseDecimalField(newModQty);
  const derivedName = selectedIngredient.name;
  const canonicalUnit = canonicalUnitFromIngredient(selectedIngredient.unit);

  addModifier(currentDishId, groupId, {
   id: crypto.randomUUID(),
   name: derivedName,
   price,
   ingredient_id: nextIngId,
   quantity: qty || null,
   unit: canonicalUnit,
  });

  setModIngSearch('');
  setModIngId('');
  setNewModPrice('');
  setNewModQty('');

  const { error } = await supabase.from('modifiers').insert({
   modifier_group_id: groupId,
   name: derivedName,
   price,
   ingredient_id: nextIngId,
   quantity: qty || null,
   unit: canonicalUnit,
   sort_order: maxSort + 1,
  });
  if (error) {
   toast.error(`Не удалось сохранить модификатор: ${error.message}`);
   invalidate(currentDishId);
   return;
  }
  invalidate(currentDishId);
 }

 async function handleUpdateModifierIngredient(modId: string, ingredientId: string) {
  if (!currentDishId) return;
  const next = ingredientId || null;
  if (next && !availableModifierIngredientIds.has(next)) {
   toast.error('Ингредиент недоступен на складах цеха блюда');
   return;
  }
  const ingredientName = next
   ? modifierIngredients.find((i) => i.id === next)?.name || null
   : null;

  qc.setQueryData(['dish-modifiers', currentDishId], (old: any) =>
   old?.map((g: any) => ({
    ...g,
    modifiers: g.modifiers.map((m: any) => (
     m.id === modId
      ? { ...m, ingredient_id: next, name: ingredientName || m.name }
      : m
    )),
   }))
  );
  const patch: { ingredient_id: string | null; name?: string } = { ingredient_id: next };
  if (ingredientName) patch.name = ingredientName;
  const { error } = await supabase.from('modifiers').update(patch).eq('id', modId);
  if (error) {
   toast.error(`Не удалось обновить ингредиент модификатора: ${error.message}`);
   invalidate(currentDishId);
   return;
  }
  invalidate(currentDishId);
 }

 async function handleRemoveModifier(modId: string) {
  if (!currentDishId) return;
  removeModifier(currentDishId, modId);
  const { error } = await supabase.from('modifiers').delete().eq('id', modId);
  if (error) {
   toast.error(`Не удалось удалить модификатор: ${error.message}`);
  }
  invalidate(currentDishId);
 }

 const renderModSwitcher = (group: any) => (
  <div
   className="inline-flex rounded-md p-0.5 shrink-0"
   style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)' }}
  >
   <button
    onClick={async () => {
     if (!currentDishId) return;
     qc.setQueryData(['dish-modifiers', currentDishId], (old: any) => old?.map((g: any) => g.id === group.id ? { ...g, max_select: 1 } : g));
     const { error } = await supabase.from('modifier_groups').update({ max_select: 1 }).eq('id', group.id);
     if (error) {
      toast.error(`Не удалось обновить режим: ${error.message}`);
     }
     invalidate(currentDishId);
    }}
    className={`px-2 py-0.5 rounded text-sm transition-all ${
     group.max_select === 1 ? 'bg-white text-foreground' : 'text-muted-foreground'
    }`}
    style={group.max_select === 1 ? { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}
   >
    один
   </button>
   <button
    onClick={async () => {
     if (!currentDishId) return;
     qc.setQueryData(['dish-modifiers', currentDishId], (old: any) => old?.map((g: any) => g.id === group.id ? { ...g, max_select: 0 } : g));
     const { error } = await supabase.from('modifier_groups').update({ max_select: 0 }).eq('id', group.id);
     if (error) {
      toast.error(`Не удалось обновить режим: ${error.message}`);
     }
     invalidate(currentDishId);
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
  <EditPage
   title={currentDishId ? 'Редактирование блюда' : 'Новое блюдо'}
   backTo="/menu"
   onSave={handleSave}
  >
   {/* Basic info */}
   <div className="space-y-4">
    <Field label="Название">
     <input
      className="w-full px-3 py-2 border border-[#E6E5E3] rounded-lg text-sm "
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
       className="w-full pl-3 pr-11 py-2 border border-[#E6E5E3] rounded-lg text-sm text-right"
       inputMode="decimal"
       value={price}
       onChange={(e) => setPrice(sanitizeDecimalString(e.target.value))}
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
    {!currentDishId ? (
     <p className="text-xs text-muted-foreground">
      Сначала сохраните карточку блюда, после этого можно редактировать состав.
     </p>
    ) : (
     <div>
      {recipe.map((item) => (
       <div key={item.id} className="group flex items-center py-1.5 gap-4">
        <IngredientPicker
         ingredients={ingredients}
         valueId={item.ingredient_id}
         onSelect={(ingredientId) => handleUpdateRecipeIngredient(item.id, ingredientId)}
        />
        <InputWithSuffix
         suffix={item.unit || 'г'}
         className="w-20"
         defaultValue={item.quantity}
         onSave={async (qty) => {
          if (!qty || qty === item.quantity) return;
          const normalized = normalizeQuantityToCanonical(qty, item.unit || 'г');
          const { error } = await supabase
           .from('recipe_items')
           .update({ quantity: normalized.quantity, unit: normalized.unit })
           .eq('id', item.id);
          if (error) {
           toast.error(`Не удалось обновить количество: ${error.message}`);
          }
          if (currentDishId) invalidate(currentDishId);
         }}
        />
        <div className="w-16 text-sm text-muted-foreground">
         {Math.round(
          ingredientCostForRecipeItem({
           ingredientPrice: item.ingredient_price,
           ingredientUnit: item.ingredient_unit,
           recipeQuantity: item.quantity,
           recipeUnit: item.unit,
          })
         )} сом
        </div>
        <div className="w-6 flex justify-end">
         <button onClick={() => handleRemoveIngredient(item.id)} className="w-5 h-5 flex items-center justify-center rounded bg-secondary hover:bg-red-100 hover:text-red-500 transition-colors">
          <X className="w-3 h-3 opacity-40 hover:opacity-100" />
         </button>
        </div>
       </div>
      ))}
      {showAddIngredient && (
       <div className="flex items-center py-1.5 gap-4">
        <IngredientPicker
         ingredients={filteredIngredients}
         valueId={selectedIngId || null}
         autoFocus
         onSelect={(ingredientId) => {
          const ing = ingredients.find((i) => i.id === ingredientId);
          setSelectedIngId(ingredientId);
          setIngredientSearch(ing?.name || '');
          setTimeout(() => document.getElementById('ing-qty')?.focus(), 0);
         }}
        />
        <div className="w-20 relative">
         <input
          id="ing-qty"
          ref={ingQtyRef}
          className="w-full pl-3 pr-8 py-2 border border-[#E6E5E3] rounded-lg text-sm text-right"
          placeholder="0"
          inputMode="decimal"
          value={newIngQty}
          onChange={(e) => setNewIngQty(sanitizeDecimalString(e.target.value))}
          onBlur={() => {
           if (selectedIngId && newIngQty) handleAddIngredient();
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
         />
         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {selectedIngredientUnit}
         </span>
        </div>
        <div className="w-16 text-sm text-muted-foreground">
         {selectedIngredient && newIngQty
          ? `${Math.round(
            ingredientCostForRecipeItem({
             ingredientPrice: selectedIngredient.price || 0,
             ingredientUnit: selectedIngredient.unit,
             recipeQuantity: parseDecimalField(newIngQty),
             recipeUnit: selectedIngredientUnit,
            })
           )} сом`
          : ''}
        </div>
        <div className="w-6 flex justify-end">
         <button onClick={() => { setShowAddIngredient(false); setIngredientSearch(''); setSelectedIngId(''); setNewIngQty(''); }} className="px-2.5 py-1 bg-secondary text-muted-foreground rounded text-xs font-medium hover:text-foreground transition-colors">✕</button>
        </div>
       </div>
      )}
      <button
       onClick={() => setShowAddIngredient(true)}
       className="py-1.5 mt-1 text-sm font-medium transition-colors cursor-pointer hover:opacity-80"
       style={{ color: '#5D4FF1' }}
      >
       + Добавить
      </button>

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
    {!currentDishId && (
     <p className="text-xs text-muted-foreground mb-3">
      Сохраните блюдо, чтобы добавить группы и модификаторы.
     </p>
    )}
    {!workshopId && (
     <p className="text-xs text-amber-700 mb-3">
      Выберите цех блюда, чтобы выбирать ингредиенты модификаторов по складам этого цеха.
     </p>
    )}

    {currentDishId && dishModGroups.map((group, gi) => (
     <div key={group.id} className="mb-4">
      {/* Group header */}
      <div className="flex items-center gap-2 mb-1">
       <div className="text-sm font-medium">{group.name}</div>
       {renderModSwitcher(group)}
       <button
        onClick={() => handleRemoveModGroup(group.id)}
        className="w-5 h-5 flex items-center justify-center rounded bg-secondary hover:bg-red-100 transition-colors shrink-0"
       >
        <X className="w-3 h-3 opacity-40" />
       </button>
      </div>

      {/* Modifiers list */}
      {group.modifiers.map((mod) => (
       <div key={mod.id} className="flex items-center py-1.5 gap-4">
        <IngredientPicker
         ingredients={modifierIngredients}
         valueId={mod.ingredient_id}
         onSelect={(ingredientId) => handleUpdateModifierIngredient(mod.id, ingredientId)}
         disabled={!workshopId}
        />
        <InputWithSuffix
         suffix="сом"
         className="w-20"
         defaultValue={mod.price}
         onSave={async (val) => {
          const { error } = await supabase.from('modifiers').update({ price: val }).eq('id', mod.id);
          if (error) {
           toast.error(`Не удалось обновить цену модификатора: ${error.message}`);
          }
          if (currentDishId) invalidate(currentDishId);
         }}
        />
        <InputWithSuffix
         suffix={mod.unit || 'мл'}
         className="w-20"
         defaultValue={mod.quantity || ''}
         onSave={async (val) => {
          const { error } = await supabase.from('modifiers').update({ quantity: val || null }).eq('id', mod.id);
          if (error) {
           toast.error(`Не удалось обновить количество модификатора: ${error.message}`);
          }
          if (currentDishId) invalidate(currentDishId);
         }}
        />
        <div className="w-6 flex justify-end">
         <button
          onClick={() => handleRemoveModifier(mod.id)}
          className="w-5 h-5 flex items-center justify-center rounded bg-secondary hover:bg-red-100 transition-colors"
         >
          <X className="w-3 h-3 opacity-40" />
         </button>
        </div>
       </div>
      ))}

      {/* Add modifier to this group */}
      {(addingModToGroup === group.id || group.modifiers.length === 0) && (
       <div className="flex items-center py-1.5 gap-4">
        <IngredientPicker
         ingredients={filteredModIngredients}
         valueId={modIngId || null}
         disabled={!workshopId}
         autoFocus
         onSelect={(ingredientId) => {
          const ing = modifierIngredients.find((i) => i.id === ingredientId);
          setModIngId(ingredientId);
          setModIngSearch(ing?.name || '');
          handleAddModifier(group.id, ingredientId);
         }}
        />
        <div className="w-20 relative">
         <input
          id="mod-price"
          className="w-full pl-3 pr-8 py-2 border border-[#E6E5E3] rounded-lg text-sm text-right"
          placeholder="0"
          inputMode="decimal"
          value={newModPrice}
          onChange={(e) => setNewModPrice(sanitizeDecimalString(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && handleAddModifier(group.id)}
          disabled={!workshopId}
         />
         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">сом</span>
        </div>
        <div className="w-20 relative">
         <input
          className="w-full pl-3 pr-8 py-2 border border-[#E6E5E3] rounded-lg text-sm text-right"
          placeholder="0"
          inputMode="decimal"
          value={newModQty}
          onChange={(e) => setNewModQty(sanitizeDecimalString(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && handleAddModifier(group.id)}
          disabled={!workshopId}
         />
         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{selectedModUnit}</span>
        </div>
        <div className="w-6 flex justify-end">
         <button onClick={() => { setAddingModToGroup(null); setModIngSearch(''); setModIngId(''); setNewModPrice(''); setNewModQty(''); }} className="px-2.5 py-1 bg-secondary text-muted-foreground rounded text-xs font-medium hover:text-foreground transition-colors">✕</button>
        </div>
       </div>
      )}
      <button
       onClick={() => { setAddingModToGroup(group.id); setModIngSearch(''); setModIngId(''); setNewModPrice(''); setNewModQty(''); }}
       className="py-1 text-sm font-medium transition-colors cursor-pointer hover:opacity-80"
       style={{ color: '#5D4FF1' }}
      >
       + Добавить
      </button>
     </div>
    ))}

    {/* Add group: create new or pick existing */}
    {currentDishId && (showAddModGroup ? (
     <div className="mt-2">
      {/* Create new — always on top */}
      <div className="flex items-center gap-2 mb-2">
       <input
       className="flex-1 px-3 py-2 border border-[#E6E5E3] rounded-lg text-sm "
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
     </div>
    ) : (
     <button
      onClick={() => setShowAddModGroup(true)}
      className="mt-2 text-sm transition-opacity hover:opacity-80"
      style={{ backgroundColor: '#EFF0F4', color: '#000', padding: '8px 12px', borderRadius: '6px' }}
     >
      Новый набор модификаторов
     </button>
    ))}
   </div>
  </EditPage>
 );
}

