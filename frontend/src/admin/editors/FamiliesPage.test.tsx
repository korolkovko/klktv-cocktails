import { describe, expect, it } from "vitest"

import type { FamilyAdminOut } from "./FamiliesPage"
import { fromAdminOut, toWriteIn, initialsOf } from "./FamiliesPage"

// Pure-mapper tests only — the kit-based FamiliesPage itself can't be
// renderToStaticMarkup'd (EntityTable/ResponsiveDialog/Fab call useIsMobile()/
// window with no SSR guard; this repo's vitest runs plain node). The form
// round-trip is the behaviour that matters and it's fully pure.

function makeRow(overrides: Partial<FamilyAdminOut> = {}): FamilyAdminOut {
  return {
    id: 1,
    key: "sour",
    label: "Сауры",
    sub: null,
    color: null,
    logic: null,
    evolution: null,
    tip: null,
    sort_order: 0,
    ...overrides,
  }
}

// Full-record PATCH: the backend `_apply_family` sets every column from the
// request body, so a save must thread every loaded field through unchanged.
describe("FamiliesPage full-body round-trip", () => {
  it("threads every loaded field through toWriteIn unchanged", () => {
    const row = makeRow({
      sub: "Кислые коктейли",
      color: "#C0A062",
      logic: "Кислота + сахар + крепкий алкоголь",
      evolution: "От Whiskey Sour до Pisco Sour",
      tip: "Начните с классики",
      sort_order: 4,
    })
    const body = toWriteIn(fromAdminOut(row))
    expect(body).toEqual({
      key: "sour",
      label: "Сауры",
      sub: "Кислые коктейли",
      color: "#C0A062",
      logic: "Кислота + сахар + крепкий алкоголь",
      evolution: "От Whiskey Sour до Pisco Sour",
      tip: "Начните с классики",
      sort_order: 4,
    })
  })

  it("collapses blank optional text fields to null, not empty strings", () => {
    const body = toWriteIn(fromAdminOut(makeRow()))
    expect(body.sub).toBeNull()
    expect(body.color).toBeNull()
    expect(body.logic).toBeNull()
    expect(body.evolution).toBeNull()
    expect(body.tip).toBeNull()
  })
})

describe("initialsOf", () => {
  it("takes first letters of the first two words, uppercased", () => {
    expect(initialsOf("Кислые коктейли")).toBe("КК")
  })
  it("falls back to the first two chars of a single word", () => {
    expect(initialsOf("Сауры")).toBe("СА")
  })
  it("returns ? for empty", () => {
    expect(initialsOf("   ")).toBe("?")
  })
})
