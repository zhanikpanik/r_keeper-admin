import { useState } from 'react';
import { toast } from 'sonner';
import { supabase, VENUE_ID, ORG_ID } from '@/lib/supabase';
import { useStaff, useInvalidateStaff } from '@/hooks/useStaffData';
import type { StaffMember } from '@/hooks/useStaffData';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { EditButton } from '@/components/ui/EditButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { AddButton } from '@/components/ui/ActionButtons';

const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

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

function formatDate(dateStr: string | null): string {
 if (!dateStr) return '—';
 const d = new Date(dateStr);
 return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) +
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
   toast.error('Этот PIN уже используется');
   return;
  }

  const { data: user, error: userErr } = await supabase.from('users').insert({
   organization_id: ORG_ID,
   name: newStaff.name.trim(),
   email: newStaff.email.trim() || null,
   pin: newStaff.pin,
   role: newStaff.role,
  }).select('id').single();

  if (userErr) { toast.error('Ошибка: ' + userErr.message); return; }

  const { error: uvError } = await supabase.from('user_venues').insert({ user_id: user.id, venue_id: VENUE_ID });
  if (uvError) {
    toast.error('Сотрудник создан, но не привязан к точке: ' + uvError.message);
    await supabase.from('users').delete().eq('id', user.id);
    return;
  }

  setNewStaff({ name: '', email: '', pin: generatePin(), role: 'cashier' });
  setShowAddForm(false);
  invalidate();
  toast.success('Сотрудник добавлен');
 }

 function startEdit(member: StaffMember) {
  setEditingId(member.id);
  setEditData({ name: member.name, email: member.email, pin: member.pin, role: member.role });
 }

 async function handleSaveEdit() {
  if (!editingId || !editData.name?.trim()) return;
  if (staff.some(s => s.pin === editData.pin && s.id !== editingId)) {
   toast.error('Этот PIN уже используется');
   return;
  }

  const { error } = await supabase.from('users').update({
   name: editData.name.trim(),
   email: editData.email?.trim() || null,
   pin: editData.pin,
   role: editData.role,
  }).eq('id', editingId);

  if (error) { toast.error('Ошибка: ' + error.message); return; }
  setEditingId(null);
  setEditData({});
  invalidate();
 }

 async function handleDelete(id: string) {
  await supabase.from('user_venues').delete().eq('user_id', id).eq('venue_id', VENUE_ID);
  await supabase.from('users').delete().eq('id', id);
  invalidate();
  toast.success('Сотрудник удалён');
 }

 return (
  <div className="p-8">
   <div className="flex items-center justify-between mb-6">
    <h2 className="text-2xl font-bold">Сотрудники</h2>
    <AddButton onClick={() => setShowAddForm(true)} label="Добавить сотрудника" />
   </div>

   {/* Search + role filter */}
   <div className="flex items-center gap-2 mb-4">
    <SearchInput value={search} onChange={setSearch} placeholder="Поиск по имени, эл. почте, PIN" className="w-56" />
    <div className="inline-flex rounded-lg bg-[#F2F2F7] p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
     <button
      onClick={() => setRoleFilter(null)}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
       roleFilter === null ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
     >
      Все
     </button>
     {ROLES.map(r => (
      <button
       key={r.value}
       onClick={() => setRoleFilter(r.value)}
       className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
        roleFilter === r.value ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
       }`}
      >
       {r.label}
      </button>
     ))}
    </div>
   </div>

   {/* Add form */}
   {showAddForm && (
    <div className="flex gap-3 items-end py-3 border-b">
     <div className="flex-1">
      <input
       className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
       value={newStaff.name}
       onChange={(e) => setNewStaff(p => ({ ...p, name: e.target.value }))}
       placeholder="Имя сотрудника"
       autoFocus
       onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
     </div>
     <div className="w-48">
      <input
       className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
       value={newStaff.email}
       onChange={(e) => setNewStaff(p => ({ ...p, email: e.target.value }))}
       placeholder="Эл. почта"
      />
     </div>
     <div className="w-28">
      <input
       className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono"
       value={newStaff.pin}
       onChange={(e) => setNewStaff(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
       placeholder="PIN"
       maxLength={4}
      />
     </div>
     <div className="w-36">
      <select
       className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
       value={newStaff.role}
       onChange={(e) => setNewStaff(p => ({ ...p, role: e.target.value as StaffMember['role'] }))}
      >
       {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
     </div>
     <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer font-medium">Добавить</button>
     <button onClick={() => { setShowAddForm(false); setNewStaff({ name: '', email: '', pin: generatePin(), role: 'cashier' }); }} className="px-4 py-2 text-sm hover:text-foreground">Закрыть</button>
    </div>
   )}

   <div className="max-w-4xl">
   <table className="table-fixed border-separate border-spacing-0 w-full">
    <thead className="sticky top-0 z-10 bg-background">
     <tr className="text-sm font-medium text-foreground">
      <th scope="col" className="text-left py-1.5 w-[180px]">Имя</th>
      <th scope="col" className="text-left py-1.5 w-[120px]">Должность</th>
      <th scope="col" className="text-left py-1.5 w-[180px]">Эл. почта</th>
      <th scope="col" className="text-center py-1.5 w-[96px]">PIN</th>
      <th scope="col" className="text-center py-1.5 w-[140px]">Последний вход</th>
      <th scope="col" className="py-1.5 w-[56px]" />
      <th scope="col" className="py-1.5 w-[56px] pr-3" />
     </tr>
    </thead>
    <tbody>
     {isPending && (
      <tr><td colSpan={7} className="py-16 text-center text-sm">Загрузка…</td></tr>
     )}
     {isError && (
      <tr><td colSpan={7} className="py-16 text-center text-sm text-destructive">{staffError instanceof Error ? staffError.message : 'Не удалось загрузить'}</td></tr>
     )}
     {!isPending && !isError && filtered.map((member) => (
      <tr
       key={member.id}
       className={`group row-hover ${!member.is_active ? 'opacity-50' : ''}`}
      >
       {editingId === member.id ? (
        <>
         <td className="py-1.5">
          <input className="w-full px-2 py-1 border rounded text-sm bg-background" value={editData.name || ''} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
         </td>
         <td className="py-1.5">
          <select className="w-full px-2 py-1 border rounded text-sm bg-background" value={editData.role || 'cashier'} onChange={(e) => setEditData((d) => ({ ...d, role: e.target.value as StaffMember['role'] }))}>
           {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
         </td>
         <td className="py-1.5">
          <input className="w-full px-2 py-1 border rounded text-sm bg-background" value={editData.email || ''} onChange={(e) => setEditData((d) => ({ ...d, email: e.target.value }))} placeholder="Эл. почта" />
         </td>
         <td className="py-1.5 text-center">
          <input className="w-full max-w-[5.5rem] px-2 py-1 border rounded text-sm bg-background font-mono text-center" value={editData.pin || ''} onChange={(e) => setEditData((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} maxLength={4} />
         </td>
         <td className="py-1.5" />
         <td className="py-1.5">
          <div className="flex justify-end gap-1">
           <button type="button" onClick={handleSaveEdit} className="text-sm text-green-600 font-medium px-2 py-1">✓</button>
           <button type="button" onClick={() => { setEditingId(null); setEditData({}); }} className="text-sm px-2 py-1">✕</button>
          </div>
         </td>
         <td className="py-1.5" />
        </>
       ) : (
        <>
         <td className="py-1.5 text-sm truncate">{member.name}</td>
         <td className="py-1.5 text-sm whitespace-nowrap">{ROLE_LABELS[member.role] ?? member.role}</td>
         <td className="py-1.5 text-sm truncate">{member.email || '—'}</td>
         <td className="py-1.5 text-center font-mono text-sm">
          <span className="px-2 py-0.5 rounded select-none cursor-default" style={{ filter: 'blur(7px)', transition: '0.1s' }} onMouseEnter={(e) => { e.currentTarget.style.filter = 'blur(0)'; }} onMouseLeave={(e) => { e.currentTarget.style.filter = 'blur(7px)'; }}>{member.pin}</span>
         </td>
         <td className="py-1.5 text-center text-sm tabular-nums whitespace-nowrap">{formatDate(member.last_session_at)}</td>
         <td className="py-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
          <EditButton onClick={() => startEdit(member)} />
         </td>
         <td className="py-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
          <DeleteButton variant="row" onClick={() => handleDelete(member.id)} />
         </td>
        </>
       )}
      </tr>
     ))}
     {showEmptyList && (
      <tr><td colSpan={7}>
       <EmptyState
        title={search.trim() || roleFilter ? 'Ничего не найдено' : 'Сотрудников пока нет'}
        hint={search.trim() || roleFilter ? 'Попробуйте изменить фильтры' : 'Добавьте сотрудников, чтобы они могли работать с POS-терминалом'}
        action={!search.trim() && !roleFilter ? { label: 'Добавить сотрудника', onClick: () => setShowAddForm(true) } : undefined}
       />
      </td></tr>
     )}
    </tbody>
   </table>
   </div>
  </div>
 );
}
