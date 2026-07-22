import { describe, expect, it } from "vitest"

import type { ClassicAdminOut } from "./ClassicsPage"
import { fromAdminOut, toWriteIn } from "./ClassicsPage"

// Pure-mapper tests only — the kit-based ClassicsPage itself can't be
// renderToStaticMarkup'd (EntityTable/ResponsiveDialog/Fab call useIsMobile()/
// window with no SSR guard; this repo's vitest runs plain node). The form
// round-trip is the behaviour that matters and it's fully pure. Ported
// verbatim from the retired ClassicEditor.test.tsx (dropping its
// renderToStaticMarkup template-markup test, which doesn't apply here).

function makeRow(overrides: Partial<ClassicAdminOut> = {}): ClassicAdminOut {
  return {
    id: 1,
    slug: "old-fashioned",
    name: "Олд Фешн",
    family: "old-fashioned-family",
    year: null,
    origin: null,
    composition: null,
    glass: null,
    garnish: null,
    history: null,
    for_whom: null,
    sort_order: 0,
    spirits: [],
    descriptors: [],
    related_drinks: [],
    ...overrides,
  }
}

// `year` is int|None in ClassicWriteIn — a classic with an unknown/unrecorded
// year must round-trip `null` through load->save, never collapse to `0`
// (NumberField maps ""<->null; the tri-state is_carbonated review fix from
// Task 8 is the precedent this guards against for every nullable numeric
// field going forward).
describe("ClassicsPage year null round-trip", () => {
  it("preserves a loaded null year through to the saved body (does not coerce to 0)", () => {
    const row = makeRow({ year: null })
    const form = fromAdminOut(row)
    expect(form.year).toBeNull()
    const body = toWriteIn(form)
    expect(body.year).toBeNull()
  })

  it("still preserves an explicit numeric year, including 0", () => {
    for (const value of [1862, 0]) {
      const row = makeRow({ year: value })
      const form = fromAdminOut(row)
      expect(form.year).toBe(value)
      const body = toWriteIn(form)
      expect(body.year).toBe(value)
    }
  })
})

// Full-record PATCH lesson (DrinkEditor review Fix 2 precedent): the backend
// `_apply_classic` sets every column from the request body, so a save must
// thread every loaded field through unchanged, not just the ones a user
// edited in this session.
describe("ClassicsPage full-body round-trip", () => {
  it("threads every loaded field through toWriteIn unchanged", () => {
    const row = makeRow({
      origin: "Кентукки",
      composition: "бурбон, сахар, биттер",
      glass: "rocks",
      garnish: "цедра апельсина",
      history: "Классика 19 века",
      for_whom: "любителям крепкого",
      sort_order: 3,
      spirits: ["bourbon"],
      descriptors: ["крепкий"],
      related_drinks: ["dieter"],
    })
    const body = toWriteIn(fromAdminOut(row))
    expect(body).toEqual({
      slug: "old-fashioned",
      name: "Олд Фешн",
      family: "old-fashioned-family",
      year: null,
      origin: "Кентукки",
      composition: "бурбон, сахар, биттер",
      glass: "rocks",
      garnish: "цедра апельсина",
      history: "Классика 19 века",
      for_whom: "любителям крепкого",
      sort_order: 3,
      spirits: ["bourbon"],
      descriptors: ["крепкий"],
      related_drinks: ["dieter"],
    })
  })
})
