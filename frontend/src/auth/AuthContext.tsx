import * as React from "react"
import { api, setUnauthorizedHandler } from "@/lib/api"

// Shape matches backend `UserResponse` (backend/app/schemas.py) exactly —
// note there is no `id` field on this endpoint's response, only
// username/name/role, so we don't claim one here.
export interface User {
  username: string
  name: string | null
  role: string
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
    api
      .get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])
  // Any 401 from any API call (not just the /me probe above) clears the
  // user, which makes AuthGate fall back to LoginPage. This is what
  // bounces an expired-session tab back to sign-in without a manual
  // refresh — see setUnauthorizedHandler in src/lib/api.ts.
  React.useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])
  const login = async (username: string, password: string) => {
    const u = await api.post<User>("/api/auth/login", {
      username: username.trim().toLowerCase(),
      password,
    })
    setUser(u)
  }
  const logout = async () => {
    try {
      await api.post("/api/auth/logout")
    } catch {
      /* ignore */
    }
    setUser(null)
  }
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}
export function useAuth() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error("useAuth outside AuthProvider")
  return v
}
