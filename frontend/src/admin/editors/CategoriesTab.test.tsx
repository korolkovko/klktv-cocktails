import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CategoriesTab } from "./CategoriesTab"

// Same lightweight approach as EntityList.test.tsx (no jsdom/@testing-library
// in this project yet). `CategoriesTab` fetches its rows in an effect, which
// react-dom/server never runs, so the first render is always the loading
// state — enough to assert the fixed-set framing (no create/delete affordance,
// column headers for label/visibility/order/reorder) without a fetch mock.
describe("CategoriesTab (fixed-set sections list)", () => {
  it("renders the read-only-ish table shell with reorder/visibility columns and no create button", () => {
    const html = renderToStaticMarkup(<CategoriesTab />)

    expect(html).toContain("Ключ")
    expect(html).toContain("Тип")
    expect(html).toContain("Название")
    expect(html).toContain("Видим")
    expect(html).toContain("Порядок")
    expect(html).toContain("Загрузка")

    // Categories are a fixed set — no "+ Новый" create affordance anywhere.
    expect(html).not.toContain("Новый")
  })
})
