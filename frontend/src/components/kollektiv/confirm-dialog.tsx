import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * §50 CONFIRM (R33) — подтверждение деструктивного действия.
 *
 * Канон: confirm — ВСЕГДА центр-модалка (400px), НИКОГДА шит: деструктив нельзя
 * закрыть случайным свайпом. Шкала модалок кита: CONFIRM 400 · FORM 620 · DETAIL
 * 840. Оверлей INK 40% (тяжелее обычных 20% — деструктив требует внимания).
 *
 * Футер против «съехавших» кнопок: desktop — flex justify-end gap-10, кнопка
 * НИКОГДА не шире модалки (длинный лейбл сокращай ТЕКСТОМ — «Отменить · 8 позиций»,
 * не растягивай кнопку; при нехватке — flex-wrap, primary справа). Mobile —
 * column-reverse, обе full-width, primary (деструктив) сверху.
 *
 * Копирайт: title — вопрос с глаголом; description — что потеряется, конкретным
 * числом; кнопки — глаголы, без «Да/Нет/ОК». Деструктив = kit destructive
 * (коммитит — тень); отказ = quiet. Esc/оверлей = отказ; фокус при открытии — на
 * quiet-кнопке (не на деструктиве).
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Отмена",
  onConfirm,
  /** деструктив (SIGNAL) — дефолт для confirm; false → обычный primary */
  destructive = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel: React.ReactNode
  cancelLabel?: React.ReactNode
  onConfirm: () => void
  destructive?: boolean
}) {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* оверлей INK 40% (не стоковые 20%) */}
        <DialogPrimitive.Overlay
          data-slot="confirm-overlay"
          className="fixed inset-0 z-50 bg-black/40 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          data-slot="confirm-dialog"
          // фокус при открытии — на quiet-кнопке отказа, не на деструктиве
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
          className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-popover p-5 text-sm text-popover-foreground shadow-overlay duration-(--duration-base) outline-none data-open:animate-k-enter data-closed:animate-out data-closed:fade-out-0 data-closed:duration-[120ms] data-closed:ease-in sm:max-w-[400px]"
        >
          <div className="flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="text-[18px] leading-[1.25] font-bold">
              {title}
            </DialogPrimitive.Title>
            {/* ✕ — только desktop (на мобилке два full-width-кнопки + Esc/оверлей) */}
            <DialogPrimitive.Close asChild>
              <Button
                variant="quiet"
                size="icon-sm"
                aria-label="Закрыть"
                className="-mt-1 -mr-1 shrink-0 max-md:hidden"
              >
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {description && (
            <DialogPrimitive.Description className="text-[14px] leading-[1.5] text-[#52525B]">
              {description}
            </DialogPrimitive.Description>
          )}

          {/* футер: mobile column-reverse full-width (primary сверху) /
              desktop justify-end gap-10, flex-wrap если лейблы длинные */}
          <div className="flex flex-col-reverse gap-2.5 md:flex-row md:flex-wrap md:justify-end">
            <Button
              ref={cancelRef}
              variant="quiet"
              onClick={() => onOpenChange(false)}
              className="max-md:w-full"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={() => {
                onOpenChange(false)
                onConfirm()
              }}
              className="max-md:w-full"
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { ConfirmDialog }
