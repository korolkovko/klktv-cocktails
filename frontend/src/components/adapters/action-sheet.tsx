import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

// Канон MOBILE.md §2: context menu (правый клик) на мобилке = long-press →
// action sheet. Кнопки-строки 48px, destructive — SIGNAL-outline,
// Cancel — ghost-ссылка. Открытие — хук useLongPress (@/lib/use-long-press).

export interface ActionSheetAction {
  label: string
  icon?: React.ReactNode
  destructive?: boolean
  disabled?: boolean
  onSelect?: () => void
}

export interface ActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Контекст — что за объект (напр. «Pravda Bar · JUL 14») */
  title?: React.ReactNode
  actions: ActionSheetAction[]
  cancelLabel?: string
}

function ActionSheet({
  open,
  onOpenChange,
  title,
  actions,
  cancelLabel = "CANCEL",
}: ActionSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {title && (
          <DrawerHeader className="pb-3">
            <DrawerTitle className="text-[15px]">{title}</DrawerTitle>
          </DrawerHeader>
        )}
        <div className="flex flex-col gap-2 px-4 pb-2">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                onOpenChange(false)
                a.onSelect?.()
              }}
              className={cn(
                "btn-push flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:border-[#E4E4DF] disabled:bg-muted disabled:text-[#A1A1AA] disabled:shadow-none",
                a.destructive
                  ? "border-[1.5px] border-signal bg-card text-signal shadow-[2px_2px_0_rgb(224_16_0/0.9)]"
                  : "border-border bg-secondary text-secondary-foreground shadow-hard"
              )}
            >
              {a.icon && <span className="[&_svg]:size-4">{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>
        <DrawerClose asChild>
          <button
            type="button"
            className="mx-auto mt-1 mb-3 min-h-11 cursor-pointer px-4 font-mono text-[11px] font-semibold tracking-[0.06em] text-[#52525B] underline underline-offset-3"
          >
            {cancelLabel}
          </button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  )
}

export { ActionSheet }
