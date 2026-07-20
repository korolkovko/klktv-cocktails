import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { EntityList } from "./EntityList"

// No jsdom/@testing-library in this project yet (see frontend/package.json),
// so these render EntityList to a static HTML string via react-dom/server —
// enough to assert presence/absence of the New/Delete action markup without
// adding test infra.
type Row = { key: string; label: string }

const rows: Row[] = [{ key: "menu", label: "Меню" }]
const columns = [{ key: "label", label: "Название" }]

describe("EntityList optional New/Delete actions", () => {
  it("renders + Новый and Удалить when onNew/onDelete are provided", () => {
    const html = renderToStaticMarkup(
      <EntityList
        items={rows}
        columns={columns}
        getKey={(r) => r.key}
        onEdit={() => {}}
        onNew={() => {}}
        onDelete={() => {}}
      />
    )
    expect(html).toContain("Новый")
    expect(html).toContain("Удалить")
  })

  it("omits + Новый and Удалить when onNew/onDelete are not provided (read-only, e.g. categories)", () => {
    const html = renderToStaticMarkup(
      <EntityList items={rows} columns={columns} getKey={(r) => r.key} onEdit={() => {}} />
    )
    expect(html).not.toContain("Новый")
    expect(html).not.toContain("Удалить")
    // Edit stays available even in the read-only-except-edit case.
    expect(html).toContain("Изменить")
  })
})
