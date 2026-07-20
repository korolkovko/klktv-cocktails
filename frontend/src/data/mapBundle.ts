// Pure adapter: `bundle` (GET /api/content, shaped per bundle.ts) → the
// kit's data shapes (frontend/src/pages/cocktail-guide/data.ts). No
// fetching, no side effects — Task 4 wires this into a ContentContext.
//
// Global rule (blueprint §B/§C): every mapped item's `learned` is set to
// `false` (Section/Family `learned` to `0`). This is load-bearing, not a
// placeholder — see §C's "static-baseline trick": with every static
// baseline zeroed, `reconcile(catalog, items, learnedIds)` collapses to a
// pure count over the real per-user learned-Set from
// GET /api/me/progress.
//
// Field maps below follow blueprint §B: everything the blueprint marks
// "passthrough" is assigned unchanged when the backend and kit types
// already line up (both non-null, or both optional). Where the backend
// allows `null` (nearly every content column) but the kit type is a
// non-optional `string`/`number`, a `?? ""` / `?? 0` fallback is applied
// (mirroring the `?? 0` the blueprint spells out for Cocktail's
// price/volume/abv); where the kit field is optional, `?? undefined`
// normalizes `null` → `undefined` so the kit's own `field && <UI/>`
// truthiness gates behave identically either way. This is required for
// `tsc` to accept the mapping at all (this repo's TS config type-checks
// `null` strictly against `undefined`) — which is the compile-time
// verification this task is designed to exercise.

import type {
  Cocktail,
  Classic,
  Family,
  SpiritGroup,
  Spirit,
  Dish,
  DishNutrition,
  KitchenCategory,
  Section,
  SectionId,
  TintName,
  MenuBadge,
} from "@/pages/cocktail-guide/data"
import type {
  ContentBundle,
  DishNutritionOut,
  SpiritEntryOut,
  KitchenDishOut,
} from "./bundle"

/**
 * TASK 5 GAP: the kit's `Cocktail` type (data.ts) does not yet declare
 * `isAlcoholic` / `isZeroCulture` / `caffeineLevel` / `isCarbonated` — the
 * backend already emits all four (`DrinkOut`), and the kit type is meant
 * to be extended to read them in Task 5. Rather than edit data.ts here
 * (out of scope for this task) or silently drop the fields, this adapter
 * produces them via this local extended type. `MappedCocktail` is a
 * strict superset of `Cocktail`, so once Task 5 lands the kit's own
 * `Cocktail` type gains these fields, `mapCocktail`'s return type can be
 * narrowed back to plain `Cocktail` with no change to the mapping logic.
 */
export type MappedCocktail = Cocktail & {
  isAlcoholic: boolean
  isZeroCulture: boolean
  caffeineLevel?: number
  isCarbonated?: boolean
}

export interface KitData {
  MENU: MappedCocktail[]
  CLASSICS: Classic[]
  FAMILIES: Family[]
  SPIRIT_GROUPS: SpiritGroup[]
  /** Groups built from archived spirit categories only — Task 7 (retired
   *  spirits tab) reads this instead of re-deriving it from SPIRIT_GROUPS. */
  SPIRIT_GROUPS_ARCHIVED: SpiritGroup[]
  DISHES: Dish[]
  KITCHEN_CATEGORIES: KitchenCategory[]
  SECTIONS: Section[]
  SPIRIT_FILTERS: string[]
  GLASS_FILTERS: string[]
  CLASSIC_SPIRITS: string[]
  SPIRIT_CATEGORIES: string[]
  TOTAL_POSITIONS: number
  RETIRED_COUNT: number
  CLASSICS_TOTAL: number
}

function mapCocktail(d: ContentBundle["drinks"][number]): MappedCocktail {
  return {
    id: d.id,
    name: d.name,
    logo: d.logo ?? "",
    subtitle: d.subtitle ?? "",
    price: d.price ?? 0,
    volume: d.volume ?? 0,
    abv: d.abv ?? 0,
    spirit: d.spirit,
    spirits: d.spirits,
    glass: d.glass,
    descriptors: d.descriptors,
    // Backend already emits "HOT"/"BOTTLED"/"PREMIUM"/"ONESIP" — direct
    // cast, no transform (blueprint §B).
    badge: (d.badge ?? undefined) as MenuBadge | undefined,
    learned: false,
    recipe: d.recipe ?? undefined,
    garnish: d.garnish ?? undefined,
    pitch: d.pitch ?? undefined,
    photo: d.photo ?? undefined,
    about: d.about ?? undefined,
    naming: d.naming ?? undefined,
    faq: d.faq ?? undefined,
    isAlcoholic: d.isAlcoholic,
    isZeroCulture: d.isZeroCulture,
    caffeineLevel: d.caffeineLevel ?? undefined,
    isCarbonated: d.isCarbonated ?? undefined,
  }
}

function mapClassic(c: ContentBundle["classics"][number]): Classic {
  return {
    id: c.id,
    name: c.name,
    year: c.year ?? "",
    city: c.city ?? "",
    family: c.family as TintName,
    spirit: c.spirit,
    glass: c.glass,
    descriptors: c.descriptors,
    learned: false,
    recipe: c.recipe ?? "",
    garnish: c.garnish ?? "",
    history: c.history ?? "",
    fits: c.fits ?? "",
    ourAnswers: c.ourAnswers.map((a) => ({ label: a.label, menuId: a.menuId ?? undefined })),
  }
}

function mapFamily(f: ContentBundle["families"][number]): Family {
  return {
    tint: f.tint as TintName,
    code: f.code,
    title: f.title,
    logic: f.logic ?? "",
    evolution: f.evolution ?? undefined,
    tip: f.tip ?? undefined,
    learned: 0,
    total: f.total,
  }
}

/** kit's bespoke display string, e.g. "ЛОНДОН ДРАЙ · 43.1%" — no single
 *  backend column produces this; synthesize a fallback from what we have
 *  (blueprint §B, flagged as a known gap since phase-1a). */
function spiritMeta(country: string | null, abv: number): string {
  return [country ?? undefined, `${abv}% ABV`].filter(Boolean).join(" · ").toUpperCase()
}

function mapSpirit(s: SpiritEntryOut): Spirit {
  const abv = s.abv ?? 0
  return {
    name: s.name,
    meta: spiritMeta(s.country, abv),
    learned: false,
    abv,
    country: s.country ?? undefined,
    // NO backend column — degrades gracefully (SpiritDetail shows country only).
    region: undefined,
    flavour: s.flavour ?? undefined,
    brand: s.brand ?? undefined,
    brandDetail: s.brandDetail ?? undefined,
    features: s.features ?? undefined,
    pairings: s.pairings ?? undefined,
    fact: s.fact ?? undefined,
    sourceUrl: s.sourceUrl ?? undefined,
    img: s.img ?? undefined,
  }
}

/** Group flat `bundle.spirits` by `categorySlug`, ordered per
 *  `bundle.spiritCategories`. `wantArchived` picks the "В карте"
 *  (non-archived) vs. "Выведенные" (archived) split. */
function buildSpiritGroups(bundle: ContentBundle, wantArchived: boolean): SpiritGroup[] {
  return bundle.spiritCategories
    .filter((c) => c.isArchived === wantArchived)
    .map((cat) => {
      const items = bundle.spirits.filter((s) => s.categorySlug === cat.slug).map(mapSpirit)
      return { category: cat.label, total: items.length, items }
    })
}

/** kit's `Dish.nutrition` is gated on plain truthiness — `KitchenDishOut`'s
 *  `nutrition` is *always* present on the wire (a `DishNutritionOut()`
 *  all-null default), so this must map to `undefined` explicitly when
 *  every macro is null, or every dish would render an empty КБЖУ grid of
 *  zeros (blueprint §B). */
function mapNutrition(n: DishNutritionOut): DishNutrition | undefined {
  if (n.kcal == null && n.protein == null && n.fat == null && n.carb == null) return undefined
  return { kcal: n.kcal ?? 0, protein: n.protein ?? 0, fat: n.fat ?? 0, carb: n.carb ?? 0 }
}

function mapDish(k: KitchenDishOut, categoryLabelBySlug: Map<string, string>): Dish {
  return {
    id: k.id,
    name: k.name,
    // kit's `category` is a display code used both for grouping and
    // equality (`d.category === course.code`) — map to the category's
    // label, not its slug (blueprint §B).
    category: categoryLabelBySlug.get(k.categorySlug) ?? k.categorySlug,
    subtitle: k.subtitle ?? "",
    price: k.price ?? 0,
    weight: k.weight ?? 0,
    timing: k.timing ?? 0,
    learned: false,
    photo: k.photo ?? undefined,
    description: k.description ?? undefined,
    serving: k.serving ?? undefined,
    fact: k.fact ?? undefined,
    // NO backend field — degrades gracefully (section conditionally rendered).
    allergens: undefined,
    nutrition: mapNutrition(k.nutrition),
  }
}

export function mapBundle(bundle: ContentBundle): KitData {
  const kitchenCategoryLabelBySlug = new Map(bundle.kitchenCategories.map((c) => [c.slug, c.label]))
  const archivedSpiritSlugs = new Set(
    bundle.spiritCategories.filter((c) => c.isArchived).map((c) => c.slug),
  )

  const MENU = bundle.drinks.map(mapCocktail)
  const CLASSICS = bundle.classics.map(mapClassic)
  const FAMILIES = bundle.families.map(mapFamily)
  const SPIRIT_GROUPS = buildSpiritGroups(bundle, false)
  const SPIRIT_GROUPS_ARCHIVED = buildSpiritGroups(bundle, true)
  const DISHES = bundle.kitchen.map((k) => mapDish(k, kitchenCategoryLabelBySlug))
  const KITCHEN_CATEGORIES: KitchenCategory[] = bundle.kitchenCategories.map((kc) => ({
    code: kc.label,
    total: bundle.kitchen.filter((k) => k.categorySlug === kc.slug).length,
  }))
  const SECTIONS: Section[] = bundle.sections.map((s) => ({
    id: s.id as SectionId,
    label: s.label,
    total: s.total,
    learned: 0,
  }))

  const SPIRIT_FILTERS = ["Все", ...bundle.filters.spirits]
  const GLASS_FILTERS = ["Все", ...bundle.filters.glasses]
  const CLASSIC_SPIRITS = ["Все", ...bundle.filters.classicSpirits]
  const SPIRIT_CATEGORIES = [
    "Все",
    ...bundle.spiritCategories.filter((c) => !c.isArchived).map((c) => c.label),
  ]

  const TOTAL_POSITIONS = bundle.sections.reduce((sum, s) => sum + s.total, 0)
  const RETIRED_COUNT = bundle.spirits.filter((s) => archivedSpiritSlugs.has(s.categorySlug)).length
  const CLASSICS_TOTAL = bundle.sections.find((s) => s.id === "classics")?.total ?? 0

  return {
    MENU,
    CLASSICS,
    FAMILIES,
    SPIRIT_GROUPS,
    SPIRIT_GROUPS_ARCHIVED,
    DISHES,
    KITCHEN_CATEGORIES,
    SECTIONS,
    SPIRIT_FILTERS,
    GLASS_FILTERS,
    CLASSIC_SPIRITS,
    SPIRIT_CATEGORIES,
    TOTAL_POSITIONS,
    RETIRED_COUNT,
    CLASSICS_TOTAL,
  }
}
