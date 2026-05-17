import { useState } from 'react';
import pencilIcon from '@/assets/icons/pencil.svg';
import crossIcon from '@/assets/icons/cross.svg';
import searchIcon from '@/assets/icons/search.svg';
import { supabase, VENUE_ID, ORG_ID } from '@/lib/supabase';
import { useStaff, useInvalidateStaff } from '@/hooks/useStaffData';
import type { StaffMember } from '@/hooks/useStaffData';

const ROLES: { value: StaffMember['role']; label: string }[] = [
  { value: 'owner', label: 'Владелец' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'cashier', label: 'Кассир' },
  { value: 'waiter', label: 'Официант' },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  cashier: 'Кассир',
  waiter: 'Официант',
};

const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

/** Same pattern as Menu: grid + subgrid; actions column fits icons */
const STAFF_GRID_TEMPLATE = 'minmax(160px,2fr) minmax(100px,1fr) minmax(160px,2fr) 96px minmax(130px,1.2fr) 80px';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

export function Staff() {
  const {
    data: staff = [],
    isPending,
    isError,
    error: staffError,
  } = useStaff();
  const { invalidate } = useInvalidateStaff();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<StaffMember>>({});
  const [newStaff, setNewStaff] = useState({ name: '', email: '', pin: generatePin(), role: 'cashier' as StaffMember['role'] });


  const filtered = staff
    .filter(s => !roleFilter || s.role === roleFilter)
    .filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
             s.pin.includes(q) ||
             (s.email || '').toLowerCase().includes(q);
    });

  const showEmptyList = !isPending && !isError && filtered.length === 0;

  async function handleAdd() {
    if (!newStaff.name.trim()) return;
    if (staff.some(s => s.pin === newStaff.pin)) {
      alert('Этот PIN уже используется');
      return;
    }

    const { data: user, error: userErr } = await supabase.from('users').insert({
      organization_id: ORG_ID,
      name: newStaff.name.trim(),
      email: newStaff.email.trim() || null,
      pin: newStaff.pin,
      role: newStaff.role,
    }).select('id').single();

    if (userErr) { alert('Ошибка: ' + userErr.message); return; }

    await supabase.from('user_venues').insert({ user_id: user.id, venue_id: VENUE_ID });

    setNewStaff({ name: '', email: '', pin: generatePin(), role: 'cashier' });
    setShowAddForm(false);
    invalidate();
  }

  function startEdit(member: StaffMember) {
    setEditingId(member.id);
    setEditData({ name: member.name, email: member.email, pin: member.pin, role: member.role });
  }

  async function handleSaveEdit() {
    if (!editingId || !editData.name?.trim()) return;
    if (staff.some(s => s.pin === editData.pin && s.id !== editingId)) {
      alert('Этот PIN уже используется');
      return;
    }

    const { error } = await supabase.from('users').update({
      name: editData.name.trim(),
      email: editData.email?.trim() || null,
      pin: editData.pin,
      role: editData.role,
    }).eq('id', editingId);

    if (error) { alert('Ошибка: ' + error.message); return; }
    setEditingId(null);
    setEditData({});
    invalidate();
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить сотрудника?')) return;
    await supabase.from('user_venues').delete().eq('user_id', id).eq('venue_id', VENUE_ID);
    await supabase.from('users').delete().eq('id', id);
    invalidate();
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Сотрудники</h2>

      {/* Role filter tabs */}
      <div className="flex items-center gap-1 mb-6">
        <button
          onClick={() => setRoleFilter(null)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            roleFilter === null ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'
          }`}
        >
          Все
        </button>
        {ROLES.map(r => (
          <button
            key={r.value}
            onClick={() => setRoleFilter(r.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              roleFilter === r.value ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-[#EFF0F4]'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 w-56">
          <img src={searchIcon} className="w-4 h-4 opacity-40" />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Поиск по имени, email, PIN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="flex gap-3 items-end py-3 border-b">
          <div className="flex-1">
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newStaff.name}
              onChange={(e) => setNewStaff(p => ({ ...p, name: e.target.value }))}
              placeholder="Имя сотрудника"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-48">
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newStaff.email}
              onChange={(e) => setNewStaff(p => ({ ...p, email: e.target.value }))}
              placeholder="Email"
            />
          </div>
          <div className="w-28">
            <input
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
              value={newStaff.pin}
              onChange={(e) => setNewStaff(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="PIN"
              maxLength={4}
            />
          </div>
          <div className="w-36">
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={newStaff.role}
              onChange={(e) => setNewStaff(p => ({ ...p, role: e.target.value as StaffMember['role'] }))}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button onClick={handleAdd} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Сохранить</button>
          <button onClick={() => { setShowAddForm(false); setNewStaff({ name: '', email: '', pin: generatePin(), role: 'cashier' }); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Отмена</button>
        </div>
      )}

      <div
        className="-mx-3 w-fit"
        style={{ display: 'grid', gridTemplateColumns: STAFF_GRID_TEMPLATE }}
      >
        <div className="col-span-6 grid grid-cols-subgrid items-center pt-4 pb-2 px-3 text-sm font-semibold text-muted-foreground sticky top-0 z-10 bg-white">
          <div className="pr-6 min-w-0">Имя</div>
          <div className="pr-6 min-w-0">Должность</div>
          <div className="pr-6 min-w-0">Email</div>
          <div className="pr-6 text-center">PIN</div>
          <div className="pr-6 text-center">Последний вход</div>
          <div />
        </div>

        <div className="col-span-6 grid grid-cols-subgrid">
          {isPending && (
            <div className="col-span-6 py-12 text-center text-sm text-muted-foreground">
              Загрузка…
            </div>
          )}
          {isError && (
            <div className="col-span-6 py-12 text-center text-sm text-destructive">
              {staffError instanceof Error ? staffError.message : 'Не удалось загрузить'}
            </div>
          )}
          {!isPending && !isError && filtered.map((member) => (
            <div
              key={member.id}
              className={`col-span-6 grid grid-cols-subgrid group hover:bg-[#EFF0F4] even:bg-muted/10 transition-colors ${!member.is_active ? 'opacity-50' : ''}`}
            >
              {editingId === member.id ? (
                <div className="grid grid-cols-subgrid col-span-6 items-center gap-y-1 py-2 px-3">
                  <div className="min-w-0 pr-6">
                    <input
                      className="w-full px-2 py-1 border rounded text-sm bg-background"
                      value={editData.name || ''}
                      onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                  </div>
                  <div className="min-w-0 pr-6">
                    <select
                      className="w-full px-2 py-1 border rounded text-sm bg-background"
                      value={editData.role || 'cashier'}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, role: e.target.value as StaffMember['role'] }))
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 pr-6">
                    <input
                      className="w-full px-2 py-1 border rounded text-sm bg-background"
                      value={editData.email || ''}
                      onChange={(e) => setEditData((d) => ({ ...d, email: e.target.value }))}
                      placeholder="Email"
                    />
                  </div>
                  <div className="pr-6 flex justify-center">
                    <input
                      className="w-full max-w-[5.5rem] px-2 py-1 border rounded text-sm bg-background font-mono text-center"
                      value={editData.pin || ''}
                      onChange={(e) =>
                        setEditData((d) => ({
                          ...d,
                          pin: e.target.value.replace(/\D/g, '').slice(0, 4),
                        }))
                      }
                      maxLength={4}
                    />
                  </div>
                  <div className="pr-6" />
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="text-sm text-green-600 font-semibold px-2 py-1"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditData({});
                      }}
                      className="text-sm text-muted-foreground px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-subgrid col-span-6 items-center py-2 px-3">
                  <div className="min-w-0 text-sm font-semibold truncate pr-6">{member.name}</div>
                  <div className="min-w-0 text-sm text-muted-foreground pr-6">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </div>
                  <div className="min-w-0 text-sm text-muted-foreground truncate pr-6">
                    {member.email || '—'}
                  </div>
                  <div className="text-sm text-center font-mono pr-6 flex justify-center">
                    <span
                      className="px-2 py-0.5 rounded select-none cursor-default"
                      style={{ filter: 'blur(7px)', transition: '0.1s' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.filter = 'blur(0)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.filter = 'blur(7px)';
                      }}
                    >
                      {member.pin}
                    </span>
                  </div>
                  <div className="text-sm text-center text-muted-foreground pr-6 tabular-nums">
                    {formatDate(member.last_session_at)}
                  </div>
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => startEdit(member)}
                      className="opacity-40 hover:opacity-100 transition-opacity p-1"
                    >
                      <img src={pencilIcon} className="w-4 h-4" alt="" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id)}
                      className="opacity-40 hover:opacity-100 transition-opacity p-1"
                    >
                      <img src={crossIcon} className="w-5 h-5" alt="" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {showEmptyList && (
            <div className="col-span-6 py-12 text-center text-sm text-muted-foreground">
              {search.trim() || roleFilter ? 'Ничего не найдено' : 'Нет сотрудников'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
