import { describe, expect, it } from "vitest"

import type { CategoryRow } from "./CategoriesPage"
import { reorderedKeys } from "./CategoriesPage"

// Pure-helper test only (kit page can't be renderToStaticMarkup'd under
// node-vitest). `reorderedKeys` is the reorder logic that feeds
// adminApi.reorderCategories — the one non-trivial pure bit of CategoriesPage.

function rows(...keys: string[]): CategoryRow[] {
  return keys.map((key, i) => ({
    id: i + 1,
    key,
    label: key,
    kind: "menu",
    sort_order: i,
    is_visible: true,
  }))
}

describe("reorderedKeys", () => {
  const rs = rows("a", "b", "c", "d")

  it("moves a middle row up (swaps with the previous)", () => {
    expect(reorderedKeys(rs, 2, -1)).toEqual(["a", "c", "b", "d"])
  })

  it("moves a middle row down (swaps with the next)", () => {
    expect(reorderedKeys(rs, 1, 1)).toEqual(["a", "c", "b", "d"])
  })

  it("returns null when moving the first row up (off the top)", () => {
    expect(reorderedKeys(rs, 0, -1)).toBeNull()
  })

  it("returns null when moving the last row down (off the bottom)", () => {
    expect(reorderedKeys(rs, 3, 1)).toBeNull()
  })

  it("does not mutate the input array", () => {
    const before = rs.map((r) => r.key)
    reorderedKeys(rs, 2, -1)
    expect(rs.map((r) => r.key)).toEqual(before)
  })
})
