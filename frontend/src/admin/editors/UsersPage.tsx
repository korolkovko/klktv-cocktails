import * as React from "react"

import { adminApi } from "../api"
import { EditorShell } from "../components/EditorShell"
import { SelectField, TextField } from "../components/FormFields"

// "Юзеры" tab body (Task 10, admin-only — see AdminPage.tsx's `adminOnly`
// gate on this tab). Self-contained like CategoriesTab (Task 9): owns its
// own list fetch + inline create/edit modal instead of going through
// AdminPage's generic EntityList+EditorShell wiring. Row/request shapes
// mirror backend/app/routers/admin_users.py's UserOut/UserCreateIn/
// UserUpdateIn one-for-one. `UserOut` never carries `password_hash` — never
// display or round-trip one here.
//
// The identifier for PATCH/DELETE is the username (adminApi.update/remove's
// generic `key` param), not the numeric `id` — admin_users.py's `_resolve`
// accepts either, but username is stable across edits (id would work too,
// username was picked since it's what's shown/typed elsewhere on this page).
//
// Self-protection is enforced server-side (can't delete/demote self, can't
// strand the last admin) — this component additionally hides those
// affordances client-side for the signed-in user's own row (task-10 brief),
// so the UI never even offers an action the backend would 400 on.
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

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label]))

// Matches admin_users.py's UserCreateIn/UserUpdateIn `password` min_length.
export const MIN_PASSWORD_LENGTH = 4

// Exported for tests: mirrors the backend's self-protection checks
// (admin_users.py `update_user`/`delete_user`: can't delete/demote yourself)
// so the UI never offers an action the backend would reject. Used both to
// hide the row-level "Удалить" button and to lock the role selector when
// editing your own account.
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
    password: form.password,
    role: form.role,
    name: form.name.trim() || null,
  }
}

// Exported so UsersPage.test.tsx can assert the edit body's core rule
// (task-10 brief): a blank password field means "keep current password" —
// omit the key entirely rather than sending an empty string (the backend's
// `if data.password:` would treat "" the same as omitted, but omitting is
// the honest signal of intent and keeps the payload minimal).
export function toUpdateBody(form: UserForm): UserUpdateIn {
  const body: UserUpdateIn = { role: form.role, name: form.name.trim() || null }
  if (form.password.trim()) body.password = form.password
  return body
}

type Editing = { mode: "new" } | { mode: "edit"; row: UserOut } | null

export function UsersPage({ currentUsername }: { currentUsername?: string | null }) {
  const [rows, setRows] = React.useState<UserOut[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Editing>(null)
  const [form, setForm] = React.useState<UserForm>(BLANK_FORM)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await adminApi.list<UserOut>("users"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить пользователей")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openNew() {
    setForm(BLANK_FORM)
    setFormError(null)
    setEditing({ mode: "new" })
  }

  function openEdit(row: UserOut) {
    setForm(fromRow(row))
    setFormError(null)
    setEditing({ mode: "edit", row })
  }

  function set<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleDelete(row: UserOut) {
    if (isSelf(row.username, currentUsername)) return // hidden in the UI too; belt-and-suspenders
    if (!window.confirm(`Удалить пользователя «${row.name || row.username}»? Это необратимо.`)) return
    setError(null)
    try {
      await adminApi.remove("users", row.username)
      if (editing?.mode === "edit" && editing.row.username === row.username) setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить пользователя")
    }
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing.mode === "new") {
        await adminApi.create("users", toCreateBody(form))
      } else {
        await adminApi.update("users", editing.row.username, toUpdateBody(form))
      }
      setEditing(null)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось сохранить")
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

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">Пользователи админки — доступ к этой вкладке только у роли «admin».</p>
        <button
          type="button"
          onClick={openNew}
          className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
        >
          + Новый
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2">Имя</th>
              <th className="px-3 py-2">Логин</th>
              <th className="px-3 py-2">Роль</th>
              <th className="px-3 py-2">Последний визит</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.username} className="hover:bg-gray-50">
                  <td className="px-3 py-2 align-top">{row.name || "—"}</td>
                  <td className="px-3 py-2 align-top text-gray-500">{row.username}</td>
                  <td className="px-3 py-2 align-top">{ROLE_LABEL[row.role] ?? row.role}</td>
                  <td className="px-3 py-2 align-top text-gray-500">{formatLastSeen(row.last_seen_at)}</td>
                  <td className="px-3 py-2 text-right align-top">
                    <div className="inline-flex gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="text-xs font-medium text-gray-600 underline hover:text-gray-900"
                      >
                        Изменить
                      </button>
                      {!isSelf(row.username, currentUsername) && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="text-xs font-medium text-red-600 underline hover:text-red-800"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditorShell
          title={editing.mode === "new" ? "Новый: Юзер" : `Редактирование: ${form.name || form.username}`}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
          saveDisabled={saveDisabled}
          onDelete={editing.mode === "edit" && !editingSelf ? () => handleDelete(editing.row) : undefined}
        >
          {formError && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <TextField
              label="Логин"
              value={form.username}
              onChange={(v) => set("username", v)}
              disabled={editing.mode === "edit"}
              required
              maxLength={64}
              hint={editing.mode === "edit" ? "Логин — идентификатор записи, не редактируется" : undefined}
            />
            <TextField label="Имя" value={form.name} onChange={(v) => set("name", v)} maxLength={128} />
            <SelectField
              label="Роль"
              value={form.role}
              onChange={(v) => set("role", v as Role)}
              options={ROLE_OPTIONS}
              disabled={editingSelf}
              hint={editingSelf ? "Нельзя снять с себя роль admin" : undefined}
            />
            <TextField
              type="password"
              label={editing.mode === "new" ? "Пароль" : "Новый пароль"}
              value={form.password}
              onChange={(v) => set("password", v)}
              placeholder={
                editing.mode === "new" ? `минимум ${MIN_PASSWORD_LENGTH} символа` : "оставьте пустым, чтобы не менять"
              }
              hint={
                editing.mode === "edit"
                  ? "Пусто — пароль не меняется"
                  : `минимум ${MIN_PASSWORD_LENGTH} символа`
              }
            />
          </div>
        </EditorShell>
      )}
    </div>
  )
}
