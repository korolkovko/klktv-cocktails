import * as React from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SelectField } from "./form"

// Select-from-dictionary field (Стакан/Бейдж/Лёд on DrinksPage): a
// SelectField over the dictionary's {key,label} rows, plus a compact inline
// "＋" add-row underneath — type a human label, it POSTs to the dictionary
// entity via the caller-supplied `onQuickAdd` (key is server-derived, never
// typed or shown here) and selects the newly created row. Kept entity
// -agnostic (no adminApi import here) so the same component serves all three
// dictionaries; DrinksPage supplies `options` + `onQuickAdd` per field.
export function DictionaryField({
  label,
  value,
  options,
  onChange,
  onQuickAdd,
  placeholder,
}: {
  label: string
  value: string
  options: { key: string; label: string }[]
  onChange: (key: string) => void
  onQuickAdd: (label: string) => Promise<string>
  placeholder?: string
}) {
  const [draft, setDraft] = React.useState("")
  const [adding, setAdding] = React.useState(false)

  async function handleAdd() {
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      const key = await onQuickAdd(text)
      onChange(key)
      setDraft("")
    } catch {
      // onQuickAdd is responsible for surfacing its own error (toast); keep
      // the draft text here so the user can just retry without retyping.
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <SelectField
        label={label}
        value={value}
        onChange={onChange}
        options={options.map((o) => ({ value: o.key, label: o.label }))}
        placeholder={placeholder ?? "— выберите —"}
      />
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void handleAdd()
            }
          }}
          placeholder="Новое значение…"
          disabled={adding}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => void handleAdd()}
          disabled={adding || !draft.trim()}
          aria-label="Добавить"
        >
          ＋
        </Button>
      </div>
    </div>
  )
}
