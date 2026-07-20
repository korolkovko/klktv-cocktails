// Loads the per-user learned-Set from GET /api/me/progress and exposes a
// kind-specific `toggle(kind, slug, displayKey)` with optimistic update +
// rollback on failure (blueprint §C). Nests inside ContentProvider — needs
// `spiritKeys` (built from the bundle) to translate spirit DB slugs into the
// kit's composite `${categoryLabel}:${name}` learned-key.

import * as React from "react"
import { api } from "@/lib/api"
import { useContent } from "./ContentContext"

type Kind = "menu" | "classics" | "kitchen" | "spirits"
interface ProgressValue {
  learned: Set<string>
  toggle: (kind: Kind, slug: string, displayKey: string) => void
}
const Ctx = React.createContext<ProgressValue | null>(null)

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { spiritKeys } = useContent()
  const [learned, setLearned] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    api
      .get<Record<Kind, string[]>>("/api/me/progress")
      .then((p) => {
        const s = new Set<string>()
        p.menu.forEach((x) => s.add(x))
        p.classics.forEach((x) => s.add(x))
        p.kitchen.forEach((x) => s.add(x))
        p.spirits.forEach((slug) => {
          const k = spiritKeys.slugToKey.get(slug)
          if (k) s.add(k)
        })
        setLearned(s)
      })
      .catch(() => {})
  }, [spiritKeys])
  const toggle = (kind: Kind, slug: string, displayKey: string) => {
    setLearned((prev) => {
      const was = prev.has(displayKey)
      const next = new Set(prev)
      was ? next.delete(displayKey) : next.add(displayKey)
      const call = was ? api.del(`/api/me/progress/${kind}/${slug}`) : api.post(`/api/me/progress/${kind}/${slug}`)
      call.catch(() => setLearned(prev)) // rollback to the exact prior set
      return next
    })
  }
  return <Ctx.Provider value={{ learned, toggle }}>{children}</Ctx.Provider>
}
export function useProgress() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error("useProgress outside provider")
  return v
}
