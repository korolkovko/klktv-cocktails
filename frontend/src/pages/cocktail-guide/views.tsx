import * as React from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { MediaCard } from "@/components/kollektiv/media-card"
import { LearnedToggle } from "@/components/kollektiv/learned-toggle"
import { ProgressStrip, ProgressTotal } from "@/components/kollektiv/progress-strip"
import { ProgressLevels } from "@/components/kollektiv/progress-levels"
import { TintMarker } from "@/components/kollektiv/tint-marker"
import { cn } from "@/lib/utils"

import {
  familyLearnedLive,
  sectionLearnedLive,
  totalLearnedLive,
  type Classic,
  type Cocktail,
  type Dish,
  type Family,
  type SectionId,
  type Spirit,
} from "./data"
import { useContent } from "@/data/ContentContext"

const pct = (l: number, t: number) => (t > 0 ? Math.round((l / t) * 100) : 0)

/* ---------- общие детали ---------- */

/** Ряд фильтров с mono-подписью оси: desktop-перенос / mobile-карусель с fade */
function FilterRow({
  axis,
  options,
  active,
  onChange,
  tinted,
}: {
  axis: string
  options: { label: string; tint?: string }[] | string[]
  active: string
  onChange: (v: string) => void
  tinted?: boolean
}) {
  const opts = options.map((o) => (typeof o === "string" ? { label: o } : o))
  return (
    <div className="flex items-center gap-2.5">
      {axis && (
        <span className="w-[42px] shrink-0 font-mono text-[9px] font-bold tracking-[0.08em] text-[#A1A1AA]">
          {axis}
        </span>
      )}
      <div className="relative flex min-w-0 flex-1 flex-wrap gap-1.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pr-8 max-md:[scrollbar-width:none]">
        {opts.map((o) => {
          const on = active === o.label
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange(o.label)}
              className={cn(
                "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-[7px] rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap max-md:min-h-10 md:min-h-0 md:py-[5px]",
                on ? "bg-primary text-primary-foreground" : "border border-border bg-card"
              )}
            >
              {tinted && o.tint && <TintMarker tint={o.tint} size={9} onDark={on} />}
              {o.label}
            </button>
          )
        })}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-8 bg-gradient-to-r from-transparent to-[#FBFBF9] max-md:block"
        />
      </div>
    </div>
  )
}

function SearchBox({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-[220px] max-md:w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-8 max-md:min-h-11 max-md:text-base"
      />
    </div>
  )
}

/** desktop-заголовок раздела «Название · N POSITIONS» + поиск справа */
function SectionHeader({ title, count, unit = "POSITIONS", search }: { title: React.ReactNode; count: number; unit?: string; search: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 max-md:hidden">
        <span className="text-[22px] font-bold">
          {title}
          <span className="ml-2 font-mono text-[11px] font-normal text-[#A1A1AA]">{count} {unit}</span>
        </span>
        {search}
      </div>
      <div className="md:hidden">{search}</div>
    </>
  )
}

/* ---------- 3n Меню ---------- */

export function MenuView({
  learnedIds,
  onToggle,
  onOpen,
  onOpenProgress,
}: {
  learnedIds: Set<string>
  onToggle: (id: string) => void
  /** deck = текущий отфильтрованный список (колода флеш-карточек) */
  onOpen: (c: Cocktail, deck: Cocktail[]) => void
  onOpenProgress: () => void
}) {
  const { MENU, SPIRIT_FILTERS, GLASS_FILTERS, SECTIONS } = useContent()
  const [q, setQ] = React.useState("")
  const [spirit, setSpirit] = React.useState("Все")
  const [glass, setGlass] = React.useState("Все")
  const menu = SECTIONS.find((s) => s.id === "menu")!

  const rows = MENU.filter(
    (c) =>
      (spirit === "Все" || c.spirit === spirit) &&
      (glass === "Все" || c.glass === glass) &&
      (q === "" || c.name.toLowerCase().includes(q.toLowerCase()))
  )
  const learnedCount = MENU.filter((c) => learnedIds.has(c.id)).length

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3 max-md:hidden">
        <span className="text-[22px] font-bold">
          Basic people can't tell what it is<span className="text-signal">®</span>
          <span className="ml-2 font-mono text-[11px] font-normal text-[#A1A1AA]">{menu.total} POSITIONS</span>
        </span>
        <SearchBox placeholder="Найти коктейль…" value={q} onChange={setQ} />
      </div>
      <div className="md:hidden">
        <SearchBox placeholder="Найти коктейль…" value={q} onChange={setQ} />
      </div>
      <div className="flex flex-col gap-2">
        <FilterRow axis="SPIRIT" options={SPIRIT_FILTERS} active={spirit} onChange={setSpirit} />
        <FilterRow axis="GLASS" options={GLASS_FILTERS} active={glass} onChange={setGlass} />
      </div>
      <div className="max-md:hidden">
        <ProgressStrip
          learned={menu.learned - MENU.filter((c) => c.learned).length + learnedCount}
          total={menu.total}
          onOpen={onOpenProgress}
        />
      </div>
      <div className="md:hidden">
        <span className="mb-1.5 flex items-center justify-between">
          <span className="text-[17px] font-bold">
            Basic people can't tell what it is<span className="text-signal">®</span>
          </span>
          <span className="font-mono text-[11px] text-[#A1A1AA]">{menu.total} POS</span>
        </span>
        <ProgressStrip
          learned={menu.learned - MENU.filter((c) => c.learned).length + learnedCount}
          total={menu.total}
          onOpen={onOpenProgress}
        />
      </div>
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1" data-testid="cg-menu-grid">
        {rows.map((c) => (
          <MediaCard
            key={c.id}
            image={c.logo}
            name={c.name}
            badge={c.badge ? { label: c.badge, tone: c.badge === "HOT" ? "hot" : c.badge === "ONESIP" ? "butter" : "ink" } : undefined}
            subtitle={c.subtitle}
            meta={`${c.price} ₽ · ${c.volume} МЛ · ${c.abv}%`}
            descriptors={c.descriptors.slice(0, 3).join(" · ")}
            learned={learnedIds.has(c.id)}
            onLearnedChange={() => onToggle(c.id)}
            onClick={() => onOpen(c, rows)}
          />
        ))}
        {rows.length === 0 && (
          <div className="col-span-full py-10 text-center text-[13px] text-[#52525B]">
            Такого коктейля нет, но мы можем придумать.
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- 3o Классика ---------- */

/** butter-плашка TIP (шапка группы и полная карточка теории) */
function TipPlate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-butter px-2.5 py-1.5">
      <span className="shrink-0 pt-0.5 font-mono text-[8.5px] font-bold tracking-[0.08em]">TIP</span>
      <span className="text-[12px] leading-[1.45]">{children}</span>
    </div>
  )
}

/** Полная карточка теории семейства — при выбранном семействе (logic + evolution
 *  + TIP) И при доразвороте «ТЕОРИЯ ▸» в режиме «Все» (там hideTip: TIP уже в
 *  шапке группы, доразворот добавляет evolution) */
function FamilyTheory({ fam, shown, total, learnedInFamily, hideTip }: { fam: Family; shown: number; total: number; learnedInFamily: number; hideTip?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] font-mono text-[10px] font-bold tracking-[0.08em]">
          <TintMarker tint={fam.tint} size={10} />
          {fam.title}
        </span>
        <span className="font-mono text-[9.5px] text-[#A1A1AA]">
          {shown} OF {total} · {learnedInFamily} ✓
        </span>
      </div>
      <p className="text-[12.5px] leading-[1.5]">{fam.logic}</p>
      {fam.evolution && <p className="text-[12px] leading-[1.5] text-[#71717A]">{fam.evolution}</p>}
      {fam.tip && !hideTip && <TipPlate>{fam.tip}</TipPlate>}
    </div>
  )
}

/** Шапка группы семейства (режим «Все»): маркер + название + счёт + «ТЕОРИЯ ▸»
 *  разворачивает полную FamilyTheory; счёт «5/6 ✓» — сводка каталога (fam.learned/
 *  fam.total, как счётчики разделов; в проде — прогресс семейства с бэка) */
function FamilyGroupHeader({ fam, open, onToggle, learnedIds }: { fam: Family; open: boolean; onToggle: () => void; learnedIds: Set<string> }) {
  const content = useContent()
  // счёт «5/6 ✓» — LIVE (R27, закрывает P2-2 ревью R26): тогл классики двигает
  const count = `${familyLearnedLive(fam.tint, content, learnedIds)}/${fam.total} ✓`
  return (
    <div className="flex cursor-pointer flex-col gap-[3px] px-0.5" onClick={onToggle}>
      {/* desktop */}
      <div className="flex items-baseline justify-between max-md:hidden">
        <span className="inline-flex items-center gap-[7px] font-mono text-[10px] font-bold tracking-[0.08em]">
          <TintMarker tint={fam.tint} size={10} />
          {fam.title}
          <span className="font-normal text-[#A1A1AA]">· {count}</span>
        </span>
        <span className="font-mono text-[9.5px] text-[#52525B] underline underline-offset-[3px]">
          ТЕОРИЯ ЦЕЛИКОМ {open ? "▾" : "▸"}
        </span>
      </div>
      {/* mobile */}
      <div className="flex items-center justify-between md:hidden">
        <span className="inline-flex items-center gap-[7px] font-mono text-[10px] font-bold tracking-[0.08em]">
          <TintMarker tint={fam.tint} size={10} />
          {fam.title}
        </span>
        <span className="font-mono text-[9.5px] text-[#A1A1AA]">
          {count} · ТЕОРИЯ {open ? "▾" : "▸"}
        </span>
      </div>
      <span className="text-[12px] leading-[1.45] text-[#52525B] max-md:line-clamp-2 md:text-[12.5px] md:leading-[1.5]">
        {fam.logic}
      </span>
      {/* TIP сразу в шапке (R26.1) — без клика; «ТЕОРИЯ ▸» доразворачивает evolution */}
      {fam.tip && <TipPlate>{fam.tip}</TipPlate>}
    </div>
  )
}

export function ClassicsView({
  learnedIds,
  onToggle,
  onOpen,
  onOpenProgress,
}: {
  learnedIds: Set<string>
  onToggle: (id: string) => void
  onOpen: (c: Classic, deck: Classic[]) => void
  onOpenProgress: () => void
}) {
  const { CLASSICS, FAMILIES, CLASSIC_SPIRITS, SECTIONS } = useContent()
  const [q, setQ] = React.useState("")
  const [family, setFamily] = React.useState("Все")
  const [spirit, setSpirit] = React.useState("Все")
  // развёрнутые семейства (режим «Все») — не персистим (handoff R26)
  const [openFams, setOpenFams] = React.useState<Set<string>>(new Set())
  const classics = SECTIONS.find((s) => s.id === "classics")!

  const activeFam = FAMILIES.find((f) => f.code === family.toUpperCase())
  const all = family === "Все"
  // база: фильтр по спириту + поиску (семейство накладываем ниже)
  const base = CLASSICS.filter(
    (c) =>
      (spirit === "Все" || c.spirit === spirit) &&
      (q === "" || c.name.toLowerCase().includes(q.toLowerCase()))
  )
  const rows = base.filter((c) => all || c.family === activeFam?.tint)
  const learnedCount = CLASSICS.filter((c) => learnedIds.has(c.id)).length
  // сквозная колода «Все» — база в порядке групп-семейств (листаем сквозь них,
  // счётчик показывает текущее семейство); page выводит группу из c.family (R26.1)
  const flatDeck = FAMILIES.flatMap((fam) => base.filter((c) => c.family === fam.tint))

  const familyOpts = [{ label: "Все" }, ...FAMILIES.map((f) => ({ label: cap(f.code), tint: f.tint }))]

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeader
        title="Классика"
        count={classics.total}
        unit={all ? "POSITIONS · ALL FAMILIES" : "POSITIONS"}
        search={<SearchBox placeholder="Найти классику…" value={q} onChange={setQ} />}
      />
      <div className="flex flex-col gap-2">
        <FilterRow axis="FAMILY" options={familyOpts} active={family} onChange={setFamily} tinted />
        <FilterRow axis="SPIRIT" options={CLASSIC_SPIRITS} active={spirit} onChange={setSpirit} />
      </div>
      <ProgressStrip
        learned={classics.learned - CLASSICS.filter((c) => c.learned).length + learnedCount}
        total={classics.total}
        onOpen={onOpenProgress}
      />

      {all ? (
        /* режим «Все» — группировка по семействам с подсказками теории */
        <div className="flex flex-col gap-4" data-testid="cg-classics-grouped">
          {FAMILIES.map((fam) => {
            const groupRows = base.filter((c) => c.family === fam.tint)
            if (groupRows.length === 0) return null
            const open = openFams.has(fam.code)
            return (
              <div key={fam.code} className="flex flex-col gap-2">
                <FamilyGroupHeader
                  fam={fam}
                  learnedIds={learnedIds}
                  open={open}
                  onToggle={() =>
                    setOpenFams((prev) => {
                      const next = new Set(prev)
                      next.has(fam.code) ? next.delete(fam.code) : next.add(fam.code)
                      return next
                    })
                  }
                />
                {open && (
                  <FamilyTheory
                    fam={fam}
                    shown={groupRows.length}
                    total={fam.total}
                    learnedInFamily={groupRows.filter((c) => learnedIds.has(c.id)).length}
                    hideTip
                  />
                )}
                <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  {groupRows.map((c) => (
                    <ClassicRow
                      key={c.id}
                      c={c}
                      showTint={false}
                      learned={learnedIds.has(c.id)}
                      onToggle={() => onToggle(c.id)}
                      onOpen={() => onOpen(c, flatDeck)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {base.length === 0 && (
            <div className="py-10 text-center text-[13px] text-[#52525B]">Ничего не нашлось.</div>
          )}
        </div>
      ) : (
        /* выбранное семейство — полная теория сразу + плоский грид */
        <>
          {activeFam && (
            <FamilyTheory fam={activeFam} shown={rows.length} total={classics.total} learnedInFamily={rows.filter((c) => learnedIds.has(c.id)).length} />
          )}
          <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1" data-testid="cg-classics-grid">
            {rows.map((c) => (
              <ClassicRow key={c.id} c={c} learned={learnedIds.has(c.id)} onToggle={() => onToggle(c.id)} onOpen={() => onOpen(c, rows)} />
            ))}
            {rows.length === 0 && (
              <div className="col-span-full py-10 text-center text-[13px] text-[#52525B]">
                Ничего не нашлось.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ClassicRow({ c, learned, onToggle, onOpen, showTint = true }: { c: Classic; learned: boolean; onToggle: () => void; onOpen: () => void; showTint?: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex cursor-pointer flex-col gap-1 rounded-[10px] border border-border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-bold">{c.name}</span>
        <LearnedToggle learned={learned} onChange={onToggle} label={c.name} />
      </div>
      <span className="text-[11.5px] text-[#71717A]">
        {c.year} · {c.city}
      </span>
      <div className="mt-[3px] flex flex-wrap items-center gap-2">
        {showTint && (
          <span className="inline-flex items-center gap-[5px] font-mono text-[9px] font-bold tracking-[0.04em]">
            <TintMarker tint={c.family} />
            {c.family.toUpperCase()}
          </span>
        )}
        <span className="rounded-[4px] border border-border px-1.5 py-px font-mono text-[9px] font-semibold">
          {c.spirit.toUpperCase()}
        </span>
        <span className="font-mono text-[9px] text-[#A1A1AA]">
          {c.glass.toUpperCase()} · {c.descriptors.join(" · ")}
        </span>
      </div>
    </div>
  )
}

/* ---------- 3r Спириты ---------- */

export function SpiritsView({
  learnedKeys,
  onToggle,
  onOpen,
  onOpenProgress,
}: {
  learnedKeys: Set<string>
  onToggle: (key: string) => void
  /** deck = СКВОЗНАЯ колода видимых спиритов через все группы (R26.1: листаем
   *  через категории, счётчик показывает текущую); ключ learned = `КАТ:имя` */
  onOpen: (s: Spirit, category: string, deck: { s: Spirit; cat: string }[]) => void
  onOpenProgress: () => void
}) {
  const { SPIRIT_GROUPS, RETIRED_COUNT, SPIRIT_CATEGORIES, SECTIONS } = useContent()
  const [q, setQ] = React.useState("")
  const [tab, setTab] = React.useState<"active" | "retired">("active")
  const [cat, setCat] = React.useState("Все")
  const spirits = SECTIONS.find((s) => s.id === "spirits")!
  const ql = q.trim().toLowerCase()

  const groups = SPIRIT_GROUPS.filter((g) => cat === "Все" || cap(g.category) === cat)
    .map((g) => ({ ...g, items: ql === "" ? g.items : g.items.filter((s) => s.name.toLowerCase().includes(ql)) }))
    .filter((g) => g.items.length > 0)
  // сквозная колода в порядке видимых групп (deck.item несёт свою категорию)
  const flatDeck = groups.flatMap((g) => g.items.map((s) => ({ s, cat: g.category })))

  // прогресс-строка живая: сводка − статик + динамик (как в menu/classics)
  const flat = SPIRIT_GROUPS.flatMap((g) => g.items.map((s) => ({ key: `${g.category}:${s.name}`, learned: s.learned })))
  const stripLearned = spirits.learned - flat.filter((x) => x.learned).length + flat.filter((x) => learnedKeys.has(x.key)).length

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeader
        title="Спириты"
        count={spirits.total}
        search={<SearchBox placeholder="Найти спирит…" value={q} onChange={setQ} />}
      />
      {/* сегменты В карте / Выведенные + категории (desktop — одна строка) */}
      <div className="flex items-center gap-4 max-md:flex-col max-md:items-stretch max-md:gap-2">
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-[13px] font-semibold max-md:w-full">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={cn("flex cursor-pointer items-center justify-center px-3.5 py-[7px] max-md:min-h-11 max-md:flex-1", tab === "active" && "bg-primary text-primary-foreground")}
          >
            В карте
          </button>
          <button
            type="button"
            onClick={() => setTab("retired")}
            className={cn("flex cursor-pointer items-center justify-center gap-1.5 border-l border-border px-3.5 py-[7px] max-md:min-h-11 max-md:flex-1", tab === "retired" && "bg-primary text-primary-foreground")}
          >
            Выведенные
            <span className={cn("rounded-[4px] px-1.5 py-px font-mono text-[10px] font-bold", tab === "retired" ? "bg-card text-foreground" : "bg-muted")}>
              {RETIRED_COUNT}
            </span>
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <FilterRow axis="" options={SPIRIT_CATEGORIES} active={cat} onChange={setCat} />
        </div>
      </div>
      <ProgressStrip learned={stripLearned} total={spirits.total} onOpen={onOpenProgress} />

      {tab === "retired" ? (
        <div className="py-10 text-center text-[13px] text-[#52525B]">
          Выведенные из карты — {RETIRED_COUNT} позиций. Архив в проде.
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="cg-spirits-groups">
          {groups.map((g) => (
            <div key={g.category} className="flex flex-col gap-1">
              <span className="px-1 font-mono text-[9.5px] font-bold tracking-[0.08em] text-[#A1A1AA]">
                {g.category} · {g.total}
              </span>
              {/* сетка: desktop 2 колонки / mobile 1; 1px-разделители — gap-px на подложке */}
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border bg-[#EDEDE8] md:grid-cols-2 max-md:-mx-4 max-md:rounded-none max-md:border-x-0">
                {g.items.map((s) => {
                  const key = `${g.category}:${s.name}`
                  return (
                    <SpiritRow
                      key={s.name}
                      s={s}
                      on={learnedKeys.has(key)}
                      onToggle={() => onToggle(key)}
                      onOpen={() => onOpen(s, g.category, flatDeck)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="py-10 text-center text-[13px] text-[#52525B]">Такого спирита нет.</div>
          )}
        </div>
      )}
    </div>
  )
}

function SpiritRow({ s, on, onToggle, onOpen }: { s: Spirit; on: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex min-h-[52px] cursor-pointer items-center gap-2.5 bg-card px-4 py-1.5 hover:bg-[#FFFDF0]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{s.name}</span>
        <span className="block font-mono text-[9px] text-[#A1A1AA]">{s.meta}</span>
      </span>
      <LearnedToggle learned={on} onChange={onToggle} label={s.name} />
    </div>
  )
}

/* ---------- 3t Кухня ---------- */

export function KitchenView({
  learnedIds,
  onToggle,
  onOpen,
  onOpenProgress,
}: {
  learnedIds: Set<string>
  onToggle: (id: string) => void
  /** deck = весь отфильтрованный список блюд (флеш-карточки — плоско, «1 OF 9») */
  onOpen: (d: Dish, deck: Dish[]) => void
  onOpenProgress: () => void
}) {
  const { DISHES, KITCHEN_CATEGORIES, SECTIONS } = useContent()
  const [q, setQ] = React.useState("")
  const kitchen = SECTIONS.find((s) => s.id === "kitchen")!
  const ql = q.trim().toLowerCase()
  const rows = DISHES.filter((d) => ql === "" || d.name.toLowerCase().includes(ql))
  const learnedCount = DISHES.filter((d) => learnedIds.has(d.id)).length
  const stripLearned = kitchen.learned - DISHES.filter((d) => d.learned).length + learnedCount

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeader
        title="Кухня"
        count={kitchen.total}
        unit="POSITION"
        search={<SearchBox placeholder="Найти блюдо…" value={q} onChange={setQ} />}
      />
      <ProgressStrip learned={stripLearned} total={kitchen.total} onOpen={onOpenProgress} />
      <div className="flex flex-col gap-4" data-testid="cg-kitchen">
        {KITCHEN_CATEGORIES.map((course) => {
          const items = rows.filter((d) => d.category === course.code)
          if (items.length === 0) return null
          return (
            <div key={course.code} className="flex flex-col gap-1.5">
              <span className="px-0.5 font-mono text-[9.5px] font-bold tracking-[0.08em] text-[#A1A1AA]">
                {course.code} · {course.total}
              </span>
              <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                {items.map((d) => (
                  <DishCard
                    key={d.id}
                    d={d}
                    learned={learnedIds.has(d.id)}
                    onToggle={() => onToggle(d.id)}
                    onOpen={() => onOpen(d, rows)}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#52525B]">Такого блюда нет.</div>
        )}
      </div>
    </div>
  )
}

/** тамб блюда 96×72 (§45: фото = айдентика). Нет фото — нейтральный плейсхолдер
 *  (демо без ассетов; в проде тут object-cover фото) */
function DishThumb({ src, alt }: { src?: string; alt: string }) {
  return src ? (
    <img src={src} alt={alt} className="h-[72px] w-24 shrink-0 rounded-md border border-border object-cover" />
  ) : (
    <div className="flex h-[72px] w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-mono text-[9px] font-bold tracking-[0.08em] text-[#A1A1AA]">
      ФОТО
    </div>
  )
}

function DishCard({ d, learned, onToggle, onOpen }: { d: Dish; learned: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex cursor-pointer gap-2.5 rounded-[10px] border border-border bg-card p-2.5 md:hover:shadow-[3px_3px_0_rgba(10,10,10,0.2)]"
    >
      <DishThumb src={d.photo} alt={d.name} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm leading-[1.15] font-bold">{d.name}</span>
          <LearnedToggle learned={learned} onChange={onToggle} label={d.name} />
        </div>
        <span className="text-[11.5px] leading-[1.3] text-[#71717A]">{d.subtitle}</span>
        <span className="mt-0.5 font-mono text-[9.5px] text-[#71717A]">
          {d.price} ₽ · {d.weight} Г · {d.timing} МИН
        </span>
      </div>
    </div>
  )
}

/* ---------- 3q Прогресс ---------- */

function ProgressBar({ pct }: { pct: number }) {
  return (
    <span className="h-[5px] overflow-hidden rounded-full border border-border bg-card">
      <span className="block h-full rounded-r-[1px] border-r border-border bg-profit" style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Карточка «КЛАССИКА · ПО СЕМЕЙСТВАМ» (правый рейл desktop + может звать в раздел) */
function FamiliesRailCard({ learnedIds, onOpen }: { learnedIds: Set<string>; onOpen: () => void }) {
  const content = useContent()
  const { FAMILIES } = content
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-[#A1A1AA]">КЛАССИКА · ПО СЕМЕЙСТВАМ</span>
        <button type="button" onClick={onOpen} className="cursor-pointer font-mono text-[9.5px] text-[#52525B] underline underline-offset-[3px]">
          В РАЗДЕЛ →
        </button>
      </div>
      <ProgressLevels
        levels={FAMILIES.slice(0, 6).map((f) => ({ name: f.code, tint: f.tint, learned: familyLearnedLive(f.tint, content, learnedIds), total: f.total }))}
      />
      <div className="text-center font-mono text-[9px] tracking-[0.06em] text-[#A1A1AA]">
        ··· {FAMILIES.slice(6).map((f) => f.code).join(" · ")} ···
      </div>
    </div>
  )
}

export function ProgressView({
  learnedIds,
  onOpenSection,
}: {
  learnedIds: Set<string>
  onOpenSection: (id: SectionId) => void
}) {
  const content = useContent()
  const { SECTIONS, TOTAL_POSITIONS } = content
  const total = totalLearnedLive(content, learnedIds)
  const cards = SECTIONS.map((s) => {
    const live = sectionLearnedLive(s.id, content, learnedIds)
    return { s, live, p: pct(live, s.total) }
  })

  return (
    <div data-testid="cg-progress">
      {/* mobile — стек: итог + разделы (без изменений R27) */}
      <div className="flex flex-col gap-3 md:hidden">
        <ProgressTotal learned={total} total={TOTAL_POSITIONS} />
        <div className="flex flex-col gap-2">
          {cards.map(({ s, live, p }) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSection(s.id)}
              className="flex cursor-pointer flex-col gap-1.5 rounded-[10px] border border-border bg-card px-3 py-[11px] text-left hover:bg-[#FFFDF0]"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">{s.label}</span>
                <span className="font-mono text-[11px] font-bold tabular-nums">
                  {live}/{s.total} <span className="font-normal text-[#A1A1AA]">· {p}%</span>
                </span>
              </div>
              <ProgressBar pct={p} />
            </button>
          ))}
        </div>
      </div>

      {/* desktop — grid 1fr 380px: слева карточки 2 колонки, справа рейл (3q, R27) */}
      <div className="grid grid-cols-[1fr_380px] items-start gap-4 max-md:hidden">
        <div className="grid grid-cols-2 gap-2.5">
          {cards.map(({ s, live, p }) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSection(s.id)}
              className="flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-card px-3.5 py-[13px] text-left hover:bg-[#FFFDF0] hover:shadow-[2px_2px_0_rgba(10,10,10,0.2)]"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">{s.label}</span>
                <span className="font-mono text-[11px] font-bold tabular-nums">
                  {live}/{s.total} <span className="font-normal text-[#A1A1AA]">· {p}%</span>
                </span>
              </div>
              <ProgressBar pct={p} />
              <span className="font-mono text-[9px] tracking-[0.02em] text-[#A1A1AA]">
                ОСТАЛОСЬ {Math.max(0, s.total - live)} · ОТКРЫТЬ РАЗДЕЛ →
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <ProgressTotal learned={total} total={TOTAL_POSITIONS} />
          <FamiliesRailCard learnedIds={learnedIds} onOpen={() => onOpenSection("classics")} />
        </div>
      </div>
    </div>
  )
}

/* ---------- helpers ---------- */

function cap(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export { FilterRow, SearchBox, FamilyTheory, ClassicRow, pct, cap }
