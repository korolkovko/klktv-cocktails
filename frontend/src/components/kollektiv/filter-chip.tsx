import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * §49 FILTER-CHIP (R32/R33) — sans-чип фильтров и лёгких табов.
 *
 * Это НЕ mono-тогл §02 (тот — для данных/сортов, mono caps) и НЕ кнопка:
 * чип переключает ВИД списка, не коммитит действие — потому БЕЗ ТЕНИ всегда.
 * sans 13/600, INK-рамка R6, h38 (desktop) / min-h 40 (mobile).
 *
 * ACTIVE ≠ APPLIED (R33): `active` (INK-fill) — плоский переключатель «один из N»
 * (вид списка, вкл. дефолт «Все»); `applied` (BUTTER-fill) — чип, несущий выбранное
 * ЗНАЧЕНИЕ (select-▾ не-дефолт, «+ Filter»-фильтр с ✕). Одновременно нельзя (dev-assert).
 *
 * Слоты:
 *  - `count` — counter-чип mono 10. Тон: `countTone="signal"` (дефолт) — SIGNAL при >0,
 *    muted при 0 (тревога); `countTone="muted"` — всегда CONCRETE (информационный, фасеты
 *    «All 48»). На ЗАЛИВКЕ (active INK или applied BUTTER) — белый с INK-текстом,
 *    на butter + INK-рамка;
 *  - `select` — «▾» select-чипа (оборачивается в Popover/Combobox §19 у потребителя);
 *  - `dashed` — «+ Filter» (добавить ось, §06b);
 *  - `onRemove` — «✕» снять applied-фильтр.
 *
 * A11y: счётчик декоративен — доступное имя даёт `aria-label` полным текстом
 * («С расхождением: 4»); группа несёт role="tablist"/«radiogroup» (см. ChipRow).
 */
function FilterChip({
  active,
  applied,
  count,
  countTone = "signal",
  select,
  dashed,
  mobile,
  onRemove,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  /** ACTIVE (INK-заливка) — плоский чип-переключатель «один из N» (вид списка) */
  active?: boolean
  /** APPLIED (BUTTER-заливка) — чип, несущий выбранное ЗНАЧЕНИЕ (select-▾ не-дефолт,
   *  «+ Filter»-фильтр). Одновременно с active нельзя (dev-assert) */
  applied?: boolean
  /** counter-слот; undefined — без счётчика */
  count?: number
  /** тон счётчика: signal (>0 SIGNAL / 0 muted — тревога) | muted (всегда CONCRETE,
   *  информационный — фасеты «All 48»). На любой заливке — белый с INK-текстом */
  countTone?: "signal" | "muted"
  /** select-чип: рисует «▾» (потребитель вешает Popover/Combobox) */
  select?: boolean
  /** dashed «+ Filter» */
  dashed?: boolean
  /** оверрайд мобильной высоты для витринных специменов */
  mobile?: boolean
  /** ✕ для applied «+ Filter»-фильтров (снять фильтр); не смешивать с select */
  onRemove?: () => void
}) {
  if (import.meta.env.DEV && active && applied) {
    console.error(
      "FilterChip: active и applied одновременно нельзя (§49) — active (INK) = вид списка «один из N»; applied (BUTTER) = выбранное значение"
    )
  }
  const filled = active || applied
  return (
    <button
      type="button"
      data-slot="filter-chip"
      data-chip-active={active ? "true" : undefined}
      data-chip-applied={applied ? "true" : undefined}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 font-sans text-[13px] font-semibold transition-colors outline-none select-none",
        mobile ? "min-h-10" : "h-[38px] max-md:min-h-10",
        dashed
          ? "border-dashed border-border bg-card text-[#52525B] hover:bg-muted"
          : applied
            ? "border-border bg-butter text-foreground hover:bg-[#FBF1A0]"
            : active
              ? "border-border bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted",
        "disabled:cursor-not-allowed disabled:border-[#E4E4DF] disabled:bg-muted disabled:text-[#A1A1AA] disabled:hover:bg-muted",
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span
          aria-hidden
          className={cn(
            "inline-flex items-center rounded-[4px] px-[5px] font-mono text-[10px] font-bold tabular-nums",
            // на заливке (INK или BUTTER) — белый с INK-текстом; на butter — с рамкой
            filled
              ? applied
                ? "border border-border bg-card text-foreground"
                : "bg-card text-foreground"
              : countTone === "muted"
                ? "bg-muted text-muted-foreground"
                : count > 0
                  ? "bg-loss text-loss-foreground"
                  : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
      {select && (
        <span aria-hidden className="text-[9px] leading-none opacity-80">
          ▾
        </span>
      )}
      {onRemove && !select && (
        <span
          role="button"
          aria-label="Снять фильтр"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onRemove()
            }
          }}
          className="-mr-0.5 ml-0.5 inline-flex size-4 items-center justify-center rounded-[3px] text-[11px] leading-none hover:bg-black/10"
        >
          ✕
        </span>
      )}
    </button>
  )
}

/**
 * Ряд чипов: desktop — wrap; mobile — осознанная h-scroll карусель (исключение
 * из запрета h-скролла: это выбор данных, не навигация) с fade-кромкой 28px
 * справа и автоскроллом к активному. Перенос строк на мобилке нельзя (канон).
 */
function ChipRow({
  children,
  role,
  mobile,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode
  /** role группы по смыслу: "tablist" | "radiogroup" */
  role?: React.AriaRole
  /** оверрайд: всегда карусель (витринный mobile-специмен) */
  mobile?: boolean
  className?: string
  "aria-label"?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // fade + автоскролл нужны ТОЛЬКО когда ряд реально оверфлоит (desktop-wrap
  // не оверфлоит никогда → нет fade-смаза на белом card; на мобилке fade даёт
  // «дальше есть ещё»). Меряем на маунт + resize (набор чипов статичен per-view).
  const [overflowing, setOverflowing] = React.useState(false)
  React.useEffect(() => {
    const c = ref.current
    if (!c) return
    const measure = () => setOverflowing(c.scrollWidth > c.clientWidth + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  // Автоскролл активного чипа в центр — scrollBy двигает ТОЛЬКО контейнер, не
  // страницу (scrollIntoView увёл бы вьюпорт). Гон на каждый рендер дёшев (гварды).
  React.useEffect(() => {
    const c = ref.current
    if (!c || !overflowing) return
    const el = c.querySelector<HTMLElement>('[data-chip-active="true"]')
    if (!el) return
    const cr = c.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    const delta = er.left + er.width / 2 - (cr.left + cr.width / 2)
    if (Math.abs(delta) > 1) c.scrollBy({ left: delta, behavior: "smooth" })
  })

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        role={role}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center gap-1.5",
          mobile
            ? "overflow-x-auto pr-7 [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden"
            : "flex-wrap max-md:flex-nowrap max-md:overflow-x-auto max-md:pr-7 max-md:[scrollbar-width:none] max-md:[&>*]:shrink-0 max-md:[&::-webkit-scrollbar]:hidden"
        )}
      >
        {children}
      </div>
      {/* fade-кромка 28px: «дальше есть ещё» (реф §49 / канон карусели) */}
      {overflowing && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-r from-transparent to-background"
        />
      )}
    </div>
  )
}

export { FilterChip, ChipRow }
