import * as React from "react"

// Chip-list editor for the free-text M:N relations the admin API uses
// (spirit/tag keys, flavor/descriptor labels, related-drink slugs, …) — the
// backend get-or-creates most of these by key/label, so the field is a
// plain string list, optionally hinted by a datalist of known `options`.
export function RelationTags({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
}: {
  label?: string
  value: string[]
  onChange: (next: string[]) => void
  options?: string[]
  placeholder?: string
  hint?: React.ReactNode
}) {
  const [draft, setDraft] = React.useState("")
  const listId = React.useId()

  function add() {
    const v = draft.trim()
    if (!v || value.includes(v)) {
      setDraft("")
      return
    }
    onChange([...value, v])
    setDraft("")
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v))
  }

  return (
    <div>
      {label && <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>}
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Убрать ${v}`}
                className="text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          list={options ? listId : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder ?? "Добавить…"}
          className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Добавить
        </button>
      </div>
      {options && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </div>
  )
}
