import { Skeleton } from "@/components/ui/skeleton"

// Загрузочный скелетон справочника (§13/§18 kit-Skeleton) — показывается
// вместо белого экрана, пока резолвится auth-проба (AuthGate) и грузится
// /api/content (ContentProvider). Форма повторяет каркас гайда: шапка
// (лого + табы + юзер) и тело (заголовок/поиск, ряд фильтр-чипов, сетка
// медиа-карточек grid-cols-3 max-lg:2 max-md:1 — как в MenuView), чтобы
// подмена скелетон→контент не дёргала раскладку.
export function GuideSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-background" aria-busy="true" aria-label="Загрузка">
      {/* шапка */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5 max-md:px-4 max-md:py-3 max-md:pt-[calc(12px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-6">
          <Skeleton className="h-8 w-[140px] max-md:h-7 max-md:w-[116px]" />
          <div className="flex gap-1.5 max-md:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-[76px]" />
            ))}
          </div>
        </div>
        <Skeleton className="size-8 shrink-0" />
      </div>

      {/* тело */}
      <div className="flex flex-col gap-4 p-6 pb-24 max-md:gap-3 max-md:px-4 max-md:py-4">
        {/* заголовок + поиск */}
        <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Skeleton className="h-6 w-44 max-md:hidden" />
          <Skeleton className="h-[38px] w-[220px] max-md:w-full" />
        </div>
        {/* ряд фильтр-чипов */}
        <div className="flex gap-2">
          <Skeleton className="h-[38px] w-24" />
          <Skeleton className="h-[38px] w-24" />
          <Skeleton className="h-[38px] w-20" />
        </div>
        {/* сетка карточек — те же колонки, что в MenuView */}
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <Skeleton className="aspect-[2.3/1] w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
