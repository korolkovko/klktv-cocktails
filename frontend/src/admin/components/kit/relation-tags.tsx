import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field } from "./form"

// Kit-styled chip-list editor for the free-text M:N relations the admin API
// uses (spirit/tag keys, flavor/descriptor labels, related-drink slugs). Same
// API as the old RelationTags ({label,value,onChange,options?,placeholder?,
// hint?}); the backend get-or-creates most of these by key/label, so the field
// is a plain string list, optionally hinted by a <datalist> of known `options`.
// Only re-skinned to the kit (rounded-full INK-border chips + kit Input/Button).
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
    <Field label={label} hint={hint}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-input bg-muted px-2.5 py-0.5",
                "text-xs font-medium text-foreground"
              )}
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Убрать ${v}`}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
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
        />
        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={add}>
          Добавить
        </Button>
      </div>
      {options && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </Field>
  )
}
