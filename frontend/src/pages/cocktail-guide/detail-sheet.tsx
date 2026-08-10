import * as React from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { LearnedToggle } from "@/components/kollektiv/learned-toggle"
import { TintMarker } from "@/components/kollektiv/tint-marker"
import { useIsMobile } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"

import { type Classic, type Cocktail, type Dish, type DishNutrition, type Spirit } from "./data"
import { useContent } from "@/data/ContentContext"

// 3p Деталь позиции v2 (R25) — РЕЖИМ ФЛЕШ-КАРТОЧЕК (главная механика обучения).
// Desktop: центр-модалка погружения 840px (§30 INK-рамка + сдвиг-тень 4px,
// фон-дим) — 2 колонки (карточка бармена 280 / учебный текст) + подвал-листалка.
// Mobile: bottom sheet со sticky-шапкой + sticky бар-листалкой в thumb zone;
// свайп ←/→ по шиту листает. Колода = ТЕКУЩИЙ отфильтрованный список раздела.
// Клавиатура (desktop): ←/→ листают, L — learned-тогл без закрытия, Esc — закрыть.
// Правый Sheet 500px остаётся каноном для админ-данных (Cost Control R23) —
// в СПРАВОЧНИКЕ заменяется модалкой/шитом: узкий Sheet не работает для обучения.

const Meta = ({ price, volume, abv, isAlcoholic }: { price?: number; volume?: number; abv?: number; isAlcoholic: boolean }) => {
  // Авторские в проде без цены/объёма — показываем только то, что есть. ABV:
  // безалко → «0%»; алко с записанным ABV → «NN% ABV»; алко без ABV (напр.
  // Undressed Negroni) → чип НЕ показываем (не врём «0% ABV»). Иначе выходило
  // «0 ₽ · 0 МЛ» / «0% ABV».
  const parts: string[] = []
  if (price != null) parts.push(`${price} ₽`)
  if (volume != null) parts.push(`${volume} МЛ`)
  if (!isAlcoholic) parts.push("0%")
  else if (abv != null) parts.push(`${abv}% ABV`)
  if (parts.length === 0) return null
  return (
    <span className="font-mono text-[11px] font-bold whitespace-nowrap md:text-[12px]">{parts.join(" · ")}</span>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-[#A1A1AA]">{children}</span>
)

/** Опциональная текст-секция: рендерится только если поле заполнено */
const Section = ({ title, children, desktop }: { title: string; children?: React.ReactNode; desktop?: boolean }) =>
  children ? (
    <div className="flex flex-col gap-1">
      <Label>{title}</Label>
      {/* whitespace-pre-line: сохраняем переносы строк из прод-прозы (часть
          drink_details/рецептов многострочные) — иначе схлопывалось в run-on */}
      <span className={cn("leading-[1.55] whitespace-pre-line", desktop ? "text-[14px] leading-[1.6]" : "text-[13px]")}>{children}</span>
    </div>
  ) : null

const FlavorChip = ({ children, strong }: { children: React.ReactNode; strong?: boolean }) => (
  <span
    className={cn(
      "rounded-[4px] border px-[7px] py-0.5 font-mono text-[9.5px]",
      strong ? "border-border font-semibold text-foreground" : "border-[#D4D4CE] text-[#52525B]"
    )}
  >
    {children}
  </span>
)

/** ВКУС-чипы: спирты (strong) из поля spirits, вкусы (muted) — descriptors
 *  без дубля спиртов; не завязано на порядок массива (ревью R24) */
function FlavorChips({ spirits, descriptors }: { spirits: string[]; descriptors: string[] }) {
  const strong = spirits.map((s) => s.toUpperCase())
  const flavors = descriptors.filter((d) => !strong.includes(d.toUpperCase()))
  return (
    <div className="flex flex-wrap gap-1.5">
      {strong.map((s) => (
        <FlavorChip key={s} strong>
          {s}
        </FlavorChip>
      ))}
      {flavors.map((f) => (
        <FlavorChip key={f}>{f}</FlavorChip>
      ))}
    </div>
  )
}

const GlassGarnish = ({ glass, garnish, ice }: { glass?: string; garnish?: string; ice?: string }) =>
  garnish || ice ? (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <Label>БОКАЛ</Label>
        <span className="text-[13px]">{glass}</span>
      </div>
      {garnish && (
        <div className="flex flex-col gap-1">
          <Label>ГАРНИШ</Label>
          <span className="text-[13px]">{garnish}</span>
        </div>
      )}
      {/* Task A7: тип льда — только когда задан (словарь ice-types) */}
      {ice && (
        <div className="flex flex-col gap-1">
          <Label>ЛЁД</Label>
          <span className="text-[13px]">{ice}</span>
        </div>
      )}
    </div>
  ) : null

/** Кофеин-метр (3 точки, закрашены до caffeineLevel) + индикатор газации —
 *  §E.5, парность старому ZC-детейлу (frontend_v1_reference/src/components/
 *  ZCSheet.jsx: CaffeineBar + `.zc-carbo`). Каждое поле — своя опциональная
 *  секция (рендерится только если заполнено); алкогольный коктейль (оба поля
 *  null) не показывает ничего. */
const NonAlcIndicators = ({ caffeineLevel, isCarbonated }: { caffeineLevel: number | null; isCarbonated: boolean | null }) =>
  caffeineLevel != null || isCarbonated != null ? (
    <div className="grid grid-cols-2 gap-3">
      {caffeineLevel != null && (
        <div className="flex flex-col gap-1">
          <Label>КОФЕИН</Label>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cn("h-2.5 w-2.5 rounded-full border border-border", n <= caffeineLevel ? "bg-foreground" : "bg-transparent")}
                />
              ))}
            </div>
            <span className="font-mono text-[11px] text-[#71717A]">{caffeineLevel}/3</span>
          </div>
        </div>
      )}
      {isCarbonated != null && (
        <div className="flex flex-col gap-1">
          <Label>ГАЗАЦИЯ</Label>
          <span className="text-[13px]">{isCarbonated ? "◉ Газированный" : "◯ Без газа"}</span>
        </div>
      )}
    </div>
  ) : null

/** Фото напитка/блюда 4:3 R16 INK-рамка — только если задано (нет фото → нет
 *  блока, без пустых плейсхолдеров юзеру, R25). Блюдо продолжает использовать
 *  эту (единичную, object-cover) рамку — галерея (PhotoGallery ниже) заменила
 *  её только у коктейля, для которого бэкенд отдаёт массив photos. */
const Photo = ({ src, alt }: { src?: string; alt: string }) =>
  src ? (
    <img src={src} alt={alt} className="aspect-[4/3] w-full rounded-2xl border border-border object-cover" />
  ) : null

/** Task C4: галерея фото коктейля — горизонтальный snap-scroll трек +
 *  точки-индикаторы под ним; один слайд → без точек и без скролл-аффорданса
 *  (просто статичный кадр). Кадр ПОРТРЕТНЫЙ 3:4 + object-contain на
 *  нейтральном фоне (в отличие от Photo/BottlePhoto выше: намеренно НЕ
 *  4:3/object-cover) — так безопасно для любой ориентации кадра: вертикали
 *  заполняют рамку, редкие горизонтали леттербоксятся по центру, ничего не
 *  кропается. ТОЧНЫЙ аспект (3:4) — рабочее значение по умолчанию, не
 *  финальное: владелец сверит его на реальных фото и донастроит отдельным
 *  коммитом (см. C4 brief, Step 3). Нет фото → блока нет, без плейсхолдера
 *  (R25). Без новых npm-зависимостей — чистый CSS scroll-snap +
 *  onScroll-хендлер для активной точки. */
function PhotoGallery({ photos, alt }: { photos?: string[]; alt: string }) {
  const list = photos ?? []
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const [active, setActive] = React.useState(0)

  const onScroll = () => {
    const el = trackRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    setActive(Math.min(list.length - 1, Math.max(0, i)))
  }

  if (list.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        onScroll={list.length > 1 ? onScroll : undefined}
        className={cn(
          "flex w-full snap-x snap-mandatory overflow-y-hidden rounded-2xl border border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          list.length > 1 ? "overflow-x-auto" : "overflow-x-hidden"
        )}
      >
        {list.map((src, i) => (
          <div key={`${src}-${i}`} className="aspect-[3/4] w-full shrink-0 snap-center bg-[#EDEDE8]">
            <img
              src={src}
              alt={list.length > 1 ? `${alt} — фото ${i + 1} из ${list.length}` : alt}
              className="h-full w-full object-contain"
            />
          </div>
        ))}
      </div>
      {list.length > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Фото коктейля">
          {list.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 rounded-full transition-colors", i === active ? "bg-foreground" : "bg-[#D4D4CE]")}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Фото бутылки спирита — fit contain (вертикальная, не кропать); нет — нет блока */
const BottlePhoto = ({ src, alt, h }: { src?: string; alt: string; h: number }) =>
  src ? (
    <div style={{ height: h }} className="w-full">
      <img src={src} alt={alt} className="h-full w-full rounded-[10px] border border-border object-contain" />
    </div>
  ) : null

/** ФАКТ — butter-плашка в языке TIP (спирит/блюдо) */
const FactPlate = ({ children, desktop }: { children?: React.ReactNode; desktop?: boolean }) =>
  children ? (
    <div className="flex items-start gap-2 rounded-md border border-border bg-butter px-2.5 py-[7px]">
      <span className="shrink-0 pt-0.5 font-mono text-[8.5px] font-bold tracking-[0.08em]">ФАКТ</span>
      <span className={cn("leading-[1.45]", desktop ? "text-[13px] leading-[1.5]" : "text-[12px]")}>{children}</span>
    </div>
  ) : null

/** ИСТОЧНИК — mono-ссылка ↗. sourceUrl в проде хранится С протоколом
 *  (https://…, см. parse_spirit_origin) — href берём как есть; префикс
 *  `https://` дописываем только если протокола нет (иначе выходил битый
 *  двойной `https://https://…`). В подписи протокол+www отрезаем и даём
 *  перенос (break-all + max-w-full), чтобы длинный путь не вылезал за край
 *  узкой колонки-карточки. */
const SourceLink = ({ url }: { url?: string }) => {
  if (!url) return null
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const label = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "")
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="w-fit max-w-full font-mono text-[10px] tracking-[0.02em] break-all text-[#52525B] uppercase underline underline-offset-[3px]"
    >
      {label} ↗
    </a>
  )
}

/** КБЖУ мини-гридом §40: белые ячейки на #EDEDE8 gap-px; desktop 2×2 / mobile 4×1 */
function NutritionGrid({ n, columns, caption }: { n: DishNutrition; columns: 2 | 4; caption?: string }) {
  const cells: [string, number][] = [
    ["ККАЛ", n.kcal],
    ["БЕЛКИ", n.protein],
    ["ЖИРЫ", n.fat],
    ["УГЛЕВОДЫ", n.carb],
  ]
  return (
    <div className="flex flex-col gap-1">
      <Label>ПИЩЕВАЯ ЦЕННОСТЬ{caption ? ` · ${caption}` : ""}</Label>
      <div className={cn("grid gap-px overflow-hidden rounded-lg border border-[#EDEDE8] bg-[#EDEDE8]", columns === 2 ? "grid-cols-2" : "grid-cols-4")}>
        {cells.map(([label, v]) => (
          <div key={label} className="bg-card px-2.5 py-2">
            <div className="font-mono text-[8.5px] text-[#A1A1AA]">{label}</div>
            <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      {/* «на 100 г» из старого шита — вторичная строка под гридом «на порцию» */}
      {n.kcal100 != null && (
        <span className="font-mono text-[9px] text-[#A1A1AA]">≈ {n.kcal100} ККАЛ / 100 Г</span>
      )}
    </div>
  )
}

/* ---------- листалка колоды ---------- */

export interface DeckNav {
  index: number
  of: number
  prevLabel?: string
  nextLabel?: string
  onPrev: () => void
  onNext: () => void
  /** R26.1 сквозная колода: счётчик показывает текущую группу «ДЖИН · 2 OF 6»
   *  (позиция ВНУТРИ группы / размер группы). Нет — плоский «N OF M». Стрелки
   *  дизейблятся только на абсолютных краях колоды (index 0 / of−1), границы
   *  групп перескакиваются. */
  group?: { label: string; index: number; of: number }
}

/** «ДЖИН · 2 OF 6» или плоский «5 OF 23» */
function counterText(nav: DeckNav) {
  return nav.group
    ? `${nav.group.label} · ${nav.group.index} OF ${nav.group.of}`
    : `${nav.index + 1} OF ${nav.of}`
}

/** Mobile sticky бар в thumb zone: ← 48 / learned-CTA / → 48 + счётчик */
function MobileDeckBar({ nav, learned, onLearnedChange }: { nav: DeckNav; learned: boolean; onLearnedChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border bg-card px-[18px] pt-2.5 pb-3.5">
      <div className="flex gap-2">
        <ArrowBtn dir="prev" onClick={nav.onPrev} disabled={nav.index === 0} />
        <LearnedToggle variant="cta" learned={learned} onChange={onLearnedChange} className="flex-1" />
        <ArrowBtn dir="next" onClick={nav.onNext} disabled={nav.index >= nav.of - 1} />
      </div>
      <span className="text-center font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">
        {counterText(nav)} · СВАЙП ПО ШИТУ ТОЖЕ ЛИСТАЕТ · БАР ЗАКРЕПЛЁН
      </span>
    </div>
  )
}

/** Desktop подвал-листалка: ← имя · counter · имя → (learned-CTA — в колонке) */
function DesktopDeckBar({ nav }: { nav: DeckNav }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-[#FBFBF9] px-[22px] py-2.5">
      <button
        type="button"
        onClick={nav.onPrev}
        disabled={nav.index === 0}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 text-[13px] font-semibold disabled:cursor-default disabled:opacity-30"
      >
        ← {nav.prevLabel ?? ""}
      </button>
      <span className="font-mono text-[10px] tracking-[0.06em] text-[#A1A1AA]">
        {/* R27 §3: у групповой колоды — «СКВОЗЬ ГРУППЫ» (единственное место, где
            юзер узнаёт, что стрелки не встанут на границе группы); плоская —
            обычные «ЛИСТАЮТ» */}
        {nav.group
          ? `${counterText(nav)} · ←/→ СКВОЗЬ ГРУППЫ`
          : `POSITION ${counterText(nav)} · ←/→ ЛИСТАЮТ`}{" "}
        · L — ТОГЛ «ЗНАЮ»
      </span>
      <button
        type="button"
        onClick={nav.onNext}
        disabled={nav.index >= nav.of - 1}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 text-[13px] font-semibold disabled:cursor-default disabled:opacity-30"
      >
        {nav.nextLabel ?? ""} →
      </button>
    </div>
  )
}

function ArrowBtn({ dir, onClick, disabled }: { dir: "prev" | "next"; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Предыдущая" : "Следующая"}
      onClick={onClick}
      disabled={disabled}
      className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-border bg-card text-[15px] font-bold disabled:cursor-default disabled:opacity-30"
    >
      {dir === "prev" ? "←" : "→"}
    </button>
  )
}

const CloseBtn = ({ onClick, size = 32 }: { onClick: () => void; size?: number }) => (
  <button
    type="button"
    aria-label="Закрыть"
    onClick={onClick}
    style={{ width: size, height: size }}
    className="flex shrink-0 cursor-pointer items-center justify-center self-start rounded-md border border-border bg-card text-[13px] font-bold"
  >
    ✕
  </button>
)

/* ---------- клавиатура + свайп ---------- */

function useDeckKeys(open: boolean, nav: DeckNav, onToggleLearned: () => void) {
  // latest-ref: nav/onToggle пересоздаются каждый рендер — держим свежими без
  // переподписки keydown (ревью R25 P2)
  const latest = React.useRef({ nav, onToggleLearned })
  latest.current = { nav, onToggleLearned }
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const { nav, onToggleLearned } = latest.current
      if (e.key === "ArrowLeft") { e.preventDefault(); nav.onPrev() }
      else if (e.key === "ArrowRight") { e.preventDefault(); nav.onNext() }
      else if (e.key === "l" || e.key === "L" || e.key === "д" || e.key === "Д") { e.preventDefault(); onToggleLearned() }
      // Esc закрывает через сам Dialog
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
}

/** горизонтальный свайп по шиту → ←/→ (вертикаль отдаём vaul на закрытие) */
function useSwipe(nav: DeckNav) {
  const start = React.useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) nav.onPrev()
        else nav.onNext()
      }
    },
  }
}

/* ---------- Коктейль ---------- */

export interface CocktailDetailProps {
  cocktail: Cocktail | null
  open: boolean
  onOpenChange: (v: boolean) => void
  learned: boolean
  onLearnedChange: (v: boolean) => void
  nav: DeckNav
}

export function CocktailDetail({ cocktail, open, onOpenChange, learned, onLearnedChange, nav }: CocktailDetailProps) {
  if (!cocktail) return null
  const c = cocktail
  const spirits = c.spirits ?? [c.spirit]
  // Task A7: бэкенд смигрировал старый badge==="HOT" в isHot — badge теперь
  // null для этих напитков, красный HOT-чип гейтится isHot.
  const hotBadge = c.isHot

  // mobile sticky-шапка: лого + имя + ✕
  const mobileHeader = (
    <>
      <div className="flex items-center gap-3">
        <img src={c.logo} alt={c.name} className="h-[60px] w-[140px] shrink-0 rounded-lg border border-border object-cover" />
        <span className="flex min-w-0 flex-1 items-center text-[20px] leading-[1.15] font-bold">{c.name}</span>
        <CloseBtn onClick={() => onOpenChange(false)} />
      </div>
    </>
  )

  // mobile тело: тэглайн полной шириной → мета+бейдж → [фото] → вкус-чипы →
  // дивайдер → условные секции
  const mobileBody = (
    <>
      <span className="text-[12.5px] leading-[1.4] text-[#71717A]">{c.subtitle}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Meta price={c.price} volume={c.volume} abv={c.abv} isAlcoholic={c.isAlcoholic} />
        {hotBadge && <span className="rounded-[4px] bg-signal px-1.5 py-px font-mono text-[9px] font-bold text-white">HOT</span>}
      </div>
      <PhotoGallery photos={c.photos} alt={c.name} />
      <FlavorChips spirits={spirits} descriptors={c.descriptors} />
      <NonAlcIndicators caffeineLevel={c.caffeineLevel} isCarbonated={c.isCarbonated} />
      <div className="border-t border-divider" />
      <Section title="СОСТАВ">{c.recipe}</Section>
      <GlassGarnish glass={c.glass} garnish={c.garnish} ice={c.ice} />
      <Section title="КАК ПРОДАВАТЬ">{c.pitch}</Section>
      <Section title="О КОКТЕЙЛЕ">{c.about}</Section>
      <Section title="ПРО НАЗВАНИЕ">{c.naming}</Section>
      <Section title="ЧАСТЫЕ ВОПРОСЫ ГОСТЕЙ">{c.faq}</Section>
      {c.details?.map((d, i) => (
        <Section key={`${d.label}-${i}`} title={d.label.toUpperCase()}>{d.text}</Section>
      ))}
    </>
  )

  // desktop шапка
  const desktopHeader = (
    <>
      <img src={c.logo} alt={c.name} className="h-[70px] w-[160px] shrink-0 rounded-lg border border-border object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[24px] leading-[1.1] font-bold">
          {c.name}
          {hotBadge && <span className="ml-2 inline-block rounded-[4px] bg-signal px-[7px] py-px align-[4px] font-mono text-[10px] font-bold text-white">HOT</span>}
        </span>
        <span className="text-[14px] text-[#71717A]">{c.subtitle}</span>
        <Meta price={c.price} volume={c.volume} abv={c.abv} isAlcoholic={c.isAlcoholic} />
      </div>
      <CloseBtn onClick={() => onOpenChange(false)} />
    </>
  )

  const desktopLeft = (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>ВКУС</Label>
        <FlavorChips spirits={spirits} descriptors={c.descriptors} />
      </div>
      <GlassGarnish glass={c.glass} garnish={c.garnish} ice={c.ice} />
      <NonAlcIndicators caffeineLevel={c.caffeineLevel} isCarbonated={c.isCarbonated} />
      <PhotoGallery photos={c.photos} alt={c.name} />
      <div className="mt-auto">
        <LearnedToggle variant="cta" learned={learned} onChange={onLearnedChange} />
      </div>
    </>
  )
  const desktopRight = (
    <>
      <Section title="СОСТАВ" desktop>{c.recipe}</Section>
      <Section title="КАК ПРОДАВАТЬ" desktop>{c.pitch}</Section>
      <Section title="О КОКТЕЙЛЕ" desktop>{c.about}</Section>
      <Section title="ПРО НАЗВАНИЕ" desktop>{c.naming}</Section>
      <Section title="ЧАСТЫЕ ВОПРОСЫ ГОСТЕЙ" desktop>{c.faq}</Section>
      {c.details?.map((d, i) => (
        <Section key={`${d.label}-${i}`} title={d.label.toUpperCase()} desktop>{d.text}</Section>
      ))}
    </>
  )

  return (
    <DetailShellFull
      open={open}
      onOpenChange={onOpenChange}
      title={c.name}
      mobileHeader={mobileHeader}
      mobileBody={mobileBody}
      desktopHeader={desktopHeader}
      desktopLeft={desktopLeft}
      desktopRight={desktopRight}
      nav={nav}
      learned={learned}
      onLearnedChange={onLearnedChange}
    />
  )
}

/* ---------- Классика ---------- */

export interface ClassicDetailProps {
  classic: Classic | null
  open: boolean
  onOpenChange: (v: boolean) => void
  learned: boolean
  onLearnedChange: (v: boolean) => void
  nav: DeckNav
  onCrossLink?: (menuId?: string) => void
}

export function ClassicDetail({ classic, open, onOpenChange, learned, onLearnedChange, nav, onCrossLink }: ClassicDetailProps) {
  const { FAMILIES } = useContent()
  if (!classic) return null
  const c = classic
  const fam = FAMILIES.find((f) => f.tint === c.family)

  const famLine = (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.08em]">
      <TintMarker tint={c.family} size={10} />
      {fam?.title ?? c.family.toUpperCase()}
    </span>
  )
  // year/city/glass — часть классиков без года или города (18/67 без origin,
  // 2/67 без года); склеиваем только заполненные, иначе висело «· ·»
  const subMeta = (
    <span className="font-mono text-[10px] text-[#71717A]">
      {[c.year, c.city ? c.city.toUpperCase() : "", c.glass ? c.glass.toUpperCase() : ""].filter(Boolean).join(" · ")}
    </span>
  )

  const answers =
    c.ourAnswers && c.ourAnswers.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <Label>НАШ ОТВЕТ</Label>
        <div className="flex flex-wrap gap-2">
          {c.ourAnswers.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onCrossLink?.(a.menuId)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-[#FFFDF0]"
            >
              {a.label} <span className="font-mono text-[11px]">→</span>
            </button>
          ))}
        </div>
      </div>
    ) : null

  const mobileHeader = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          {famLine}
          <span className="text-[20px] leading-[1.1] font-bold">{c.name}</span>
          {subMeta}
        </div>
        <CloseBtn onClick={() => onOpenChange(false)} />
      </div>
    </>
  )
  const mobileBody = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {c.descriptors.map((d) => (
          <FlavorChip key={d}>{d.toUpperCase()}</FlavorChip>
        ))}
      </div>
      <div className="border-t border-divider" />
      <Section title="СОСТАВ">{c.recipe}</Section>
      <GlassGarnish glass={c.glass} garnish={c.garnish} />
      <Section title="ИСТОРИЯ">{c.history}</Section>
      <Section title="КОМУ ПОДХОДИТ">{c.fits}</Section>
      {answers && (
        <>
          <div className="border-t border-divider" />
          {answers}
        </>
      )}
    </>
  )

  const desktopHeader = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {famLine}
      <span className="text-[24px] leading-[1.1] font-bold">{c.name}</span>
      {subMeta}
    </div>
  )
  const desktopLeft = (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>ВКУС</Label>
        <div className="flex flex-wrap gap-1.5">
          {c.descriptors.map((d) => (
            <FlavorChip key={d}>{d.toUpperCase()}</FlavorChip>
          ))}
        </div>
      </div>
      <GlassGarnish glass={c.glass} garnish={c.garnish} />
      <div className="mt-auto">
        <LearnedToggle variant="cta" learned={learned} onChange={onLearnedChange} />
      </div>
    </>
  )
  const desktopRight = (
    <>
      <Section title="СОСТАВ" desktop>{c.recipe}</Section>
      <Section title="ИСТОРИЯ" desktop>{c.history}</Section>
      <Section title="КОМУ ПОДХОДИТ" desktop>{c.fits}</Section>
      {answers}
    </>
  )

  return (
    <DetailShellFull
      open={open}
      onOpenChange={onOpenChange}
      title={c.name}
      mobileHeader={mobileHeader}
      mobileBody={mobileBody}
      desktopHeader={
        <>
          {desktopHeader}
          <CloseBtn onClick={() => onOpenChange(false)} />
        </>
      }
      desktopLeft={desktopLeft}
      desktopRight={desktopRight}
      nav={nav}
      learned={learned}
      onLearnedChange={onLearnedChange}
    />
  )
}

/* ---------- Спирит (3r) ---------- */

export interface SpiritDetailProps {
  spirit: Spirit | null
  /** категория группы — для шапки «ДЖИН · СТРАНА · NN% ABV» */
  category: string
  open: boolean
  onOpenChange: (v: boolean) => void
  learned: boolean
  onLearnedChange: (v: boolean) => void
  nav: DeckNav
}

export function SpiritDetail({ spirit, category, open, onOpenChange, learned, onLearnedChange, nav }: SpiritDetailProps) {
  if (!spirit) return null
  const s = spirit
  const abv = `${s.abv}% ABV`
  // цена за порцию — старая карта/шит показывали её; «550 ₽ / 30 мл»
  const priceStr = s.price != null ? `${s.price} ₽${s.serving != null ? ` / ${s.serving} мл` : ""}` : null
  const metaDesktop = [category, [s.country, s.region].filter(Boolean).join(", "), abv, priceStr].filter(Boolean).join(" · ")
  const metaMobile = [category, s.country, abv, priceStr].filter(Boolean).join(" · ")

  const brandCountry =
    s.brand || s.country || s.region ? (
      <div className="grid grid-cols-2 gap-3">
        {s.brand && (
          <div className="flex flex-col gap-1">
            <Label>БРЕНД</Label>
            <span className="text-[13px]">{s.brand}</span>
          </div>
        )}
        {(s.country || s.region) && (
          <div className="flex flex-col gap-1">
            <Label>СТРАНА / РЕГИОН</Label>
            <span className="text-[13px]">{[s.country, s.region].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>
    ) : null

  const mobileHeader = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-[20px] leading-[1.1] font-bold">{s.name}</span>
          <span className="font-mono text-[10px] text-[#71717A] uppercase">{metaMobile}</span>
        </div>
        <CloseBtn onClick={() => onOpenChange(false)} />
      </div>
    </>
  )
  const mobileBody = (
    <>
      <BottlePhoto src={s.img} alt={s.name} h={210} />
      <Section title="ВКУС">{s.flavour}</Section>
      {brandCountry}
      <Section title="ПОДРОБНО ПРО БРЕНД">{s.brandDetail}</Section>
      <Section title="ОСОБЕННОСТИ">{s.features}</Section>
      <Section title="В КОКТЕЙЛЯХ">{s.pairings}</Section>
      <FactPlate>{s.fact}</FactPlate>
      <SourceLink url={s.sourceUrl} />
    </>
  )
  const desktopHeader = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[24px] leading-[1.1] font-bold">{s.name}</span>
        <span className="font-mono text-[11px] text-[#71717A] uppercase">{metaDesktop}</span>
      </div>
      <CloseBtn onClick={() => onOpenChange(false)} />
    </>
  )
  const desktopLeft = (
    <>
      <BottlePhoto src={s.img} alt={s.name} h={280} />
      {s.brand && (
        <div className="flex flex-col gap-1">
          <Label>БРЕНД</Label>
          <span className="text-[13px]">{s.brand}</span>
        </div>
      )}
      <SourceLink url={s.sourceUrl} />
      <div className="mt-auto">
        <LearnedToggle variant="cta" learned={learned} onChange={onLearnedChange} />
      </div>
    </>
  )
  const desktopRight = (
    <>
      <Section title="ВКУС" desktop>{s.flavour}</Section>
      <Section title="ПОДРОБНО ПРО БРЕНД" desktop>{s.brandDetail}</Section>
      <Section title="ОСОБЕННОСТИ" desktop>{s.features}</Section>
      <Section title="В КОКТЕЙЛЯХ" desktop>{s.pairings}</Section>
      <FactPlate desktop>{s.fact}</FactPlate>
    </>
  )

  return (
    <DetailShellFull
      open={open}
      onOpenChange={onOpenChange}
      title={s.name}
      mobileHeader={mobileHeader}
      mobileBody={mobileBody}
      desktopHeader={desktopHeader}
      desktopLeft={desktopLeft}
      desktopRight={desktopRight}
      nav={nav}
      learned={learned}
      onLearnedChange={onLearnedChange}
    />
  )
}

/* ---------- Блюдо (3t Кухня) ---------- */

export interface DishDetailProps {
  dish: Dish | null
  open: boolean
  onOpenChange: (v: boolean) => void
  learned: boolean
  onLearnedChange: (v: boolean) => void
  nav: DeckNav
}

export function DishDetail({ dish, open, onOpenChange, learned, onLearnedChange, nav }: DishDetailProps) {
  if (!dish) return null
  const d = dish
  // цена/вес/тайминг опциональны — склеиваем только заполненные (иначе «0 ₽»)
  const meta = [
    d.price != null ? `${d.price} ₽` : null,
    d.weight != null ? `${d.weight} Г` : null,
    d.timing != null ? `${d.timing} МИН` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const mobileHeader = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-[20px] leading-[1.1] font-bold">{d.name}</span>
          <span className="font-mono text-[10px] text-[#71717A]">{d.category}{meta ? ` · ${meta}` : ""}</span>
        </div>
        <CloseBtn onClick={() => onOpenChange(false)} />
      </div>
    </>
  )
  const mobileBody = (
    <>
      <span className="text-[12.5px] leading-[1.4] text-[#71717A]">{d.subtitle}</span>
      <Photo src={d.photo} alt={d.name} />
      <Section title="СОСТАВ">{d.description}</Section>
      <Section title="СЕРВИРОВКА">{d.serving}</Section>
      {/* АЛЛЕРГЕНЫ показываем и на мобилке — гость-критичны (реф-мок дал только
          desktop; отклонение осознанное, сообщить дизайн-команде) */}
      <Section title="АЛЛЕРГЕНЫ / СТОП">{d.allergens}</Section>
      <FactPlate>{d.fact}</FactPlate>
      {d.nutrition && <NutritionGrid n={d.nutrition} columns={4} caption="НА ПОРЦИЮ" />}
    </>
  )
  const desktopHeader = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[24px] leading-[1.1] font-bold">{d.name}</span>
        <span className="text-[14px] text-[#71717A]">{d.subtitle}</span>
        {meta && <span className="font-mono text-[12px] font-bold">{meta}</span>}
      </div>
      <CloseBtn onClick={() => onOpenChange(false)} />
    </>
  )
  const desktopLeft = (
    <>
      <Photo src={d.photo} alt={d.name} />
      {d.nutrition && <NutritionGrid n={d.nutrition} columns={2} />}
      <div className="mt-auto">
        <LearnedToggle variant="cta" learned={learned} onChange={onLearnedChange} />
      </div>
    </>
  )
  const desktopRight = (
    <>
      <Section title="СОСТАВ" desktop>{d.description}</Section>
      <Section title="СЕРВИРОВКА" desktop>{d.serving}</Section>
      <Section title="АЛЛЕРГЕНЫ / СТОП" desktop>{d.allergens}</Section>
      <FactPlate desktop>{d.fact}</FactPlate>
    </>
  )

  return (
    <DetailShellFull
      open={open}
      onOpenChange={onOpenChange}
      title={d.name}
      mobileHeader={mobileHeader}
      mobileBody={mobileBody}
      desktopHeader={desktopHeader}
      desktopLeft={desktopLeft}
      desktopRight={desktopRight}
      nav={nav}
      learned={learned}
      onLearnedChange={onLearnedChange}
    />
  )
}

/* ---------- единая обёртка (mobile Drawer / desktop Dialog 840) ---------- */

function DetailShellFull({
  open,
  onOpenChange,
  title,
  mobileHeader,
  mobileBody,
  desktopHeader,
  desktopLeft,
  desktopRight,
  nav,
  learned,
  onLearnedChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  mobileHeader: React.ReactNode
  mobileBody: React.ReactNode
  desktopHeader: React.ReactNode
  desktopLeft: React.ReactNode
  desktopRight: React.ReactNode
  nav: DeckNav
  learned: boolean
  onLearnedChange: (v: boolean) => void
}) {
  const isMobile = useIsMobile()
  const swipe = useSwipe(nav)
  useDeckKeys(open && !isMobile, nav, () => onLearnedChange(!learned))
  // fade 120ms при СМЕНЕ карточки (key по индексу) — листание ощущается
  // листанием; шапка/бар статичны, анимируется только тело (ревью R25)

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col" {...swipe}>
            <div className="shrink-0 border-b border-divider bg-card px-[18px] pt-1 pb-2.5">{mobileHeader}</div>
            <div
              key={nav.index}
              className="flex min-h-0 flex-1 animate-in flex-col gap-3 overflow-y-auto px-[18px] py-3 fade-in-0 duration-[120ms]"
            >
              {mobileBody}
            </div>
            <MobileDeckBar nav={nav} learned={learned} onLearnedChange={onLearnedChange} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] w-[840px] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-overlay sm:max-w-[840px]"
        data-testid="cg-detail-modal"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex shrink-0 items-center gap-4 border-b border-border px-[22px] py-[18px]">{desktopHeader}</div>
        {/* левая колонка (карточка бармена + «ИЗУЧЕНО») закреплена и всегда
            видна; скроллится ТОЛЬКО правая колонка с длинным учебным текстом
            (напр. Апсайкл Кола). Каждая колонка тянется на высоту контейнера и
            скроллит свой overflow независимо; шапка/подвал-листалка закреплены. */}
        <div key={nav.index} className="flex min-h-0 flex-1 animate-in overflow-hidden fade-in-0 duration-[120ms]">
          <div className="flex w-[280px] shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-divider px-[22px] py-[18px]">{desktopLeft}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[22px] py-[18px]">{desktopRight}</div>
        </div>
        <DesktopDeckBar nav={nav} />
      </DialogContent>
    </Dialog>
  )
}
