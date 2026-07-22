import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Fab } from "@/components/kollektiv/fab"
import { ConfirmDialog } from "@/components/kollektiv/confirm-dialog"
import { ResponsiveDialog } from "@/components/adapters/responsive-dialog"
import {
  EntityTable,
  EntityMeta,
  type EntityAction,
  type EntityColumn,
} from "@/components/kollektiv/entity-table"

import { adminApi } from "../api"
import { NumberField, SelectField, TextArea, TextField } from "../components/kit/form"
import { RelationTags } from "../components/kit/relation-tags"
import { ChipMenu } from "../components/kit/chip-menu"

// "Классика" tab — rebuilt onto the kit's §54 EntityTable, same rhythm as
// FamiliesPage (the content-page template this copies structure from):
// EntityTable + toolbar (search + family ChipMenu filter + CTA/FAB) +
// row-clickable §50 ResponsiveDialog form + delete (⋯ arcade hold-3s row
// action AND a ConfirmDialog from the form footer).
//
// Field set + mappers are ported VERBATIM from the retired ClassicEditor.tsx
// (its `fromAdminOut`/`toWriteIn`, field group, and RelationTags wiring for
// spirits/descriptors/related_drinks) — mirrors backend/app/schemas_admin.py's
// ClassicWriteIn/ClassicAdminOut, and the backend `_apply_classic` is a
// full-body PATCH so a save must thread every loaded field through unchanged.
export interface ClassicWriteIn {
  slug: string
  name: string
  family: string
  year: number | null
  origin: string | null
  composition: string | null
  glass: string | null
  garnish: string | null
  history: string | null
  for_whom: string | null
  sort_order: number
  spirits: string[]
  descriptors: string[]
  related_drinks: string[]
}

export interface ClassicAdminOut extends ClassicWriteIn {
  id: number
}

interface FamilyOption {
  key: string
  label: string
}

// Editable form state: nullable text fields collapse to "" (TextField/
// TextArea don't accept null); `year` stays number|null (NumberField already
// maps ""<->null — must NOT collapse to 0 on save).
interface ClassicForm {
  slug: string
  name: string
  family: string
  year: number | null
  origin: string
  composition: string
  glass: string
  garnish: string
  history: string
  for_whom: string
  sort_order: number
  spirits: string[]
  descriptors: string[]
  related_drinks: string[]
}

const BLANK_FORM: ClassicForm = {
  slug: "",
  name: "",
  family: "",
  year: null,
  origin: "",
  composition: "",
  glass: "",
  garnish: "",
  history: "",
  for_whom: "",
  sort_order: 0,
  spirits: [],
  descriptors: [],
  related_drinks: [],
}

const SPIRIT_KEY_OPTIONS = [
  "gin",
  "rum",
  "bourbon",
  "brandy",
  "mezcal",
  "vodka",
  "tequila",
  "whiskey",
  "other",
]

// Exported for tests (pure mappers — the page itself can't be
// renderToStaticMarkup'd: kit components call useIsMobile()/window with no
// SSR guard and this repo's vitest runs plain node).
export function fromAdminOut(row: ClassicAdminOut): ClassicForm {
  return {
    slug: row.slug,
    name: row.name,
    family: row.family,
    year: row.year,
    origin: row.origin ?? "",
    composition: row.composition ?? "",
    glass: row.glass ?? "",
    garnish: row.garnish ?? "",
    history: row.history ?? "",
    for_whom: row.for_whom ?? "",
    sort_order: row.sort_order,
    spirits: row.spirits,
    descriptors: row.descriptors,
    related_drinks: row.related_drinks,
  }
}

export function toWriteIn(form: ClassicForm): ClassicWriteIn {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    family: form.family,
    // Preserve a loaded/unset null as-is — do NOT coerce to 0.
    year: form.year,
    origin: form.origin.trim() || null,
    composition: form.composition.trim() || null,
    glass: form.glass.trim() || null,
    garnish: form.garnish.trim() || null,
    history: form.history.trim() || null,
    for_whom: form.for_whom.trim() || null,
    sort_order: form.sort_order,
    spirits: form.spirits,
    descriptors: form.descriptors,
    related_drinks: form.related_drinks,
  }
}

// 2-letter avatar initials from the name (feeds EntityTable identity).
export function initialsOf(name: string): string {
  const t = name.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

// Family key -> label lookup for the СЕМЕЙСТВО column and the filter chip
// (falls back to the raw key if the family list hasn't loaded yet, or the
// row references a family that was since renamed/removed).
function familyLabelOf(families: FamilyOption[], key: string): string {
  return families.find((f) => f.key === key)?.label ?? key
}

type Editing = { mode: "new" } | { mode: "edit"; row: ClassicAdminOut } | null

interface ConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void
}

export function ClassicsPage() {
  const [rows, setRows] = React.useState<ClassicAdminOut[]>([])
  const [families, setFamilies] = React.useState<FamilyOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<ClassicForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [familyFilter, setFamilyFilter] = React.useState("all")
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<ClassicAdminOut>("classics"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить классику")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    adminApi
      .list<FamilyOption>("families")
      .then(setFamilies)
      .catch(() => setFamilies([]))
  }, [])

  function openNew() {
    setForm({ ...BLANK_FORM, family: families[0]?.key ?? "" })
    setEditing({ mode: "new" })
  }

  function openEdit(row: ClassicAdminOut) {
    setForm(fromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof ClassicForm>(key: K, value: ClassicForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: ClassicAdminOut) {
    try {
      await adminApi.remove("classics", row.slug)
      toast.success(`Удалено · ${row.name || row.slug}`)
      if (editing?.mode === "edit" && editing.row.slug === row.slug) setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить классику")
    }
  }

  function deleteFromForm(row: ClassicAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.name || row.slug}?`,
      description: "Классика и её связи будут удалены безвозвратно.",
      onConfirm: () => void performDelete(row),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const body = toWriteIn(form)
      if (editing.mode === "new") {
        await adminApi.create("classics", body)
        toast.success(`Классика создана · ${body.name}`)
      } else {
        await adminApi.update("classics", editing.row.slug, body)
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
      ? !form.slug.trim() || !form.name.trim() || !form.family
      : !form.name.trim() || !form.family

  const q = search.trim().toLowerCase()
  const filteredRows = rows.filter((c) => {
    if (familyFilter !== "all" && c.family !== familyFilter) return false
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.origin ?? "").toLowerCase().includes(q)
    )
  })

  const familyOptions = families.map((f) => ({ value: f.key, label: f.label }))
  const familyFilterOptions = [{ value: "all", label: "Все семейства" }, ...familyOptions]

  const columns: EntityColumn<ClassicAdminOut>[] = [
    {
      key: "family",
      label: "СЕМЕЙСТВО",
      width: 160,
      mobile: "sub",
      render: (c) => (
        <span className="font-mono text-[12px] text-muted-foreground">
          {familyLabelOf(families, c.family)}
        </span>
      ),
      subText: (c) => familyLabelOf(families, c.family),
    },
    {
      key: "year",
      label: "ГОД",
      width: 88,
      align: "right",
      mobile: "hidden",
      render: (c) => <EntityMeta>{c.year ?? "—"}</EntityMeta>,
    },
  ]

  const actions: EntityAction<ClassicAdminOut>[] = [
    { label: "Изменить", onSelect: (c) => openEdit(c) },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (c) => void performDelete(c),
    },
  ]

  function resetFilters() {
    setSearch("")
    setFamilyFilter("all")
  }

  return (
    <div>
      <EntityTable
        rows={filteredRows}
        rowKey={(c) => c.slug}
        identity={(c) => ({
          name: c.name,
          sub: `#${c.slug}`,
          initials: initialsOf(c.name),
        })}
        identityLabel="КЛАССИКА"
        columns={columns}
        actions={actions}
        onRowClick={(c) => openEdit(c)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Поиск ${rows.length} классики…`,
        }}
        filters={
          <ChipMenu
            value={familyFilter}
            options={familyFilterOptions}
            onChange={setFamilyFilter}
            label="Семейство"
          />
        }
        cta={<Button onClick={openNew}>+ Классика</Button>}
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
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          )
        }
      />

      <Fab
        icon={<Plus className="size-[22px]" strokeWidth={1.75} />}
        aria-label="Новая классика"
        onClick={openNew}
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новая классика"
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
                maxLength={64}
                hint={editing.mode === "edit" ? "идентификатор записи — не меняется" : undefined}
              />
              <TextField
                label="Название"
                value={form.name}
                onChange={(v) => set("name", v)}
                required
                maxLength={128}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Семейство"
                value={form.family}
                onChange={(v) => set("family", v)}
                options={familyOptions}
                placeholder="— выберите —"
                hint="Должно существовать (создаётся в разделе «Семейства»)"
              />
              <NumberField label="Год" value={form.year} onChange={(v) => set("year", v)} min={0} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Происхождение"
                value={form.origin}
                onChange={(v) => set("origin", v)}
                maxLength={128}
              />
              <TextField
                label="Стакан (ключ)"
                value={form.glass}
                onChange={(v) => set("glass", v)}
                hint="Будет создан автоматически, если такого ключа ещё нет"
              />
            </div>

            <NumberField
              label="Порядок сортировки"
              value={form.sort_order}
              onChange={(v) => set("sort_order", v ?? 0)}
            />

            <TextArea label="Состав" value={form.composition} onChange={(v) => set("composition", v)} />
            <TextArea label="Гарнир" value={form.garnish} onChange={(v) => set("garnish", v)} rows={2} />
            <TextArea label="История" value={form.history} onChange={(v) => set("history", v)} />
            <TextArea label="Кому подойдёт" value={form.for_whom} onChange={(v) => set("for_whom", v)} />

            <RelationTags
              label="Спириты (ключи)"
              value={form.spirits}
              onChange={(v) => set("spirits", v)}
              options={SPIRIT_KEY_OPTIONS}
              placeholder="gin, rum, …"
            />
            <RelationTags
              label="Дескрипторы"
              value={form.descriptors}
              onChange={(v) => set("descriptors", v)}
              placeholder="крепкий, освежающий, …"
            />
            <RelationTags
              label="Связанные напитки (слаги)"
              value={form.related_drinks}
              onChange={(v) => set("related_drinks", v)}
              hint="Неизвестные слаги молча игнорируются при сохранении"
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
