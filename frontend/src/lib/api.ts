export const BASE = import.meta.env.VITE_API_URL ?? ""

// JWT bearer token store — auth switched from an HttpOnly session cookie to
// a JWT in the `Authorization` header (fixes cross-site-cookie login
// failures on mobile Safari). Persisted to localStorage so a reload doesn't
// log the user out; kept in a module-level variable for synchronous reads.
const TOKEN_KEY = "klktv_token"
let token: string | null = null
try {
  token = localStorage.getItem(TOKEN_KEY)
} catch {
  token = null
}

export function setToken(t: string | null) {
  token = t
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore storage errors (private mode / disabled) */
  }
}
export function getToken(): string | null {
  return token
}

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
  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
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
