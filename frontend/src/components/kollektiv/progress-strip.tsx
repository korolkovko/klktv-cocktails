import { cn } from "@/lib/utils"

// §44 LEARNING PROGRESS — прогресс изучения «виден всегда, не спрятан в футере».
// ProgressStrip — строка-полоска ПОД фильтрами каждого раздела (тап → панель
// прогресса). ProgressTotal — INK-карта «итого», ТОЛЬКО на странице Прогресс
// (одна инверсия на грид, язык §StatCard). PROFIT-fill; SIGNAL-fill запрещён
// в личном прогрессе (красный — только team-аларм, см. progress-levels).

const pct = (learned: number, total: number) =>
  total > 0 ? Math.round((learned / total) * 100) : 0

export interface ProgressStripProps {
  learned: number
  total: number
  /** Префикс лейбла (mono caps); дефолт «ИЗУЧЕНО» */
  label?: string
  /** Тап по строке → панель прогресса; без него стрелка-хинт скрыта */
  onOpen?: () => void
  className?: string
}

export function ProgressStrip({
  learned,
  total,
  label = "ИЗУЧЕНО",
  onOpen,
  className,
}: ProgressStripProps) {
  const p = pct(learned, total)
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-left",
        onOpen && "cursor-pointer",
        className
      )}
    >
      <span className="font-mono text-[10px] font-bold tracking-[0.06em] whitespace-nowrap">
        {label} · {learned}/{total}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-card">
        <span
          className="block h-full rounded-r-[1px] border-r border-border bg-profit"
          style={{ width: `${p}%` }}
        />
      </span>
      <span className="font-mono text-[11px] font-bold tabular-nums">{p}%</span>
      {onOpen && <span aria-hidden className="font-mono text-[11px] text-[#A1A1AA]">→</span>}
    </button>
  )
}

export interface ProgressTotalProps {
  learned: number
  total: number
  /** mono caps; дефолт «ИЗУЧЕНО ВСЕГО» */
  label?: string
  className?: string
}

/** INK-карта «итого» — только страница Прогресс (одна инверсия на грид) */
export function ProgressTotal({
  learned,
  total,
  label = "ИЗУЧЕНО ВСЕГО",
  className,
}: ProgressTotalProps) {
  const p = pct(learned, total)
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[10px] border border-border bg-primary p-3.5",
        className
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9.5px] tracking-[0.08em] text-[#A1A1AA]">{label}</span>
        <span className="font-mono text-[10px] font-bold text-primary-foreground tabular-nums">{p}%</span>
      </div>
      <div className="font-mono text-[26px] font-bold text-primary-foreground tabular-nums">
        {learned}
        <span className="text-[#71717A]">/{total}</span>
      </div>
      <span className="h-1.5 overflow-hidden rounded-full bg-[#3F3F46]">
        <span className="block h-full bg-profit" style={{ width: `${p}%` }} />
      </span>
    </div>
  )
}
