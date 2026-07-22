import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Kollektiv (кит §10): 36×20; on — INK-трек, off — CONCRETE + рамка D4D4CE,
// thumb 15px белый (off — с рамкой); disabled — dashed A1A1AA + фон F4F4F0.
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:border-primary data-checked:bg-primary data-unchecked:border-divider-strong data-unchecked:bg-muted data-disabled:cursor-not-allowed data-disabled:border-dashed data-disabled:border-[#A1A1AA] data-disabled:bg-[#F4F4F0] data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white transition-transform group-data-[size=default]/switch:size-[15px] group-data-[size=sm]/switch:size-[10px] group-data-[size=default]/switch:data-checked:translate-x-[17px] group-data-[size=default]/switch:data-unchecked:translate-x-[2px] group-data-[size=sm]/switch:data-checked:translate-x-[10.5px] group-data-[size=sm]/switch:data-unchecked:translate-x-[1.5px] group-data-unchecked/switch:border group-data-unchecked/switch:border-divider-strong group-data-disabled/switch:border-0 group-data-disabled/switch:bg-muted"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
