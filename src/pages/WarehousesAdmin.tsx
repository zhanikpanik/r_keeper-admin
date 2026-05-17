import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useWarehouses, useWarehouseIngredients } from '@/hooks/useMenuData';
import { useDeleteWarehouse, useRenameWarehouse } from '@/hooks/useWarehouse';
import searchIcon from '@/assets/icons/search.svg';
import { somRounded } from '@/lib/formatSom';

const GRID_TEMPLATE = '220px 100px 120px 120px 140px';

export function WarehousesAdmin() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();
  const { data: warehouses = [], isPending: warehousesPending } = useWarehouses();
  const renameWarehouse = useRenameWarehouse();
  const deleteWarehouse = useDeleteWarehouse();
  const [renameValue, setRenameValue] = useState('');
  const [search, setSearch] = useState('');
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId) || null;

  useEffect(() => {
    setRenameValue(selectedWarehouse?.name || '');
  }, [selectedWarehouse?.id, selectedWarehouse?.name]);

  const { data: ingredients = [], isPending: ingredientsPending } = useWarehouseIngredients(
    selectedWarehouse?.id ?? null,
    { enabled: Boolean(selectedWarehouse?.id) }
  );

  const filteredIngredients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [search, ingredients]);

  const total = filteredIngredients.reduce((sum, i) => sum + i.stock_quantity * i.price, 0);

  async function handleRenameWarehouse() {
    const id = selectedWarehouse?.id;
    const name = renameValue.trim();
    if (!id || !name) return;
    try {
      await renameWarehouse.mutateAsync({ id, name });
      toast.success('Название склада обновлено');
      navigate(`/warehouse/${id}`);
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось обновить склад');
    }
  }

  async function handleDeleteWarehouse() {
    const id = selectedWarehouse?.id;
    if (!id) return;
    if (!confirm('Удалить склад? Разрешено только если нет остатков и активных документов.')) return;
    try {
      await deleteWarehouse.mutateAsync(id);
      toast.success('Склад удален');
      navigate('/warehouse/deliveries');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось удалить склад');
    }
  }

  return (
    <div className="p-8">
      <button
        type="button"
        onClick={() => navigate('/warehouse/deliveries')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к складу
      </button>

      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Склад: {selectedWarehouse?.name || '—'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Здесь отображаются ингредиенты, доступные на выбранном складе.
          </p>
        </div>
        {selectedWarehouse?.id && (
          <Link
            to={`/menu/ingredients/add?warehouse=${selectedWarehouse.id}&back=warehouse`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            + Добавить ингредиент
          </Link>
        )}
      </div>

      {!warehousesPending && warehouses.length === 0 && (
        <div className="text-sm text-muted-foreground">Нет складов. Создайте склад в sidebar.</div>
      )}

      {!selectedWarehouse && warehouses.length > 0 && (
        <div className="text-sm text-muted-foreground">Выберите склад в sidebar.</div>
      )}

      {selectedWarehouse && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-72 bg-secondary/30">
              <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" alt="" />
              <input
                className="bg-transparent text-sm outline-none flex-1"
                placeholder="Быстрый поиск"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <input
              className="px-3 py-2 border rounded-lg text-sm bg-background"
              placeholder="Переименовать склад"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <button
              type="button"
              onClick={handleRenameWarehouse}
              disabled={renameWarehouse.isPending || !renameValue.trim()}
              className="px-3 py-2 border rounded-lg text-sm hover:bg-accent disabled:opacity-50"
            >
              Сохранить название
            </button>
            <button
              type="button"
              onClick={handleDeleteWarehouse}
              disabled={deleteWarehouse.isPending}
              className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
            >
              Удалить склад
            </button>
            <div className="ml-auto text-sm text-muted-foreground">
              Всего: <span className="font-semibold text-foreground">{somRounded(total)} сом</span>
            </div>
          </div>

          <div
            className="-mx-3 w-fit"
            style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div className="col-span-5 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
              <div className="pr-6">Название</div>
              <div className="pr-6">Ед.</div>
              <div className="pr-6 text-right">Остаток</div>
              <div className="pr-6 text-right">Себестоимость</div>
              <div className="pr-6 text-right">Сумма остатков</div>
            </div>
            <div className="col-span-5 grid grid-cols-subgrid">
              {ingredientsPending && (
                <div className="col-span-5 py-12 text-center text-sm text-muted-foreground">
                  Загрузка…
                </div>
              )}
              {!ingredientsPending &&
                filteredIngredients.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      navigate(`/menu/ingredients/${item.id}?warehouse=${selectedWarehouse.id}&back=warehouse`)
                    }
                    className="col-span-5 grid grid-cols-subgrid items-center py-2 px-3 text-left hover:bg-[#EFF0F4] transition-colors even:bg-muted/10"
                  >
                    <div className="text-sm font-semibold truncate pr-6">{item.name}</div>
                    <div className="text-sm text-muted-foreground pr-6">{item.unit}</div>
                    <div className="text-sm text-right tabular-nums pr-6">
                      {item.stock_quantity}
                    </div>
                    <div className="text-sm text-right tabular-nums text-muted-foreground pr-6">
                      {somRounded(item.price)} сом
                    </div>
                    <div className="text-sm text-right tabular-nums font-medium pr-6">
                      {somRounded(item.price * item.stock_quantity)} сом
                    </div>
                  </button>
                ))}
              {!ingredientsPending && filteredIngredients.length === 0 && (
                <div className="col-span-5 py-12 text-center text-sm text-muted-foreground">
                  {search ? 'Ничего не найдено' : 'На этом складе пока нет ингредиентов'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
