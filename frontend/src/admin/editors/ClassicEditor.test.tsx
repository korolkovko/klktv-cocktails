import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { ClassicAdminOut } from "./ClassicEditor"
import { ClassicEditor, fromAdminOut, toWriteIn } from "./ClassicEditor"

// Same lightweight approach as DrinkEditor.test.tsx (no jsdom/@testing-library
// in this project yet) — render to a static HTML string and assert on
// presence of key markup. `slug={null}` (new-classic mode) needs no fetch
// (the family-list fetch happens in its own effect and doesn't block first
// render), so this is a plain synchronous render.
describe("ClassicEditor (new classic)", () => {
  it("renders the blank template with every ClassicWriteIn field group and a disabled Save", () => {
    const html = renderToStaticMarkup(
      <ClassicEditor slug={null} onSaved={() => {}} onClose={() => {}} />
    )

    expect(html).toContain("Новый: Классика")

    for (const label of [
      "Слаг",
      "Название",
      "Семейство",
      "Год",
      "Происхождение",
      "Стакан (ключ)",
      "Порядок сортировки",
      "Состав",
      "Гарнир",
      "История",
      "Кому подойдёт",
    ]) {
      expect(html).toContain(label)
    }

    expect(html).toContain("Спириты (ключи)")
    expect(html).toContain("Дескрипторы")
    expect(html).toContain("Связанные напитки")

    // Blank slug/name/family → Save disabled until filled in.
    expect(html).toMatch(/Сохранить<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Сохранить/)
  })
})

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
describe("ClassicEditor year null round-trip", () => {
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
describe("ClassicEditor full-body round-trip", () => {
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
