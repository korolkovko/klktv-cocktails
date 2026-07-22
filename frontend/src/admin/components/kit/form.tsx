import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ResponsiveSelect } from "@/components/adapters/responsive-select"

// Kit-styled field primitives for the admin editors (Phase-2 redesign). These
// are DROP-IN replacements for the old plain-gray `admin/components/FormFields`
// — SAME prop API (TextField/TextArea/NumberField/SelectField/CheckboxField),
// so each entity editor's field JSX ports over with only an import swap. The
// mono-caps `Field`/`FieldHint` wrapper is lifted verbatim from the Phase-1
// UsersPage so every admin form reads the same. Rendered with the kit's own
// Input/Textarea/Switch/ResponsiveSelect (INK border, BUTTER focus ring),
// which is what makes these forms match the guest kit surface.

// поле формы — mono-caps подпись + контент (+ опц. хинт снизу)
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="font-mono text-[10px] tracking-[0.06em] text-[#52525B]">{label}</label>
      )}
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  )
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <span className="font-mono text-[10px] text-[#A1A1AA]">{children}</span>
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
  type = "text",
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: React.ReactNode
  required?: boolean
  maxLength?: number
  disabled?: boolean
  type?: "text" | "password"
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={type === "password" ? "new-password" : undefined}
      />
    </Field>
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
    <Field label={label} hint={hint}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    </Field>
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
    <Field label={label} hint={hint}>
      <Input
        type="number"
        className="tabular-nums"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </Field>
  )
}

// Boolean toggle — kit Switch (§10) laid out as label-left / switch-right, the
// canonical kit boolean row. Keeps CheckboxField's API (checked/onChange(bool)).
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
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <span className="text-sm text-foreground">{label}</span>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  )
}

// Single-select — wraps the §50 ResponsiveSelect (desktop popover / mobile
// bottom-sheet). Keeps SelectField's API (value/onChange(v)/options). NOTE:
// Radix Select forbids an item with value="" — callers that need a "none"
// choice must use a real sentinel value (e.g. "__none__"), not "".
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
    <Field label={label} hint={hint}>
      <ResponsiveSelect
        label={label}
        options={options}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Field>
  )
}
