import * as React from "react"

// Канон MOBILE.md §3: long-press = onContextMenu (десктоп/фолбэк) +
// pointer-таймер 400ms (тач). Палец, уехавший дальше 10px, — это скролл,
// не long-press. Результат спредится на элемент: <div {...longPress}>.
export function useLongPress(onLongPress: () => void, { ms = 400 } = {}) {
  const timer = React.useRef<number | null>(null)
  const start = React.useRef<{ x: number; y: number } | null>(null)
  const firedAt = React.useRef(0)

  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    start.current = null
  }
  const fire = () => {
    firedAt.current = Date.now()
    clear()
    onLongPress()
  }

  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      // тач-long-press в некоторых браузерах дублируется contextmenu — гасим
      if (Date.now() - firedAt.current > 600) fire()
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(fire, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  }
}
