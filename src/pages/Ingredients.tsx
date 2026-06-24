import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef, type Row } from '@tanstack/react-table';
import { toast } from 'sonner';
import { SearchInput } from '@/components/ui/SearchInput';
import { AddButton } from '@/components/ui/ActionButtons';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { EditButton } from '@/components/ui/EditButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { DataTable } from '@/components/ui/DataTable';
import { somRounded } from '@/lib/formatSom';
import { supabase, VENUE_ID } from '@/lib/supabase';
import {
  useWorkshops,
  useIngredients,
  useIngredientUsageMap,
  useInvalidateMenu,
  type IngredientListItem,
} from '@/hooks/useMenuData';

export function Ingredients() {
  const navigate = useNavigate();
  const { data: workshops = [] } = useWorkshops();
  const {
    data: ingredients = [],
    isPending: ingredientsPending,
    isError: ingredientsError,
    error: ingredientsErr,
  } = useIngredients(null);
  const { data: usageMap = {} } = useIngredientUsageMap();
  const { invalidateIngredients } = useInvalidateMenu();

  const [search, setSearch] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<Record<string, boolean>>({});

  const q = search.trim().toLowerCase();
  const filtered = ingredients
    .filter(i => selectedWorkshop === null || i.workshop_id === selectedWorkshop)
    .filter(i => !q || i.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)
      .eq('venue_id', VENUE_ID);
    if (error) { toast.error(error.message); return; }
    invalidateIngredients();
    toast.success('Ингредиент удалён');
  }

  const handleExpand = (rowId: string) => {
    setExpandedId(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const columns: ColumnDef<IngredientListItem, any>[] = [
    {
      accessorKey: 'name',
      header: 'Ингредиент',
      cell: ({ getValue }) => <span className="block truncate">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'stock_quantity',
      header: 'Остаток',
      cell: ({ row }) => {
        const qty = row.original.stock_quantity;
        const unit = row.original.unit;
        return <span className={qty <= 0 ? 'text-red-600 font-medium' : ''}>{qty} {unit}</span>;
      },
    },
    {
      accessorKey: 'price',
      header: 'Себест.',
      cell: ({ getValue }) => <span className="">{somRounded(getValue<number>())} сом</span>,
    },
    {
      id: 'total',
      header: 'Сумма',
      cell: ({ row }) => {
        const val = row.original.stock_quantity * row.original.price;
        return <span className="text-foreground">{somRounded(val)} сом</span>;
      },
    },
    {
      id: 'edit',
      header: '',
      cell: ({ row }) => <EditButton onClick={() => navigate(`/menu/ingredients/${row.original.id}`)} />,
    },
    {
      id: 'delete',
      header: '',
      cell: ({ row }) => <DeleteButton variant="row" onClick={() => handleDelete(row.original.id)} />,
    },
  ];

  const renderExpanded = (row: Row<IngredientListItem>) => {
    const item = row.original;
    const dishes = usageMap[item.id] || [];
    const hasWarehouses = item.warehouse_breakdown.length > 0;
    const hasData = dishes.length > 0 || hasWarehouses;
    if (!hasData) return null;

    return (
      <div className="max-w-xs space-y-3">
        {item.warehouse_breakdown.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-muted-foreground">По складам</p>
            {item.warehouse_breakdown.map((w) => (
              <div key={w.warehouse_id} className="text-sm py-0.5 flex justify-between gap-4">
                <span>{w.warehouse_name}</span>
                <span className="whitespace-nowrap">{w.quantity} {item.unit}</span>
              </div>
            ))}
          </div>
        )}
        {dishes.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-muted-foreground">Используется в блюдах</p>
            {dishes.map((dish) => <div key={dish.id} className="text-sm py-0.5">{dish.name}</div>)}
          </div>
        )}
      </div>
    );
  };

  const showEmptyState = !ingredientsPending && !ingredientsError && filtered.length === 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Ингредиенты</h2>
        <AddButton onClick={() => navigate('/menu/ingredients/add')} label="Добавить ингредиент" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Быстрый поиск" className="w-56" />
        <SegmentTabs
          options={[
            { value: 'all', label: 'Все' },
            ...workshops.map((w) => ({ value: w.id, label: w.name })),
          ]}
          value={selectedWorkshop ?? 'all'}
          onChange={(v) => setSelectedWorkshop(v === 'all' ? null : v)}
        />
      </div>

      {showEmptyState ? (
        <EmptyState
          title={search ? 'Ничего не найдено' : 'Ингредиентов пока нет'}
          hint={search ? 'Попробуйте изменить поисковый запрос' : 'Добавьте ингредиенты, чтобы начать составлять блюда и отслеживать остатки'}
          action={!search ? { label: 'Добавить ингредиент', onClick: () => navigate('/menu/ingredients/add') } : undefined}
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          dense
          isLoading={ingredientsPending}
          error={ingredientsError ? (ingredientsErr instanceof Error ? ingredientsErr : new Error('Не удалось загрузить')) : null}
          renderExpandedRow={renderExpanded}
          expandedRows={expandedId}
          onExpandedChange={handleExpand}
          className="max-w-4xl"
        />
      )}
    </div>
  );
}
