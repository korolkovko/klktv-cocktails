import * as React from "react"

import { adminApi } from "../api"
import { CheckboxField, NumberField, TextArea, TextField } from "../components/FormFields"
import { ImageUploadField } from "../components/ImageUploadField"
import { RelationTags } from "../components/RelationTags"
import { EditorShell } from "../components/EditorShell"

// Template editor (Task 8) — Task 9 clones this shape for
// classics/spirits/kitchen/families: a self-contained component that owns
// its own <EditorShell> (title + Save/Cancel chrome), loads/saves through
// `adminApi`, and exposes only `{slug, onSaved, onClose}` to its host tab.
// AdminPage no longer renders EditorShell for the "drinks" tab — it just
// mounts <DrinkEditor> and lets it manage its own modal lifecycle. Delete
// stays exclusively on `EntityList`'s row action (AdminPage's `handleDelete`)
// — this editor has no delete button of its own.
//
// Field shapes mirror backend/app/schemas_admin.py's `DrinkWriteIn` /
// `DrinkAdminOut` one-for-one (kept local since there's no shared
// frontend/backend type package yet).
interface DrinkDetailIn {
  label: string
  text: string
  sort_order: number
}

interface DrinkWriteIn {
  slug: string
  name: string
  img: string | null
  photo: string | null
  subtitle: string | null
  abv_raw: string | null
  price_raw: string | null
  // price_currency intentionally omitted here — hidden/optional field,
  // default "₽" (see task-8 brief). Not exposed in the UI, so never sent;
  // the backend's Pydantic default applies on every create/update.
  volume_ml: number | null
  glass: string | null
  badge: string | null
  sort_order: number
  is_alcoholic: boolean
  is_zero_culture: boolean
  caffeine_level: number | null
  is_carbonated: boolean | null
  recipe: string | null
  garnish: string | null
  pitch: string | null
  about: string | null
  naming: string | null
  faq: string | null
  spirits: string[]
  flavors: string[]
  tags: string[]
  details: DrinkDetailIn[]
}

interface DrinkAdminOut extends DrinkWriteIn {
  id: number
  abv: number | null
  price_amount: number | null
}

// Free-text RelationTags fields still get-or-create on the backend for any
// value — this is just a <datalist> hint for the common spirit keys.
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

// Editable form state: nullable text fields collapse to "" (TextField/
// TextArea don't accept null); everything else maps 1:1 onto DrinkWriteIn.
interface DrinkForm {
  slug: string
  name: string
  img: string | null
  photo: string | null
  subtitle: string
  abv_raw: string
  price_raw: string
  volume_ml: number | null
  glass: string
  badge: string
  sort_order: number
  is_alcoholic: boolean
  is_zero_culture: boolean
  caffeine_level: number | null
  is_carbonated: boolean
  recipe: string
  garnish: string
  pitch: string
  about: string
  naming: string
  faq: string
  spirits: string[]
  flavors: string[]
  tags: string[]
  details: DrinkDetailIn[]
}

const BLANK_FORM: DrinkForm = {
  slug: "",
  name: "",
  img: null,
  photo: null,
  subtitle: "",
  abv_raw: "",
  price_raw: "",
  volume_ml: null,
  glass: "",
  badge: "",
  sort_order: 0,
  is_alcoholic: true,
  is_zero_culture: false,
  caffeine_level: null,
  is_carbonated: false,
  recipe: "",
  garnish: "",
  pitch: "",
  about: "",
  naming: "",
  faq: "",
  spirits: [],
  flavors: [],
  tags: [],
  details: [],
}

function fromAdminOut(row: DrinkAdminOut): DrinkForm {
  return {
    slug: row.slug,
    name: row.name,
    img: row.img,
    photo: row.photo,
    subtitle: row.subtitle ?? "",
    abv_raw: row.abv_raw ?? "",
    price_raw: row.price_raw ?? "",
    volume_ml: row.volume_ml,
    glass: row.glass ?? "",
    badge: row.badge ?? "",
    sort_order: row.sort_order,
    is_alcoholic: row.is_alcoholic,
    is_zero_culture: row.is_zero_culture,
    caffeine_level: row.caffeine_level,
    is_carbonated: row.is_carbonated ?? false,
    recipe: row.recipe ?? "",
    garnish: row.garnish ?? "",
    pitch: row.pitch ?? "",
    about: row.about ?? "",
    naming: row.naming ?? "",
    faq: row.faq ?? "",
    spirits: row.spirits,
    flavors: row.flavors,
    tags: row.tags,
    details: row.details,
  }
}

function toWriteIn(form: DrinkForm): DrinkWriteIn {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    img: form.img,
    photo: form.photo,
    subtitle: form.subtitle.trim() || null,
    abv_raw: form.abv_raw.trim() || null,
    price_raw: form.price_raw.trim() || null,
    volume_ml: form.volume_ml,
    glass: form.glass.trim() || null,
    badge: form.badge.trim() || null,
    sort_order: form.sort_order,
    is_alcoholic: form.is_alcoholic,
    is_zero_culture: form.is_zero_culture,
    caffeine_level: form.caffeine_level,
    is_carbonated: form.is_carbonated,
    recipe: form.recipe.trim() || null,
    garnish: form.garnish.trim() || null,
    pitch: form.pitch.trim() || null,
    about: form.about.trim() || null,
    naming: form.naming.trim() || null,
    faq: form.faq.trim() || null,
    spirits: form.spirits,
    flavors: form.flavors,
    tags: form.tags,
    details: form.details,
  }
}

function DetailsEditor({
  value,
  onChange,
}: {
  value: DrinkDetailIn[]
  onChange: (next: DrinkDetailIn[]) => void
}) {
  function update(i: number, patch: Partial<DrinkDetailIn>) {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...value, { label: "", text: "", sort_order: value.length }])
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-600">
        Детали (карточки на странице коктейля)
      </span>
      <div className="space-y-2">
        {value.map((row, i) => (
          <div key={i} className="rounded border border-gray-200 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">#{i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs font-medium text-red-600 underline hover:text-red-800"
              >
                Убрать
              </button>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <TextField
                label="Заголовок"
                value={row.label}
                onChange={(v) => update(i, { label: v })}
              />
              <NumberField
                label="Порядок"
                value={row.sort_order}
                onChange={(v) => update(i, { sort_order: v ?? 0 })}
              />
            </div>
            <TextArea
              label="Текст"
              value={row.text}
              onChange={(v) => update(i, { text: v })}
              rows={2}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        + Добавить деталь
      </button>
    </div>
  )
}

export function DrinkEditor({
  slug,
  onSaved,
  onClose,
}: {
  slug: string | null
  onSaved: () => void
  onClose: () => void
}) {
  const mode = slug === null ? "new" : "edit"
  const [form, setForm] = React.useState<DrinkForm>(BLANK_FORM)
  const [parsed, setParsed] = React.useState<{ abv: number | null; price_amount: number | null } | null>(
    null
  )
  const [loading, setLoading] = React.useState(mode === "edit")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
      .get<DrinkAdminOut>("drinks", slug)
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

  function set<K extends keyof DrinkForm>(key: K, value: DrinkForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = toWriteIn(form)
      if (mode === "new") {
        await adminApi.create("drinks", body)
      } else {
        await adminApi.update("drinks", slug!, body)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const title = mode === "new" ? "Новый: Авторские" : `Редактирование: ${form.name || slug}`

  return (
    <EditorShell
      title={title}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={loading || !form.slug.trim() || !form.name.trim()}
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

          <TextField label="Подзаголовок" value={form.subtitle} onChange={(v) => set("subtitle", v)} />

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
              placeholder="напр. 450 ₽"
              maxLength={64}
              hint={
                parsed && parsed.price_amount !== null
                  ? `Распознано: ${parsed.price_amount}`
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ImageUploadField label="Логотип" value={form.img} onChange={(v) => set("img", v)} />
            <ImageUploadField label="Фото коктейля" value={form.photo} onChange={(v) => set("photo", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Объём, мл"
              value={form.volume_ml}
              onChange={(v) => set("volume_ml", v)}
              min={0}
            />
            <NumberField
              label="Порядок сортировки"
              value={form.sort_order}
              onChange={(v) => set("sort_order", v ?? 0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Стакан (ключ)"
              value={form.glass}
              onChange={(v) => set("glass", v)}
              hint="Будет создан автоматически, если такого ключа ещё нет"
            />
            <TextField
              label="Бейдж (ключ)"
              value={form.badge}
              onChange={(v) => set("badge", v)}
              hint="Будет создан автоматически, если такого ключа ещё нет"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CheckboxField
              label="Алкогольный"
              checked={form.is_alcoholic}
              onChange={(v) => set("is_alcoholic", v)}
            />
            <CheckboxField
              label="Zero Culture (безалк. версия)"
              checked={form.is_zero_culture}
              onChange={(v) => set("is_zero_culture", v)}
            />
            <NumberField
              label="Уровень кофеина"
              value={form.caffeine_level}
              onChange={(v) => set("caffeine_level", v)}
              min={0}
            />
            <CheckboxField
              label="Газированный"
              checked={form.is_carbonated}
              onChange={(v) => set("is_carbonated", v)}
            />
          </div>

          <TextArea label="Рецепт" value={form.recipe} onChange={(v) => set("recipe", v)} />
          <TextArea label="Гарнир" value={form.garnish} onChange={(v) => set("garnish", v)} rows={2} />
          <TextArea label="Питч" value={form.pitch} onChange={(v) => set("pitch", v)} rows={3} />
          <TextArea label="О коктейле" value={form.about} onChange={(v) => set("about", v)} />
          <TextArea label="Происхождение названия" value={form.naming} onChange={(v) => set("naming", v)} />
          <TextArea label="FAQ" value={form.faq} onChange={(v) => set("faq", v)} />

          <RelationTags
            label="Спириты (ключи)"
            value={form.spirits}
            onChange={(v) => set("spirits", v)}
            options={SPIRIT_KEY_OPTIONS}
            placeholder="gin, rum, …"
          />
          <RelationTags
            label="Вкусы"
            value={form.flavors}
            onChange={(v) => set("flavors", v)}
            placeholder="сладкий, кислый, …"
          />
          <RelationTags
            label="Теги"
            value={form.tags}
            onChange={(v) => set("tags", v)}
            placeholder="хит, новинка, …"
          />

          <DetailsEditor value={form.details} onChange={(v) => set("details", v)} />
        </div>
      )}
    </EditorShell>
  )
}
