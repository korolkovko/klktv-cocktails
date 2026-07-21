import type * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
} from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { useIsMobile } from "@/lib/use-media-query"

// Kollektiv: тост — INK-заливка, белый текст; критичный — SIGNAL + shadow-hard.
// Light-only (v2), next-themes не используем.
// Mobile (<768px, MOBILE.md §2): тосты сверху под шапкой (swipe-to-dismiss
// у sonner из коробки); низ остаётся за undo/sticky CTA. Явный position
// в пропсах побеждает.
const Toaster = ({ position, ...props }: ToasterProps) => {
  const isMobile = useIsMobile()
  return (
    <Sonner
      theme="light"
      position={position ?? (isMobile ? "top-center" : "bottom-right")}
      offset={isMobile ? { top: 64 } : undefined}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Spinner className="size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--primary-foreground)",
          "--normal-border": "var(--foreground)",
          "--border-radius": "var(--radius-card)",
          "--font-family": "var(--font-sans)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !shadow-overlay",
          error:
            "!bg-destructive !text-destructive-foreground !border-border !shadow-hard",
          description: "!text-[#A1A1AA]",
          actionButton:
            "!bg-card !text-foreground !rounded-[5px] !font-mono !text-[11px] !font-semibold",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
