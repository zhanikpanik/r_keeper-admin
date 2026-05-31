import { Link } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useDashboardData';
import { useActiveShift } from '@/hooks/useShiftsData';
import { useMonthlyStats } from '@/hooks/useMonthlyStats';
import { useHeatmapData } from '@/hooks/useHeatmapData';
import { useWeeklyStats } from '@/hooks/useWeeklyStats';
import { useExpenseCategories } from '@/hooks/useExpenseCategories';
import { useTopItems } from '@/hooks/useTopItems';
import { MonthlyRevenueChart } from '@/components/MonthlyRevenueChart';
import { HourlyHeatmap } from '@/components/HourlyHeatmap';
import { WeeklyComparison } from '@/components/WeeklyComparison';
import { ExpenseTreemap } from '@/components/ExpenseTreemap';
import { TopItems } from '@/components/TopItems';
import { OperationsPanel } from '@/components/OperationsPanel';

export function Dashboard() {
 const { data: stats, isError, error } = useDashboardStats();
 const stockAlerts = (stats?.stockAlerts ?? []) as { name: string; quantity: number; unit: string }[];
 const { data: activeShift } = useActiveShift();
 const { data: monthlyData, isPending: monthlyPending } = useMonthlyStats();
 const { data: heatmapData, isPending: heatmapPending } = useHeatmapData();
 const { data: weeklyData, isPending: weeklyPending } = useWeeklyStats();
 const { data: expenseCategories, isPending: expensePending } = useExpenseCategories();
 const { data: topItems, isPending: topPending } = useTopItems();

 return (
  <div className="p-6">
   {/* Header + today KPI */}
   <div className="flex items-start justify-between mb-6">
    <div>
     <h2 className="text-xl font-bold mb-1">Дашборд</h2>
     <p className="text-[13px] text-[#37352f]">Alto Coffee Bishkek · май 2026</p>
    </div>
    <div className="text-right">
     {activeShift ? (
      <Link
       to={`/cash-shifts?shift=${activeShift.id}`}
       className="inline-flex items-center gap-2 text-[13px] text-[#37352f] hover:text-[#37352f] transition-colors"
      >
       <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
       Смена с {activeShift.openTime}
      </Link>
     ) : (
      <Link to="/cash-shifts" className="text-[13px] text-[#37352f] hover:text-[#37352f] transition-colors">
       Нет активной смены
      </Link>
     )}
    </div>
   </div>

   {isError && (
    <div className="mb-6 text-[13px] text-red-600">
     {error instanceof Error ? error.message : 'Не удалось загрузить'}
    </div>
   )}

   {/* Full width: Revenue chart */}
   <div className="mb-6">
    <MonthlyRevenueChart data={monthlyData ?? []} isPending={monthlyPending} />
   </div>

   {/* 2-col: Top dishes + Heatmap */}
   <div className="grid grid-cols-2 gap-6 mb-6">
    <TopItems
     dishes={topItems?.dishes ?? []}
     ingredients={topItems?.ingredients ?? []}
     isPending={topPending}
    />
    <HourlyHeatmap data={heatmapData ?? []} isPending={heatmapPending} />
   </div>

   {/* 2-col: Weekly + Expenses */}
   <div className="grid grid-cols-2 gap-6 mb-6">
    <WeeklyComparison weeks={weeklyData ?? []} isPending={weeklyPending} />
    <ExpenseTreemap categories={expenseCategories ?? []} isPending={expensePending} />
   </div>

   {/* Operations */}
   <OperationsPanel
    stockAlerts={stockAlerts.length > 0 ? stockAlerts : [
     { name: 'Молоко 3.2%', quantity: 2, unit: 'л' },
     { name: 'Кофе в зёрнах', quantity: 1.5, unit: 'кг' },
     { name: 'Сироп карамельный', quantity: 0.3, unit: 'л' },
    ]}
    deliveries={[
     { id: 'd1', supplier: 'Белая река', date: 'сегодня' },
     { id: 'd2', supplier: 'Ак-Куу', date: 'сегодня' },
    ]}
    isPending={false}
   />

  </div>
 );
}
