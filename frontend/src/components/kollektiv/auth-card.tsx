import * as React from "react"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

// §28 AUTH / SIGN-IN (ревью R11 + R12). Логин — фокус-объект: карточка-полотно
// 340px (PAPER, R16, INK-рамка, D3-тень) на desk-фоне, центрирована.
// На мобилке полотно ОСТАЁТСЯ — исключение из канона §01b (не рабочий экран).
// Иерархия методов: passkey — единственная primary INK (главный путь),
// telegram — secondary с НАШИМ line-самолётиком (чужие бренд-цвета в кит
// не заходят), пароль — fallback-ссылка → внутренний step той же карточки.
// Telegram (R12): клик открывает deep-link бота (через onTelegram — токен
// живёт у продукта), карточка ждёт в tg-waiting; подтверждение — В БОТЕ,
// фронт логинит сам (long-polling/WS на стороне продукта). LINK EXPIRED —
// не ошибка, без SIGNAL. ← BACK не сбрасывает токен до истечения.
// Дисклеймер один на все тулзы: BY SIGNING IN YOU AGREE TO DO YOUR JOB.

export type AuthMethod = "passkey" | "telegram" | "password"
export type AuthState = "idle" | "passkey-waiting" | "tg-waiting" | "locked"

export interface AuthCardProps {
  /** Порядок = иерархия. A: [passkey, telegram, password]; B: без password */
  methods: AuthMethod[]
  logo?: React.ReactNode
  /** mono-подпись под лого; дефолт зависит от наличия password */
  tagline?: string
  disclaimer?: string
  onPasskey?: () => void
  /**
   * Открытие deep-link (tg://resolve?domain=…&start=<token>) — токен и сам
   * переход живут у продукта. Зовётся при входе в waiting, по Open Telegram
   * (тот же токен) и по Get new link (продукт различает по сроку токена).
   */
  onTelegram?: () => void
  /** reject → ошибка + счётчик попыток; 5 неверных → lockout */
  onPassword?: (login: string, password: string) => Promise<void>
  /** Управляемый стейт поверх внутреннего */
  state?: AuthState
  /**
   * Каждый переход внутреннего автомата: клик passkey → "passkey-waiting",
   * клик TG → "tg-waiting", ← BACK → "idle", 5 ошибок пароля → "locked".
   * В контролируемом режиме (state) — единственный способ узнать о намерении
   * перехода (например, погасить long-polling по ← BACK из tg-waiting).
   */
  onStateChange?: (state: AuthState) => void
  /** Стартовый стейт внутреннего автомата (демо waiting-экрана) */
  defaultState?: AuthState
  /** Стартовый шаг (демо/диплинк на парольный экран) */
  defaultStep?: "methods" | "password"
  /** Бот, подтверждающий вход, — показывается в tg-waiting */
  tgBot?: string
  /** ms epoch: живой отсчёт LINK EXPIRES IN NNS; без пропа — внутренние 60s */
  tgExpiresAt?: number
  className?: string
}

const MAX_ATTEMPTS = 5
const TG_LINK_SECONDS = 60

function FingerprintIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M12 11a3 3 0 0 1 3 3v2m-6-1.5V14a3 3 0 0 1 .5-1.66M12 7a7 7 0 0 1 7 7v3M5 14a7 7 0 0 1 3-5.75M12 14v4" />
    </svg>
  )
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
    >
      <path d="M21 4L3 11.5l5.5 2M21 4l-3 15-7.5-5.5M21 4L8.5 13.5m0 0V19l3-3.2" />
    </svg>
  )
}

function DefaultLogo() {
  return (
    <div className="text-center text-[22px] leading-none font-bold tracking-tight">
      Kollektiv<span className="align-super text-[11px] text-signal">®</span>
    </div>
  )
}

function AuthCard({
  methods,
  logo,
  tagline,
  disclaimer = "BY SIGNING IN YOU AGREE TO DO YOUR JOB",
  onPasskey,
  onTelegram,
  onPassword,
  state,
  onStateChange,
  defaultState = "idle",
  defaultStep = "methods",
  tgBot = "@KLKTV_AUTH_BOT",
  tgExpiresAt,
  className,
}: AuthCardProps) {
  const hasPassword = methods.includes("password")
  const nonPasswordMethods = methods.filter((m) => m !== "password")

  const [step, setStep] = React.useState<"methods" | "password">(
    hasPassword && (defaultStep === "password" || nonPasswordMethods.length === 0)
      ? "password"
      : "methods"
  )
  const [innerState, setInnerState] = React.useState<AuthState>(defaultState)
  const [login, setLogin] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [attemptsLeft, setAttemptsLeft] = React.useState(MAX_ATTEMPTS)
  const [error, setError] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [innerExpiresAt, setInnerExpiresAt] = React.useState<number | null>(null)
  const [nowTs, setNowTs] = React.useState(() => Date.now())

  const effective = state ?? innerState
  const expiresAt = tgExpiresAt ?? innerExpiresAt

  // живой отсчёт LINK EXPIRES IN NNS — тикает только пока карточка ждёт
  React.useEffect(() => {
    if (effective !== "tg-waiting" || expiresAt == null) return
    setNowTs(Date.now())
    const id = setInterval(() => setNowTs(Date.now()), 500)
    return () => clearInterval(id)
  }, [effective, expiresAt])

  const tgSecondsLeft =
    expiresAt == null ? null : Math.max(0, Math.ceil((expiresAt - nowTs) / 1000))
  const tgExpired = tgSecondsLeft === 0

  // единая точка переходов автомата: внутренний стейт + сигнал наружу
  // (в контролируемом режиме родитель применяет переход сам)
  const transition = (next: AuthState) => {
    setInnerState(next)
    onStateChange?.(next)
  }

  const handlePasskey = () => {
    transition("passkey-waiting")
    onPasskey?.()
  }
  // вход в waiting: живой токен переживает ← BACK — не перевыпускаем его
  const handleTelegram = () => {
    transition("tg-waiting")
    setInnerExpiresAt((prev) =>
      prev != null && prev > Date.now() ? prev : Date.now() + TG_LINK_SECONDS * 1000
    )
    onTelegram?.()
  }
  const handleTgNewLink = () => {
    setInnerExpiresAt(Date.now() + TG_LINK_SECONDS * 1000)
    onTelegram?.()
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (effective === "locked" || submitting) return
    setSubmitting(true)
    try {
      await onPassword?.(login, password)
      setError(false)
    } catch {
      const left = attemptsLeft - 1
      setAttemptsLeft(left)
      setError(true)
      if (left <= 0) transition("locked")
    } finally {
      setSubmitting(false)
    }
  }

  const defaultTagline = hasPassword
    ? "INTERNAL TOOLS · AUTHORIZED ONLY"
    : "PASSWORDLESS · NO PASSWORD NO CRY"

  return (
    <div
      data-slot="auth-card"
      // полотно остаётся и на мобилке — исключение из §01b
      className={cn(
        "flex w-[340px] max-w-full flex-col gap-4 rounded-2xl border border-border bg-background p-7 shadow-card",
        className
      )}
    >
      {/* на password-step и в tg-waiting лого с теглайном уступает место заголовку шага */}
      {step === "methods" && effective !== "tg-waiting" && (
        <div className="flex flex-col items-center gap-1.5">
          {logo ?? <DefaultLogo />}
          <div className="font-mono text-[9px] tracking-[0.1em] text-[#A1A1AA] uppercase">
            {tagline ?? defaultTagline}
          </div>
        </div>
      )}

      {step === "methods" ? (
        <>
          {effective === "tg-waiting" ? (
            <div className="flex flex-col items-center gap-2.5 py-2">
              <div className="flex size-[52px] items-center justify-center rounded-full border border-border bg-card">
                <PlaneIcon className="size-[22px]" />
              </div>
              <div className="text-[16px] leading-none font-bold">Check Telegram</div>
              <div className="text-center font-mono text-[10px] text-[#71717A]">
                CONFIRM SIGN-IN IN{" "}
                <span className="font-bold text-foreground">{tgBot}</span>
              </div>
              {!tgExpired && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-[#71717A]">
                  <Spinner className="size-3.5 border-[2.5px]" />
                  WAITING FOR CONFIRMATION…
                </div>
              )}
              <button
                type="button"
                onClick={tgExpired ? handleTgNewLink : () => onTelegram?.()}
                className="btn-push flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-hard"
              >
                {tgExpired ? "Get new link" : "Open Telegram"}
              </button>
              <div className="flex w-full items-center justify-between">
                <button
                  type="button"
                  onClick={() => transition("idle")}
                  className="cursor-pointer font-mono text-[11px] text-[#52525B] underline underline-offset-3 hover:text-foreground"
                >
                  ← BACK
                </button>
                {tgSecondsLeft != null && (
                  // истёкшая ссылка — не ошибка: остаётся #A1A1AA, без SIGNAL
                  <span className="font-mono text-[9px] text-[#A1A1AA] tabular-nums">
                    {tgExpired ? "LINK EXPIRED" : `LINK EXPIRES IN ${tgSecondsLeft}S`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {nonPasswordMethods.map((m) =>
                m === "passkey" ? (
                  <button
                    key={m}
                    type="button"
                    disabled={effective === "passkey-waiting"}
                    onClick={handlePasskey}
                    className="btn-push flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:cursor-wait"
                  >
                    {effective === "passkey-waiting" ? (
                      <>
                        <Spinner className="border-[#71717A] border-t-white" />
                        TOUCH YOUR KEY…
                      </>
                    ) : (
                      <>
                        <FingerprintIcon />
                        Sign in with passkey
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    key={m}
                    type="button"
                    onClick={handleTelegram}
                    className="btn-push flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-hard"
                  >
                    <PlaneIcon />
                    Sign in with Telegram
                  </button>
                )
              )}
            </div>
          )}

          {hasPassword && effective !== "tg-waiting" && (
            <>
              <div className="flex items-center gap-2.5">
                <span className="h-0 flex-1 border-t border-dashed border-divider-strong" />
                <span className="font-mono text-[9px] text-[#A1A1AA]">OR</span>
                <span className="h-0 flex-1 border-t border-dashed border-divider-strong" />
              </div>
              <button
                type="button"
                onClick={() => setStep("password")}
                className="cursor-pointer self-center font-mono text-[11px] text-[#52525B] underline underline-offset-3 hover:text-foreground"
              >
                SIGN IN WITH PASSWORD →
              </button>
            </>
          )}
        </>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-0.5">
            <div className="text-[18px] font-bold">Password sign-in</div>
            <div className="font-mono text-[9px] tracking-[0.08em] text-[#A1A1AA] uppercase">
              THE OLD WAY · WE DON'T JUDGE
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-login"
              className="font-mono text-[10px] font-semibold tracking-[0.08em]"
            >
              LOGIN
            </label>
            <div className="relative">
              <input
                id="auth-login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                className="h-11 w-full rounded-lg border border-border bg-card px-3 pr-9 text-sm outline-none max-md:text-base"
              />
              {login && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[10px] font-bold text-[#15803D]">
                  ✓
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-password"
              className={cn(
                "font-mono text-[10px] font-semibold tracking-[0.08em]",
                error && "text-signal"
              )}
            >
              PASSWORD
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={cn(
                  "h-11 w-full rounded-lg border border-border bg-card px-3 pr-14 text-sm outline-none max-md:text-base",
                  error && "border-[1.5px] border-signal bg-[#FFF5F4]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer font-mono text-[9px] text-[#71717A] hover:text-foreground"
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            {error && effective !== "locked" && (
              <div className="font-mono text-[9.5px] text-signal">
                WRONG PASSWORD · {attemptsLeft} OF {MAX_ATTEMPTS} ATTEMPTS LEFT
              </div>
            )}
            {effective === "locked" && (
              <div className="font-mono text-[9.5px] text-signal">
                GO POUR SOMETHING. COME BACK LATER.
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={effective === "locked" || submitting}
            className="btn-push flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:pointer-events-none disabled:border-[#E4E4DF] disabled:bg-muted disabled:text-[#A1A1AA] disabled:shadow-none"
          >
            {submitting && <Spinner className="border-[#71717A] border-t-white" />}
            Sign in
          </button>

          {nonPasswordMethods.length > 0 && (
            <button
              type="button"
              onClick={() => setStep("methods")}
              className="cursor-pointer self-center font-mono text-[10px] text-[#52525B] underline underline-offset-3 hover:text-foreground"
            >
              ← PASSKEY / TELEGRAM
            </button>
          )}
        </form>
      )}

      <div className="text-center font-mono text-[8.5px] tracking-[0.06em] text-[#A1A1AA] uppercase">
        {disclaimer}
      </div>
    </div>
  )
}

export { AuthCard }
