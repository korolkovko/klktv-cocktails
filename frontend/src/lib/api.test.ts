import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, getToken, setToken } from "./api"

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

// This project runs vitest under the plain "node" environment (no jsdom —
// see the other *.test.tsx files' comments), so there is no global
// `localStorage`. Provide a minimal in-memory stand-in so the token store's
// localStorage.getItem/setItem/removeItem calls in ./api.ts have something
// real to hit; production code only ever runs in an actual browser.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

describe("lib/api token store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage())
    setToken(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setToken(null)
  })

  it("stores and persists the token", () => {
    setToken("abc")
    expect(getToken()).toBe("abc")
    expect(localStorage.getItem("klktv_token")).toBe("abc")
    setToken(null)
    expect(getToken()).toBeNull()
    expect(localStorage.getItem("klktv_token")).toBeNull()
  })

  it("sends Authorization: Bearer <token> when a token is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    setToken("tok123")

    await api.get("/api/content")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok123")
  })

  it("omits the Authorization header when no token is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)
    setToken(null)

    await api.get("/api/content")

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined()
  })

  it("does not send `credentials` on requests (bearer-token auth, not cookies)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)
    setToken("tok123")

    await api.post("/api/content", { a: 1 })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBeUndefined()
  })
})
