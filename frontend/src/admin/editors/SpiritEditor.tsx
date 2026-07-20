import * as React from "react"

import { adminApi } from "../api"
import { NumberField, SelectField, TextArea, TextField } from "../components/FormFields"
import { ImageUploadField } from "../components/ImageUploadField"
import { EditorShell } from "../components/EditorShell"

// Clone of DrinkEditor's shape (Task 8) for spirit entries — self-contained,
// owns its own <EditorShell>, exposes only {slug, onSaved, onClose}.
// Field shapes mirror backend/app/schemas_admin.py's `SpiritEntryWriteIn` /
// `SpiritEntryAdminOut` one-for-one.
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
}

export interface SpiritEntryAdminOut extends SpiritEntryWriteIn {
  id: number
  abv: number | null
  price_amount: number | null
  serving_ml: number | null
}

export interface SpiritCategoryOption {
  slug: string
  label: string
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
}

// Exported so SpiritEditor.test.tsx can assert the load->save round-trip
// directly, without a jsdom/@testing-library harness this project doesn't
// have yet.
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
  }
}

export function SpiritEditor({
  slug,
  onSaved,
  onClose,
}: {
  slug: string | null
  onSaved: () => void
  onClose: () => void
}) {
  const mode = slug === null ? "new" : "edit"
  const [form, setForm] = React.useState<SpiritForm>(BLANK_FORM)
  const [categories, setCategories] = React.useState<SpiritCategoryOption[]>([])
  const [parsed, setParsed] = React.useState<{ abv: number | null; price_amount: number | null } | null>(
    null
  )
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    adminApi
      .list<SpiritCategoryOption>("spirit-categories")
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  React.useEffect(() => {
    let cancelled = false
    if (slug === null) {
      setForm(BLANK_FORM)
      setParsed(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    adminApi
      .get<SpiritEntryAdminOut>("spirits", slug)
      .then((row) => {
        if (cancelled) return
        setForm(fromAdminOut(row))
        setParsed({ abv: row.abv, price_amount: row.price_amount })
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

  function set<K extends keyof SpiritForm>(key: K, value: SpiritForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = toWriteIn(form)
      if (mode === "new") {
        await adminApi.create("spirits", body)
      } else {
        await adminApi.update("spirits", slug!, body)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const title = mode === "new" ? "Новый: Спирит" : `Редактирование: ${form.name || slug}`
  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.label }))

  return (
    <EditorShell
      title={title}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !form.slug.trim() || !form.name.trim() || !form.category}
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
              maxLength={80}
              hint={mode === "edit" ? "Ключ записи — не редактируется" : undefined}
            />
            <TextField label="Название" value={form.name} onChange={(v) => set("name", v)} required maxLength={256} />
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
                parsed && parsed.price_amount !== null
                  ? `Распознано: ${parsed.price_amount}`
                  : undefined
              }
            />
          </div>

          <ImageUploadField label="Фото" value={form.img} onChange={(v) => set("img", v)} />

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

          <NumberField label="Порядок сортировки" value={form.sort_order} onChange={(v) => set("sort_order", v ?? 0)} />

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
    </EditorShell>
  )
}

// ── Inline spirit-category management ─────────────────────────
// Small add/rename/archive/delete panel mounted above the spirits
// EntityList in AdminPage's "Спириты" tab (per task-9 brief — categories
// get no separate top-level tab). `SpiritCategoryWriteIn` is a full-record
// PATCH (slug, label, sort_order, is_archived all sent every time) —
// mirrors the "send every field" lesson from DrinkEditor's review.
export interface SpiritCategoryRow {
  slug: string
  label: string
  sort_order: number
  is_archived: boolean
}

export function SpiritCategoriesPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = React.useState<SpiritCategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [newSlug, setNewSlug] = React.useState("")
  const [newLabel, setNewLabel] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.list<SpiritCategoryRow>("spirit-categories")
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить категории")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function handleAdd() {
    const slug = newSlug.trim()
    const label = newLabel.trim()
    if (!slug || !label) return
    setError(null)
    try {
      await adminApi.create("spirit-categories", {
        slug,
        label,
        sort_order: rows.length,
        is_archived: false,
      })
      setNewSlug("")
      setNewLabel("")
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить категорию")
    }
  }

  async function handleRename(row: SpiritCategoryRow, label: string) {
    setError(null)
    try {
      await adminApi.update("spirit-categories", row.slug, { ...row, label })
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переименовать категорию")
    }
  }

  async function handleToggleArchived(row: SpiritCategoryRow) {
    setError(null)
    try {
      await adminApi.update("spirit-categories", row.slug, { ...row, is_archived: !row.is_archived })
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить статус категории")
    }
  }

  async function handleDelete(row: SpiritCategoryRow) {
    if (!window.confirm(`Удалить категорию «${row.label}»?`)) return
    setError(null)
    try {
      await adminApi.remove("spirit-categories", row.slug)
      await load()
      onChanged?.()
    } catch (e) {
      // 409 (non-empty category) surfaces here via lib/api.ts's Error(detail).
      setError(e instanceof Error ? e.message : "Не удалось удалить категорию")
    }
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Категории спиртов
      </h3>
      {error && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-xs text-gray-400">Загрузка…</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.slug} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-gray-400" title={row.slug}>
                {row.slug}
              </span>
              <input
                type="text"
                defaultValue={row.label}
                maxLength={128}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== row.label) void handleRename(row, v)
                }}
                className="w-full max-w-[14rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-gray-500"
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-gray-300"
                  checked={row.is_archived}
                  onChange={() => void handleToggleArchived(row)}
                />
                архив
              </label>
              <button
                type="button"
                onClick={() => void handleDelete(row)}
                className="shrink-0 text-xs font-medium text-red-600 underline hover:text-red-800"
              >
                Удалить
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="слаг"
              className="w-28 shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-gray-500"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="название"
              className="w-full max-w-[14rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-gray-500"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!newSlug.trim() || !newLabel.trim()}
              className="shrink-0 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              + Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
