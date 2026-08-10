import * as React from "react"

import { FilterChip, ChipRow } from "@/components/kollektiv/filter-chip"
import { SearchInput } from "@/components/kollektiv/search-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

/** §49 select-чип фильтра как ДРОПДАУН (композиция warehouse ChipMenu):
 *  дефолт — «Ось ▾» (плоский select-чип); выбранное — «Ось: Значение» applied
 *  (BUTTER) + ✕ сброса в «Все». Список опций — Popover (desktop + mobile).
 *  Тинтованные оси (семейства) несут TintMarker на выбранном чипе и в списке.
 *  opts[0] у всех осей = «Все» (mapBundle префиксит), значит это цель сброса. */
function AxisSelect({
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
  const [open, setOpen] = React.useState(false)
  const isDefault = active === opts[0]?.label
  const cur = opts.find((o) => o.label === active)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterChip
          select={isDefault}
          applied={!isDefault}
          onRemove={isDefault ? undefined : () => onChange(opts[0].label)}
        >
          {tinted && !isDefault && cur?.tint && <TintMarker tint={cur.tint} size={9} />}
          {isDefault ? axis : `${axis}: ${cur?.label}`}
        </FilterChip>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="max-h-[min(60vh,20rem)] w-52 overflow-y-auto p-1">
        {opts.map((o) => {
          const on = o.label === active
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                onChange(o.label)
                setOpen(false)
              }}
              className={cn(
                "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-semibold",
                on ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {tinted && o.tint && <TintMarker tint={o.tint} size={9} onDark={on} />}
              {o.label}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

// поиск раздела справочника — §51 SearchInput (inline). Хоткей «/» включён
// (дефолт inline): сам компонент показывает kbd-хинт только на desktop
// (max-md:hidden), а «/»-listener на мобилке инертен (нет клавиши) — т.е.
// фича естественно desktop-only. В каждый момент виден один раздел = один
// поиск, конфликта нет. Обёртка сохраняет прежний {placeholder,value,onChange}.
function SearchBox({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <SearchInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-[220px] max-md:w-full"
    />
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
  const { MENU, DRINK_CATEGORIES, SPIRIT_FILTERS, GLASS_FILTERS, SECTIONS } = useContent()
  const [q, setQ] = React.useState("")
  const [spirit, setSpirit] = React.useState("Все")
  const [glass, setGlass] = React.useState("Все")
  // Task 5: Безалко/Zero Culture слиты в Авторские — «ТИП» фильтрует по
  // isAlcoholic вместо отдельных разделов (blueprint §E.2)
  const [alcFilter, setAlcFilter] = React.useState("Все")
  const menu = SECTIONS.find((s) => s.id === "menu")!

  const rows = MENU.filter(
    (c) =>
      (spirit === "Все" || c.spirit === spirit) &&
      (glass === "Все" || c.glass === glass) &&
      (q === "" || c.name.toLowerCase().includes(q.toLowerCase())) &&
      (alcFilter === "Все" || (alcFilter === "Алко") === c.isAlcoholic)
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
      <ChipRow aria-label="Фильтры авторских">
        <AxisSelect axis="Спирит" options={SPIRIT_FILTERS} active={spirit} onChange={setSpirit} />
        <AxisSelect axis="Бокал" options={GLASS_FILTERS} active={glass} onChange={setGlass} />
        <AxisSelect axis="Тип" options={["Все", "Алко", "Безалко"]} active={alcFilter} onChange={setAlcFilter} />
      </ChipRow>
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
      {/* Task B4: секции по категории напитка (mirror KitchenView) — «колода»
          флеш-карточек onOpen(c, rows) остаётся ПЛОСКОЙ в порядке rows (не
          перегруппированной по секциям), как и в KitchenView.onOpen(d, rows) —
          тот же прецедент в этом файле, листание идёт по общему фильтрованному
          списку, а не «внутри секции». */}
      <div className="flex flex-col gap-4" data-testid="cg-menu-groups">
        {DRINK_CATEGORIES.map((cat) => {
          const items = rows.filter((c) => c.categorySlug === cat.slug)
          if (items.length === 0) return null
          return (
            <div key={cat.slug} className="flex flex-col gap-1.5">
              <span className="px-0.5 font-mono text-[9.5px] font-bold tracking-[0.08em] text-[#A1A1AA]">
                {cat.label} · {items.length}
              </span>
              <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                {items.map((c) => (
                  <MenuCard key={c.id} c={c} learned={learnedIds.has(c.id)} onToggle={() => onToggle(c.id)} onOpen={() => onOpen(c, rows)} />
                ))}
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#52525B]">
            Такого коктейля нет, но мы можем придумать.
          </div>
        )}
      </div>
    </div>
  )
}

function MenuCard({ c, learned, onToggle, onOpen }: { c: Cocktail; learned: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <MediaCard
      // Task C4: карточка предпочитает первое фото галереи (реальный кадр
      // напитка), падая на легаси logo, когда фото ещё не загружены
      image={c.photos?.[0] ?? c.logo}
      name={c.name}
      badge={
        // Красный HOT-чип теперь гейтится isHot (бэкенд смигрировал старый
        // badge==="HOT" в это поле) — badge остаётся для прочих бейджей.
        c.isHot
          ? { label: "HOT", tone: "hot" }
          : c.badge
            ? { label: c.badge, tone: c.badge === "ONESIP" ? "butter" : "ink" }
            : !c.isAlcoholic
              ? { label: "0%", tone: "ink" }
              : undefined
      }
      subtitle={c.subtitle}
      meta={[
        c.price != null ? `${c.price} ₽` : null,
        c.volume != null ? `${c.volume} МЛ` : null,
        // алко без записанного ABV → чип не показываем (не «0%»); безалко → «0%»
        c.isAlcoholic ? (c.abv != null ? `${c.abv}%` : null) : "0%",
      ]
        .filter(Boolean)
        .join(" · ")}
      descriptors={c.descriptors.slice(0, 3).join(" · ")}
      learned={learned}
      onLearnedChange={onToggle}
      onClick={onOpen}
    />
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

  const activeFam = FAMILIES.find((f) => f.title === family)
  const all = family === "Все"
  // база: фильтр по спириту + поиску (семейство накладываем ниже). Поиск матчит
  // имя, город/происхождение и вкус-дескрипторы — как старый фронт (искал по
  // name + origin + descriptors, а не только по имени).
  const ql = q.trim().toLowerCase()
  const base = CLASSICS.filter(
    (c) =>
      (spirit === "Все" || c.spirit === spirit) &&
      (ql === "" ||
        c.name.toLowerCase().includes(ql) ||
        c.city.toLowerCase().includes(ql) ||
        c.descriptors.some((d) => d.toLowerCase().includes(ql)))
  )
  const rows = base.filter((c) => all || c.family === activeFam?.tint)
  const learnedCount = CLASSICS.filter((c) => learnedIds.has(c.id)).length
  // сквозная колода «Все» — база в порядке групп-семейств (листаем сквозь них,
  // счётчик показывает текущее семейство); page выводит группу из c.family (R26.1)
  const flatDeck = FAMILIES.flatMap((fam) => base.filter((c) => c.family === fam.tint))

  // ярлык семейства = его title («Negroni & Friends»), а не cap(code)
  // («Negroni») — совпадает с шапками групп и деталью (было расхождение)
  const familyOpts = [{ label: "Все" }, ...FAMILIES.map((f) => ({ label: f.title, tint: f.tint }))]

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeader
        title="Классика"
        count={classics.total}
        unit={all ? "POSITIONS · ALL FAMILIES" : "POSITIONS"}
        search={<SearchBox placeholder="Найти классику…" value={q} onChange={setQ} />}
      />
      <ChipRow aria-label="Фильтры классики">
        <AxisSelect axis="Семейство" options={familyOpts} active={family} onChange={setFamily} tinted />
        <AxisSelect axis="Спирит" options={CLASSIC_SPIRITS} active={spirit} onChange={setSpirit} />
      </ChipRow>
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
  const { SPIRIT_GROUPS, SPIRIT_GROUPS_ARCHIVED, RETIRED_COUNT, SPIRIT_CATEGORIES, SECTIONS } = useContent()
  const [q, setQ] = React.useState("")
  const [tab, setTab] = React.useState<"active" | "retired">("active")
  const [cat, setCat] = React.useState("Все")
  const spirits = SECTIONS.find((s) => s.id === "spirits")!
  const ql = q.trim().toLowerCase()

  // «Выведенные» — та же группировка/деталь, что и «В карте», но по
  // SPIRIT_GROUPS_ARCHIVED (Task 3). Пилюли категорий у архива свои —
  // SPIRIT_CATEGORIES строится только из неархивных spiritCategories
  // (blueprint §B), так что архивные ярлыки в нём не встречаются.
  const archivedCategories = React.useMemo(
    () => ["Все", ...SPIRIT_GROUPS_ARCHIVED.map((g) => g.category)],
    [SPIRIT_GROUPS_ARCHIVED],
  )
  const sourceGroups = tab === "active" ? SPIRIT_GROUPS : SPIRIT_GROUPS_ARCHIVED
  const categoryOptions = tab === "active" ? SPIRIT_CATEGORIES : archivedCategories

  const groups = sourceGroups
    .filter((g) => cat === "Все" || cap(g.category) === cat)
    .map((g) => ({ ...g, items: ql === "" ? g.items : g.items.filter((s) => s.name.toLowerCase().includes(ql)) }))
    .filter((g) => g.items.length > 0)
  // сквозная колода в порядке видимых групп (deck.item несёт свою категорию)
  const flatDeck = groups.flatMap((g) => g.items.map((s) => ({ s, cat: g.category })))

  // при переключении таба сбрасываем пилюлю категории — иначе выбранная
  // активная категория не найдётся среди архивных (и наоборот), и список
  // молча окажется пустым
  const selectTab = (next: "active" | "retired") => {
    setTab(next)
    setCat("Все")
  }

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
            onClick={() => selectTab("active")}
            className={cn("flex cursor-pointer items-center justify-center px-3.5 py-[7px] max-md:min-h-11 max-md:flex-1", tab === "active" && "bg-primary text-primary-foreground")}
          >
            В карте
          </button>
          <button
            type="button"
            onClick={() => selectTab("retired")}
            className={cn("flex cursor-pointer items-center justify-center gap-1.5 border-l border-border px-3.5 py-[7px] max-md:min-h-11 max-md:flex-1", tab === "retired" && "bg-primary text-primary-foreground")}
          >
            Выведенные
            <span className={cn("rounded-[4px] px-1.5 py-px font-mono text-[10px] font-bold", tab === "retired" ? "bg-card text-foreground" : "bg-muted")}>
              {RETIRED_COUNT}
            </span>
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <AxisSelect axis="Категория" options={categoryOptions} active={cat} onChange={setCat} />
        </div>
      </div>
      <ProgressStrip learned={stripLearned} total={spirits.total} onOpen={onOpenProgress} />

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
          <div className="py-10 text-center text-[13px] text-[#52525B]">
            {tab === "active" ? "Такого спирита нет." : "Выведенных спиритов нет."}
          </div>
        )}
      </div>
    </div>
  )
}

function SpiritRow({ s, on, onToggle, onOpen }: { s: Spirit; on: boolean; onToggle: () => void; onOpen: () => void }) {
  // цена за порцию — старая карта показывала её в подписи; «· 550 ₽/30мл»
  const priceStr = s.price != null ? ` · ${s.price} ₽${s.serving != null ? `/${s.serving}мл` : ""}` : ""
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex min-h-[52px] cursor-pointer items-center gap-2.5 bg-card px-4 py-1.5 hover:bg-[#FFFDF0]"
    >
      {/* тамб бутылки — только если фото задано (в проде пока нет; парити со
          старой картой + готовность к фото бутылок, добавляемым в Фазе 2).
          object-contain на белом — вертикальная бутылка не кропается/не ломает
          строку при любом соотношении сторон. */}
      {s.img && (
        <img
          src={s.img}
          alt={s.name}
          loading="lazy"
          className="size-9 shrink-0 rounded-md border border-border bg-white object-contain"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{s.name}</span>
        <span className="block truncate font-mono text-[9px] text-[#A1A1AA]">{s.meta}{priceStr}</span>
        {s.flavour && <span className="block truncate text-[10.5px] leading-[1.3] text-[#71717A]">{s.flavour}</span>}
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
          {[
            d.price != null ? `${d.price} ₽` : null,
            d.weight != null ? `${d.weight} Г` : null,
            d.timing != null ? `${d.timing} МИН` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
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

export { AxisSelect, SearchBox, FamilyTheory, ClassicRow, pct, cap }
