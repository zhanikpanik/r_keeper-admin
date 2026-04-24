import { useState } from 'react';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';

type WriteOffStatus = 'Черновик' | 'Проведено' | 'Отменено';

interface WriteOffItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  reason: string;
}

interface WriteOff {
  id: string;
  date: string;
  reason_summary: string;
  status: WriteOffStatus;
  items: WriteOffItem[];
  created_by: string;
}

const MOCK_WRITE_OFFS: WriteOff[] = [
  {
    id: 'w1',
    date: '2024-03-22',
    reason_summary: 'Порча продуктов (срок годности)',
    status: 'Проведено',
    created_by: 'Шеф-повар',
    items: [
      { id: 'i1', name: 'Молоко 3.2%', quantity: 2, unit: 'л', reason: 'Истек срок годности' },
      { id: 'i2', name: 'Томаты', quantity: 1.5, unit: 'кг', reason: 'Гниль' },
    ],
  },
];

export function WriteOffs() {
  const [search, setSearch] = useState('');
  const [writeOffs] = useState<WriteOff[]>(MOCK_WRITE_OFFS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = writeOffs.filter(w => 
    w.reason_summary.toLowerCase().includes(search.toLowerCase()) ||
    w.date.includes(search)
  );

  const getStatusColor = (status: WriteOffStatus) => {
    switch (status) {
      case 'Проведено': return 'text-green-600 bg-green-50 border-green-100';
      case 'Черновик': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Отменено': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-muted-foreground bg-secondary';
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Списания</h2>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
          <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Поиск по причине или дате..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          + Списать
        </button>
      </div>

      <div className="w-fit -mx-3">
        <div className="flex items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 bg-white z-10">
          <div className="w-[100px] shrink-0 pr-4">Дата</div>
          <div className="w-[250px] shrink-0 pr-4">Причина</div>
          <div className="w-[100px] shrink-0 pr-4 text-center">Статус</div>
          <div className="w-[120px] shrink-0 pr-4 text-center">Создал</div>
          <div className="w-[100px] shrink-0 text-left px-4">Действие</div>
          <div className="w-12 shrink-0"></div>
        </div>

        <div className="">
          {filtered.map((wo) => (
            <div key={wo.id} className={`group ${expandedId === wo.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}>
              <div className="flex items-center py-2 px-3 cursor-pointer" onClick={() => setExpandedId(expandedId === wo.id ? null : wo.id)}>
                <div className="w-[100px] shrink-0 pr-4 text-sm text-muted-foreground">
                  {new Date(wo.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="w-[250px] shrink-0 pr-4 text-sm font-medium truncate">
                  {wo.reason_summary}
                </div>
                <div className="w-[100px] shrink-0 pr-4 flex justify-center">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(wo.status)}`}>
                    {wo.status.toUpperCase()}
                  </span>
                </div>
                <div className="w-[120px] shrink-0 pr-4 text-[10px] text-center text-muted-foreground uppercase font-semibold">
                  {wo.created_by}
                </div>
                <div className="w-[100px] shrink-0 px-4">
                  <button className="w-full py-1 text-[11px] text-[#5D4FF1] font-bold hover:text-[#F70000] transition-colors">
                    {expandedId === wo.id ? 'СКРЫТЬ' : 'ДЕТАЛИ'}
                  </button>
                </div>
                <div className="w-12 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 text-red-500 opacity-40 hover:opacity-100">
                    <img src={crossIcon} className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === wo.id && (
                <div className="pb-3 pl-6 mt-1 pt-1 border-l-2 border-red-500 ml-3 mb-2">
                  <div className="max-w-lg space-y-1">
                    {wo.items.map(item => (
                      <div key={item.id} className="flex items-center text-sm py-0.5">
                        <div className="w-40 font-medium">{item.name}</div>
                        <div className="w-24 text-right text-muted-foreground tabular-nums">{item.quantity} {item.unit}</div>
                        <div className="flex-1 ml-4 text-xs text-muted-foreground italic"> — {item.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
