import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { adminApi } from "./api"

// `.env.local` sets VITE_API_URL for local dev (loaded by Vite/vitest too),
// so build expected URLs off the same base the client itself reads instead
// of hardcoding an absolute/relative assumption.
const BASE = import.meta.env.VITE_API_URL ?? ""

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe("adminApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("list(entity) issues GET /api/admin/<entity>", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await adminApi.list("kitchen-dishes")
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/admin/kitchen-dishes`,
      expect.objectContaining({ method: "GET", credentials: "include" })
    )
  })

  it("get(entity, key) issues GET /api/admin/<entity>/<key>", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ slug: "dieter" }))
    await adminApi.get("drinks", "dieter")
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/admin/drinks/dieter`,
      expect.objectContaining({ method: "GET" })
    )
  })

  it("create(entity, body) issues POST /api/admin/<entity> with a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ key: "sour" }, 201))
    await adminApi.create("families", { key: "sour", label: "Sour" })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/admin/families`)
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ "Content-Type": "application/json" })
    expect(JSON.parse(init.body as string)).toEqual({ key: "sour", label: "Sour" })
  })

  it("update(entity, key, body) issues PATCH /api/admin/<entity>/<key> with a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ slug: "dieter", name: "Дитер" }))
    await adminApi.update("drinks", "dieter", { name: "Дитер" })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/admin/drinks/dieter`)
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body as string)).toEqual({ name: "Дитер" })
  })

  it("remove(entity, key) issues DELETE /api/admin/<entity>/<key>", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => null } as Response)
    await adminApi.remove("classics", "old-fashioned")
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/admin/classics/old-fashioned`,
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("encodes keys containing special characters", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await adminApi.get("spirit-categories", "rum & cane")
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/api/admin/spirit-categories/rum%20%26%20cane`,
      expect.anything()
    )
  })

  it("reorderCategories(keys) issues POST /api/admin/categories/reorder with a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ key: "menu", sort_order: 0 }]))
    await adminApi.reorderCategories(["menu", "classics", "spirits", "kitchen"])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/admin/categories/reorder`)
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({
      keys: ["menu", "classics", "spirits", "kitchen"],
    })
  })

  it("uploadImage(file) posts multipart/form-data to /api/admin/uploads/image", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ url: "/static/img/x-abc123.webp", filename: "x-abc123.webp", size: 456 }, 201)
    )
    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" })
    const result = await adminApi.uploadImage(file)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/admin/uploads/image`)
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("include")
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get("file")).toBe(file)
    expect(result).toEqual({ url: "/static/img/x-abc123.webp", filename: "x-abc123.webp", size: 456 })
  })

  it("throws with the backend's `detail` message on a non-ok response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Drink not found" }, 404))
    await expect(adminApi.get("drinks", "nope")).rejects.toThrow("Drink not found")
  })
})
