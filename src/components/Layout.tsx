import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { REQUIRE_AUTH } from '@/lib/supabase';
import { useAuth } from '@/auth/useAuth';
import { useWarehouses } from '@/hooks/useMenuData';
import { useCreateWarehouse } from '@/hooks/useWarehouse';
import { toast } from 'sonner';

interface NavItem {
  to: string;
  label: string;
  children?: { to: string; label: string }[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Дашборд' },
  {
    to: '/finances', label: 'Финансы',
    children: [
      { to: '/cash-shifts', label: 'Кассовые смены' },
      { to: '/transactions', label: 'Транзакции' },
      { to: '/checks', label: 'Чеки' },
    ],
  },
  {
    to: '/menu', label: 'Меню',
    children: [
      { to: '/menu', label: 'Блюда и категории' },
      { to: '/menu/ingredients', label: 'Ингредиенты' },
    ],
  },
  { to: '/staff', label: 'Сотрудники' },
  { to: '/floor-plan', label: 'Схема зала' },
  {
    to: '/warehouse', label: 'Склад',
    children: [
      { to: '/warehouse/deliveries', label: 'Поставки' },
      { to: '/warehouse/write-offs', label: 'Списания' },
      { to: '/warehouse/transfers', label: 'Перемещения' },
      { to: '/warehouse/inventory', label: 'Инвентаризация' },
    ],
  },
  { to: '/import', label: 'Импорт' },
  { to: '/settings', label: 'Настройки' },
];

export function Layout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: warehouses = [] } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const path = window.location.pathname;
    const defaults = ['/menu'];
    if (path === '/cash-shifts' || path === '/transactions' || path.startsWith('/checks')) defaults.push('/finances');
    if (path.startsWith('/warehouse')) defaults.push('/warehouse');
    return defaults;
  });

  useEffect(() => {
    if (
      location.pathname === '/cash-shifts' ||
      location.pathname === '/transactions' ||
      location.pathname.startsWith('/checks')
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync submenu to route
      setExpandedMenus((prev) => (prev.includes('/finances') ? prev : [...prev, '/finances']));
    }
  }, [location.pathname]);

  const toggleExpand = (to: string) => {
    setExpandedMenus((prev) =>
      prev.includes(to) ? prev.filter((t) => t !== to) : [...prev, to]
    );
  };

  async function handleCreateWarehouseFromSidebar() {
    const name = window.prompt('Название нового склада')?.trim();
    if (!name) return;
    try {
      const id = await createWarehouse.mutateAsync(name);
      setExpandedMenus((prev) => (prev.includes('/warehouse') ? prev : [...prev, '/warehouse']));
      navigate(`/warehouse/${id}`);
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось создать склад');
    }
  }

  const isChildActive = (item: NavItem) => {
    return item.children?.some((child) =>
      child.to === item.to
        ? location.pathname === item.to
        : location.pathname.startsWith(child.to)
    );
  };

  return (
    <div className="flex h-screen bg-[#fbfbfa]">
      {/* Sidebar — Notion-style */}
      <aside className="w-60 bg-[#F9F8F7] border-r border-[#F0EFED] flex flex-col select-none">
        <div className="px-3 pt-3 pb-2">
          <h1 className="text-sm font-semibold px-2 py-1">r_keeper</h1>
        </div>

        <nav className="flex-1 px-3 space-y-3">
          {navItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedMenus.includes(item.to);
              const isActive = isChildActive(item);

              return (
                <div key={item.to}>
                  <button
                    onClick={() => toggleExpand(item.to)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors w-full',
                      'text-[#9b9a97] hover:bg-[#efefee]',
                      isActive && 'text-[#37352f]'
                    )}
                  >
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {isExpanded && (
                    <div className="mt-0.5">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.to === '/menu'}
                          className={({ isActive }) =>
                            cn(
                              'block px-2 py-1 rounded text-sm transition-colors',
                              isActive
                                ? 'bg-[#efefee] text-[#37352f]'
                                : 'text-[#37352f] hover:bg-[#efefee]'
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                      {item.to === '/warehouse' && (
                        <>
                          {warehouses.map((warehouse) => (
                            <NavLink
                              key={warehouse.id}
                              to={`/warehouse/${warehouse.id}`}
                              className={({ isActive }) =>
                                cn(
                                  'block px-2 py-1 rounded text-sm transition-colors',
                                  isActive
                                    ? 'bg-[#efefee] text-[#37352f]'
                                    : 'text-[#37352f] hover:bg-[#efefee]'
                                )
                              }
                            >
                              {warehouse.name}
                            </NavLink>
                          ))}
                          <button
                            type="button"
                            onClick={handleCreateWarehouseFromSidebar}
                            className="w-full px-2 py-1 rounded text-sm text-[#9b9a97] hover:bg-[#efefee] hover:text-[#37352f] transition-colors text-left"
                          >
                            + Новый склад
                          </button>
                        </>
                      )}
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
                    'block px-2 py-1 rounded text-sm transition-colors',
                    isActive
                      ? 'bg-[#efefee] text-[#37352f]'
                      : 'text-[#37352f] hover:bg-[#efefee]'
                  )
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 text-xs text-[#9b9a97]">
          <p>Alto Coffee Bishkek</p>
          {REQUIRE_AUTH && (
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-1 block hover:text-[#37352f] transition-colors"
            >
              Выйти
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
