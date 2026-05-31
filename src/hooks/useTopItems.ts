import { useQuery } from '@tanstack/react-query';
import { VENUE_ID } from '@/lib/supabase';

export interface TopItem {
  name: string;
  value: number;     // revenue for dishes, consumption for ingredients
  secondary: number;  // order count for dishes, stock remaining for ingredients
}

const MOCK_DISHES: TopItem[] = [
  { name: 'Капучино',         value: 68_400, secondary: 182 },
  { name: 'Латте',            value: 62_100, secondary: 165 },
  { name: 'Американо',        value: 48_200, secondary: 148 },
  { name: 'Раф',              value: 44_800, secondary: 98  },
  { name: 'Эспрессо',         value: 32_500, secondary: 142 },
  { name: 'Круассан',         value: 28_300, secondary: 89  },
  { name: 'Флэт Уайт',        value: 25_600, secondary: 72  },
  { name: 'Сэндвич с курицей', value: 22_100, secondary: 54  },
  { name: 'Мокачино',         value: 18_900, secondary: 48  },
  { name: 'Чизкейк',          value: 17_400, secondary: 42  },
  { name: 'Какао',            value: 12_800, secondary: 36  },
  { name: 'Брауни',           value: 10_500, secondary: 30  },
];

const MOCK_INGREDIENTS: TopItem[] = [
  { name: 'Молоко 3.2%',      value: 380, secondary: 45  },
  { name: 'Кофе в зёрнах',    value: 340, secondary: 12  },
  { name: 'Сливки 33%',       value: 180, secondary: 8   },
  { name: 'Сахар',            value: 160, secondary: 25  },
  { name: 'Мука пшеничная',   value: 95,  secondary: 40  },
  { name: 'Сироп карамельный', value: 72,  secondary: 5   },
  { name: 'Яйца',             value: 68,  secondary: 120 },
  { name: 'Масло сливочное',  value: 55,  secondary: 3   },
  { name: 'Шоколад тёмный',   value: 42,  secondary: 6   },
  { name: 'Сироп ванильный',  value: 38,  secondary: 4   },
];

export function useTopItems() {
  return useQuery({
    queryKey: ['top_items', VENUE_ID],
    queryFn: () => ({ dishes: MOCK_DISHES, ingredients: MOCK_INGREDIENTS }),
    staleTime: 5 * 60 * 1000,
  });
}
