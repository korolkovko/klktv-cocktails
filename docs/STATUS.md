# klktv-cocktails v2 — STATUS / handoff

**Read this first.** Single source of truth for the v2 rebuild. Written 2026-07-20 as a durable checkpoint before a context compaction.

## What this project is

Rebuild of the bar's closed (login-only) drinks & food guide. Old prod is live and untouched on branch `main`. All v2 work is on branch **`v2`** (~42 commits). New version: consumer frontend on the **Kollektiv UI kit**, cleaned FastAPI backend on an **evolved schema in a separate new DB**, data migrated losslessly. Admin panel + cutover are Phase 2 (later). **Standing owner rule: NOTHING from the old version may be lost.**

## Where we are — DONE & reviewed (SDD: subagent per task + adversarial review)

- **Phase 0 — data.** Evolved Postgres schema (Alembic-managed) + re-runnable, idempotent ETL prod→new DB, lossless. Merged the two non-alc subsystems into one `drinks` table (cocktails+zero+zc, Upcykle dedup). Typed the string fields (abv/price/КБЖУ/weight/timing) keeping raw in `*_raw`. Reset id sequences (cutover-safe). Counts: drinks 26, classics 67, spirits 74, kitchen 33, learning_progress 189, families 9. `backend/migration/` (parsers.py, source.py, load.py, verify.py, run.py). README: `backend/migration/README.md`.
- **Phase 1a — backend.** FastAPI consumer API on the new schema. `GET /api/content` catalog bundle shaped to the kit (camelCase keys); `/api/me/progress` (kinds menu/classics/spirits/kitchen; spirits persisted on slug); hardened auth (logout cookie, 401-not-500, rate-limit ip+username on failures only + proxy-headers, global 401→relogin on the frontend); `seed.py` = one-shot admin bootstrap only (no boot seeding, plaintext roster removed); Alembic-only schema; Swagger closed in prod; **admin/admin_users/uploads routers DISABLED** (Phase 2, still reference old models). **39 tests pass.**
- **Phase 1b — frontend.** React 19 + Vite + TS + Tailwind v4 on the kit `block-cocktail-guide` (`frontend/src/pages/cocktail-guide/`, product-owned). Cookie auth (`src/auth/`), a `mapBundle` adapter (`src/data/`) feeding the block via ContentContext/ProgressContext, non-alc merged into "Авторские" (Алко/Безалко filter + 0% badge), real URL routing, archived-spirits tab, caffeine/carbonation detail. Fixed real kit gaps: dead sign-out prop, no desktop sign-out, static progress badge, placeholder archive tab, fabricated team tab. Build + 8 vitest tests green.

## Post-1b fixes (from owner live-review)

- **Images** (commit `5a9b90c`): added `resolveImageUrl` (`frontend/src/lib/img.ts`; `/static/*`→backend origin, `/logos/*` & http as-is). Restored 24 drink logos from git (`main:frontend/public/logos` → `frontend/public/logos`). Downloaded 27 kitchen `/static/img` photos from `https://cocktails.klktv.tech/static/img/<f>` (public) into local `/tmp/klktv-uploads` — **EPHEMERAL**; permanent home = the deferred media-unification. Spirits & cocktail-photos have no images by design.
- **Missing cocktail detail** (commit `fa61c1d`): author-drink prose (О коктейле/Отсылки/Про название/Про этикетку/…) lived ONLY in `drink_details` (45 rows / 25 drinks); structured `about`/`naming`/`recipe` columns are empty. Backend now serializes `DrinkOut.details`; detail-sheet renders each block as a section. Meta/card no longer show "0 ₽ · 0 МЛ" (author drinks have no price/volume in prod).

## DONE (2026-07-20 session) — DATA-PARITY AUDIT + TEAM VIEW + BUG FIXES (commit `7431913`)

- **Full data-parity audit** (5 parallel domain auditors) — reports in `docs/audit/parity/` (+ `SUMMARY.md`). Row-integrity clean; all losses were serialization/rendering. **All 8 HIGH findings fixed** and the ETL was re-run to DEST (DrinkSpirit populated, deterministic merged menu order). Key fixes: empty Авторские spirit filter (DrinkSpirit from spirit tags), false "0% ABV", spirit price + per-100g kcal now served, dish "0 ₽/0 МИН" omitted, classics search matches descriptors+origin, kitchen/dish order tiebreak. Deferred MED/LOW items are listed in `SUMMARY.md` (families.color, badge "250ml", subtitle fallback, etc.) — documented, not silent.
- **Team progress view — visible to EVERYONE** (was kit-scoped admin; owner's request). New `GET /api/team` aggregate endpoint (auth-only) + `frontend/src/data/team.ts` adapter + `TeamView` wired to real data (4 v2 sections) + new "Команда" tab. Owner chose the full kit dashboard (incl. red "отстают <30%").
- **Spirit-card bugs:** SourceLink double-protocol href + long-URL overflow fixed. Photo resilience verified (spirit bottle + cocktail photo render without breaking; live end-to-end smoke test).
- Backend 39 tests + frontend 10 tests green. **Note:** ETL verify.py asserts DEST progress count == prod's; it now trips on the +1 dev-test row (v2tester) — expected, not a data issue.

## DONE (2026-07-20 session 2) — ADMIN PANEL (functional, not kit) — commits `5e3ed43..c2ba1b5`

Full admin built via SDD (10 tasks + reviews; spec `docs/superpowers/specs/2026-07-20-admin-panel-design.md`, plan `docs/superpowers/plans/2026-07-20-admin-panel.md`, ledger `.superpowers/sdd/progress.md`).
- **Backend** `/api/admin/*`: `admin.py` content CRUD for the v2 unified schema (drinks/classics/spirits+categories/kitchen+categories/families/categories — full-record PATCH, delete-then-insert relations, 409/404, delete-cascades incl. learning_progress, slug-rename reconciles progress), `admin_users.py` (user mgmt, `require_admin`, self-protection, no password_hash leak, `last_seen_at` in UserOut), `uploads.py` (image resize→volume, `require_editor`). Roles: `require_editor` content+uploads, `require_admin` users+destructive. **78 backend tests.**
- **Media on the Railway volume** (decision CHANGED from Option B frontend/public → volume): all images under `UPLOAD_DIR`, served `/static/img/`; `backend/migration/media_to_volume.py` moved the 24 logos + kitchen photos onto the volume and rewrote DB paths; `resolveImageUrl` simplified. Dev `UPLOAD_DIR=backend/.uploads` (gitignored); prod = a Railway volume mounted at `UPLOAD_DIR`.
- **Frontend** admin at `/admin` (editor-gated; "Админка" entry for editor+): plain-Tailwind shell + shared primitives (`frontend/src/admin/components/`) + per-entity editors (`frontend/src/admin/editors/`) + UsersPage (admin-only tab). Image upload wired into Drink/Spirit/Kitchen editors. **56 frontend tests, build clean.**
- **`kolya` is now `admin`** (password unchanged). `backend/migration/make_kolya_admin.py`.
- Live-smoked end-to-end (login→list→create→reflected in `/api/content`→upload→rename→delete; reader→403). Deferred polish (final review, non-blocking): EditorShell a11y (aria-modal/focus-trap — belongs to the later kit redesign), EntityList search stringify, reorder partial-list guard.

## DONE (2026-07-20 session 3) — DEPLOY PREP — commit `f5f2552`

Deploy decisions (owner): **reuse tokaido as v2-prod**, **staging-first then domain switch**, **create new backend+frontend Railway services** (DB already exists). Everything preparable is done + committed:
- **`docs/DEPLOY.md`** — the full runbook (READ THIS to deploy): services, Railway volume at `UPLOAD_DIR`, env-var tables, cross-origin cookie/CORS wiring, pre-go-live cleanup, staging QA, domain switch, rollback, password-history purge.
- **Media auto-seeds the prod volume**: the 52 content images are baked into the backend image (`backend/seed_media/`) and copied into an empty `UPLOAD_DIR` on boot (`backend/app/media_seed.py`, copy-if-absent) — no manual media step.
- Cutover scripts: `backend/migration/prepare_prod.py` (remove dev/test users v2tester+smoke_*), `make_kolya_admin.py` (done), `media_to_volume.py`/`run.py` (only if a fresh DB is ever used).
- `.dockerignore` excludes dev `.uploads/`; `.env.migration` already excluded (no secret leak). `.env.example` (both) document prod vars. Backend 81 tests green.

## NEXT TASK — execute the deploy (owner) + browser QA

Follow `docs/DEPLOY.md`: create the two Railway services + volume, set env vars, deploy to staging, run `prepare_prod.py`, **hands-on browser QA as kolya** (guest + Админка + uploads + users), then switch `cocktails.klktv.tech`. Also (owner, independent): rotate + purge the 12 plaintext passwords from git history. Optional: deferred MED/LOW parity items in `docs/audit/parity/SUMMARY.md`; the kit redesign of the admin UI.

## Deferred / operational

- **Media unification** (owner wants ALL media stored the same way): Option B — move all images into `frontend/public/` (static, survives Railway redeploys, no backend volume), re-path DB `/static/img/…` values, adjust `resolveImageUrl`. Kitchen photos are only local (`/tmp`) right now.
- **Operational before cutover:** rotate + purge the 12 plaintext staff passwords from git history; `docker build` the frontend once (never run — no Docker in dev env); set frontend `VITE_API_URL` (build arg) + append its Railway domain to backend `CORS_ORIGINS`; remove the `v2tester` dev user.
- **Phase 2:** rebuild admin/uploads/user-management on the kit (backend routers unmounted + still on old model names), then final ETL + cutover.
- Minor backlog: rate-limit key-space cap, whole-Set progress rollback race, desktop popover a11y, manifest icons[], filter-pill auto-center, thin FE test coverage, History/timeline section (data preserved).

## Key coordinates

- **Branch:** `v2`. Repo root has `backend/` + `frontend/`. Prod (old) = `main`.
- **DBs (Railway):** SRC prod (READ-ONLY) `postgresql://postgres:…@kodama.proxy.rlwy.net:42310/railway`; DEST new dev `…@tokaido.proxy.rlwy.net:59246/railway`. Full creds + `SECRET_KEY` in gitignored **`backend/.env.migration`** (also holds `DATABASE_URL`=DEST for the app).
- **Prod domain:** `https://cocktails.klktv.tech` (serves `/static/img/*` publicly).
- **Local dev run:** backend `:50779`, frontend `:50780`, login `v2tester`/`v2testpass`.
  - Backend: `cd backend && set -a; source .env.migration; export COOKIE_SECURE=false COOKIE_SAMESITE=lax UPLOAD_DIR=/tmp/klktv-uploads CORS_ORIGINS="http://localhost:50780"; set +a; uv run uvicorn app.main:app --host 127.0.0.1 --port 50779`
  - Frontend: `cd frontend && VITE_API_URL=http://localhost:50779 npm run dev -- --port 50780`
  - Test suites: backend `uv run pytest -q` (needs the env); frontend `npm run build && npm run test`.
- **Docs:** audit → `docs/audit/`; specs → `docs/superpowers/specs/`; plans + blueprints → `docs/superpowers/plans/`; live progress ledger (gitignored) → `.superpowers/sdd/progress.md`; cross-session memory → the project memory dir (`MEMORY.md`).

## How to resume after the compact

1. Read this file + `.superpowers/sdd/progress.md` (full task-by-task record) + the memory `MEMORY.md`.
2. Trust git + the ledger over recalled context. `git log --oneline main..HEAD` shows all v2 work.
3. If the local servers aren't running, restart per "Local dev run" above.
4. Start the **data-parity audit** (see above), then media unification, then Phase 2.
