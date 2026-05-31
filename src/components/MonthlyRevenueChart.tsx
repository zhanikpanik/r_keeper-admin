import ReactECharts from 'echarts-for-react';
import type { DailyStats } from '@/hooks/useMonthlyStats';

function formatSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

const GREEN = 'rgba(0, 181, 88, 0.4)';
const RED = 'rgba(229, 57, 53, 0.4)';
const GREEN_HOVER = 'rgba(0, 181, 88, 0.9)';
const RED_HOVER = 'rgba(229, 57, 53, 0.9)';
const GREEN_SOLID = '#00B558';
const RED_SOLID = '#E53935';
const DARK = '#334155';    // slate — net profit
const MUTED = '#37352f';
const GRID = '#f0efed';

interface Props {
  data: DailyStats[];
  isPending: boolean;
}

export function MonthlyRevenueChart({ data, isPending }: Props) {
  if (isPending) {
    return (
      <div className="h-72 flex items-center justify-center text-[13px] text-[#37352f]">
        Загрузка графика…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-[13px] text-[#37352f]">
        Нет данных за этот месяц
      </div>
    );
  }

  const monthName = new Date(data[0].date).toLocaleString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  // Build weekend markAreas
  const weekendAreas = data.reduce<{ xAxis: string }[][]>((acc, d) => {
    if (d.dayOfWeek === 'сб' || d.dayOfWeek === 'вс') {
      acc.push([{ xAxis: d.date }, { xAxis: d.date }]);
    }
    return acc;
  }, []);

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: DARK, fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      formatter: (params: unknown) => {
        const items = params as { seriesName: string; value: number; color: string; marker: string }[];
        if (!items?.length) return '';
        const dateKey = data[items[0]?.axisIndex ?? 0];
        if (!dateKey) return '';
        const d = dateKey;
        const rev = items.find((i) => i.seriesName === 'Выручка')?.value ?? 0;
        const exp = items.find((i) => i.seriesName === 'Расходы')?.value ?? 0;
        const net = rev - exp;
        const netSign = net >= 0 ? '+' : '−';
        const dateObj = new Date(d.date);
        const dayOfMonth = dateObj.getDate();
        const monthName = dateObj.toLocaleString('ru-RU', { month: 'long' });
        const dayName = dateObj.toLocaleString('ru-RU', { weekday: 'long' });
        return `
          <div style="font-weight:600;margin-bottom:4px">${dayOfMonth} ${monthName}, ${dayName}</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <span>Выручка <span style="color:${GREEN_SOLID}">${formatSom(rev)} сом</span></span>
            <span>Расходы <span style="color:${RED_SOLID}">${formatSom(exp)} сом</span></span>
          </div>
          <div style="margin-top:2px;color:${net >= 0 ? GREEN_SOLID : RED_SOLID}">
            Сальдо ${netSign}${formatSom(Math.abs(net))} сом
          </div>
          <div style="margin-top:4px;color:${MUTED}">
            Заказов: ${d.orderCount} · Средний чек: ${formatSom(d.avgCheck)} сом
          </div>
        `;
      },
    },
    grid: {
      top: 8,
      right: 16,
      bottom: 36,
      left: 60,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => {
        const dayNum = new Date(d.date).getDate();
        return `${dayNum}\n${d.dayOfWeek}`;
      }),
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
      axisLabel: {
        color: MUTED,
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 14,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: MUTED,
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)),
      },
      splitLine: { lineStyle: { color: GRID, type: 'dashed' } },
      min: 0,
    },
    series: [
      // Revenue bars — wide green
      {
        name: 'Выручка',
        type: 'bar',
        data: data.map((d) => d.revenue),
        itemStyle: {
          color: GREEN,
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '55%',
        emphasis: {
          itemStyle: { color: GREEN_HOVER },
        },
        markArea: {
          silent: true,
          data: weekendAreas,
          itemStyle: {
            color: 'rgba(0, 0, 0, 0.04)',
          },
          label: { show: false },
        },
      },
      // Expense bars — narrower red, overlaid
      {
        name: 'Расходы',
        type: 'bar',
        data: data.map((d) => d.expenses),
        itemStyle: {
          color: RED,
          borderRadius: [0, 1.2, 1.2, 0],
        },
        barWidth: '32%',
        barGap: '-100%',
        emphasis: {
          itemStyle: { color: RED_HOVER },
        },
      },
    ],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#37352f] capitalize">
          {monthName}
        </h3>
        <div className="flex items-center gap-4 text-[13px] text-[#37352f]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: GREEN }} />
            Выручка
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: RED }} />
            Расходы
          </span>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 280 }} notMerge />
    </div>
  );
}
