import ReactECharts from 'echarts-for-react';
import type { WeekSlice } from '@/hooks/useWeeklyStats';

const DAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

const WEEK_COLORS = ['#e5e7eb', '#d1d5db', '#64748b', '#00B558'];
const WEEK_WIDTHS = [1, 1, 1.5, 3];
const WEEK_OPACITIES = [0.5, 0.6, 0.8, 1];

function formatSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

function pctDelta(current: number, previous: number): string {
  if (previous === 0) return '—';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

interface Props {
  weeks: WeekSlice[];
  isPending: boolean;
}

export function WeeklyComparison({ weeks, isPending }: Props) {
  if (isPending) {
    return (
      <div className="h-64 flex items-center justify-center text-[13px] text-[#37352f]">
        Загрузка сравнения…
      </div>
    );
  }

  if (weeks.length === 0) {
    return null;
  }

  // ECharts option: 4 overlaid line series
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1e293b', fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      formatter: (params: { seriesName: string; value: number; color: string }[]) => {
        if (!params?.length) return '';
        const dayIdx = params[0]?.axisIndex ?? 0;
        const dayLabel = DAY_LABELS[dayIdx] || '';
        let html = `<div style="font-weight:600;margin-bottom:4px">${dayLabel}</div>`;
        // Reverse to show newest first
        for (let w = weeks.length - 1; w >= 0; w--) {
          const d = weeks[w].days[dayIdx];
          if (!d) continue;
          const isCurrent = w === weeks.length - 1;
          html += `<div style="display:flex;justify-content:space-between;gap:16px;${isCurrent ? 'font-weight:600' : ''}">
            <span>${weeks[w].label}</span>
            <span style="color:${WEEK_COLORS[w]}">${formatSom(d.revenue)} сом</span>
          </div>`;
        }
        return html;
      },
    },
    grid: {
      top: 8,
      right: 8,
      bottom: 24,
      left: 40,
    },
    xAxis: {
      type: 'category',
      data: DAY_LABELS,
      axisLine: { lineStyle: { color: '#f0efed' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#37352f',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: '#37352f',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)),
      },
      splitLine: { lineStyle: { color: '#f0efed', type: 'dashed' } },
    },
    series: weeks.map((week, wi) => {
      const isCurrent = wi === weeks.length - 1;
      const data = week.days.map((d) => d.revenue);
      return {
        name: week.label,
        type: 'line',
        data,
        smooth: true,
        symbol: isCurrent ? 'circle' : 'none',
        symbolSize: isCurrent ? 5 : 0,
        lineStyle: {
          color: WEEK_COLORS[wi],
          width: WEEK_WIDTHS[wi],
          opacity: WEEK_OPACITIES[wi],
        },
        itemStyle: {
          color: WEEK_COLORS[wi],
          borderColor: '#fff',
          borderWidth: 2,
        },
        areaStyle: isCurrent
          ? {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(0, 181, 88, 0.25)' },
                  { offset: 1, color: 'rgba(0, 181, 88, 0.04)' },
                ],
              },
            }
          : undefined,
        emphasis: {
          symbolSize: 7,
          focus: 'series',
        },
        z: isCurrent ? 10 : 1,
      };
    }),
  };

  // Summary row data
  const weekSummaries = weeks.map((w, i) => {
    const isCurrent = i === weeks.length - 1;
    const prevRevenue = i > 0 ? weeks[i - 1].totalRevenue : 0;
    return {
      label: w.label,
      revenue: w.totalRevenue,
      expenses: w.totalExpenses,
      net: w.totalRevenue - w.totalExpenses,
      delta: i > 0 ? pctDelta(w.totalRevenue, prevRevenue) : null,
      isCurrent,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#37352f]">
          Неделя к неделе
        </h3>
        <span className="text-[13px] text-[#37352f]">выручка по дням, сом</span>
      </div>

      <ReactECharts option={option} style={{ height: 180 }} notMerge />

      {/* Compact weekly summary */}
      <div className="flex gap-3 mt-2 text-[13px]">
        {weekSummaries.map((ws, i) => (
          <div key={i} className={`flex-1 min-w-0 ${ws.isCurrent ? 'font-semibold text-green-700' : 'text-[#37352f]'}`}>
            <div className="truncate">{ws.label.slice(0, 6)}</div>
            <div className={ws.isCurrent ? 'text-green-700' : 'text-[#37352f]'}>
              {formatSom(ws.revenue).replace(/\s/g, '\u00A0')}
            </div>
            {ws.delta && (
              <div className={ws.delta.startsWith('+') ? 'text-green-600' : ws.delta === '—' ? '' : 'text-red-500'}>
                {ws.delta}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
