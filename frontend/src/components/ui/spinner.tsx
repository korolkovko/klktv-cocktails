import { cn } from "@/lib/utils"

// Кит: спиннер — кольцо (CONCRETE-трек, INK-дуга сверху), вращение 700ms linear.
// Для size-5 и больше — border-[2.5px].
function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-k-spin rounded-full border-2 border-muted border-t-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
