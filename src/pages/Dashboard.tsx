import { Link } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useDashboardData';

export function Dashboard() {
  const { data: stats, isPending, isError, error } = useDashboardStats();
  const revenue = stats?.revenue ?? 0;
  const openOrders = stats?.openOrders ?? 0;
  const stockRisks = stats?.stockRisks ?? 0;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Операционный центр</h2>
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Система онлайн
        </div>
      </div>

      {isError && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Не удалось загрузить показатели'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Выручка (POS)
            </p>
            <span className="text-[10px] bg-muted text-muted-foreground font-bold px-1.5 py-0.5 rounded border">
              СЕГОДНЯ
            </span>
          </div>
          <p className="text-4xl font-bold mb-2">
            {isPending ? '…' : isError ? '—' : `${revenue.toLocaleString()} сом`}
          </p>
          <p className="text-xs text-muted-foreground">
            Сумма оплаченных заказов за сегодня из Supabase (таблица orders).
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm border-dashed">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Онлайн-меню
            </p>
            <span className="text-[10px] text-muted-foreground font-bold px-1.5 py-0.5 rounded border border-dashed">
              НЕ ПОДКЛЮЧЕНО
            </span>
          </div>
          <p className="text-2xl font-semibold text-muted-foreground mb-2">Нет данных</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Метрики заказов и просмотров появятся после подключения внешнего сервиса онлайн-меню.
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Текущие заказы
          </p>
          <p className="text-4xl font-bold mb-4">
            {isPending ? '…' : isError ? '—' : openOrders}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Активные заказы (статус active) в POS.
          </p>
          <Link
            to="/checks"
            className="block w-full py-2 bg-foreground text-background rounded-xl text-sm font-bold text-center hover:opacity-90 transition-opacity"
          >
            Открыть чеки
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-red-50 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-red-600"></span>
            Риски и аномалии
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
              <div>
                <p className="text-sm font-bold text-red-900">Критический остаток</p>
                <p className="text-xs text-red-700">
                  {isPending
                    ? 'Загрузка…'
                    : isError
                      ? 'Не удалось загрузить'
                      : `${stockRisks} ингредиент(ов) с остатком ниже порога`}
                </p>
              </div>
              <Link
                to="/menu/ingredients"
                className="text-xs font-bold bg-white text-red-600 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-600 hover:text-white transition-all"
              >
                ИСПРАВИТЬ
              </Link>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100">
              <div>
                <p className="text-sm font-bold text-amber-900">Фискализация (eKassa)</p>
                <p className="text-xs text-amber-700">Модуль не подключён — данные eKassa здесь не отображаются.</p>
              </div>
              <div className="text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-dashed rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-2">Популярное (онлайн)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Нет подключённого источника — вместо вымышленных позиций показываем заглушку.
          </p>
          <p className="text-xs text-muted-foreground italic">
            После интеграции сюда можно вывести топ блюд из аналитики онлайн-меню.
          </p>
        </div>
      </div>
    </div>
  );
}
