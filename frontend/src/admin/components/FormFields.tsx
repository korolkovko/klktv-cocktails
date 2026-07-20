import * as React from "react"

import { cn } from "@/lib/utils"

// Shared field primitives for admin editors (Task 7 shell + the per-entity
// editors in Tasks 8-10). Deliberately PLAIN Tailwind — no kit tokens
// (bg-card/text-foreground/etc.) — the admin surface is separate from the
// guest kit and meant to be easy to re-skin later (see task-7 brief).

const LABEL_CLS = "mb-1 block text-xs font-medium text-gray-600"
const INPUT_CLS =
  "w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100 disabled:text-gray-400"

function Hint({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <span className="mt-1 block text-xs text-gray-400">{children}</span>
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  maxLength,
  disabled,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: React.ReactNode
  required?: boolean
  maxLength?: number
  disabled?: boolean
}) {
  return (
    <label className="block">
      {label && <span className={LABEL_CLS}>{label}</span>}
      <input
        type="text"
        className={INPUT_CLS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
      />
      <Hint>{hint}</Hint>
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 4,
  disabled,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: React.ReactNode
  rows?: number
  disabled?: boolean
}) {
  return (
    <label className="block">
      {label && <span className={LABEL_CLS}>{label}</span>}
      <textarea
        className={cn(INPUT_CLS, "resize-y")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
      <Hint>{hint}</Hint>
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  min,
  max,
  step,
  disabled,
}: {
  label?: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  hint?: React.ReactNode
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <label className="block">
      {label && <span className={LABEL_CLS}>{label}</span>}
      <input
        type="number"
        className={cn(INPUT_CLS, "tabular-nums")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
      <Hint>{hint}</Hint>
    </label>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-900">
        <input
          type="checkbox"
          className="size-4 rounded border-gray-300"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {label}
      </label>
      <Hint>{hint}</Hint>
    </div>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  disabled,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  hint?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label className="block">
      {label && <span className={LABEL_CLS}>{label}</span>}
      <select
        className={INPUT_CLS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint>{hint}</Hint>
    </label>
  )
}
