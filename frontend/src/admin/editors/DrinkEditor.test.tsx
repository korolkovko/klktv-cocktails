import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DrinkEditor } from "./DrinkEditor"

// Same lightweight approach as EntityList.test.tsx (no jsdom/@testing-library
// in this project yet) — render to a static HTML string and assert on
// presence of key markup. `slug={null}` (new-drink mode) needs no fetch, so
// it's a plain synchronous first render — no async/effect flushing needed.
describe("DrinkEditor (new drink)", () => {
  it("renders the blank template with every DrinkWriteIn field group and a disabled Save", () => {
    const html = renderToStaticMarkup(
      <DrinkEditor slug={null} onSaved={() => {}} onClose={() => {}} />
    )

    expect(html).toContain("Новый: Авторские")

    // Text/TextArea fields
    for (const label of [
      "Слаг",
      "Название",
      "Подзаголовок",
      "Крепость (как в меню)",
      "Цена (как в меню)",
      "Рецепт",
      "Гарнир",
      "Питч",
      "О коктейле",
      "Происхождение названия",
      "FAQ",
    ]) {
      expect(html).toContain(label)
    }

    // Number fields
    expect(html).toContain("Объём, мл")
    expect(html).toContain("Уровень кофеина")
    expect(html).toContain("Порядок сортировки")

    // Checkboxes
    expect(html).toContain("Алкогольный")
    expect(html).toContain("Zero Culture")
    expect(html).toContain("Газированный")

    // Image upload + relation tags + repeatable details
    expect(html).toContain("Логотип")
    expect(html).toContain("Фото коктейля")
    expect(html).toContain("Спириты (ключи)")
    expect(html).toContain("Вкусы")
    expect(html).toContain("Теги")
    expect(html).toContain("Детали")

    // Blank slug/name → Save disabled until filled in.
    expect(html).toMatch(/Сохранить<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Сохранить/)
  })
})
