import * as React from "react"

import { cn } from "@/lib/utils"

// §07 MOBILE BOTTOM NAV v2: активный пункт — расширенная INK-пилюля
// с иконкой И лейблом (лейбл только у активного), неактивные — иконка 17px
// серым; бейджи — SIGNAL с белой обводкой на иконке; тач-таргет ≥48px;
// пилюля «переезжает» за 180ms. Максимум 5 пунктов (MOBILE.md §1); низ
// дышит safe-area (iPhone home indicator).

export interface BottomNavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: number
}

export interface BottomNavProps {
  items: BottomNavItem[]
  activeId: string
  onChange?: (id: string) => void
  className?: string
}

export function BottomNav({ items, activeId, onChange, className }: BottomNavProps) {
  return (
    <div
      className={cn(
        // pb = 8px дизайн-зазор + home-индикатор (calc, не max: гэп НАД индикатором)
        "flex gap-1 border-t border-border bg-card p-2 pb-[calc(8px+env(safe-area-inset-bottom))]",
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange?.(item.id)}
            className={cn(
              "relative flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl transition-all duration-[180ms] ease-out",
              active
                ? "flex-[1.6] bg-primary text-primary-foreground"
                : "flex-1 text-[#71717A] hover:bg-muted"
            )}
          >
            <span className="[&_svg]:size-[17px]">{item.icon}</span>
            {active && (
              <span className="font-mono text-[10px] font-bold">{item.label}</span>
            )}
            {!active && item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-1 right-3.5 rounded-full border border-white bg-signal px-1 font-mono text-[8px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
