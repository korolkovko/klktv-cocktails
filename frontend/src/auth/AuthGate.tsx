import * as React from "react"
import { useAuth } from "./AuthContext"
import { LoginPage } from "./LoginPage"
import { GuideSkeleton } from "@/components/guide-skeleton"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  // Пока идёт auth-проба (есть токен → дёргаем /api/auth/me) — показываем
  // скелетон гайда, а не белый экран. Без токена loading снимается синхронно
  // → сразу LoginPage, вспышки скелетона нет.
  if (loading) return <GuideSkeleton />
  if (!user) return <LoginPage />
  return <>{children}</>
}
