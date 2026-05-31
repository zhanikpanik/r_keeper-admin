import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, VENUE_ID } from '@/lib/supabase';

// Fetch categories
async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('venue_id', VENUE_ID)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export interface CategoryItem {
  id: string;
  name: string;
  color_hex: string;
  sort_order: number;
}

export interface DishRecipeLine {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient_name: string;
  ingredient_cost: number;
}

// Fetch dishes with joins + all recipe lines (Menu expands without extra round-trips)
async function fetchDishes() {
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, price, cost_price, category_id, workshop_id, output_weight, is_active, has_modifiers, sort_order, categories(name), workshops(name)')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'dish')
    .order('sort_order');

  if (prodErr) throw prodErr;
  const rows = products || [];
  if (rows.length === 0) return [];

  const dishIds = rows.map((p: { id: string }) => p.id);

  const { data: recipeRows, error: recErr } = await supabase
    .from('recipe_items')
    .select('id, product_id, ingredient_id, quantity, unit')
    .in('product_id', dishIds);

  if (recErr) throw recErr;

  const byDish: Record<string, { id: string; product_id: string; ingredient_id: string; quantity: unknown; unit: string | null }[]> = {};
  for (const r of recipeRows || []) {
    const row = r as { product_id: string };
    if (!byDish[row.product_id]) byDish[row.product_id] = [];
    byDish[row.product_id]!.push(r as { id: string; product_id: string; ingredient_id: string; quantity: unknown; unit: string | null });
  }

  const ingIds = [...new Set((recipeRows || []).map((r: any) => r.ingredient_id as string))];
  const ingMap = new Map<string, { name: string; price: number }>();
  if (ingIds.length > 0) {
    const { data: ings, error: ingErr } = await supabase
      .from('products')
      .select('id, name, price')
      .in('id', ingIds);
    if (ingErr) throw ingErr;
    for (const i of ings || []) {
      const row = i as { id: string; name: string; price: number | string | null };
      ingMap.set(row.id, { name: row.name, price: Number(row.price) || 0 });
    }
  }

  return rows.map((p: any) => {
    const linesRaw = byDish[p.id] || [];
    const recipe_items: DishRecipeLine[] = linesRaw.map((r: any) => {
      const ing = ingMap.get(r.ingredient_id);
      return {
        id: r.id,
        ingredient_id: r.ingredient_id,
        quantity: Number(r.quantity) || 0,
        unit: r.unit || '',
        ingredient_name: ing?.name || '—',
        ingredient_cost: ing?.price ?? 0,
      };
    });
    return {
      ...p,
      category_name: p.categories?.name || '',
      workshop_name: p.workshops?.name || '',
      recipe_count: recipe_items.length,
      recipe_items,
    };
  });
}

export interface IngredientListItem {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  unit: string;
  is_active: boolean;
  workshop_id: string | null;
  workshop_name: string;
  warehouse_breakdown: { warehouse_id: string; warehouse_name: string; quantity: number }[];
}

interface IngredientProductRow {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  unit: string;
  is_active: boolean;
  workshop_id: string | null;
  workshops?: { name?: string | null } | null;
}

async function fetchIngredientsList(workshopId: string | null): Promise<IngredientListItem[]> {
  let q = supabase
    .from('products')
    .select('id, name, price, stock_quantity, unit, is_active, workshop_id, workshops(name)')
    .eq('venue_id', VENUE_ID)
    .eq('type', 'ingredient')
    .order('name');

  if (workshopId) {
    q = q.eq('workshop_id', workshopId);
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as IngredientProductRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  type WarehouseProductRow = {
    product_id: string;
    warehouse_id: string;
    warehouses?: { name?: string | null } | { name?: string | null }[] | null;
  };

  const { data: mapRows, error: mapErr } = await supabase
    .from('warehouse_products')
    .select('product_id, warehouse_id, warehouses(name)')
    .in('product_id', ids);
  if (mapErr) throw mapErr;

  const { data: stockRows, error: stockErr } = await supabase
    .from('stock_items')
    .select('product_id, warehouse_id, quantity')
    .in('product_id', ids);
  if (stockErr) throw stockErr;

  const warehouseNameById = new Map<string, string>();
  const mappedByProduct = new Map<string, Set<string>>();
  for (const row of (mapRows ?? []) as WarehouseProductRow[]) {
    const set = mappedByProduct.get(row.product_id) ?? new Set<string>();
    set.add(row.warehouse_id);
    mappedByProduct.set(row.product_id, set);
    const wh = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
    if (wh?.name) warehouseNameById.set(row.warehouse_id, wh.name);
  }

  const stockByProduct = new Map<string, Map<string, number>>();
  for (const row of stockRows ?? []) {
    const productId = (row as { product_id: string }).product_id;
    const warehouseId = (row as { warehouse_id: string }).warehouse_id;
    const qty = Number((row as { quantity: unknown }).quantity) || 0;
    const byWarehouse = stockByProduct.get(productId) ?? new Map<string, number>();
    byWarehouse.set(warehouseId, (byWarehouse.get(warehouseId) ?? 0) + qty);
    stockByProduct.set(productId, byWarehouse);
  }

  return rows.map((i) => {
    const mapped = mappedByProduct.get(i.id) ?? new Set<string>();
    const stockByWarehouse = stockByProduct.get(i.id) ?? new Map<string, number>();
    const allWarehouseIds = new Set<string>([...mapped, ...stockByWarehouse.keys()]);

    const warehouse_breakdown = [...allWarehouseIds]
      .map((warehouse_id) => ({
        warehouse_id,
        warehouse_name: warehouseNameById.get(warehouse_id) || '—',
        quantity: stockByWarehouse.get(warehouse_id) ?? 0,
      }))
      .sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name, 'ru'));

    const stock_quantity = warehouse_breakdown.reduce((sum, w) => sum + w.quantity, 0);

    return {
      ...i,
      stock_quantity,
      workshop_name: i.workshops?.name || '',
      warehouse_breakdown,
    };
  });
}

export interface IngredientDishRef {
  id: string;
  name: string;
}

async function fetchIngredientUsageMap(): Promise<Record<string, IngredientDishRef[]>> {
  const { data: recipeItems, error } = await supabase
    .from('recipe_items')
    .select('ingredient_id, product_id');
  if (error) throw error;
  if (!recipeItems?.length) return {};

  const dishIds = [...new Set(recipeItems.map((r) => r.product_id))];
  const { data: dishes, error: dishErr } = await supabase
    .from('products')
    .select('id, name')
    .in('id', dishIds);
  if (dishErr) throw dishErr;

  const dishMap = new Map((dishes || []).map((d) => [d.id, d.name]));
  const map: Record<string, IngredientDishRef[]> = {};
  for (const item of recipeItems) {
    const name = dishMap.get(item.product_id);
    if (!name) continue;
    if (!map[item.ingredient_id]) map[item.ingredient_id] = [];
    map[item.ingredient_id]!.push({ id: item.product_id, name });
  }
  return map;
}

export interface WorkshopItem {
  id: string;
  name: string;
  default_warehouse_id: string | null;
}

async function createDish(input: {
  name: string;
  price: number;
  categoryId: string | null;
}) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error('Укажите название блюда');

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
      name: trimmed,
      price: input.price,
      cost_price: 0,
      category_id: input.categoryId,
      is_active: true,
      has_modifiers: false,
      sort_order: nextSort,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data as { id: string };
}

async function createCategory(input: { name: string }) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error('Укажите название категории');

  const { data: sortRow } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('venue_id', VENUE_ID)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (Number((sortRow as { sort_order?: number } | null)?.sort_order) || 0) + 1;

  const { error } = await supabase.from('categories').insert({
    venue_id: VENUE_ID,
    name: trimmed,
    color_hex: '',
    sort_order: nextSort,
  });
  if (error) throw error;
}

async function updateCategory(input: { id: string; name: string }) {
  const trimmed = input.name.trim();
  if (!trimmed) throw new Error('Укажите название категории');

  const { error } = await supabase
    .from('categories')
    .update({ name: trimmed })
    .eq('id', input.id)
    .eq('venue_id', VENUE_ID);
  if (error) throw error;
}

async function deleteCategory(categoryId: string) {
  const { error: dishErr } = await supabase
    .from('products')
    .update({ category_id: null })
    .eq('venue_id', VENUE_ID)
    .eq('type', 'dish')
    .eq('category_id', categoryId);
  if (dishErr) throw dishErr;

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('venue_id', VENUE_ID);
  if (error) throw error;
}

// Fetch workshops
async function fetchWorkshops() {
  const { data, error } = await supabase
    .from('workshops')
    .select('id, name, default_warehouse_id')
    .eq('venue_id', VENUE_ID)
    .order('sort_order');
  if (error) throw error;
  return (data || []) as WorkshopItem[];
}

async function fetchWarehouses() {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name')
    .eq('venue_id', VENUE_ID)
    .order('name');
  if (error) throw error;
  return data || [];
}

interface WarehouseProductJoinRow {
  product_id: string;
  products:
    | (IngredientProductRow & { workshops?: { name?: string | null } | null })
    | (IngredientProductRow & { workshops?: { name?: string | null } | null })[]
    | null;
}

async function fetchWarehouseIngredientsList(warehouseId: string | null): Promise<IngredientListItem[]> {
  if (!warehouseId) return [];

  const { data, error } = await supabase
    .from('warehouse_products')
    .select('product_id, products!inner(id, name, price, stock_quantity, unit, is_active, workshop_id, workshops(name))')
    .eq('warehouse_id', warehouseId);
  if (error) throw error;

  const rows: IngredientProductRow[] = [];
  for (const raw of (data ?? []) as WarehouseProductJoinRow[]) {
    const p = Array.isArray(raw.products) ? raw.products[0] : raw.products;
    if (!p) continue;
    rows.push(p);
  }
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: stockRows, error: stockErr } = await supabase
    .from('stock_items')
    .select('product_id, quantity')
    .eq('warehouse_id', warehouseId)
    .in('product_id', ids);
  if (stockErr) throw stockErr;

  const stockMap = new Map<string, number>();
  for (const s of stockRows ?? []) {
    const pid = (s as { product_id: string }).product_id;
    stockMap.set(pid, Number((s as { quantity: unknown }).quantity) || 0);
  }

  const result = rows
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map((i) => ({
      ...i,
      stock_quantity: stockMap.get(i.id) ?? 0,
      workshop_name: i.workshops?.name || '',
      warehouse_breakdown: [
        {
          warehouse_id: warehouseId,
          warehouse_name: '',
          quantity: stockMap.get(i.id) ?? 0,
        },
      ],
    }));
  return result;
}

// Fetch recipe items for a dish
async function fetchRecipeItems(dishId: string) {
  const { data } = await supabase
    .from('recipe_items')
    .select('id, ingredient_id, quantity, unit')
    .eq('product_id', dishId);

  if (!data || data.length === 0) return [];

  const ingIds = data.map((r: any) => r.ingredient_id);
  const { data: ings } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', ingIds);

  return data.map((r: any) => ({
    ...r,
    ingredient_name: ings?.find((i: any) => i.id === r.ingredient_id)?.name || '—',
    ingredient_cost: ings?.find((i: any) => i.id === r.ingredient_id)?.price || 0,
  }));
}

// Hooks
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useDishes() {
  return useQuery({
    queryKey: ['dishes'],
    queryFn: fetchDishes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkshops() {
  return useQuery({
    queryKey: ['workshops'],
    queryFn: fetchWorkshops,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateWorkshop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      defaultWarehouseId,
    }: {
      name: string;
      defaultWarehouseId: string | null;
    }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Укажите название цеха');

      const { data: sortRow } = await supabase
        .from('workshops')
        .select('sort_order')
        .eq('venue_id', VENUE_ID)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (Number((sortRow as { sort_order?: number } | null)?.sort_order) || 0) + 1;

      const { error } = await supabase.from('workshops').insert({
        venue_id: VENUE_ID,
        name: trimmed,
        sort_order: nextSort,
        default_warehouse_id: defaultWarehouseId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
  });
}

export function useUpdateWorkshop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      defaultWarehouseId,
    }: {
      id: string;
      name: string;
      defaultWarehouseId: string | null;
    }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Укажите название цеха');

      const { error } = await supabase
        .from('workshops')
        .update({
          name: trimmed,
          default_warehouse_id: defaultWarehouseId,
        })
        .eq('id', id)
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
  });
}

export function useDeleteWorkshop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: dishRows, error: dishErr } = await supabase
        .from('products')
        .select('id')
        .eq('venue_id', VENUE_ID)
        .eq('type', 'dish')
        .eq('workshop_id', id)
        .limit(1);
      if (dishErr) throw dishErr;
      if ((dishRows || []).length > 0) {
        throw new Error('В цехе есть блюда. Переназначьте блюда перед удалением.');
      }

      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', id)
        .eq('venue_id', VENUE_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshops'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
  });
}

export function useCreateDish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-usage'] });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
  });
}

export function useIngredients(
  workshopId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ingredients', workshopId ?? 'all'],
    queryFn: () => fetchIngredientsList(workshopId),
    // 5 min: ingredients list is relatively static in admin usage
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useWarehouseIngredients(
  warehouseId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['warehouse-ingredients', warehouseId ?? 'none'],
    queryFn: () => fetchWarehouseIngredientsList(warehouseId),
    // 5 min: warehouse ingredients table is static between deliveries
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useIngredientUsageMap() {
  return useQuery({
    queryKey: ['ingredient-usage'],
    queryFn: fetchIngredientUsageMap,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecipeItems(dishId: string | null) {
  return useQuery({
    queryKey: ['recipe', dishId],
    queryFn: () => fetchRecipeItems(dishId!),
    enabled: !!dishId,
    staleTime: 5 * 60 * 1000,
  });
}

// Invalidation helper
export function useInvalidateMenu() {
  const queryClient = useQueryClient();
  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['workshops'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-usage'] });
    },
    invalidateCategories: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    invalidateWorkshops: () => queryClient.invalidateQueries({ queryKey: ['workshops'] }),
    invalidateWarehouses: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
    invalidateDishes: () => {
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
      queryClient.invalidateQueries({ queryKey: ['ingredient-usage'] });
    },
    invalidateIngredients: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
    invalidateWarehouseIngredients: () => queryClient.invalidateQueries({ queryKey: ['warehouse-ingredients'] }),
    invalidateIngredientUsage: () => queryClient.invalidateQueries({ queryKey: ['ingredient-usage'] }),
    invalidateRecipe: (dishId: string) => queryClient.invalidateQueries({ queryKey: ['recipe', dishId] }),
  };
}
