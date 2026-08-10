import * as React from "react"
import { ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
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
import { CheckboxField, NumberField, SelectField, TextArea, TextField } from "../components/kit/form"
import { ImageField } from "../components/kit/image-field"
import { ChipMenu } from "../components/kit/chip-menu"
import { ArchiveFilter, matchesArchiveView, type ArchiveView } from "../components/kit/archive-filter"

// "Спириты" tab — rebuilt onto the kit's §54 EntityTable (Phase 2), following
// the FamiliesPage/UsersPage rhythm: EntityTable + toolbar (search + category
// ChipMenu + CTA/FAB "+ Спирит") + row-clickable §50 ResponsiveDialog form +
// delete (⋯ arcade hold-3s row action AND a ConfirmDialog from the form
// footer) + sonner toast.
//
// Field shapes and the fromAdminOut/toWriteIn mappers are ported VERBATIM
// from the retired SpiritEditor.tsx — mirror backend/app/schemas_admin.py's
// SpiritEntryWriteIn/SpiritEntryAdminOut one-for-one, and `_apply_spirit` is
// a full-body PATCH so a save must thread every loaded field through
// unchanged. One simplification vs. the old editor: since this page already
// holds the full list of SpiritEntryAdminOut rows (EntityTable passes the
// clicked row straight into the form), the parsed abv/price_amount hint no
// longer needs its own GET-by-slug round trip — it's read directly off the
// row being edited.
//
// The spirit-category CRUD (formerly the standalone `SpiritCategoriesPanel`
// exported from SpiritEditor.tsx and mounted separately in AdminPage) is
// ported inline below as a collapsible subpanel rendered above the spirits
// EntityTable — same create/edit/archive/delete behaviour, re-skinned with
// the kit's EntityTable/ResponsiveDialog/form fields instead of the old raw
// <input>s. `SpiritCategoryWriteIn` is likewise a full-record PATCH.
export interface SpiritEntryWriteIn {
  slug: string
  category: string
  name: string
  img: string | null
  abv_raw: string | null
  price_raw: string | null
  flavour: string | null
  brand: string | null
  country: string | null
  description: string | null
  features: string | null
  cocktail_pairings: string | null
  fact: string | null
  source_url: string | null
  sort_order: number
  is_archived: boolean
}

export interface SpiritEntryAdminOut extends SpiritEntryWriteIn {
  id: number
  abv: number | null
  price_amount: number | null
  serving_ml: number | null
}

export interface SpiritCategoryWriteIn {
  slug: string
  label: string
  sort_order: number
  is_archived: boolean
}

export interface SpiritCategoryAdminOut extends SpiritCategoryWriteIn {
  id: number
}

interface SpiritForm {
  slug: string
  category: string
  name: string
  img: string | null
  abv_raw: string
  price_raw: string
  flavour: string
  brand: string
  country: string
  description: string
  features: string
  cocktail_pairings: string
  fact: string
  source_url: string
  sort_order: number
  is_archived: boolean
}

const BLANK_FORM: SpiritForm = {
  slug: "",
  category: "",
  name: "",
  img: null,
  abv_raw: "",
  price_raw: "",
  flavour: "",
  brand: "",
  country: "",
  description: "",
  features: "",
  cocktail_pairings: "",
  fact: "",
  source_url: "",
  sort_order: 0,
  is_archived: false,
}

// Exported so SpiritsPage.test.tsx can assert the load->save round-trip
// directly (pure functions — no jsdom/@testing-library harness here yet).
export function fromAdminOut(row: SpiritEntryAdminOut): SpiritForm {
  return {
    slug: row.slug,
    category: row.category,
    name: row.name,
    img: row.img,
    abv_raw: row.abv_raw ?? "",
    price_raw: row.price_raw ?? "",
    flavour: row.flavour ?? "",
    brand: row.brand ?? "",
    country: row.country ?? "",
    description: row.description ?? "",
    features: row.features ?? "",
    cocktail_pairings: row.cocktail_pairings ?? "",
    fact: row.fact ?? "",
    source_url: row.source_url ?? "",
    sort_order: row.sort_order,
    is_archived: row.is_archived ?? false,
  }
}

export function toWriteIn(form: SpiritForm): SpiritEntryWriteIn {
  return {
    slug: form.slug.trim(),
    category: form.category,
    name: form.name.trim(),
    img: form.img,
    abv_raw: form.abv_raw.trim() || null,
    price_raw: form.price_raw.trim() || null,
    flavour: form.flavour.trim() || null,
    brand: form.brand.trim() || null,
    country: form.country.trim() || null,
    description: form.description.trim() || null,
    features: form.features.trim() || null,
    cocktail_pairings: form.cocktail_pairings.trim() || null,
    fact: form.fact.trim() || null,
    source_url: form.source_url.trim() || null,
    sort_order: form.sort_order,
    is_archived: form.is_archived,
  }
}

// 2-letter avatar initials from the name (feeds EntityTable identity), same
// helper shape as FamiliesPage/UsersPage.
export function initialsOf(label: string): string {
  const t = label.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

type Editing = { mode: "new" } | { mode: "edit"; row: SpiritEntryAdminOut } | null

interface ConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void
}

export function SpiritsPage() {
  const [rows, setRows] = React.useState<SpiritEntryAdminOut[]>([])
  const [loading, setLoading] = React.useState(true)
  const [categories, setCategories] = React.useState<SpiritCategoryAdminOut[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(true)
  const [categoriesOpen, setCategoriesOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<SpiritForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [archiveView, setArchiveView] = React.useState<ArchiveView>("active")
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const loadSpirits = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<SpiritEntryAdminOut>("spirits"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить спириты")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = React.useCallback(async () => {
    setCategoriesLoading(true)
    try {
      setCategories(await adminApi.list<SpiritCategoryAdminOut>("spirit-categories"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить категории спиртов")
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadSpirits()
    void loadCategories()
  }, [loadSpirits, loadCategories])

  // Category rename/archive/delete can change which slug a spirit's
  // `category` resolves to (or make a label stale in the lookup below), so
  // any category mutation reloads both lists.
  async function handleCategoriesChanged() {
    await Promise.all([loadCategories(), loadSpirits()])
  }

  function openNew() {
    const defaultCategory = categories.find((c) => !c.is_archived)?.slug ?? categories[0]?.slug ?? ""
    setForm({ ...BLANK_FORM, category: defaultCategory })
    setEditing({ mode: "new" })
  }

  function openEdit(row: SpiritEntryAdminOut) {
    setForm(fromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof SpiritForm>(key: K, value: SpiritForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: SpiritEntryAdminOut) {
    try {
      await adminApi.remove("spirits", row.slug)
      toast.success(`Удалено · ${row.name || row.slug}`)
      if (editing?.mode === "edit" && editing.row.slug === row.slug) setEditing(null)
      await loadSpirits()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить спирит")
    }
  }

  function deleteFromForm(row: SpiritEntryAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.name || row.slug}?`,
      description: "Спирит будет удалён безвозвратно.",
      onConfirm: () => void performDelete(row),
    })
  }

  // Full-body PATCH with only the flag flipped — same "thread every loaded
  // field through unchanged" rule as handleSave (see the mapper header
  // comment); reload the row via the already-loaded list entry, no extra GET.
  async function performArchiveToggle(row: SpiritEntryAdminOut) {
    try {
      await adminApi.update("spirits", row.slug, { ...toWriteIn(fromAdminOut(row)), is_archived: !row.is_archived })
      toast.success(row.is_archived ? `Возвращён из архива · ${row.name || row.slug}` : `В архив · ${row.name || row.slug}`)
      await loadSpirits()
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
        await adminApi.create("spirits", body)
        toast.success(`Спирит создан · ${body.name}`)
      } else {
        await adminApi.update("spirits", editing.row.slug, body)
        toast.success(`Сохранено · ${body.name || editing.row.slug}`)
      }
      setEditing(null)
      await loadSpirits()
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

  // The row being edited already carries the server-computed abv/price_amount
  // (no separate GET needed, unlike the old SpiritEditor) — new records have
  // nothing parsed yet.
  const parsed = editing?.mode === "edit" ? { abv: editing.row.abv, price_amount: editing.row.price_amount } : null

  const categoryLabelOf = React.useCallback(
    (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug,
    [categories]
  )

  // Archived categories stay selectable (an existing spirit may already be
  // assigned to one) but are marked so they're not mistaken for a live
  // option; only non-archived ones are offered as the create-mode default.
  const categoryOptions = categories.map((c) => ({
    value: c.slug,
    label: c.is_archived ? `${c.label} (архив)` : c.label,
  }))

  const categoryFilterOptions = [{ value: "all", label: "Все категории" }, ...categoryOptions]

  const q = search.trim().toLowerCase()
  const filteredRows = rows.filter((s) => {
    if (!matchesArchiveView(s.is_archived, archiveView)) return false
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false
    if (!q) return true
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.brand ?? "").toLowerCase().includes(q)
    )
  })

  const columns: EntityColumn<SpiritEntryAdminOut>[] = [
    {
      key: "category",
      label: "КАТЕГОРИЯ",
      width: 160,
      mobile: "sub",
      render: (s) => (
        <span className="font-mono text-[12px] text-muted-foreground">{categoryLabelOf(s.category)}</span>
      ),
      subText: (s) => categoryLabelOf(s.category),
    },
    {
      key: "abv",
      label: "КРЕПОСТЬ",
      width: 100,
      mobile: "hidden",
      render: (s) => <EntityMeta>{s.abv_raw || "—"}</EntityMeta>,
    },
    {
      key: "status",
      label: "СТАТУС",
      width: 88,
      render: (s) => (s.is_archived ? <RoleBadge tone="muted">архив</RoleBadge> : null),
    },
  ]

  const actions: EntityAction<SpiritEntryAdminOut>[] = [
    { label: "Изменить", onSelect: (s) => openEdit(s) },
    {
      label: "В архив",
      show: (s) => !s.is_archived,
      onSelect: (s) => void performArchiveToggle(s),
    },
    {
      label: "Вернуть",
      show: (s) => s.is_archived,
      onSelect: (s) => void performArchiveToggle(s),
    },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (s) => void performDelete(s),
    },
  ]

  function resetFilters() {
    setSearch("")
    setCategoryFilter("all")
    setArchiveView("active")
  }

  return (
    <div>
      <SpiritCategoriesPanel
        categories={categories}
        loading={categoriesLoading}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        onChanged={() => void handleCategoriesChanged()}
      />

      <EntityTable
        rows={filteredRows}
        rowKey={(s) => s.slug}
        identity={(s) => ({
          name: s.name,
          sub: `#${s.slug}`,
          initials: initialsOf(s.name),
          avatar: s.img ? (
            <img src={resolveImageUrl(s.img)} alt="" className="size-full rounded-[inherit] object-cover" />
          ) : undefined,
        })}
        identityLabel="СПИРИТ"
        columns={columns}
        actions={actions}
        onRowClick={(s) => openEdit(s)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Поиск ${rows.length} спиритов…`,
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
        cta={<Button onClick={openNew}>+ Спирит</Button>}
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
        aria-label="Новый спирит"
        onClick={openNew}
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новый спирит"
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
              <TextField
                label="Название"
                value={form.name}
                onChange={(v) => set("name", v)}
                required
                maxLength={256}
              />
            </div>

            <SelectField
              label="Категория"
              value={form.category}
              onChange={(v) => set("category", v)}
              options={categoryOptions}
              placeholder="— выберите —"
              hint="Должна существовать (управляется списком категорий выше таблицы)"
            />

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Крепость (как в меню)"
                value={form.abv_raw}
                onChange={(v) => set("abv_raw", v)}
                placeholder="напр. 40%"
                maxLength={32}
                hint={parsed && parsed.abv !== null ? `Распознано: ${parsed.abv}% ABV` : undefined}
              />
              <TextField
                label="Цена (как в меню)"
                value={form.price_raw}
                onChange={(v) => set("price_raw", v)}
                placeholder="напр. 50 мл / 450 ₽"
                maxLength={64}
                hint={
                  parsed && parsed.price_amount !== null ? `Распознано: ${parsed.price_amount}` : undefined
                }
              />
            </div>

            <ImageField label="Фото" value={form.img} onChange={(v) => set("img", v)} />

            <div className="grid grid-cols-2 gap-3">
              <TextField label="Бренд" value={form.brand} onChange={(v) => set("brand", v)} />
              <TextField label="Страна" value={form.country} onChange={(v) => set("country", v)} />
            </div>

            <TextField
              label="Ссылка на источник"
              value={form.source_url}
              onChange={(v) => set("source_url", v)}
              placeholder="https://…"
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
              hint="Архивные спириты скрыты из справочника по умолчанию"
            />

            <TextArea label="Вкус" value={form.flavour} onChange={(v) => set("flavour", v)} rows={2} />
            <TextArea label="Описание" value={form.description} onChange={(v) => set("description", v)} />
            <TextArea label="Особенности" value={form.features} onChange={(v) => set("features", v)} />
            <TextArea
              label="Сочетания в коктейлях"
              value={form.cocktail_pairings}
              onChange={(v) => set("cocktail_pairings", v)}
            />
            <TextArea label="Интересный факт" value={form.fact} onChange={(v) => set("fact", v)} rows={2} />
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

// ── Inline spirit-category management ─────────────────────────
// Small CRUD subpanel mounted above the spirits EntityTable (replaces the
// old standalone `SpiritCategoriesPanel` export from SpiritEditor.tsx — same
// create/edit/archive/delete behaviour, now its own mini EntityTable + §50
// ResponsiveDialog form behind a collapsible mono-caps header, rather than
// raw <input> rows). Collapsed by default so the spirits list stays the
// primary focus of the page.
interface SpiritCategoryForm {
  slug: string
  label: string
  sort_order: number
  is_archived: boolean
}

const BLANK_CATEGORY_FORM: SpiritCategoryForm = { slug: "", label: "", sort_order: 0, is_archived: false }

function categoryFromAdminOut(row: SpiritCategoryAdminOut): SpiritCategoryForm {
  return { slug: row.slug, label: row.label, sort_order: row.sort_order, is_archived: row.is_archived }
}

function categoryToWriteIn(form: SpiritCategoryForm): SpiritCategoryWriteIn {
  return {
    slug: form.slug.trim(),
    label: form.label.trim(),
    sort_order: form.sort_order,
    is_archived: form.is_archived,
  }
}

type CategoryEditing = { mode: "new" } | { mode: "edit"; row: SpiritCategoryAdminOut } | null

function SpiritCategoriesPanel({
  categories,
  loading,
  open,
  onOpenChange,
  onChanged,
}: {
  categories: SpiritCategoryAdminOut[]
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [editing, setEditing] = React.useState<CategoryEditing>(null)
  const [form, setForm] = React.useState<SpiritCategoryForm>(BLANK_CATEGORY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  function openNew() {
    setForm(BLANK_CATEGORY_FORM)
    setEditing({ mode: "new" })
  }

  function openEdit(row: SpiritCategoryAdminOut) {
    setForm(categoryFromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof SpiritCategoryForm>(key: K, value: SpiritCategoryForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: SpiritCategoryAdminOut) {
    try {
      await adminApi.remove("spirit-categories", row.slug)
      toast.success(`Удалено · ${row.label || row.slug}`)
      if (editing?.mode === "edit" && editing.row.slug === row.slug) setEditing(null)
      onChanged()
    } catch (e) {
      // 409 (category still has spirit entries) surfaces here via lib/api.ts's Error(detail).
      toast.error(e instanceof Error ? e.message : "Не удалось удалить категорию")
    }
  }

  function deleteFromForm(row: SpiritCategoryAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.label || row.slug}?`,
      description: "Категорию нельзя удалить, пока в ней есть спириты.",
      onConfirm: () => void performDelete(row),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const body = categoryToWriteIn(form)
      if (editing.mode === "new") {
        await adminApi.create("spirit-categories", body)
        toast.success(`Категория создана · ${body.label}`)
      } else {
        await adminApi.update("spirit-categories", editing.row.slug, body)
        toast.success(`Сохранено · ${body.label || editing.row.slug}`)
      }
      setEditing(null)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить категорию")
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled = !form.slug.trim() || !form.label.trim()

  const columns: EntityColumn<SpiritCategoryAdminOut>[] = [
    {
      key: "status",
      label: "СТАТУС",
      width: 110,
      render: (c) =>
        c.is_archived ? <RoleBadge tone="muted">архив</RoleBadge> : <RoleBadge tone="ink">активна</RoleBadge>,
    },
    {
      key: "sort",
      label: "ПОРЯДОК",
      width: 88,
      align: "right",
      mobile: "hidden",
      render: (c) => <EntityMeta>{c.sort_order}</EntityMeta>,
    },
  ]

  const actions: EntityAction<SpiritCategoryAdminOut>[] = [
    { label: "Изменить", onSelect: (c) => openEdit(c) },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (c) => void performDelete(c),
    },
  ]

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex min-h-8 items-center gap-1.5 font-mono text-[11px] tracking-[0.06em] text-muted-foreground"
          aria-expanded={open}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} strokeWidth={2} />
          КАТЕГОРИИ СПИРТОВ · {categories.length}
        </button>
        <Button size="sm" variant="secondary" onClick={openNew}>
          + Категория
        </Button>
      </div>

      {open && (
        <>
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
              <div className="px-4 py-8 text-center font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
                {loading ? "Загрузка…" : "НЕТ КАТЕГОРИЙ"}
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
                  : `Изменить · ${editing.row.label || editing.row.slug}`
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
                <CheckboxField
                  label="В архиве"
                  checked={form.is_archived}
                  onChange={(v) => set("is_archived", v)}
                  hint="Архивные категории не подставляются по умолчанию при создании нового спирита"
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
        </>
      )}
    </div>
  )
}
