import * as React from "react"

import { cn } from "@/lib/utils"

// §01b PAGE FRAME — каркас страниц (канон R10, 16.07.2026).
// canvas (default): desk-фон #ECECEA, ОДНО полотно на страницу — PAPER, R16,
// INK-рамка 1px, D3-тень 6×6, max-w 1280, отступы 24px сверху / 40px снизу;
// хедер белый ВНУТРИ полотна (56px, INK-граница снизу); контент p-24,
// разделы — плоские белые карточки R10 с INK-рамкой БЕЗ теней, gap 16.
// full — исключение для контента во всю ширину (месячный shift grid, широкие
// финтаблицы): фон PAPER, хедер во всю ширину, контент в max-w 1280.
// <768px ЛЮБОЙ variant сворачивается edge-to-edge: полотно исчезает
// (ни рамки, ни тени, ни радиуса), карточки теряют боковые рамки и радиус;
// нижняя навигация — bottom-nav (§07), добавляется страницей.

export interface PageFrameProps {
  variant?: "canvas" | "full"
  /** AppHeader (или свой хедер) */
  header?: React.ReactNode
  /** Классы контент-обёртки (дефолт: flex-col gap-4 p-6) */
  contentClassName?: string
  children: React.ReactNode
  className?: string
}

function PageFrame({
  variant = "canvas",
  header,
  contentClassName,
  children,
  className,
}: PageFrameProps) {
  const content = (
    <main
      data-slot="page-frame-content"
      className={cn(
        "flex flex-col gap-4 p-6 max-md:gap-3 max-md:px-0 max-md:py-3",
        contentClassName
      )}
    >
      {children}
    </main>
  )

  if (variant === "full") {
    return (
      <div
        data-slot="page-frame"
        data-variant="full"
        className={cn("min-h-screen bg-background", className)}
      >
        {header}
        <div className="mx-auto w-full max-w-[1280px]">{content}</div>
      </div>
    )
  }

  return (
    <div
      data-slot="page-frame"
      data-variant="canvas"
      className={cn("min-h-screen bg-desk max-md:bg-background", className)}
    >
      <div className="md:px-6">
        <div
          data-slot="page-canvas"
          className="mx-auto max-w-[1280px] bg-background md:mt-6 md:mb-10 md:overflow-hidden md:rounded-2xl md:border md:border-border md:shadow-card"
        >
          {header}
          {content}
        </div>
      </div>
    </div>
  )
}

export interface AppHeaderNavItem {
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}

export interface AppHeaderProps {
  /** Лого-слот слева */
  logo?: React.ReactNode
  /** Нав-пилюли: активная — INK, остальные — hover CONCRETE */
  nav?: AppHeaderNavItem[]
  /** Справа: ⌘K-kbd, аватар и т.п. */
  actions?: React.ReactNode
  className?: string
}

function AppHeader({ logo, nav = [], actions, className }: AppHeaderProps) {
  return (
    <header
      data-slot="app-header"
      className={cn(
        "flex h-14 shrink-0 items-center gap-5 border-b border-border bg-card px-5 max-md:gap-3 max-md:px-4",
        className
      )}
    >
      <span className="shrink-0">{logo}</span>
      {nav.length > 0 && (
        // <768px вторичные табы уезжают в h-scroll (MOBILE.md §2)
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {nav.map((n) => (
            <a
              key={n.label}
              href={n.href}
              onClick={n.onClick}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                n.active
                  ? "bg-primary text-primary-foreground"
                  : "text-[#52525B] hover:bg-muted hover:text-foreground"
              )}
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2.5">{actions}</div>
      )}
    </header>
  )
}

export interface PageSectionProps {
  /** Строка-заголовок карточки; string → mono-лейбл, иначе рендерится как есть */
  title?: React.ReactNode
  /** Справа в строке заголовка */
  actions?: React.ReactNode
  /** Классы тела карточки (дефолт p-4) */
  bodyClassName?: string
  children: React.ReactNode
  className?: string
}

// Раздел страницы: плоская карточка R10 с INK-рамкой, D0 — БЕЗ тени.
// На мобилке теряет боковые рамки и радиус (верх/низ-границы остаются).
function PageSection({
  title,
  actions,
  bodyClassName,
  children,
  className,
}: PageSectionProps) {
  return (
    <section
      data-slot="page-section"
      className={cn(
        "rounded-xl border border-border bg-card max-md:rounded-none max-md:border-x-0",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          {typeof title === "string" ? (
            <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              {title}
            </span>
          ) : (
            (title ?? <span />)
          )}
          {actions}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

export { PageFrame, AppHeader, PageSection }
