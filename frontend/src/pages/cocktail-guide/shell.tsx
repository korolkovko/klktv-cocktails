import * as React from "react"
import { Book, LayoutGrid, Martini, Menu, Utensils, X } from "lucide-react"

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { BottomNav } from "@/components/kollektiv/bottom-nav"
import { cn } from "@/lib/utils"

import { SECTIONS, TOTAL_LEARNED, TOTAL_POSITIONS, type SectionId } from "./data"

// Каркас справочника (§45 гибрид навигации): desktop — табы в шапке; mobile —
// bottom-nav §07 из 4 ячеек (Меню · Классика · Прогресс · Разделы) + шапка
// с бургером. «Разделы» открывает §42-sheet с хвостом категорий, прогрессом,
// админ-пунктами по ролям и юзером. Футер прежнего сайта упразднён — всё в sheet.

const pct = (l: number, t: number) => (t > 0 ? Math.round((l / t) * 100) : 0)

/** роут-разделы (в т.ч. виртуальный progress) */
export type Route = SectionId | "progress"

const DESKTOP_TABS: { id: Route; label: string }[] = [
  { id: "menu", label: "Авторские" },
  { id: "classics", label: "Классика" },
  { id: "spirits", label: "Спириты" },
  { id: "kitchen", label: "Кухня" },
  { id: "zero", label: "Безалко" },
  { id: "zc", label: "Zero Culture" },
  { id: "progress", label: "Прогресс" },
]

// bottom-nav = 5 ячеек (R27.1): Авторские · Кухня · Классика · Спириты · Разделы;
// Прогресс/Безалко/ZC не имеют своей ячейки → активна «Разделы» (Прогресс — в шите)
const NAV_PRIMARY: Route[] = ["menu", "kitchen", "classics", "spirits"]

/** бутылка спирита — инлайн из реф-SVG (в lucide нет плоской бутылки) */
function BottleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8" />
      <path d="M9 2v2.3c0 .5-.1.9-.4 1.3L6 10.5c-.3.4-.5 1-.5 1.5V20a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-8c0-.5-.2-1.1-.5-1.5L15.4 5.6c-.3-.4-.4-.8-.4-1.3V2" />
    </svg>
  )
}

function Wordmark({ size = 17 }: { size?: number }) {
  return (
    <span className="font-mono font-extrabold tracking-[-0.02em]" style={{ fontSize: size }}>
      KOLLEKTIV<span className="text-signal">®</span>
    </span>
  )
}

/* ---------- desktop шапка ---------- */

export function CocktailDesktopHeader({
  route,
  onNavigate,
}: {
  route: Route
  onNavigate: (r: Route) => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5 max-md:hidden">
      <div className="flex items-center gap-6">
        <Wordmark />
        <nav className="flex gap-1 text-[13px] font-semibold">
          {DESKTOP_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onNavigate(t.id)}
              className={cn(
                "cursor-pointer rounded-md px-3.5 py-[7px]",
                route === t.id ? "bg-primary text-primary-foreground" : "text-[#52525B] hover:bg-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <span className="flex size-[30px] items-center justify-center rounded-full border border-border bg-primary font-mono text-[10px] font-bold text-primary-foreground">
        МК
      </span>
    </div>
  )
}

/* ---------- mobile шапка + разделы-sheet ---------- */

export function CocktailMobileHeader({
  route,
  onNavigate,
}: {
  route: Route
  onNavigate: (r: Route) => void
}) {
  const [open, setOpen] = React.useState(false)
  const label =
    route === "progress" ? "Прогресс" : SECTIONS.find((s) => s.id === route)?.label ?? "Авторские"
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 pt-[calc(12px+env(safe-area-inset-top))] md:hidden">
      <span className="inline-flex items-baseline gap-2.5 min-w-0">
        <Wordmark size={15} />
        <span className="truncate text-[13px] font-semibold text-[#52525B]">· {label}</span>
      </span>
      <button
        type="button"
        aria-label="Разделы"
        onClick={() => setOpen(true)}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-border bg-card"
      >
        <Menu className="size-[15px]" strokeWidth={2} />
      </button>
      <SectionsSheet
        open={open}
        onOpenChange={setOpen}
        route={route}
        onNavigate={(r) => {
          setOpen(false)
          onNavigate(r)
        }}
      />
    </div>
  )
}

/** §42-sheet «Разделы»: категории + прогресс + роли + юзер (открывается
 *  бургером mobile-шапки И ячейкой «Разделы» bottom-nav) */
export function SectionsSheet({
  open,
  onOpenChange,
  route,
  onNavigate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  route: Route
  onNavigate: (r: Route) => void
}) {
  const totalPct = pct(TOTAL_LEARNED, TOTAL_POSITIONS)
  const row = "flex min-h-12 items-center justify-between rounded-[10px] px-3 cursor-pointer"
  const count = "font-mono text-[10px] font-bold"
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerTitle className="sr-only">Разделы</DrawerTitle>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3.5 pb-3.5">
          <div className="px-2.5 pt-1 pb-2 font-mono text-[9.5px] font-bold tracking-[0.1em] text-[#A1A1AA]">
            KOLLEKTIV · РАЗДЕЛЫ
          </div>
          {SECTIONS.map((s) => {
            const active = route === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onNavigate(s.id)}
                className={cn(row, active ? "bg-primary" : "hover:bg-[#FFFDF0]")}
              >
                <span className={cn("text-[15px] font-bold", active ? "text-primary-foreground" : "font-semibold")}>
                  {s.label}
                </span>
                <span
                  className={cn(
                    count,
                    active ? "text-primary-foreground" : "rounded-[4px] bg-muted px-1.5 py-px"
                  )}
                >
                  {s.total}
                </span>
              </button>
            )
          })}
          <div className="mx-2.5 my-1.5 border-t border-divider" />
          <button
            type="button"
            onClick={() => onNavigate("progress")}
            className={cn(row, route === "progress" ? "bg-primary" : "hover:bg-[#FFFDF0]")}
          >
            <span className={cn("text-[15px]", route === "progress" ? "font-bold text-primary-foreground" : "font-semibold")}>
              Прогресс изучения
            </span>
            <span className="rounded-[4px] border border-border bg-profit px-1.5 py-px font-mono text-[10px] font-bold">
              {totalPct}%
            </span>
          </button>
          {/* админ-пункты по ролям (демо — статичные роли) */}
          <div className={cn(row, "hover:bg-[#FFFDF0]")}>
            <span className="text-[15px] font-semibold">Управление контентом</span>
            <span className="font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">EDITOR+</span>
          </div>
          <div className={cn(row, "hover:bg-[#FFFDF0]")}>
            <span className="text-[15px] font-semibold">Юзеры</span>
            <span className="font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">ADMIN</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border px-2.5 pt-3">
            <span className="inline-flex items-center gap-2.5">
              <span className="flex size-[30px] items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px] font-bold">
                МК
              </span>
              <span className="text-[13px] font-semibold">
                Майкл · <span className="text-[#71717A]">admin</span>
              </span>
            </span>
            <button
              type="button"
              className="cursor-pointer font-mono text-[10px] font-bold tracking-[0.06em] text-[#52525B] underline underline-offset-[3px]"
            >
              ВЫЙТИ ↪
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* ---------- mobile bottom-nav ---------- */

export function CocktailBottomNav({
  route,
  onNavigate,
}: {
  route: Route
  onNavigate: (r: Route) => void
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false)
  // «Разделы» активна, если открыт раздел вне трёх primary
  const navActive = NAV_PRIMARY.includes(route) ? route : "sections"
  return (
    <>
      <BottomNav
        className="md:hidden"
        activeId={navActive}
        onChange={(id) => {
          if (id === "sections") setSheetOpen(true)
          else onNavigate(id as Route)
        }}
        items={[
          { id: "menu", label: "АВТОРСКИЕ", icon: <Martini /> },
          { id: "kitchen", label: "КУХНЯ", icon: <Utensils /> },
          { id: "classics", label: "КЛАССИКА", icon: <Book /> },
          { id: "spirits", label: "СПИРИТЫ", icon: <BottleIcon /> },
          { id: "sections", label: "РАЗДЕЛЫ", icon: <LayoutGrid /> },
        ]}
      />
      <SectionsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        route={route}
        onNavigate={(r) => {
          setSheetOpen(false)
          onNavigate(r)
        }}
      />
    </>
  )
}

export { Wordmark, X }
