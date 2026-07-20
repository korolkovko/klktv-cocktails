import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { DrinkAdminOut } from "./DrinkEditor"
import { DrinkEditor, fromAdminOut, toWriteIn } from "./DrinkEditor"

// Same lightweight approach as EntityList.test.tsx (no jsdom/@testing-library
// in this project yet) — render to a static HTML string and assert on
// presence of key markup. `slug={null}` (new-drink mode) needs no fetch, so
// it's a plain synchronous first render — no async/effect flushing needed.
describe("DrinkEditor (new drink)", () => {
  it("renders the blank template with every DrinkWriteIn field group and a disabled Save", () => {
    const html = renderToStaticMarkup(
      <DrinkEditor slug={null} onSaved={() => {}} onClose={() => {}} />
    )

    expect(html).toContain("Новый: Авторские")

    // Text/TextArea fields
    for (const label of [
      "Слаг",
      "Название",
      "Подзаголовок",
      "Крепость (как в меню)",
      "Цена (как в меню)",
      "Валюта",
      "Рецепт",
      "Гарнир",
      "Питч",
      "О коктейле",
      "Происхождение названия",
      "FAQ",
    ]) {
      expect(html).toContain(label)
    }

    // Number fields
    expect(html).toContain("Объём, мл")
    expect(html).toContain("Уровень кофеина")
    expect(html).toContain("Порядок сортировки")

    // Checkboxes
    expect(html).toContain("Алкогольный")
    expect(html).toContain("Zero Culture")

    // Tri-state is_carbonated select (Fix 1) — a new drink defaults to the
    // "не указано" (null) option, not a checked/unchecked box.
    expect(html).toContain("Газация")
    expect(html).toContain("Газированный")
    expect(html).toContain("Без газа")
    expect(html).toContain("— / не указано")

    // Image upload + relation tags + repeatable details
    expect(html).toContain("Логотип")
    expect(html).toContain("Фото коктейля")
    expect(html).toContain("Спириты (ключи)")
    expect(html).toContain("Вкусы")
    expect(html).toContain("Теги")
    expect(html).toContain("Детали")

    // Blank slug/name → Save disabled until filled in.
    expect(html).toMatch(/Сохранить<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Сохранить/)
  })
})

// A full DrinkAdminOut as the backend would return it for a typical
// alcoholic-origin drink: is_carbonated is NULL (never set for these), and
// price_currency carries whatever the row was saved with (not necessarily
// the "₽" default).
function makeRow(overrides: Partial<DrinkAdminOut> = {}): DrinkAdminOut {
  return {
    id: 1,
    slug: "old-fashioned",
    name: "Олд Фешн",
    img: null,
    photo: null,
    subtitle: null,
    abv_raw: "40%",
    abv: 40,
    price_raw: "450 ₽",
    price_amount: 450,
    price_currency: "₽",
    volume_ml: 250,
    glass: null,
    badge: null,
    sort_order: 0,
    is_alcoholic: true,
    is_zero_culture: false,
    caffeine_level: null,
    is_carbonated: null,
    recipe: null,
    garnish: null,
    pitch: null,
    about: null,
    naming: null,
    faq: null,
    spirits: [],
    flavors: [],
    tags: [],
    details: [],
    ...overrides,
  }
}

// Fix 1 (Critical): is_carbonated is tri-state (boolean | null) in the DB —
// NULL for every alcoholic-origin drink. Loading a row via fromAdminOut and
// immediately saving it back via toWriteIn must NOT collapse that null to
// false, or every save of an alcoholic drink silently writes a wrong
// "Без газа" state that the guest detail sheet then displays.
describe("DrinkEditor is_carbonated tri-state round-trip", () => {
  it("preserves a loaded null through to the saved body (does not coerce to false)", () => {
    const row = makeRow({ is_carbonated: null })
    const form = fromAdminOut(row)
    expect(form.is_carbonated).toBeNull()
    const body = toWriteIn(form)
    expect(body.is_carbonated).toBeNull()
  })

  it("still preserves explicit true/false (zero-culture drinks)", () => {
    for (const value of [true, false]) {
      const row = makeRow({ is_carbonated: value, is_alcoholic: false, is_zero_culture: true })
      const form = fromAdminOut(row)
      expect(form.is_carbonated).toBe(value)
      const body = toWriteIn(form)
      expect(body.is_carbonated).toBe(value)
    }
  })
})

// Fix 2 (Important): the backend PATCH is a full-record write that always
// sets obj.price_currency = data.price_currency. Omitting it from the body
// silently resets any non-default currency to the schema default "₽" on
// every save. Loading a row and saving it back must round-trip whatever
// currency was loaded, unchanged.
describe("DrinkEditor price_currency round-trip", () => {
  it("threads a non-default loaded currency through to the saved body unchanged", () => {
    const row = makeRow({ price_currency: "$" })
    const form = fromAdminOut(row)
    expect(form.price_currency).toBe("$")
    const body = toWriteIn(form)
    expect(body.price_currency).toBe("$")
  })

  it("defaults a new drink's body to the schema default currency", () => {
    const html = renderToStaticMarkup(
      <DrinkEditor slug={null} onSaved={() => {}} onClose={() => {}} />
    )
    expect(html).toMatch(/value="₽"/)
  })
})
