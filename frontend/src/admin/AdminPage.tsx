import * as React from "react"

import { useAuth } from "@/auth/AuthContext"
import { cn } from "@/lib/utils"

import { adminApi, type AdminEntity } from "./api"
import { EntityList, type EntityColumn } from "./components/EntityList"
import { EditorShell } from "./components/EditorShell"

// Task 7 shell: tab bar + EntityList wired to adminApi.list per tab, and a
// placeholder editor (real per-entity editors land in Tasks 8-10 and will
// replace the placeholder body below with DrinkEditor/ClassicEditor/etc.,
// dropped in via the same `editing` state + EditorShell chrome).
//
// Row shape varies per entity (DrinkAdminOut/ClassicAdminOut/…, see
// backend/app/schemas_admin.py) — not yet typed here since Task 7 only
// needs generic list/search/delete, not full per-field editing.
type Row = Record<string, unknown>

interface TabConfig {
  id: string
  label: string
  entity: AdminEntity
  keyField: string
  adminOnly?: boolean
  columns: EntityColumn<Row>[]
}

const TABS: TabConfig[] = [
  {
    id: "drinks",
    label: "Авторские",
    entity: "drinks",
    keyField: "slug",
    columns: [
      { key: "name", label: "Название" },
      { key: "slug", label: "Слаг" },
      { key: "price_raw", label: "Цена" },
    ],
  },
  {
    id: "classics",
    label: "Классика",
    entity: "classics",
    keyField: "slug",
    columns: [
      { key: "name", label: "Название" },
      { key: "slug", label: "Слаг" },
      { key: "family", label: "Семейство" },
    ],
  },
  {
    id: "spirits",
    label: "Спириты",
    entity: "spirits",
    keyField: "slug",
    columns: [
      { key: "name", label: "Название" },
      { key: "slug", label: "Слаг" },
      { key: "category", label: "Категория" },
    ],
  },
  {
    id: "kitchen",
    label: "Кухня",
    entity: "kitchen-dishes",
    keyField: "slug",
    columns: [
      { key: "name", label: "Название" },
      { key: "slug", label: "Слаг" },
      { key: "category", label: "Категория" },
    ],
  },
  {
    id: "families",
    label: "Семейства",
    entity: "families",
    keyField: "key",
    columns: [
      { key: "label", label: "Название" },
      { key: "key", label: "Ключ" },
    ],
  },
  {
    id: "categories",
    label: "Разделы",
    entity: "categories",
    keyField: "key",
    columns: [
      { key: "label", label: "Название" },
      { key: "key", label: "Ключ" },
      { key: "kind", label: "Тип" },
      { key: "is_visible", label: "Видим", render: (item) => (item.is_visible ? "да" : "нет") },
    ],
  },
  {
    id: "users",
    label: "Юзеры",
    entity: "users",
    keyField: "id",
    adminOnly: true,
    columns: [
      { key: "username", label: "Логин" },
      { key: "name", label: "Имя" },
      { key: "role", label: "Роль" },
    ],
  },
]

type Editing = { mode: "new" } | { mode: "edit"; row: Row } | null

export default function AdminPage() {
  const { user } = useAuth()

  // Юзеры tab only for admins (backend enforces require_admin regardless —
  // this is UX, not the security boundary).
  const visibleTabs = React.useMemo(
    () => TABS.filter((t) => !t.adminOnly || user?.role === "admin"),
    [user?.role]
  )
  const [activeId, setActiveId] = React.useState<string>(visibleTabs[0]?.id ?? "drinks")
  const tab = visibleTabs.find((t) => t.id === activeId) ?? visibleTabs[0]

  const [items, setItems] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Editing>(null)

  const load = React.useCallback(async (entity: AdminEntity) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await adminApi.list<Row>(entity)
      setItems(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (tab) void load(tab.entity)
  }, [tab, load])

  if (!tab) return null

  function getKey(row: Row): string {
    return String(row[tab!.keyField])
  }

  async function handleDelete(row: Row) {
    const label = String(row.name ?? row.label ?? row.username ?? getKey(row))
    if (!window.confirm(`Удалить «${label}»? Это необратимо.`)) return
    try {
      await adminApi.remove(tab!.entity, getKey(row))
      setEditing(null)
      await load(tab!.entity)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Не удалось удалить")
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900">
              ← В справочник
            </a>
            <span className="text-sm font-semibold">Админка</span>
          </div>
          <span className="text-xs text-gray-400">
            {user?.name ?? user?.username} · {user?.role}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={cn(
                "-mb-px rounded-t px-3 py-2 text-sm font-medium",
                t.id === tab.id
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <EntityList
          items={items}
          columns={tab.columns}
          getKey={getKey}
          loading={loading}
          onNew={() => setEditing({ mode: "new" })}
          onEdit={(row) => setEditing({ mode: "edit", row })}
          onDelete={handleDelete}
        />
      </div>

      {editing && (
        <EditorShell
          title={editing.mode === "new" ? `Новый: ${tab.label}` : `Редактирование: ${tab.label}`}
          onClose={() => setEditing(null)}
          onSave={() => setEditing(null)}
          saveDisabled
          onDelete={editing.mode === "edit" ? () => handleDelete(editing.row) : undefined}
        >
          <p className="text-sm text-gray-500">
            Редактор «{tab.label}» появится в следующей задаче. Общие примитивы (поля форм,
            загрузка изображений, теги-связи) уже готовы — здесь будет полноценная форма.
          </p>
        </EditorShell>
      )}
    </div>
  )
}
