import { describe, expect, it } from "vitest"

import { matchesArchiveView } from "./archive-filter"

// Pure-predicate tests — the ArchiveFilter component itself wraps ChipMenu
// (which wraps a Popover), so like every other kit page component it can't
// be renderToStaticMarkup'd under this repo's plain-node vitest. The
// predicate is the behaviour every page's filteredRows depends on.
describe("matchesArchiveView", () => {
  it('"active" matches only non-archived rows', () => {
    expect(matchesArchiveView(false, "active")).toBe(true)
    expect(matchesArchiveView(true, "active")).toBe(false)
  })

  it('"archived" matches only archived rows', () => {
    expect(matchesArchiveView(true, "archived")).toBe(true)
    expect(matchesArchiveView(false, "archived")).toBe(false)
  })

  it('"all" matches regardless of is_archived', () => {
    expect(matchesArchiveView(true, "all")).toBe(true)
    expect(matchesArchiveView(false, "all")).toBe(true)
  })
})
