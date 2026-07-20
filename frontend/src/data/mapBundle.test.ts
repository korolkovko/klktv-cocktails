import { describe, expect, it } from "vitest"
import { mapBundle } from "./mapBundle"
import type { ContentBundle } from "./bundle"

// Hand-built minimal bundle covering: one alcoholic + one non-alcoholic
// drink, one classic with ourAnswers, two spirits in one category (plus
// one archived category with one spirit), one dish with nutrition + one
// dish with all-null macros.
const bundle: ContentBundle = {
  sections: [
    { id: "menu", label: "Авторские", total: 2 },
    { id: "classics", label: "Классика", total: 1 },
    { id: "spirits", label: "Спириты", total: 3 },
    { id: "kitchen", label: "Кухня", total: 2 },
  ],
  drinks: [
    {
      id: "pussy-power",
      name: "Пусси Пауэр",
      logo: "/cocktails/pussy-power.webp",
      subtitle: "Джин-тоник, который передумал",
      price: 650,
      volume: 240,
      abv: 12,
      spirit: "Джин",
      spirits: ["Джин"],
      glass: "Хайбол",
      descriptors: ["ДЖИН", "ЦИТРУС"],
      badge: "HOT",
      recipe: "Джин, кордиал юдзу-имбирь.",
      garnish: "Ветка розмарина",
      pitch: null,
      photo: null,
      about: null,
      naming: null,
      faq: null,
      isAlcoholic: true,
      isZeroCulture: false,
      caffeineLevel: null,
      isCarbonated: true,
    },
    {
      id: "virgin-mule",
      name: "Вёрджин Мул",
      logo: "/cocktails/virgin-mule.webp",
      subtitle: "Безалкогольный мул",
      price: 390,
      volume: 260,
      abv: null,
      spirit: "",
      spirits: [],
      glass: "Хайбол",
      descriptors: ["БЕЗАЛКО", "ИМБИРЬ"],
      badge: null,
      recipe: null,
      garnish: null,
      pitch: null,
      photo: null,
      about: null,
      naming: null,
      faq: null,
      isAlcoholic: false,
      isZeroCulture: true,
      caffeineLevel: 0,
      isCarbonated: true,
    },
  ],
  classics: [
    {
      id: "negroni",
      name: "Негрони",
      year: "1919",
      city: "Флоренция",
      family: "negroni",
      spirit: "Джин",
      glass: "Рокс",
      descriptors: ["горький", "крепкий"],
      recipe: "Джин 30 · кампари 30 · вермут 30.",
      garnish: "Слайс апельсина",
      history: "Граф Негрони попросил усилить Американо джином.",
      fits: "Любителям горечи.",
      ourAnswers: [{ label: "Мезкаль Негрони", menuId: "braindead" }],
    },
  ],
  families: [
    {
      tint: "negroni",
      code: "NEGRONI",
      title: "NEGRONI & FRIENDS",
      logic: "Равные части крепкого, битера и вермута.",
      evolution: "Ветка выросла из Американо.",
      tip: "Гость просит «что-то горькое».",
      total: 1,
    },
  ],
  spiritCategories: [
    { slug: "gin", label: "Джин", isArchived: false },
    { slug: "grappa", label: "Граппа", isArchived: true },
  ],
  spirits: [
    {
      slug: "tanqueray",
      categorySlug: "gin",
      name: "Танкерей",
      img: null,
      abv: 43.1,
      country: "Англия",
      flavour: "Сухой лондонский стиль.",
      brand: "Diageo",
      brandDetail: null,
      features: null,
      pairings: "База классического джин-тоника.",
      fact: null,
      sourceUrl: null,
    },
    {
      slug: "hendricks",
      categorySlug: "gin",
      name: "Хендрикс",
      img: null,
      abv: 41.4,
      country: "Шотландия",
      flavour: "Огурец и лепестки розы.",
      brand: "William Grant & Sons",
      brandDetail: null,
      features: null,
      pairings: null,
      fact: null,
      sourceUrl: "hendricksgin.com",
    },
    {
      slug: "grappa-julia",
      categorySlug: "grappa",
      name: "Джулия",
      img: null,
      abv: null,
      country: null,
      flavour: null,
      brand: null,
      brandDetail: null,
      features: null,
      pairings: null,
      fact: null,
      sourceUrl: null,
    },
  ],
  kitchenCategories: [{ slug: "mains", label: "ОСНОВНЫЕ" }],
  kitchen: [
    {
      id: "tako",
      categorySlug: "mains",
      name: "Тако с треской",
      subtitle: "Хрустящая треска",
      price: 595,
      weight: 210,
      timing: 12,
      photo: null,
      description: null,
      serving: null,
      fact: null,
      nutrition: { kcal: 420, protein: 24, fat: 18, carb: 38 },
    },
    {
      id: "edamame",
      categorySlug: "mains",
      name: "Эдамаме",
      subtitle: "С копчёной солью",
      price: 210,
      weight: 150,
      timing: 4,
      photo: null,
      description: null,
      serving: null,
      fact: null,
      nutrition: { kcal: null, protein: null, fat: null, carb: null },
    },
  ],
  filters: {
    spirits: ["Джин"],
    glasses: ["Хайбол"],
    classicSpirits: ["Джин"],
  },
}

describe("mapBundle", () => {
  const kit = mapBundle(bundle)

  it("maps MENU with correct length and preserves isAlcoholic:false for a non-alc drink", () => {
    expect(kit.MENU).toHaveLength(2)
    const nonAlc = kit.MENU.find((c) => c.id === "virgin-mule")
    expect(nonAlc).toBeDefined()
    expect(nonAlc?.isAlcoholic).toBe(false)
    expect(nonAlc?.isZeroCulture).toBe(true)
  })

  it("groups SPIRIT_GROUPS by category with correct total, and derives SPIRIT_GROUPS_ARCHIVED", () => {
    expect(kit.SPIRIT_GROUPS).toHaveLength(1)
    const gin = kit.SPIRIT_GROUPS[0]
    expect(gin.category).toBe("Джин")
    expect(gin.total).toBe(2)
    expect(gin.items).toHaveLength(2)

    expect(kit.SPIRIT_GROUPS_ARCHIVED).toHaveLength(1)
    expect(kit.SPIRIT_GROUPS_ARCHIVED[0].category).toBe("Граппа")
    expect(kit.SPIRIT_GROUPS_ARCHIVED[0].total).toBe(1)
  })

  it("synthesizes a non-empty spirit meta string", () => {
    const gin = kit.SPIRIT_GROUPS[0]
    const tanqueray = gin.items.find((s) => s.name === "Танкерей")
    expect(tanqueray?.meta).toBeTruthy()
    expect(tanqueray?.meta.length).toBeGreaterThan(0)
    expect(tanqueray?.meta).toBe("АНГЛИЯ · 43.1% ABV")
  })

  it("maps dish nutrition to undefined when all macros are null, and to an object otherwise", () => {
    const tako = kit.DISHES.find((d) => d.id === "tako")
    const edamame = kit.DISHES.find((d) => d.id === "edamame")
    expect(tako?.nutrition).toEqual({ kcal: 420, protein: 24, fat: 18, carb: 38 })
    expect(edamame?.nutrition).toBeUndefined()
  })

  it("sets every mapped item's learned to false", () => {
    expect(kit.MENU.every((c) => c.learned === false)).toBe(true)
    expect(kit.CLASSICS.every((c) => c.learned === false)).toBe(true)
    expect(kit.SPIRIT_GROUPS.flatMap((g) => g.items).every((s) => s.learned === false)).toBe(true)
    expect(kit.DISHES.every((d) => d.learned === false)).toBe(true)
    expect(kit.FAMILIES.every((f) => f.learned === 0)).toBe(true)
    expect(kit.SECTIONS.every((s) => s.learned === 0)).toBe(true)
  })

  it("derives TOTAL_POSITIONS as the sum of section totals", () => {
    const expected = bundle.sections.reduce((sum, s) => sum + s.total, 0)
    expect(kit.TOTAL_POSITIONS).toBe(expected)
    expect(kit.TOTAL_POSITIONS).toBe(8)
  })

  it("derives RETIRED_COUNT and CLASSICS_TOTAL", () => {
    expect(kit.RETIRED_COUNT).toBe(1)
    expect(kit.CLASSICS_TOTAL).toBe(1)
  })

  it("prepends 'Все' to filter lists", () => {
    expect(kit.SPIRIT_FILTERS[0]).toBe("Все")
    expect(kit.GLASS_FILTERS[0]).toBe("Все")
    expect(kit.CLASSIC_SPIRITS[0]).toBe("Все")
    expect(kit.SPIRIT_CATEGORIES).toEqual(["Все", "Джин"])
  })
})
