import * as React from "react"
import { useAuth } from "./AuthContext"
import { LoginPage } from "./LoginPage"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />
  return <>{children}</>
}
