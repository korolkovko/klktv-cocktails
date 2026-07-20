import * as React from "react"

import { adminApi } from "../api"
import { NumberField, SelectField, TextArea, TextField } from "../components/FormFields"
import { RelationTags } from "../components/RelationTags"
import { EditorShell } from "../components/EditorShell"

// Clone of DrinkEditor's shape (Task 8) for classics — self-contained,
// owns its own <EditorShell>, exposes only {slug, onSaved, onClose}.
// Field shapes mirror backend/app/schemas_admin.py's `ClassicWriteIn` /
// `ClassicAdminOut` one-for-one.
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
// maps ""<->null — must NOT collapse to 0 on save, see task-8 review Fix 1
// precedent for is_carbonated).
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

// Exported (alongside BLANK_FORM's shape) so ClassicEditor.test.tsx can
// assert the load->save null round-trip directly, without a jsdom/
// @testing-library harness this project doesn't have yet.
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

export function ClassicEditor({
  slug,
  onSaved,
  onClose,
}: {
  slug: string | null
  onSaved: () => void
  onClose: () => void
}) {
  const mode = slug === null ? "new" : "edit"
  const [form, setForm] = React.useState<ClassicForm>(BLANK_FORM)
  const [families, setFamilies] = React.useState<FamilyOption[]>([])
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    adminApi
      .list<FamilyOption>("families")
      .then(setFamilies)
      .catch(() => setFamilies([]))
  }, [])

  React.useEffect(() => {
    let cancelled = false
    if (slug === null) {
      setForm(BLANK_FORM)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    adminApi
      .get<ClassicAdminOut>("classics", slug)
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
  }, [slug])

  function set<K extends keyof ClassicForm>(key: K, value: ClassicForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = toWriteIn(form)
      if (mode === "new") {
        await adminApi.create("classics", body)
      } else {
        await adminApi.update("classics", slug!, body)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const title = mode === "new" ? "Новый: Классика" : `Редактирование: ${form.name || slug}`
  const familyOptions = families.map((f) => ({ value: f.key, label: f.label }))

  return (
    <EditorShell
      title={title}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !form.slug.trim() || !form.name.trim() || !form.family}
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
              label="Слаг"
              value={form.slug}
              onChange={(v) => set("slug", v)}
              disabled={mode === "edit"}
              required
              maxLength={64}
              hint={mode === "edit" ? "Ключ записи — не редактируется" : undefined}
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
            <TextField label="Происхождение" value={form.origin} onChange={(v) => set("origin", v)} maxLength={128} />
            <TextField
              label="Стакан (ключ)"
              value={form.glass}
              onChange={(v) => set("glass", v)}
              hint="Будет создан автоматически, если такого ключа ещё нет"
            />
          </div>

          <NumberField label="Порядок сортировки" value={form.sort_order} onChange={(v) => set("sort_order", v ?? 0)} />

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
    </EditorShell>
  )
}
