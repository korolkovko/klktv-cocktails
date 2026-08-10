// Справочник коктейлей (Pages 3n–3t) — типы кита + live-прогресс хелперы.
//
// Task 4: демо-данные (export const массивы/скаляры) отсюда УДАЛЕНЫ — реальные
// приезжают через ContentContext/useContent() (src/data/ContentContext.tsx),
// который прогоняет GET /api/content через mapBundle(). Здесь остаются только
// export interface/type (форма данных, которую кит ожидает) и чистые
// live-прогресс функции ниже — им теперь передаётся каталог явным параметром
// (`LiveCatalog`), а не через module-scope константы (те исчезли).
//
// TEAM/TEAM_STATS/TEAM_AVG_SECTIONS/KITCHEN_LEARNED — для командного
// прогресса нет бэкенд-эндпоинта вообще (см. blueprint §F/§E.10). Task 9
// убрал «Команда»-таб и TeamView из рендера (page.tsx всегда показывает
// личный «Мой»); эти демо-константы и TeamView остаются нетронутыми в
// data.ts/team-view.tsx как мёртвый код на случай, если бэкенд появится.

export type TintName =
  | "sour" | "daisy" | "mary" | "negroni" | "martini"
  | "manhattan" | "highball" | "spritz" | "dessert"

/* ---------- разделы (навигация + прогресс) ---------- */

export type SectionId = "menu" | "classics" | "spirits" | "kitchen"

export interface Section {
  id: SectionId
  label: string
  /** primary — в bottom-nav; иначе только в sheet «Разделы» */
  total: number
  learned: number
}

/* ---------- 3n Меню: авторские коктейли (media-card) ---------- */

export type MenuBadge = "HOT" | "BOTTLED" | "PREMIUM" | "ONESIP"

/** Task B4: категория авторского напитка (§54 admin «Категории напитков») —
 *  Авторские группируются в секции по ней, как Кухня группируется по
 *  KitchenCategory; порядок = порядок drinkCategories в бандле (бэкенд
 *  уже сортирует по sort_order). */
export interface DrinkCategory {
  slug: string
  label: string
}

export interface Cocktail {
  id: string
  /** slug категории (группировка в MenuView секциями — см. DrinkCategory) */
  categorySlug: string
  name: string
  logo: string
  subtitle: string
  /** авторские в проде без цены/объёма — опциональны, в детали не показываем 0 */
  price?: number
  volume?: number
  /** ABV не записан у части авторских (напр. Undressed Negroni) — undefined,
   *  а не 0: алкогольный коктейль без ABV прячет чип, не показывает «0% ABV» */
  abv?: number
  spirit: string
  /** крепкие компоненты для strong-чипов детали; дефолт [spirit] */
  spirits?: string[]
  glass: string
  /** тип льда (лейбл словаря, напр. «Большой куб»); нет данных — деталь без строки «Лёд» */
  ice?: string
  descriptors: string[]
  badge?: MenuBadge
  learned: boolean
  /** Task 5: alc/non-alc merge — Безалко/Zero Culture слиты в Авторские;
   *  isAlcoholic гейтит фильтр «ТИП» + «0%»-бейдж/деталь; остальные два
   *  зарезервированы под §E.5 follow-up (кофеин-метр/газация в детали) */
  isAlcoholic: boolean
  isZeroCulture: boolean
  /** Task A7: бэкенд смигрировал старый badge==="HOT" в это поле — красный
   *  HOT-чип у карточки/детали теперь гейтится isHot, не строкой badge */
  isHot: boolean
  caffeineLevel: number | null
  isCarbonated: boolean | null
  /** деталь (3p) — все секции опциональны, рендерятся если заполнены */
  recipe?: string
  garnish?: string
  pitch?: string
  /** фото напитка 4:3 (url); нет — блок отсутствует, без плейсхолдера */
  photo?: string
  about?: string
  naming?: string
  faq?: string
  /** свободные story-блоки (label+text) из прод-деталей — здесь живёт вся
   *  сюжетная проза авторских (О коктейле / Отсылки / Про этикетку / …) */
  details?: { label: string; text: string }[]
}

/* ---------- 3o Классика: семейства (taxonomy tints) + позиции ---------- */

export interface Family {
  tint: TintName
  code: string
  title: string
  logic: string
  tip?: string
  evolution?: string
  learned: number
  total: number
}

export interface Classic {
  id: string
  name: string
  year: string
  city: string
  family: TintName
  spirit: string
  glass: string
  descriptors: string[]
  learned: boolean
  /** деталь (3p) */
  recipe: string
  garnish: string
  history: string
  fits: string
  /** «Наш ответ» — кросс-линки: label + опц. id позиции меню (в проде твисты
   *  живут в Меню; в демо-каталоге из 8 позиций их может не быть) */
  ourAnswers?: { label: string; menuId?: string }[]
}

/* ---------- 3r Спириты: группы по категориям + «Выведенные» ---------- */

export interface Spirit {
  name: string
  /** строка-подпись в списке: «ЛОНДОН ДРАЙ · 43.1%» */
  meta: string
  learned: boolean
  /** ABV для шапки детали «КАТЕГОРИЯ · СТРАНА · NN% ABV» */
  abv: number
  /** цена за порцию (₽) + объём порции (мл) — старая карта/шит показывали цену */
  price?: number
  serving?: number
  /** деталь (канон флеш-карточек R25) — все секции опциональны */
  country?: string
  /** регион (desktop-шапка «СТРАНА, РЕГИОН»); mobile — только country */
  region?: string
  flavour?: string
  brand?: string
  /** ПОДРОБНО ПРО БРЕНД (длинный) */
  brandDetail?: string
  /** ОСОБЕННОСТИ (desktop) */
  features?: string
  /** В КОКТЕЙЛЯХ */
  pairings?: string
  /** ФАКТ — butter-плашка в языке TIP */
  fact?: string
  /** ИСТОЧНИК — mono-ссылка ↗ (без протокола) */
  sourceUrl?: string
  /** фото бутылки (fit contain); нет — блока нет (R25) */
  img?: string
}

export interface SpiritGroup {
  category: string
  total: number
  items: Spirit[]
}

/* ---------- 3t Кухня: блюда курсами (фото = айдентика §45) ---------- */

export interface DishNutrition {
  kcal: number
  protein: number
  fat: number
  carb: number
  /** ккал на 100 г (старый шит показывал и «на порцию», и «на 100 г») */
  kcal100?: number
}

export interface Dish {
  id: string
  name: string
  /** курс (код категории «ОСНОВНЫЕ») */
  category: string
  subtitle: string
  /** прод-блюда бывают без цены/веса/тайминга — опциональны; чип не рендерим
   *  при отсутствии (иначе «0 ₽ · 0 МИН») */
  price?: number
  weight?: number
  timing?: number
  learned: boolean
  /** фото блюда 4:3; в детали нет — блока нет (R25); в списке — тамб-плейсхолдер */
  photo?: string
  description?: string
  serving?: string
  /** ФАКТ — butter-плашка */
  fact?: string
  /** АЛЛЕРГЕНЫ / СТОП — частый вопрос гостя; нет данных — не рендерится */
  allergens?: string
  /** КБЖУ мини-гридом §40 (структурой, не текстом) */
  nutrition?: DishNutrition
}

export interface KitchenCategory {
  code: string
  total: number
}

// прогресс кухни — сводка каталога демо-версии (не источник правды в проде;
// сохранён т.к. нет бэкенд-замены и задача его не трогает, см. header note)
export const KITCHEN_LEARNED = 18

/* ---------- 3s Прогресс команды — виден ВСЕМ (было ADMIN) ---------- */
// Wired to GET /api/team (backend/app/routers/team.py) через useTeam()
// (src/data/team.ts). Разделы zero/zc больше не существуют (слиты в menu),
// поэтому sections — 4 реальных вида. Демо-константы (TEAM/TEAM_STATS/
// TEAM_AVG_SECTIONS) удалены — данные приходят живыми; здесь только формы.

export type TeamKind = "menu" | "classics" | "spirits" | "kitchen"

export interface Staff {
  initials: string
  name: string
  role: string
  overall: number
  sections: Record<TeamKind, number>
  /** ПОСЛЕДНЯЯ АКТИВНОСТЬ — по последней отметке «знаю» (max learned_at).
   *  activity — короткая (desktop-колонка «АКТИВНОСТЬ»), lastSeen — полная. */
  activity: string
  lastSeen: string
  activityAlarm?: boolean
  /** ПОСЛЕДНИЙ ВИЗИТ — по last_seen_at (обновляется на каждом запросе с
   *  валидной сессией). lastVisit — короткая (desktop-колонка «ПОСЛ. ВИЗИТ»),
   *  lastVisitLong — полная (mobile). */
  lastVisit: string
  lastVisitLong: string
  lastVisitAlarm?: boolean
  /** слабейший раздел (mobile-карточка) */
  weak?: string
  strongNote?: string
  admin?: boolean
}

export interface TeamStats {
  avg: number
  fullMenu: number
  fullMenuNames: string[]
  behind: number
  behindNames: string[]
  active: number
  activeNote: string
  staffCount: number
}

export interface TeamData {
  staff: Staff[]
  stats: TeamStats
  avgSections: Record<TeamKind, number>
  positions: number
}

/* ---------- LIVE-прогресс (R27): «static − staticLearned(scope) + live(scope)»
 *  — сводка каталога примиряется с тоглами реальных позиций. С Task 4
 *  каталог (SECTIONS/MENU/CLASSICS/FAMILIES/SPIRIT_GROUPS/DISHES) больше не
 *  module-scope константа — он приходит из ContentContext (useContent()) в
 *  вызывающем компоненте, поэтому передаётся сюда явным параметром `cat`.
 *  Сама формула не изменилась: catalog − staticLearned(items) + liveLearned;
 *  с adapter'ным `learned: false/0` (blueprint §C) она схлопывается в чистый
 *  счёт по реальному learnedIds. ---------- */

interface LiveCatalog {
  SECTIONS: Section[]
  MENU: Cocktail[]
  CLASSICS: Classic[]
  FAMILIES: Family[]
  SPIRIT_GROUPS: SpiritGroup[]
  DISHES: Dish[]
}

/** реконсиляция: catalog − статик-learned + live-learned по ключам scope */
function reconcile(catalog: number, items: { learned: boolean; key: string }[], learnedIds: Set<string>) {
  return catalog - items.filter((i) => i.learned).length + items.filter((i) => learnedIds.has(i.key)).length
}

/** live learned классики целиком (= стрипу раздела) */
export function classicsLearnedLive(cat: LiveCatalog, learnedIds: Set<string>) {
  const sec = cat.SECTIONS.find((s) => s.id === "classics")!
  return reconcile(sec.learned, cat.CLASSICS.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
}

/** live learned внутри семейства (для баров панели и счёта «5/6 ✓» шапки группы) */
export function familyLearnedLive(tint: TintName, cat: LiveCatalog, learnedIds: Set<string>) {
  const fam = cat.FAMILIES.find((f) => f.tint === tint)!
  const inFam = cat.CLASSICS.filter((c) => c.family === tint)
  return reconcile(fam.learned, inFam.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
}

/** live learned раздела (карточки страницы Прогресс); zero/zc — нет реальных позиций (backend их не эмитит) */
export function sectionLearnedLive(id: SectionId, cat: LiveCatalog, learnedIds: Set<string>) {
  const sec = cat.SECTIONS.find((s) => s.id === id)!
  switch (id) {
    case "menu":
      return reconcile(sec.learned, cat.MENU.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
    case "classics":
      return reconcile(sec.learned, cat.CLASSICS.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
    case "spirits":
      return reconcile(sec.learned, cat.SPIRIT_GROUPS.flatMap((g) => g.items.map((s) => ({ learned: s.learned, key: `${g.category}:${s.name}` }))), learnedIds)
    case "kitchen":
      return reconcile(sec.learned, cat.DISHES.map((d) => ({ learned: d.learned, key: d.id })), learnedIds)
    default:
      return sec.learned
  }
}

/** live итог по всем разделам (ProgressTotal) */
export function totalLearnedLive(cat: LiveCatalog, learnedIds: Set<string>) {
  return cat.SECTIONS.reduce((a, s) => a + sectionLearnedLive(s.id, cat, learnedIds), 0)
}
