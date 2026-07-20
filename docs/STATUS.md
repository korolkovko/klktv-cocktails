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

## NEXT TASK — media unification, then Phase 2

The parity audit is done. Remaining, in order: (1) **media unification** (see below — owner wants all media stored the same way; kitchen photos still only in `/tmp`), (2) the deferred MED/LOW parity items in `docs/audit/parity/SUMMARY.md` if the owner wants them, (3) **Phase 2** (admin/uploads/user-mgmt on the kit, then final ETL + cutover).

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
