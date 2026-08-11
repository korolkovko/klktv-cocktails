import * as React from "react"

import { cn } from "@/lib/utils"
import { LearnedToggle } from "@/components/kollektiv/learned-toggle"

// §45 MEDIA CARD — первая карточка с изображением в системе (справочник
// коктейлей, Pages 3n). Тамб — логотип позиции: ширина фиксирована (120 mobile
// / 132 desktop), высота АВТО по натуральной пропорции — логотип не кропаем
// (object-contain + h-auto + self-start, чтобы флекс-строка не тянула картинку).
// INK-рамка R6. Имя 14/700 + бейдж чипом (HOT=SIGNAL,
// BOTTLED/PREMIUM=INK, ONESIP=BUTTER); цена — ТИХОЙ mono-строкой, не чипом
// (в справочнике главное — состав). Тогл §44 в углу. Фото продукта, когда
// появятся, живут в детали, не hero карточки.
// Когда media card: у позиции есть визуальная айдентика. Нет айдентики —
// текстовая строка списка 52px (Крепкое/Кухня, Pages 3r), не пустой тамб.

export type MediaBadgeTone = "hot" | "ink" | "butter"

export interface MediaBadge {
  label: string
  tone: MediaBadgeTone
}

const BADGE_TONE: Record<MediaBadgeTone, string> = {
  hot: "bg-signal text-white",
  ink: "bg-primary text-primary-foreground",
  butter: "bg-butter text-foreground border border-border",
}

export interface MediaCardProps {
  /** URL логотипа позиции (ширина фиксирована, высота — по натуральной пропорции) */
  image: string
  imageAlt?: string
  name: string
  badge?: MediaBadge
  /** подзаголовок-описание (11.5px muted) */
  subtitle?: React.ReactNode
  /** тихая mono-строка: «650 ₽ · 240 МЛ · 12%» */
  meta?: React.ReactNode
  /** дескрипторы: «ДЖИН · ЦИТРУС · ИМБИРЬ» (mono, ещё тише) */
  descriptors?: string
  learned?: boolean
  onLearnedChange?: (learned: boolean) => void
  onClick?: () => void
  className?: string
}

export function MediaCard({
  image,
  imageAlt,
  name,
  badge,
  subtitle,
  meta,
  descriptors,
  learned = false,
  onLearnedChange,
  onClick,
  className,
}: MediaCardProps) {
  return (
    <div
      data-slot="media-card"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        "flex gap-2.5 rounded-[10px] border border-border bg-card p-2.5",
        onClick && "cursor-pointer transition-shadow hover:shadow-[3px_3px_0_rgba(10,10,10,0.2)]",
        className
      )}
    >
      <img
        src={image}
        alt={imageAlt ?? name}
        loading="lazy"
        className="h-auto w-[120px] shrink-0 self-start rounded-md border border-border object-contain md:w-[132px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm leading-[1.15] font-bold">
            {name}
            {badge && (
              <span
                className={cn(
                  "ml-1.5 inline-block rounded-[4px] px-1.5 py-px align-[2px] font-mono text-[9px] font-bold",
                  BADGE_TONE[badge.tone]
                )}
              >
                {badge.label}
              </span>
            )}
          </span>
          {onLearnedChange && (
            <LearnedToggle learned={learned} onChange={onLearnedChange} label={name} />
          )}
        </div>
        {subtitle && (
          <span className="text-[11.5px] leading-[1.3] text-[#71717A]">{subtitle}</span>
        )}
        {(meta || descriptors) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {meta && <span className="font-mono text-[9.5px] text-[#71717A]">{meta}</span>}
            {descriptors && (
              <span className="font-mono text-[9px] text-[#A1A1AA]">{descriptors}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
