import { ChipMenu } from "./chip-menu"

// Archive-state filter chip for the admin EntityTable `filters` slot —
// shared across the 4 content pages (Drinks/Classics/Spirits/Kitchen) that
// grew an `is_archived` flag (drinks-evolution Task A2). Same ChipMenu shell
// every other toolbar filter on these pages already uses (category/family/
// alc/role) — "Активные" is index 0 so ChipMenu treats it as the default
// (chip reads the plain label; any other choice shows its own label and
// goes `applied`/butter), matching the "don't show archived noise by
// default" rule every other page follows.
export type ArchiveView = "active" | "archived" | "all"

const ARCHIVE_VIEW_OPTIONS: { value: ArchiveView; label: string }[] = [
  { value: "active", label: "Активные" },
  { value: "archived", label: "Архив" },
  { value: "all", label: "Все" },
]

// Pure predicate — exported so it (and only it) needs its own unit test;
// each page's toolbar wires it as `rows.filter((r) => matchesArchiveView(r.is_archived, archiveView))`.
export function matchesArchiveView(isArchived: boolean, view: ArchiveView): boolean {
  return view === "all" ? true : view === "archived" ? isArchived : !isArchived
}

export function ArchiveFilter({
  value,
  onChange,
}: {
  value: ArchiveView
  onChange: (v: ArchiveView) => void
}) {
  return (
    <ChipMenu
      value={value}
      options={ARCHIVE_VIEW_OPTIONS}
      onChange={(v) => onChange(v as ArchiveView)}
      label="Статус"
    />
  )
}
