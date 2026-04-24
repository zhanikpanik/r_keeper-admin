import React, { useState } from 'react';
import { Printer, MessageCircle, ChevronDown, Plus } from 'lucide-react';

interface CashShift {
  id: number;
  openTime: string;
  closeTime: string | null;
  startBalance: number;
  collection: number | null;
  expectedCash: number | null;
  difference: number | null;
  hasWarning?: boolean; // For the red dot on start balance seen in screenshot
  hasComment?: boolean; // For the comment icon
}

const mockShifts: CashShift[] = [
  {
    id: 572,
    openTime: '11 апреля, 09:17',
    closeTime: null,
    startBalance: 3150,
    collection: null,
    expectedCash: null,
    difference: null,
  },
  {
    id: 571,
    openTime: '10 апреля, 09:17',
    closeTime: '10 апреля, 23:10',
    startBalance: 120,
    collection: null,
    expectedCash: 3150,
    difference: null,
  },
  {
    id: 570,
    openTime: '9 апреля, 09:11',
    closeTime: '9 апреля, 23:06',
    startBalance: 5120,
    collection: null,
    expectedCash: 120,
    difference: null,
  },
  {
    id: 569,
    openTime: '8 апреля, 09:08',
    closeTime: '8 апреля, 22:45',
    startBalance: 4580,
    collection: null,
    expectedCash: 5120,
    difference: null,
    hasWarning: true,
  },
  {
    id: 568,
    openTime: '8 апреля, 01:29',
    closeTime: '8 апреля, 01:32',
    startBalance: 1,
    collection: null,
    expectedCash: 1,
    difference: null,
    hasWarning: true,
  },
  {
    id: 567,
    openTime: '7 апреля, 09:01',
    closeTime: '7 апреля, 23:45',
    startBalance: 1603,
    collection: null,
    expectedCash: 4580,
    difference: 87,
    hasComment: true,
  },
  {
    id: 566,
    openTime: '6 апреля, 10:05',
    closeTime: '6 апреля, 23:10',
    startBalance: 3609,
    collection: null,
    expectedCash: 1603,
    difference: -6,
    hasWarning: true,
    hasComment: true,
  },
  {
    id: 565,
    openTime: '5 апреля, 08:56',
    closeTime: '5 апреля, 23:09',
    startBalance: 20263,
    collection: null,
    expectedCash: 3603,
    difference: null,
  },
  {
    id: 564,
    openTime: '4 апреля, 09:08',
    closeTime: '4 апреля, 23:38',
    startBalance: 19893,
    collection: null,
    expectedCash: 20263,
    difference: null,
  },
  {
    id: 563,
    openTime: '3 апреля, 09:28',
    closeTime: '3 апреля, 22:58',
    startBalance: 19423,
    collection: null,
    expectedCash: 19893,
    difference: null,
  },
  {
    id: 562,
    openTime: '2 апреля, 09:08',
    closeTime: '2 апреля, 22:47',
    startBalance: 33968,
    collection: null,
    expectedCash: 19423,
    difference: null,
  },
  {
    id: 561,
    openTime: '1 апреля, 12:00',
    closeTime: '1 апреля, 22:46',
    startBalance: 32930,
    collection: null,
    expectedCash: 33968,
    difference: null,
  },
  {
    id: 560,
    openTime: '31 марта, 09:09',
    closeTime: '31 марта, 22:33',
    startBalance: 6100,
    collection: null,
    expectedCash: 32930,
    difference: 21584,
  },
];

function formatCurrency(amount: number | null) {
  if (amount === null) return '';
  const formatted = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} с`;
}

export function CashShifts() {
  const [shifts] = useState<CashShift[]>(mockShifts);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  function getIngredientPlural(count: number) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return 'ингредиентов';
    if (n1 > 1 && n1 < 5) return 'ингредиента';
    if (n1 === 1) return 'ингредиент';
    return 'ингредиентов';
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Кассовые смены</h2>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-[#5D4FF1] font-medium hover:bg-secondary/50 transition-colors">
            <Printer className="w-4 h-4" />
            Распечатать
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-[#5D4FF1] font-medium hover:bg-secondary/50 transition-colors">
            12 марта — 12 апреля
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-fit -mx-3">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-10 text-sm font-semibold text-muted-foreground">
            <tr>
              <th className="w-[300px] font-semibold pt-4 pb-2 px-3 pr-4 align-bottom">Смена</th>
              <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">Начало</th>
              <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">В кассе</th>
              <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">Разница</th>
              <th className="w-[120px] font-semibold pt-4 pb-2 px-3 pr-4 text-right align-bottom">Инкассация</th>
              <th className="w-10 pt-4 pb-2 px-3 align-bottom"></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => {
              let bgColorClass = 'even:bg-muted/10 hover:bg-[#EFF0F4]';
              if (!shift.closeTime) {
                bgColorClass = 'bg-[#FDF6E3] hover:bg-[#F9EED4]';
              } else if (shift.difference && shift.difference !== 0) {
                bgColorClass = 'bg-[#FCE8E8] hover:bg-[#FAD5D5]';
              }

              const isExpanded = expandedId === shift.id;
              if (isExpanded) {
                bgColorClass = 'bg-[#FAFAFA]';
              }

              return (
                <React.Fragment key={shift.id}>
                  <tr 
                    className={`group transition-colors cursor-pointer ${bgColorClass}`}
                    onClick={() => toggleExpand(shift.id)}
                  >
                    <td className="px-3 py-1.5 pr-4 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-sm">{shift.openTime}</span>
                        <span className="text-muted-foreground opacity-30">—</span>
                        <span className="text-muted-foreground truncate text-sm">{shift.closeTime || 'Не закрыта'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums">
                      <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                        {formatCurrency(shift.startBalance)}
                        {shift.hasWarning && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums text-sm font-medium">
                      {formatCurrency(shift.expectedCash)}
                    </td>
                    <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums text-sm text-muted-foreground">
                      {formatCurrency(shift.difference)}
                    </td>
                    <td className="px-3 py-1.5 pr-4 text-right align-middle tabular-nums text-sm text-muted-foreground">
                      {formatCurrency(shift.collection)}
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <div className="flex justify-end">
                        {shift.hasComment && (
                          <MessageCircle className="w-4 h-4 text-muted-foreground opacity-50" />
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-[#FAFAFA]">
                      <td colSpan={6} className="p-0">
                        <div className="pl-3 pr-3 py-6 border-t border-b border-muted/20">
                          {/* Summary Grid */}
                          <div className="mb-8">
                            <div className="grid grid-cols-3 gap-8 mb-4 max-w-[600px]">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Баланс:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(3150)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Фактически:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(3150)}</span>
                              </div>
                              <div></div>
                            </div>

                            <div className="grid grid-cols-3 gap-8 mb-4 max-w-[600px]">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Наличка:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(3030)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Безнал:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(21680)}</span>
                              </div>
                              <div></div>
                            </div>

                            <div className="grid grid-cols-3 gap-8 max-w-[600px]">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Приход:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(0)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Расход:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(0)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Инкассация:</span>
                                <span className="text-sm font-medium tabular-nums">{formatCurrency(0)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Transactions Table */}
                          <div className="max-w-[800px]">
                            <button className="flex items-center gap-1 text-[#5D4FF1] hover:text-[#F70000] text-sm font-medium mb-3 transition-colors">
                              <Plus className="w-4 h-4" /> Добавить транзакцию
                            </button>
                            
                            <div className="overflow-hidden">
                              <div className="flex items-center px-4 py-2 text-[12px] font-semibold text-muted-foreground bg-muted/5">
                                <div className="w-[180px] shrink-0">Категория</div>
                                <div className="w-[160px] shrink-0">Время</div>
                                <div className="w-[120px] shrink-0 text-right">Сумма</div>
                                <div className="w-[140px] shrink-0 px-4">Сотрудник</div>
                                <div className="flex-1"></div>
                                <div className="w-[60px] shrink-0 text-right"></div>
                              </div>
                              
                              <div className="">
                                <div className="flex items-center px-4 py-2 text-sm hover:bg-muted/5 transition-colors">
                                  <div className="w-[180px] shrink-0">Закрытие смены</div>
                                  <div className="w-[160px] shrink-0 text-muted-foreground">10 апр, 23:10</div>
                                  <div className="w-[120px] shrink-0 text-right tabular-nums">{formatCurrency(3150)}</div>
                                  <div className="w-[140px] shrink-0 px-4 text-muted-foreground">Калмаматов Р.</div>
                                  <div className="flex-1 text-muted-foreground">—</div>
                                  <div className="w-[60px] shrink-0 text-right">
                                    <button className="text-[#5D4FF1] hover:text-[#F70000] text-[13px] font-medium transition-colors">Ред.</button>
                                  </div>
                                </div>
                                <div className="flex items-center px-4 py-2 text-sm hover:bg-muted/5 transition-colors">
                                  <div className="w-[180px] shrink-0">Открытие смены</div>
                                  <div className="w-[160px] shrink-0 text-muted-foreground">10 апр, 09:17</div>
                                  <div className="w-[120px] shrink-0 text-right tabular-nums">{formatCurrency(120)}</div>
                                  <div className="w-[140px] shrink-0 px-4 text-muted-foreground">Калмаматов Р.</div>
                                  <div className="flex-1 text-muted-foreground">—</div>
                                  <div className="w-[60px] shrink-0 text-right">
                                    <button className="text-[#5D4FF1] hover:text-[#F70000] text-[13px] font-medium transition-colors">Ред.</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
