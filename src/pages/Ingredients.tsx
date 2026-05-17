import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { somRounded } from '@/lib/formatSom';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import {
  useInvalidateMenu,
  useIngredients,
  useIngredientUsageMap,
} from '@/hooks/useMenuData';

function getDishPlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'блюд';
  if (n1 > 1 && n1 < 5) return 'блюда';
  if (n1 === 1) return 'блюдо';
  return 'блюд';
}

function getWarehousePlural(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'складов';
  if (n1 > 1 && n1 < 5) return 'склада';
  if (n1 === 1) return 'склад';
  return 'складов';
}

/** Same layout pattern as Menu: grid + subgrid; last = 32px for ✕ */
const INGREDIENT_GRID_TEMPLATE = '40px 220px 130px 120px 120px 150px auto 32px';

export function Ingredients() {
  const navigate = useNavigate();
  const {
    data: ingredients = [],
    isPending: ingredientsPending,
    isError: ingredientsError,
    error: ingredientsErr,
  } = useIngredients(null);
  const { data: usageMap = {} } = useIngredientUsageMap();

  const { invalidateIngredients, invalidateIngredientUsage } = useInvalidateMenu();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalCapital = ingredients.reduce((sum, i) => sum + (i.stock_quantity * i.price), 0);

  const filtered = ingredients.filter(
    (i) => !search || i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const addLink = '/menu/ingredients/add';

  async function handleDelete(id: string) {
    if (!confirm('Удалить ингредиент?')) return;
    await supabase.from('products').delete().eq('id', id);
    invalidateIngredients();
    invalidateIngredientUsage();
  }

  const getStockStatus = (qty: number) => {
    if (qty <= 0) return { color: 'bg-red-500', label: 'Закончился' };
    if (qty < 5) return { color: 'bg-amber-500', label: 'Мало' };
    return { color: 'bg-green-500', label: 'В норме' };
  };

  const showEmptyList = !ingredientsPending && !ingredientsError && filtered.length === 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Ингредиенты</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Блюда привязаны к цехам, а остатки ингредиентов считаются суммарно по складам.
          </p>
        </div>
        <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
          Всего в закупке: <span className="text-foreground font-bold">{Math.round(totalCapital).toLocaleString()} сом</span>
        </div>
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
        <Link
          to={addLink}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + Добавить
        </Link>
      </div>

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: INGREDIENT_GRID_TEMPLATE }}
      >
        <div className="col-span-8 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div />
          <div className="pr-6">Название</div>
          <div className="pr-6">Цех</div>
          <div className="pr-6 text-right">Остатки (все склады)</div>
          <div className="pr-6 text-right">Себестоимость</div>
          <div className="pr-6 text-right">Сумма остатков</div>
          <div className="min-w-0 px-4">Детали</div>
          <div />
        </div>

        <div className="col-span-8 grid grid-cols-subgrid">
          {ingredientsPending && (
            <div className="col-span-8 py-12 text-center text-sm text-muted-foreground">
              Загрузка…
            </div>
          )}
          {ingredientsError && (
            <div className="col-span-8 py-12 text-center text-sm text-destructive">
              {ingredientsErr instanceof Error ? ingredientsErr.message : 'Не удалось загрузить'}
            </div>
          )}
          {!ingredientsPending && !ingredientsError && filtered.map((item) => {
            const dishes = usageMap[item.id] || [];
            const hasWarehouses = item.warehouse_breakdown.length > 0;
            const status = getStockStatus(item.stock_quantity);
            const canExpand = dishes.length > 0 || hasWarehouses;
            return (
              <div
                key={item.id}
                className={`col-span-8 grid grid-cols-subgrid group ${expandedId === item.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}
              >
                <div
                  role="link"
                  tabIndex={0}
                  className="grid grid-cols-subgrid col-span-8 items-center py-2 px-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                  onClick={() => navigate(`/menu/ingredients/${item.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/menu/ingredients/${item.id}`);
                    }
                  }}
                >
                  <div className="flex justify-center">
                    <div className={`w-2 h-2 rounded-full ${status.color}`} title={status.label} />
                  </div>
                  <div className="text-sm font-semibold truncate pr-6">{item.name}</div>
                  <div className="text-sm text-muted-foreground truncate pr-6">
                    {item.workshop_name || '—'}
                  </div>
                  <div
                    className={`text-sm text-right tabular-nums font-medium pr-6 ${item.stock_quantity <= 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                  >
                    {item.stock_quantity} {item.unit}
                  </div>
                  <div className="text-sm text-right text-muted-foreground tabular-nums pr-6">
                    {somRounded(item.price)} сом
                  </div>
                  <div className="text-sm text-right tabular-nums font-medium text-foreground pr-6">
                    {somRounded(item.stock_quantity * item.price)} сом
                  </div>
                  <div className="min-w-0 whitespace-nowrap text-sm px-4">
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expandedId === item.id ? null : item.id);
                        }}
                        className="text-sm font-medium text-[#5D4FF1] hover:text-[#F70000] transition-colors cursor-pointer"
                      >
                        {`${item.warehouse_breakdown.length} ${getWarehousePlural(item.warehouse_breakdown.length)} / ${dishes.length} ${getDishPlural(dishes.length)}`}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="opacity-40 hover:opacity-100 transition-opacity p-1 text-red-500"
                    >
                      <img
                        src={crossIcon}
                        alt=""
                        className="w-4 h-4 grayscale brightness-50 hover:grayscale-0 hover:brightness-100"
                      />
                    </button>
                  </div>
                </div>

                {expandedId === item.id && canExpand && (
                  <div className="col-span-8 pb-2 pl-4 mt-1 pt-1 ml-6">
                    <div className="max-w-lg space-y-3">
                      {item.warehouse_breakdown.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground pl-3">По складам</p>
                          {item.warehouse_breakdown.map((w) => (
                            <div key={w.warehouse_id} className="text-sm py-0.5 pl-3 text-muted-foreground flex justify-between gap-4">
                              <span>{w.warehouse_name}</span>
                              <span className="tabular-nums">{w.quantity} {item.unit}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {dishes.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground pl-3">Используется в блюдах</p>
                          {dishes.map((dish) => (
                            <div key={dish.id} className="text-sm py-0.5 pl-3 text-muted-foreground">
                              {dish.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {showEmptyList && (
            <div className="col-span-8 py-12 text-center text-sm text-muted-foreground">
              {search ? 'Ничего не найдено' : 'Нет ингредиентов. Нажмите "+ Добавить"'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
