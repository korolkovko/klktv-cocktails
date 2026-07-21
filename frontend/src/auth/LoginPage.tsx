import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "./AuthContext"

// §28 AUTH / SIGN-IN — password-only variant for the v2 frontend.
//
// The kit ships `components/kollektiv/auth-card.tsx`, a multi-mode card
// (passkey / telegram / password). It CAN be pointed at password-only mode
// cleanly through its public props alone: `methods={["password"]}` boots it
// straight into the password step with zero passkey/telegram entry points
// rendered (see its `nonPasswordMethods.length === 0` branch) — no v2
// backend route exists for either, so that part is a non-issue.
//
// It was NOT used here, though. AuthCard owns `login`/`password`/`error` as
// fully internal state (its own useState, no forwarded ref, no exposed
// setter/reset callback). Old-prod's login UX explicitly clears the
// password field and refocuses it after a failed attempt — see
// frontend_v1_reference/src/auth/LoginPage.jsx — and there is no prop on
// AuthCard a parent can use to trigger that from outside without patching
// the installed kit file. Rather than fork/patch a vendored kit component
// for one behavior, this is a plain form built from the same kit
// primitives (Input/Button/Spinner) plus AuthCard's own canon card
// styling (PAPER polotno, R16, INK border, D3 shadow, mono labels +
// disclaimer) so it still reads as part of the same design system.
export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  // When an error appears, clear the password and refocus it so the user
  // can retype immediately — fixes "stuck on error" frustration (old-prod
  // parity, see frontend_v1_reference/src/auth/LoginPage.jsx).
  React.useEffect(() => {
    if (error) passwordRef.current?.focus()
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password || submitting) return
    setSubmitting(true)
    setError("")
    try {
      // AuthContext.login trims + lowercases the username before sending.
      await login(username, password)
    } catch (err) {
      setError((err as Error)?.message || "Неверный логин или пароль")
      setPassword("") // clear so the user can retype
    } finally {
      setSubmitting(false) // guarantee form re-enables even if rendering throws
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-desk p-4 max-md:bg-background">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex w-[340px] max-w-full flex-col gap-4 rounded-2xl border border-border bg-background p-7 shadow-card"
      >
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.png" alt="Kollektiv" className="h-14 w-auto max-w-full" />
          <div className="font-mono text-[9px] tracking-[0.1em] text-[#A1A1AA] uppercase">
            INTERNAL TOOLS · AUTHORIZED ONLY
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-username"
            className="font-mono text-[10px] font-semibold tracking-[0.08em]"
          >
            LOGIN
          </label>
          <Input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-password"
            className={cn(
              "font-mono text-[10px] font-semibold tracking-[0.08em]",
              error && "text-signal"
            )}
          >
            PASSWORD
          </label>
          <Input
            id="login-password"
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            aria-invalid={!!error}
          />
          {error && (
            <div role="alert" className="font-mono text-[9.5px] text-signal">
              {error}
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={submitting || !username.trim() || !password}
          className="w-full"
        >
          {submitting && <Spinner className="border-[#71717A] border-t-white" />}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <div className="text-center font-mono text-[8.5px] tracking-[0.06em] text-[#A1A1AA] uppercase">
          BY SIGNING IN YOU AGREE TO DO YOUR JOB
        </div>
      </form>
    </div>
  )
}
