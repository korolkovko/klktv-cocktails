import { cn } from "@/lib/utils"

// §45 TAXONOMY TINTS — DATA-палитра для таксономий (семейства классики и
// будущие оси), НЕ семантика: SIGNAL/PROFIT/BUTTER/LOSS остаются статусами.
// Тинт живёт ТОЛЬКО маркером-квадратом 8–10px с INK-рамкой (на INK-фоне — с
// белой) в чипах, лейблах и легендах. Заливки карточек, текст тинтом,
// бордеры-акценты — ЗАПРЕЩЕНЫ.
// 9 пастелей; кончились — повторяем С ИНДЕКСОМ (tintFor циклит по порядку),
// десятый пастель не выдумываем.

export const TAXONOMY_TINTS = {
  sour: "var(--tint-sour)",
  daisy: "var(--tint-daisy)",
  mary: "var(--tint-mary)",
  negroni: "var(--tint-negroni)",
  martini: "var(--tint-martini)",
  manhattan: "var(--tint-manhattan)",
  highball: "var(--tint-highball)",
  spritz: "var(--tint-spritz)",
  dessert: "var(--tint-dessert)",
} as const

export type TintName = keyof typeof TAXONOMY_TINTS

const TINT_ORDER = Object.keys(TAXONOMY_TINTS) as TintName[]

/** Тинт по имени таксономии (регистр не важен); неизвестное имя циклит по
 *  порядку осей — стабильно и без «десятого пастеля» */
export function tintFor(name: string): string {
  const key = name.toLowerCase() as TintName
  if (key in TAXONOMY_TINTS) return TAXONOMY_TINTS[key]
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % TINT_ORDER.length
  return TAXONOMY_TINTS[TINT_ORDER[h]]
}

export interface TintMarkerProps {
  /** Имя таксономии (sour/negroni/…) или готовый цвет через `color` */
  tint?: string
  /** Явный цвет (перебивает tint) */
  color?: string
  /** Размер квадрата, px (канон 8–10) */
  size?: number
  /** На INK-фоне рамка становится белой */
  onDark?: boolean
  className?: string
}

/** Маркер-квадрат таксономии: единственная разрешённая форма тинта */
export function TintMarker({ tint, color, size = 8, onDark = false, className }: TintMarkerProps) {
  const bg = color ?? (tint ? tintFor(tint) : "transparent")
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-[2px] border", className)}
      style={{
        width: size,
        height: size,
        background: bg,
        borderColor: onDark ? "#fff" : "var(--border)",
      }}
    />
  )
}
