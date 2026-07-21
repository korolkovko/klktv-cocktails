import * as React from "react"
import { api, setUnauthorizedHandler, setToken, getToken } from "@/lib/api"

// Shape matches backend `UserResponse` (backend/app/schemas.py) exactly —
// note there is no `id` field on this endpoint's response, only
// username/name/role, so we don't claim one here.
export interface User {
  username: string
  name: string | null
  role: string
}
// Shape matches backend `TokenResponse` (backend/app/schemas.py) — auth
// switched from an HttpOnly session cookie to a JWT returned from login and
// sent back as `Authorization: Bearer <jwt>` (see src/lib/api.ts).
interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}
interface AuthValue {
  user: User | null
  loading: boolean
  login: (u: string, p: string) => Promise<void>
  logout: () => Promise<void>
}
const Ctx = React.createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    // Only probe /api/auth/me when a token exists — an anonymous visitor
    // has nothing to bounce a 401 off of, so skip the round trip entirely.
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])
  // Any 401 from any API call (not just the /me probe above) clears the
  // user, which makes AuthGate fall back to LoginPage. This is what
  // bounces an expired-session tab back to sign-in without a manual
  // refresh — see setUnauthorizedHandler in src/lib/api.ts.
  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])
  const login = async (username: string, password: string) => {
    const res = await api.post<LoginResponse>("/api/auth/login", {
      username: username.trim().toLowerCase(),
      password,
    })
    setToken(res.access_token)
    setUser(res.user)
  }
  const logout = async () => {
    setToken(null)
    setUser(null)
  }
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}
export function useAuth() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error("useAuth outside AuthProvider")
  return v
}
