import { useState } from 'react';
import { ChevronUp, ChevronDown, Merge, Sparkles, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useDishes,
  useInvalidateMenu,
  type CategoryItem,
} from '@/hooks/useMenuData';
import { supabase, VENUE_ID } from '@/lib/supabase';
import { categorizeDishes, type AIGroup } from '@/lib/categorizeAi';
import { EditButton } from '@/components/ui/EditButton';
import { DeleteButton } from '@/components/ui/DeleteButton';

interface CategoryRow extends CategoryItem {
  dishCount: number;
}

export function Categories() {
  const { data: categories = [], isPending: catPending } = useCategories();
  const { data: dishes = [] } = useDishes();
  const { invalidateCategories, invalidateDishes } = useInvalidateMenu();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [reordering, setReordering] = useState(false);

  // AI mode
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGroups, setAiGroups] = useState<AIGroup[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Optimistic local list for instant reorder
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const catsWithCount: CategoryRow[] = categories.map((c) => ({
    ...c,
    dishCount: dishes.filter((d) => d.category_id === c.id).length,
  }));

  // Apply local order if optimistic
  const ordered = localOrder
    ? localOrder.map((id) => catsWithCount.find((c) => c.id === id)!).filter(Boolean)
    : catsWithCount;

  // ─── Create ──────────────────────────────────────────────────────────

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory.mutateAsync({ name });
      setNewName('');
      toast.success('Категория создана');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось создать категорию');
    }
  }

  // ─── Edit ────────────────────────────────────────────────────────────

  function startEdit(cat: CategoryItem) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) return;
    try {
      await updateCategory.mutateAsync({ id: editingId, name: editName.trim() });
      setEditingId(null);
      toast.success('Сохранено');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось переименовать');
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────

  async function handleDelete(cat: CategoryRow) {
    try {
      await deleteCategory.mutateAsync(cat.id);
      toast.success(`«${cat.name}» удалена`);
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось удалить');
    }
  }

  // ─── Reorder (optimistic) ────────────────────────────────────────────

  async function moveUp(cat: CategoryRow) {
    const idx = ordered.findIndex((c) => c.id === cat.id);
    if (idx <= 0) return;

    // Optimistic reorder
    const next = [...ordered];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLocalOrder(next.map((c) => c.id));

    // Persist
    setReordering(true);
    const a = ordered[idx];
    const b = ordered[idx - 1];
    const { error } = await supabase
      .from('categories')
      .update({ sort_order: b.sort_order })
      .eq('id', a.id).eq('venue_id', VENUE_ID);
    if (!error) {
      await supabase
        .from('categories')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id).eq('venue_id', VENUE_ID);
    }
    invalidateCategories();
    setLocalOrder(null);
    setReordering(false);
  }

  async function moveDown(cat: CategoryRow) {
    const idx = ordered.findIndex((c) => c.id === cat.id);
    if (idx < 0 || idx >= ordered.length - 1) return;

    const next = [...ordered];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setLocalOrder(next.map((c) => c.id));

    setReordering(true);
    const a = ordered[idx];
    const b = ordered[idx + 1];
    const { error } = await supabase
      .from('categories')
      .update({ sort_order: b.sort_order })
      .eq('id', a.id).eq('venue_id', VENUE_ID);
    if (!error) {
      await supabase
        .from('categories')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id).eq('venue_id', VENUE_ID);
    }
    invalidateCategories();
    setLocalOrder(null);
    setReordering(false);
  }

  // ─── Merge ───────────────────────────────────────────────────────────

  async function handleMerge() {
    if (!mergeTarget || selectedForMerge.size === 0) return;
    setMerging(true);
    try {
      const toMerge = [...selectedForMerge].filter((id) => id !== mergeTarget);
      for (const id of toMerge) {
        await supabase
          .from('products').update({ category_id: mergeTarget })
          .eq('category_id', id).eq('venue_id', VENUE_ID).eq('type', 'dish');
        await supabase.from('categories').delete().eq('id', id).eq('venue_id', VENUE_ID);
      }
      invalidateCategories();
      invalidateDishes();
      toast.success(`Объединено: ${toMerge.length} категорий`);
      setMergeMode(false);
      setMergeTarget(null);
      setSelectedForMerge(new Set());
    } catch (e) {
      toast.error((e as Error)?.message || 'Ошибка при объединении');
    } finally {
      setMerging(false);
    }
  }

  function toggleMergeSelection(catId: string) {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  }

  // ─── AI ──────────────────────────────────────────────────────────────

  async function handleAiCategorize() {
    setAiMode(true);
    setAiLoading(true);
    setAiError(null);
    setAiGroups(null);
    try {
      const groups = await categorizeDishes(
        dishes.map((d) => ({ id: d.id, name: d.name, current_category: d.category_name || '—', workshop: d.workshop_name || '—' }))
      );
      setAiGroups(groups);
    } catch (e) {
      setAiError((e as Error)?.message || 'Не удалось');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApplyAiGroups() {
    if (!aiGroups) return;
    try {
      for (const group of aiGroups) {
        if (group.dish_ids.length === 0) continue;
        const existing = categories.find((c) => c.name.toLowerCase() === group.name.toLowerCase());
        let categoryId: string;
        if (existing) {
          categoryId = existing.id;
        } else {
          const { data: maxSort } = await supabase.from('categories')
            .select('sort_order').eq('venue_id', VENUE_ID).order('sort_order', { ascending: false }).limit(1).maybeSingle();
          const nextSort = (Number((maxSort as any)?.sort_order) || 0) + 1;
          const { data: newCat, error: createErr } = await supabase
            .from('categories').insert({ venue_id: VENUE_ID, name: group.name, color_hex: '', sort_order: nextSort }).select('id').single();
          if (createErr) throw createErr;
          categoryId = (newCat as any).id;
        }
        const { error: updateErr } = await supabase
          .from('products').update({ category_id: categoryId }).in('id', group.dish_ids).eq('venue_id', VENUE_ID).eq('type', 'dish');
        if (updateErr) throw updateErr;
      }
      const usedIds = new Set(aiGroups.map((g) => categories.find((c) => c.name.toLowerCase() === g.name.toLowerCase())?.id).filter(Boolean));
      for (const cat of categories.filter((c) => !usedIds.has(c.id))) {
        const { data: count } = await supabase.from('products')
          .select('id', { count: 'exact', head: true }).eq('category_id', cat.id).eq('venue_id', VENUE_ID).eq('type', 'dish');
        if (!count || (Array.isArray(count) ? count.length : 0) === 0) {
          await supabase.from('categories').delete().eq('id', cat.id).eq('venue_id', VENUE_ID);
        }
      }
      invalidateCategories();
      invalidateDishes();
      toast.success(`Категории обновлены`);
      setAiMode(false);
      setAiGroups(null);
    } catch (e) {
      toast.error((e as Error)?.message || 'Ошибка при применении');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="p-8">

      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Категории</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Порядок категорий определяет их расположение в POS
          </p>
        </div>
        {!mergeMode && !aiMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAiCategorize}
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Сгруппировать с AI
            </button>
            <button
              type="button"
              onClick={() => { setMergeMode(true); setMergeTarget(null); setSelectedForMerge(new Set()); }}
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-background border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Merge className="w-4 h-4" />
              Объединить
            </button>
          </div>
        )}
        {mergeMode && (
          <div className="flex gap-2">
            <span className="flex items-center text-sm text-muted-foreground">
              Выбрано: {selectedForMerge.size}
            </span>
            <button
              type="button"
              onClick={handleMerge}
              disabled={!mergeTarget || selectedForMerge.size === 0 || merging}
              className="px-4 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {merging ? 'Объединение…' : 'Объединить'}
            </button>
            <button
              type="button"
              onClick={() => { setMergeMode(false); setMergeTarget(null); setSelectedForMerge(new Set()); }}
              className="px-4 h-9 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {/* AI MODE */}
      {aiMode && (
        <div className="space-y-6 mb-8">
          {aiLoading && (
            <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              AI анализирует меню…
            </div>
          )}
          {aiError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {aiError}
              <button onClick={handleAiCategorize} className="ml-3 underline">Попробовать снова</button>
            </div>
          )}
          {aiGroups && !aiLoading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  AI предлагает <span className="font-medium text-foreground">{aiGroups.length} категорий</span>.
                  Проверьте и нажмите «Применить».
                </p>
                <div className="flex gap-2">
                  <button onClick={handleApplyAiGroups} className="px-4 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80">
                    Применить все
                  </button>
                  <button onClick={() => { setAiMode(false); setAiGroups(null); }} className="px-4 h-9 border border-border rounded-lg text-sm hover:bg-accent">
                    Отмена
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiGroups.map((group) => {
                  const dishNames = group.dish_ids
                    .map((id) => dishes.find((d) => d.id === id)).filter(Boolean);
                  return (
                    <div key={group.name} className="border rounded-lg p-3 bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">{group.name}</h4>
                        <span className="text-sm text-muted-foreground tabular-nums">{dishNames.length} блюд</span>
                      </div>
                      <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                        {dishNames.slice(0, 10).map((d) => (
                          <div key={d!.id} className="text-sm text-muted-foreground flex items-center gap-1">
                            <span className="text-green-500 shrink-0">✓</span>
                            <span className="truncate">{d!.name}</span>
                            <span className="text-muted-foreground/50 shrink-0">← {d!.category_name || '—'}</span>
                          </div>
                        ))}
                        {dishNames.length > 10 && (
                          <p className="text-sm text-muted-foreground pl-4">…и ещё {dishNames.length - 10}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* NORMAL MODE */}
      {!aiMode && (
        <>
          {/* Create */}
          <div className="flex items-center gap-2 mb-6 max-w-sm">
            <input
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
              placeholder="Новая категория"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={createCategory.isPending || !newName.trim()}
              className="px-4 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              Добавить
            </button>
          </div>

          {/* CATEGORY LIST */}
          <div className="max-w-lg space-y-px">
            {catPending && <p className="text-sm text-muted-foreground py-8">Загрузка…</p>}

            {!catPending && ordered.map((cat) => {
              const isEditing = editingId === cat.id;
              const isTarget = mergeTarget === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`flex items-center gap-3 py-1.5 px-2 rounded-lg group transition-colors ${
                    mergeMode && isTarget ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-black/[0.03]'
                  }`}
                >
                  {/* Grip handle — ▲▼ buttons */}
                  {!mergeMode && (
                    <span className="flex shrink-0">
                      <button
                        type="button"
                        onClick={() => moveUp(cat)}
                        className="p-0.5 cursor-pointer hover:bg-accent rounded transition-colors"
                        title="Выше"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(cat)}
                        className="p-0.5 cursor-pointer hover:bg-accent rounded transition-colors"
                        title="Ниже"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {/* Merge target checkbox */}
                  {mergeMode && (
                    <input
                      type="checkbox"
                      checked={isTarget}
                      onChange={() => setMergeTarget(isTarget ? null : cat.id)}
                      className="shrink-0 rounded accent-primary cursor-pointer"
                      title="Основная категория"
                    />
                  )}

                  {/* Name */}
                  <span className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        className="w-full px-2 py-0.5 border rounded text-sm bg-background outline-none focus:border-primary"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm">{cat.name}</span>
                    )}
                  </span>

                  {/* Dish count */}
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums w-10 text-right">
                    {cat.dishCount}
                  </span>

                  {/* Actions */}
                  {!mergeMode && (
                    <span className="flex items-center shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                      <EditButton onClick={() => (isEditing ? handleSaveEdit() : startEdit(cat))} />
                      <DeleteButton variant="row" onClick={() => handleDelete(cat)} />
                    </span>
                  )}

                  {/* Merge checkbox */}
                  {mergeMode && !isTarget && (
                    <input
                      type="checkbox"
                      checked={selectedForMerge.has(cat.id)}
                      onChange={() => toggleMergeSelection(cat.id)}
                      className="shrink-0 rounded accent-primary cursor-pointer"
                      title="Объединить"
                    />
                  )}
                  {mergeMode && isTarget && <span className="shrink-0 w-4" />}
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
