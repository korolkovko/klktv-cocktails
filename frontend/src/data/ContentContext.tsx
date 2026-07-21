// Fetches GET /api/content once (after AuthGate has resolved a user — see
// App.tsx's provider order) and exposes the mapBundle()-shaped consts + the
// raw bundle (spirit key maps need it) + a loading/error gate. Task 4 wiring
// (blueprint §B/§D); replaces the block's static `data.ts` const imports.

import * as React from "react"
import { api } from "@/lib/api"
import { GuideSkeleton } from "@/components/guide-skeleton"
import type { ContentBundle } from "./bundle"
import { mapBundle } from "./mapBundle"
import { buildSpiritKeyMaps } from "./spiritKeys"

type Mapped = ReturnType<typeof mapBundle>
interface ContentValue extends Mapped {
  bundle: ContentBundle
  spiritKeys: ReturnType<typeof buildSpiritKeyMaps>
}
const Ctx = React.createContext<ContentValue | null>(null)

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ContentValue | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  React.useEffect(() => {
    api
      .get<ContentBundle>("/api/content")
      .then((b) => setState({ ...mapBundle(b), bundle: b, spiritKeys: buildSpiritKeyMaps(b) }))
      .catch(setError)
  }, [])
  if (error) return <div className="p-6 font-mono text-sm">Не удалось загрузить данные. Обновите страницу.</div>
  if (!state) return <GuideSkeleton />
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
export function useContent() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error("useContent outside provider")
  return v
}
