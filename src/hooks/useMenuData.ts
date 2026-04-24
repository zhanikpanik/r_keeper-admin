import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// Fetch dishes with joins
async function fetchDishes() {
  const [prodRes, recipeRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, cost_price, category_id, workshop_id, output_weight, is_active, has_modifiers, sort_order, categories(name), workshops(name)')
      .eq('venue_id', VENUE_ID)
      .eq('type', 'dish')
      .order('sort_order'),
    supabase
      .from('recipe_items')
      .select('product_id'),
  ]);

  if (prodRes.error) throw prodRes.error;

  const recipeCounts: Record<string, number> = {};
  (recipeRes.data || []).forEach((r: any) => {
    recipeCounts[r.product_id] = (recipeCounts[r.product_id] || 0) + 1;
  });

  return (prodRes.data || []).map((p: any) => ({
    ...p,
    category_name: p.categories?.name || '',
    workshop_name: p.workshops?.name || '',
    recipe_count: recipeCounts[p.id] || 0,
  }));
}

// Fetch workshops
async function fetchWorkshops() {
  const { data, error } = await supabase
    .from('workshops')
    .select('id, name')
    .eq('venue_id', VENUE_ID)
    .order('sort_order');
  if (error) throw error;
  return data || [];
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
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    },
    invalidateCategories: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    invalidateWorkshops: () => queryClient.invalidateQueries({ queryKey: ['workshops'] }),
    invalidateDishes: () => queryClient.invalidateQueries({ queryKey: ['dishes'] }),
    invalidateRecipe: (dishId: string) => queryClient.invalidateQueries({ queryKey: ['recipe', dishId] }),
  };
}
