# Kollektiv v2 — Frontend

React 19 + Vite + TypeScript app built on the Kollektiv UI kit's
`block-cocktail-guide`, wired to the v2 backend (`auth`/`content`/`me`
routers). See `docs/superpowers/plans/phase-1b-frontend-blueprint.md` at the
repo root for the full build rationale.

## Local dev

```bash
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

Opens on `http://localhost:5173`. Requires the v2 backend running locally
(`backend/`, see its own README/`.env.example`) with
`CORS_ORIGINS=http://localhost:5173` and `COOKIE_SAMESITE=lax` /
`COOKIE_SECURE=false` for local cross-port cookies to work.

## Build

```bash
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the production build locally
```

## Deploy (Railway)

This app deploys as its **own** Railway service — a static SPA served by
nginx, built via a 2-stage Docker image (`Dockerfile`):

1. **Build stage** (`node:20-alpine`): `ARG VITE_API_URL` is baked into the
   JS bundle at build time (Vite env vars are compile-time, not runtime) via
   `npm ci && npm run build`.
2. **Serve stage** (`nginx:alpine`): copies `dist/` in; `nginx.conf` is
   templated (`${PORT}` substituted via `NGINX_ENVSUBST_FILTER`, same
   mechanism Railway's own `PORT` env var expects) and serves the SPA with
   `try_files $uri $uri/ /index.html` — required because the app now has
   real deep-linkable routes (`/`, `/classics`, `/spirits`, `/kitchen`,
   `/progress`) that must resolve on a server-side refresh.

No `/api` or `/static` reverse proxy is needed here (unlike the old v1
frontend, preserved for reference at `../frontend_v1_reference/` before its
removal in the parity-cleanup commit): the v2 backend's prod config already
defaults to cross-origin cookies (`COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`
— see `backend/.env.example`), so the SPA calls the backend directly from the
browser with `credentials: 'include'`, no same-origin proxy trick required.

### Railway setup

- **Root Directory:** `frontend`
- **Builder:** Dockerfile (`railway.json` — `DOCKERFILE` builder,
  `restartPolicyType: ON_FAILURE`; no healthcheck, this is a static server)
- **Build Args:**
  - `VITE_API_URL` — the **v2 backend's** Railway domain, e.g.
    `https://klktv-cocktails-v2-backend.up.railway.app`
- **Networking:** Generate Domain

### Required cross-service step (do this in the backend service, not here)

Once this frontend's Railway public domain is known, **append it (exact
origin, no trailing slash) to the v2 backend service's `CORS_ORIGINS` env
var** (comma-separated list). `CORSMiddleware` + `allow_credentials=True`
require an exact origin match — a missing/mismatched entry silently breaks
the credentialed cookie flow (login will appear to "succeed" but every
subsequent `/api/*` call comes back unauthenticated). This deploys **parallel
to**, not replacing, the existing v1 prod frontend/backend pair — different
Railway services, different domains, no shared config.

## Feature-parity self-check (Phase 1b, Task 10)

Walked against `docs/audit/details/frontend-inventory.md` §1.1–§1.14
(reader-facing scope; admin §1.15–§1.18 is Phase 2 — the backend's
`admin`/`admin_users`/`uploads` routers aren't mounted) and blueprint §F.

| Area (inventory §) | Status |
|---|---|
| Auth/Login (§1.1) | Satisfied — `auth-card` constrained to password-only; `AuthProvider`/`AuthGate` gate `ContentProvider`; refocus/clear-on-error preserved in `LoginPage` |
| Global nav/routing (§1.2) | Satisfied — desktop tabs + mobile bottom-nav/sheet; real History-API routing (`useUrlRoute`); sign-out wired on both mobile (`SectionsSheet`) and desktop (avatar dropdown) |
| Авторские / menu (§1.3) | Satisfied — search, spirit filter, glass filter, badge, learned toggle, alc/non-alc filter + "0%" badge. Image-color extraction (`useImageColor`) intentionally **not** replicated — kit's `media-card` uses a flat INK-framed thumb by design; accepted visual difference, not a bug |
| Классика + семейства + теория (§1.4) | Exceeds — live per-family progress + `FamiliesPanel` drill sheet (prod never had this); `TintName` union verified against DB `family.key` values via `mapBundle` cast |
| Спириты + архив (§1.5) | Satisfied — real archived-category browsing (Выведенные tab) reusing `SpiritRow`/`SpiritDetail`, replacing the old placeholder; "В коктейлях" pairings now render (see below) |
| Кухня (§1.6) | Satisfied — grouped by course, search, КБЖУ grid (nutrition all-null degrades to hidden grid, not a zeros grid). `allergens` has no backend field — degrades gracefully, documented gap |
| Безалко + Zero Culture (§1.7/§1.8, merged into Авторские) | Satisfied — alc/non-alc filter+badge; caffeine dot-meter + carbonation indicator in the unified `CocktailDetail`. Old free-form `details[]`/`ingredients[]` blocks have no v2 schema equivalent — assumed folded into fixed fields during ETL (content assumption, not a frontend gap) |
| Progress toggles (§1.9) | Satisfied — optimistic + rollback, all 4 kinds (menu/classics/spirits/kitchen), persisted via `/api/me/progress`. Legacy `localStorage['classics_learned']` migration not applicable — no existing v2 users have it |
| Cocktail detail sheet (§1.10) | Exceeds — deck-paging across the filtered list + keyboard/swipe (old `BottomSheet` had none). Image-color extraction not replicated (same accepted difference as §1.3) |
| Search & filters (§1.11) | Satisfied — per-area `SearchBox`/`FilterRow`. Filter-pill active-item auto-scroll-to-center (old `FilterTags`) not replicated — plain `overflow-x-auto` + fade edge instead; flagged as a minor enhancement candidate, not required for parity |
| Progress page / global (§1.12) | Exceeds — lives in-nav (`/progress`) instead of only a footer link; fabricated "Команда" tab removed (no backend source exists for team-wide progress) — only real "Мой" numbers shown |
| History/timeline (§1.13) | **Explicitly deferred** — no backend field, no kit UI, not attempted in Phase 1b (per project brief) |
| Notable UX roll-up (§1.14) | Bottom-sheet consistency and safe-area/PWA insets satisfied (manifest + viewport-fit meta added — new capability vs. old prod, which had none); classic→cocktail cross-link wired (`onCrossLink`); image-color extraction and filter auto-center are the two accepted/flagged differences above |
| Admin CRUD / categories / uploads / users (§1.15–§1.18) | **Out of scope** — backend routers (`admin`, `admin_users`, `uploads`) unmounted in `main.py` and target a pre-merge schema; tracked as Phase 2, not a silent omission |

**The two "invisible" prod features called out in the blueprint:**
- **Spirit pairings ("В коктейлях")** — was a dead render in old prod (bundle
  field-name mismatch: `entry.cocktail_pairings` vs. the normalizer's
  `entry.cocktailPairings`). **Fixed** in v2 — the backend serializes
  `pairings` correctly and `mapBundle`'s passthrough is the entire fix.
- **History timeline** — **deferred**, no backend field, no kit UI.
