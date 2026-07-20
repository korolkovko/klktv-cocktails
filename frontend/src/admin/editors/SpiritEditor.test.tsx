import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { SpiritEntryAdminOut } from "./SpiritEditor"
import { SpiritEditor, fromAdminOut, toWriteIn } from "./SpiritEditor"

// Same lightweight approach as DrinkEditor.test.tsx (no jsdom/@testing-library
// in this project yet). The spirit-categories fetch happens in its own
// effect and doesn't block first render (react-dom/server doesn't run
// effects), so `slug={null}` is a plain synchronous render.
describe("SpiritEditor (new spirit)", () => {
  it("renders the blank template with every SpiritEntryWriteIn field group and a disabled Save", () => {
    const html = renderToStaticMarkup(
      <SpiritEditor slug={null} onSaved={() => {}} onClose={() => {}} />
    )

    expect(html).toContain("Новый: Спирит")

    for (const label of [
      "Слаг",
      "Название",
      "Категория",
      "Крепость (как в меню)",
      "Цена (как в меню)",
      "Фото",
      "Бренд",
      "Страна",
      "Ссылка на источник",
      "Порядок сортировки",
      "Вкус",
      "Описание",
      "Особенности",
      "Сочетания в коктейлях",
      "Интересный факт",
    ]) {
      expect(html).toContain(label)
    }

    expect(html).toMatch(/Сохранить<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Сохранить/)
  })
})

function makeRow(overrides: Partial<SpiritEntryAdminOut> = {}): SpiritEntryAdminOut {
  return {
    id: 1,
    slug: "havana-club-7",
    category: "rum",
    name: "Havana Club 7",
    img: null,
    abv_raw: "40%",
    abv: 40,
    price_raw: "50 мл / 450 ₽",
    price_amount: 450,
    serving_ml: 50,
    flavour: null,
    brand: null,
    country: null,
    description: null,
    features: null,
    cocktail_pairings: null,
    fact: null,
    source_url: null,
    sort_order: 0,
    ...overrides,
  }
}

// Full-record PATCH lesson (DrinkEditor review Fix 2 precedent): the backend
// `_apply_spirit` sets every column from the request body, so a save must
// thread every loaded field through unchanged, including the ones this
// editor renders as plain TextFields/TextAreas (brand/country/source_url/
// flavour/description/features/cocktail_pairings/fact).
describe("SpiritEditor full-body round-trip", () => {
  it("threads every loaded field through toWriteIn unchanged", () => {
    const row = makeRow({
      brand: "Havana Club",
      country: "Куба",
      description: "Выдержанный ром",
      features: "Ванильные ноты",
      cocktail_pairings: "Дайкири, Мохито",
      fact: "Выдержка 7 лет",
      source_url: "https://example.com/havana-club-7",
      sort_order: 2,
    })
    const body = toWriteIn(fromAdminOut(row))
    expect(body).toEqual({
      slug: "havana-club-7",
      category: "rum",
      name: "Havana Club 7",
      img: null,
      abv_raw: "40%",
      price_raw: "50 мл / 450 ₽",
      flavour: null,
      brand: "Havana Club",
      country: "Куба",
      description: "Выдержанный ром",
      features: "Ванильные ноты",
      cocktail_pairings: "Дайкири, Мохито",
      fact: "Выдержка 7 лет",
      source_url: "https://example.com/havana-club-7",
      sort_order: 2,
    })
  })
})
