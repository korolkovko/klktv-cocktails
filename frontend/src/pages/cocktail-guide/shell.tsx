import * as React from "react"
import { Book, LayoutGrid, Martini, Menu, Utensils, X } from "lucide-react"

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { BottomNav } from "@/components/kollektiv/bottom-nav"
import { cn } from "@/lib/utils"
import { useContent } from "@/data/ContentContext"
import type { User } from "@/auth/AuthContext"

import { type SectionId } from "./data"

// Каркас справочника (§45 гибрид навигации): desktop — табы в шапке; mobile —
// bottom-nav §07 из 4 ячеек (Меню · Классика · Прогресс · Разделы) + шапка
// с бургером. «Разделы» открывает §42-sheet с хвостом категорий, прогрессом,
// админ-пунктами по ролям и юзером. Футер прежнего сайта упразднён — всё в sheet.
// Task 4: SECTIONS/TOTAL_POSITIONS приезжают через useContent(); user/onSignOut
// — реальные (из AuthContext), threaded из page.tsx; sheet-бейдж прогресса —
// live total, посчитанный один раз в page.tsx (totalLearnedLive), а не
// удалённая статическая TOTAL_LEARNED (blueprint §E.9).

const pct = (l: number, t: number) => (t > 0 ? Math.round((l / t) * 100) : 0)

/** роут-разделы (в т.ч. виртуальный progress; «Мой/Команда» — табы ВНУТРИ
 *  прогресса, не отдельный роут) */
export type Route = SectionId | "progress"

const DESKTOP_TABS: { id: Route; label: string }[] = [
  { id: "menu", label: "Авторские" },
  { id: "classics", label: "Классика" },
  { id: "spirits", label: "Спириты" },
  { id: "kitchen", label: "Кухня" },
  { id: "progress", label: "Прогресс" },
]

// bottom-nav = 5 ячеек (R27.1): Авторские · Кухня · Классика · Спириты · Разделы;
// Прогресс не имеет своей ячейки → активна «Разделы» (Прогресс — в шите).
// Безалко/Zero Culture слиты в Авторские (Task 5, blueprint §E) — больше не роуты.
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

/** «МК» из «Майкл» / «nkorolkov» из юзернейма без имени — 2 буквы для аватар-чипа */
function userInitials(user: User) {
  const base = (user.name?.trim() || user.username).trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

/* ---------- desktop шапка ---------- */

export function CocktailDesktopHeader({
  route,
  onNavigate,
  user,
  onSignOut,
}: {
  route: Route
  onNavigate: (r: Route) => void
  user: User
  onSignOut: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5 max-md:hidden">
      <div className="flex items-center gap-6">
        <img src="/logo.png" alt="Kollektiv" className="h-8 w-auto" />
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
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Меню пользователя"
          className="flex size-[30px] cursor-pointer items-center justify-center rounded-full border border-border bg-primary font-mono text-[10px] font-bold text-primary-foreground"
        >
          {userInitials(user)}
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Закрыть меню"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-48 rounded-[10px] border border-border bg-card p-1.5 shadow-overlay">
              <div className="px-2.5 py-2 text-[13px] font-semibold">
                {user.name ?? user.username} <span className="text-[#71717A]">· {user.role}</span>
              </div>
              {user.role !== "reader" && (
                <>
                  <div className="mx-1 border-t border-divider" />
                  <a
                    href="/admin"
                    className="flex min-h-9 w-full cursor-pointer items-center rounded-md px-2.5 text-[13px] font-semibold hover:bg-muted"
                  >
                    Админка
                  </a>
                </>
              )}
              <div className="mx-1 border-t border-divider" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onSignOut()
                }}
                className="mt-1 flex min-h-9 w-full cursor-pointer items-center rounded-md px-2.5 font-mono text-[10px] font-bold tracking-[0.06em] text-[#52525B] hover:bg-muted"
              >
                ВЫЙТИ ↪
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- mobile шапка + разделы-sheet ---------- */

export function CocktailMobileHeader({
  route,
  onNavigate,
  user,
  onSignOut,
  total,
}: {
  route: Route
  onNavigate: (r: Route) => void
  user: User
  onSignOut: () => void
  total: number
}) {
  const [open, setOpen] = React.useState(false)
  const { SECTIONS } = useContent()
  const label =
    route === "progress" ? "Прогресс" : SECTIONS.find((s) => s.id === route)?.label ?? "Авторские"
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 pt-[calc(12px+env(safe-area-inset-top))] md:hidden">
      <span className="inline-flex items-center gap-2 min-w-0">
        <img src="/logo.png" alt="Kollektiv" className="h-7 w-auto shrink-0" />
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
        user={user}
        onSignOut={onSignOut}
        total={total}
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
  user,
  onSignOut,
  total,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  route: Route
  onNavigate: (r: Route) => void
  user: User
  onSignOut: () => void
  total: number
}) {
  const { SECTIONS, TOTAL_POSITIONS } = useContent()
  const totalPct = pct(total, TOTAL_POSITIONS)
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
          {/* «Прогресс команды» больше не отдельный пункт — это таб «Команда»
              внутри раздела Прогресс (виден всем) */}
          {/* Task 7: реальная ссылка на /admin (было 2 статичных демо-пункта
              «Управление контентом»/«Юзеры» без onClick) — editor видит один
              общий вход, юзеров бэкенд всё равно ограничивает require_admin. */}
          {user.role !== "reader" && (
            <a href="/admin" className={cn(row, "hover:bg-[#FFFDF0]")}>
              <span className="text-[15px] font-semibold">Админка</span>
              <span className="font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">
                {user.role === "admin" ? "ADMIN" : "EDITOR+"}
              </span>
            </a>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-border px-2.5 pt-3">
            <span className="inline-flex items-center gap-2.5">
              <span className="flex size-[30px] items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px] font-bold">
                {userInitials(user)}
              </span>
              <span className="text-[13px] font-semibold">
                {user.name ?? user.username} · <span className="text-[#71717A]">{user.role}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={onSignOut}
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
  user,
  onSignOut,
  total,
}: {
  route: Route
  onNavigate: (r: Route) => void
  user: User
  onSignOut: () => void
  total: number
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
        user={user}
        onSignOut={onSignOut}
        total={total}
      />
    </>
  )
}

export { X }
