import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { resolveImageUrl } from "@/lib/img"
import { Button } from "@/components/ui/button"
import { Fab } from "@/components/kollektiv/fab"
import { ConfirmDialog } from "@/components/kollektiv/confirm-dialog"
import { ResponsiveDialog } from "@/components/adapters/responsive-dialog"
import {
  EntityTable,
  EntityMeta,
  RoleBadge,
  type EntityAction,
  type EntityColumn,
} from "@/components/kollektiv/entity-table"

import { adminApi } from "../api"
import { TextField, TextArea, NumberField, SelectField, CheckboxField } from "../components/kit/form"
import { ImageField } from "../components/kit/image-field"
import { ChipMenu } from "../components/kit/chip-menu"
import { ArchiveFilter, matchesArchiveView, type ArchiveView } from "../components/kit/archive-filter"

// "Кухня" tab — reskin of the retired KitchenEditor.tsx (+ its inline
// KitchenCategoriesPanel) onto the kit's §54 EntityTable, same rhythm as
// FamiliesPage/UsersPage: EntityTable + toolbar (search + category
// ChipMenu filter + CTA/FAB) + row-clickable §50 ResponsiveDialog form +
// delete (⋯ arcade hold-3s row action AND a ConfirmDialog from the form
// footer). Kitchen dishes reference a kitchen-category by slug (must
// already exist — NOT get-or-created, unlike the free-text relation
// fields elsewhere), so the category CRUD panel is ported inline above the
// dishes table, same tab, no separate top-level route.
//
// Field shapes mirror backend/app/schemas_admin.py's KitchenDishWriteIn/
// KitchenDishAdminOut and KitchenCategoryWriteIn/KitchenCategoryAdminOut
// one-for-one. Both `_apply_kitchen_dish` and the category apply are
// full-record PATCHes — a save must thread every loaded field through
// unchanged (see the full-body round-trip tests below).
export interface KitchenDishWriteIn {
  slug: string
  category: string
  name: string
  img: string | null
  price_raw: string | null
  tagline: string | null
  description: string | null
  timing_raw: string | null
  weight_raw: string | null
  nutrition_raw: string | null
  kcal_portion: number | null
  protein_g: number | null
  fat_g: number | null
  carb_g: number | null
  kcal_100g: number | null
  serving: string | null
  interesting_facts: string | null
  sort_order: number
  is_archived: boolean
}

export interface KitchenDishAdminOut extends KitchenDishWriteIn {
  id: number
  price_amount: number | null
  timing_min_low: number | null
  timing_min_high: number | null
  weight_g: number | null
}

export interface KitchenCategoryWriteIn {
  slug: string
  label: string
  sort_order: number
}

export interface KitchenCategoryAdminOut extends KitchenCategoryWriteIn {
  id: number
}

// Nullable numeric overrides (kcal_portion/protein_g/fat_g/carb_g/kcal_100g)
// must round-trip `null` as `null`, never `0` — when unset, the backend
// falls back to values parsed from `nutrition_raw` (`_apply_kitchen_dish`);
// sending `0` would win over the parsed values and silently zero out the
// dish's displayed nutrition. NumberField already maps ""<->null, so the
// form keeps them as number|null throughout.
interface KitchenForm {
  slug: string
  category: string
  name: string
  img: string | null
  price_raw: string
  tagline: string
  description: string
  timing_raw: string
  weight_raw: string
  nutrition_raw: string
  kcal_portion: number | null
  protein_g: number | null
  fat_g: number | null
  carb_g: number | null
  kcal_100g: number | null
  serving: string
  interesting_facts: string
  sort_order: number
  is_archived: boolean
}

const BLANK_FORM: KitchenForm = {
  slug: "",
  category: "",
  name: "",
  img: null,
  price_raw: "",
  tagline: "",
  description: "",
  timing_raw: "",
  weight_raw: "",
  nutrition_raw: "",
  kcal_portion: null,
  protein_g: null,
  fat_g: null,
  carb_g: null,
  kcal_100g: null,
  serving: "",
  interesting_facts: "",
  sort_order: 0,
  is_archived: false,
}

// Exported for tests (pure mappers — the page itself can't be
// renderToStaticMarkup'd: kit components call useIsMobile()/window with no
// SSR guard and this repo's vitest runs plain node).
export function fromAdminOut(row: KitchenDishAdminOut): KitchenForm {
  return {
    slug: row.slug,
    category: row.category,
    name: row.name,
    img: row.img,
    price_raw: row.price_raw ?? "",
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    timing_raw: row.timing_raw ?? "",
    weight_raw: row.weight_raw ?? "",
    nutrition_raw: row.nutrition_raw ?? "",
    // Preserve null as-is — do NOT collapse to 0 (see header comment).
    kcal_portion: row.kcal_portion,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carb_g: row.carb_g,
    kcal_100g: row.kcal_100g,
    serving: row.serving ?? "",
    interesting_facts: row.interesting_facts ?? "",
    sort_order: row.sort_order,
    is_archived: row.is_archived ?? false,
  }
}

export function toWriteIn(form: KitchenForm): KitchenDishWriteIn {
  return {
    slug: form.slug.trim(),
    category: form.category,
    name: form.name.trim(),
    img: form.img,
    price_raw: form.price_raw.trim() || null,
    tagline: form.tagline.trim() || null,
    description: form.description.trim() || null,
    timing_raw: form.timing_raw.trim() || null,
    weight_raw: form.weight_raw.trim() || null,
    nutrition_raw: form.nutrition_raw.trim() || null,
    kcal_portion: form.kcal_portion,
    protein_g: form.protein_g,
    fat_g: form.fat_g,
    carb_g: form.carb_g,
    kcal_100g: form.kcal_100g,
    serving: form.serving.trim() || null,
    interesting_facts: form.interesting_facts.trim() || null,
    sort_order: form.sort_order,
    is_archived: form.is_archived,
  }
}

// 2-letter avatar initials from a name/label (feeds EntityTable identity —
// reused for both dish names and category labels below).
export function initialsOf(name: string): string {
  const t = name.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

type Editing = { mode: "new" } | { mode: "edit"; row: KitchenDishAdminOut } | null

interface ConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void
}

// ── Inline kitchen-category management ────────────────────────
// Small CRUD panel mounted above the kitchen-dishes EntityTable in the same
// tab (categories get no separate top-level tab). Categories are owned
// (loaded/reloaded) by the parent KitchenPage — the dish form's category
// SelectField and the dish table's category column both need the same
// list, so there is exactly one source of truth instead of two independent
// fetches drifting apart. `onChanged` is called after every create/update/
// delete so the parent reloads both the categories AND the dishes (a
// renamed/removed category can change how dishes display/validate).
interface KitchenCategoryForm {
  slug: string
  label: string
  sort_order: number
}

const BLANK_CATEGORY_FORM: KitchenCategoryForm = { slug: "", label: "", sort_order: 0 }

function categoryFromAdminOut(row: KitchenCategoryAdminOut): KitchenCategoryForm {
  return { slug: row.slug, label: row.label, sort_order: row.sort_order }
}

// Full-record PATCH (mirrors KitchenCategoryWriteIn) — slug/label/sort_order
// all sent every time, same lesson as the dish mapper above.
function categoryToWriteIn(form: KitchenCategoryForm): KitchenCategoryWriteIn {
  return { slug: form.slug.trim(), label: form.label.trim(), sort_order: form.sort_order }
}

type CategoryEditing = { mode: "new" } | { mode: "edit"; row: KitchenCategoryAdminOut } | null

interface CategoryConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void
}

function KitchenCategoriesPanel({
  categories,
  loading,
  onChanged,
}: {
  categories: KitchenCategoryAdminOut[]
  loading: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = React.useState<CategoryEditing>(null)
  const [form, setForm] = React.useState<KitchenCategoryForm>(BLANK_CATEGORY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [confirm, setConfirm] = React.useState<CategoryConfirmState | null>(null)

  function openNew() {
    setForm(BLANK_CATEGORY_FORM)
    setEditing({ mode: "new" })
  }

  function openEdit(row: KitchenCategoryAdminOut) {
    setForm(categoryFromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof KitchenCategoryForm>(key: K, value: KitchenCategoryForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: KitchenCategoryAdminOut) {
    try {
      await adminApi.remove("kitchen-categories", row.slug)
      toast.success(`Категория удалена · ${row.label}`)
      if (editing?.mode === "edit" && editing.row.slug === row.slug) setEditing(null)
      onChanged()
    } catch (e) {
      // 409 (non-empty category — has dishes) surfaces here via lib/api.ts's
      // Error(detail).
      toast.error(e instanceof Error ? e.message : "Не удалось удалить категорию")
    }
  }

  function deleteFromForm(row: KitchenCategoryAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить категорию · ${row.label}?`,
      description: "Категорию с блюдами удалить нельзя — сначала перенесите их в другую.",
      onConfirm: () => void performDelete(row),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const body = categoryToWriteIn(form)
      if (editing.mode === "new") {
        await adminApi.create("kitchen-categories", body)
        toast.success(`Категория создана · ${body.label}`)
      } else {
        await adminApi.update("kitchen-categories", editing.row.slug, body)
        toast.success(`Сохранено · ${body.label}`)
      }
      setEditing(null)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить категорию")
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled =
    editing?.mode === "new" ? !form.slug.trim() || !form.label.trim() : !form.label.trim()

  const columns: EntityColumn<KitchenCategoryAdminOut>[] = [
    {
      key: "sort",
      label: "ПОРЯДОК",
      width: 96,
      align: "right",
      mobile: "hidden",
      render: (c) => <EntityMeta>{c.sort_order}</EntityMeta>,
    },
  ]

  const actions: EntityAction<KitchenCategoryAdminOut>[] = [
    { label: "Изменить", onSelect: (c) => openEdit(c) },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (c) => void performDelete(c),
    },
  ]

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
          КАТЕГОРИИ КУХНИ
        </span>
        <Button variant="secondary" size="sm" onClick={openNew}>
          + Категория
        </Button>
      </div>

      <EntityTable
        rows={categories}
        rowKey={(c) => c.slug}
        identity={(c) => ({ name: c.label, sub: `#${c.slug}`, initials: initialsOf(c.label) })}
        identityLabel="КАТЕГОРИЯ"
        columns={columns}
        actions={actions}
        onRowClick={(c) => openEdit(c)}
        toolbar={false}
        emptyState={
          <div className="px-4 py-6 text-center font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
            {loading ? "Загрузка…" : "Нет категорий — добавьте первую"}
          </div>
        }
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новая категория"
              : `Изменить · ${editing.row.label}`
            : ""
        }
        contentClassName="sm:max-w-[480px]"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {editing?.mode === "edit" && (
              <Button
                variant="destructive"
                onClick={() => deleteFromForm(editing.row)}
                className="sm:mr-auto max-md:w-full"
              >
                Удалить
              </Button>
            )}
            <Button variant="quiet" onClick={() => setEditing(null)} className="max-md:w-full">
              Отмена
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saveDisabled || saving}
              className="max-md:w-full"
            >
              Сохранить
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Слаг"
                value={form.slug}
                onChange={(v) => set("slug", v)}
                disabled={editing.mode === "edit"}
                required
                maxLength={64}
                hint={editing.mode === "edit" ? "идентификатор записи — не меняется" : undefined}
              />
              <TextField
                label="Название"
                value={form.label}
                onChange={(v) => set("label", v)}
                required
                maxLength={128}
              />
            </div>
            <NumberField
              label="Порядок сортировки"
              value={form.sort_order}
              onChange={(v) => set("sort_order", v ?? 0)}
            />
          </div>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel="Удалить"
        destructive
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  )
}

export function KitchenPage() {
  const [rows, setRows] = React.useState<KitchenDishAdminOut[]>([])
  const [categories, setCategories] = React.useState<KitchenCategoryAdminOut[]>([])
  const [loading, setLoading] = React.useState(true)
  const [categoriesLoading, setCategoriesLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<KitchenForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [archiveView, setArchiveView] = React.useState<ArchiveView>("active")
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<KitchenDishAdminOut>("kitchen-dishes"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить блюда")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = React.useCallback(async () => {
    setCategoriesLoading(true)
    try {
      setCategories(await adminApi.list<KitchenCategoryAdminOut>("kitchen-categories"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить категории")
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
    void loadCategories()
  }, [load, loadCategories])

  // Categories changing (create/rename/delete) can affect how dishes
  // display/validate — reload both lists (see the panel's header comment).
  function handleCategoriesChanged() {
    void loadCategories()
    void load()
  }

  function openNew() {
    setForm({ ...BLANK_FORM, category: categories[0]?.slug ?? "" })
    setEditing({ mode: "new" })
  }

  function openEdit(row: KitchenDishAdminOut) {
    setForm(fromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof KitchenForm>(key: K, value: KitchenForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: KitchenDishAdminOut) {
    try {
      await adminApi.remove("kitchen-dishes", row.slug)
      toast.success(`Удалено · ${row.name || row.slug}`)
      if (editing?.mode === "edit" && editing.row.slug === row.slug) setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить блюдо")
    }
  }

  function deleteFromForm(row: KitchenDishAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.name || row.slug}?`,
      description: "Блюдо будет удалено безвозвратно.",
      onConfirm: () => void performDelete(row),
    })
  }

  // Full-body PATCH with only the flag flipped — same "thread every loaded
  // field through unchanged" rule as handleSave.
  async function performArchiveToggle(row: KitchenDishAdminOut) {
    try {
      await adminApi.update("kitchen-dishes", row.slug, {
        ...toWriteIn(fromAdminOut(row)),
        is_archived: !row.is_archived,
      })
      toast.success(row.is_archived ? `Возвращено из архива · ${row.name || row.slug}` : `В архив · ${row.name || row.slug}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось изменить статус архива")
    }
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const body = toWriteIn(form)
      if (editing.mode === "new") {
        await adminApi.create("kitchen-dishes", body)
        toast.success(`Блюдо создано · ${body.name}`)
      } else {
        await adminApi.update("kitchen-dishes", editing.row.slug, body)
        toast.success(`Сохранено · ${body.name || editing.row.slug}`)
      }
      setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled =
    editing?.mode === "new"
      ? !form.slug.trim() || !form.name.trim() || !form.category
      : !form.name.trim() || !form.category

  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.label }))
  const categoryFilterOptions = [{ value: "all", label: "Все категории" }, ...categoryOptions]

  function categoryLabel(slug: string): string {
    return categories.find((c) => c.slug === slug)?.label ?? slug
  }

  const q = search.trim().toLowerCase()
  const filteredRows = rows.filter((d) => {
    if (!matchesArchiveView(d.is_archived, archiveView)) return false
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false
    if (!q) return true
    return (
      d.name.toLowerCase().includes(q) ||
      d.slug.toLowerCase().includes(q) ||
      categoryLabel(d.category).toLowerCase().includes(q)
    )
  })

  const columns: EntityColumn<KitchenDishAdminOut>[] = [
    {
      key: "category",
      label: "КАТЕГОРИЯ",
      width: 160,
      mobile: "sub",
      render: (d) => <EntityMeta>{categoryLabel(d.category)}</EntityMeta>,
      subText: (d) => categoryLabel(d.category),
    },
    {
      key: "price",
      label: "ЦЕНА",
      width: 96,
      render: (d) => <EntityMeta>{d.price_raw ?? "—"}</EntityMeta>,
    },
    {
      key: "status",
      label: "СТАТУС",
      width: 88,
      render: (d) => (d.is_archived ? <RoleBadge tone="muted">архив</RoleBadge> : null),
    },
  ]

  const actions: EntityAction<KitchenDishAdminOut>[] = [
    { label: "Изменить", onSelect: (d) => openEdit(d) },
    {
      label: "В архив",
      show: (d) => !d.is_archived,
      onSelect: (d) => void performArchiveToggle(d),
    },
    {
      label: "Вернуть",
      show: (d) => d.is_archived,
      onSelect: (d) => void performArchiveToggle(d),
    },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (d) => void performDelete(d),
    },
  ]

  function resetFilters() {
    setSearch("")
    setCategoryFilter("all")
    setArchiveView("active")
  }

  // Parsed hints (price_amount/timing_min_low/high/weight_g) come straight
  // off the already-loaded list row — adminApi.list returns full AdminOut
  // records, so no extra per-row fetch is needed on open (unlike the retired
  // KitchenEditor, which re-fetched via adminApi.get on every edit-open).
  const editingRow = editing?.mode === "edit" ? editing.row : null

  return (
    <div>
      <KitchenCategoriesPanel
        categories={categories}
        loading={categoriesLoading}
        onChanged={handleCategoriesChanged}
      />

      <EntityTable
        rows={filteredRows}
        rowKey={(d) => d.slug}
        identity={(d) => ({
          name: d.name,
          sub: `#${d.slug}`,
          initials: initialsOf(d.name),
          avatar: d.img ? (
            <img
              src={resolveImageUrl(d.img)}
              alt=""
              className="size-full rounded-[inherit] object-cover"
            />
          ) : undefined,
        })}
        identityLabel="БЛЮДО"
        columns={columns}
        actions={actions}
        onRowClick={(d) => openEdit(d)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Поиск ${rows.length} блюд…`,
        }}
        filters={
          <>
            <ChipMenu
              value={categoryFilter}
              options={categoryFilterOptions}
              onChange={setCategoryFilter}
              label="Категория"
            />
            <ArchiveFilter value={archiveView} onChange={setArchiveView} />
          </>
        }
        cta={<Button onClick={openNew}>+ Блюдо</Button>}
        emptyState={
          loading ? (
            <div className="px-4 py-12 text-center font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
              Загрузка…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
                НИЧЕГО НЕ НАШЛОСЬ
              </span>
              {(search || categoryFilter !== "all" || archiveView !== "active") && (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              )}
            </div>
          )
        }
      />

      <Fab
        icon={<Plus className="size-[22px]" strokeWidth={1.75} />}
        aria-label="Новое блюдо"
        onClick={openNew}
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новое блюдо"
              : `Изменить · ${editing.row.name || editing.row.slug}`
            : ""
        }
        contentClassName="sm:max-w-[620px]"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {editing?.mode === "edit" && (
              <Button
                variant="destructive"
                onClick={() => deleteFromForm(editing.row)}
                className="sm:mr-auto max-md:w-full"
              >
                Удалить
              </Button>
            )}
            <Button variant="quiet" onClick={() => setEditing(null)} className="max-md:w-full">
              Отмена
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saveDisabled || saving}
              className="max-md:w-full"
            >
              Сохранить
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Слаг"
                value={form.slug}
                onChange={(v) => set("slug", v)}
                disabled={editing.mode === "edit"}
                required
                maxLength={80}
                hint={editing.mode === "edit" ? "идентификатор записи — не меняется" : undefined}
              />
              <SelectField
                label="Категория"
                value={form.category}
                onChange={(v) => set("category", v)}
                options={categoryOptions}
                placeholder="Выберите категорию"
                hint="Должна существовать — см. категории выше"
              />
            </div>

            <TextField label="Название" value={form.name} onChange={(v) => set("name", v)} required maxLength={256} />

            <ImageField label="Фото" value={form.img} onChange={(v) => set("img", v)} />

            <TextField
              label="Цена (как в меню)"
              value={form.price_raw}
              onChange={(v) => set("price_raw", v)}
              placeholder="напр. 450 ₽"
              maxLength={32}
              hint={editingRow && editingRow.price_amount !== null ? `Распознано: ${editingRow.price_amount}` : undefined}
            />

            <TextArea label="Тэглайн" value={form.tagline} onChange={(v) => set("tagline", v)} rows={2} />
            <TextArea label="Описание" value={form.description} onChange={(v) => set("description", v)} />

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Время (как в меню)"
                value={form.timing_raw}
                onChange={(v) => set("timing_raw", v)}
                placeholder="напр. 15-20 мин"
                maxLength={32}
                hint={
                  editingRow && (editingRow.timing_min_low !== null || editingRow.timing_min_high !== null)
                    ? `Распознано: ${editingRow.timing_min_low ?? "?"}–${editingRow.timing_min_high ?? "?"} мин`
                    : undefined
                }
              />
              <TextField
                label="Вес (как в меню)"
                value={form.weight_raw}
                onChange={(v) => set("weight_raw", v)}
                placeholder="напр. 250 г"
                maxLength={64}
                hint={editingRow && editingRow.weight_g !== null ? `Распознано: ${editingRow.weight_g} г` : undefined}
              />
            </div>

            <div>
              <TextArea
                label="Пищевая ценность (как в меню)"
                value={form.nutrition_raw}
                onChange={(v) => set("nutrition_raw", v)}
                rows={2}
                hint="Парсится автоматически; числа ниже перекрывают распознанные значения, только если заданы"
              />
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <NumberField
                  label="Ккал/порция"
                  value={form.kcal_portion}
                  onChange={(v) => set("kcal_portion", v)}
                  step={0.1}
                />
                <NumberField label="Белки, г" value={form.protein_g} onChange={(v) => set("protein_g", v)} step={0.1} />
                <NumberField label="Жиры, г" value={form.fat_g} onChange={(v) => set("fat_g", v)} step={0.1} />
                <NumberField label="Углеводы, г" value={form.carb_g} onChange={(v) => set("carb_g", v)} step={0.1} />
                <NumberField label="Ккал/100г" value={form.kcal_100g} onChange={(v) => set("kcal_100g", v)} step={0.1} />
              </div>
            </div>

            <TextArea label="Подача" value={form.serving} onChange={(v) => set("serving", v)} rows={2} />
            <TextArea
              label="Интересные факты"
              value={form.interesting_facts}
              onChange={(v) => set("interesting_facts", v)}
            />
            <NumberField
              label="Порядок сортировки"
              value={form.sort_order}
              onChange={(v) => set("sort_order", v ?? 0)}
            />

            <CheckboxField
              label="В архиве"
              checked={form.is_archived}
              onChange={(v) => set("is_archived", v)}
              hint="Архивные блюда скрыты из меню по умолчанию"
            />
          </div>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel="Удалить"
        destructive
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  )
}
