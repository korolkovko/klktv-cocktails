import { describe, expect, it } from "vitest"

import type { DrinkAdminOut } from "./DrinksPage"
import { fromAdminOut, toWriteIn } from "./DrinksPage"

// Pure-mapper tests ported from the retired DrinkEditor.test.tsx. This page
// can't be renderToStaticMarkup'd (EntityTable/Fab/ResponsiveDialog/
// ResponsiveSelect all call useIsMobile()/window with no SSR guard, and this
// repo's vitest runs in the plain "node" test environment — no jsdom/happy
// -dom installed) — so, as with FamiliesPage/UsersPage, the wiring logic here
// is exercised as pure functions (fromAdminOut/toWriteIn) instead of via
// rendering.

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
describe("DrinksPage is_carbonated tri-state round-trip", () => {
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
describe("DrinksPage price_currency round-trip", () => {
  it("threads a non-default loaded currency through to the saved body unchanged", () => {
    const row = makeRow({ price_currency: "$" })
    const form = fromAdminOut(row)
    expect(form.price_currency).toBe("$")
    const body = toWriteIn(form)
    expect(body.price_currency).toBe("$")
  })
})

// Full-body threading: a save must carry every loaded field through
// unchanged (the backend's `_apply_drink` is a full-record PATCH), including
// the details[] sub-list and the M:N relation arrays.
describe("DrinksPage full-body threading", () => {
  it("threads every field (including details[] and relations) unchanged on load->save", () => {
    const row = makeRow({
      subtitle: "Классика",
      volume_ml: 300,
      glass: "rocks",
      badge: "hit",
      caffeine_level: 0,
      recipe: "recipe text",
      garnish: "orange peel",
      pitch: "pitch text",
      about: "about text",
      naming: "naming text",
      faq: "faq text",
      spirits: ["bourbon"],
      flavors: ["сладкий"],
      tags: ["хит"],
      details: [{ label: "История", text: "текст", sort_order: 0 }],
    })
    const form = fromAdminOut(row)
    const body = toWriteIn(form)
    expect(body).toEqual({
      slug: row.slug,
      name: row.name,
      img: row.img,
      photo: row.photo,
      subtitle: row.subtitle,
      abv_raw: row.abv_raw,
      price_raw: row.price_raw,
      price_currency: row.price_currency,
      volume_ml: row.volume_ml,
      glass: row.glass,
      badge: row.badge,
      sort_order: row.sort_order,
      is_alcoholic: row.is_alcoholic,
      is_zero_culture: row.is_zero_culture,
      caffeine_level: row.caffeine_level,
      is_carbonated: row.is_carbonated,
      recipe: row.recipe,
      garnish: row.garnish,
      pitch: row.pitch,
      about: row.about,
      naming: row.naming,
      faq: row.faq,
      spirits: row.spirits,
      flavors: row.flavors,
      tags: row.tags,
      details: row.details,
    })
  })
})
