# Phase 1b — Frontend on Kollektiv kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the `klktv-cocktails` consumer frontend from scratch on the Kollektiv UI kit's `block-cocktail-guide`, wired to the v2 backend (`auth` + `/api/content` + progress), deployed to Railway parallel to prod.

**Architecture:** React 19 + Vite + TypeScript + Tailwind v4 + Kollektiv shadcn registry. The block's `data.ts` demo consts are replaced by a runtime `ContentContext` fed by a `mapBundle()` adapter over `GET /api/content`; the block's type interfaces and live-progress helpers stay. Auth is cookie-based (`credentials:'include'`). Per-user "learned" comes from `/api/me/progress` (spirits via a `category:name`↔slug map). Real URL routing via the History API. Admin/uploads are out of scope (Phase 2).

**Tech Stack:** React 19, Vite, TypeScript, Tailwind v4, shadcn CLI, `@kollektiv` registry, lucide-react, nginx (deploy).

**Reference:** [phase-1b-frontend-blueprint.md](phase-1b-frontend-blueprint.md) — scaffold steps, field-by-field adapter maps, the kit-block gaps to fix, deploy specifics. This plan is authoritative for code.

## Global Constraints

- **Kit install order:** theme (`@kollektiv/theme`) FIRST; never revert `src/lib/utils.ts` to stock shadcn (breaks the custom text scale + shift-shadows).
- The block files land in `src/pages/cocktail-guide/` and ARE product code — edit them; kit updates flow to `@/components/kollektiv/*`, not the block page.
- **Catalog vs per-user:** `/api/content` carries NO per-user state. Every adapter-mapped item's `learned` = `false` and every `Section.learned`/`Family.learned` = `0` (load-bearing: makes the kit's `reconcile` formula collapse to a pure live count — see blueprint §C).
- Progress kinds: `menu | classics | kitchen | spirits`. Spirits' kit key is the composite `` `${categoryLabel}:${name}` ``; persistence uses `spirit_entries.slug` — translate via a map built from the bundle.
- All API calls: `credentials: 'include'`, base `import.meta.env.VITE_API_URL ?? ''`. `/api/content` requires auth — do not fetch it before auth resolves.
- JSON keys already match kit field names (backend was built to the kit contract). Do not re-map names that already match.
- Preserve prod's closed-menu posture: `noindex/nofollow` meta, `lang="ru"`.
- Merged non-alc: no `zero`/`zc` sections; drinks carry `isAlcoholic`/`isZeroCulture`/`caffeineLevel`/`isCarbonated`; add an Алко/Безалко filter.
- The old `frontend/` (React 18 prod) is replaced. Preserve it in git history; move it aside, don't leave it mixed with the new app.
- Verify each task with `npm run build` (type-check + bundle) and, where a running app is needed, the dev server against the live v2 backend (`VITE_API_URL` → the backend; run backend locally with `set -a; source backend/.env.migration; export COOKIE_SECURE=false COOKIE_SAMESITE=lax UPLOAD_DIR=/tmp/klktv-uploads; set +a; uv run uvicorn app.main:app --port 8000`).

---

## Task 1: Scaffold + kit install

**Files:** new `frontend/` (Vite app), `frontend/components.json`, `frontend/index.html`, `frontend/public/manifest.webmanifest`; move old `frontend/` → `frontend_v1_reference/` (or delete — it's in git history).

- [ ] **Step 1: Preserve + clear the old frontend.** `git mv frontend frontend_v1_reference` (keeps it in-tree for reference during the rebuild; a later cleanup task removes it). We scaffold the new app in a fresh `frontend/`.

- [ ] **Step 2: Scaffold Vite React-TS.** `npm create vite@latest frontend -- --template react-ts && cd frontend && npm install`. Ensure `react`/`react-dom` are `^19` in `package.json` (bump + reinstall if the template pinned older).

- [ ] **Step 3: Tailwind v4.** `npm install -D tailwindcss @tailwindcss/vite`; add `tailwindcss()` to `vite.config.ts` plugins. Tailwind v4 is CSS-first — no `tailwind.config.js`; if shadcn init scaffolds a legacy one, delete it.

- [ ] **Step 4: Path alias `@/*` → `./src/*`** in `tsconfig.json`/`tsconfig.app.json` (`compilerOptions.paths`) and `vite.config.ts` (`resolve.alias`).

- [ ] **Step 5: shadcn init + registry.** `npx shadcn@latest init` (accept defaults). Then edit `frontend/components.json` to add:
```json
"registries": { "@kollektiv": { "url": "https://ui.klktv.tech/r/{name}.json" } }
```

- [ ] **Step 6: Theme FIRST.** `npx shadcn@latest add @kollektiv/theme`. Point `src/main.tsx` at the installed `./kollektiv.css` (not the default `index.css`), and import the `@fontsource/space-grotesk` + `@fontsource/jetbrains-mono` weights the installed `kollektiv.css` header names. Do NOT revert `src/lib/utils.ts`.

- [ ] **Step 7: Install the block + deps + auth-card.**
```
npx shadcn@latest add @kollektiv/page-frame @kollektiv/bottom-nav @kollektiv/media-card \
  @kollektiv/learned-toggle @kollektiv/progress-strip @kollektiv/progress-levels \
  @kollektiv/tint-marker @kollektiv/drawer @kollektiv/sheet @kollektiv/dialog \
  @kollektiv/input @kollektiv/use-media-query @kollektiv/block-cocktail-guide @kollektiv/auth-card
```
Confirms `src/pages/cocktail-guide/{data,shell,views,team-view,detail-sheet,page}.tsx` land, plus `@/components/kollektiv/*`, `@/components/ui/*`, `src/lib/use-media-query.ts`.

- [ ] **Step 8: index.html + manifest** (blueprint §A.11): add `viewport-fit=cover`, `theme-color`, apple-mobile-web-app metas, `manifest.webmanifest` link, `noindex/nofollow` robots metas, `lang="ru"`, title "Kollektiv — Коктейльная карта". Create `public/manifest.webmanifest` (`display:standalone`, theme/background colors, name). Remove the Vite default favicon boilerplate you don't want.

- [ ] **Step 9: Render the block at root.** In `src/App.tsx`, render `<CocktailGuidePage />` (default export from `pages/cocktail-guide/page`). Add `src/.env.example` with `VITE_API_URL=http://localhost:8000`.

- [ ] **Step 10: Build.** `npm run build` succeeds; fix any missing `@/`-import errors (cross-check each `@/components/ui/X` against an installed file). The block renders with its own demo data.

- [ ] **Step 11: Commit** — `git add -A && git commit -m "feat(frontend): scaffold React19+Vite+TS+Tailwind v4 + Kollektiv kit + cocktail-guide block"`

---

## Task 2: API client + auth (AuthProvider / AuthGate / LoginPage)

**Files:** `frontend/src/lib/api.ts`, `frontend/src/auth/AuthContext.tsx`, `frontend/src/auth/AuthGate.tsx`, `frontend/src/auth/LoginPage.tsx`, edit `src/App.tsx`.

- [ ] **Step 1: `src/lib/api.ts`** — typed fetch helper (cookie auth):
```ts
const BASE = import.meta.env.VITE_API_URL ?? ""

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error((data && (data.detail as string)) || res.statusText) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: unknown) => request<T>("POST", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
}
```

- [ ] **Step 2: `src/auth/AuthContext.tsx`** — session bootstrap + login/logout:
```tsx
import * as React from "react"
import { api } from "@/lib/api"

export interface User { id: number; username: string; name: string | null; role: string }
interface AuthValue { user: User | null; loading: boolean; login: (u: string, p: string) => Promise<void>; logout: () => Promise<void> }
const Ctx = React.createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    api.get<User>("/api/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])
  const login = async (username: string, password: string) => {
    const u = await api.post<User>("/api/auth/login", { username: username.trim().toLowerCase(), password })
    setUser(u)
  }
  const logout = async () => { try { await api.post("/api/auth/logout") } catch { /* ignore */ } setUser(null) }
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}
export function useAuth() { const v = React.useContext(Ctx); if (!v) throw new Error("useAuth outside AuthProvider"); return v }
```

- [ ] **Step 3: `src/auth/LoginPage.tsx`** — password-only login on the kit `auth-card`. FIRST read the installed `src/components/kollektiv/auth-card.tsx` to learn its props (it's multi-mode: passkey/telegram/password). Force it to the password step and hide the passkey/telegram entry points (the v2 backend has no such routes). Wire submit → `useAuth().login`; preserve prod UX: trim+lowercase username (done in `login`), clear+refocus password on error, disable submit while pending. If `auth-card`'s API can't be constrained cleanly, fall back to a plain kit `input`+`button` login form styled per canon — document which path you took.

- [ ] **Step 4: `src/auth/AuthGate.tsx`:**
```tsx
import { useAuth } from "./AuthContext"
import { LoginPage } from "./LoginPage"
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />
  return <>{children}</>
}
```

- [ ] **Step 5: Wire App.** `src/App.tsx`: `<AuthProvider><AuthGate>{/* ContentProvider + block, Task 4 */}<CocktailGuidePage/></AuthGate></AuthProvider>`.

- [ ] **Step 6: Verify** — with the backend running locally, `npm run dev`: unauthenticated shows LoginPage; logging in with the seeded `smoke_reader` (or a real user) shows the block; refresh keeps the session. `npm run build` clean. **Commit** — `git commit -m "feat(frontend): cookie-auth API client + AuthProvider/AuthGate/LoginPage"`

---

## Task 3: `mapBundle` adapter (bundle → kit data shapes)

**Files:** `frontend/src/data/bundle.ts` (types for the raw bundle), `frontend/src/data/mapBundle.ts`, `frontend/src/data/spiritKeys.ts`; Test: `frontend/src/data/mapBundle.test.ts` (vitest).

Follow blueprint §B exactly for field maps. Key rules: pass through fields that already match; group flat `spirits` by `categorySlug` into `SpiritGroup[]`; set every `learned=false`/`0`; `dish.nutrition` → `undefined` when all macros null; `dish.category`/`spirit group category` = the category **label**; derive totals.

- [ ] **Step 1: `src/data/bundle.ts`** — TS interfaces mirroring the backend `ContentBundleOut` (drinks/classics/families/spiritCategories/spirits/kitchenCategories/kitchen/sections/filters), field names exactly as the backend emits (camelCase). (Reference: `backend/app/schemas.py`.)

- [ ] **Step 2: `src/data/spiritKeys.ts`:**
```ts
import type { ContentBundle } from "./bundle"
export function buildSpiritKeyMaps(bundle: ContentBundle) {
  const labelBySlug = new Map(bundle.spiritCategories.map(c => [c.slug, c.label]))
  const slugToKey = new Map<string, string>(), keyToSlug = new Map<string, string>()
  for (const s of bundle.spirits) {
    const key = `${labelBySlug.get(s.categorySlug) ?? s.categorySlug}:${s.name}`
    slugToKey.set(s.slug, key); keyToSlug.set(key, s.slug)
  }
  return { slugToKey, keyToSlug }
}
```

- [ ] **Step 3: `src/data/mapBundle.ts`** — pure function returning the kit-data bundle (`MENU, CLASSICS, FAMILIES, SPIRIT_GROUPS, DISHES, SECTIONS, SPIRIT_FILTERS, GLASS_FILTERS, CLASSIC_SPIRITS, SPIRIT_CATEGORIES, KITCHEN_CATEGORIES, TOTAL_POSITIONS, RETIRED_COUNT, CLASSICS_TOTAL`) shaped to the `data.ts` interfaces. Import the kit types (`import type { Cocktail, Classic, Family, SpiritGroup, Dish, Section } from "@/pages/cocktail-guide/data"`). Implement per blueprint §B: drinks→Cocktail (passthrough + `?? 0` numerics + the 4 new flags), classics→Classic (`family as TintName`), families→Family (`total`, `learned:0`), spirits grouped→SpiritGroup (`category`=label, `total`=items.length, spirit `meta` fallback `[country, abv+"% ABV"].filter(Boolean).join(" · ").toUpperCase()`, `region` undefined), kitchen→Dish (`category`=label, `nutrition` undefined-if-all-null), filters with "Все" prepended, `TOTAL_POSITIONS`=Σ section totals.

- [ ] **Step 4: Test (vitest).** `npm install -D vitest`; add `"test": "vitest run"` to package.json. `src/data/mapBundle.test.ts`: feed a hand-built minimal bundle (one alcoholic drink, one non-alc drink, one classic with ourAnswers, two spirits in one category, one dish with nutrition + one without) and assert: MENU length + a non-alc drink present with `isAlcoholic:false`; SPIRIT_GROUPS grouped with correct `total`; a spirit's `meta` non-empty; a dish with all-null macros → `nutrition===undefined`; a dish with macros → nutrition object; every mapped `learned` is `false`; TOTAL_POSITIONS = Σ section totals.

- [ ] **Step 5:** `npm run test` green, `npm run build` clean. **Commit** — `git commit -m "feat(frontend): mapBundle adapter (API bundle → kit data shapes) + spirit key maps"`

---

## Task 4: Wire real content + progress + sign-out into the block

**Files:** `frontend/src/data/ContentContext.tsx`, `frontend/src/data/ProgressContext.tsx`; edit `src/pages/cocktail-guide/{page,shell,views,team-view}.tsx` (import lines + toggle/sign-out wiring); edit `src/App.tsx`.

This is the largest task: it converts the block's static `data.ts` imports to context, replaces `initialLearned()`/`toggle()` with real progress, and threads `user`/`onSignOut` + live total through the shell (fixing the block's dead sign-out + static-badge bugs from blueprint §D/§E.8-9).

- [ ] **Step 1: `src/data/ContentContext.tsx`** — fetch `/api/content` once (after auth), run `mapBundle`, expose the mapped consts + the raw bundle (for spirit key maps) + loading/error:
```tsx
import * as React from "react"
import { api } from "@/lib/api"
import type { ContentBundle } from "./bundle"
import { mapBundle } from "./mapBundle"
import { buildSpiritKeyMaps } from "./spiritKeys"

type Mapped = ReturnType<typeof mapBundle>
interface ContentValue extends Mapped { bundle: ContentBundle; spiritKeys: ReturnType<typeof buildSpiritKeyMaps> }
const Ctx = React.createContext<ContentValue | null>(null)

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ContentValue | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  React.useEffect(() => {
    api.get<ContentBundle>("/api/content")
      .then(b => setState({ ...mapBundle(b), bundle: b, spiritKeys: buildSpiritKeyMaps(b) }))
      .catch(setError)
  }, [])
  if (error) return <div className="p-6 font-mono text-sm">Не удалось загрузить данные. Обновите страницу.</div>
  if (!state) return null
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
export function useContent() { const v = React.useContext(Ctx); if (!v) throw new Error("useContent outside provider"); return v }
```

- [ ] **Step 2: `src/data/ProgressContext.tsx`** — load learned Set + kind-specific toggles (blueprint §C):
```tsx
import * as React from "react"
import { api } from "@/lib/api"
import { useContent } from "./ContentContext"

type Kind = "menu" | "classics" | "kitchen" | "spirits"
interface ProgressValue { learned: Set<string>; toggle: (kind: Kind, slug: string, displayKey: string) => void }
const Ctx = React.createContext<ProgressValue | null>(null)

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { spiritKeys } = useContent()
  const [learned, setLearned] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    api.get<Record<Kind, string[]>>("/api/me/progress").then(p => {
      const s = new Set<string>()
      p.menu.forEach(x => s.add(x)); p.classics.forEach(x => s.add(x)); p.kitchen.forEach(x => s.add(x))
      p.spirits.forEach(slug => { const k = spiritKeys.slugToKey.get(slug); if (k) s.add(k) })
      setLearned(s)
    }).catch(() => {})
  }, [spiritKeys])
  const toggle = (kind: Kind, slug: string, displayKey: string) => {
    setLearned(prev => {
      const was = prev.has(displayKey), next = new Set(prev)
      was ? next.delete(displayKey) : next.add(displayKey)
      const call = was ? api.del(`/api/me/progress/${kind}/${slug}`) : api.post(`/api/me/progress/${kind}/${slug}`)
      call.catch(() => setLearned(prev)) // rollback to the exact prior set
      return next
    })
  }
  return <Ctx.Provider value={{ learned, toggle }}>{children}</Ctx.Provider>
}
export function useProgress() { const v = React.useContext(Ctx); if (!v) throw new Error("useProgress outside provider"); return v }
```

- [ ] **Step 3: Convert `data.ts` consts → context.** In `pages/cocktail-guide/{page,shell,views,team-view}.tsx`, change data imports from `import { MENU, CLASSICS, ... } from "./data"` to destructuring `useContent()` inside each component (keep `import type { ... } from "./data"`). Do NOT change JSX/logic — only the data source. (The interfaces + live-progress helpers stay in `data.ts`; delete only the demo `const` arrays/scalars from `data.ts`, leaving types + helpers.)

- [ ] **Step 4: Replace `page.tsx` learned wiring.** Remove `initialLearned()` and the generic `toggle(id)`. Use `useProgress()`; give each view its kind-specific handler: `onToggle={(id)=>toggle("menu",id,id)}` (menu), `("classics",id,id)`, `("kitchen",id,id)`; spirits: `onToggle={(key)=>toggle("spirits", spiritKeys.keyToSlug.get(key)!, key)}`. Wire the four detail-sheet `onLearnedChange` props to the same. Pass `learned` where the block expects `learnedIds`/`learnedKeys`.

- [ ] **Step 5: Thread `user` + `onSignOut` + live total through the shell** (blueprint §D/§E.8-9). `CocktailGuidePage` gains `user`/`onSignOut` from props (App passes `useAuth()`), plus `total = totalLearnedLive(learned)`. Thread through `CocktailDesktopHeader` (make the avatar chip a clickable menu with name + "Выйти") and `CocktailMobileHeader → CocktailBottomNav → SectionsSheet` (wire the existing inert "ВЫЙТИ ↪" button to `onSignOut`; replace hardcoded "МК"/name with `user`; feed the sheet's progress badge the live `total` instead of the deleted static `TOTAL_LEARNED`).

- [ ] **Step 6: Wire App providers + props.** `src/App.tsx`:
```tsx
function Shell() {
  const { user, logout } = useAuth()
  return <ContentProvider><ProgressProvider>
    <CocktailGuidePage user={user!} onSignOut={logout} />
  </ProgressProvider></ContentProvider>
}
// <AuthProvider><AuthGate><Shell/></AuthGate></AuthProvider>
```

- [ ] **Step 7: Verify** (backend running): login → all four sections show real DB data (26 drinks incl. a non-alc, 67 classics, 74 spirits grouped, 33 dishes); toggle "знаю" on items across all 4 kinds → persists across reload; sign-out works on BOTH desktop and mobile. `npm run build` clean. **Commit** — `git commit -m "feat(frontend): wire real content+progress+sign-out into the block (context refactor, kind-specific toggles, shell fixes)"`

---

## Task 5: Alc/non-alc merge edits (kit files)

**Files:** edit `src/pages/cocktail-guide/{data,views,detail-sheet,shell,page}.tsx`. Follow blueprint §E.1-4,6-7.

- [ ] **Step 1:** `data.ts` `Cocktail` interface: add `isAlcoholic: boolean; isZeroCulture: boolean; caffeineLevel: number | null; isCarbonated: boolean | null`. Narrow `SectionId` to `"menu" | "classics" | "spirits" | "kitchen"`.
- [ ] **Step 2:** `views.tsx` `MenuView`: add a filter row `ТИП` with `["Все","Алко","Безалко"]` + local `alcFilter` state; extend the row predicate with `&& (alcFilter==="Все" || (alcFilter==="Алко")===c.isAlcoholic)`.
- [ ] **Step 3:** `views.tsx` `MenuView` render: when `!c.badge && !c.isAlcoholic`, pass a synthesized `"0%"` INK badge to the media card.
- [ ] **Step 4:** `detail-sheet.tsx` `Meta()`: accept `isAlcoholic`; show `"0%"` instead of `${abv}% ABV` when non-alcoholic.
- [ ] **Step 5:** `shell.tsx`: remove `zero`/`zc` entries from `DESKTOP_TABS`. `page.tsx`: delete the now-unreachable `case "zero": case "zc":` branch (TS will flag it once `SectionId`/`Route` are narrowed).
- [ ] **Step 6:** Verify: Авторские shows the Алко/Безалко filter; a non-alc drink shows a "0%" badge + "0%" in its detail; nav has 5 tabs (no zero/zc); TS compiles clean. `npm run build`. **Commit** — `git commit -m "feat(frontend): merge non-alc into Авторские (alc filter, 0% badge, drop zero/zc nav)"`

---

## Task 6: Real client-side routing (History API)

**Files:** `frontend/src/lib/useUrlRoute.ts`; edit `src/App.tsx` (pass `route`/`onRouteChange` to `CocktailGuidePage`).

- [ ] **Step 1: `src/lib/useUrlRoute.ts`** (blueprint §D):
```ts
import * as React from "react"
import type { Route } from "@/pages/cocktail-guide/shell"
const ROUTES: Route[] = ["menu", "classics", "spirits", "kitchen", "progress"]
const pathFor = (r: Route) => (r === "menu" ? "/" : `/${r}`)
const routeFromPath = (p: string): Route => {
  const seg = p.replace(/^\//, "") as Route
  return ROUTES.includes(seg) ? seg : "menu"
}
export function useUrlRoute() {
  const [route, setRoute] = React.useState<Route>(() => routeFromPath(location.pathname))
  React.useEffect(() => {
    const onPop = () => setRoute(routeFromPath(location.pathname))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const onRouteChange = (r: Route) => { history.pushState(null, "", pathFor(r)); setRoute(r) }
  return { route, onRouteChange }
}
```
(If `Route` isn't exported from `shell.tsx`, add the export — it's a product-owned file.)

- [ ] **Step 2:** In `App.tsx`'s `Shell`, `const { route, onRouteChange } = useUrlRoute()` and pass to `<CocktailGuidePage route={route} onRouteChange={onRouteChange} ... />` (controlled).

- [ ] **Step 3:** Verify: each section has a distinct URL (`/`, `/classics`, `/spirits`, `/kitchen`, `/progress`); browser back/forward switches sections; a dev-server refresh on `/classics` resolves (Vite dev serves index.html; production SPA fallback is Task 11's nginx). `npm run build`. **Commit** — `git commit -m "feat(frontend): real URL routing for sections (History API)"`

---

## Task 7: Spirits "Выведенные" (archive) tab — real browsing

**Files:** edit `src/pages/cocktail-guide/views.tsx` (`SpiritsView`).

The shipped block's archive tab is a placeholder (count + static text). Build real browsing (blueprint §F).

- [ ] **Step 1:** In `SpiritsView`, the archive tab must render the archived categories' spirits (from `SPIRIT_GROUPS` built off `spiritCategories.filter(isArchived)`) using the same `SpiritRow`/`SpiritDetail` mechanism as the active tab. The adapter (Task 3) currently builds `SPIRIT_GROUPS` from non-archived only — extend `mapBundle` to also expose `SPIRIT_GROUPS_ARCHIVED` (same shape, archived categories), and have `SpiritsView`'s "Выведенные" tab render those. Category-filter matching: compare by `categorySlug` (robust) rather than capitalized label (blueprint §B risk note).
- [ ] **Step 2:** Verify: toggling to "Выведенные" lists archived spirit categories + entries; they open in the flash-card detail sheet like active ones. `npm run build`. **Commit** — `git commit -m "feat(frontend): real archived-spirits browsing (Выведенные tab)"`

---

## Task 8: Non-alc detail-sheet parity (caffeine + carbonation)

**Files:** edit `src/pages/cocktail-guide/detail-sheet.tsx` (`CocktailDetail`).

- [ ] **Step 1:** Add two optional sections to `CocktailDetail`, gated on the drink's fields: a caffeine dot-meter (3 dots) when `caffeineLevel != null`; a "◉ Газированный"/"◯ Без газа" indicator when `isCarbonated != null` (blueprint §E.5). Reproduces the old ZC detail indicators within the unified sheet.
- [ ] **Step 2:** Verify: a non-alc/ZC drink with caffeine/carbonation shows both indicators; an alcoholic drink shows neither. `npm run build`. **Commit** — `git commit -m "feat(frontend): caffeine + carbonation indicators in non-alc drink detail"`

---

## Task 9: Progress "Команда" tab cleanup

**Files:** edit `src/pages/cocktail-guide/page.tsx` (`ProgressWithTeam`).

- [ ] **Step 1:** No backend endpoint provides team-wide staff progress, so the "Команда"/`TeamView` numbers are fabricated demo data. Drop the "Мой"/"Команда" tab switcher and always render `ProgressView` (real personal progress). Keep `FamiliesPanel` (reads real CLASSICS/FAMILIES) intact (blueprint §E.10).
- [ ] **Step 2:** Verify: Progress page shows only real personal ("Мой") numbers; no fabricated team stats; `FamiliesPanel` drill still works on mobile classics. `npm run build`. **Commit** — `git commit -m "feat(frontend): drop fabricated Команда tab; keep real personal progress"`

---

## Task 10: Feature-parity verification pass

**Files:** none (verification) — or small fixes if gaps surface.

- [ ] **Step 1:** With the app running against the live backend, walk the blueprint §F parity table end-to-end (auth/nav/cocktails/classics+theory/spirits+archive/kitchen/progress×2/search/filters/learned/detail-sheets/cross-links). For each: confirm it works or record an explicit deferral. Fix any small gap found in practice (e.g. filter-pill active auto-centering if pixel-parity is wanted).
- [ ] **Step 2:** Confirm the two "invisible" prod features: spirit "В коктейлях" now renders (via `pairings`); timeline explicitly deferred.
- [ ] **Step 3:** Remove `frontend_v1_reference/` now that parity is verified: `git rm -r frontend_v1_reference`. **Commit** — `git commit -m "chore(frontend): parity pass complete; remove old v1 reference frontend"`

---

## Task 11: Deploy to Railway (parallel to prod)

**Files:** `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/railway.json`.

- [ ] **Step 1: `Dockerfile`** — 2-stage node build → nginx (blueprint §G): `ARG VITE_API_URL`; `npm ci`; `npm run build`; copy `dist` to nginx; templated `PORT`.
- [ ] **Step 2: `nginx.conf`** — static SPA serve with `try_files $uri $uri/ /index.html` (SPA fallback is required now that routes deep-link), asset caching, `no-store` on index.html. No `/api` proxy needed (v2 backend uses `SameSite=none` cross-origin cookies).
- [ ] **Step 3: `railway.json`** — DOCKERFILE builder, `restartPolicyType: ON_FAILURE`, no healthcheck (static server).
- [ ] **Step 4: Cross-service** — document (in the report + README) that the new frontend's Railway domain must be appended to the v2 backend service's `CORS_ORIGINS` env (exact origin, for the `allow_credentials` cookie flow), and `VITE_API_URL` (build arg) must point at the v2 backend domain.
- [ ] **Step 5: Verify build** — `docker build --build-arg VITE_API_URL=<backend> -t klktv-v2-front .` succeeds and `docker run` serves the SPA + SPA-fallback resolves `/classics` (or the local-equivalent if Docker unavailable: `npm run build` + `npx serve dist -s` and check a deep route resolves). Document what was verified. **Commit** — `git commit -m "feat(frontend): Railway deploy (Dockerfile + nginx SPA + railway.json)"`

---

## Self-Review (done during planning)

- **Spec coverage:** blueprint §A→T1; §D auth→T2; §B adapter→T3; §B/§C/§D/§E.8-9 wiring→T4; §E merge→T5; §D routing→T6; §F archive→T7; §E.5 non-alc detail→T8; §E.10 team→T9; §F parity→T10; §G deploy→T11. Feature-parity checklist (blueprint §F) is the T10 gate.
- **Placeholder scan:** glue tasks (T2/T3/T4/T6) carry complete code; kit-edit tasks (T5/T7/T8/T9) are precise edits against the block files whose structure is documented in the blueprint (the implementer reads the installed files). No "TBD".
- **Type consistency:** `mapBundle` returns the kit `data.ts` interfaces (imported as types); `ProgressContext` kinds match the backend's `menu/classics/kitchen/spirits`; `useUrlRoute` uses `Route` from `shell.tsx`.

## Notes for the executor / out of scope
- **Admin/uploads/users** (old inventory §1.15-1.18) are Phase 2 (backend routers unmounted + stale schema).
- **Deferred:** History/timeline section; image-color extraction (kit uses flat INK thumbs by design — accepted visual difference); token-revocation.
- **Content gaps (null in UI until backfilled):** spirit `meta` short tag (synthesized fallback) + `region`; dish `allergens`; classic `ourAnswers` custom labels.
- **Cutover** (DNS switch, final ETL, password rotation) is a later human decision, not part of 1b.
