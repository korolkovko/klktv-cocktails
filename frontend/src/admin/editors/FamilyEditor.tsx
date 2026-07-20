import * as React from "react"

import { adminApi } from "../api"
import { NumberField, TextArea, TextField } from "../components/FormFields"
import { EditorShell } from "../components/EditorShell"

// Clone of DrinkEditor's shape (Task 8) for families — self-contained,
// owns its own <EditorShell>, exposes only {key, onSaved, onClose}.
// Field shapes mirror backend/app/schemas_admin.py's `FamilyWriteIn` /
// `FamilyAdminOut` one-for-one. Families have no M:N relations (unlike
// drinks/classics) — a flat form, natural key `key`.
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

// Exported so FamilyEditor.test.tsx can assert the load->save round-trip
// directly, without a jsdom/@testing-library harness this project doesn't
// have yet.
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

export function FamilyEditor({
  fkey,
  onSaved,
  onClose,
}: {
  fkey: string | null
  onSaved: () => void
  onClose: () => void
}) {
  const mode = fkey === null ? "new" : "edit"
  const [form, setForm] = React.useState<FamilyForm>(BLANK_FORM)
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (fkey === null) {
      setForm(BLANK_FORM)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    adminApi
      .get<FamilyAdminOut>("families", fkey)
      .then((row) => {
        if (cancelled) return
        setForm(fromAdminOut(row))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Не удалось загрузить данные")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fkey])

  function set<K extends keyof FamilyForm>(key: K, value: FamilyForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = toWriteIn(form)
      if (mode === "new") {
        await adminApi.create("families", body)
      } else {
        await adminApi.update("families", fkey!, body)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const title = mode === "new" ? "Новое: Семейство" : `Редактирование: ${form.label || fkey}`

  return (
    <EditorShell
      title={title}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !form.key.trim() || !form.label.trim()}
    >
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Ключ"
              value={form.key}
              onChange={(v) => set("key", v)}
              disabled={mode === "edit"}
              required
              maxLength={32}
              hint={mode === "edit" ? "Ключ записи — не редактируется" : undefined}
            />
            <TextField label="Название" value={form.label} onChange={(v) => set("label", v)} required maxLength={64} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField label="Подзаголовок" value={form.sub} onChange={(v) => set("sub", v)} maxLength={128} />
            <TextField
              label="Цвет"
              value={form.color}
              onChange={(v) => set("color", v)}
              maxLength={16}
              placeholder="напр. #C0A062"
            />
          </div>

          <NumberField label="Порядок сортировки" value={form.sort_order} onChange={(v) => set("sort_order", v ?? 0)} />

          <TextArea label="Логика" value={form.logic} onChange={(v) => set("logic", v)} />
          <TextArea label="Эволюция" value={form.evolution} onChange={(v) => set("evolution", v)} />
          <TextArea label="Совет" value={form.tip} onChange={(v) => set("tip", v)} rows={2} />
        </div>
      )}
    </EditorShell>
  )
}
