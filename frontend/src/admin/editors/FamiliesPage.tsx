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
import { TextField, TextArea, NumberField } from "../components/kit/form"

// "Семейства" tab — first CONTENT page rebuilt onto the kit's §54 EntityTable
// (Phase 2). This is the exemplar the field-heavier content pages
// (spirits/kitchen/classics/drinks) copy: EntityTable + toolbar (search +
// CTA/FAB) + row-clickable §50 ResponsiveDialog form + delete (⋯ arcade
// hold-3s row action AND a ConfirmDialog from the form footer). Same rhythm as
// the Phase-1 UsersPage; families are the simplest content type (flat form, no
// image, no M:N relations, natural key `key`).
//
// The form logic (types + fromAdminOut/toWriteIn mappers) is ported VERBATIM
// from the retired FamilyEditor.tsx — mirrors backend/app/schemas_admin.py's
// FamilyWriteIn/FamilyAdminOut, and the backend `_apply_family` is a full-body
// PATCH so a save must thread every loaded field through unchanged.
export interface FamilyWriteIn {
  key: string
  label: string
  sub: string | null
  color: string | null
  logic: string | null
  evolution: string | null
  tip: string | null
  sort_order: number
}

export interface FamilyAdminOut extends FamilyWriteIn {
  id: number
}

interface FamilyForm {
  key: string
  label: string
  sub: string
  color: string
  logic: string
  evolution: string
  tip: string
  sort_order: number
}

const BLANK_FORM: FamilyForm = {
  key: "",
  label: "",
  sub: "",
  color: "",
  logic: "",
  evolution: "",
  tip: "",
  sort_order: 0,
}

// Exported for tests (pure mappers — the page itself can't be renderToStatic
// Markup'd: kit components call useIsMobile()/window with no SSR guard and this
// repo's vitest runs plain node).
export function fromAdminOut(row: FamilyAdminOut): FamilyForm {
  return {
    key: row.key,
    label: row.label,
    sub: row.sub ?? "",
    color: row.color ?? "",
    logic: row.logic ?? "",
    evolution: row.evolution ?? "",
    tip: row.tip ?? "",
    sort_order: row.sort_order,
  }
}

export function toWriteIn(form: FamilyForm): FamilyWriteIn {
  return {
    key: form.key.trim(),
    label: form.label.trim(),
    sub: form.sub.trim() || null,
    color: form.color.trim() || null,
    logic: form.logic.trim() || null,
    evolution: form.evolution.trim() || null,
    tip: form.tip.trim() || null,
    sort_order: form.sort_order,
  }
}

// 2-letter avatar initials from the label (feeds EntityTable identity).
export function initialsOf(label: string): string {
  const t = label.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

type Editing = { mode: "new" } | { mode: "edit"; row: FamilyAdminOut } | null

interface ConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void
}

export function FamiliesPage() {
  const [rows, setRows] = React.useState<FamilyAdminOut[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<FamilyForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<FamilyAdminOut>("families"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить семейства")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openNew() {
    setForm(BLANK_FORM)
    setEditing({ mode: "new" })
  }

  function openEdit(row: FamilyAdminOut) {
    setForm(fromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof FamilyForm>(key: K, value: FamilyForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: FamilyAdminOut) {
    try {
      await adminApi.remove("families", row.key)
      toast.success(`Удалено · ${row.label || row.key}`)
      if (editing?.mode === "edit" && editing.row.key === row.key) setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить семейство")
    }
  }

  function deleteFromForm(row: FamilyAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.label || row.key}?`,
      description: "Семейство и его связи будут удалены безвозвратно.",
      onConfirm: () => void performDelete(row),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const body = toWriteIn(form)
      if (editing.mode === "new") {
        await adminApi.create("families", body)
        toast.success(`Семейство создано · ${body.label}`)
      } else {
        await adminApi.update("families", editing.row.key, body)
        toast.success(`Сохранено · ${body.label || editing.row.key}`)
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
    editing?.mode === "new" ? !form.key.trim() || !form.label.trim() : !form.label.trim()

  const q = search.trim().toLowerCase()
  const filteredRows = rows.filter((f) => {
    if (!q) return true
    return (
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      (f.sub ?? "").toLowerCase().includes(q)
    )
  })

  const columns: EntityColumn<FamilyAdminOut>[] = [
    {
      key: "key",
      label: "КЛЮЧ",
      width: 140,
      mobile: "sub",
      render: (f) => <span className="font-mono text-[12px] text-muted-foreground">{f.key}</span>,
      subText: (f) => f.key,
    },
    {
      key: "sort",
      label: "ПОРЯДОК",
      width: 96,
      align: "right",
      mobile: "hidden",
      render: (f) => <EntityMeta>{f.sort_order}</EntityMeta>,
    },
  ]

  const actions: EntityAction<FamilyAdminOut>[] = [
    { label: "Изменить", onSelect: (f) => openEdit(f) },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (f) => void performDelete(f),
    },
  ]

  return (
    <div>
      <EntityTable
        rows={filteredRows}
        rowKey={(f) => f.key}
        identity={(f) => ({
          name: f.label,
          sub: `#${f.key}`,
          initials: initialsOf(f.label),
          avatar: f.color ? (
            <span
              className="size-full rounded-[inherit]"
              style={{ backgroundColor: f.color }}
              aria-hidden
            />
          ) : undefined,
        })}
        identityLabel="СЕМЕЙСТВО"
        columns={columns}
        actions={actions}
        onRowClick={(f) => openEdit(f)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Поиск ${rows.length} семейств…`,
        }}
        cta={<Button onClick={openNew}>+ Семейство</Button>}
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
              {search && (
                <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                  Сбросить поиск
                </Button>
              )}
            </div>
          )
        }
      />

      <Fab
        icon={<Plus className="size-[22px]" strokeWidth={1.75} />}
        aria-label="Новое семейство"
        onClick={openNew}
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новое семейство"
              : `Изменить · ${editing.row.label || editing.row.key}`
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
                label="Ключ"
                value={form.key}
                onChange={(v) => set("key", v)}
                disabled={editing.mode === "edit"}
                required
                maxLength={32}
                hint={editing.mode === "edit" ? "идентификатор записи — не меняется" : undefined}
              />
              <TextField
                label="Название"
                value={form.label}
                onChange={(v) => set("label", v)}
                required
                maxLength={64}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Подзаголовок"
                value={form.sub}
                onChange={(v) => set("sub", v)}
                maxLength={128}
              />
              <TextField
                label="Цвет"
                value={form.color}
                onChange={(v) => set("color", v)}
                maxLength={16}
                placeholder="напр. #C0A062"
              />
            </div>
            <NumberField
              label="Порядок сортировки"
              value={form.sort_order}
              onChange={(v) => set("sort_order", v ?? 0)}
            />
            <TextArea label="Логика" value={form.logic} onChange={(v) => set("logic", v)} />
            <TextArea
              label="Эволюция"
              value={form.evolution}
              onChange={(v) => set("evolution", v)}
            />
            <TextArea label="Совет" value={form.tip} onChange={(v) => set("tip", v)} rows={2} />
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
