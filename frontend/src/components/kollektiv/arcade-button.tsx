import * as React from "react"

import { cn } from "@/lib/utils"

// §16 EASTER EGGS · FIRE_EMPLOYEE.EXE: красная аркадная 3D-кнопка.
// Держать holdMs (default 3s) — только тогда onConfirm; отпустил раньше —
// прогресс сгорает. Живёт ТОЛЬКО в контекстном меню юзера, ≤1 на экран.

export interface ArcadeButtonProps {
  label: string // 'FIRE_EMPLOYEE.EXE'
  sublabel?: string // 'HOLD 3 SEC · NO UNDO · HR HAS BEEN NOTIFIED'
  holdMs?: number
  onConfirm: () => void
  /** Диаметр шара в px */
  size?: number
  className?: string
}

function ArcadeButton({
  label,
  sublabel,
  holdMs = 3000,
  onConfirm,
  size = 96,
  className,
}: ArcadeButtonProps) {
  const [progress, setProgress] = React.useState(0)
  const [holding, setHolding] = React.useState(false)
  const raf = React.useRef(0)
  const start = React.useRef(0)
  const fired = React.useRef(false)

  const stop = React.useCallback(() => {
    cancelAnimationFrame(raf.current)
    setHolding(false)
    setProgress(0)
  }, [])

  const begin = () => {
    if (holding) return
    fired.current = false
    setHolding(true)
    start.current = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start.current) / holdMs)
      setProgress(p)
      if (p >= 1) {
        if (!fired.current) {
          fired.current = true
          onConfirm()
        }
        stop()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  React.useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const rest = Math.max(4, Math.round(size / 12))
  const pressed = Math.max(2, Math.round(rest * 0.6))
  const inset =
    "inset 0 4px 8px rgb(255 255 255 / 0.4), inset 0 -6px 10px rgb(0 0 0 / 0.3)"

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <button
        type="button"
        aria-label={label}
        onPointerDown={begin}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) begin()
        }}
        onKeyUp={stop}
        className="cursor-pointer rounded-full border-[3px] border-border outline-none select-none"
        style={{
          width: size,
          height: size,
          background: "radial-gradient(circle at 35% 28%, #FF6A5E, #C00D00)",
          boxShadow: `0 ${holding ? pressed : rest}px 0 #0A0A0A, ${inset}`,
          transform: holding ? `translateY(${rest - pressed}px)` : undefined,
          transition: "transform 100ms ease, box-shadow 100ms ease",
          touchAction: "none",
        }}
      />
      <div className="text-center">
        <div className="font-mono text-xs font-extrabold tracking-[0.08em]">{label}</div>
        {sublabel && (
          <div className="mt-[3px] font-mono text-[10px] text-muted-foreground">
            {holding ? `HOLD · ${((1 - progress) * (holdMs / 1000)).toFixed(1)}S LEFT` : sublabel}
          </div>
        )}
      </div>
      <div
        className={cn(
          "h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-muted transition-opacity",
          holding ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      >
        <div
          className="h-full bg-signal"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  )
}

export { ArcadeButton }
