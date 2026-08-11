import * as React from "react"

import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/kollektiv/combobox"
import { Field } from "./form"

// Form field: searchable MULTI-select over existing entities, built on the
// kit's §19 Combobox (SearchInput + checkbox list). Stores the entity's stable
// `value` (e.g. a drink slug) but shows its human `label` (name) everywhere —
// selected chips and the list both render the name, never a raw slug.
//
// The Combobox is rendered INLINE (expand/collapse), NOT inside a Radix
// Popover: this field lives inside the §50 ResponsiveDialog (a Radix Dialog
// with RemoveScroll), and a portaled Popover's inner list can't be scrolled
// through that scroll-lock. Inline keeps the list inside the dialog's own
// scroll region, so its max-h scroll works normally.
export function ComboboxMultiField({
  label,
  value,
  options,
  onChange,
  triggerLabel,
  searchPlaceholder,
  hint,
  emptyText,
}: {
  label?: string
  value: string[]
  options: { value: string; label: string }[]
  onChange: (next: string[]) => void
  triggerLabel?: string
  searchPlaceholder?: string
  hint?: React.ReactNode
  emptyText?: string
}) {
  const [open, setOpen] = React.useState(false)

  const labelOf = React.useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]))
    return (v: string) => m.get(v) ?? v
  }, [options])

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
              className="inline-flex items-center gap-1 rounded-full border border-input bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              {labelOf(v)}
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Убрать ${labelOf(v)}`}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {open ? (
        <div className="flex flex-col gap-1.5">
          <Combobox
            multi
            autoFocus
            options={options}
            value={value}
            onValueChange={onChange}
            placeholder={searchPlaceholder ?? "Поиск…"}
            emptyText={emptyText}
            footer={null}
          />
          <Button
            type="button"
            variant="quiet"
            size="sm"
            className="self-start"
            onClick={() => setOpen(false)}
          >
            Готово
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {triggerLabel ?? "Добавить…"}
        </Button>
      )}
    </Field>
  )
}
