import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Warehouse,
  Users,
  MapPin,
  Settings,
  FileUp,
  ChevronDown,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  children?: { to: string; label: string }[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/cash-shifts', label: 'Кассовые смены', icon: Wallet },
  {
    to: '/menu', label: 'Меню', icon: UtensilsCrossed,
    children: [
      { to: '/menu', label: 'Блюда и категории' },
      { to: '/menu/ingredients', label: 'Ингредиенты' },
    ],
  },
  { to: '/staff', label: 'Сотрудники', icon: Users },
  { to: '/floor-plan', label: 'Схема зала', icon: MapPin },
  {
    to: '/warehouse', label: 'Склад', icon: Warehouse,
    children: [
      { to: '/warehouse/deliveries', label: 'Поставки' },
      { to: '/warehouse/write-offs', label: 'Списания' },
      { to: '/warehouse/inventory', label: 'Инвентаризация' },
    ],
  },
  { to: '/import', label: 'Импорт', icon: FileUp },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

export function Layout() {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/menu']);

  const toggleExpand = (to: string) => {
    setExpandedMenus((prev) =>
      prev.includes(to) ? prev.filter((t) => t !== to) : [...prev, to]
    );
  };

  const isChildActive = (item: NavItem) => {
    return item.children?.some((child) =>
      child.to === item.to
        ? location.pathname === item.to
        : location.pathname.startsWith(child.to)
    );
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">r_keeper</h1>
          <p className="text-sm text-muted-foreground">Панель управления</p>
        </div>

        <nav className="flex-1 px-3">
          {navItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedMenus.includes(item.to);
              const isActive = isChildActive(item);

              return (
                <div key={item.to}>
                  <button
                    onClick={() => toggleExpand(item.to)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors w-full',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="ml-7 mb-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.to === '/menu'}
                          className={({ isActive }) =>
                            cn(
                              'block px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground">Alto Coffee Bishkek</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
