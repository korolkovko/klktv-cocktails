import { describe, expect, it } from "vitest"

import type { KitchenDishAdminOut } from "./KitchenPage"
import { fromAdminOut, initialsOf, toWriteIn } from "./KitchenPage"

// Pure-mapper tests only — the kit-based KitchenPage itself can't be
// renderToStaticMarkup'd (EntityTable/ResponsiveDialog/Fab/ResponsiveSelect
// call useIsMobile()/window with no SSR guard; this repo's vitest runs plain
// node). The form round-trip is the behaviour that matters and it's fully
// pure — ported from the retired KitchenEditor.test.tsx (its
// renderToStaticMarkup template test is dropped, not portable here).

function makeRow(overrides: Partial<KitchenDishAdminOut> = {}): KitchenDishAdminOut {
  return {
    id: 1,
    slug: "borsch",
    category: "soups",
    name: "Борщ",
    img: null,
    price_raw: "450 ₽",
    price_amount: 450,
    tagline: null,
    description: null,
    timing_raw: "20 мин",
    timing_min_low: 20,
    timing_min_high: 20,
    weight_raw: "300 г",
    weight_g: 300,
    nutrition_raw: null,
    kcal_portion: null,
    protein_g: null,
    fat_g: null,
    carb_g: null,
    kcal_100g: null,
    serving: null,
    interesting_facts: null,
    sort_order: 0,
    ...overrides,
  }
}

// The direct numeric nutrition overrides (kcal_portion/protein_g/fat_g/
// carb_g/kcal_100g) are float|None in KitchenDishWriteIn — when unset, the
// backend falls back to values parsed from `nutrition_raw`
// (_apply_kitchen_dish). Saving a dish that never had explicit overrides
// must round-trip that unset state as `null`, never `0` (0 would win over
// the parsed values and silently zero out the dish's displayed nutrition —
// see the task-8 review's is_carbonated tri-state precedent).
describe("KitchenPage nutrition overrides null round-trip", () => {
  it("preserves loaded nulls for every nutrition override through to the saved body", () => {
    const row = makeRow({
      kcal_portion: null,
      protein_g: null,
      fat_g: null,
      carb_g: null,
      kcal_100g: null,
    })
    const form = fromAdminOut(row)
    expect(form.kcal_portion).toBeNull()
    expect(form.protein_g).toBeNull()
    expect(form.fat_g).toBeNull()
    expect(form.carb_g).toBeNull()
    expect(form.kcal_100g).toBeNull()

    const body = toWriteIn(form)
    expect(body.kcal_portion).toBeNull()
    expect(body.protein_g).toBeNull()
    expect(body.fat_g).toBeNull()
    expect(body.carb_g).toBeNull()
    expect(body.kcal_100g).toBeNull()
  })

  it("still preserves explicit numeric overrides, including 0", () => {
    const row = makeRow({ kcal_portion: 320, protein_g: 0, fat_g: 10.5, carb_g: 40, kcal_100g: 210 })
    const form = fromAdminOut(row)
    expect(form.kcal_portion).toBe(320)
    expect(form.protein_g).toBe(0)
    expect(form.fat_g).toBe(10.5)

    const body = toWriteIn(form)
    expect(body.kcal_portion).toBe(320)
    expect(body.protein_g).toBe(0)
    expect(body.fat_g).toBe(10.5)
    expect(body.carb_g).toBe(40)
    expect(body.kcal_100g).toBe(210)
  })
})

// Full-record PATCH lesson (DrinkEditor review Fix 2 precedent): the backend
// `_apply_kitchen_dish` sets every column from the request body, so a save
// must thread every loaded text field through unchanged too.
describe("KitchenPage full-body round-trip", () => {
  it("threads every loaded field through toWriteIn unchanged", () => {
    const row = makeRow({
      tagline: "Домашний",
      description: "Наваристый борщ",
      serving: "со сметаной",
      interesting_facts: "Украинское блюдо",
      nutrition_raw: "320 ккал / 100г",
    })
    const body = toWriteIn(fromAdminOut(row))
    expect(body).toEqual({
      slug: "borsch",
      category: "soups",
      name: "Борщ",
      img: null,
      price_raw: "450 ₽",
      tagline: "Домашний",
      description: "Наваристый борщ",
      timing_raw: "20 мин",
      weight_raw: "300 г",
      nutrition_raw: "320 ккал / 100г",
      kcal_portion: null,
      protein_g: null,
      fat_g: null,
      carb_g: null,
      kcal_100g: null,
      serving: "со сметаной",
      interesting_facts: "Украинское блюдо",
      sort_order: 0,
    })
  })
})

// New for the kit port (no analog in the retired KitchenEditor): feeds
// EntityTable's identity().initials, same pattern as FamiliesPage/UsersPage's
// own initialsOf.
describe("initialsOf (EntityTable identity avatar)", () => {
  it("takes the first letters of the first two words, uppercased", () => {
    expect(initialsOf("Куриный суп")).toBe("КС")
  })
  it("falls back to the first two chars of a single word", () => {
    expect(initialsOf("Борщ")).toBe("БО")
  })
  it("returns ? for empty", () => {
    expect(initialsOf("   ")).toBe("?")
  })
})
