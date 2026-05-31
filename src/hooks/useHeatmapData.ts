import { useQuery } from '@tanstack/react-query';
import { VENUE_ID } from '@/lib/supabase';

export interface HourlyBucket {
  dayIndex: number;   // 0=пн … 6=вс
  hour: number;       // 7..23
  orderCount: number;
  revenue: number;
  avgCheck: number;
}

// Seeded PRNG
function seededRandom(seed: number): number {
  const s = (seed * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

function generateMockHeatmap(): HourlyBucket[] {
  const buckets: HourlyBucket[] = [];

  // Base hourly pattern for a coffee shop (relative weights per hour)
  const hourWeights: Record<number, number> = {
    7: 0.2, 8: 0.7, 9: 1.0, 10: 0.8, 11: 0.5,
    12: 0.9, 13: 1.0, 14: 0.6, 15: 0.3, 16: 0.3,
    17: 0.6, 18: 0.7, 19: 0.5, 20: 0.3, 21: 0.15,
    22: 0.08, 23: 0.03,
  };

  // Day multipliers (relative to Wednesday)
  const dayMultipliers: Record<number, number> = {
    0: 0.8,  // пн — quiet start of week
    1: 0.85, // вт
    2: 1.0,  // ср — baseline
    3: 0.95, // чт
    4: 1.4,  // пт — busy evening
    5: 1.7,  // сб — busiest
    6: 1.15, // вс — later start, moderate
  };

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let hour = 7; hour <= 23; hour++) {
      const seed = (dayIdx + 1) * 1000 + hour * 7;
      const rand = (offset: number) => seededRandom(seed + offset * 31);

      const baseOrders = 6; // orders per hour baseline (~37-87/day)
      const weight = hourWeights[hour] ?? 0.1;
      const dayMul = dayMultipliers[dayIdx];

      // Weekend mornings start later
      const morningPenalty = (dayIdx >= 5 && hour < 9) ? 0.4 : 1.0;
      // Friday/Saturday evenings extend later
      const eveningBonus = (dayIdx >= 4 && hour >= 18 && hour <= 21) ? 1.3 : 1.0;

      const expectedOrders = baseOrders * weight * dayMul * morningPenalty * eveningBonus;
      // Add some noise (±25%)
      const noise = 0.75 + rand(0) * 0.5;
      const orderCount = Math.max(0, Math.round(expectedOrders * noise));

      if (orderCount === 0 && hour >= 22) continue; // skip empty late-night cells for cleaner look
      if (orderCount === 0) {
        buckets.push({
          dayIndex: dayIdx,
          hour,
          orderCount: 0,
          revenue: 0,
          avgCheck: 0,
        });
        continue;
      }

      const avgCheck = 350 + Math.round(rand(1) * 150);
      const revenue = orderCount * avgCheck;

      buckets.push({
        dayIndex: dayIdx,
        hour,
        orderCount,
        revenue,
        avgCheck: Math.round(revenue / orderCount),
      });
    }
  }

  return buckets;
}

export function useHeatmapData() {
  return useQuery({
    queryKey: ['heatmap', VENUE_ID],
    queryFn: () => generateMockHeatmap(),
    staleTime: 5 * 60 * 1000,
  });
}
