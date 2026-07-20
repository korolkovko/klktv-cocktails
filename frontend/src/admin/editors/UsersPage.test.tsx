import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  formatLastSeen,
  isSelf,
  MIN_PASSWORD_LENGTH,
  toCreateBody,
  toUpdateBody,
  UsersPage,
} from "./UsersPage"

// Same lightweight approach as CategoriesTab.test.tsx (no jsdom/@testing-library
// harness in this project yet). `UsersPage` fetches its rows in an effect,
// which react-dom/server never runs, so the first render is always the
// loading state — enough to assert the table shell (columns, create
// affordance) without a fetch mock.
describe("UsersPage (loading shell)", () => {
  it("renders the table columns from the task-10 brief and a create button", () => {
    const html = renderToStaticMarkup(<UsersPage currentUsername="kolya" />)

    expect(html).toContain("Имя")
    expect(html).toContain("Логин")
    expect(html).toContain("Роль")
    expect(html).toContain("Последний визит")
    expect(html).toContain("Загрузка")
    expect(html).toContain("Новый")
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

// Core rule from the task-10 brief: a blank password field means "keep
// current password" — the PATCH body must omit `password` entirely, not
// send an empty string. A non-blank field means "reset", and must be sent.
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

  it("includes password when the reset field is non-blank", () => {
    const body = toUpdateBody({ ...baseForm, password: "newpass1" })
    expect(body.password).toBe("newpass1")
  })

  it("collapses a blank name to null, mirroring the other editors", () => {
    const body = toUpdateBody({ ...baseForm, name: "  " })
    expect(body.name).toBeNull()
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
})

describe("MIN_PASSWORD_LENGTH", () => {
  it("matches the backend's admin_users.py min_length=4", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(4)
  })
})
