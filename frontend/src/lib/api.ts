export const BASE = import.meta.env.VITE_API_URL ?? ""

// Global "on unauthorized" hook — lets AuthContext learn about a 401 from
// any API call (not just the initial /api/auth/me probe) so an expired
// session bounces the user back to LoginPage instead of silently failing.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}
// Lets call sites that bypass `request()` (e.g. admin/api.ts's multipart
// image upload, which can't go through the JSON-only helper below) still
// trigger the same "bounce to login" behavior on a 401.
export function notifyUnauthorized() {
  onUnauthorized?.()
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.()
    const err = new Error((data && (data.detail as string)) || res.statusText) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: unknown) => request<T>("POST", p, b),
  patch: <T>(p: string, b?: unknown) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
}
