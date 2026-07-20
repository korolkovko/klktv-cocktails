import * as React from "react"

import { PageFrame } from "@/components/kollektiv/page-frame"
import { useIsMobile } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"

import {
  CocktailBottomNav,
  CocktailDesktopHeader,
  CocktailMobileHeader,
  type Route,
} from "./shell"
import { MenuView, ClassicsView, SpiritsView, KitchenView, ProgressView } from "./views"
import { TeamView, FamiliesPanel } from "./team-view"
import { CocktailDetail, ClassicDetail, SpiritDetail, DishDetail } from "./detail-sheet"
import { CLASSICS, DISHES, FAMILIES, MENU, SECTIONS, SPIRIT_GROUPS, TOTAL_POSITIONS, type Classic, type Cocktail, type Dish, type SectionId, type Spirit } from "./data"

// БЛОК-ОБРАЗЕЦ «Cocktail Guide» — справочник коктейлей целиком (Pages 3n–3t).
// Одно приложение с разделами (роутинг в стейте): Меню (media-card §45),
// Классика (семейства = taxonomy tints §45, теория; «Все» — группировка),
// Спириты (группы + деталь-флеш-карточка), Кухня (блюда курсами + КБЖУ),
// Прогресс (§44 learning), Команда (ADMIN-таблица).
// Навигация — гибрид §45: desktop-табы / mobile bottom-nav §07 + разделы-sheet.
// learned «знаю/не знаю» §44 — локальный стейт (в проде — эндпоинт).
// Пропсы продукта: defaultRoute / route+onRouteChange (controlled), onSignOut.

// начальный learned из данных (в проде — с бэка)
const initialLearned = () => {
  const set = new Set<string>()
  MENU.forEach((c) => c.learned && set.add(c.id))
  CLASSICS.forEach((c) => c.learned && set.add(c.id))
  SPIRIT_GROUPS.forEach((g) => g.items.forEach((s) => s.learned && set.add(`${g.category}:${s.name}`)))
  DISHES.forEach((d) => d.learned && set.add(d.id))
  return set
}

// позиция/размер контиг. группы вокруг index (колода упорядочена по группам) —
// счётчик листалки «ДЖИН · 2 OF 6» (R26.1). labels[i] = метка группы элемента i.
function groupRun(labels: string[], index: number) {
  if (index < 0 || index >= labels.length) return undefined
  const label = labels[index]
  let start = index
  while (start > 0 && labels[start - 1] === label) start--
  let end = index
  while (end < labels.length - 1 && labels[end + 1] === label) end++
  return { label, index: index - start + 1, of: end - start + 1 }
}

export interface CocktailGuideProps {
  route?: Route
  defaultRoute?: Route
  onRouteChange?: (r: Route) => void
  onSignOut?: () => void
}

export default function CocktailGuidePage({
  route: routeProp,
  defaultRoute = "menu",
  onRouteChange,
}: CocktailGuideProps) {
  const [uncontrolled, setUncontrolled] = React.useState<Route>(defaultRoute)
  const route = routeProp ?? uncontrolled
  const navigate = (r: Route) => {
    if (routeProp === undefined) setUncontrolled(r)
    onRouteChange?.(r)
  }
  const isMobile = useIsMobile()

  const [learned, setLearned] = React.useState<Set<string>>(initialLearned)
  const toggle = (id: string) =>
    setLearned((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // деталь-шиты — режим флеш-карточек: колода = отфильтрованный список раздела,
  // индекс листается ←/→/свайпом; -1 = закрыто
  const [cocktailDeck, setCocktailDeck] = React.useState<Cocktail[]>([])
  const [cocktailIdx, setCocktailIdx] = React.useState(-1)
  const [classicDeck, setClassicDeck] = React.useState<Classic[]>([])
  const [classicIdx, setClassicIdx] = React.useState(-1)
  // спириты: СКВОЗНАЯ колода {s,cat} через категории (R26.1); ключ learned =
  // `КАТЕГОРИЯ:имя`, категория — у текущего элемента колоды (меняется при листании)
  const [spiritDeck, setSpiritDeck] = React.useState<{ s: Spirit; cat: string }[]>([])
  const [spiritIdx, setSpiritIdx] = React.useState(-1)
  // блюда: колода = весь отфильтрованный список; ключ learned = id
  const [dishDeck, setDishDeck] = React.useState<Dish[]>([])
  const [dishIdx, setDishIdx] = React.useState(-1)
  // панель прогресса семейств (со строки-полоски классики)
  const [familiesOpen, setFamiliesOpen] = React.useState(false)

  const openProgress = () => navigate("progress")
  const openCocktail = (c: Cocktail, deck: Cocktail[]) => {
    setCocktailDeck(deck)
    setCocktailIdx(deck.findIndex((x) => x.id === c.id))
  }
  const openClassic = (c: Classic, deck: Classic[]) => {
    setClassicDeck(deck)
    setClassicIdx(deck.findIndex((x) => x.id === c.id))
  }
  // из панели семейств (mobile): закрыть панель, открыть классику в колоде «Все»
  // (плоско по FAMILIES-порядку — как в разделе «Все»)
  const openClassicFromPanel = (c: Classic) => {
    setFamiliesOpen(false)
    openClassic(c, FAMILIES.flatMap((fam) => CLASSICS.filter((x) => x.family === fam.tint)))
  }
  const openSpirit = (s: Spirit, cat: string, deck: { s: Spirit; cat: string }[]) => {
    setSpiritDeck(deck)
    setSpiritIdx(deck.findIndex((x) => x.s.name === s.name && x.cat === cat))
  }
  const openDish = (d: Dish, deck: Dish[]) => {
    setDishDeck(deck)
    setDishIdx(deck.findIndex((x) => x.id === d.id))
  }
  const cocktail = cocktailIdx >= 0 ? cocktailDeck[cocktailIdx] : null
  const classic = classicIdx >= 0 ? classicDeck[classicIdx] : null
  const spiritItem = spiritIdx >= 0 ? spiritDeck[spiritIdx] : null
  const spirit = spiritItem?.s ?? null
  const spiritCat = spiritItem?.cat ?? ""
  const spiritKey = spirit ? `${spiritCat}:${spirit.name}` : ""
  const dish = dishIdx >= 0 ? dishDeck[dishIdx] : null

  const view = (() => {
    switch (route) {
      case "menu":
        return (
          <MenuView
            learnedIds={learned}
            onToggle={toggle}
            onOpen={openCocktail}
            onOpenProgress={openProgress}
          />
        )
      case "classics":
        return (
          <ClassicsView
            learnedIds={learned}
            onToggle={toggle}
            onOpen={openClassic}
            // desktop — на страницу Прогресс (семейства в рейле); mobile — панель
            onOpenProgress={() => (isMobile ? setFamiliesOpen(true) : navigate("progress"))}
          />
        )
      case "spirits":
        return <SpiritsView learnedKeys={learned} onToggle={toggle} onOpen={openSpirit} onOpenProgress={openProgress} />
      case "kitchen":
        return <KitchenView learnedIds={learned} onToggle={toggle} onOpen={openDish} onOpenProgress={openProgress} />
      case "progress":
        return null // прогресс рендерит ProgressWithTeam (вкладки Мой/Команда)
      case "zero":
      case "zc":
        // Безалко/ZC — заглушка на паттерне спиритов (в этот раунд не входят)
        return <SpiritsView learnedKeys={learned} onToggle={toggle} onOpen={openSpirit} onOpenProgress={openProgress} />
      default:
        return null
    }
  })()

  // Прогресс на десктопе показывает вкладку «Команда» (3s ADMIN) рядом с «Мой»
  return (
    <>
      <PageFrame
        header={
          <>
            <CocktailDesktopHeader route={route} onNavigate={navigate} />
            <CocktailMobileHeader route={route} onNavigate={navigate} />
          </>
        }
        contentClassName="flex-col gap-4 p-6 pb-24 max-md:gap-3 max-md:px-4 max-md:py-4 max-md:pb-24"
      >
        {route === "progress" ? (
          <ProgressWithTeam learnedIds={learned} onOpenSection={(id) => navigate(id as Route)} />
        ) : (
          view
        )}
      </PageFrame>

      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <CocktailBottomNav route={route} onNavigate={navigate} />
      </div>

      <CocktailDetail
        cocktail={cocktail}
        open={cocktailIdx >= 0}
        onOpenChange={(o) => !o && setCocktailIdx(-1)}
        learned={cocktail ? learned.has(cocktail.id) : false}
        onLearnedChange={() => cocktail && toggle(cocktail.id)}
        nav={{
          index: cocktailIdx,
          of: cocktailDeck.length,
          prevLabel: cocktailDeck[cocktailIdx - 1]?.name,
          nextLabel: cocktailDeck[cocktailIdx + 1]?.name,
          onPrev: () => setCocktailIdx((i) => Math.max(0, i - 1)),
          onNext: () => setCocktailIdx((i) => Math.min(cocktailDeck.length - 1, i + 1)),
        }}
      />
      <ClassicDetail
        classic={classic}
        open={classicIdx >= 0}
        onOpenChange={(o) => !o && setClassicIdx(-1)}
        learned={classic ? learned.has(classic.id) : false}
        onLearnedChange={() => classic && toggle(classic.id)}
        nav={{
          index: classicIdx,
          of: classicDeck.length,
          prevLabel: classicDeck[classicIdx - 1]?.name,
          nextLabel: classicDeck[classicIdx + 1]?.name,
          onPrev: () => setClassicIdx((i) => Math.max(0, i - 1)),
          onNext: () => setClassicIdx((i) => Math.min(classicDeck.length - 1, i + 1)),
          group: groupRun(classicDeck.map((c) => c.family.toUpperCase()), classicIdx),
        }}
        onCrossLink={(menuId) => {
          // «Наш ответ» → открыть авторский коктейль меню по id (закрывает
          // шит классики); в демо-каталоге твист может отсутствовать — тогда
          // просто закрываем (в проде twists живут в Меню)
          setClassicIdx(-1)
          const match = menuId ? MENU.find((c) => c.id === menuId) : undefined
          if (match) openCocktail(match, MENU)
        }}
      />
      <SpiritDetail
        spirit={spirit}
        category={spiritCat}
        open={spiritIdx >= 0}
        onOpenChange={(o) => !o && setSpiritIdx(-1)}
        learned={spirit ? learned.has(spiritKey) : false}
        onLearnedChange={() => spirit && toggle(spiritKey)}
        nav={{
          index: spiritIdx,
          of: spiritDeck.length,
          prevLabel: spiritDeck[spiritIdx - 1]?.s.name,
          nextLabel: spiritDeck[spiritIdx + 1]?.s.name,
          onPrev: () => setSpiritIdx((i) => Math.max(0, i - 1)),
          onNext: () => setSpiritIdx((i) => Math.min(spiritDeck.length - 1, i + 1)),
          group: groupRun(spiritDeck.map((d) => d.cat), spiritIdx),
        }}
      />
      <DishDetail
        dish={dish}
        open={dishIdx >= 0}
        onOpenChange={(o) => !o && setDishIdx(-1)}
        learned={dish ? learned.has(dish.id) : false}
        onLearnedChange={() => dish && toggle(dish.id)}
        nav={{
          index: dishIdx,
          of: dishDeck.length,
          prevLabel: dishDeck[dishIdx - 1]?.name,
          nextLabel: dishDeck[dishIdx + 1]?.name,
          onPrev: () => setDishIdx((i) => Math.max(0, i - 1)),
          onNext: () => setDishIdx((i) => Math.min(dishDeck.length - 1, i + 1)),
          group: groupRun(dishDeck.map((d) => d.category), dishIdx),
        }}
      />
      <FamiliesPanel
        open={familiesOpen}
        onOpenChange={setFamiliesOpen}
        learnedIds={learned}
        onOpenClassic={openClassicFromPanel}
      />
    </>
  )
}

/** Прогресс: «Мой» (личный §44) / «Команда» (3s ADMIN) — таб-переключатель */
function ProgressWithTeam({ learnedIds, onOpenSection }: { learnedIds: Set<string>; onOpenSection: (id: SectionId) => void }) {
  const [tab, setTab] = React.useState<"my" | "team">("my")
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5 max-md:w-full">
        <span className="text-[22px] font-bold max-md:hidden">Прогресс</span>
        <div className="flex overflow-hidden rounded-md border border-border text-[13px] font-semibold max-md:w-full">
          <button
            type="button"
            onClick={() => setTab("my")}
            className={cn("px-3.5 py-[7px] max-md:min-h-11 max-md:flex-1", tab === "my" ? "bg-primary text-primary-foreground" : "cursor-pointer")}
          >
            Мой
          </button>
          <button
            type="button"
            onClick={() => setTab("team")}
            className={cn("inline-flex items-center justify-center gap-1.5 border-l border-border px-3.5 py-[7px] max-md:min-h-11 max-md:flex-1", tab === "team" ? "bg-primary text-primary-foreground" : "cursor-pointer")}
          >
            Команда
            <span className={cn("rounded-[4px] px-1.5 py-px font-mono text-[8.5px] font-bold", tab === "team" ? "bg-card text-foreground" : "bg-muted")}>
              ADMIN
            </span>
          </button>
        </div>
        </div>
        <span className="font-mono text-[11px] text-[#71717A] max-md:hidden">
          {TOTAL_POSITIONS} ПОЗИЦИЙ В БАЗЕ · {SECTIONS.length} РАЗДЕЛОВ
        </span>
      </div>
      {tab === "my" ? <ProgressView learnedIds={learnedIds} onOpenSection={onOpenSection} /> : <TeamView />}
    </div>
  )
}
