import * as React from "react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FilterChip } from "@/components/kollektiv/filter-chip"

// Toolbar select-chip (e.g. «Роль ▾», «Категория ▾») for the admin EntityTable
// filters slot — Popover + §49 FilterChip in `select` mode, going `applied`
// (butter) when the value is off its default (options[0]). Lifted verbatim out
// of the Phase-1 UsersPage (which copied it from the kit's block-users
// bu-page.tsx ChipMenu) so every content page shares one filter chip.
export function ChipMenu({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const current = options.find((o) => o.value === value)
  const isDefault = value === options[0]?.value
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterChip select applied={!isDefault}>
          {isDefault ? label : current?.label}
        </FilterChip>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-48 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onChange(o.value)
              setOpen(false)
            }}
            className={cn(
              "flex min-h-9 w-full items-center rounded-md px-2.5 text-left text-[13px] font-semibold",
              o.value === value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
