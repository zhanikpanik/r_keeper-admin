import ReactECharts from 'echarts-for-react';
import type { HourlyBucket } from '@/hooks/useHeatmapData';

const DAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const DAY_LABELS_FULL = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOUR_LABELS = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

function formatSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

interface Props {
  data: HourlyBucket[];
  isPending: boolean;
}

export function HourlyHeatmap({ data, isPending }: Props) {
  if (isPending) {
    return (
      <div className="h-72 flex items-center justify-center text-[13px] text-[#37352f]">
        Загрузка тепловой карты…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-[13px] text-[#37352f]">
        Нет данных по часам
      </div>
    );
  }

  // Build heatmap series data: [dayIndex, hourIndex, orderCount]
  const heatmapData = data
    .filter((d) => d.hour >= 7 && d.hour <= 23 && d.dayIndex >= 0 && d.dayIndex <= 6)
    .map((d) => [d.dayIndex, d.hour - 7, d.orderCount]);

  // Daily totals for summary row
  const dailyTotals = Array.from({ length: 7 }, (_, dayIdx) =>
    data
      .filter((d) => d.dayIndex === dayIdx)
      .reduce((sum, d) => sum + d.orderCount, 0)
  );

  const maxOrders = Math.max(...heatmapData.map((d) => d[2]), 1);

  const option = {
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1e293b', fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      formatter: (params: { data: number[] }) => {
        const [dayIdx, hourIdx] = params.data;
        const hour = hourIdx + 7;
        const cell = data.find((d) => d.dayIndex === dayIdx && d.hour === hour);
        if (!cell) return '';
        const timeLabel = `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`;
        return `
          <div style="font-weight:600;margin-bottom:4px">${DAY_LABELS_FULL[dayIdx]} ${timeLabel}</div>
          <div>Заказов: <b>${cell.orderCount}</b></div>
          <div>Выручка: <b>${formatSom(cell.revenue)} сом</b></div>
          <div style="color:#37352f">Средний чек: ${formatSom(cell.avgCheck)} сом</div>
        `;
      },
    },
    grid: {
      top: 4,
      right: 4,
      bottom: 36,
      left: 42,
    },
    xAxis: {
      type: 'category',
      data: DAY_LABELS,
      position: 'top',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 500,
        margin: 4,
      },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: HOUR_LABELS,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#37352f',
        fontSize: 10,
        fontFamily: 'system-ui, sans-serif',
        margin: 4,
      },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: maxOrders,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 2,
      itemWidth: 10,
      itemHeight: 140,
      text: ['много', 'пусто'],
      textStyle: { color: '#37352f', fontSize: 11 },
      inRange: {
        color: ['#f8fafc', '#fef9c3', '#fdba74', '#f97316', '#ef4444'],
      },
      outOfRange: {
        color: ['#f1f5f9'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            borderColor: '#1e293b',
            borderWidth: 1.5,
          },
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
          borderRadius: 2,
        },
      },
    ],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#37352f]">
          Загруженность по часам
        </h3>
        <span className="text-[13px] text-[#37352f]">май 2026 · среднее за 4 недели</span>
      </div>

      <ReactECharts option={option} style={{ height: 260 }} notMerge />

      {/* Daily totals row */}
      <div className="flex gap-0 mt-2 ml-[42px] mr-[4px]">
        {dailyTotals.map((total, i) => (
          <div
            key={i}
            className="flex-1 text-center py-1 border-t border-[#f0efed]"
          >
            <div className="text-[13px] text-[#37352f]">
              {total}
            </div>
            <div className="text-[11px] text-[#37352f]">заказов</div>
          </div>
        ))}
      </div>
    </div>
  );
}
