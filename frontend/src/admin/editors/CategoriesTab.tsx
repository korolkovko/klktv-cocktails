import * as React from "react"

import { adminApi } from "../api"

// "Разделы" tab content — replaces the generic EntityList+modal pattern
// (like DrinkEditor bypasses it for "drinks", see AdminPage.tsx) since
// categories/sections are a fixed set seeded by migration: no create/
// delete, just relabel/show-hide/reorder (backend/app/routers/admin.py's
// `update_category`/`reorder_categories`, schemas_admin.py's
// `CategoryAdminOut`/`CategoryPatchIn`/`CategoryReorderIn`).
//
// Unlike every other admin write-in, `CategoryPatchIn` is a genuine partial
// patch (the router only assigns fields that are non-None) — so, unlike the
// "send every field" rule for the other editors, sending just the changed
// field(s) here is safe. This component sends {label, is_visible,
// sort_order} together on every save purely for simplicity, not because
// omitting one would wipe it.
export interface CategoryRow {
  id: number
  key: string
  label: string
  kind: string
  sort_order: number
  is_visible: boolean
}

export function CategoriesTab() {
  const [rows, setRows] = React.useState<CategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.list<CategoryRow>("categories")
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить разделы")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function saveRow(row: CategoryRow, patch: Partial<Pick<CategoryRow, "label" | "is_visible" | "sort_order">>) {
    setError(null)
    const next = { ...row, ...patch }
    try {
      await adminApi.update("categories", row.key, {
        label: next.label,
        is_visible: next.is_visible,
        sort_order: next.sort_order,
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить раздел")
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    setError(null)
    try {
      await adminApi.reorderCategories(next.map((r) => r.key))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить порядок разделов")
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2">Ключ</th>
              <th className="px-3 py-2">Тип</th>
              <th className="px-3 py-2">Название</th>
              <th className="px-3 py-2">Видим</th>
              <th className="px-3 py-2">Порядок</th>
              <th className="px-3 py-2 text-right">Порядок в списке</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, i) => (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-3 py-2 align-top text-xs text-gray-400">{row.key}</td>
                  <td className="px-3 py-2 align-top text-xs text-gray-400">{row.kind}</td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      defaultValue={row.label}
                      maxLength={64}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== row.label) void saveRow(row, { label: v })
                      }}
                      className="w-full max-w-[16rem] rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300"
                      checked={row.is_visible}
                      onChange={(e) => void saveRow(row, { is_visible: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      defaultValue={row.sort_order}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? row.sort_order : Number(e.target.value)
                        if (v !== row.sort_order) void saveRow(row, { sort_order: v })
                      }}
                      className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-sm tabular-nums text-gray-900 outline-none focus:border-gray-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => void move(i, -1)}
                        disabled={i === 0}
                        aria-label="Выше"
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(i, 1)}
                        disabled={i === rows.length - 1}
                        aria-label="Ниже"
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Разделы — фиксированный набор: создание и удаление недоступны, только название, видимость и
        порядок.
      </p>
    </div>
  )
}
