import { describe, expect, it } from "vitest"

import {
  formatLastSeen,
  identityOf,
  initialsOf,
  isSelf,
  MIN_PASSWORD_LENGTH,
  toCreateBody,
  toUpdateBody,
  type UserOut,
} from "./UsersPage"

// UsersPage is now built on the kit's §54 EntityTable (see block-users
// reference). EntityTable/Fab/ResponsiveDialog/ResponsiveSelect all call
// useIsMobile() unconditionally on every render, which reads
// `window.matchMedia` with no lazy/SSR guard — and this project's vitest
// suite runs in the plain "node" test environment (no jsdom/happy-dom
// installed), so any renderToStaticMarkup of those components throws
// "window is not defined". That's a gap in the test environment, not a
// runtime bug (the browser always has window/matchMedia) — so instead of
// rendering the page, the wiring logic that feeds EntityTable is pulled out
// into pure, exported functions (identityOf/initialsOf) and asserted
// directly here, same as the other UsersPage helpers below.
const baseUser: UserOut = {
  id: 1,
  username: "editor1",
  name: "Editor One",
  role: "editor",
  created_at: "2026-01-01T00:00:00Z",
  last_seen_at: null,
}

describe("initialsOf (EntityTable identity avatar)", () => {
  it("takes the first letter of the first two words of a display name", () => {
    expect(initialsOf("Editor One")).toBe("EO")
  })

  it("falls back to the first two characters for a single-word name/username", () => {
    expect(initialsOf("kolya")).toBe("KO")
  })

  it("renders a placeholder for a blank input", () => {
    expect(initialsOf("   ")).toBe("?")
  })
})

describe("identityOf (EntityTable identity mapping)", () => {
  it("prefers the display name, falls back to the username, and prefixes sub with @", () => {
    const id = identityOf(baseUser, "kolya")
    expect(id.name).toBe("Editor One")
    expect(id.sub).toBe("@editor1")
    expect(id.initials).toBe("EO")
    expect(id.accent).toBe(false)
  })

  it("falls back to the username when name is null", () => {
    const id = identityOf({ ...baseUser, name: null }, "kolya")
    expect(id.name).toBe("editor1")
    expect(id.initials).toBe("ED")
  })

  it("accents the signed-in user's own row", () => {
    const id = identityOf(baseUser, "editor1")
    expect(id.accent).toBe(true)
  })
})

// Row-action visibility never depends on data the effect hasn't fetched yet,
// so it's tested via the exported pure predicate rather than a full render —
// this is what both the table row's "Удалить" button and the edit modal's
// role-lock/onDelete branch key off of.
describe("isSelf (own-row protection)", () => {
  it("matches the signed-in user's own username", () => {
    expect(isSelf("kolya", "kolya")).toBe(true)
  })

  it("does not match another user's row", () => {
    expect(isSelf("kolya", "editor1")).toBe(false)
  })

  it("treats a missing currentUsername as never self", () => {
    expect(isSelf("kolya", null)).toBe(false)
    expect(isSelf("kolya", undefined)).toBe(false)
  })
})

describe("formatLastSeen", () => {
  it("renders — for null (never seen)", () => {
    expect(formatLastSeen(null)).toBe("—")
  })

  it("renders — for an unparseable value", () => {
    expect(formatLastSeen("not-a-date")).toBe("—")
  })

  it("renders a same-day timestamp as сегодня", () => {
    expect(formatLastSeen(new Date().toISOString())).toBe("сегодня")
  })

  it("falls back to a ru-RU date once a week has passed", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString()
    expect(formatLastSeen(eightDaysAgo)).toBe(new Date(eightDaysAgo).toLocaleDateString("ru-RU"))
  })
})

// Core rules from the task-10 brief:
// - a blank password field means "keep current password" — the PATCH body
//   must omit `password` entirely, not send an empty string. A non-blank
//   field means "reset", and must be sent (trimmed).
// - `name` must always be sent as a string, never `null` — UserUpdateIn is a
//   PARTIAL-update schema (admin_users.py's `update_user` only applies
//   `name` under `if data.name is not None:`), so a literal `null` reads as
//   "not supplied" and a clear silently no-ops. Sending `""` passes that
//   guard, and the backend's own assignment (`obj.name = data.name or None`)
//   normalises it to NULL — so `""` is what actually persists the clear.
describe("toUpdateBody password handling", () => {
  const baseForm = { username: "editor1", name: "Editor One", role: "editor" as const, password: "" }

  it("omits password when the reset field is left blank", () => {
    const body = toUpdateBody(baseForm)
    expect(body).toEqual({ role: "editor", name: "Editor One" })
    expect("password" in body).toBe(false)
  })

  it("omits password when the reset field is only whitespace", () => {
    const body = toUpdateBody({ ...baseForm, password: "   " })
    expect("password" in body).toBe(false)
  })

  it("includes a trimmed password when the reset field is non-blank", () => {
    const body = toUpdateBody({ ...baseForm, password: "  newpass1  " })
    expect(body.password).toBe("newpass1")
  })
})

describe("toUpdateBody name handling (clearing must persist)", () => {
  const baseForm = { username: "editor1", name: "Editor One", role: "editor" as const, password: "" }

  it("sends a filled name as-is", () => {
    const body = toUpdateBody(baseForm)
    expect(body.name).toBe("Editor One")
    expect("name" in body).toBe(true)
  })

  it("sends a blank name as an empty string, not null, so the clear persists", () => {
    const body = toUpdateBody({ ...baseForm, name: "  " })
    expect(body.name).toBe("")
    expect(body.name).not.toBeNull()
    expect("name" in body).toBe(true)
  })
})

describe("toCreateBody", () => {
  it("normalises the username to lower-case, trimmed", () => {
    const body = toCreateBody({ username: "  Kolya  ", name: "", role: "admin", password: "secret1" })
    expect(body.username).toBe("kolya")
    expect(body.name).toBeNull()
    expect(body.role).toBe("admin")
    expect(body.password).toBe("secret1")
  })

  it("trims a padded password", () => {
    const body = toCreateBody({ username: "kolya", name: "", role: "admin", password: "  secret1  " })
    expect(body.password).toBe("secret1")
  })
})

describe("MIN_PASSWORD_LENGTH", () => {
  it("matches the backend's admin_users.py min_length=4", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(4)
  })
})
