import { useEffect, useState } from 'react';
import { supabase, VENUE_ID } from '@/lib/supabase';

export function Dashboard() {
  const [stats, setStats] = useState({
    revenue: 45200,
    fiscalized: 42000,
    onlineOrders: 12,
    onlineViews: 450,
    openOrders: 5,
    stockRisks: 3,
    fiscalErrors: 0,
  });

  // In a real app, these would be fetched from eKassa and Online Menu tables
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Операционный центр</h2>
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Система онлайн
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* eKassa Live Sales */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Выручка (eKassa)</p>
            <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded border border-blue-100">LIVE</span>
          </div>
          <p className="text-4xl font-bold mb-2">{stats.revenue.toLocaleString()} сом</p>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full" 
                style={{ width: `${(stats.fiscalized / stats.revenue) * 100}%` }}
              ></div>
            </div>
            <span className="text-muted-foreground font-medium">
              {Math.round((stats.fiscalized / stats.revenue) * 100)}% фискально
            </span>
          </div>
        </div>

        {/* Online Menu Performance */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Онлайн-меню</p>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-4xl font-bold">{stats.onlineOrders}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Заказов</p>
            </div>
            <div className="h-10 w-px bg-border mb-1"></div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{stats.onlineViews}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Просмотров</p>
            </div>
          </div>
          <div className="flex gap-1 h-8 items-end">
            {[40, 60, 45, 90, 65, 80, 70].map((h, i) => (
              <div key={i} className="flex-1 bg-secondary/50 rounded-t-sm" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        {/* Open Orders */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Текущие заказы</p>
          <p className="text-4xl font-bold mb-4">{stats.openOrders}</p>
          <button className="w-full py-2 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
            Открыть терминал
          </button>
        </div>
      </div>

      {/* Risks and Alerts Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-red-50 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-red-600"></span>
            Риски и Аномалии
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
              <div>
                <p className="text-sm font-bold text-red-900">Критический остаток</p>
                <p className="text-xs text-red-700">3 ингредиента в стоп-листе онлайн-меню</p>
              </div>
              <button className="text-xs font-bold bg-white text-red-600 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-600 hover:text-white transition-all">
                ИСПРАВИТЬ
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100">
              <div>
                <p className="text-sm font-bold text-amber-900">Ошибка фискализации</p>
                <p className="text-xs text-amber-700">Все чеки пробиты корректно</p>
              </div>
              <div className="text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="bg-card border rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">Популярное (Онлайн)</h3>
          <div className="space-y-3">
            {[
              { name: 'Капучино 300мл', count: 45, trend: '+12%' },
              { name: 'Круассан классик', count: 32, trend: '+5%' },
              { name: 'Сэндвич с тунцом', count: 28, trend: '-2%' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground font-mono">{item.count}</span>
                  <span className={`text-[10px] font-bold ${item.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {item.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
