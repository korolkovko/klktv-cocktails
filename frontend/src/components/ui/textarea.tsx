import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Kollektiv: как input — INK-рамка, белый фон; focus — глобальный BUTTER-ring
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:border-[#E4E4DF] disabled:bg-muted disabled:text-[#A1A1AA] aria-invalid:animate-k-shake aria-invalid:border-[1.5px] aria-invalid:border-destructive aria-invalid:bg-[#FFF5F4] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
