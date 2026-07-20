import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { FamilyAdminOut } from "./FamilyEditor"
import { FamilyEditor, fromAdminOut, toWriteIn } from "./FamilyEditor"

// Same lightweight approach as DrinkEditor.test.tsx (no jsdom/@testing-library
// in this project yet). `fkey={null}` (new-family mode) needs no fetch, so
// it's a plain synchronous first render.
describe("FamilyEditor (new family)", () => {
  it("renders the blank template with every FamilyWriteIn field group and a disabled Save", () => {
    const html = renderToStaticMarkup(
      <FamilyEditor fkey={null} onSaved={() => {}} onClose={() => {}} />
    )

    expect(html).toContain("Новое: Семейство")

    for (const label of [
      "Ключ",
      "Название",
      "Подзаголовок",
      "Цвет",
      "Порядок сортировки",
      "Логика",
      "Эволюция",
      "Совет",
    ]) {
      expect(html).toContain(label)
    }

    // Blank key/label → Save disabled until filled in.
    expect(html).toMatch(/Сохранить<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Сохранить/)
  })
})

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

// Full-record PATCH lesson (DrinkEditor review Fix 2 precedent): the backend
// `_apply_family` sets every column from the request body, so a save must
// thread every loaded field through unchanged.
describe("FamilyEditor full-body round-trip", () => {
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
    const row = makeRow({ sub: null, color: null, logic: null, evolution: null, tip: null })
    const body = toWriteIn(fromAdminOut(row))
    expect(body.sub).toBeNull()
    expect(body.color).toBeNull()
    expect(body.logic).toBeNull()
    expect(body.evolution).toBeNull()
    expect(body.tip).toBeNull()
  })
})
