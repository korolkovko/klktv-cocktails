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
  type EntityAction,
  type EntityColumn,
} from "@/components/kollektiv/entity-table"

import { adminApi } from "../api"
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextArea,
  TextField,
} from "../components/kit/form"
import { ImageField } from "../components/kit/image-field"
import { RelationTags } from "../components/kit/relation-tags"
import { ChipMenu } from "../components/kit/chip-menu"

// "Коктейли" tab — the FLAGSHIP content page (Phase 2), ported onto the kit
// EntityTable/ResponsiveDialog rhythm established by FamiliesPage (the
// content-page template) and UsersPage (toolbar filters + search). This is a
// pure RESKIN of the retired DrinkEditor.tsx: every mapper, the tri-state
// is_carbonated helpers, the SPIRIT_KEY_OPTIONS datalist and the
// DetailsEditor nested repeatable are ported VERBATIM (behavior-identical) —
// only the chrome (fields/buttons) moved onto the kit primitives.
//
// Field shapes mirror backend/app/schemas_admin.py's `DrinkWriteIn` /
// `DrinkAdminOut` one-for-one (kept local since there's no shared
// frontend/backend type package yet).
export interface DrinkDetailIn {
  label: string
  text: string
  sort_order: number
}

export interface DrinkWriteIn {
  slug: string
  name: string
  img: string | null
  photo: string | null
  subtitle: string | null
  abv_raw: string | null
  price_raw: string | null
  price_currency: string
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

export interface DrinkAdminOut extends DrinkWriteIn {
  id: number
  abv: number | null
  price_amount: number | null
}

// is_carbonated is tri-state in the DB: NULL for every alcoholic-origin
// drink (meaningless there — the guest detail sheet hides the pill
// entirely), and true/false only for zero-culture drinks ("Газированный" /
// "Без газа"). A plain checkbox can't represent "unset", so this maps the
// null/true/false space onto three explicit option keys; "unknown" round
// -trips back to `null`, never to `false` (see task-8 review Fix 1).
const CARBONATED_OPTIONS: { value: string; label: string }[] = [
  { value: "unknown", label: "— / не указано" },
  { value: "true", label: "Газированный" },
  { value: "false", label: "Без газа" },
]
export function carbonatedToOption(v: boolean | null): string {
  return v === null ? "unknown" : v ? "true" : "false"
}
export function optionToCarbonated(v: string): boolean | null {
  return v === "unknown" ? null : v === "true"
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
  price_currency: string
  volume_ml: number | null
  glass: string
  badge: string
  sort_order: number
  is_alcoholic: boolean
  is_zero_culture: boolean
  caffeine_level: number | null
  // Tri-state: null = "не указано" (the case for every alcoholic-origin
  // drink), true/false only meaningful for zero-culture drinks. Must be
  // preserved as null through load/save — see task-8 review fix (Fix 1).
  is_carbonated: boolean | null
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
  price_currency: "₽",
  volume_ml: null,
  glass: "",
  badge: "",
  sort_order: 0,
  is_alcoholic: true,
  is_zero_culture: false,
  caffeine_level: null,
  is_carbonated: null,
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

// Exported (alongside the tri-state helpers above) so DrinksPage.test.tsx
// can assert the load->save null round-trip directly, without needing a
// jsdom/@testing-library harness this project doesn't have yet.
export function fromAdminOut(row: DrinkAdminOut): DrinkForm {
  return {
    slug: row.slug,
    name: row.name,
    img: row.img,
    photo: row.photo,
    subtitle: row.subtitle ?? "",
    abv_raw: row.abv_raw ?? "",
    price_raw: row.price_raw ?? "",
    price_currency: row.price_currency,
    volume_ml: row.volume_ml,
    glass: row.glass ?? "",
    badge: row.badge ?? "",
    sort_order: row.sort_order,
    is_alcoholic: row.is_alcoholic,
    is_zero_culture: row.is_zero_culture,
    caffeine_level: row.caffeine_level,
    // Preserve null as-is — do NOT collapse to false (see Fix 1 above).
    is_carbonated: row.is_carbonated,
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

export function toWriteIn(form: DrinkForm): DrinkWriteIn {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    img: form.img,
    photo: form.photo,
    subtitle: form.subtitle.trim() || null,
    abv_raw: form.abv_raw.trim() || null,
    price_raw: form.price_raw.trim() || null,
    price_currency: form.price_currency.trim() || "₽",
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

// 2-letter avatar initials from the name (feeds EntityTable identity).
export function initialsOf(name: string): string {
  const t = name.trim()
  if (!t) return "?"
  const parts = t.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

// "алк" / "безалк" (+ " · zero" for the zero-culture variant) — feeds the
// АЛК/ZC column (desktop cell + mobile subtitle line).
function alcLabel(d: DrinkAdminOut): string {
  return (d.is_alcoholic ? "алк" : "безалк") + (d.is_zero_culture ? " · zero" : "")
}

// Nested repeatable sub-list: details[] = {label, text, sort_order} — ported
// VERBATIM (same add/update/remove logic as the retired DrinkEditor.tsx),
// re-skinned onto kit form fields + kit Buttons.
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
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-[0.06em] text-[#52525B]">
        Детали (карточки на странице коктейля)
      </span>
      <div className="flex flex-col gap-2">
        {value.map((row, i) => (
          <div key={i} className="rounded-lg border border-input p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="quiet" size="sm" onClick={() => remove(i)}>
                Убрать
              </Button>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <TextField label="Заголовок" value={row.label} onChange={(v) => update(i, { label: v })} />
              <NumberField
                label="Порядок"
                value={row.sort_order}
                onChange={(v) => update(i, { sort_order: v ?? 0 })}
              />
            </div>
            <TextArea label="Текст" value={row.text} onChange={(v) => update(i, { text: v })} rows={2} />
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={add} className="self-start">
        + Добавить деталь
      </Button>
    </div>
  )
}

type Editing = { mode: "new" } | { mode: "edit"; row: DrinkAdminOut } | null
type AlcFilter = "all" | "alco" | "non-alco"

const ALC_FILTER_OPTIONS: { value: AlcFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "alco", label: "Алк" },
  { value: "non-alco", label: "Безалк" },
]

interface ConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  onConfirm: () => void
}

export function DrinksPage() {
  const [rows, setRows] = React.useState<DrinkAdminOut[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<DrinkForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [alcFilter, setAlcFilter] = React.useState<AlcFilter>("all")
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<DrinkAdminOut>("drinks"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить коктейли")
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

  function openEdit(row: DrinkAdminOut) {
    setForm(fromAdminOut(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof DrinkForm>(key: K, value: DrinkForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function performDelete(row: DrinkAdminOut) {
    try {
      await adminApi.remove("drinks", row.slug)
      toast.success(`Удалено · ${row.name || row.slug}`)
      if (editing?.mode === "edit" && editing.row.slug === row.slug) setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить коктейль")
    }
  }

  function deleteFromForm(row: DrinkAdminOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.name || row.slug}?`,
      description: "Коктейль и его связи будут удалены безвозвратно.",
      onConfirm: () => void performDelete(row),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const body = toWriteIn(form)
      if (editing.mode === "new") {
        await adminApi.create("drinks", body)
        toast.success(`Коктейль создан · ${body.name}`)
      } else {
        await adminApi.update("drinks", editing.row.slug, body)
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
    editing?.mode === "new" ? !form.slug.trim() || !form.name.trim() : !form.name.trim()

  const q = search.trim().toLowerCase()
  const filteredRows = rows.filter((d) => {
    if (
      q &&
      !(
        d.name.toLowerCase().includes(q) ||
        d.slug.toLowerCase().includes(q) ||
        (d.subtitle ?? "").toLowerCase().includes(q)
      )
    )
      return false
    if (alcFilter === "alco" && !d.is_alcoholic) return false
    if (alcFilter === "non-alco" && d.is_alcoholic) return false
    return true
  })

  const columns: EntityColumn<DrinkAdminOut>[] = [
    {
      key: "alc",
      label: "АЛК/ZC",
      width: 120,
      mobile: "sub",
      render: (d) => <EntityMeta>{alcLabel(d)}</EntityMeta>,
      subText: (d) => alcLabel(d),
    },
    {
      key: "price",
      label: "ЦЕНА",
      width: 110,
      align: "right",
      mobile: "hidden",
      render: (d) => <EntityMeta>{d.price_raw ?? "—"}</EntityMeta>,
    },
  ]

  const actions: EntityAction<DrinkAdminOut>[] = [
    { label: "Изменить", onSelect: (d) => openEdit(d) },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      onSelect: (d) => void performDelete(d),
    },
  ]

  function resetFilters() {
    setSearch("")
    setAlcFilter("all")
  }

  const parsedAbv = editing?.mode === "edit" ? editing.row.abv : null
  const parsedPriceAmount = editing?.mode === "edit" ? editing.row.price_amount : null

  return (
    <div>
      <EntityTable
        rows={filteredRows}
        rowKey={(d) => d.slug}
        identity={(d) => ({
          name: d.name,
          sub: `#${d.slug}`,
          initials: initialsOf(d.name),
          avatar: (d.img ?? d.photo) ? (
            <img
              src={resolveImageUrl(d.img ?? d.photo)}
              alt=""
              className="size-full rounded-[inherit] object-cover"
            />
          ) : undefined,
        })}
        identityLabel="КОКТЕЙЛЬ"
        columns={columns}
        actions={actions}
        onRowClick={(d) => openEdit(d)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Поиск ${rows.length} коктейлей…`,
        }}
        filters={
          <ChipMenu
            value={alcFilter}
            options={ALC_FILTER_OPTIONS}
            onChange={(v) => setAlcFilter(v as AlcFilter)}
            label="Алк"
          />
        }
        cta={<Button onClick={openNew}>+ Коктейль</Button>}
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
              {(search || alcFilter !== "all") && (
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
        aria-label="Новый коктейль"
        onClick={openNew}
      />

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новый коктейль"
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

            <TextField label="Подзаголовок" value={form.subtitle} onChange={(v) => set("subtitle", v)} />

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Крепость (как в меню)"
                value={form.abv_raw}
                onChange={(v) => set("abv_raw", v)}
                placeholder="напр. 40%"
                maxLength={32}
                hint={parsedAbv !== null ? `Распознано: ${parsedAbv}% ABV` : undefined}
              />
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <TextField
                  label="Цена (как в меню)"
                  value={form.price_raw}
                  onChange={(v) => set("price_raw", v)}
                  placeholder="напр. 450 ₽"
                  maxLength={64}
                  hint={parsedPriceAmount !== null ? `Распознано: ${parsedPriceAmount}` : undefined}
                />
                <TextField
                  label="Валюта"
                  value={form.price_currency}
                  onChange={(v) => set("price_currency", v)}
                  maxLength={8}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ImageField label="Логотип" value={form.img} onChange={(v) => set("img", v)} />
              <ImageField label="Фото коктейля" value={form.photo} onChange={(v) => set("photo", v)} />
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
              <SelectField
                label="Газация"
                value={carbonatedToOption(form.is_carbonated)}
                onChange={(v) => set("is_carbonated", optionToCarbonated(v))}
                options={CARBONATED_OPTIONS}
                hint="«— / не указано» = NULL (норма для алкогольных); задавайте true/false только для Zero Culture"
              />
            </div>

            <TextArea label="Рецепт" value={form.recipe} onChange={(v) => set("recipe", v)} />
            <TextArea label="Гарнир" value={form.garnish} onChange={(v) => set("garnish", v)} rows={2} />
            <TextArea label="Питч" value={form.pitch} onChange={(v) => set("pitch", v)} rows={3} />
            <TextArea label="О коктейле" value={form.about} onChange={(v) => set("about", v)} />
            <TextArea
              label="Происхождение названия"
              value={form.naming}
              onChange={(v) => set("naming", v)}
            />
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
