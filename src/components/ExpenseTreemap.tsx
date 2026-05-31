import { useCallback, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ExpenseCategory } from '@/hooks/useExpenseCategories';

function formatSom(n: number): string {
  return n.toLocaleString('ru-RU');
}

interface Props {
  categories: ExpenseCategory[];
  isPending: boolean;
}

export function ExpenseTreemap({ categories, isPending }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleClick = useCallback((params: { name: string }) => {
    const cat = categories.find((c) => c.name === params.name);
    if (cat?.children?.length) {
      setExpanded(expanded === params.name ? null : params.name);
    }
  }, [categories, expanded]);

  if (isPending) {
    return (
      <div className="h-48 flex items-center justify-center text-[13px] text-[#37352f]">
        Загрузка категорий…
      </div>
    );
  }

  // Build bar data: top-level, plus expanded sub-categories
  const bars: { name: string; value: number; color: string; depth: number; parent: string | null }[] = [];
  for (const cat of categories) {
    bars.push({ name: cat.name, value: cat.amount, color: cat.color, depth: 0, parent: null });
    if (expanded === cat.name && cat.children) {
      for (const sub of cat.children) {
        bars.push({ name: sub.name, value: sub.amount, color: sub.color, depth: 1, parent: cat.name });
      }
    }
  }

  const total = categories.reduce((s, c) => s + c.amount, 0);
  const yData = bars.map((b) => b.name);
  const xData = bars.map((b) => b.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1e293b', fontSize: 13, fontFamily: 'system-ui, sans-serif' },
      formatter: (params: { name: string; value: number; color: string }[]) => {
        const p = params[0];
        if (!p) return '';
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
        return `
          <div style="font-weight:600;margin-bottom:4px">${p.name}</div>
          <div>${formatSom(p.value)} сом · ${pct}%</div>
        `;
      },
    },
    grid: {
      top: 8,
      right: 16,
      bottom: 8,
      left: 120,
    },
    xAxis: {
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
    yAxis: {
      type: 'category',
      data: yData,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#1e293b',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 500,
        margin: 10,
        formatter: (name: string) => {
          const bar = bars.find((b) => b.name === name);
          if (bar?.depth === 1) return `  ↳ ${name}`;
          return name;
        },
      },
    },
    series: [
      {
        type: 'bar',
        data: xData.map((v, i) => {
          // Single amber color, darker = larger amount
          const opacity = 0.4 + (i / Math.max(xData.length - 1, 1)) * 0.6;
          return {
            value: v,
            itemStyle: {
              color: `rgba(217, 119, 6, ${opacity.toFixed(2)})`,
              borderRadius: bars[i].depth === 0 ? [0, 6, 6, 0] : [0, 4, 4, 0],
            },
          };
        }),
        barMaxWidth: 18,
        emphasis: {
          itemStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(0,0,0,0.1)',
          },
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          fontFamily: 'system-ui, sans-serif',
          color: '#37352f',
          formatter: (params: { value: number }) => formatSom(params.value),
        },
      },
    ],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#37352f]">
          Расходы по категориям
        </h3>
        <span className="text-[13px] text-[#37352f]">
          всего {formatSom(total)} сом
        </span>
      </div>

      <ReactECharts
        option={option}
        style={{ height: Math.max(220, bars.length * 30 + 20) }}
        onEvents={{ click: handleClick }}
        notMerge
      />

      <p className="text-[11px] text-[#37352f] mt-1">
        Нажмите на категорию, чтобы увидеть подкатегории
      </p>
    </div>
  );
}
