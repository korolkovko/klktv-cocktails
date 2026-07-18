# Backend Audit — KLKTV Cocktails API

**Target:** `_src/backend` (FastAPI + SQLAlchemy 2.0 + Postgres, JWT-in-HttpOnly-cookie, Railway)
**Scope:** read-only audit of every Python file, plus `pyproject.toml`, `railway.json`, `Dockerfile`, `.env.example`, `.dockerignore`, seed JSON.
**Date:** 2026-07-19

## TL;DR verdict

**KEEP-AND-CLEAN.** The core is genuinely healthy: clean 3-layer separation (models / schemas / routers), correct role-based auth, and read queries that are properly eager-loaded (no N+1 in the hot path). The problems are almost all *legacy cruft and operational hacks* sitting on top of a sound design — they are removable without touching the architecture. A from-scratch rewrite would re-implement the same 40+ CRUD endpoints and the same schema for little gain and real regression risk.

Two things, however, are **must-fix-before-carrying-forward** and are the strongest arguments people will (wrongly) use to justify a rewrite:
1. **Seed runs on every container start and hard-resets the 12 known users' password/role/name** — silently reverting admin edits (HIGH, data-loss).
2. **Renaming a slug orphans all users' learning-progress** (HIGH, silent data loss), because progress is slug-keyed with no FK and no rename migration.

Neither requires a rewrite; both are contained fixes. And yes — **the rewrite should adopt Alembic**; the current hand-rolled `create_all` + ad-hoc `ALTER` list is already at its self-declared breaking point.

---

## 1. Real bugs & correctness issues (ranked by severity)

### HIGH-1 — Seed on every boot reverts admin changes to the 12 seed users
`Dockerfile:30` runs `python seed.py && uvicorn ...` on **every** container start. `seed.py:seed_users` (lines 205-220) unconditionally overwrites `password_hash`, `role`, and `name` for every username in the hardcoded `USERS` list:

```python
if existing:
    existing.password_hash = hash_password(password)
    existing.role = role
    existing.name = name
```

**Failure scenario:** Admin promotes `max` to `editor` and changes his password through `PATCH /api/admin/users/max`. Railway redeploys (or the container restarts / crashes-and-restarts per `railway.json` `restartPolicyType: ON_FAILURE`). On boot `seed_users` resets `max` back to `role=reader` and the hardcoded password `dieter17`. The admin's change is gone and the old password works again. This affects all 12 seeded accounts. Newly-created users (not in `USERS`) are safe. This is both a data-loss bug and a security regression (stale credentials resurrected).

### HIGH-2 — Slug rename silently orphans learning-progress
`LearningProgress` (models.py:225-234) is a polymorphic `(user_id, kind, slug)` table with **no FK** to the content rows — intentionally, to avoid a table-per-kind. But every admin `PATCH` allows changing the slug (`admin.py:304-308` cocktails, `377-380` classics, and the identical pattern for zero/zc/kitchen/spirits) and **does not migrate the progress rows**.

**Failure scenario:** 8 users have marked cocktail `negroni-sbagliato` as learned. Editor fixes a typo in the slug to `negroni-sbagliato-2`. All 8 progress rows still point at the old slug; the cocktail now reads as "not learned" for everyone, and the orphan rows are dead weight forever. `seed.py:_cleanup_legacy_urls` even documents awareness of this ("Slugs are left untouched to keep learning_progress refs") — yet the admin API violates that invariant.

### MEDIUM-1 — `pyproject.toml` is missing two required runtime deps → app won't boot if installed from it
`pyproject.toml:6-15` lists 8 deps. The `Dockerfile:12-22` install list additionally hardcodes **`python-multipart>=0.0.12`** and **`Pillow>=11.0.0`**, which are *not* in `pyproject.toml`. Both are hard runtime requirements: `uploads.py` imports `PIL`, and FastAPI needs `python-multipart` for `UploadFile`. `main.py:14` imports the uploads router at startup.

**Failure scenario:** Anyone who bootstraps from the declared manifest (`uv sync`, a CI job, a new dev, a test harness) gets an environment where `import app.main` fails with `ModuleNotFoundError: PIL` (or a multipart error the moment an upload is attempted). The Dockerfile happens to work only because it *duplicates and diverges from* the manifest. There is also **no `uv.lock`**, so even the declared deps float on `>=`.

### MEDIUM-2 — Logout may not clear the cookie in the cross-origin prod config
`auth.py:60-65` `clear_auth_cookie` calls `response.delete_cookie(key, domain, path)` but does **not** pass `secure`/`samesite`. The login cookie is set (lines 47-57) with `secure=True, samesite="none"` in prod. Browsers match the deletion `Set-Cookie` by name + attributes; a `SameSite=None; Secure` cookie is often not cleared by a deletion cookie lacking those attributes (Chrome rejects `SameSite=None` without `Secure`).

**Failure scenario:** User clicks "log out" in production. Server returns 204 and a deletion cookie; the browser keeps the original session cookie because attributes don't match, so the user stays logged in until token expiry (24h). Confirmed-plausible; exact behavior is browser-version dependent, so I mark it MEDIUM rather than certain.

### MEDIUM-3 — `init_db` runs column + data migrations in one transaction; a failing data migration rolls back the column ALTERs
`database.py:49-61`. All 7 `_COLUMN_MIGRATIONS` (`ADD COLUMN IF NOT EXISTS`) and the `_DATA_MIGRATIONS` execute on the **same** `engine.connect()` connection, i.e. one transaction, committed once at line 61. The data migration is wrapped in `try/except` (line 56-60) that swallows the error and continues — but in Postgres a failed statement **aborts the whole transaction**. The subsequent `conn.commit()` then commits nothing (Postgres converts COMMIT-on-aborted to ROLLBACK), silently discarding the column ALTERs that ran earlier in the same transaction.

**Failure scenario:** On a deploy where the `classic_progress → learning_progress` data migration errors (e.g. a schema drift on those tables), the `except` prints "skipped" and the deploy looks green, but the 7 `ADD COLUMN`s were also rolled back. In practice the data migration rarely errors (`ON CONFLICT DO NOTHING`, tables always exist post-`create_all`), so this is a *latent* design flaw rather than an everyday failure — but the pattern (swallow-and-continue on a shared aborted transaction) is exactly the kind of thing that bites during a future migration. Each migration should run in its own transaction/savepoint, and column migrations should commit before data migrations.

### LOW-1 — `get_current_user` 500s instead of 401 on a malformed token
`auth.py:77` does `int(payload["sub"])`. If a token decodes but lacks `sub`, or `sub` is non-numeric, this raises `KeyError`/`ValueError` → unhandled 500 instead of 401. Self-issued tokens always have a numeric `sub`, so this only triggers with a forged/garbage token, but it's the wrong status and leaks a stack trace.

### LOW-2 — Concurrent duplicate `mark_learned` can 500
`me.py:71-82` does check-then-insert without catching `IntegrityError`. Two simultaneous `POST /api/me/progress/{kind}/{slug}` for the same row race past the existence check and the second `commit()` raises a PK violation → 500. Idempotent intent, non-idempotent implementation. Low impact (self-inflicted double-click), but an `ON CONFLICT DO NOTHING` / upsert would be correct.

### LOW-3 — The JWT `role` claim is dead and misleading
`auth.py:31-37` embeds `role` in the token, but authorization (`require_admin`/`require_editor`, lines 83-92) reads `user.role` from the DB via `get_current_user`. So role changes take effect immediately (good!), but the token's `role` claim is never read — dead data that implies a stale-role behavior that doesn't exist. Harmless, but confusing; drop it or use it.

### LOW-4 — `bcrypt` silently truncates passwords > 72 bytes
`admin_users.py:37,45` allow passwords up to 128 chars; `auth.py:23-28` uses bcrypt, which only considers the first 72 bytes. A 100-char password and its 72-char prefix authenticate identically. Cosmetic for this app, standard bcrypt caveat.

### Non-issues worth calling out (credit where due)
- **No N+1 in the read path.** `content.py` uses `selectinload` correctly across cocktails, classics, zero, zc, kitchen, spirits (`_cocktails_query`, `_classics_query`, and the bundle body lines 158-183). The one exception is trivial-scale.
- **User-management safety rails are correct and complete** (`admin_users.py`): can't delete self, can't self-demote, can't remove the last admin (lines 106-136). Nicely done.
- **Timezone-aware token expiry** (`auth.py:35`) — correct.

---

## 2. Bad patterns / anti-patterns / legacy cruft (ranked by how much they hurt the new version)

1. **Seed-as-migration, run on every boot** (`Dockerfile:30`, `seed.py`). The biggest structural smell. Seed is idempotent *content* seeding entangled with *user provisioning*, *data cleanup* (`_cleanup_legacy_urls`), and *backfill heuristics* — all executed on the request-serving container's startup path. It also runs `init_db` a second time (lifespan already does, `main.py:21`). **Carry-forward cost: high.** New version should make seeding an explicit one-shot job/command, never part of `CMD`, and never touch existing user credentials.

2. **Hardcoded plaintext credentials in source** (`seed.py:32-45`). All 12 users' passwords live in the repo. Combined with #1 they are re-asserted on every deploy. **Do not carry forward** — provision the initial admin via env var, create the rest through the UI.

3. **`SECRET_KEY` and `DATABASE_URL` have working hardcoded defaults** (`config.py:3-4`). If `SECRET_KEY` is unset in prod, JWTs are signed with the public repo value → trivial auth forgery / privilege escalation. Should fail-fast (raise) when unset in a non-dev environment.

4. **No migrations — schema via `create_all` + a hand-rolled `ALTER` list** (`database.py:21-62`). `create_all` only ever *adds tables*; it cannot alter columns, change types, add/drop constraints or indexes, or rename. The `_COLUMN_MIGRATIONS` list only supports `ADD COLUMN`. The code's own comment says "Once this grows past ~10 entries, switch to Alembic" — it's at 7 + 1 and every schema change so far has been append-only precisely because that's all the mechanism can do. **This is the single clearest "add Alembic in the rewrite" signal.**

5. **Dead legacy table kept alive** (`models.py:215-222` `ClassicProgress` + `database.py:36-46` data migration + `me.py` legacy hidden routes 100-117). Superseded by `LearningProgress` but retained so `create_all` doesn't drop it, plus a startup data-migration that re-copies rows forever. **Drop the table, the migration, and the legacy `POST/DELETE /api/me/progress/{slug}` routes** in the new version (verify the frontend no longer calls the un-prefixed form first).

6. **Massive CRUD duplication in `admin.py` (731 lines, 8 entity types).** Every entity repeats the same create/patch/delete shape: slug-uniqueness check → `_apply_*` → commit, with the slug-rename-conflict block copy-pasted 6 times (e.g. lines 304-308 ≈ 377-380 ≈ 507-509 ≈ 558-560 ≈ 636-638 ≈ 718-720). **Carry-forward cost: high maintenance drag.** A generic CRUD base/factory (or one router module per entity) would cut this by ~70% and make the slug-rename→progress-migration fix (HIGH-2) a single place instead of six.

7. **String-typed data that should be structured.**
   - `ZeroCocktail.ingredients_text` (models.py:341) is a newline-delimited blob re-parsed on every read (`content.py:99-102`). Should be a child table like the `*Detail` rows already are.
   - `SpiritEntry.brand_country` (models.py:277) is an explicit "raw notes that didn't fit" dumping ground — a schema apology. Plus `seed.py:_cleanup_legacy_urls` scrapes URLs out of `name`. This is scraped-data debt; the new version should ingest already-structured data.
   - Prices/weights/timing/abv are display strings (`"450₽"`, `"320/50"`, `"10-12"`). Defensible for a menu (units + ranges), but note it precludes sorting/filtering by price.

8. **`glass_label_override` escape-hatch** (models.py:106,166,339,376). Every drink can EITHER reference a `Glass` FK OR carry free-text override, kept mutually exclusive by hand in each `_apply_*` and serializer. Works, but it's a dual-source-of-truth pattern that the new schema could collapse (e.g. always create the Glass lookup).

9. **`SEED_CONTENT_FORCE=1` override** (`seed.py:474`). A documented escape hatch that re-runs full content seed, overwriting admin edits. Dangerous env-flag foot-gun; fine as a maintenance script, bad if reachable in the boot path.

10. **Redundant read endpoints.** `GET /api/cocktails`, `/api/classics`, `/api/families` (content.py:227-240) duplicate slices already returned by `/api/content`. Kitchen/zero/zc/spirits have *no* dedicated endpoint (only the bundle). Inconsistent surface; pick one convention.

11. **Serialization inconsistency in the bundle** — cocktails/classics/zero/zc use `_serialize_*` helpers, but kitchen dishes and spirit entries are built inline (`content.py:192-217`). Minor, but it's why the bundle body is long.

12. **`/health` doesn't check the DB** (`main.py:48-50`). Railway's healthcheck (`railway.json`) passes even when Postgres is unreachable, masking outages.

---

## 3. API surface map

Auth model: JWT in HttpOnly cookie `klktv_session`. `get_current_user` decodes it and loads the DB user; `require_editor` = role in {admin, editor}; `require_admin` = role == admin. **All content is behind auth (closed menu).**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | Verify creds, set session cookie, return `{username,name,role}`. Username lower/stripped. |
| POST | `/api/auth/logout` | public | Clear cookie (204). *(see MEDIUM-2)* |
| GET | `/api/auth/me` | user | Current user identity. |
| GET | `/api/content` | user | **Everything** for first render: categories, cocktails, classics, families, zero, zc, kitchen (cats+dishes), spirits (cats+entries), spirit/glass filter lists, timeline. |
| GET | `/api/cocktails` | user | List cocktails (redundant with bundle). |
| GET | `/api/classics` | user | List classics (redundant). |
| GET | `/api/families` | user | List classic families (redundant). |
| GET | `/api/me/progress` | user | `{kind: [slugs]}` learned map for the user. |
| POST | `/api/me/progress/{kind}/{slug}` | user | Mark learned (204). Validates kind + existence. |
| DELETE | `/api/me/progress/{kind}/{slug}` | user | Unmark (204). |
| POST | `/api/me/progress/{slug}` | user | **Legacy/hidden** → classics mark. |
| DELETE | `/api/me/progress/{slug}` | user | **Legacy/hidden** → classics unmark. |
| POST/PATCH/DELETE | `/api/admin/cocktails[/{slug}]` | editor | CRUD cocktail (+ tags/flavors/details, auto-create lookups). |
| POST/PATCH/DELETE | `/api/admin/classics[/{slug}]` | editor | CRUD classic (+ spirits/descriptors/related). |
| POST/PATCH/DELETE | `/api/admin/families[/{key}]` | editor | CRUD family (delete blocked if classics reference it). |
| GET | `/api/admin/categories` | editor | All categories incl. hidden. |
| PATCH | `/api/admin/categories/{key}` | editor | Edit label/order/visibility (key & kind immutable). |
| POST | `/api/admin/categories/reorder` | editor | Bulk set `sort_order` from key list. |
| POST/PATCH/DELETE | `/api/admin/zero-cocktails[/{slug}]` | editor | CRUD non-alc cocktails (+ details). |
| POST/PATCH/DELETE | `/api/admin/zc-drinks[/{slug}]` | editor | CRUD Zero Culture drinks (+ details). |
| POST/PATCH/DELETE | `/api/admin/kitchen-categories[/{slug}]` | editor | CRUD kitchen category (delete blocked if dishes ref it). |
| POST/PATCH/DELETE | `/api/admin/kitchen-dishes[/{slug}]` | editor | CRUD dish. |
| POST/PATCH/DELETE | `/api/admin/spirit-categories[/{slug}]` | editor | CRUD spirit category (delete blocked if entries ref it). |
| POST/PATCH/DELETE | `/api/admin/spirit-entries[/{slug}]` | editor | CRUD spirit encyclopedia entry. |
| GET | `/api/admin/users` | admin | List users (ordered role desc, username). |
| POST | `/api/admin/users` | admin | Create user (201). |
| PATCH | `/api/admin/users/{id|username}` | admin | Update role/name/password (safety rails). |
| DELETE | `/api/admin/users/{id|username}` | admin | Delete (last-admin/self protected). |
| POST | `/api/admin/uploads/image` | editor | Upload → EXIF-fix + downscale to 1600px + re-encode → returns `/static/img/...`. |
| POST | `/api/admin/uploads/resize-existing` | **admin** | Batch-resize files already on the volume (in-place). |
| GET | `/health` | public | Liveness (does not check DB). |
| GET | `/static/img/{filename}` | public | Serve uploaded images (note: **public**, no auth even though menu is "closed"). |

Create endpoints return 201; deletes/progress/logout return 204; PATCH/mutations return `{"slug"|"key": ...}`. Slug-conflict → 409, not-found → 404, bad lookup → 400.

---

## 4. Maintainability assessment

**Cohesion: good at the module boundary, poor within `admin.py`.** The layering is textbook: `config` (env), `database` (engine/session/migrations), `models` (ORM), `schemas` (Pydantic I/O), `auth` (crypto + deps), one router per concern. Files are appropriately sized *except*:
- **`admin.py` (731 lines)** does too much — 8 entity types × 3 verbs with copy-pasted structure. This is the one file that should be split/factored.
- **`seed.py` (494 lines)** mixes user provisioning, category defaults, three different JSON importers, legacy URL cleanup, and field-backfill heuristics. It's a pile of one-off scripts wearing one `main()`.

**Testability: structurally OK, practically untested.** Pure helpers (`_parse_ingredients`, `_safe_stem`, `_shrink_and_encode`, `_serialize_*`, password hashing) are unit-testable in isolation. Router handlers are thin and dependency-injected (`get_db`, auth deps), so FastAPI `TestClient` + a test DB would cover them cleanly. **But there are zero tests, no `uv.lock`, and `pyproject.toml` can't even build a working env (MEDIUM-1).** So today it is *testable in principle, untestable in practice* until the dependency manifest is fixed.

**Bounded contexts:** the content domain is well-bounded; the operational domain (seed/migrate/deploy) is tangled and leaks into the serving path. That's where the maintainability tax lives.

---

## 5. KEEP-AND-CLEAN vs REWRITE — verdict & plan

### Verdict: **KEEP-AND-CLEAN the backend.**

**Why not rewrite:** The parts that are expensive to get right are already right — auth/roles, the eager-loaded read path, the 40-endpoint CRUD surface, the admin safety rails, and a normalized schema that faithfully models the domain (families, junction tables, per-user progress). A rewrite would reproduce all of that and re-introduce risk into a live production menu, in exchange for fixing problems that are individually small and local. The defects are concentrated in *operations and legacy cruft*, not in the domain model or the API.

**Why not "keep as-is":** the seed-resets-users bug (HIGH-1) and slug-rename-orphans-progress bug (HIGH-2) are real data-loss issues that must be fixed regardless of the frontend rewrite.

### Cleanup list (do these; ordered by payoff)

1. **Decouple seed from boot.** Remove `python seed.py &&` from `Dockerfile:30`. Run seed as an explicit one-shot (Railway pre-deploy/release command or manual). Split it: (a) *idempotent content import* (safe to re-run, first-run guarded — already is), (b) *initial-admin provisioning from env* (never overwrite existing users' passwords/roles). Delete the hardcoded `USERS` password list.
2. **Fix slug-rename → progress migration.** In each admin PATCH, when `slug` changes, `UPDATE learning_progress SET slug=:new WHERE kind=:kind AND slug=:old`. Best done once inside the CRUD factory (see #6).
3. **Adopt Alembic.** Replace `create_all` + `_COLUMN_MIGRATIONS`/`_DATA_MIGRATIONS` with real migrations. Baseline the current schema, then drop the `classic_progress` table and its data migration in the first Alembic revision. This is the item that most justifies calling the new version "new."
4. **Fix the dependency manifest.** Add `python-multipart` and `Pillow` (and, if you want the `dotenv` convenience, keep it) to `pyproject.toml`; generate and commit `uv.lock`; have the Dockerfile install *from the manifest* instead of a divergent hardcoded list.
5. **Harden config.** Make `SECRET_KEY` (and ideally `DATABASE_URL`) required in prod — raise on missing rather than defaulting to the public repo value.
6. **Factor `admin.py`** into a generic slug-CRUD helper (or per-entity routers). Removes ~500 lines of duplication and gives fix #2 a single home.
7. **Fix logout cookie attributes** — pass `secure`/`samesite`/`domain` to `delete_cookie` matching the set path.
8. **Small correctness:** guard `int(payload["sub"])` → 401 (LOW-1); make `mark_learned` an upsert (LOW-2); run column vs data migrations in separate transactions (MEDIUM-3); drop the unused JWT `role` claim (LOW-3).
9. **Housekeeping:** remove legacy `/api/me/progress/{slug}` routes once the frontend is confirmed off them; decide on one read convention (bundle vs per-type endpoints); make `/health` optionally ping the DB; add a minimal `TestClient` smoke suite (login, content bundle, one admin CRUD round-trip, progress mark/unmark).

### On Alembic specifically
**Yes — the rewrite should add Alembic.** The current mechanism is append-only by construction and the code itself flags the threshold it's about to cross. Any future change that isn't "add a nullable column" (type changes, NOT NULL, indexes, renames, drops, the `classic_progress` cleanup) is unsupported today. Alembic also removes the need for the fragile shared-transaction migration block (MEDIUM-3) and lets you finally delete the dead legacy table safely.

### If the team rewrites anyway
Keep the schema and the API contract; port them. The things to explicitly **not** carry forward: seed-on-boot, hardcoded credentials, defaulted secrets, the `ClassicProgress` legacy table + its data migration, the `create_all`/ad-hoc-ALTER approach, `brand_country`/URL-in-name scraped-data hacks, and the `admin.py` copy-paste. Everything else earns its place.
