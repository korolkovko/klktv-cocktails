import * as React from "react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/use-media-query"

// §37 FAB (ревью R17): квадрат 56×56 INK R16 (не кружок — кружки заняты
// аватарками), тень D3 4×4; pressed — translate(2,2) + тень 2×2, БЕЗ scale.
// Extended (label) живёт при пустом списке / до первого скролла scrollRef,
// затем схлопывается в квадрат (180ms ease-out, лейбл гаснет без прыжка).
// Badge — SIGNAL-кружок ≥18 с белой обводкой (очередь офлайна).
// kCloud-стейты: uploading — BUTTER-стрелка циклично «всасывается» вверх
// (1.1s ease-in, БЕЗ процентов — прогресс в тосте/строке), тап игнорируется;
// done — BUTTER-заливка с INK-галкой 1.5s и обратно; failed — SIGNAL-рамка
// и тень, «!», тап = retry.
// Desktop (≥768) FAB ЗАПРЕЩЁН — не рендерится (mobile-проп — оверрайд для
// витрины). Прячется при открытом bottom sheet (наблюдаем [data-vaul-drawer]
// в DOM) и при клавиатуре (visualViewport ужался). Позиция — фикс право-низ
// 16px + safe-area; отступ над bottom nav продукт задаёт className'ом;
// frame — absolute для демо-фреймов витрины.

export type FabState = "idle" | "uploading" | "done" | "failed"

export interface FabProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  /** Иконка Lucide 22/1.75 белым */
  icon: React.ReactNode
  "aria-label": string
  /** Лейбл extended-варианта; без него FAB всегда квадрат */
  label?: string
  /** Контролируемое схлопывание extended; без пропа — по первому скроллу scrollRef */
  collapsed?: boolean
  /** Скролл-контейнер ленты: первый скролл схлопывает extended */
  scrollRef?: React.RefObject<HTMLElement | null>
  state?: FabState
  /** Очередь офлайна; 0/undefined — без бейджа */
  badge?: number
  /** Оверрайд desktop-гварда (витрина) */
  mobile?: boolean
  /** absolute в демо-фрейме вместо fixed к вьюпорту */
  frame?: boolean
  /** Тап в состоянии failed (retry); иначе зовётся onClick */
  onRetry?: () => void
}

/** Прячем FAB, пока открыт любой vaul-лист или клавиатура съела вьюпорт */
function useFabHidden() {
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    const update = () => {
      const sheet = !!document.querySelector("[data-vaul-drawer]")
      const vv = window.visualViewport
      const keyboard = vv ? vv.height < window.innerHeight * 0.75 : false
      setHidden(sheet || keyboard)
    }
    update()
    const mo = new MutationObserver(update)
    mo.observe(document.body, { childList: true, subtree: true })
    window.visualViewport?.addEventListener("resize", update)
    return () => {
      mo.disconnect()
      window.visualViewport?.removeEventListener("resize", update)
    }
  }, [])
  return hidden
}

function FabIcon({ state, icon }: { state: FabState; icon: React.ReactNode }) {
  if (state === "uploading")
    return (
      // клип стрелки — свой слой: overflow-hidden на корне кнопки
      // обрезал бы бейдж очереди (-6/-6 торчит наружу)
      <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
        <span className="inline-flex animate-k-fab-upload">
          <svg width="18" height="22" viewBox="0 0 12 14" fill="none" stroke="#FFF9C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 13V2" />
            <path d="M2 6l4-4 4 4" />
          </svg>
        </span>
      </span>
    )
  if (state === "done")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <path d="M4 12l5 5L20 6" />
      </svg>
    )
  if (state === "failed")
    return <span className="font-mono text-[18px] font-extrabold text-signal">!</span>
  return icon
}

function Fab({
  icon,
  label,
  collapsed: collapsedProp,
  scrollRef,
  state: stateProp = "idle",
  badge,
  mobile: mobileProp,
  frame,
  onRetry,
  onClick,
  className,
  ...props
}: FabProps) {
  const autoMobile = useIsMobile()
  const show = mobileProp ?? autoMobile
  const hidden = useFabHidden()

  // done — вспышка на 1.5s, дальше визуально idle (проп может не меняться)
  const [doneFlash, setDoneFlash] = React.useState(false)
  React.useEffect(() => {
    if (stateProp !== "done") return
    setDoneFlash(true)
    const t = window.setTimeout(() => setDoneFlash(false), 1500)
    return () => clearTimeout(t)
  }, [stateProp])
  const state: FabState =
    stateProp === "done" ? (doneFlash ? "done" : "idle") : stateProp

  // extended схлопывается по ПЕРВОМУ скроллу ленты
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const el = scrollRef?.current
    if (!el || scrolled) return
    const onScroll = () => {
      if (el.scrollTop > 8) setScrolled(true)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [scrollRef, scrolled])
  const extended = !!label && !(collapsedProp ?? scrolled) && state === "idle"

  if (!show) return null

  return (
    <button
      type="button"
      data-slot="fab"
      data-state={state}
      aria-busy={state === "uploading" || undefined}
      onClick={(e) => {
        if (state === "uploading") return
        if (state === "failed" && onRetry) return onRetry()
        onClick?.(e)
      }}
      className={cn(
        "z-40 inline-flex h-14 cursor-pointer items-center justify-center rounded-2xl border transition-all duration-(--duration-fast) ease-out",
        frame
          ? "absolute right-4 bottom-4"
          : "fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
        extended ? "gap-2.5 px-5" : "w-14",
        state === "failed"
          ? "border-[1.5px] border-signal bg-card shadow-[4px_4px_0_rgb(224_16_0/0.9)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_rgb(224_16_0/0.9)]"
          : cn(
              "border-primary text-primary-foreground shadow-[4px_4px_0_rgb(10_10_10/0.9)]",
              state === "done" ? "bg-butter" : "bg-primary",
              state !== "uploading" &&
                "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_rgb(10_10_10/0.9)]"
            ),
        state === "uploading" && "cursor-wait",
        // клавиатура/лист: FAB уходит, не мешая
        hidden && "pointer-events-none translate-y-2 opacity-0",
        className
      )}
      {...props}
    >
      <FabIcon state={state} icon={icon} />
      {label && (
        <span
          className={cn(
            "overflow-hidden text-sm font-semibold whitespace-nowrap transition-all duration-(--duration-fast) ease-out",
            extended ? "max-w-40 opacity-100" : "max-w-0 opacity-0"
          )}
        >
          {label}
        </span>
      )}
      {!!badge && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-white bg-signal px-1 font-mono text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

/* ---------------- Speed dial ---------------- */

export interface FabSpeedDialAction {
  icon: React.ReactNode
  label: string
  onSelect?: () => void
}

export interface FabSpeedDialProps {
  /** 2–3 опции; одна = speed dial не нужен, действие сразу по тапу */
  actions: FabSpeedDialAction[]
  "aria-label": string
  badge?: number
  mobile?: boolean
  frame?: boolean
  className?: string
}

function FabSpeedDial({
  actions,
  badge,
  mobile: mobileProp,
  frame,
  className,
  "aria-label": ariaLabel,
}: FabSpeedDialProps) {
  const autoMobile = useIsMobile()
  const show = mobileProp ?? autoMobile
  const hidden = useFabHidden()
  const [open, setOpen] = React.useState(false)
  const [lastPicked, setLastPicked] = React.useState<number | null>(null)
  const mainRef = React.useRef<HTMLButtonElement>(null)
  const firstOptRef = React.useRef<HTMLButtonElement>(null)

  if (actions.length > 3 && import.meta.env.DEV)
    console.warn("FabSpeedDial: >3 опций запрещено каноном §37 — экран не про одно действие")
  const opts = actions.slice(0, 3)

  React.useEffect(() => {
    if (open) firstOptRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    mainRef.current?.focus()
  }

  if (!show) return null

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={close}
          className={cn("z-40 bg-[rgb(10_10_10/0.2)]", frame ? "absolute inset-0" : "fixed inset-0")}
        />
      )}
      <div
        data-slot="fab-speed-dial"
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation()
            close()
          }
        }}
        className={cn(
          "z-40 flex flex-col items-end gap-2.5",
          frame
            ? "absolute right-4 bottom-4"
            : "fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
          hidden && "pointer-events-none translate-y-2 opacity-0",
          className
        )}
      >
        {open &&
          opts.map((a, i) => (
            <div key={i} className="flex animate-k-enter items-center gap-2.5">
              <span
                className={cn(
                  "rounded-md border border-border px-2.5 py-1 font-mono text-[10px] font-bold",
                  lastPicked === i ? "bg-butter" : "bg-card"
                )}
              >
                {a.label}
              </span>
              <button
                ref={i === 0 ? firstOptRef : undefined}
                type="button"
                onClick={() => {
                  setLastPicked(i)
                  close()
                  a.onSelect?.()
                }}
                // R12 по рефу §37 (наш rounded-xl = 10px карточек — не он)
                className="flex size-12 cursor-pointer items-center justify-center rounded-[12px] border border-border bg-card shadow-[2px_2px_0_#0A0A0A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#0A0A0A] [&_svg]:size-[18px]"
              >
                {a.icon}
              </button>
            </div>
          ))}
        <button
          ref={mainRef}
          type="button"
          data-slot="fab"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
          className="relative inline-flex size-14 cursor-pointer items-center justify-center rounded-2xl border border-primary bg-primary text-primary-foreground shadow-[4px_4px_0_rgb(10_10_10/0.9)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_rgb(10_10_10/0.9)]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
            className={cn("transition-transform duration-150", open && "rotate-45")}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {!!badge && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-white bg-signal px-1 font-mono text-[9px] font-bold text-white">
              {badge}
            </span>
          )}
        </button>
      </div>
    </>
  )
}

export { Fab, FabSpeedDial }
