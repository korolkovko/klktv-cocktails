import { describe, expect, it } from "vitest"

import type { SpiritEntryAdminOut } from "./SpiritsPage"
import { fromAdminOut, toWriteIn } from "./SpiritsPage"

// Pure-mapper tests only, ported from the retired SpiritEditor.test.tsx —
// the render-a-blank-template test there can't carry over (the kit's
// EntityTable/ResponsiveDialog/Fab call useIsMobile()/window with no SSR
// guard, and this repo's vitest runs plain node, not jsdom). The full-body
// round-trip is the behaviour that matters and it's fully pure.

function makeRow(overrides: Partial<SpiritEntryAdminOut> = {}): SpiritEntryAdminOut {
  return {
    id: 1,
    slug: "havana-club-7",
    category: "rum",
    name: "Havana Club 7",
    img: null,
    abv_raw: "40%",
    abv: 40,
    price_raw: "50 мл / 450 ₽",
    price_amount: 450,
    serving_ml: 50,
    flavour: null,
    brand: null,
    country: null,
    description: null,
    features: null,
    cocktail_pairings: null,
    fact: null,
    source_url: null,
    sort_order: 0,
    ...overrides,
  }
}

// Full-record PATCH lesson (DrinkEditor review Fix 2 precedent): the backend
// `_apply_spirit` sets every column from the request body, so a save must
// thread every loaded field through unchanged, including the ones this page
// renders as plain TextFields/TextAreas (brand/country/source_url/flavour/
// description/features/cocktail_pairings/fact).
describe("SpiritsPage full-body round-trip", () => {
  it("threads every loaded field through toWriteIn unchanged", () => {
    const row = makeRow({
      brand: "Havana Club",
      country: "Куба",
      description: "Выдержанный ром",
      features: "Ванильные ноты",
      cocktail_pairings: "Дайкири, Мохито",
      fact: "Выдержка 7 лет",
      source_url: "https://example.com/havana-club-7",
      sort_order: 2,
    })
    const body = toWriteIn(fromAdminOut(row))
    expect(body).toEqual({
      slug: "havana-club-7",
      category: "rum",
      name: "Havana Club 7",
      img: null,
      abv_raw: "40%",
      price_raw: "50 мл / 450 ₽",
      flavour: null,
      brand: "Havana Club",
      country: "Куба",
      description: "Выдержанный ром",
      features: "Ванильные ноты",
      cocktail_pairings: "Дайкири, Мохито",
      fact: "Выдержка 7 лет",
      source_url: "https://example.com/havana-club-7",
      sort_order: 2,
    })
  })
})
