import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronUp, ChevronDown, Pencil, X, ListFilter, Merge, Sparkles, Loader2 } from 'lucide-react';
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

const ROW_ACTION =
  'opacity-60 group-hover:opacity-100 transition-opacity p-2.5 cursor-pointer hover:bg-accent';

interface CategoryRow extends CategoryItem {
  dishCount: number;
}

export function Categories() {
  const navigate = useNavigate();
  const { data: categories = [], isPending: catPending } = useCategories();
  const { data: dishes = [] } = useDishes();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { invalidateCategories, invalidateDishes } = useInvalidateMenu();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  // AI mode
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGroups, setAiGroups] = useState<AIGroup[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Compute dish counts
  const catsWithCount: CategoryRow[] = categories.map((c) => ({
    ...c,
    dishCount: dishes.filter((d) => d.category_id === c.id).length,
  }));

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

  async function handleDelete(cat: CategoryRow) {
    if (!confirm(`Удалить «${cat.name}»? Блюда (${cat.dishCount} шт.) останутся без категории.`)) return;
    try {
      await deleteCategory.mutateAsync(cat.id);
      toast.success('Категория удалена');
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось удалить');
    }
  }

  async function handleReorder(cat: CategoryRow, direction: 'up' | 'down') {
    const sorted = [...catsWithCount];
    const idx = sorted.findIndex((c) => c.id === cat.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];

    // Swap sort_order
    const { error } = await supabase
      .from('categories')
      .update({ sort_order: b.sort_order })
      .eq('id', a.id)
      .eq('venue_id', VENUE_ID);
    if (error) { toast.error(error.message); return; }

    const { error: err2 } = await supabase
      .from('categories')
      .update({ sort_order: a.sort_order })
      .eq('id', b.id)
      .eq('venue_id', VENUE_ID);
    if (err2) { toast.error(err2.message); return; }

    toast.success('Порядок обновлён');
  }

  async function handleMerge() {
    if (!mergeTarget || selectedForMerge.size === 0) return;
    if (!confirm(
      `Объединить ${selectedForMerge.size} категорий в «${catsWithCount.find(c => c.id === mergeTarget)?.name}»?\n\nБлюда из выбранных категорий будут перенесены. Сами категории будут удалены.`
    )) return;

    setMerging(true);
    try {
      const toMerge = [...selectedForMerge].filter((id) => id !== mergeTarget);
      for (const id of toMerge) {
        // Reassign dishes to merge target
        await supabase
          .from('products')
          .update({ category_id: mergeTarget })
          .eq('category_id', id)
          .eq('venue_id', VENUE_ID)
          .eq('type', 'dish');

        // Delete source category
        await supabase
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('venue_id', VENUE_ID);
      }
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
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // ─── AI categorization ────────────────────────────────────────────────

  async function handleAiCategorize() {
    setAiMode(true);
    setAiLoading(true);
    setAiError(null);
    setAiGroups(null);
    try {
      const groups = await categorizeDishes(
        dishes.map((d) => ({
          id: d.id,
          name: d.name,
          current_category: d.category_name || '—',
          workshop: d.workshop_name || '—',
        }))
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
    if (!confirm(`Применить AI-категоризацию? Будет создано ${aiGroups.length} категорий. Блюда не пострадают.`)) return;

    try {
      for (const group of aiGroups) {
        if (group.dish_ids.length === 0) continue;

        // Check if a category with this name already exists
        const existing = categories.find(
          (c) => c.name.toLowerCase() === group.name.toLowerCase()
        );

        let categoryId: string;
        if (existing) {
          categoryId = existing.id;
        } else {
          // Create new category
          const { data: maxSort } = await supabase
            .from('categories')
            .select('sort_order')
            .eq('venue_id', VENUE_ID)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextSort = (Number((maxSort as any)?.sort_order) || 0) + 1;

          const { data: newCat, error: createErr } = await supabase
            .from('categories')
            .insert({ venue_id: VENUE_ID, name: group.name, color_hex: '', sort_order: nextSort })
            .select('id')
            .single();
          if (createErr) throw createErr;
          categoryId = (newCat as any).id;
        }

        // Reassign dishes
        const { error: updateErr } = await supabase
          .from('products')
          .update({ category_id: categoryId })
          .in('id', group.dish_ids)
          .eq('venue_id', VENUE_ID)
          .eq('type', 'dish');
        if (updateErr) throw updateErr;
      }

      // Delete empty categories (those with no dishes left)
      const usedIds = new Set(
        aiGroups
          .map((g) => categories.find((c) => c.name.toLowerCase() === g.name.toLowerCase())?.id)
          .filter(Boolean)
      );
      const toDelete = categories.filter((c) => !usedIds.has(c.id));
      for (const cat of toDelete) {
        const { data: count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', cat.id)
          .eq('venue_id', VENUE_ID)
          .eq('type', 'dish');
        // Only delete if truly empty
        if (!count || (Array.isArray(count) ? count.length : 0) === 0) {
          await supabase.from('categories').delete().eq('id', cat.id).eq('venue_id', VENUE_ID);
        }
      }

      invalidateCategories();
      invalidateDishes();
      toast.success(`Категории обновлены: ${categories.length} → ${aiGroups.length}`);
      setAiMode(false);
      setAiGroups(null);
    } catch (e) {
      toast.error((e as Error)?.message || 'Ошибка при применении');
    }
  }

  function exitAiMode() {
    setAiMode(false);
    setAiGroups(null);
    setAiError(null);
  }

  return (
    <div className="p-8 space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            К блюдам
          </button>
          <h2 className="text-2xl font-bold">Категории</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Порядок категорий определяет их расположение в POS-приложении
          </p>
        </div>
        {!mergeMode && !aiMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAiCategorize}
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Сгруппировать с AI
            </button>
            <button
              type="button"
              onClick={() => { setMergeMode(true); setMergeTarget(null); setSelectedForMerge(new Set()); }}
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-white border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <Merge className="w-4 h-4" />
              Объединить вручную
            </button>
          </div>
        )}
        {mergeMode && (
          <div className="flex gap-2">
            <span className="py-2 text-sm text-muted-foreground">
              Выбрано: {selectedForMerge.size}
            </span>
            <button
              type="button"
              onClick={handleMerge}
              disabled={!mergeTarget || selectedForMerge.size === 0 || merging}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {merging ? 'Объединение…' : 'Объединить'}
            </button>
            <button
              type="button"
              onClick={() => { setMergeMode(false); setMergeTarget(null); setSelectedForMerge(new Set()); }}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {/* ═══ AI MODE UI ═══ */}
      {aiMode && (
        <div className="space-y-6">
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
                  <button onClick={handleApplyAiGroups} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/80">
                    Применить все
                  </button>
                  <button onClick={exitAiMode} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent">
                    Отмена
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiGroups.map((group) => {
                  const dishNames = group.dish_ids
                    .map((id) => dishes.find((d) => d.id === id))
                    .filter(Boolean);
                  return (
                    <div key={group.name} className="border rounded-lg p-3 bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">{group.name}</h4>
                        <span className="text-xs text-muted-foreground tabular-nums">{dishNames.length} блюд</span>
                      </div>
                      <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                        {dishNames.slice(0, 10).map((d) => (
                          <div key={d!.id} className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="text-green-500 shrink-0">✓</span>
                            <span className="truncate">{d!.name}</span>
                            <span className="text-muted-foreground/50 shrink-0">← {d!.category_name || '—'}</span>
                          </div>
                        ))}
                        {dishNames.length > 10 && (
                          <p className="text-xs text-muted-foreground pl-4">…и ещё {dishNames.length - 10}</p>
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

      {/* ═══ NORMAL MODE ═══ */}
      {!aiMode && (<>
        <div className="flex items-center gap-2 max-w-md">
        <input
          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:border-primary transition-colors"
          placeholder="Новая категория"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={createCategory.isPending || !newName.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/80 disabled:opacity-50 transition-colors"
        >
          Добавить
        </button>
      </div>

      {/* CATEGORIES TABLE */}
      <div className="max-w-xl">
        {/* ColHeader */}
        <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
          {mergeMode && <span className="shrink-0 w-[40px]" />}
          <span className="shrink-0 w-[32px]">№</span>
          <span className="flex-1 min-w-0">Название</span>
          <span className="shrink-0 w-[80px] text-right">Блюд</span>
          <span className="shrink-0 w-[64px]" />
          <span className="shrink-0 w-[36px]" />
        </div>

        {catPending && (
          <p className="text-sm text-muted-foreground py-8">Загрузка…</p>
        )}

        {!catPending && catsWithCount.map((cat) => {
          const isEditing = editingId === cat.id;
          const isTarget = mergeTarget === cat.id;

          return (
            <div
              key={cat.id}
              className={`flex items-center gap-3 py-1.5 text-sm group hover:bg-accent transition-colors ${
                mergeMode && isTarget ? 'bg-primary/5 ring-1 ring-primary/20' : ''
              }`}
            >
              {/* Merge checkbox */}
              {mergeMode && (
                <span className="shrink-0 w-[40px] flex justify-center">
                  <input
                    type="checkbox"
                    checked={isTarget}
                    onChange={() => setMergeTarget(isTarget ? null : cat.id)}
                    className="rounded accent-primary cursor-pointer"
                    title="Выбрать как основную категорию"
                  />
                </span>
              )}

              {/* Order number */}
              <span className="shrink-0 w-[32px] text-muted-foreground text-xs tabular-nums">
                {cat.sort_order}
              </span>

              {/* Name — inline edit */}
              {isEditing ? (
                <input
                  className="flex-1 min-w-0 px-2 py-1 border rounded text-sm bg-background outline-none focus:border-primary"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                />
              ) : (
                <span className="flex-1 min-w-0 truncate">{cat.name}</span>
              )}

              {/* Dish count */}
              <span className="shrink-0 w-[80px] text-right tabular-nums text-muted-foreground">
                {cat.dishCount}
              </span>

              {/* Reorder buttons */}
              {!mergeMode && (
                <span className="shrink-0 w-[64px] flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleReorder(cat, 'up')}
                    className="p-1 hover:bg-muted rounded cursor-pointer"
                    title="Выше"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(cat, 'down')}
                    className="p-1 hover:bg-muted rounded cursor-pointer"
                    title="Ниже"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </span>
              )}

              {/* Edit */}
              {!mergeMode && (
                <span className={`shrink-0 w-[36px] ${ROW_ACTION}`}>
                  <button
                    type="button"
                    onClick={() => (isEditing ? handleSaveEdit() : startEdit(cat))}
                    className="group p-2.5 hover:bg-accent cursor-pointer"
                    title="Редактировать"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  </button>
                </span>
              )}

              {/* Delete (show in merge mode as "select for merge" indicator) */}
              {mergeMode ? (
                <span className="shrink-0 w-[36px] flex justify-center">
                  {!isTarget && (
                    <input
                      type="checkbox"
                      checked={selectedForMerge.has(cat.id)}
                      onChange={() => toggleMergeSelection(cat.id)}
                      className="rounded accent-primary cursor-pointer"
                      title="Объединить в целевую категорию"
                    />
                  )}
                </span>
              ) : (
                <span className={`shrink-0 w-[36px] ${ROW_ACTION}`}>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    className="group p-2.5 hover:bg-accent cursor-pointer"
                    title="Удалить"
                  >
                    <X className="w-4 h-4 text-muted-foreground group-hover:text-red-600" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
    )}
    </div>
  );
}
