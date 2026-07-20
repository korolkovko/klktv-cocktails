import * as React from "react"

export interface EntityColumn<T> {
  key: string
  label: string
  render?: (item: T) => React.ReactNode
}

// Searchable table + New/Edit/Delete row actions — generic over whatever
// row shape a tab's `adminApi.list(entity)` returns. `getKey` supplies the
// natural key (slug/key/id) used both as the React key and for row-action
// callbacks; the default search matches against every rendered column's raw
// value (string coercion), a caller can pass `searchKeys` to search over
// something more specific/richer instead.
export function EntityList<T>({
  items,
  columns,
  getKey,
  onEdit,
  onNew,
  onDelete,
  searchPlaceholder = "Поиск…",
  searchKeys,
  loading,
}: {
  items: T[]
  columns: EntityColumn<T>[]
  getKey: (item: T) => string
  onEdit: (item: T) => void
  onNew: () => void
  onDelete: (item: T) => void
  searchPlaceholder?: string
  searchKeys?: (item: T) => string
  loading?: boolean
}) {
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = searchKeys
        ? searchKeys(item)
        : columns.map((c) => String((item as Record<string, unknown>)[c.key] ?? "")).join(" ")
      return haystack.toLowerCase().includes(q)
    })
  }, [items, query, searchKeys, columns])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-xs rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
        />
        <button
          type="button"
          onClick={onNew}
          className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
        >
          + Новый
        </button>
      </div>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-gray-400">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-gray-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((item) => (
                <tr key={getKey(item)} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 align-top">
                      {c.render
                        ? c.render(item)
                        : String((item as Record<string, unknown>)[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right align-top">
                    <div className="inline-flex gap-3">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="text-xs font-medium text-gray-600 underline hover:text-gray-900"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="text-xs font-medium text-red-600 underline hover:text-red-800"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
