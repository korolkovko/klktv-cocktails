import * as React from "react"

import { useAuth } from "@/auth/AuthContext"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"

import { DrinksPage } from "./editors/DrinksPage"
import { ClassicsPage } from "./editors/ClassicsPage"
import { SpiritsPage } from "./editors/SpiritsPage"
import { KitchenPage } from "./editors/KitchenPage"
import { FamiliesPage } from "./editors/FamiliesPage"
import { CategoriesPage } from "./editors/CategoriesPage"
import { UsersPage } from "./editors/UsersPage"

// Admin shell (Phase-2 kit redesign). Every content tab is now a
// self-contained kit page (admin/editors/*Page.tsx) that owns its own
// §54 EntityTable + toolbar + §50 ResponsiveDialog form + delete flow, wired
// to adminApi — so this shell only picks which page to mount per tab and keeps
// the tab gating (Юзеры is admin-only; the backend enforces require_admin
// regardless — this is UX, not the security boundary). The full shell
// treatment (page-frame / header-menu, §01/§37) is Phase 3; this pass keeps a
// light kit-token chrome so the shell and the kit pages read as one surface.
interface Tab {
  id: string
  label: string
  adminOnly?: boolean
  render: (ctx: { currentUsername?: string | null }) => React.ReactNode
}

const TABS: Tab[] = [
  { id: "drinks", label: "Авторские", render: () => <DrinksPage /> },
  { id: "classics", label: "Классика", render: () => <ClassicsPage /> },
  { id: "spirits", label: "Спириты", render: () => <SpiritsPage /> },
  { id: "kitchen", label: "Кухня", render: () => <KitchenPage /> },
  { id: "families", label: "Семейства", render: () => <FamiliesPage /> },
  { id: "categories", label: "Разделы", render: () => <CategoriesPage /> },
  {
    id: "users",
    label: "Юзеры",
    adminOnly: true,
    render: (ctx) => <UsersPage currentUsername={ctx.currentUsername} />,
  },
]

export default function AdminPage() {
  const { user } = useAuth()

  const visibleTabs = React.useMemo(
    () => TABS.filter((t) => !t.adminOnly || user?.role === "admin"),
    [user?.role]
  )
  const [activeId, setActiveId] = React.useState<string>(visibleTabs[0]?.id ?? "drinks")
  const tab = visibleTabs.find((t) => t.id === activeId) ?? visibleTabs[0]

  if (!tab) return null

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground hover:text-foreground"
            >
              ← В справочник
            </a>
            <span className="text-sm font-semibold">Админка</span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.04em] text-muted-foreground">
            {user?.name ?? user?.username} · {user?.role}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={cn(
                "-mb-px rounded-t px-3 py-2 text-sm font-medium transition-colors",
                t.id === tab.id
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab.render({ currentUsername: user?.username })}
      </div>

      {/* kit toasts (sonner) — all content pages surface success/errors here */}
      <Toaster />
    </div>
  )
}
