// Admin CRUD client — thin, typed wrappers over the shared `api` client
// (frontend/src/lib/api.ts), mapping (entity, key?) pairs onto the backend's
// admin routes `/api/admin/<entity>[/<key>]`. Every admin entity is a
// natural-key REST resource — `slug` for drinks/classics/spirit-categories/
// spirits/kitchen-categories/kitchen-dishes, `key` for families and
// categories/sections, and either numeric id or username for users — see
// backend/app/routers/admin.py + admin_users.py. Since every entity name
// here already matches its backend path segment 1:1, `pathFor` is a single
// template, no per-entity mapping table needed.
//
// `uploadImage` is the one non-JSON call (multipart/form-data), so it
// bypasses `api` and talks to `fetch` directly — mirrors lib/api.ts's own
// request() shape (Authorization: Bearer header, 401 -> global handler,
// thrown Error carries the JSON body's `detail` when present).
import { api, BASE, notifyUnauthorized, getToken } from "@/lib/api"

export type AdminEntity =
  | "drinks"
  | "classics"
  | "spirit-categories"
  | "spirits"
  | "kitchen-categories"
  | "kitchen-dishes"
  | "families"
  | "categories"
  | "users"

function pathFor(entity: AdminEntity, key?: string): string {
  const base = `/api/admin/${entity}`
  return key === undefined ? base : `${base}/${encodeURIComponent(key)}`
}

export interface UploadImageResult {
  url: string
  filename: string
  size: number
}

export const adminApi = {
  list: <T = unknown>(entity: AdminEntity): Promise<T[]> => api.get<T[]>(pathFor(entity)),

  get: <T = unknown>(entity: AdminEntity, key: string): Promise<T> =>
    api.get<T>(pathFor(entity, key)),

  create: <T = unknown>(entity: AdminEntity, body: unknown): Promise<T> =>
    api.post<T>(pathFor(entity), body),

  update: <T = unknown>(entity: AdminEntity, key: string, body: unknown): Promise<T> =>
    api.patch<T>(pathFor(entity, key), body),

  remove: (entity: AdminEntity, key: string): Promise<void> => api.del<void>(pathFor(entity, key)),

  // One-off custom action outside the (entity, key) REST shape above —
  // POST /api/admin/categories/reorder assigns sort_order = index within
  // `keys` for every category, see backend/app/routers/admin.py's
  // `reorder_categories` + CategoryReorderIn.
  reorderCategories: <T = unknown>(keys: string[]): Promise<T[]> =>
    api.post<T[]>("/api/admin/categories/reorder", { keys }),

  uploadImage: async (file: File): Promise<UploadImageResult> => {
    const form = new FormData()
    form.append("file", file)
    const headers: Record<string, string> = {}
    const t = getToken()
    if (t) headers["Authorization"] = `Bearer ${t}`
    const res = await fetch(`${BASE}/api/admin/uploads/image`, {
      method: "POST",
      headers,
      body: form,
    })
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      if (res.status === 401) notifyUnauthorized()
      const detail =
        data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : undefined
      throw new Error(detail || res.statusText)
    }
    return data as UploadImageResult
  },
}
