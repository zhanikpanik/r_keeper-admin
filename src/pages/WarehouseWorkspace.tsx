import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { useWarehouses, useWarehouseIngredients, type IngredientListItem } from '@/hooks/useMenuData';
import { useDeleteWarehouse, useRenameWarehouse } from '@/hooks/useWarehouse';
import { somRounded } from '@/lib/formatSom';
import { SearchInput } from '@/components/ui/SearchInput';
import { AddButton } from '@/components/ui/ActionButtons';
import { EditButton } from '@/components/ui/EditButton';
import { DataTable } from '@/components/ui/DataTable';

export function WarehouseWorkspace() {
  const { warehouseId } = useParams<{ warehouseId: string }>();
  const navigate = useNavigate();

  const { data: warehouses = [] } = useWarehouses();
  const renameWarehouse = useRenameWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  const selected = warehouses.find((w) => w.id === warehouseId) || null;

  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: ingredients = [], isPending: ingPending } = useWarehouseIngredients(
    warehouseId ?? null,
    { enabled: Boolean(warehouseId) }
  );


  const q = search.trim().toLowerCase();
  const filtered = q
    ? ingredients.filter((i) => i.name.toLowerCase().includes(q))
    : ingredients;

  const totalValue = useMemo(() => {
    return filtered.reduce((sum, i) => sum + i.stock_quantity * i.price, 0);
  }, [filtered]);


  async function handleRename() {
    const name = window.prompt('Новое название склада', selected?.name)?.trim();
    if (!name || !warehouseId || name === selected?.name) return;
    try {
      await renameWarehouse.mutateAsync({ id: warehouseId, name });
      toast.success('Склад переименован');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось переименовать');
    }
  }

  async function handleDelete() {
    if (!confirm('Удалить склад? Разрешено только если нет остатков и активных документов.')) return;
    if (!warehouseId) return;
    try {
      await deleteWarehouse.mutateAsync(warehouseId);
      toast.success('Склад удалён');
      navigate('/warehouse/operations');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось удалить');
    }
  }

  const columns = useMemo<ColumnDef<IngredientListItem, any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Наименование',
      cell: ({ getValue }) => <span className="block truncate">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'stock_quantity',
      header: 'Остаток',
      cell: ({ row }) => {
        const qty = row.original.stock_quantity;
        const unit = row.original.unit;
        return <span className={qty < 0 ? 'text-red-600' : ''}>{qty} {unit}</span>;
      },
    },
    {
      id: 'value',
      header: 'Стоимость',
      cell: ({ row }) => {
        const val = row.original.stock_quantity * row.original.price;
        return <span className="">{somRounded(val).toLocaleString()} сом</span>;
      },
    },
    {
      id: 'edit',
      header: '',
      cell: ({ row }) => (
        <EditButton onClick={() => navigate(`/menu/ingredients/${row.original.id}?warehouse=${warehouseId}&back=warehouse`)} />
      ),
    },
  ], [warehouseId, navigate]);

  if (!selected && warehouses.length > 0) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Выберите склад в боковом меню.
      </div>
    );
  }

  if (!selected) return null;

  return (
    <div className="p-8">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{selected.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Остатки на {somRounded(totalValue).toLocaleString()} сом
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); handleRename(); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                Переименовать
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); handleDelete(); }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-accent transition-colors"
              >
                Удалить склад
              </button>
            </div>
          )}
        </div>
      </div>

            {/* ═══ STOCK TABLE ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium">Остатки</h3>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию…" className="w-56" />
          <AddButton
            onClick={() => navigate(`/menu/ingredients/add?warehouse=${warehouseId}&back=warehouse`)}
            label="Добавить ингредиент"
          />
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          dense
          isLoading={ingPending}
          emptyMessage={search ? 'Ничего не найдено' : 'На этом складе пока нет ингредиентов'}
          onRowClick={(row) => navigate(`/menu/ingredients/${row.original.id}?warehouse=${warehouseId}&back=warehouse`)}
          className="max-w-2xl"
        />
      </div>

    </div>
  );
}
