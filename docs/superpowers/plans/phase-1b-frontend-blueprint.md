# Phase 1b Blueprint — klktv-cocktails v2 frontend on the Kollektiv kit

Read-only research output. Scope: rebuild the FRONTEND on the Kollektiv UI kit's
`block-cocktail-guide`, wired to the already-built v2 backend
(`auth`, `content`, `me` routers only — see scope note in §F).

---

## A. Scaffold & kit install

**Confirmed facts used below:**
- Kit requires React 19 + Tailwind v4 + shadcn CLI; registry is
  `"@kollektiv": { "url": "https://ui.klktv.tech/r/{name}.json" }`.
- Theme (`@kollektiv/theme`) must install FIRST — it ships `src/kollektiv.css`
  (target for `src/index.css`) and an **extended** `src/lib/utils.ts` (`cn`
  aware of the kit's custom text scale + shift-shadows). npm deps it pulls:
  `@fontsource/jetbrains-mono`, `@fontsource/space-grotesk`, `clsx`,
  `tailwind-merge`, `tw-animate-css`.
- `block-cocktail-guide`'s own `registryDependencies` (from
  `block-cocktail-guide.json`):
  `@kollektiv/page-frame`, `@kollektiv/bottom-nav`, `@kollektiv/media-card`,
  `@kollektiv/learned-toggle`, `@kollektiv/progress-strip`,
  `@kollektiv/progress-levels`, `@kollektiv/tint-marker`, `@kollektiv/drawer`,
  `@kollektiv/sheet`, `@kollektiv/dialog`, `@kollektiv/input`,
  `@kollektiv/use-media-query`; plus npm dep `lucide-react`.
  (Note: `@kollektiv/sheet` lands but isn't actually imported by any of the 6
  block files as-shipped — only `dialog`/`drawer`/`input` are used. Harmless;
  don't hand-remove it — that would fork the block per canon's "no manual
  edits to registryDependencies" rule.)
- The block's files land at **`src/pages/cocktail-guide/`** (confirmed from
  `block-cocktail-guide.json`'s `files[].target`):
  `data.ts`, `shell.tsx`, `views.tsx`, `team-view.tsx`, `detail-sheet.tsx`,
  `page.tsx`. From this point they are **product code** — kit updates flow
  into the `@/components/kollektiv/*` components they import, not into this
  page.
- `auth-card` (needed for login, §D) is a separate registry item, NOT a
  `block-cocktail-guide` dependency — install it explicitly. Its own
  `registryDependencies`: `@kollektiv/spinner`.

**Ordered steps:**

1. Scaffold: `npm create vite@latest frontend -- --template react-ts`, then
   `cd frontend && npm install`. Confirm `react`/`react-dom` resolve to `^19`
   (bump in `package.json` if the Vite template pinned an older major).
2. Tailwind v4: `npm install -D tailwindcss @tailwindcss/vite`; add the
   `tailwindcss()` plugin to `vite.config.ts`; Tailwind v4 is CSS-first (no
   `tailwind.config.js` needed) — if `shadcn init` (next step) scaffolds a
   legacy JS config, delete it.
3. Path alias: ensure `@/*` → `./src/*` in `tsconfig.json`/`tsconfig.app.json`
   and `vite.config.ts` `resolve.alias` (shadcn init usually sets this up when
   asked; verify it did).
4. `npx shadcn@latest init` — accept defaults (style, neutral base color, CSS
   variables) since the theme install overrides tokens anyway. This creates
   `components.json` + a stock `src/lib/utils.ts` (about to be replaced).
5. Edit `components.json` to register the kit's registry:
   ```json
   {
     "registries": {
       "@kollektiv": { "url": "https://ui.klktv.tech/r/{name}.json" }
     }
   }
   ```
6. **Theme first**: `npx shadcn@latest add @kollektiv/theme`. This overwrites
   `src/lib/utils.ts` with the extended `cn` and installs `src/kollektiv.css`.
   **Gotcha (canon):** never revert `lib/utils.ts` to the stock shadcn version
   afterward — stock `twMerge` doesn't know the kit's custom text scale /
   shift-shadow utilities and will silently break spacing/typography.
7. Wire the stylesheet: point the app's entry (`src/main.tsx`) at
   `./kollektiv.css` instead of the default `./index.css`; import the two
   `@fontsource` packages' CSS per whatever weights `kollektiv.css`'s own
   header comment specifies (inspect the installed file once it lands —
   Space Grotesk for UI text, JetBrains Mono for all numerals/mono labels
   per canon's "Визуальный язык").
8. Install the block's full dependency graph + the block itself (safe to
   list explicitly even though `shadcn add` resolves `registryDependencies`
   recursively — deterministic and matches the canon's declared graph):
   ```
   npx shadcn@latest add @kollektiv/page-frame @kollektiv/bottom-nav \
     @kollektiv/media-card @kollektiv/learned-toggle @kollektiv/progress-strip \
     @kollektiv/progress-levels @kollektiv/tint-marker @kollektiv/drawer \
     @kollektiv/sheet @kollektiv/dialog @kollektiv/input \
     @kollektiv/use-media-query @kollektiv/block-cocktail-guide
   ```
   This lands `src/pages/cocktail-guide/*` (see file list above),
   `src/components/kollektiv/{page-frame,bottom-nav,media-card,
   learned-toggle,progress-strip,progress-levels,tint-marker}.tsx`,
   `src/components/ui/{drawer,dialog,sheet,input,button}.tsx` (dialog/sheet
   each transitively pull `@kollektiv/button`), `src/lib/use-media-query.ts`,
   and the `lucide-react`/`vaul`/`radix-ui` npm deps.
9. Install auth (not part of the block): `npx shadcn@latest add @kollektiv/auth-card`
   (pulls `@kollektiv/spinner`).
10. Sanity check: `npm run build`. Fix any missing `@/`-import errors (canon's
    "проверка гвоздём" — cross-check every `@/components/ui/X` import against
    an installed file).
11. PWA / iOS-standalone meta (kit wires the component-level insets; the
    document-level meta is the **product's** job per canon — without it
    `env(safe-area-inset-*)` returns 0 and the kit's own insets are inert).
    Add to `index.html` `<head>`:
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#FFFFFF" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
    <meta name="googlebot" content="noindex, nofollow" />
    <meta name="yandex" content="noindex, nofollow" />
    <title>Kollektiv — Коктейльная карта</title>
    ```
    (`noindex` etc. carried over verbatim from the old prod `index.html` —
    still a closed menu.) Add `public/manifest.webmanifest`:
    ```json
    { "display": "standalone", "theme_color": "#FFFFFF", "background_color": "#FBFBF9",
      "name": "Kollektiv", "short_name": "Kollektiv", "start_url": "/" }
    ```
    This is a **new capability** vs. old prod (which had no manifest/PWA
    support at all) — the canon explicitly expects it, worth calling out as
    an intentional addition, not scope creep.
12. `.env` / `.env.example`: `VITE_API_URL=http://localhost:8000` for local
    dev (matches the old frontend's convention; backend already expects
    `CORS_ORIGINS`/cookie settings keyed off this, see §D/§G).

---

## B. Adapter layer (bundle → kit data shapes)

**Architecture note (read this first):** `views.tsx`, `shell.tsx`,
`page.tsx`, `team-view.tsx` all do `import { MENU, CLASSICS, ... } from
"./data"` — i.e. they read **module-level constants**, not props. A static
`const` can't become "the real API response." The correct integration (and
what canon means by "data.ts is a demo stub, replace it, don't touch the
markup") is:

- **Keep in `data.ts`**: every `export interface`/`export type` (`Cocktail`,
  `Classic`, `Family`, `Spirit`, `SpiritGroup`, `Dish`, `DishNutrition`,
  `Section`, `SectionId`, `Staff`) and the four live-progress helper
  functions (`reconcile`, `classicsLearnedLive`, `familyLearnedLive`,
  `sectionLearnedLive`, `totalLearnedLive`) — these are pure functions of
  `(catalog, items, learnedIds)` and work unchanged against real data (see
  §C for why).
- **Replace with runtime data**: every `export const` array/scalar (`MENU`,
  `CLASSICS`, `FAMILIES`, `SPIRIT_GROUPS`, `DISHES`, `SECTIONS`,
  `SPIRIT_FILTERS`, `GLASS_FILTERS`, `CLASSIC_SPIRITS`, `SPIRIT_CATEGORIES`,
  `KITCHEN_CATEGORIES`, `TOTAL_POSITIONS`, `TOTAL_LEARNED`, `RETIRED_COUNT`,
  `CLASSICS_TOTAL`).
- Mechanically: add a `ContentContext`/`useContent()` (can live alongside the
  `ContentProvider` from §D) whose value is `mapBundle(bundle)`'s output
  shaped exactly like the above consts, and change the **import lines only**
  in `views.tsx`/`shell.tsx`/`page.tsx`/`team-view.tsx` from
  `import { MENU, ... } from "./data"` to `const { MENU, ... } = useContent()`
  (types still imported with `import type {...} from "./data"`). JSX/logic in
  those files stays untouched.

### `mapBundle(bundle: ContentBundle): KitData`

**Global rule:** every mapped item's `learned` field is set to `false`
(and every `Section.learned`/`Family.learned` is set to `0`). This is not a
placeholder — it's load-bearing, see §C.

**Cocktail ← `bundle.drinks[]` (`DrinkOut`)** — near-1:1, already
kit-shaped by design:

| kit field | source | note |
|---|---|---|
| `id` | `d.id` | = slug |
| `name`, `logo`, `subtitle` | passthrough | |
| `price`, `volume`, `abv` | `?? 0` fallback | all nullable on backend |
| `spirit`, `spirits`, `glass`, `descriptors` | passthrough | descriptors already UPPERCASE from backend |
| `badge` | `d.badge as MenuBadge \| undefined` | backend already emits `"HOT"/"BOTTLED"/"PREMIUM"/"ONESIP"` — direct cast, no transform |
| `recipe`,`garnish`,`pitch`,`photo`,`about`,`naming`,`faq` | passthrough | |
| `learned` | `false` | static, see §C |
| `isAlcoholic`,`isZeroCulture`,`caffeineLevel`,`isCarbonated` | passthrough | **new fields — requires the `Cocktail` type extension in §E** |

**Classic ← `bundle.classics[]` (`ClassicOut`)**: `id`,`name`,`year`,`city`,
`spirit`,`glass`,`descriptors`,`recipe`,`garnish`,`history`,`fits`,
`ourAnswers` all passthrough 1:1. `family: c.family as TintName` — cast;
**verify** the 9 `TintName` union values
(`sour|daisy|mary|negroni|martini|manhattan|highball|spritz|dessert`) exactly
match the DB's `family.key` values (parity-check task, not just an adapter
detail — a 10th family or a typo'd key breaks the cast silently to
`undefined` tint styling). `learned: false` static.

**Family ← `bundle.families[]` (`FamilyOut`)**: `tint`,`code`,`title`,
`logic`,`evolution`,`tip` passthrough, `total: f.total`. `learned: 0` static
(see §C — this is the one that makes `familyLearnedLive` correct).

**SpiritGroup ← `bundle.spirits[]` grouped by `categorySlug`**, ordered per
`bundle.spiritCategories` (non-archived only for the "В карте" tab):
```
category: spiritCategories.find(c => c.slug === categorySlug).label
total: items.length   // no per-category total on the wire — derive it
items: mapped Spirit[]
```
Spirit item fields:

| kit field | source | note |
|---|---|---|
| `name`,`abv`,`country`,`flavour`,`brand`,`brandDetail`,`features`,`sourceUrl`,`img` | passthrough | `abv ?? 0` |
| `pairings` | `e.pairings` | **this is the old-prod bug fix** — old frontend read `entry.cocktail_pairings` but the normalizer gave `entry.cocktailPairings`, so "В коктейлях" never rendered (frontend-inventory §5). Backend now serializes `pairings` correctly and the kit's `SpiritDetail` already reads `s.pairings` — passthrough is all that's needed. |
| `fact` | `e.fact` | |
| `learned` | `false` | static |
| `meta` | **NO backend source — GAP** | kit's `meta` is a bespoke composed display string (e.g. `"ЛОНДОН ДРАЙ · 43.1%"`, mixing style/region/botanical-count copy that doesn't exist as a single DB column). Synthesize a fallback: `` [e.country, `${abv}% ABV`].filter(Boolean).join(" · ").toUpperCase() ``. Flagged in phase-1a as a known gap. |
| `region` | **NO backend column — GAP** | leave `undefined`; backend only has `country`. `SpiritDetail`'s "СТРАНА / РЕГИОН" section degrades gracefully (shows country only). |

**Risk to flag (spirit category filter casing):** the demo data stores
`SpiritGroup.category` as ALL-CAPS ("ДЖИН") and the filter pill list
`SPIRIT_CATEGORIES` as Title-Case ("Джин"), reconciled via a `cap()` helper
in `views.tsx` (`cap(g.category) === cat`). If the real
`spiritCategories[].label` values in the DB aren't in a casing `cap()` can
round-trip losslessly against the filter list, the category filter will
silently stop matching. Two fixes, either acceptable:
(a) ensure seed data's spirit-category labels follow the same convention, or
(b) a one-line `SpiritsView` edit to compare by `categorySlug` instead of the
capitalized label string (more robust; recommended if touching the file
anyway for the archive-tab work in §F).

**Dish ← `bundle.kitchen[]` (`KitchenDishOut`)**:

| kit field | source | note |
|---|---|---|
| `id`,`name`,`subtitle`,`price`,`weight`,`timing`,`photo`,`description`,`serving`,`fact` | passthrough | |
| `category` | `kitchenCategories.find(c => c.slug === k.categorySlug).label` | kit's `category` is a **display code** used both for grouping and equality (`d.category === course.code`) — map to the category's `label`, not its slug |
| `learned` | `false` | static |
| `allergens` | **NO backend field — GAP** | leave `undefined`; `DishDetail`'s "АЛЛЕРГЕНЫ / СТОП" section is conditionally rendered, degrades gracefully to absent (matches phase-1a's noted gap) |
| `nutrition` | conditional | `KitchenDishOut.nutrition` is **always present** (a `DishNutritionOut()` default with all-`None` fields), never `undefined` — but kit's `Dish.nutrition?` gates the whole КБЖУ grid on plain truthiness. Map to `undefined` explicitly when every one of `kcal/protein/fat/carb` is `null`, otherwise `{kcal: n.kcal ?? 0, protein: n.protein ?? 0, fat: n.fat ?? 0, carb: n.carb ?? 0}` — **without this check every dish shows an empty КБЖУ grid of zeros.** |

**KitchenCategory ← `bundle.kitchenCategories[]`**: `code: kc.label`,
`total:` count of `bundle.kitchen` items whose `categorySlug === kc.slug`
(computed client-side — the bundle gives no per-category counts).

**SECTIONS ← `bundle.sections[]` (`SectionOut`)**: `{id: s.id as SectionId,
label: s.label, total: s.total, learned: 0}`. Since `content.py` only builds
sections for `Category.kind ∈ {menu, classics, spirits, kitchen}`, the
backend will never emit `zero`/`zc` — `SectionId` should be narrowed to match
(§E).

**Filters ← `bundle.filters`** (+ "Все" sentinel prepended):
```
SPIRIT_FILTERS  = ["Все", ...bundle.filters.spirits]
GLASS_FILTERS   = ["Все", ...bundle.filters.glasses]
CLASSIC_SPIRITS = ["Все", ...bundle.filters.classicSpirits]
SPIRIT_CATEGORIES = ["Все", ...bundle.spiritCategories.filter(c => !c.isArchived).map(c => c.label)]
```

**Derived totals:**
```
TOTAL_POSITIONS = sum(bundle.sections.map(s => s.total))
TOTAL_LEARNED   = 0   // static baseline only — see §C/§E for the real-time badge bug this exposes
RETIRED_COUNT   = bundle.spirits.filter(s => spiritCategories[s.categorySlug].isArchived).length
CLASSICS_TOTAL  = bundle.sections.find(s => s.id === "classics").total
```

---

## C. Progress + learned-set wiring

### The static-baseline trick (why every mapped `learned` must be `false`/`0`)

The kit's own helpers compute "live" progress as
`reconcile(catalog, items, learnedIds) = catalog − staticLearned(items) +
liveLearned(items ∩ learnedIds)`. In the demo, `catalog` (e.g. `fam.learned`)
and each item's static `.learned` encode seed-data state. Our backend has
**no per-item "learned" concept at all** in `/api/content` (learned state is
per-user and lives only behind `/api/me/progress`) — so if the adapter sets
every static baseline to `0`/`false` (per §B), the formula collapses to
exactly `liveLearned(items ∩ learnedIds)`, i.e. a pure count from the real
per-user `Set<string>`. **This is required, not optional** — leaving any
static `learned: true` in mapped data permanently offsets every progress
number.

### Building the `learned: Set<string>` from `GET /api/me/progress`

Response shape: `{menu: string[], classics: string[], spirits: string[],
kitchen: string[]}` — slugs, straight from each model's `.slug` column. Three
of the four kinds (`menu`/`classics`/`kitchen`) use the same slug as the
kit's item `id`, so they go into the Set unchanged. `spirits` is the odd one:
the kit's internal learned-key for spirits is the **composite string**
`` `${categoryLabel}:${name}` `` (see `data.ts`'s
`sectionLearnedLive`/`SpiritsView`/`page.tsx`), not the DB slug. Build a
bidirectional map once, when the content bundle loads:

```ts
function buildSpiritKeyMaps(bundle: ContentBundle) {
  const labelBySlug = new Map(bundle.spiritCategories.map(c => [c.slug, c.label]))
  const slugToKey = new Map<string, string>()
  const keyToSlug = new Map<string, string>()
  for (const s of bundle.spirits) {
    const key = `${labelBySlug.get(s.categorySlug) ?? s.categorySlug}:${s.name}`
    slugToKey.set(s.slug, key)
    keyToSlug.set(key, s.slug)
  }
  return { slugToKey, keyToSlug }
}

async function loadLearned(spiritKeyMaps: ReturnType<typeof buildSpiritKeyMaps>) {
  const progress = await api.get<{menu: string[]; classics: string[]; spirits: string[]; kitchen: string[]}>('/api/me/progress')
  const set = new Set<string>()
  progress.menu.forEach(s => set.add(s))
  progress.classics.forEach(s => set.add(s))
  progress.kitchen.forEach(s => set.add(s))
  progress.spirits.forEach(slug => { const key = spiritKeyMaps.slugToKey.get(slug); if (key) set.add(key) })
  return set
}
```

### Toggle: replace `page.tsx`'s single generic `toggle(id)`

`page.tsx` currently calls one ambiguous `toggle(id: string)` from four
distinct call sites (`MenuView.onToggle`, `ClassicsView.onToggle`,
`SpiritsView.onToggle`, `KitchenView.onToggle`, plus the four
`onLearnedChange` handlers in the detail sheets). **Don't** try to infer
`kind` from a bare id at a single shared call site (slug collisions across
tables are a real, if unlikely, risk) — each call site already knows its own
`kind` statically, so give each one its own thin wrapper around one
persistence core:

```ts
async function persistToggle(kind: 'menu'|'classics'|'kitchen'|'spirits', slug: string, displayKey: string,
                              learned: Set<string>, setLearned: (s: Set<string>) => void) {
  const was = learned.has(displayKey)
  const optimistic = new Set(learned); was ? optimistic.delete(displayKey) : optimistic.add(displayKey)
  setLearned(optimistic)
  try {
    if (was) await api.delete(`/api/me/progress/${kind}/${slug}`)
    else await api.post(`/api/me/progress/${kind}/${slug}`, {})
  } catch {
    setLearned(learned)   // rollback to the exact prior Set — same pattern as old prod's useProgress.jsx
  }
}

const toggleMenu     = (id: string)  => persistToggle('menu', id, id, learned, setLearned)
const toggleClassic  = (id: string)  => persistToggle('classics', id, id, learned, setLearned)
const toggleKitchen  = (id: string)  => persistToggle('kitchen', id, id, learned, setLearned)
const toggleSpirit   = (key: string) => persistToggle('spirits', keyToSlug.get(key)!, key, learned, setLearned)
```

Wire each `page.tsx` call site (view `onToggle` props and detail-sheet
`onLearnedChange` props) to the matching kind-specific function instead of a
single generic `toggle`. This is a mechanical rewrite of `page.tsx`'s
`initialLearned()`/`toggle()` block (lines ~28–35, ~69–75) plus its ~8
call-site references.

---

## D. Auth + routing + shell wiring

### Auth

- **`api` fetch helper** — port `frontend/src/auth/api.js` to TS verbatim
  (proven pattern): `credentials: 'include'` on every call, base URL
  `import.meta.env.VITE_API_URL ?? ''`, non-2xx → `Error(detail)` with
  `.status`, 204 → `null`.
- **`AuthProvider`**: on mount, `GET /api/auth/me`; exposes
  `{user, loading, login, logout}`. `login(username, password)` →
  `POST /api/auth/login`; `logout()` → `POST /api/auth/logout` (swallow
  network errors, same as old prod) then clears `user`.
- **`AuthGate`**: `loading` → render nothing/minimal splash (no spinner in
  old prod either); no `user` → render `LoginPage`; else render children.
  **Important ordering constraint**: `content.py`'s router has
  `dependencies=[Depends(get_current_user)]` on the whole router — `/api/content`
  itself requires auth. `ContentProvider` must not fetch until `AuthGate`
  has resolved a user, mirroring old prod's provider order:
  `AuthProvider → AuthGate → ContentProvider → ProgressProvider → app`.
- **`LoginPage`** built on the installed `auth-card`: the v2 backend
  **only** supports username+password (`POST /api/auth/login` —
  `auth.py` has no passkey/telegram routes at all), but `auth-card` is a
  multi-mode component (passkey primary / telegram secondary / password
  fallback, controlled via `state`+`onStateChange`, 5-attempt lockout).
  Read the installed `src/components/kollektiv/auth-card.tsx` once it lands
  to find how to force it straight into its password step (hide/disable the
  passkey and telegram entry points) — there is no backend surface for
  those two modes in phase 1b. Wire the password submit to `login()`; verify
  the installed component preserves old-prod's UX details (username
  trim+lowercase before send, password-clear-and-refocus on error,
  submit-disabled-while-pending) — these aren't guaranteed by the kit's
  generic description and should be spot-checked against the installed
  source.
- All API calls (content, me, auth) use `credentials: 'include'`;
  cross-origin cookie auth works because the v2 backend already defaults
  `COOKIE_SAMESITE=none` in the prod env template — no same-origin nginx
  proxy trick is required (unlike old prod, see §G).

### Auth-wiring gaps found in the block itself (must fix, not optional)

Reading `page.tsx`/`shell.tsx` closely surfaces real, pre-existing gaps that
have nothing to do with alc/non-alc:

1. `CocktailGuideProps` declares `onSignOut?: () => void` in its JSDoc, but
   `CocktailGuidePage`'s actual function signature
   (`{route, defaultRoute, onRouteChange}`) never destructures or forwards
   it — it's a dead prop today.
2. `shell.tsx`'s `CocktailMobileHeader`/`CocktailBottomNav`/`SectionsSheet`
   accept only `{route, onNavigate}` — no `user`/`onSignOut` prop exists to
   plumb through at all.
3. `SectionsSheet`'s "ВЫЙТИ ↪" button (line ~205-210) has **no `onClick`
   handler** — it's inert.
4. `CocktailDesktopHeader` renders a static "МК" avatar chip with **zero
   affordance** — no menu, no click handler — meaning **desktop has no way
   to sign out at all** today (the sign-out button only exists inside the
   mobile-only `SectionsSheet`).
5. The user's initials/name/role ("МК"/"Майкл"/"admin") are 100% hardcoded
   throughout `shell.tsx`, not sourced from anything.

Required kit edit (bundle with §E's other shell.tsx/page.tsx edits): thread
a `user: {name, role}` and `onSignOut: () => void` prop from
`CocktailGuidePage` down through `CocktailDesktopHeader` (add a click → small
dropdown/menu with name+"Выйти"), `CocktailMobileHeader` →
`CocktailBottomNav` → `SectionsSheet` (wire the existing button, replace the
hardcoded avatar/name).

### Routing

Wire the block's already-controlled `route`/`onRouteChange` to real URLs.
Recommended: a small custom hook using the plain History API (no new
dependency — matches old prod's zero-router-deps philosophy while still
delivering the requested improvement):

```ts
const ROUTES: Route[] = ["menu", "classics", "spirits", "kitchen", "progress"]
function pathFor(r: Route) { return r === "menu" ? "/" : `/${r}` }
function routeFromPath(path: string): Route {
  const seg = path.replace(/^\//, "") as Route
  return ROUTES.includes(seg) ? seg : "menu"
}
function useUrlRoute() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(location.pathname))
  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(location.pathname))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const onRouteChange = (r: Route) => { history.pushState(null, "", pathFor(r)); setRoute(r) }
  return { route, onRouteChange }
}
```

Routes: `/` (menu/"Авторские"), `/classics`, `/spirits`, `/kitchen`,
`/progress`. Requires SPA-fallback on the server (§G) so a refresh on
`/classics` doesn't 404. Alternative considered: `react-router-dom` — heavier
than needed for a single controlled-route callback on one page; only worth
it if the app grows more standalone top-level routes later. **Non-goal**:
detail-sheet deep-linking (cocktail/classic/spirit/dish index state stays
in-memory, not URL-addressable) — out of scope for phase 1b.

### Data loading

`ContentProvider`: fetches `/api/content` once (after auth resolves), runs
`mapBundle`, exposes `{data, loading, error}` (a `reload()` is cheap to keep
but not required — unlike old prod, there's no admin-edit flow in phase 1b
to trigger a reload, see §F). Loading/error gates render before mounting
`CocktailGuidePage`. `ProgressProvider` nests inside `ContentProvider` (needs
the bundle for the spirit key-maps from §C).

---

## E. Zero/ZC merge — kit edits (product-owned files)

All edits below are localized to the 6 files now living in
`src/pages/cocktail-guide/`.

1. **`data.ts` — type edits:**
   - Extend `Cocktail`: add `isAlcoholic: boolean; isZeroCulture: boolean;
     caffeineLevel: number | null; isCarbonated: boolean | null;`
   - Narrow `SectionId` to `"menu" | "classics" | "spirits" | "kitchen"`
     (drop `"zero" | "zc"` — the backend never emits them).
2. **`views.tsx` — `MenuView`:** add a third filter row,
   `axis="ТИП"`, options `["Все", "Алко", "Безалко"]`, local state
   `alcFilter`; extend the existing `rows` predicate with
   `&& (alcFilter === "Все" || (alcFilter === "Алко") === c.isAlcoholic)`.
3. **`views.tsx` — non-alc badge:** minimal, no `MediaCard` component edit
   needed — in `MenuView`'s render, when `!c.badge && !c.isAlcoholic`,
   synthesize `{label: "0%", tone: "ink"}` for the `badge` prop. Known
   limitation: if a future non-alc item also carries a real badge (HOT etc.)
   the product badge wins and "0%" is dropped (single badge slot) — acceptable.
4. **`detail-sheet.tsx` — `Meta()`:** show `"0%"` in place of `${abv}% ABV`
   when `!isAlcoholic` is passed through (small signature change to accept
   `isAlcoholic`).
5. **`detail-sheet.tsx` — secondary/second-pass (full ZC parity, see §F):**
   add two optional sections to `CocktailDetail`'s body, gated on
   `c.caffeineLevel != null` (caffeine dot-meter, 3 dots) and
   `c.isCarbonated != null` ("◉ Газированный"/"◯ Без газа"), reproducing the
   old ZC detail sheet's two indicators. Treat as a follow-up task, not part
   of the "minimal" alc/non-alc edit.
6. **`shell.tsx`:** remove the `{id:"zero",...}` and `{id:"zc",...}` entries
   from the hardcoded `DESKTOP_TABS` array (5 tabs remain: Авторские /
   Классика / Спириты / Кухня / Прогресс). `NAV_PRIMARY` already has only 4
   entries with no zero/zc — no change needed. `SectionsSheet` iterates the
   (now adapter-provided) `SECTIONS` array, so it naturally drops to 4 rows
   once the data source stops including zero/zc — no separate code change
   there.
7. **`page.tsx`:** delete the dead `case "zero": case "zc": return
   <SpiritsView .../>` branch in the route switch — once `SectionId`/`Route`
   no longer include those values, TypeScript will flag this branch as
   unreachable, forcing the cleanup.
8. **Auth-wiring edits** (carried over from §D — same files, do together):
   thread `user`/`onSignOut` through `CocktailGuidePage` →
   `CocktailDesktopHeader`/`CocktailMobileHeader`/`CocktailBottomNav` →
   `SectionsSheet`; wire the dead "ВЫЙТИ ↪" button; add a desktop sign-out
   affordance (make the avatar chip clickable, e.g. wrap in a
   `DropdownMenu` with name/role + "Выйти").
9. **Live total-progress badge bug** (found while tracing `TOTAL_LEARNED`,
   §B): `shell.tsx`'s `SectionsSheet` computes
   `pct(TOTAL_LEARNED, TOTAL_POSITIONS)` from the **static** `TOTAL_LEARNED`
   import, never from the real `learned: Set<string>` — with the adapter's
   required `TOTAL_LEARNED = 0` (§C), this badge would otherwise be
   permanently stuck at "0%". Edit `SectionsSheet` (and the
   `CocktailMobileHeader`/`CocktailBottomNav` wrappers that render it) to
   accept a live-computed total (`totalLearnedLive(learned)`, computed once
   in `page.tsx` and threaded down the same prop chain as `user`/`onSignOut`)
   instead of reading the module constant.
10. **Team tab (`page.tsx`'s `ProgressWithTeam`):** no backend endpoint
    exists for per-staff team progress at all (see §F) — the "Мой"/"Команда"
    tab switcher and `TeamView` show 100% fabricated demo numbers if left
    as-is. Recommended: drop the tab switcher for phase 1b and always render
    `ProgressView` (the "Мой" personal progress, which **is** real). Do
    **not** remove `FamiliesPanel` (also in `team-view.tsx`) — it only reads
    `CLASSICS`/`FAMILIES`, both backend-sourced, and stays fully functional
    as the mobile classics-family drill sheet.

---

## F. Feature-parity checklist

**Scope note (important):** `backend/app/main.py` only mounts `auth`,
`content`, `me`. The `admin.py`, `admin_users.py`, `uploads.py` routers exist
in the repo but are **not wired into the app** — and `admin.py`'s own
endpoints (`/zero-cocktails`, `/zc-drinks`, …) still target the pre-merge
schema, so it needs a rewrite before it's even connectable. **Phase 1b is
therefore explicitly scoped to the reader-facing surface only** (old
inventory §1.1–§1.14). Admin CRUD, categories management, image uploads, and
user management (§1.15–§1.18) are out of scope — track as a separate
Phase 1c/2 (admin panel), not a silent omission.

| Area | Old prod (inventory §) | Kit block status | Gap / action |
|---|---|---|---|
| Auth/Login | §1.1 | `auth-card` + AuthProvider/AuthGate (§D) | Constrain `auth-card` to password-only (no passkey/telegram backend); verify refocus/clear-on-error UX ported |
| Global nav/routing | §1.2 | desktop tabs + mobile bottom-nav/§42 sheet (§D routing) | Sign-out affordance broken by default — **must fix** (§D/§E.8); admin/users footer links deferred (scope note) |
| Авторские (menu) | §1.3 | `MenuView`: search✓ spirit-filter✓ glass-filter✓ badge✓ learned✓ | Add alc/non-alc filter+badge (§E); image-color-extraction (`useImageColor`) is **not** replicated — kit's `media-card` uses a flat INK-framed thumb by design (§45 canon) — accept as an intentional visual difference, not a bug |
| Классика + семейства + теория | §1.4 | `ClassicsView` + `FamilyTheory` + `ClassicDetail` cross-links | Matches/exceeds (kit adds live per-family progress + `FamiliesPanel` drill sheet prod never had). Verify `TintName` union == DB `family.key` values (§B) |
| Спириты + архив | §1.5 | `SpiritsView` groups + detail (ВКУС/БРЕНД/…/В КОКТЕЙЛЯХ/ФАКТ/ИСТОЧНИК) | **"Выведенные" (archive) tab is a non-functional placeholder** (just a count + static sentence) — must build real archived-category browsing (reuse `SpiritRow`/`SpiritDetail`) to match old prod's archive mode |
| Кухня | §1.6 | `KitchenView` grouped by course + КБЖУ grid | `allergens` has no backend field (degrades gracefully, documented gap); search/КБЖУ-structure are improvements over old prod, keep |
| Безалко (§1.7) + Zero Culture (§1.8) | merged into Авторские per project brief | satisfied by §E's alc/non-alc filter+badge | Caffeine dot-meter + carbonation indicator not yet in unified `CocktailDetail` — §E.5 follow-up task. Old arbitrary `details[]`/`ingredients[]` blocks have no v2 schema equivalent — assumed migrated into the fixed fields during ETL (content assumption, not a frontend task) |
| Progress toggles (cross-cutting) | §1.9 | full optimistic+rollback, 4 kinds (§C) | Legacy `localStorage['classics_learned']` migration — **not applicable**, no existing v2 users have it; explicitly drop |
| Cocktail detail sheet | §1.10 | `CocktailDetail`: modal/drawer + flash-card deck paging + keyboard/swipe | Exceeds old prod (deck-paging across the whole filtered list; old `BottomSheet` had none). Image-color extraction not replicated (same accepted difference as §1.3) |
| Search & filters | §1.11 | per-area `SearchBox`/`FilterRow` | `FilterRow`'s mobile treatment is a plain `overflow-x-auto` + fade edge — **no explicit active-pill auto-scroll-to-center** like old prod's `FilterTags`. Minor: flag as an enhancement candidate if pixel-parity with the old interaction is required, else acceptable |
| Progress page (global) | §1.12 | `ProgressView` (mobile stack / desktop 2-col + rail) | Improvement — lives in-nav instead of only a footer link |
| History/timeline | §1.13 | absent in both old prod and kit | **Explicitly deferred** per project brief |
| Notable UX (§1.14 roll-up) | — | bottom-sheet consistency✓, safe-area/PWA insets✓ (§A), classic→cocktail cross-link✓ (`onCrossLink` already wired in `page.tsx`) | image-color extraction (accepted diff, see above), filter auto-center (see §1.11), login refocus/clear (verify per §D) |
| Admin CRUD | §1.15 | not present in block | **Out of scope** — backend router unmounted + stale schema |
| Categories mgmt | §1.16 | not present | **Out of scope** — same reason |
| Image uploads | §1.17 | not present | **Out of scope** — `uploads.py` router unmounted |
| User mgmt | §1.18 | not present | **Out of scope** — `admin_users.py` router unmounted |
| Team/staff progress (kit-only, not in old prod at all) | n/a | `TeamView`/`ProgressWithTeam`'s "Команда" tab is fully fabricated demo data — **no backend endpoint for team-wide progress exists anywhere** | Recommend hiding for phase 1b (§E.10); don't ship fabricated numbers |

**The two explicitly-called-out "invisible" prod features:**
- **Spirit pairings** ("В коктейлях" never rendered — inventory §5 bug):
  **fixed** in v2. Backend serializes `pairings` correctly and the kit's
  `SpiritDetail` already reads `s.pairings` — the adapter passthrough (§B)
  is the entire fix, zero extra UI work.
- **History timeline**: **deferred**, per project brief — no backend field,
  no kit UI, not attempted in phase 1b.

---

## G. Deploy

Deploys as a **new, separate Railway service, parallel to prod** — does not
touch, replace, or share a domain with the existing `frontend/` service (old
prod frontend keeps talking to the old prod backend, unaffected).

- **`Dockerfile`** (2-stage, same shape as old prod's, simplified):
  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  ARG VITE_API_URL=""
  ENV VITE_API_URL=$VITE_API_URL
  COPY package.json package-lock.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM nginx:alpine
  RUN rm /etc/nginx/conf.d/default.conf
  COPY nginx.conf /etc/nginx/templates/default.conf.template
  COPY --from=build /app/dist /usr/share/nginx/html
  ENV NGINX_ENVSUBST_FILTER="^(PORT)$"
  ENV PORT=80
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```
  `VITE_API_URL` is a **build-time** arg (Vite bakes it into the JS bundle),
  same as old prod.
- **`nginx.conf` — simpler than old prod's**: the old frontend proxied
  `/api/`+`/static/` through nginx to keep the auth cookie same-origin
  (`COOKIE_SAMESITE=lax` friendly). The v2 backend's prod config already
  defaults `COOKIE_SAMESITE=none`/`COOKIE_SECURE=true` (see
  `backend/.env.example`), so the new frontend can call the v2 backend
  **directly, cross-origin**, cookies included — no reverse proxy needed.
  Plain `<img>` tags loading `/static/img/...` from the backend's own domain
  don't need CORS either (only `fetch`/XHR do). So `nginx.conf` reduces to
  pure static SPA serving:
  ```nginx
  server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location = /index.html { add_header Cache-Control "no-store, must-revalidate"; }
    location / { try_files $uri $uri/ /index.html; }
  }
  ```
  The SPA fallback (`try_files ... /index.html`) is **more important** here
  than it was for old prod: old prod had zero client-side routes (always
  `/`); this app has real deep-linkable URLs (§D) that must resolve on a
  server-side refresh.
- **`railway.json`**: same `DOCKERFILE` builder / `restartPolicyType:
  ON_FAILURE` pattern as both existing services; no healthcheck needed for a
  static server (old prod frontend's `railway.json` has none either).
- **Cross-service coordination (the one thing that must be done in the
  backend, not the frontend repo):** once the new frontend's Railway public
  domain is known, append it to the v2 backend service's `CORS_ORIGINS`
  env var (comma-separated) — `CORSMiddleware` + `allow_credentials=True`
  require an exact origin match for the cross-origin cookie flow to work.
- **`index.html`**: keep `noindex/nofollow/noarchive/nosnippet` + `lang="ru"`
  (closed menu, unchanged requirement). **Drop** the old Unbounded+Manrope
  Google Fonts `<link>` — the kit's theme brings Space Grotesk + JetBrains
  Mono instead; this is an intentional typography/brand change from the kit
  canon, not a regression, worth flagging explicitly so no one "fixes" it
  back later.
- Smoke-test before any DNS/cutover decision (out of scope for phase 1b, a
  later human call): login → browse all 4 sections → toggle a few learned
  items and confirm persistence across reload → logout.

---

## H. Suggested task breakdown (Phase 1b)

Ordered, each independently testable/verifiable.

1. **Scaffold + kit install** *(new glue / infra)* — Vite+React19+TS+Tailwind
   v4 app; shadcn init with `@kollektiv` registry; theme installed first;
   `block-cocktail-guide` + its full `registryDependencies` + `auth-card`
   installed; PWA meta + manifest added. *Deliverable:* `npm run build`
   succeeds; the block renders at `/` with its own demo data, no missing
   imports.
2. **Auth wiring** *(pure wiring + one kit edit)* — `api` helper (TS port of
   old prod's), `AuthProvider`/`AuthGate`, `LoginPage` on `auth-card`
   constrained to password-only. *Deliverable:* can log in with a seeded v2
   user; session survives refresh; sign-out not yet reachable in the UI
   (task 4 fixes that).
3. **`mapBundle` adapter** *(new glue)* — full field-by-field adapter (§B)
   built and type-checked against `data.ts`'s existing interfaces, run once
   against a real captured `/api/content` payload to sanity-check derived
   counts (TOTAL_POSITIONS, per-group spirit totals, per-category kitchen
   totals). *Deliverable:* adapter output shape-checks; not yet wired into
   rendering.
4. **Wire real content + progress + auth props into the block** *(kit
   edits)* — convert `data.ts`'s static consts to context-fed values per
   §B's architecture note (add content context, edit 4 files' import
   lines); implement spirit key-maps + kind-specific toggle wrappers (§C)
   replacing `page.tsx`'s `initialLearned()`/`toggle()`; thread
   `user`/`onSignOut` through `shell.tsx` (fixes the dead ВЫЙТИ button +
   adds the missing desktop sign-out); fix the static `TOTAL_LEARNED`
   sheet-badge bug (§E.9). *Deliverable:* app shows real DB-backed
   menu/classics/spirits/kitchen data; learned toggles persist across
   reload; sign-out works on both mobile and desktop.
5. **Alc/non-alc merge edits** *(kit edits)* — extend `Cocktail` type, add
   the Алко/Безалко filter to `MenuView`, "0%" badge/meta treatment, remove
   `zero`/`zc` from `SectionId`/`DESKTOP_TABS`/the `page.tsx` route switch.
   *Deliverable:* unified Авторские section filters correctly by alcohol
   content; TS compiles clean with the narrowed `SectionId` (no dead
   branches left).
6. **Real client-side routing** *(new glue)* — the History-API routing
   hook, wired to the block's controlled `route`/`onRouteChange`.
   *Deliverable:* each of the 5 sections has a distinct real URL; refresh
   preserves the section; browser back/forward works.
7. **Spirits archive tab** *(kit edit)* — replace the placeholder
   "Выведенные" tab with real archived-category browsing, reusing
   `SpiritRow`/`SpiritDetail`. *Deliverable:* archived spirit categories are
   listed, filterable, and open in the same detail-sheet mechanism as active
   ones.
8. **Non-alc detail-sheet parity** *(kit edit)* — add caffeine dot-meter +
   carbonation indicator to `CocktailDetail` for non-alcoholic items (§E.5).
   *Deliverable:* a non-alcoholic drink's detail sheet shows both indicators
   when the DB provides those fields.
9. **Progress-page team-tab cleanup** *(kit edit, small)* — drop/gate the
   fabricated "Команда" tab (no backend source exists); keep
   `FamiliesPanel` (real data). *Deliverable:* Progress page shows only real
   ("Мой") numbers, no fabricated team stats.
10. **Feature-parity verification pass** *(verification)* — walk §F's table
    against the running app end-to-end; fix any small gaps found in
    practice (e.g. filter-pill auto-centering if required). *Deliverable:*
    every §F row is either checked off or explicitly signed off as
    deferred/out-of-scope.
11. **Deploy** *(infra)* — Dockerfile + simplified nginx.conf + railway.json
    for the new Railway service; set `VITE_API_URL`; append the new
    service's domain to the v2 backend's `CORS_ORIGINS`. *Deliverable:* new
    frontend live on its own Railway subdomain, full login→browse→toggle→
    logout flow verified against the live v2 backend, deployed parallel to
    (not replacing) the existing prod frontend.
