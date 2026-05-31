-- ============================================================
-- Test seed: minimal connected data for functional testing.
-- Run with: supabase db reset
-- ============================================================

-- 1. CLEAN ALL DATA (cascading, preserves venues + organizations)
TRUNCATE TABLE
  order_item_modifiers,
  order_items,
  marketplace_modifier_bindings,
  marketplace_inbound_events,
  marketplace_store_bindings,
  product_modifier_groups,
  modifiers,
  modifier_groups,
  recipe_items,
  inventory_movements,
  pos_order_stock_settlements,
  pos_order_refunds,
  pos_consumption_dead_letters,
  payments,
  cash_movements,
  orders,
  shifts,
  suppliers,
  supply_items,
  supply_documents,
  venue_order_counters,
  stock_items,
  products,
  workshop_warehouses,
  tables,
  warehouses,
  workshops,
  categories,
  user_venues,
  users,
  zones
CASCADE;

-- 2. SEED MINIMAL TEST DATA
DO $$
DECLARE
  v_venue_id UUID;
  v_org_id UUID;
  v_cat_hot UUID := gen_random_uuid();
  v_cat_drinks UUID := gen_random_uuid();
  v_cat_snacks UUID := gen_random_uuid();
  v_wh_kitchen UUID := gen_random_uuid();
  v_wh_bar UUID := gen_random_uuid();
  v_ws_kitchen UUID := gen_random_uuid();
  v_ws_bar UUID := gen_random_uuid();
  v_ing_flour UUID := gen_random_uuid();
  v_ing_cheese UUID := gen_random_uuid();
  v_ing_coffee UUID := gen_random_uuid();
  v_ing_milk UUID := gen_random_uuid();
  v_dish_margherita UUID := gen_random_uuid();
  v_dish_carbonara UUID := gen_random_uuid();
  v_dish_latte UUID := gen_random_uuid();
  v_dish_espresso UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_venue_id FROM public.venues LIMIT 1;
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

  -- === CATEGORIES (3) ===
  INSERT INTO public.categories (id, venue_id, name, color_hex, sort_order) VALUES
    (v_cat_hot,    v_venue_id, 'Горячее', '#1B5E20', 1),
    (v_cat_drinks, v_venue_id, 'Напитки', '#4527A0', 2),
    (v_cat_snacks, v_venue_id, 'Закуски', '#1565C0', 3);

  -- === WAREHOUSES (2) ===
  INSERT INTO public.warehouses (id, venue_id, name) VALUES
    (v_wh_kitchen, v_venue_id, 'Склад кухни'),
    (v_wh_bar,    v_venue_id, 'Склад бара');

  -- === WORKSHOPS (2, each mapped to a warehouse) ===
  INSERT INTO public.workshops (id, venue_id, name, sort_order, default_warehouse_id) VALUES
    (v_ws_kitchen, v_venue_id, 'Кухня', 1, v_wh_kitchen),
    (v_ws_bar,    v_venue_id, 'Бар',   2, v_wh_bar);

  INSERT INTO public.workshop_warehouses (workshop_id, warehouse_id) VALUES
    (v_ws_kitchen, v_wh_kitchen),
    (v_ws_bar,    v_wh_bar);

  -- === INGREDIENTS (4, with stock) ===
  INSERT INTO public.products (id, venue_id, type, name, price, cost_price, unit, stock_quantity, is_active, sort_order, workshop_id) VALUES
    (v_ing_flour,  v_venue_id, 'ingredient', 'Мука',          0, 200, 'кг', 5.000, true, 1, v_ws_kitchen),
    (v_ing_cheese, v_venue_id, 'ingredient', 'Сыр моцарелла', 0, 500, 'кг', 3.000, true, 2, v_ws_kitchen),
    (v_ing_coffee, v_venue_id, 'ingredient', 'Кофе в зернах', 0, 800, 'кг', 2.000, true, 3, v_ws_bar),
    (v_ing_milk,   v_venue_id, 'ingredient', 'Молоко',        0,  60, 'л',  10.00, true, 4, v_ws_bar);

  -- stock_items (authoritative stock, synced with stock_quantity above)
  INSERT INTO public.stock_items (warehouse_id, product_id, quantity, unit) VALUES
    (v_wh_kitchen, v_ing_flour,  5.000, 'кг'),
    (v_wh_kitchen, v_ing_cheese, 3.000, 'кг'),
    (v_wh_bar,    v_ing_coffee, 2.000, 'кг'),
    (v_wh_bar,    v_ing_milk,   10.00, 'л');

  -- warehouse_products (ingredient visibility per warehouse)
  INSERT INTO public.warehouse_products (warehouse_id, product_id) VALUES
    (v_wh_kitchen, v_ing_flour),
    (v_wh_kitchen, v_ing_cheese),
    (v_wh_bar,    v_ing_coffee),
    (v_wh_bar,    v_ing_milk);

  -- === DISHES (4, with recipes) ===
  INSERT INTO public.products (id, venue_id, type, name, price, cost_price, category_id, workshop_id, is_active, sort_order) VALUES
    (v_dish_margherita, v_venue_id, 'dish', 'Пицца Маргарита', 350, 0, v_cat_hot,    v_ws_kitchen, true, 1),
    (v_dish_carbonara,  v_venue_id, 'dish', 'Паста Карбонара', 280, 0, v_cat_hot,    v_ws_kitchen, true, 2),
    (v_dish_latte,      v_venue_id, 'dish', 'Латте',           180, 0, v_cat_drinks, v_ws_bar,     true, 3),
    (v_dish_espresso,   v_venue_id, 'dish', 'Эспрессо',        120, 0, v_cat_drinks, v_ws_bar,     true, 4);

  -- === RECIPES (6 lines: 2 dishes × 2 ingredients each, 2 drinks × 1 ingredient each) ===
  INSERT INTO public.recipe_items (id, product_id, ingredient_id, quantity, unit) VALUES
    (gen_random_uuid(), v_dish_margherita, v_ing_flour,  0.300, 'кг'),
    (gen_random_uuid(), v_dish_margherita, v_ing_cheese, 0.150, 'кг'),
    (gen_random_uuid(), v_dish_carbonara,  v_ing_flour,  0.200, 'кг'),
    (gen_random_uuid(), v_dish_carbonara,  v_ing_cheese, 0.100, 'кг'),
    (gen_random_uuid(), v_dish_latte,      v_ing_coffee, 0.018, 'кг'),
    (gen_random_uuid(), v_dish_latte,      v_ing_milk,   0.200, 'л'),
    (gen_random_uuid(), v_dish_espresso,   v_ing_coffee, 0.018, 'кг');

END $$;
