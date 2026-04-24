import { useState } from 'react';
import searchIcon from '@/assets/icons/search.svg';
import crossIcon from '@/assets/icons/cross.svg';
import { useWorkshops } from '@/hooks/useMenuData';

type InventoryStatus = 'Черновик' | 'Проведено' | 'Отменено';
type InventoryStep = 'history' | 'setup' | 'counting';

interface InventoryAct {
  id: string;
  date: string;
  workshop: string;
  result: number;
  status: InventoryStatus;
}

const MOCK_INVENTORIES: InventoryAct[] = [
  { id: 'inv1', date: '2024-03-24', workshop: 'Кухня', result: -1250, status: 'Проведено' },
  { id: 'inv2', date: '2024-03-25', workshop: 'Бар', result: 420, status: 'Черновик' },
];

export function Inventory() {
  const [step, setStep] = useState<InventoryStep>('history');
  const [search, setSearch] = useState('');
  const [inventories] = useState<InventoryAct[]>(MOCK_INVENTORIES);

  // Setup state
  const { data: workshops = [] } = useWorkshops();
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [inventoryType, setInventoryType] = useState<'full' | 'partial'>('full');
  const [conductDate, setConductDate] = useState(new Date().toISOString().slice(0, 16));
  
  // Counting state
  const [countingItems, setCountingItems] = useState([
    { id: '1', name: 'Aroy кисло сладкий соус', unit: 'л', start: 2, incoming: 0, consumption: 0.155, writeoff: 0, theoretical: 1.845, actual: '', price: 420 },
    { id: '2', name: 'Pialati помидор', unit: 'кг', start: 3.5, incoming: 0, consumption: 1.008, writeoff: 0, theoretical: 2.492, actual: '', price: 345 },
    { id: '3', name: 'Айсберг', unit: 'кг', start: 0.8, incoming: 1.5, consumption: 1.48, writeoff: 0.4, theoretical: 0.42, actual: '', price: 200 },
  ]);

  const handleActualChange = (id: string, value: string) => {
    setCountingItems(items => items.map(item => 
      item.id === id ? { ...item, actual: value } : item
    ));
  };

  const getStatusColor = (status: InventoryStatus) => {
    switch (status) {
      case 'Проведено': return 'text-green-600 bg-green-50 border-green-100';
      case 'Черновик': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Отменено': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-muted-foreground bg-secondary';
    }
  };

  // 1. History View
  if (step === 'history') {
    const filtered = inventories.filter(inv => 
      inv.workshop.toLowerCase().includes(search.toLowerCase()) || inv.date.includes(search)
    );

    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Инвентаризация</h2>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-64 bg-secondary/30">
            <img src={searchIcon} className="w-3.5 h-3.5 opacity-40" />
            <input
              className="bg-transparent text-sm outline-none flex-1"
              placeholder="Поиск по складу или дате..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setStep('setup')}
            className="px-4 py-1.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + Начать инвентаризацию
          </button>
        </div>

        <div className="w-fit -mx-3">
          <div className="flex items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 bg-white z-10">
            <div className="w-[100px] shrink-0 pr-4">Дата</div>
            <div className="w-[180px] shrink-0 pr-4">Склад</div>
            <div className="w-[120px] shrink-0 pr-4 text-center">Статус</div>
            <div className="w-[120px] shrink-0 pr-4 text-right">Результат</div>
            <div className="w-[140px] shrink-0 text-left px-4">Действие</div>
            <div className="w-12 shrink-0"></div>
          </div>
          <div className="">
            {filtered.map((inv) => (
              <div key={inv.id} className="group hover:bg-[#EFF0F4] transition-colors even:bg-muted/10">
                <div className="flex items-center py-2 px-3">
                  <div className="w-[100px] shrink-0 pr-4 text-sm text-muted-foreground">
                    {new Date(inv.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                  </div>
                  <div className="w-[180px] shrink-0 pr-4 text-sm font-medium truncate">{inv.workshop}</div>
                  <div className="w-[120px] shrink-0 pr-4 flex justify-center">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusColor(inv.status)}`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </div>
                  <div className={`w-[120px] shrink-0 pr-4 text-sm text-right tabular-nums font-bold ${inv.result < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {inv.result > 0 ? '+' : ''}{inv.result.toLocaleString()} сом
                  </div>
                  <div className="w-[140px] shrink-0 px-4">
                    <button 
                      onClick={() => inv.status === 'Черновик' && setStep('counting')}
                      className="w-full py-1 text-[11px] text-[#5D4FF1] font-bold hover:text-[#F70000] transition-colors"
                    >
                      {inv.status === 'Черновик' ? 'ПРОДОЛЖИТЬ' : 'ДЕТАЛИ'}
                    </button>
                  </div>
                  <div className="w-12 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 text-red-500 opacity-40 hover:opacity-100"><img src={crossIcon} className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Setup View
  if (step === 'setup') {
    return (
      <div className="p-8 max-w-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <button onClick={() => setStep('history')} className="hover:text-foreground">Инвентаризация</button>
          <span>/</span>
          <span className="text-foreground font-medium">Новая сверка</span>
        </div>
        <h2 className="text-2xl font-bold mb-8">Настройка инвентаризации</h2>

        <div className="space-y-8">
          {/* Warehouse selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Выберите склад</label>
            <div className="grid grid-cols-2 gap-2">
              {workshops.map(w => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkshopId(w.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedWorkshopId === w.id 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-muted hover:border-muted-foreground/30 bg-card'
                  }`}
                >
                  <div className={`text-sm font-bold ${selectedWorkshopId === w.id ? 'text-primary' : 'text-foreground'}`}>{w.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold">Основной склад продуктов</div>
                </button>
              ))}
            </div>
          </div>

          {/* Type selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Тип проверки</label>
            <div className="flex p-1 bg-secondary rounded-xl w-fit">
              <button
                onClick={() => setInventoryType('full')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  inventoryType === 'full' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Полная
              </button>
              <button
                onClick={() => setInventoryType('partial')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  inventoryType === 'partial' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Частичная
              </button>
            </div>
          </div>

          {/* Date selection (Hindsight) */}
          <div className="space-y-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-amber-900 uppercase tracking-tight">Период проверки</label>
              <div className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold uppercase tracking-wider">Ретро-учет</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-800/70">Начало (последняя сверка):</span>
                <span className="font-bold text-amber-900">24.03.2024, 08:00</span>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-amber-900 uppercase">Дата и время проведения</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all font-medium"
                  value={conductDate}
                  onChange={(e) => setConductDate(e.target.value)}
                />
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed italic">
                  * Остатки будут рассчитаны на указанный момент. Продажи после этого времени не повлияют на результат.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              disabled={!selectedWorkshopId}
              onClick={() => setStep('counting')}
              className="flex-1 py-3 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Начать инвентаризацию
            </button>
            <button
              onClick={() => setStep('history')}
              className="px-6 py-3 border-2 rounded-xl font-bold hover:bg-secondary transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Counting View
  const selectedSkladName = workshops.find(w => w.id === selectedWorkshopId)?.name || 'Склад';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setStep('history')} className="hover:text-foreground">Инвентаризация</button>
            <span>/</span>
            <span className="text-foreground font-medium">Новая сверка</span>
          </div>
          <h2 className="text-2xl font-bold">Инвентаризация: {selectedSkladName}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStep('setup')} className="px-4 py-1.5 border rounded-lg text-sm font-semibold hover:bg-secondary transition-colors">Назад</button>
          <button onClick={() => setStep('history')} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">Провести</button>
        </div>
      </div>

      <div className="w-fit -mx-3">
        <div className="flex items-center pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground sticky top-0 bg-white z-10 tracking-tight border-b">
          <div className="w-[200px] shrink-0 pr-4">Наименование</div>
          <div className="w-[80px] shrink-0 pr-2 text-right">Нач. ост.</div>
          <div className="w-[80px] shrink-0 pr-2 text-right">Поступл.</div>
          <div className="w-[80px] shrink-0 pr-2 text-right">Расход</div>
          <div className="w-[80px] shrink-0 pr-2 text-right">Списано</div>
          <div className="w-[90px] shrink-0 pr-2 text-right">План. ост.</div>
          <div className="w-[110px] shrink-0 px-2 text-center">Факт. ост.</div>
          <div className="w-[90px] shrink-0 pr-2 text-right">Разница</div>
          <div className="w-[120px] shrink-0 pr-4 text-right">Разница, сом</div>
        </div>

        <div className="">
          {countingItems.map((item) => {
            const actualNum = parseFloat(item.actual) || 0;
            const diff = item.actual === '' ? 0 : actualNum - item.theoretical;
            const diffSom = diff * item.price;

            return (
              <div key={item.id} className="group hover:bg-[#EFF0F4] transition-colors even:bg-muted/5 flex items-center py-2 px-3 border-b border-muted/30">
                <div className="w-[200px] shrink-0 pr-4"><div className="font-semibold text-sm truncate">{item.name}</div></div>
                <div className="w-[80px] shrink-0 pr-2 text-right tabular-nums text-sm text-muted-foreground">{item.start} {item.unit}</div>
                <div className="w-[80px] shrink-0 pr-2 text-right tabular-nums text-sm text-blue-600 font-medium">+{item.incoming} {item.unit}</div>
                <div className="w-[80px] shrink-0 pr-2 text-right tabular-nums text-sm text-amber-600 font-medium">-{item.consumption} {item.unit}</div>
                <div className="w-[80px] shrink-0 pr-2 text-right tabular-nums text-sm text-red-600 font-medium">-{item.writeoff} {item.unit}</div>
                <div className="w-[90px] shrink-0 pr-2 text-right tabular-nums text-sm font-bold bg-blue-50/50 py-1 rounded">{item.theoretical} {item.unit}</div>
                <div className="w-[110px] shrink-0 px-2 relative">
                  <input 
                    type="number"
                    className="w-full pl-2 pr-8 py-0.5 border rounded text-sm bg-background text-right tabular-nums outline-none focus:border-primary"
                    placeholder="0.00"
                    value={item.actual}
                    onChange={(e) => handleActualChange(item.id, e.target.value)}
                    autoFocus={item.id === '1'}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{item.unit}</span>
                </div>
                <div className={`w-[90px] shrink-0 pr-2 text-right tabular-nums text-sm font-semibold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {item.actual === '' ? '—' : (diff > 0 ? `+${diff.toFixed(3)} ${item.unit}` : `${diff.toFixed(3)} ${item.unit}`)}
                </div>
                <div className={`w-[120px] shrink-0 pr-4 text-right tabular-nums text-sm font-bold ${diffSom < 0 ? 'text-red-600' : diffSom > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {item.actual === '' ? '—' : (diffSom > 0 ? `+${Math.round(diffSom).toLocaleString()}` : Math.round(diffSom).toLocaleString())} сом
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
