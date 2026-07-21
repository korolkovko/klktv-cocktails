import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Kollektiv: INK-рамки, сдвиговые тени, btn-push у вариантов с весом.
  // Focus-ring — глобальный :focus-visible (BUTTER + INK). Mobile: тач ≥44px.
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border font-sans font-semibold whitespace-nowrap transition-colors outline-none select-none max-md:min-h-11 disabled:pointer-events-none disabled:border-[#E4E4DF] disabled:bg-muted disabled:text-[#A1A1AA] disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "btn-push border-border bg-primary text-primary-foreground shadow-soft",
        secondary:
          "btn-push border-border bg-secondary text-secondary-foreground shadow-hard",
        outline:
          "btn-push border-border bg-secondary text-secondary-foreground shadow-hard aria-expanded:bg-accent",
        // quiet (R32 §09): утилитарный вес — белая + INK-рамка, БЕЗ тени и БЕЗ
        // btn-push-сдвига. Ховер CONCRETE, active #E4E4DF. Правило веса: тень =
        // у действия, которое КОММИТИТ (submit/CTA/destructive confirm); навигация
        // и утилиты (back ←, ✕, «Отмена», повторяющиеся контролы) — quiet.
        quiet:
          "border-border bg-secondary text-secondary-foreground hover:bg-muted active:bg-[#E4E4DF]",
        tertiary:
          "border-divider-strong bg-muted text-foreground hover:bg-[#E4E4DF]",
        ghost:
          "border-transparent text-[#52525B] underline underline-offset-[3px] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "btn-push border-border bg-destructive text-destructive-foreground shadow-hard",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-(--control-h) gap-1.5 px-[18px] text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 px-2 font-mono text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-[13px] text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-sm",
        icon: "size-(--control-h)",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
