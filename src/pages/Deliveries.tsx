import { useState } from 'react';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';

type DeliveryStatus = 'Черновик' | 'В пути' | 'Принято' | 'Отменено';

interface DeliveryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

interface Delivery {
  id: string;
  date: string;
  supplier: string;
  amount: number;
  status: DeliveryStatus;
  items: DeliveryItem[];
  source: 'Procurement App' | 'Manual';
}

const MOCK_DELIVERIES: Delivery[] = [
  {
    id: '1',
    date: '2024-03-20',
    supplier: 'Овощи и Фрукты ООО',
    amount: 12500,
    status: 'Принято',
    source: 'Procurement App',
    items: [
      { id: 'i1', name: 'Помидоры', quantity: 10, unit: 'кг', price: 150 },
      { id: 'i2', name: 'Огурцы', quantity: 5, unit: 'кг', price: 120 },
    ],
  },
  {
    id: '2',
    date: '2024-03-21',
    supplier: 'Молочный Край',
    amount: 8400,
    status: 'В пути',
    source: 'Manual',
    items: [
      { id: 'i3', name: 'Молоко 3.2%', quantity: 20, unit: 'л', price: 80 },
    ],
  },
];

export function Deliveries() {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>(MOCK_DELIVERIES);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newDelivery, setNewDelivery] = useState({
    supplier: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
  });

  const filteredDeliveries = deliveries.filter(d => 
    d.supplier.toLowerCase().includes(search.toLowerCase()) ||
    d.date.includes(search)
  );

  const handleAddDelivery = () => {
    if (!newDelivery.supplier || !newDelivery.amount) return;
    
    const delivery: Delivery = {
      id: Math.random().toString(36).substr(2, 9),
      date: newDelivery.date,
      supplier: newDelivery.supplier,
      amount: parseFloat(newDelivery.amount),
      status: 'Черновик',
      source: 'Manual',
      items: [],
    };

    setDeliveries([delivery, ...deliveries]);
    setNewDelivery({
      supplier: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
    });
    setShowAddForm(false);
  };

  const handleConfirm = (id: string) => {
    setDeliveries(prev => prev.map(d => 
      d.id === id ? { ...d, status: 'Принято' as DeliveryStatus } : d
    ));
  };

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'Принято': return 'text-green-600 bg-green-50 border-green-100';
      case 'В пути': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'Черновик': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Отменено': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-muted-foreground bg-secondary';
    }
  };

  const totalMonthly = deliveries
    .filter(d => d.status === 'Принято')
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Поставки</h2>
        <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
          Принято за месяц: <span className="text-foreground font-bold">{totalMonthly.toLocaleString()} сом</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
          <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Поиск по поставщику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {showAddForm && (
        <div className="flex gap-3 items-end py-3 border-b mb-4">
          <div className="flex-[2]">
            <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Поставщик</label>
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newDelivery.supplier}
              onChange={(e) => setNewDelivery(p => ({ ...p, supplier: e.target.value }))}
              placeholder="Название компании"
              autoFocus
            />
          </div>
          <div className="w-40">
            <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Дата</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background text-muted-foreground"
              value={newDelivery.date}
              onChange={(e) => setNewDelivery(p => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div className="w-32">
            <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Сумма</label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newDelivery.amount}
              onChange={(e) => setNewDelivery(p => ({ ...p, amount: e.target.value }))}
              placeholder="Сумма"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddDelivery}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
            >
              Создать
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="w-fit -mx-3">
        <div className="flex items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 bg-white z-10">
          <div className="w-[100px] shrink-0 pr-4">Дата</div>
          <div className="w-[180px] shrink-0 pr-4">Поставщик</div>
          <div className="w-[100px] shrink-0 pr-4 text-center">Статус</div>
          <div className="w-[120px] shrink-0 pr-4 text-center">Источник</div>
          <div className="w-[100px] shrink-0 pr-4 text-right">Сумма</div>
          <div className="w-[140px] shrink-0 text-left px-4">Действие</div>
          <div className="w-12 shrink-0"></div>
        </div>

        <div className="">
          {filteredDeliveries.map((delivery) => (
            <div key={delivery.id} className={`group ${expandedId === delivery.id ? 'bg-[#EFF0F4]' : 'hover:bg-[#EFF0F4]'} transition-colors even:bg-muted/10`}>
              <div className="flex items-center py-2 px-3">
                <div className="w-[100px] shrink-0 pr-4 text-sm text-muted-foreground">
                  {new Date(delivery.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="w-[180px] shrink-0 pr-4 text-sm font-medium truncate" onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}>
                  {delivery.supplier}
                </div>
                <div className="w-[100px] shrink-0 pr-4 flex justify-center">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(delivery.status)}`}>
                    {delivery.status.toUpperCase()}
                  </span>
                </div>
                <div className="w-[120px] shrink-0 pr-4 text-[10px] text-center text-muted-foreground uppercase font-semibold">
                  {delivery.source}
                </div>
                <div className="w-[100px] shrink-0 pr-4 text-sm text-right tabular-nums font-medium">
                  {delivery.amount.toLocaleString()}
                </div>
                <div className="w-[140px] shrink-0 px-4">
                  {delivery.status === 'В пути' ? (
                    <button
                      onClick={() => handleConfirm(delivery.id)}
                      className="w-full py-1 bg-green-600 text-white rounded text-[11px] font-bold hover:bg-green-700 transition-colors uppercase tracking-wider"
                    >
                      Принять
                    </button>
                  ) : (
                    <button 
                      onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                      className="w-full py-1 text-[11px] text-[#5D4FF1] font-bold hover:text-[#F70000] transition-colors"
                    >
                      {expandedId === delivery.id ? 'СКРЫТЬ' : 'ДЕТАЛИ'}
                    </button>
                  )}
                </div>
                <div className="w-12 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 text-red-500 opacity-40 hover:opacity-100">
                    <img src={crossIcon} className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === delivery.id && (
                <div className="pb-3 pl-6 mt-1 pt-1 border-l-2 border-[#5D4FF1] ml-3 mb-2">
                  <div className="max-w-md space-y-1">
                    {delivery.items.map(item => (
                      <div key={item.id} className="flex items-center text-sm py-0.5">
                        <div className="w-40 font-medium">{item.name}</div>
                        <div className="w-24 text-right text-muted-foreground tabular-nums">{item.quantity} {item.unit}</div>
                        <div className="w-24 text-right text-muted-foreground tabular-nums">{item.price}</div>
                        <div className="w-24 text-right font-mono tabular-nums">{ (item.quantity * item.price).toLocaleString() }</div>
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
