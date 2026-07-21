import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/use-media-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

// Адаптер MOBILE.md §3: desktop — стоковый Select (меню у поля, канон §18),
// mobile (<768px) — bottom sheet со строками-опциями 48px; выбранная —
// INK + ✓ (тот же канон отмеченного пункта). API — опциями, как combobox.

export interface ResponsiveSelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface ResponsiveSelectProps {
  options: ResponsiveSelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** Заголовок листа на мобилке; дефолт — placeholder */
  label?: string
  disabled?: boolean
  /** Свой триггер вместо стокового «как input» — для чип-контролов
   *  (сорт-чип SORT: … ▼, канон R22). Работает в mobile-ветке (лист);
   *  desktop-ветка стокового Select его игнорирует — контролы-чипы
   *  на десктопе живут другими паттернами (шапки таблиц и т.п.) */
  trigger?: React.ReactElement
  /** Не передан — включается сам при <768px; проп — оверрайд для витрины */
  mobile?: boolean
  className?: string
}

function ResponsiveSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  label,
  disabled,
  trigger,
  mobile: mobileProp,
  className,
}: ResponsiveSelectProps) {
  const autoMobile = useIsMobile()
  const mobile = mobileProp ?? autoMobile
  const [open, setOpen] = React.useState(false)
  const current = options.find((o) => o.value === value)

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {trigger ?? (
            <button
              type="button"
              disabled={disabled}
              data-slot="responsive-select-trigger"
              className={cn(
                // зеркалит стоковый select-тригер (канон: select выглядит как input)
                "flex h-(--control-h) w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-card py-2 pr-2.5 pl-3 text-sm whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:border-[#E4E4DF] disabled:bg-muted disabled:text-[#A1A1AA]",
                !current && "text-muted-foreground",
                className
              )}
            >
              <span className="line-clamp-1 text-left">{current?.label ?? placeholder}</span>
              <ChevronDownIcon className="size-4 shrink-0 text-foreground" />
            </button>
          )}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label ?? placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-3 pb-3">
            {options.map((o) => {
              const selected = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    onValueChange?.(o.value)
                    setOpen(false)
                  }}
                  className={cn(
                    // строка-опция ≥48px; выбранная — INK + ✓ (канон §18)
                    "flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:text-[#A1A1AA]",
                    selected ? "bg-primary text-primary-foreground" : "active:bg-muted"
                  )}
                >
                  <span>{o.label}</span>
                  {selected && <CheckIcon className="size-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { ResponsiveSelect }
