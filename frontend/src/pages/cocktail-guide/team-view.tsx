import * as React from "react"

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { ProgressLevels } from "@/components/kollektiv/progress-levels"
import { cn } from "@/lib/utils"

import {
  TEAM,
  TEAM_AVG_SECTIONS,
  TEAM_STATS,
  classicsLearnedLive,
  familyLearnedLive,
  type Classic,
  type Staff,
} from "./data"
import { useContent } from "@/data/ContentContext"

const pct = (l: number, t: number) => (t > 0 ? Math.round((l / t) * 100) : 0)

/* ---------- 3q панель по семействам (со строки-полоски классики) ---------- */

export function FamiliesPanel({
  open,
  onOpenChange,
  learnedIds,
  onOpenClassic,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  learnedIds: Set<string>
  /** тап по строке списка → закрыть панель и открыть деталь классики (колода «Все») */
  onOpenClassic: (c: Classic) => void
}) {
  const content = useContent()
  const { FAMILIES, CLASSICS, CLASSICS_TOTAL } = content
  const [tab, setTab] = React.useState<"known" | "unknown">("known")
  const shown = FAMILIES.slice(0, 6)
  const rest = FAMILIES.slice(6).map((f) => f.code)
  // LIVE (R27): всё из learnedIds, статики убраны
  const learned = classicsLearnedLive(content, learnedIds)
  const known = CLASSICS.filter((c) => learnedIds.has(c.id))
  const unknown = CLASSICS.filter((c) => !learnedIds.has(c.id))
  const list = tab === "known" ? known : unknown
  // общий счёт вкладки (каталог), список показывает демо-позиции + «··· N MORE ···»
  const listTotal = tab === "known" ? learned : CLASSICS_TOTAL - learned
  const more = listTotal - list.length
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerTitle className="sr-only">Прогресс по семействам</DrawerTitle>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] pt-2.5 pb-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[26px] font-bold tabular-nums">
              {learned}
              <span className="text-[#A1A1AA]">/{CLASSICS_TOTAL}</span>
            </span>
            <span className="font-mono text-[11px] font-bold">
              {pct(learned, CLASSICS_TOTAL)}% <span className="font-normal text-[#A1A1AA]">ВЫУЧЕНО</span>
            </span>
          </div>
          <div className="border-t border-divider" />
          <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-[#A1A1AA]">ПО СЕМЕЙСТВАМ</span>
          <ProgressLevels levels={shown.map((f) => ({ name: f.code, tint: f.tint, learned: familyLearnedLive(f.tint, content, learnedIds), total: f.total }))} />
          <div className="text-center font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">
            ··· {rest.join(" · ")} ···
          </div>
          <div className="border-t border-divider" />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTab("known")}
              className={cn("flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md border border-border text-[13px] font-semibold", tab === "known" ? "bg-primary text-primary-foreground" : "bg-card")}
            >
              Знаю · {learned}
            </button>
            <button
              type="button"
              onClick={() => setTab("unknown")}
              className={cn("flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md border border-border text-[13px] font-semibold", tab === "unknown" ? "bg-primary text-primary-foreground" : "bg-card")}
            >
              Не знаю · {CLASSICS_TOTAL - learned}
            </button>
          </div>
          <div className="flex flex-col">
            {list.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenClassic(c)}
                className={cn("flex min-h-11 cursor-pointer items-center justify-between text-left hover:bg-[#FFFDF0]", i < list.length - 1 && "border-b border-divider")}
              >
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="font-mono text-[9.5px] text-[#A1A1AA]">{c.glass.toUpperCase()} →</span>
              </button>
            ))}
            {list.length === 0 && (
              <div className="py-4 text-center text-[13px] text-[#52525B]">
                {tab === "known" ? "Пока ничего не отмечено." : "Всё отмечено — красавчик."}
              </div>
            )}
            {more > 0 && (
              <div className="pt-2 text-center font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">
                ··· {more} MORE ···
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* ---------- 3s Прогресс команды (ADMIN) ---------- */

const SECTION_COLS: { key: keyof Staff["sections"]; label: string }[] = [
  { key: "menu", label: "АВТОРСКИЕ" },
  { key: "classics", label: "КЛАССИКА" },
  { key: "spirits", label: "СПИРИТЫ" },
  { key: "kitchen", label: "КУХНЯ" },
  { key: "zero", label: "БЕЗАЛКО" },
  { key: "zc", label: "ZC" },
]

// R27.1: подстроки-списки имён капятся до 2 + «+N» (масштаб на 12 человек;
// чип НЕ переносится). all → спец-слово (ВСЯ КОМАНДА ✓), пусто → emptyWord.
function capNames(names: string[], opts?: { all?: number; allWord?: string; emptyWord?: string }) {
  if (names.length === 0) return opts?.emptyWord ?? ""
  if (opts?.all !== undefined && names.length >= opts.all) return opts.allWord ?? names.join(" · ")
  if (names.length <= 2) return names.join(" · ")
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`
}

// fill бара = уровень §44 (ХОРОШО ≥80 PROFIT · ЧАСТИЧНО ≥40 BUTTER · НЕ ИЗУЧЕНО
// muted); SIGNAL — ТОЛЬКО team-аларм <30 (ревью R24, порог красного 30, не 40)
const weak = (v: number) => v < 30
const levelFill = (v: number) => (v >= 80 ? "bg-profit" : v >= 40 ? "bg-butter" : "bg-[#EDEDE8]")
const barFill = (v: number) => (weak(v) ? "bg-signal" : levelFill(v))

export function TeamView() {
  const rows = [...TEAM].sort((a, b) => a.overall - b.overall)
  return (
    <div className="flex flex-col gap-3.5" data-testid="cg-team">
      <div className="flex justify-end max-md:hidden">
        <span className="font-mono text-[11px] text-[#71717A]">
          {TEAM_STATS.staffCount} СОТРУДНИКОВ · 186 ПОЗИЦИЙ В БАЗЕ
        </span>
      </div>

      {/* статы 4× (mobile 2×2) */}
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <Stat inverse label="TEAM AVG" value={`${TEAM_STATS.avg}%`} chip={{ text: `+${TEAM_STATS.avgDeltaPp} PP ЗА МЕСЯЦ`, tone: "butter" }} />
        <Stat
          label="АВТОРСКИЕ ЦЕЛИКОМ"
          value={<>{TEAM_STATS.fullMenu}<span className="text-[#A1A1AA]">/{TEAM_STATS.staffCount}</span></>}
          note={capNames(TEAM_STATS.fullMenuNames, { all: TEAM_STATS.staffCount, allWord: "ВСЯ КОМАНДА ✓" })}
        />
        <Stat
          label="ОТСТАЮТ · <30%"
          value={<span className="text-loss-foreground">{TEAM_STATS.behind}</span>}
          // 0 отстающих → чипа нет, muted-подстрока НИКТО; иначе SIGNAL-чип 2 имени + «+N»
          chip={TEAM_STATS.behind > 0 ? { text: capNames(TEAM_STATS.behindNames), tone: "loss" } : undefined}
          note={TEAM_STATS.behind > 0 ? undefined : "НИКТО"}
        />
        <Stat
          label="АКТИВНЫ · 7Д"
          value={<>{TEAM_STATS.active}<span className="text-[#A1A1AA]">/{TEAM_STATS.staffCount}</span></>}
          // всегда один худший; активны все → ВСЯ КОМАНДА ЗА НЕДЕЛЮ
          note={TEAM_STATS.active >= TEAM_STATS.staffCount ? "ВСЯ КОМАНДА ЗА НЕДЕЛЮ" : TEAM_STATS.activeNote}
        />
      </div>

      {/* desktop-таблица */}
      <div className="overflow-hidden rounded-[10px] border border-border bg-card max-md:hidden">
        <div className="grid items-center gap-x-2 bg-primary px-3.5 py-2 font-mono text-[10px] tracking-[0.06em] text-primary-foreground" style={{ gridTemplateColumns: "1fr 200px 70px 84px 76px 66px 72px 50px 110px" }}>
          <span>STAFF</span>
          <span>OVERALL ▲</span>
          {SECTION_COLS.map((c) => (
            <span key={c.key} className="text-right">{c.label}</span>
          ))}
          <span className="text-right">АКТИВНОСТЬ</span>
        </div>
        {rows.map((s) => (
          <div
            key={s.initials}
            className={cn("grid items-center gap-x-2 border-b border-divider px-3.5 py-[9px]", weak(s.overall) && "bg-[#FFF5F4]")}
            style={{ gridTemplateColumns: "1fr 200px 70px 84px 76px 66px 72px 50px 110px" }}
          >
            <Avatar s={s} />
            <span className="flex items-center gap-2">
              <span className="h-[5px] flex-1 overflow-hidden rounded-full border border-border bg-card">
                <span className={cn("block h-full", weak(s.overall) ? "" : "rounded-r-[1px] border-r border-border", barFill(s.overall))} style={{ width: `${s.overall}%` }} />
              </span>
              <span className={cn("w-[34px] text-right font-mono text-[12px] font-bold tabular-nums", weak(s.overall) && "text-loss-foreground")}>{s.overall}%</span>
            </span>
            {SECTION_COLS.map((c) => {
              const v = s.sections[c.key]
              return (
                <span key={c.key} className={cn("text-right font-mono text-[12px] tabular-nums", weak(v) && "font-bold text-loss-foreground", v === 100 && "font-bold")}>
                  {v}
                </span>
              )
            })}
            <span className={cn("text-right font-mono text-[11px]", s.activityAlarm ? "font-bold text-loss-foreground" : "text-[#71717A]")}>
              {s.activity}
            </span>
          </div>
        ))}
        <div className="grid items-center gap-x-2 border-t border-border bg-butter px-3.5 py-[9px] font-bold" style={{ gridTemplateColumns: "1fr 200px 70px 84px 76px 66px 72px 50px 110px" }}>
          <span className="text-[13px]">TEAM AVG</span>
          <span className="font-mono text-[12px]">{TEAM_STATS.avg}%</span>
          {SECTION_COLS.map((c) => (
            <span key={c.key} className="text-right font-mono text-[12px]">{TEAM_AVG_SECTIONS[c.key]}</span>
          ))}
          <span />
        </div>
      </div>
      <div className="font-mono text-[10px] text-[#A1A1AA] max-md:hidden">
        КЛИК ПО СТРОКЕ → ДЕТАЛЬ СОТРУДНИКА: РАЗДЕЛЫ БАРАМИ + СПИСКИ ЗНАЮ/НЕ ЗНАЮ (ПАТТЕРН 3q) · ЗНАЧЕНИЯ КОЛОНОК — % РАЗДЕЛА
      </div>

      {/* mobile-карточки */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((s) => (
          <div key={s.initials} className={cn("flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3", weak(s.overall) && "bg-[#FFF5F4]")}>
            <div className="flex items-center gap-2.5">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] font-bold", s.admin ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {s.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{s.name}</span>
                <span className="block font-mono text-[9px] text-[#A1A1AA]">{s.role}</span>
              </span>
              <span className={cn("font-mono text-[15px] font-bold tabular-nums", weak(s.overall) && "text-loss-foreground")}>{s.overall}%</span>
            </div>
            <span className="h-[5px] overflow-hidden rounded-full border border-border bg-card">
              <span className={cn("block h-full", weak(s.overall) ? "" : "rounded-r-[1px] border-r border-border", barFill(s.overall))} style={{ width: `${s.overall}%` }} />
            </span>
            <div className="flex justify-between font-mono text-[9px]">
              <span className={cn(weak(s.overall) ? "font-bold text-loss-foreground" : "text-[#71717A]")}>
                {s.weak ? `СЛАБОЕ: ${s.weak}` : s.strongNote}
              </span>
              <span className={cn(s.activityAlarm ? "font-bold text-loss-foreground" : "text-[#A1A1AA]")}>{s.lastSeen}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Avatar({ s }: { s: Staff }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[9px] font-bold", s.admin ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {s.initials}
      </span>
      <span>
        <span className="block text-[13px] font-semibold">{s.name}</span>
        <span className="block font-mono text-[8.5px] text-[#A1A1AA]">{s.role}</span>
      </span>
    </span>
  )
}

function Stat({
  label,
  value,
  chip,
  note,
  inverse,
}: {
  label: string
  value: React.ReactNode
  chip?: { text: string; tone: "butter" | "loss" }
  note?: string
  inverse?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-[10px] border border-border p-3.5", inverse ? "bg-primary" : "bg-card")}>
      <span className={cn("font-mono text-[9.5px] tracking-[0.08em]", inverse ? "text-[#A1A1AA]" : "text-[#71717A]")}>{label}</span>
      <span className={cn("font-mono text-[24px] font-bold tabular-nums", inverse && "text-primary-foreground")}>{value}</span>
      {chip && (
        <span className={cn("w-fit rounded-[4px] border border-border px-[7px] py-px font-mono text-[10px] font-bold", chip.tone === "butter" ? "bg-butter" : "bg-loss text-loss-foreground")}>
          {chip.text}
        </span>
      )}
      {note && <span className="font-mono text-[10px] text-[#71717A]">{note}</span>}
    </div>
  )
}
