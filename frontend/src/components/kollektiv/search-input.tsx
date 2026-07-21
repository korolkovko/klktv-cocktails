import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { pluralRu } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"

// §51 SEARCH-INPUT (R34) — инлайн-поиск ВИДИМОГО списка (не команда, не переход):
// тот самый инпут, что годами копипастился по страницам (Cost Control, Склад,
// справочник, Продажи) и жил внутри combobox §19. Один компонент, два контекста:
//
//  - context="inline" (на странице): INK-рамка R6, h38 desktop / min-h44 mobile,
//    лупа 13; хоткей «/» фокусит поле (если фокус не в другом инпуте), kbd-хинт
//    «/» справа — ТОЛЬКО desktop (на таче клавиатуры нет → max-md:hidden); ✕ при
//    непустом запросе, Esc — очистить и снять фокус; опц. счётчик «N СОВПАДЕНИЙ»
//    mono справа. Фокус — BUTTER-ринг кита на КОРПУСЕ (focus-within, а не на инпуте:
//    ринг обнял бы только текст-зону), каретка SIGNAL.
//  - context="popup" (внутри combobox §19): тот же корпус БЕЗ рамки, нижний
//    дивайдер + focus-within-акцент границы (канон меню с поиском §18 — ринг рвал
//    бы кромки панели); без «/»/✕ (запросом рулит combobox), keyboard —
//    passthrough onKeyDown (пикер ↑/↓/↵).
//
// iOS-зум (R31.3): текст ≥16px на мобилке (max-md:text-base — иначе Safari зумит).
// Глобальный :focus-visible-ринг самого инпута заглушён в index.css
// ([data-slot=search-input]) — индикацию несёт корпус.

export interface SearchInputProps {
  /** committed-значение (для внешних сбросов — Reset из empty state обязан чистить) */
  value: string
  /** живой ввод; дебаунсится если debounce>0 */
  onChange: (query: string) => void
  placeholder?: string
  /** inline (страница, рамка) | popup (в combobox §19, без рамки) */
  context?: "inline" | "popup"
  /** «N СОВПАДЕНИЙ» mono 10 muted справа от поля (inline); опустить —
   *  счётчик живёт в mono-подвале списка (где подвал уже есть — там) */
  matchCount?: number
  /** «/»-хоткей фокуса + kbd-хинт; дефолт: inline — да, popup — нет */
  hotkey?: boolean
  /** дебаунс onChange (мс); 0/undefined — мгновенно */
  debounce?: number
  /** ✕ при непустом запросе; дефолт: inline — да, popup — нет */
  clearable?: boolean
  autoFocus?: boolean
  /** passthrough клавиш (пикер combobox ↑/↓/↵) */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  /** внешний ref инпута (combobox / фокус извне) */
  inputRef?: React.Ref<HTMLInputElement>
  className?: string
  "aria-label"?: string
  "data-testid"?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  context = "inline",
  matchCount,
  hotkey,
  debounce = 0,
  clearable,
  autoFocus,
  onKeyDown,
  inputRef,
  className,
  "aria-label": ariaLabel,
  "data-testid": testid,
}: SearchInputProps) {
  const inline = context === "inline"
  const withHotkey = hotkey ?? inline
  const withClear = clearable ?? inline

  const localRef = React.useRef<HTMLInputElement>(null)
  const setRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      localRef.current = el
      if (typeof inputRef === "function") inputRef(el)
      else if (inputRef) (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
    },
    [inputRef]
  )

  // display-текст живёт локально (мгновенно), наружу — уже готовое значение
  // (дебаунс для тяжёлых списков). Внешний сброс синкает при РАСХОЖДЕНИИ пропа
  // с локальным текстом (во время набора проп отстаёт, но не меняется — не клоббит).
  const [text, setText] = React.useState(value)
  const debounceRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    setText((t) => (value !== t ? value : t))
  }, [value])

  const emit = (q: string) => {
    if (debounce > 0) {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => onChange(q), debounce)
    } else {
      onChange(q)
    }
  }
  const cancelDebounce = () => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    debounceRef.current = null
  }
  React.useEffect(() => cancelDebounce, [])

  const clear = (refocus: boolean) => {
    cancelDebounce()
    setText("")
    onChange("")
    if (refocus) localRef.current?.focus()
    else localRef.current?.blur()
  }

  // «/»-хоткей — фокус поиска (канон ⌘K), если фокус не в поле ввода; kbd-хинт
  // клавиатурный, на таче не нужен (скрыт классом)
  React.useEffect(() => {
    if (!withHotkey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return
      e.preventDefault()
      localRef.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [withHotkey])

  const input = (
    <div
      className={cn(
        "flex items-center gap-2",
        inline
          ? "h-[38px] rounded-lg border border-border bg-card px-3 max-md:min-h-11 focus-within:shadow-[0_0_0_3px_var(--ring),0_0_0_4px_var(--foreground)]"
          : // popup: без рамки, нижний дивайдер + акцент границы при фокусе
            "relative border-b border-border px-3 focus-within:shadow-[0_1.5px_0_0_var(--foreground)]",
        // ширину / max-md:w-full задаёт потребитель классом — ВСЕГДА на корпусе
        // (даже со счётчиком-сиблингом, иначе поле теряет заданную ширину)
        className
      )}
    >
      <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
      <input
        data-slot="search-input"
        ref={setRef}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        data-testid={testid}
        onChange={(e) => {
          setText(e.target.value)
          emit(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && (withClear || withHotkey) && text) {
            e.preventDefault()
            e.stopPropagation()
            clear(false) // Esc — очистить и снять фокус
          }
          onKeyDown?.(e)
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent caret-destructive outline-none placeholder:text-[#A1A1AA]",
          inline ? "text-[13px] max-md:text-base" : "py-2.5 text-sm max-md:text-base"
        )}
      />
      {withClear && text ? (
        <button
          type="button"
          aria-label="Очистить поиск"
          onClick={() => clear(true)}
          className="-mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      ) : (
        withHotkey && (
          <Kbd className="pointer-events-none shrink-0 max-md:hidden">/</Kbd>
        )
      )}
    </div>
  )

  // счётчик «N СОВПАДЕНИЙ» — сиблинг справа от поля (реф §51); ширина живёт на
  // корпусе (className), обёртка только раскладывает поле + счётчик
  if (matchCount === undefined) return input
  return (
    <div className="inline-flex items-center gap-2.5">
      {input}
      <span
        data-testid={testid ? `${testid}-count` : undefined}
        className="shrink-0 font-mono text-[10px] tracking-[0.06em] whitespace-nowrap text-muted-foreground tabular-nums"
      >
        {matchCount} {pluralRu(matchCount, ["СОВПАДЕНИЕ", "СОВПАДЕНИЯ", "СОВПАДЕНИЙ"])}
      </span>
    </div>
  )
}
