import * as React from "react"

import { adminApi } from "../api"
import { NumberField, SelectField, TextArea, TextField } from "../components/FormFields"
import { ImageUploadField } from "../components/ImageUploadField"
import { EditorShell } from "../components/EditorShell"

// Clone of DrinkEditor's shape (Task 8) for kitchen dishes — self-contained,
// owns its own <EditorShell>, exposes only {slug, onSaved, onClose}.
// Field shapes mirror backend/app/schemas_admin.py's `KitchenDishWriteIn` /
// `KitchenDishAdminOut` one-for-one.
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
}

export interface KitchenDishAdminOut extends KitchenDishWriteIn {
  id: number
  price_amount: number | null
  timing_min_low: number | null
  timing_min_high: number | null
  weight_g: number | null
}

export interface KitchenCategoryOption {
  slug: string
  label: string
}

// Nullable numeric overrides (kcal_portion/protein_g/fat_g/carb_g/kcal_100g)
// must round-trip `null` as `null`, never `0` — NumberField already maps
// ""<->null, so the form keeps them as number|null throughout (see task-8
// review Fix 1 precedent for is_carbonated / the task-9 brief's explicit
// nutrition-null-round-trip callout).
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
}

// Exported so KitchenEditor.test.tsx can assert the load->save null
// round-trip directly, without a jsdom/@testing-library harness this
// project doesn't have yet.
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
  }
}

export function KitchenEditor({
  slug,
  onSaved,
  onClose,
}: {
  slug: string | null
  onSaved: () => void
  onClose: () => void
}) {
  const mode = slug === null ? "new" : "edit"
  const [form, setForm] = React.useState<KitchenForm>(BLANK_FORM)
  const [categories, setCategories] = React.useState<KitchenCategoryOption[]>([])
  const [parsed, setParsed] = React.useState<{
    price_amount: number | null
    timing_min_low: number | null
    timing_min_high: number | null
    weight_g: number | null
  } | null>(null)
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    adminApi
      .list<KitchenCategoryOption>("kitchen-categories")
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
      .get<KitchenDishAdminOut>("kitchen-dishes", slug)
      .then((row) => {
        if (cancelled) return
        setForm(fromAdminOut(row))
        setParsed({
          price_amount: row.price_amount,
          timing_min_low: row.timing_min_low,
          timing_min_high: row.timing_min_high,
          weight_g: row.weight_g,
        })
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

  function set<K extends keyof KitchenForm>(key: K, value: KitchenForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = toWriteIn(form)
      if (mode === "new") {
        await adminApi.create("kitchen-dishes", body)
      } else {
        await adminApi.update("kitchen-dishes", slug!, body)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const title = mode === "new" ? "Новое: Кухня" : `Редактирование: ${form.name || slug}`
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

          <TextField label="Тэглайн" value={form.tagline} onChange={(v) => set("tagline", v)} />

          <ImageUploadField label="Фото" value={form.img} onChange={(v) => set("img", v)} />

          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Цена (как в меню)"
              value={form.price_raw}
              onChange={(v) => set("price_raw", v)}
              placeholder="напр. 450 ₽"
              maxLength={32}
              hint={parsed && parsed.price_amount !== null ? `Распознано: ${parsed.price_amount}` : undefined}
            />
            <TextField
              label="Время (как в меню)"
              value={form.timing_raw}
              onChange={(v) => set("timing_raw", v)}
              placeholder="напр. 15-20 мин"
              maxLength={32}
              hint={
                parsed && (parsed.timing_min_low !== null || parsed.timing_min_high !== null)
                  ? `Распознано: ${parsed.timing_min_low ?? "?"}–${parsed.timing_min_high ?? "?"} мин`
                  : undefined
              }
            />
            <TextField
              label="Вес (как в меню)"
              value={form.weight_raw}
              onChange={(v) => set("weight_raw", v)}
              placeholder="напр. 250 г"
              maxLength={64}
              hint={parsed && parsed.weight_g !== null ? `Распознано: ${parsed.weight_g} г` : undefined}
            />
          </div>

          <NumberField label="Порядок сортировки" value={form.sort_order} onChange={(v) => set("sort_order", v ?? 0)} />

          <TextArea label="Описание" value={form.description} onChange={(v) => set("description", v)} />
          <TextArea label="Подача" value={form.serving} onChange={(v) => set("serving", v)} rows={2} />
          <TextArea label="Интересные факты" value={form.interesting_facts} onChange={(v) => set("interesting_facts", v)} />

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
        </div>
      )}
    </EditorShell>
  )
}

// ── Inline kitchen-category management ────────────────────────
// Small add/rename/delete/sort_order panel mounted above the kitchen-dishes
// EntityList in AdminPage's "Кухня" tab (per task-9 brief — categories get
// no separate top-level tab). `KitchenCategoryWriteIn` is a full-record
// PATCH (slug, label, sort_order all sent every time) — mirrors the
// "send every field" lesson from DrinkEditor's review. Unlike spirit
// categories, kitchen categories have no `is_archived` flag and no
// dedicated reorder endpoint — sort_order is edited directly (brief:
// "reorder or sort_order").
export interface KitchenCategoryRow {
  slug: string
  label: string
  sort_order: number
}

export function KitchenCategoriesPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = React.useState<KitchenCategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [newSlug, setNewSlug] = React.useState("")
  const [newLabel, setNewLabel] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.list<KitchenCategoryRow>("kitchen-categories")
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
      await adminApi.create("kitchen-categories", { slug, label, sort_order: rows.length })
      setNewSlug("")
      setNewLabel("")
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить категорию")
    }
  }

  async function handleRename(row: KitchenCategoryRow, label: string) {
    setError(null)
    try {
      await adminApi.update("kitchen-categories", row.slug, { ...row, label })
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось переименовать категорию")
    }
  }

  async function handleReorder(row: KitchenCategoryRow, sort_order: number) {
    setError(null)
    try {
      await adminApi.update("kitchen-categories", row.slug, { ...row, sort_order })
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить порядок")
    }
  }

  async function handleDelete(row: KitchenCategoryRow) {
    if (!window.confirm(`Удалить категорию «${row.label}»?`)) return
    setError(null)
    try {
      await adminApi.remove("kitchen-categories", row.slug)
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
        Категории кухни
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
              <input
                type="number"
                defaultValue={row.sort_order}
                onBlur={(e) => {
                  const v = e.target.value === "" ? row.sort_order : Number(e.target.value)
                  if (v !== row.sort_order) void handleReorder(row, v)
                }}
                title="Порядок сортировки"
                className="w-16 shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-gray-500"
              />
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
