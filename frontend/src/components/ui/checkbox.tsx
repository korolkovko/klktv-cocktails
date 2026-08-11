import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

// Kollektiv (кит §10): 18px, рамка 1.5px INK, radius 5; checked/indeterminate —
// INK-заливка (галка / минус-полоска 9×2.5); disabled — dashed A1A1AA + фон F4F4F0.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox peer relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-input bg-white transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:border-dashed disabled:border-[#A1A1AA] disabled:bg-[#F4F4F0] disabled:opacity-45 aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon
          strokeWidth={2.4}
          className="size-3 group-data-[state=indeterminate]/checkbox:hidden"
        />
        <span className="hidden h-[2.5px] w-[9px] rounded-[2px] bg-current group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
