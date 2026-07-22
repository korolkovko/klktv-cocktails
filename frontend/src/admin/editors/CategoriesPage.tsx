import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/adapters/responsive-dialog"
import {
  EntityTable,
  EntityMeta,
  RoleBadge,
  type EntityAction,
  type EntityColumn,
} from "@/components/kollektiv/entity-table"

import { adminApi } from "../api"
import { TextField, NumberField, CheckboxField } from "../components/kit/form"

// "Разделы" tab (Phase 2, kit §54). Categories/sections are a FIXED set seeded
// by migration — no create/delete, only relabel / show-hide / reorder (backend
// admin.py `update_category` + `reorder_categories`; CategoryPatchIn /
// CategoryReorderIn). So: no CTA, no FAB, no delete action — just a row-click
// §50 form (label + visibility + sort_order) and ⋯ «Выше»/«Ниже» reorder
// actions that reassign sort_order = index across the whole list. Shown in
// sort order with no search/filter (tiny fixed set) so the reorder indices are
// unambiguous.
//
// `CategoryPatchIn` is a genuine partial patch (router assigns only non-None
// fields) — sending {label,is_visible,sort_order} together is for simplicity,
// not because omitting one would wipe it.
export interface CategoryRow {
  id: number
  key: string
  label: string
  kind: string
  sort_order: number
  is_visible: boolean
}

// Pure reorder helper (exported for tests): the new full key order after moving
// the row at `index` by `dir`, or null if the move runs off either end.
export function reorderedKeys(rows: CategoryRow[], index: number, dir: -1 | 1): string[] | null {
  const target = index + dir
  if (target < 0 || target >= rows.length) return null
  const next = [...rows]
  const tmp = next[index]
  next[index] = next[target]
  next[target] = tmp
  return next.map((r) => r.key)
}

interface CatForm {
  label: string
  is_visible: boolean
  sort_order: number
}

type Editing = { row: CategoryRow } | null

export function CategoriesPage() {
  const [rows, setRows] = React.useState<CategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<CatForm>({ label: "", is_visible: true, sort_order: 0 })
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<CategoryRow>("categories"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить разделы")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openEdit(row: CategoryRow) {
    setForm({ label: row.label, is_visible: row.is_visible, sort_order: row.sort_order })
    setEditing({ row })
  }

  function set<K extends keyof CatForm>(key: K, value: CatForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      await adminApi.update("categories", editing.row.key, {
        label: form.label.trim(),
        is_visible: form.is_visible,
        sort_order: form.sort_order,
      })
      toast.success(`Сохранено · ${form.label || editing.row.key}`)
      setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить раздел")
    } finally {
      setSaving(false)
    }
  }

  async function move(row: CategoryRow, dir: -1 | 1) {
    const index = rows.findIndex((r) => r.key === row.key)
    const keys = reorderedKeys(rows, index, dir)
    if (!keys) return
    try {
      await adminApi.reorderCategories(keys)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось изменить порядок разделов")
    }
  }

  const columns: EntityColumn<CategoryRow>[] = [
    {
      key: "kind",
      label: "ТИП",
      width: 120,
      mobile: "sub",
      render: (c) => <span className="font-mono text-[12px] text-muted-foreground">{c.kind}</span>,
      subText: (c) => c.kind,
    },
    {
      key: "visible",
      label: "ВИДИМ",
      width: 108,
      render: (c) =>
        c.is_visible ? (
          <RoleBadge tone="ink">виден</RoleBadge>
        ) : (
          <RoleBadge tone="muted">скрыт</RoleBadge>
        ),
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

  const actions: EntityAction<CategoryRow>[] = [
    { label: "Изменить", onSelect: (c) => openEdit(c) },
    {
      label: "Выше",
      show: (c) => rows.findIndex((r) => r.key === c.key) > 0,
      onSelect: (c) => void move(c, -1),
    },
    {
      label: "Ниже",
      show: (c) => rows.findIndex((r) => r.key === c.key) < rows.length - 1,
      onSelect: (c) => void move(c, 1),
    },
  ]

  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
        Разделы — фиксированный набор: создание и удаление недоступны, только название, видимость и
        порядок.
      </p>

      <EntityTable
        rows={rows}
        rowKey={(c) => c.key}
        identity={(c) => ({ name: c.label, sub: `#${c.key}`, initials: c.label.slice(0, 2).toUpperCase() })}
        identityLabel="РАЗДЕЛ"
        columns={columns}
        actions={actions}
        onRowClick={(c) => openEdit(c)}
        emptyState={
          <div className="px-4 py-12 text-center font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
            {loading ? "Загрузка…" : "НЕТ РАЗДЕЛОВ"}
          </div>
        }
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Раздел · ${editing.row.label || editing.row.key}` : ""}
        contentClassName="sm:max-w-[620px]"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="quiet" onClick={() => setEditing(null)} className="max-md:w-full">
              Отмена
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!form.label.trim() || saving}
              className="max-md:w-full"
            >
              Сохранить
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4 py-1">
            <TextField
              label="Название"
              value={form.label}
              onChange={(v) => set("label", v)}
              required
              maxLength={64}
            />
            <CheckboxField
              label="Виден в справочнике"
              checked={form.is_visible}
              onChange={(v) => set("is_visible", v)}
            />
            <NumberField
              label="Порядок сортировки"
              value={form.sort_order}
              onChange={(v) => set("sort_order", v ?? 0)}
              hint={`Ключ ${editing.row.key} · тип ${editing.row.kind} — не редактируются`}
            />
          </div>
        )}
      </ResponsiveDialog>
    </div>
  )
}
