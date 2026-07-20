// Справочник коктейлей (Pages 3n–3t) — типы кита + live-прогресс хелперы.
//
// Task 4: демо-данные (export const массивы/скаляры) отсюда УДАЛЕНЫ — реальные
// приезжают через ContentContext/useContent() (src/data/ContentContext.tsx),
// который прогоняет GET /api/content через mapBundle(). Здесь остаются только
// export interface/type (форма данных, которую кит ожидает) и чистые
// live-прогресс функции ниже — им теперь передаётся каталог явным параметром
// (`LiveCatalog`), а не через module-scope константы (те исчезли).
//
// TEAM/TEAM_STATS/TEAM_AVG_SECTIONS/KITCHEN_LEARNED — НЕ трогаем в этой
// задаче: для командного прогресса нет бэкенд-эндпоинта вообще (см. blueprint
// §F/§E.10); удаление/скрытие «Команда»-таба — отдельная задача.

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

export interface Cocktail {
  id: string
  name: string
  logo: string
  subtitle: string
  price: number
  volume: number
  abv: number
  spirit: string
  /** крепкие компоненты для strong-чипов детали; дефолт [spirit] */
  spirits?: string[]
  glass: string
  descriptors: string[]
  badge?: MenuBadge
  learned: boolean
  /** Task 5: alc/non-alc merge — Безалко/Zero Culture слиты в Авторские;
   *  isAlcoholic гейтит фильтр «ТИП» + «0%»-бейдж/деталь; остальные два
   *  зарезервированы под §E.5 follow-up (кофеин-метр/газация в детали) */
  isAlcoholic: boolean
  isZeroCulture: boolean
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
}

export interface Dish {
  id: string
  name: string
  /** курс (код категории «ОСНОВНЫЕ») */
  category: string
  subtitle: string
  price: number
  weight: number
  timing: number
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

/* ---------- 3s Прогресс команды (ADMIN) ---------- */

export interface Staff {
  initials: string
  name: string
  role: string
  overall: number
  sections: { menu: number; classics: number; spirits: number; kitchen: number; zero: number; zc: number }
  /** короткая — desktop-колонка АКТИВНОСТЬ */
  activity: string
  /** полная строка с родом — mobile-карточка («БЫЛ СЕГОДНЯ» / «БЫЛА ВЧЕРА») */
  lastSeen: string
  activityAlarm?: boolean
  /** слабейший раздел (mobile-карточка) */
  weak?: string
  strongNote?: string
  admin?: boolean
}

// TEAM/TEAM_STATS/TEAM_AVG_SECTIONS — 100% демо (нет бэкенда для командного
// прогресса, blueprint §F); намеренно НЕ конвертированы в Task 4 — команда-таб
// либо получит реальный источник, либо будет скрыт отдельной задачей (§E.10).
export const TEAM: Staff[] = [
  { initials: "ДК", name: "Дэн", role: "СТАЖЁР · С 07-01", overall: 12, sections: { menu: 26, classics: 4, spirits: 10, kitchen: 16, zero: 17, zc: 6 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛ СЕГОДНЯ", weak: "КЛАССИКА 4%" },
  { initials: "СВ", name: "Стас", role: "БАР", overall: 28, sections: { menu: 43, classics: 30, spirits: 15, kitchen: 26, zero: 33, zc: 25 }, activity: "12 ДН", lastSeen: "БЫЛ 12 ДН НАЗАД", activityAlarm: true, weak: "СПИРИТЫ 15%" },
  { initials: "РГ", name: "Рита", role: "EDITOR · БАР", overall: 45, sections: { menu: 61, classics: 38, spirits: 52, kitchen: 22, zero: 58, zc: 44 }, activity: "ВЧЕРА", lastSeen: "БЫЛА ВЧЕРА", weak: "КУХНЯ 22%" },
  { initials: "МШ", name: "Марк", role: "БАР", overall: 58, sections: { menu: 78, classics: 45, spirits: 67, kitchen: 48, zero: 66, zc: 56 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛ СЕГОДНЯ", weak: "КЛАССИКА 45%" },
  { initials: "КР", name: "Кира", role: "БАР", overall: 64, sections: { menu: 100, classics: 51, spirits: 70, kitchen: 55, zero: 75, zc: 63 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛА СЕГОДНЯ", weak: "КЛАССИКА 51%" },
  { initials: "ОЛ", name: "Оля", role: "БАР · СТАРШАЯ", overall: 71, sections: { menu: 100, classics: 62, spirits: 74, kitchen: 68, zero: 83, zc: 50 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛА СЕГОДНЯ", weak: "ZC 50%" },
  { initials: "МК", name: "Майкл", role: "ADMIN", overall: 92, sections: { menu: 100, classics: 88, spirits: 95, kitchen: 72, zero: 100, zc: 100 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛ СЕГОДНЯ", strongNote: "ВСЁ ≥80% КРОМЕ КУХНИ", admin: true },
]

export const TEAM_STATS = {
  avg: 53,
  avgDeltaPp: 6,
  fullMenu: 3,
  fullMenuNames: ["ОЛЯ", "КИРА", "МАЙКЛ"],
  behind: 2,
  behindNames: ["СТАС", "ДЭН"],
  active: 6,
  activeNote: "СТАС — 12 ДН НАЗАД",
  staffCount: 7,
}

/** TEAM AVG по разделам (butter-подвал таблицы) */
export const TEAM_AVG_SECTIONS = { menu: 73, classics: 45, spirits: 55, kitchen: 44, zero: 62, zc: 49 }

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
