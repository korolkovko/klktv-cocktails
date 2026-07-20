// TS mirror of the backend's GET /api/content response
// (backend/app/schemas.py's `ContentBundleOut` and friends). Field names
// match the wire JSON exactly — the backend already serializes camelCase,
// so these interfaces are a 1:1 transcription of the Pydantic `*Out`
// models, not a re-shaping. Keep this file in sync with schemas.py.
//
// Everything nullable on the backend (`str | None = None` etc.) is typed
// `T | null` here (not `T | undefined`) to mirror what `fetch().json()`
// actually produces on the wire.

export interface DrinkOut {
  id: string
  name: string
  logo: string | null
  subtitle: string | null
  price: number | null
  volume: number | null
  abv: number | null
  spirit: string
  spirits: string[]
  glass: string
  descriptors: string[]
  badge: string | null
  recipe: string | null
  garnish: string | null
  pitch: string | null
  photo: string | null
  about: string | null
  naming: string | null
  faq: string | null
  isAlcoholic: boolean
  isZeroCulture: boolean
  caffeineLevel: number | null
  isCarbonated: boolean | null
  details: { label: string; text: string }[]
}

export interface OurAnswerOut {
  label: string
  menuId: string | null
}

export interface ClassicOut {
  id: string
  name: string
  year: string | null
  city: string | null
  family: string
  spirit: string
  glass: string
  descriptors: string[]
  recipe: string | null
  garnish: string | null
  history: string | null
  fits: string | null
  ourAnswers: OurAnswerOut[]
}

export interface FamilyOut {
  tint: string
  code: string
  title: string
  logic: string | null
  evolution: string | null
  tip: string | null
  total: number
}

export interface SpiritEntryOut {
  slug: string
  categorySlug: string
  name: string
  img: string | null
  abv: number | null
  country: string | null
  flavour: string | null
  brand: string | null
  brandDetail: string | null
  features: string | null
  pairings: string | null
  fact: string | null
  sourceUrl: string | null
}

export interface SpiritCategoryOut {
  slug: string
  label: string
  isArchived: boolean
}

export interface DishNutritionOut {
  kcal: number | null
  protein: number | null
  fat: number | null
  carb: number | null
}

export interface KitchenDishOut {
  id: string
  categorySlug: string
  name: string
  subtitle: string | null
  price: number | null
  weight: number | null
  timing: number | null
  photo: string | null
  description: string | null
  serving: string | null
  fact: string | null
  nutrition: DishNutritionOut
}

export interface KitchenCategoryOut {
  slug: string
  label: string
}

export interface SectionOut {
  id: string
  label: string
  total: number
}

export interface FiltersOut {
  spirits: string[]
  glasses: string[]
  classicSpirits: string[]
}

export interface ContentBundleOut {
  sections: SectionOut[]
  drinks: DrinkOut[]
  classics: ClassicOut[]
  families: FamilyOut[]
  spiritCategories: SpiritCategoryOut[]
  spirits: SpiritEntryOut[]
  kitchenCategories: KitchenCategoryOut[]
  kitchen: KitchenDishOut[]
  filters: FiltersOut
}

/** Alias matching the name used by `spiritKeys.ts`/`mapBundle.ts` and the
 *  blueprint's pseudo-code — same shape as `ContentBundleOut`. */
export type ContentBundle = ContentBundleOut
