import ReactECharts from 'echarts-for-react';
import type { TopItem } from '@/hooks/useTopItems';

function formatSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

function getBarOption(
  items: TopItem[],
  label: string,
  color: string,
  valueFormatter: (v: number) => string,
  secondaryLabel: string,
  secondaryFormatter: (v: number) => string,
) {
  const data = [...items].sort((a, b) => b.value - a.value);
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1e293b', fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0]; if (!p) return '';
        const item = data.find((d) => d.name === p.name);
        return `
          <div style="font-weight:600;margin-bottom:4px">${p.name}</div>
          <div>${label}: <b>${valueFormatter(p.value)}</b></div>
          <div style="color:#37352f">${secondaryLabel}: ${secondaryFormatter(item?.secondary ?? 0)}</div>
        `;
      },
    },
    grid: { top: 4, right: 80, bottom: 4, left: 4 },
    xAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.name).reverse(),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#1e293b',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 500,
        margin: 6,
        width: 100,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: data.reverse().map((d, i) => ({
          value: d.value,
          itemStyle: {
            color,
            opacity: 0.55 + (i / data.length) * 0.45, // gradient from light to dark
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barMaxWidth: 22,
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          fontFamily: 'system-ui, sans-serif',
          color: '#6b7280',
          fontWeight: 500,
          formatter: (p: { value: number }) => valueFormatter(p.value),
          distance: 6,
        },
      },
    ],
  };
}

interface Props {
  dishes: TopItem[];
  ingredients: TopItem[];
  isPending: boolean;
}

export function TopItems({ dishes, ingredients, isPending }: Props) {
  if (isPending) {
    return (
      <div className="h-48 flex items-center justify-center text-[13px] text-[#37352f]">
        Загрузка…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#37352f]">Выручка по блюдам</h3>
        <span className="text-[11px] text-[#37352f]">сом</span>
      </div>
          <ReactECharts
            option={getBarOption(
              dishes,
              'Выручка',
              '#00B558',
              (v) => `${formatSom(v)} сом`,
              'Заказов',
              (v) => String(v),
            )}
            style={{ height: dishes.length * 28 + 8 }}
            notMerge
          />
    </div>
  );
}
