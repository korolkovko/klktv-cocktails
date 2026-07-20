import * as React from "react"

import { cn } from "@/lib/utils"

// §44 LEARNED-ТОГЛ — «знаю / не знаю» в справочнике. Переключение МГНОВЕННОЕ,
// без confirm; полоска-прогресс и счётчики раздела обновляются сразу.
// ✓ PROFIT — единственный зелёный элемент карточки.
// variant="toggle" — квадрат 26px в углу карточки (тап-зона ::after до 44px);
// variant="cta" — full-width кнопка внизу шита детали (min-h 48, R10).

export interface LearnedToggleProps {
  learned: boolean
  onChange: (learned: boolean) => void
  variant?: "toggle" | "cta"
  /** aria-label для квадрата (имя позиции) */
  label?: string
  className?: string
}

export function LearnedToggle({
  learned,
  onChange,
  variant = "toggle",
  label,
  className,
}: LearnedToggleProps) {
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation() // клик по тоглу не открывает деталь карточки
    onChange(!learned)
  }

  if (variant === "cta") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={learned}
        className={cn(
          "btn-push flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border font-sans text-sm",
          learned
            ? "bg-profit font-bold text-foreground"
            : "bg-card font-semibold text-foreground",
          className
        )}
      >
        <span aria-hidden className={cn("text-xs", !learned && "text-[#D4D4CE]")}>
          {learned ? "✓" : "○"}
        </span>
        {learned ? "Знаю" : "Отметить как знакомый"}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={learned}
      aria-label={label ? `${learned ? "Знаю" : "Не знаю"}: ${label}` : "Отметить как знакомый"}
      className={cn(
        // тап-зона ::after растягивается до 44px, визуальный размер 26 не меняется
        "relative inline-flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-xs",
        "after:absolute after:inset-[-9px] after:content-['']",
        learned ? "bg-profit font-bold text-foreground" : "bg-card text-[#D4D4CE]",
        className
      )}
    >
      <span aria-hidden>{learned ? "✓" : "○"}</span>
    </button>
  )
}
