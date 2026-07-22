import * as React from "react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

// Адаптер MOBILE.md §3: одна точка входа для модалки — desktop получает
// Dialog (центр, R16, D3-тень), mobile (<768px) — bottom sheet (vaul).
// Продукты НЕ собирают этот свитч сами.

export interface ResponsiveDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Тригер (asChild) — можно не передавать при управляемом open */
  trigger?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Кнопки действий; на мобилке — столбиком в thumb zone */
  footer?: React.ReactNode
  children?: React.ReactNode
  /** Классы контента: desktop — ширина модалки (перебивает стоковый cap
   *  sm:max-w-lg через twMerge, ловушка R13/R23); mobile — DrawerContent */
  contentClassName?: string
  /** Не передан — включается сам при <768px; проп — оверрайд для витрины */
  mobile?: boolean
}

function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  children,
  contentClassName,
  mobile: mobileProp,
}: ResponsiveDialogProps) {
  const autoMobile = useIsMobile()
  const mobile = mobileProp ?? autoMobile

  // Tall forms (напр. редактор коктейля ~25 полей) должны СКРОЛЛИТЬСЯ внутри
  // листа, а не вылезать за края: контейнер лимитирован по высоте (flex-col +
  // max-h-[85dvh]), шапка и футер — shrink-0, тело — min-h-0 + overflow-y-auto
  // (единственный скролл-регион). min-h-0 обязателен: без него flex-элемент не
  // сжимается ниже своего контента и переполняет capped-контейнер (баг «контент
  // за краями, скролла нет»). DialogContent стоково — grid без max-h; тут
  // перебиваем на flex-col + max-h (twMerge меняет display-группу).
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
        <DrawerContent className={contentClassName}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          {children && <div className="min-h-0 overflow-y-auto px-4 py-2">{children}</div>}
          {footer && <DrawerFooter className="shrink-0">{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn("flex max-h-[85dvh] flex-col", contentClassName)}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="-mx-4 min-h-0 overflow-y-auto px-4">{children}</div>}
        {footer && <DialogFooter className="shrink-0">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

export { ResponsiveDialog }
