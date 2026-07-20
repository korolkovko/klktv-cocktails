import { cn } from "@/lib/utils"
import { TintMarker } from "@/components/kollektiv/tint-marker"

// §44 УРОВНИ ПО ГРУППАМ + TEAM-АЛАРМ. Пороги: ХОРОШО ≥80% (PROFIT) ·
// ЧАСТИЧНО ≥40% (BUTTER) · НЕ ИЗУЧЕНО (muted). Fill бара ПОВТОРЯЕТ уровень.
// SIGNAL-fill (красный) — ТОЛЬКО team-аларм (сотрудник <30% в админ-вьюхе);
// в личном прогрессе красного нет. Без геймификации сверх уровней.

export type LearningLevel = "good" | "partial" | "none"

export function learningLevel(pct: number): LearningLevel {
  if (pct >= 80) return "good"
  if (pct >= 40) return "partial"
  return "none"
}

const LEVEL = {
  good: { fill: "bg-profit", badge: "bg-profit border border-border text-foreground", label: "ХОРОШО" },
  partial: { fill: "bg-butter", badge: "bg-butter border border-border text-foreground", label: "ЧАСТИЧНО" },
  none: { fill: "bg-[#EDEDE8]", badge: "bg-[#EDEDE8] text-[#71717A]", label: "НЕ ИЗУЧЕНО" },
} as const

export interface ProgressLevel {
  name: string
  /** имя таксономии для тинт-маркера (sour/negroni/…); без него маркера нет */
  tint?: string
  learned: number
  total: number
}

/** Fill-бар уровня (5px, INK-рамка) — переиспользуется строками */
function LevelBar({ pct, level }: { pct: number; level: LearningLevel }) {
  return (
    <span className="h-[5px] overflow-hidden rounded-full border border-border bg-card">
      <span
        className={cn("block h-full rounded-r-[1px] border-r border-border", LEVEL[level].fill)}
        style={{ width: `${pct}%` }}
      />
    </span>
  )
}

export interface ProgressLevelsProps {
  levels: ProgressLevel[]
  className?: string
}

export function ProgressLevels({ levels, className }: ProgressLevelsProps) {
  return (
    <div className={cn("flex flex-col gap-[7px]", className)}>
      {levels.map((l) => {
        const pct = l.total > 0 ? Math.round((l.learned / l.total) * 100) : 0
        const level = learningLevel(pct)
        return (
          <div
            key={l.name}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "92px 1fr 34px 84px" }}
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase">
              {l.tint && <TintMarker tint={l.tint} />}
              {l.name}
            </span>
            <LevelBar pct={pct} level={level} />
            <span className="text-right font-mono text-[10px] tabular-nums">
              {l.learned}/{l.total}
            </span>
            <span
              className={cn(
                "justify-self-end rounded-[4px] px-[5px] py-px font-mono text-[8px] font-bold",
                LEVEL[level].badge
              )}
            >
              {LEVEL[level].label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export interface TeamAlarmProps {
  /** процент отстающего (SIGNAL-fill) */
  pct: number
  label?: string
  className?: string
}

/** Team-аларм: единственный SIGNAL-бар прогресса (админ-вьюха, <30%) */
export function TeamAlarm({ pct, label = "TEAM · ОТСТАЁТ", className }: TeamAlarmProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="font-mono text-[10px] font-bold whitespace-nowrap text-loss-foreground">{label}</span>
      <span className="h-[5px] flex-1 overflow-hidden rounded-full border border-border bg-card">
        <span className="block h-full bg-signal" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[12px] font-bold text-loss-foreground tabular-nums">{pct}%</span>
    </div>
  )
}
