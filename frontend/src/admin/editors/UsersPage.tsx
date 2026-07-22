import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Fab } from "@/components/kollektiv/fab"
import { ConfirmDialog } from "@/components/kollektiv/confirm-dialog"
import { ResponsiveDialog } from "@/components/adapters/responsive-dialog"
import { ResponsiveSelect } from "@/components/adapters/responsive-select"
import {
  EntityTable,
  EntityMeta,
  RoleBadge,
  type EntityAction,
  type EntityColumn,
} from "@/components/kollektiv/entity-table"

import { adminApi } from "../api"
import { Field, FieldHint } from "../components/kit/form"
import { ChipMenu } from "../components/kit/chip-menu"

// "Юзеры" tab body (rebuilt onto the kit's §54 EntityTable — see the
// block-users reference impl for the pattern this follows: EntityTable +
// toolbar (search + role select-chip) + CTA/FAB "+ Юзер" + row-clickable
// form §50 (ResponsiveDialog) + ConfirmDialog for delete-from-form + a fire
// (ArcadeButton, hold 3s) row action for the irreversible delete. Our model
// is simpler than block-users' demo data (no telegram/invited/disabled) —
// only self-protection carries over as a row/form state.
//
// Row/request shapes mirror backend/app/routers/admin_users.py's
// UserOut/UserCreateIn/UserUpdateIn one-for-one. `UserOut` never carries
// `password_hash` — never display or round-trip one here.
//
// The identifier for PATCH/DELETE is the username (adminApi.update/remove's
// generic `key` param), not the numeric `id` — admin_users.py's `_resolve`
// accepts either, but username is stable across edits and is what's shown
// everywhere on this page.
//
// Self-protection is enforced server-side (can't delete/demote self, can't
// strand the last admin) — this component additionally hides those
// affordances client-side for the signed-in user's own row (belt-and-
// suspenders): the row gets EntityTable's "self" rowState (no ⋯ menu, just
// a "СЕБЯ НЕЛЬЗЯ" note) and the edit form disables the role select + hides
// the delete button.
export type Role = "admin" | "editor" | "reader"

export interface UserOut {
  id: number
  username: string
  name: string | null
  role: Role
  created_at: string
  last_seen_at: string | null
}

export interface UserCreateIn {
  username: string
  password: string
  role: Role
  name: string | null
}

export interface UserUpdateIn {
  role?: Role
  name?: string | null
  password?: string
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Админ" },
  { value: "editor", label: "Редактор" },
  { value: "reader", label: "Читатель" },
]

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label])) as Record<Role, string>

// RoleBadge tone per the task brief: admin → ink (weightiest), editor →
// butter (management-ish), reader → muted (default/lowest).
const ROLE_TONE: Record<Role, "ink" | "butter" | "muted"> = {
  admin: "ink",
  editor: "butter",
  reader: "muted",
}

const ROLE_FILTER_OPTIONS: { value: Role | "all"; label: string }[] = [
  { value: "all", label: "Все роли" },
  ...ROLE_OPTIONS,
]

// Matches admin_users.py's UserCreateIn/UserUpdateIn `password` min_length.
export const MIN_PASSWORD_LENGTH = 4

// Exported for tests: mirrors the backend's self-protection checks
// (admin_users.py `update_user`/`delete_user`: can't delete/demote yourself)
// so the UI never offers an action the backend would reject. Used to hide
// the row's fire/delete action, to give the row EntityTable's "self"
// rowState, and to lock the role selector when editing your own account.
export function isSelf(username: string, currentUsername: string | null | undefined): boolean {
  return currentUsername != null && username === currentUsername
}

// Exported for tests: short relative label, falling back to a plain
// ru-RU date past a week — "—" for null (last_seen_at is only set by the
// throttled touch in get_current_user, so a freshly-created user reads "—"
// until their first request).
export function formatLastSeen(iso: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "сегодня"
  if (days === 1) return "вчера"
  if (days < 7) return `${days} дн назад`
  return new Date(iso).toLocaleDateString("ru-RU")
}

// Exported for tests: 2-letter avatar initials from a display name (or,
// failing that, the username) — feeds EntityTable's identity().initials.
export function initialsOf(nameOrUsername: string): string {
  const trimmed = nameOrUsername.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

// Exported for tests: the identity mapping fed to EntityTable's `identity`
// prop, pulled out as a pure function. This is deliberately NOT exercised
// via a full renderToStaticMarkup of <UsersPage> — EntityTable/Fab/
// ResponsiveDialog/ResponsiveSelect all call useIsMobile() unconditionally
// on every render, which reads `window.matchMedia` with no lazy/SSR guard;
// this project's vitest suite runs in the plain "node" test environment
// (no jsdom/happy-dom installed), so any render of those components throws
// "window is not defined". That's a test-environment gap, not a runtime bug
// — the browser always has window/matchMedia — but it means the wiring
// logic here is tested as pure functions instead of via rendering.
export function identityOf(u: UserOut, currentUsername?: string | null) {
  const name = u.name || u.username
  return {
    name,
    sub: `@${u.username}`,
    initials: initialsOf(name),
    accent: isSelf(u.username, currentUsername),
  }
}

interface UserForm {
  username: string
  name: string
  role: Role
  password: string
}

const BLANK_FORM: UserForm = { username: "", name: "", role: "reader", password: "" }

function fromRow(row: UserOut): UserForm {
  return { username: row.username, name: row.name ?? "", role: row.role, password: "" }
}

// Exported so UsersPage.test.tsx can assert the create body directly.
export function toCreateBody(form: UserForm): UserCreateIn {
  return {
    username: form.username.trim().toLowerCase(),
    password: form.password.trim(),
    role: form.role,
    name: form.name.trim() || null,
  }
}

// Exported so UsersPage.test.tsx can assert the edit body's core rules:
// - a blank password field means "keep current password" — omit the key
//   entirely rather than sending an empty string (the backend's
//   `if data.password:` would treat "" the same as omitted, but omitting is
//   the honest signal of intent and keeps the payload minimal).
// - `name` must always be sent as a string (never `null`), even when blank.
//   UserUpdateIn is a PARTIAL-update schema: admin_users.py's `update_user`
//   only applies `name` under `if data.name is not None:`, so a literal
//   `null` reads as "field not supplied" and a clear silently no-ops. `""`
//   passes that guard, and the backend's own assignment
//   (`obj.name = data.name or None`) normalises the empty string to NULL in
//   the DB — so sending `""` is what actually clears the name.
export function toUpdateBody(form: UserForm): UserUpdateIn {
  const body: UserUpdateIn = { role: form.role, name: form.name.trim() }
  if (form.password.trim()) body.password = form.password.trim()
  return body
}

type Editing = { mode: "new" } | { mode: "edit"; row: UserOut } | null

interface ConfirmState {
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel: React.ReactNode
  onConfirm: () => void
}

export function UsersPage({ currentUsername }: { currentUsername?: string | null }) {
  const [rows, setRows] = React.useState<UserOut[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<UserForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<Role | "all">("all")
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminApi.list<UserOut>("users"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить пользователей")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openNew() {
    setForm(BLANK_FORM)
    setEditing({ mode: "new" })
  }

  function openEdit(row: UserOut) {
    setForm(fromRow(row))
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Shared by the row's fire action (⋯ → Удалить, arcade hold-3s — no extra
  // confirm needed, the hold IS the confirm) and the form footer's
  // ConfirmDialog-gated delete.
  async function performDelete(row: UserOut) {
    try {
      await adminApi.remove("users", row.username)
      toast.success(`Удалено · ${row.name || row.username}`)
      if (editing?.mode === "edit" && editing.row.username === row.username) setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить пользователя")
    }
  }

  function deleteFromForm(row: UserOut) {
    setEditing(null)
    setConfirm({
      title: `Удалить · ${row.name || row.username}?`,
      description: "Запись пользователя будет удалена безвозвратно.",
      confirmLabel: "Удалить",
      onConfirm: () => void performDelete(row),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      if (editing.mode === "new") {
        await adminApi.create("users", toCreateBody(form))
        toast.success(`Юзер создан · ${form.username}`)
      } else {
        await adminApi.update("users", editing.row.username, toUpdateBody(form))
        toast.success(`Сохранено · ${form.name || editing.row.username}`)
      }
      setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  const editingSelf = editing?.mode === "edit" && isSelf(editing.row.username, currentUsername)

  const saveDisabled =
    editing?.mode === "new"
      ? !form.username.trim() || form.password.trim().length < MIN_PASSWORD_LENGTH
      : editing?.mode === "edit"
        ? form.password.trim().length > 0 && form.password.trim().length < MIN_PASSWORD_LENGTH
        : true

  const q = search.trim().toLowerCase()
  const filteredRows = rows.filter((u) => {
    if (q && !((u.name ?? "").toLowerCase().includes(q) || u.username.toLowerCase().includes(q))) return false
    if (roleFilter !== "all" && u.role !== roleFilter) return false
    return true
  })

  const columns: EntityColumn<UserOut>[] = [
    {
      key: "role",
      label: "РОЛЬ",
      width: 132,
      render: (u) => <RoleBadge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</RoleBadge>,
    },
    {
      key: "last",
      label: "ПОСЛЕДНИЙ ВИЗИТ",
      width: 140,
      mobile: "sub",
      render: (u) => <EntityMeta>{formatLastSeen(u.last_seen_at)}</EntityMeta>,
      subText: (u) => formatLastSeen(u.last_seen_at),
    },
  ]

  const actions: EntityAction<UserOut>[] = [
    { label: "Изменить", onSelect: (u) => openEdit(u) },
    {
      label: "Удалить",
      fire: true,
      fireSublabel: "HOLD 3 SEC · NO UNDO",
      show: (u) => !isSelf(u.username, currentUsername),
      onSelect: (u) => void performDelete(u),
    },
  ]

  function resetFilters() {
    setSearch("")
    setRoleFilter("all")
  }

  return (
    <div>
      <EntityTable
        rows={filteredRows}
        rowKey={(u) => u.username}
        data-testid="users-table"
        identity={(u) => identityOf(u, currentUsername)}
        identityLabel="ПОЛЬЗОВАТЕЛЬ"
        columns={columns}
        actions={actions}
        rowState={(u) => (isSelf(u.username, currentUsername) ? "self" : undefined)}
        selfNote="СЕБЯ НЕЛЬЗЯ"
        onRowClick={(u) => openEdit(u)}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Поиск ${rows.length} юзеров…`,
        }}
        filters={
          <ChipMenu
            value={roleFilter}
            options={ROLE_FILTER_OPTIONS}
            onChange={(v) => setRoleFilter(v as Role | "all")}
            label="Роль"
          />
        }
        cta={<Button onClick={openNew}>+ Юзер</Button>}
        emptyState={
          loading ? (
            <div className="px-4 py-12 text-center font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
              Загрузка…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
                НИКОГО НЕ НАШЛОСЬ
              </span>
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          )
        }
      />

      {/* mobile: «+ Юзер» = FAB §37 (desktop — CTA в тулбаре, не рендерится на мобилке) */}
      <Fab
        icon={<Plus className="size-[22px]" strokeWidth={1.75} />}
        aria-label="Новый юзер"
        onClick={openNew}
      />

      {/* форма §50 (FORM 620) — строка кликабельна → сюда; логин read-only на edit */}
      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing
            ? editing.mode === "new"
              ? "Новый юзер"
              : `Изменить · ${editing.row.name || editing.row.username}`
            : ""
        }
        contentClassName="sm:max-w-[620px]"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {editing?.mode === "edit" && !editingSelf && (
              <Button
                variant="destructive"
                onClick={() => deleteFromForm(editing.row)}
                className="sm:mr-auto max-md:w-full"
              >
                Удалить
              </Button>
            )}
            <Button variant="quiet" onClick={() => setEditing(null)} className="max-md:w-full">
              Отмена
            </Button>
            <Button onClick={() => void handleSave()} disabled={saveDisabled || saving} className="max-md:w-full">
              Сохранить
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4 py-1">
            <Field label="Логин">
              <Input
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                readOnly={editing.mode === "edit"}
                disabled={editing.mode === "edit"}
                className="font-mono"
                maxLength={64}
              />
              {editing.mode === "edit" && <FieldHint>идентификатор записи — не меняется</FieldHint>}
            </Field>
            <Field label="Имя">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={128} />
            </Field>
            <Field label="Роль">
              <ResponsiveSelect
                label="Роль"
                options={ROLE_OPTIONS}
                value={form.role}
                onValueChange={(v) => set("role", v as Role)}
                disabled={editingSelf}
              />
              {editingSelf && <FieldHint>Нельзя снять с себя роль admin</FieldHint>}
            </Field>
            <Field label={editing.mode === "new" ? "Пароль" : "Новый пароль"}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder={
                  editing.mode === "new" ? `минимум ${MIN_PASSWORD_LENGTH} символа` : "пусто = не меняется"
                }
              />
            </Field>
          </div>
        )}
      </ResponsiveDialog>

      {/* удаление — confirm §50 (форма → сюда; ⋯-действие в строке — аркада, без этого шага) */}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel ?? "Удалить"}
        destructive
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  )
}
