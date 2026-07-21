import { cn } from "@/lib/utils"

// Кит §13/§18: скелетон — диагональная CONCRETE-штриховка + пульс 1400ms,
// без shimmer-переливов
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-k-pulse rounded-md",
        "bg-[repeating-linear-gradient(-45deg,#EDEDE8_0_6px,#F6F6F1_6px_12px)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
