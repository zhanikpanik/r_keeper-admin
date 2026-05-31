import { Link } from 'react-router-dom';

interface StockAlert {
  name: string;
  quantity: number;
  unit: string;
}

interface PendingDelivery {
  id: string;
  supplier: string;
  date: string;
}

interface Props {
  stockAlerts: StockAlert[];
  deliveries: PendingDelivery[];
  isPending: boolean;
}

export function OperationsPanel({ stockAlerts, deliveries, isPending }: Props) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[#37352f] mb-3">Операционка</h3>
      <div className="grid grid-cols-2 gap-6">
        {/* Low stock */}
        <div>
          <p className="text-[11px] font-medium text-[#37352f] mb-2">Заканчивается</p>
          {isPending ? (
            <p className="text-[13px] text-[#37352f]">…</p>
          ) : stockAlerts.length === 0 ? (
            <p className="text-[13px] text-[#37352f]">Всё в норме</p>
          ) : (
            <div className="space-y-1">
              {stockAlerts.slice(0, 4).map((item) => (
                <div key={item.name} className="flex justify-between text-[13px]">
                  <span className="text-[#37352f] truncate">{item.name}</span>
                  <span className="text-[#E53935] font-medium shrink-0 ml-2">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending deliveries */}
        <div>
          <p className="text-[11px] font-medium text-[#37352f] mb-2">Ожидается сегодня</p>
          {isPending ? (
            <p className="text-[13px] text-[#37352f]">…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-[13px] text-[#37352f]">Нет поставок</p>
          ) : (
            <div className="space-y-1">
              {deliveries.slice(0, 3).map((d) => (
                <Link
                  key={d.id}
                  to={`/warehouse/deliveries`}
                  className="block text-[13px] text-[#37352f] hover:text-[#00B558] transition-colors"
                >
                  {d.supplier} — {d.date}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <Link
          to="/transactions"
          className="text-[13px] px-3 py-1.5 rounded-md border border-[#F0EFED] text-[#37352f] hover:bg-[#F9F8F7] transition-colors"
        >
          + Расход
        </Link>
        <Link
          to="/warehouse/write-offs"
          className="text-[13px] px-3 py-1.5 rounded-md border border-[#F0EFED] text-[#37352f] hover:bg-[#F9F8F7] transition-colors"
        >
          + Списание
        </Link>
      </div>
    </div>
  );
}
