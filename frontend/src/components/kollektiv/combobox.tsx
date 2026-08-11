import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { highlightMatch } from "@/lib/highlight"
import { Checkbox } from "@/components/ui/checkbox"
import { SearchInput } from "@/components/kollektiv/search-input"

// §19 COMBOBOX · SEARCH + MULTI. Панель — «меню у поля» (канон §18): R6.
// Меню с поиском: ховер/активная строка — BUTTER, подсветка совпадения —
// PROFIT (подсветка НИКОГДА не BUTTER — иначе сливается с ховером).
// Фокус поля поиска — focus-within-акцент нижней границы строки (глобальный
// ринг на инпуте заглушён в index.css, чтобы не рвать кромки панели).
//
// РЕЖИМ ПИКЕРА (onSelect, R31): строки — действия (тап/↵ добавляют, панель
// НЕ помечает выбор ✓/INK). Активная строка (клавиатура ↑/↓) — BUTTER + «↵»,
// Enter добавляет активную; description — mono-подстрока под именем
// (АРТ · В {локации}: N); нулевые disabled. Уже добавленные скрывает
// потребитель (фильтрует options). Обратно совместим: без onSelect —
// поведение single/multi как раньше.

export interface ComboboxOption {
  value: string
  /** Отображение; по умолчанию = value */
  label?: string
  /** mono-подстрока под именем (АРТ · В {локации}: N) */
  description?: string
  disabled?: boolean
}

export interface ComboboxProps {
  options: Array<string | ComboboxOption>
  /** multi = чекбоксы + футер «N SELECTED · ↵ APPLY» */
  multi?: boolean
  /** Выбранные value (controlled) */
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  /** Строка поиска (controlled) */
  query?: string
  defaultQuery?: string
  onQueryChange?: (query: string) => void
  /** ↵ в поле поиска (режим single/multi) */
  onApply?: (value: string[]) => void
  /** РЕЖИМ ПИКЕРА: тап/↵-по-активной = действие; панель не помечает выбор */
  onSelect?: (option: ComboboxOption) => void
  placeholder?: string
  /** Свой футер вместо «N SELECTED · ↵ APPLY» */
  footer?: React.ReactNode
  emptyText?: string
  /** авто-фокус поля поиска (пикер в шите/попапе) */
  autoFocus?: boolean
  /** список заполняет родителя (flex-1) вместо max-h-280 — full-screen пикер */
  fill?: boolean
  className?: string
  "aria-label"?: string
}

function normalize(o: string | ComboboxOption): ComboboxOption {
  return typeof o === "string" ? { value: o } : o
}

function Combobox({
  options,
  multi = false,
  value,
  defaultValue = [],
  onValueChange,
  query,
  defaultQuery = "",
  onQueryChange,
  onApply,
  onSelect,
  placeholder = "Search…",
  footer,
  emptyText = "Ничего не нашлось",
  autoFocus,
  fill,
  className,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [innerValue, setInnerValue] = React.useState<string[]>(defaultValue)
  const [innerQuery, setInnerQuery] = React.useState(defaultQuery)
  const picked = value ?? innerValue
  const q = query ?? innerQuery

  const setPicked = (next: string[]) => {
    if (value === undefined) setInnerValue(next)
    onValueChange?.(next)
  }
  const setQuery = (next: string) => {
    if (query === undefined) setInnerQuery(next)
    onQueryChange?.(next)
  }

  const items = options.map(normalize)
  const visible = items.filter((o) =>
    (o.label ?? o.value).toLowerCase().includes(q.toLowerCase())
  )

  // ─── режим пикера: активная строка (клавиатура) ───
  const firstEnabled = (list: ComboboxOption[]) => {
    const i = list.findIndex((o) => !o.disabled)
    return i < 0 ? 0 : i
  }
  const [active, setActive] = React.useState(0)
  React.useEffect(() => {
    if (onSelect) setActive(firstEnabled(visible))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, options.length])

  const move = (dir: 1 | -1) => {
    setActive((cur) => {
      let i = cur
      for (let k = 0; k < visible.length; k++) {
        i += dir
        if (i < 0 || i >= visible.length) return cur
        if (!visible[i].disabled) return i
      }
      return cur
    })
  }

  const toggle = (o: ComboboxOption) => {
    if (o.disabled) return
    if (multi) {
      setPicked(
        picked.includes(o.value)
          ? picked.filter((v) => v !== o.value)
          : [...picked, o.value]
      )
    } else {
      setPicked([o.value])
    }
  }

  const onEnter = () => {
    if (onSelect) {
      const o = visible[active]
      if (o && !o.disabled) onSelect(o)
    } else {
      onApply?.(picked)
    }
  }

  return (
    <div
      data-slot="combobox"
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-overlay",
        fill && "flex flex-col",
        className
      )}
    >
      {/* поиск панели — §51 SearchInput в контексте popup (тот же корпус без
          рамки, нижний дивайдер + focus-within-акцент); keyboard пикера (↑/↓/↵) —
          passthrough onKeyDown */}
      <SearchInput
        context="popup"
        value={q}
        onChange={setQuery}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && onSelect) {
            e.preventDefault()
            move(1)
          } else if (e.key === "ArrowUp" && onSelect) {
            e.preventDefault()
            move(-1)
          } else if (e.key === "Enter") {
            e.preventDefault()
            onEnter()
          }
        }}
      />

      <div className={cn(fill ? "min-h-0 flex-1 overflow-y-auto" : "max-h-[280px] overflow-y-auto")}>
      {visible.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
      {visible.map((o, i) => {
        const isPicked = picked.includes(o.value)
        const isActive = onSelect && i === active
        return (
          <label
            key={o.value}
            data-state={isPicked ? "checked" : "unchecked"}
            data-active={isActive ? "true" : undefined}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 border-b border-divider px-3 py-2 text-sm last:border-b-0 hover:bg-accent",
              isPicked && !onSelect && "font-semibold",
              o.disabled && "cursor-not-allowed opacity-45",
              isActive && "bg-accent",
              // multi: выбранная строка — BUTTER-заливка (реф §19 мультиселект);
              // чекбокс несёт INK-✓, полоса подсвечивает выбор
              multi && isPicked && "bg-butter hover:bg-butter",
              // single: выбранный — INK + белый + ✓ (канон меню выбора значения)
              !multi && !onSelect && isPicked && "bg-primary text-primary-foreground hover:bg-primary"
            )}
            onClick={onSelect ? () => !o.disabled && onSelect(o) : multi ? undefined : () => toggle(o)}
            onMouseEnter={onSelect ? () => setActive(i) : undefined}
          >
            {multi && (
              <Checkbox
                checked={isPicked}
                disabled={o.disabled}
                onCheckedChange={() => toggle(o)}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block">{highlightMatch(o.label ?? o.value, q)}</span>
              {o.description && (
                <span className="block font-mono text-[9px] text-muted-foreground">
                  {o.description}
                </span>
              )}
            </span>
            {!multi && !onSelect && isPicked && (
              <Check className="ml-auto size-4" strokeWidth={2.4} />
            )}
            {isActive && !o.disabled && (
              <span className="ml-auto shrink-0 font-mono text-[10px] font-bold">↵</span>
            )}
          </label>
        )
      })}
      </div>

      {footer !== undefined
        ? footer
        : multi && (
            <div className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
              {picked.length} SELECTED · ↵ APPLY
            </div>
          )}
    </div>
  )
}

export { Combobox }
