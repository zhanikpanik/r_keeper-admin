import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/shadcn/button';

const actions = [
  { label: 'Расход', href: '/transactions' },
  { label: 'Списание', href: '/warehouse/write-offs' },
  { label: 'Поставка', href: '/warehouse/deliveries' },
];

export function ActionBar() {
  return (
    <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center gap-3">
      {actions.map((a) => (
        <Link key={a.href} to={a.href}>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4" />
            {a.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
