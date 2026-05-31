import { useQuery } from '@tanstack/react-query';
import { VENUE_ID } from '@/lib/supabase';

export interface WeekSlice {
  label: string;          // '28 апр – 4 мая'
  days: {
    dayOfWeek: string;    // 'пн'..'вс'
    date: string;         // '2026-04-28'
    revenue: number;
    expenses: number;
  }[];
  totalRevenue: number;
  totalExpenses: number;
}

function seededRandom(seed: number): number {
  const s = (seed * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

function generateMockWeekly(): WeekSlice[] {
  const dayNames = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const weeks: WeekSlice[] = [];

  // 4 weeks: last week of April + first 3 of May
  const weekStarts = [
    { label: '28 апр – 4 мая', baseDate: '2026-04-28', isCurrent: false, growth: 1.0 },
    { label: '5 – 11 мая',      baseDate: '2026-05-05', isCurrent: false, growth: 1.08 },
    { label: '12 – 18 мая',     baseDate: '2026-05-12', isCurrent: false, growth: 1.14 },
    { label: '19 – 25 мая',     baseDate: '2026-05-19', isCurrent: true,  growth: 1.20 },
  ];

  // Weekly pattern: revenue by weekday (сом)
  const dayBase: Record<string, number> = {
    'пн': 14500, 'вт': 15000, 'ср': 16000, 'чт': 15500,
    'пт': 24000, 'сб': 32000, 'вс': 21000,
  };

  for (const ws of weekStarts) {
    const start = new Date(ws.baseDate);
    const days: WeekSlice['days'] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      const dow = d.getDay(); // 0=Sun
      const dayLabel = dayNames[dow === 0 ? 6 : dow - 1]; // Adjust: Mon=0...Sun=6

      const seed = (d.getFullYear() * 10000) + ((d.getMonth() + 1) * 100) + d.getDate();
      const rand = (offset: number) => seededRandom(seed + offset * 31);

      const base = dayBase[dayLabel] ?? 16000;
      const noise = 0.85 + rand(0) * 0.3;
      // Holidays: May 1 (Fri, in week 0 or 1), May 9 (Sat, in week 1)
      const isHoliday =
        (dateKey === '2026-05-01' || dateKey === '2026-05-09');
      const holidayMul = isHoliday ? 1.25 : 1.0;

      const revenue = Math.round(base * ws.growth * noise * holidayMul);
      const expenseRatio = 0.25 + rand(1) * 0.18;
      const expenses = Math.round(revenue * expenseRatio);

      totalRevenue += revenue;
      totalExpenses += expenses;

      days.push({
        dayOfWeek: dayLabel,
        date: dateKey,
        revenue,
        expenses,
      });
    }

    weeks.push({
      label: ws.label,
      days,
      totalRevenue,
      totalExpenses,
    });
  }

  return weeks;
}

export function useWeeklyStats() {
  return useQuery({
    queryKey: ['weekly_stats', VENUE_ID],
    queryFn: () => generateMockWeekly(),
    staleTime: 5 * 60 * 1000,
  });
}
