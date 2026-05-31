interface Warehouse {
 id: string;
 name: string;
}

interface WarehouseSelectorProps {
 warehouses: Warehouse[];
 selectedId: string;
 onChange: (id: string) => void;
 /** If true, clicking the selected warehouse deselects it. Default false. */
 allowDeselect?: boolean;
 /** Filter out a warehouse by id (e.g. "from" warehouse in transfers). */
 excludeId?: string;
}

/** Segmented button group for picking a single warehouse. */
export function WarehouseSelector({
 warehouses,
 selectedId,
 onChange,
 allowDeselect = false,
 excludeId,
}: WarehouseSelectorProps) {
 const filtered = excludeId
  ? warehouses.filter((w) => w.id !== excludeId)
  : warehouses;

 if (filtered.length === 0) {
  return <p className="text-sm text-muted-foreground">Нет складов</p>;
 }

 return (
  <div
   className="inline-flex flex-wrap gap-0.5 rounded-lg p-0.5"
   style={{ backgroundColor: '#FAFAFA', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }}
  >
   {filtered.map((w) => {
    const isSelected = selectedId === w.id;
    return (
     <button
      key={w.id}
      type="button"
      onClick={() => onChange(allowDeselect && isSelected ? '' : w.id)}
      className={`px-4 py-1.5 rounded-md text-sm transition-all ${
       isSelected
        ? 'bg-white text-foreground'
        : 'text-muted-foreground hover:text-foreground'
      }`}
      style={isSelected ? { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : {}}
     >
      {w.name}
     </button>
    );
   })}
  </div>
 );
}
