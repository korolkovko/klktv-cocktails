# klktv-cocktails v2 — Deploy runbook (Railway)

Chosen strategy (2026-07-20): **reuse the existing new DB (tokaido) as v2-prod**, deploy to a
**staging URL first**, QA live, then switch the domain. The v2 backend + frontend Railway
**services don't exist yet** — create them (the DB already exists). v1 stays live until the switch.

Legend: 🖐 = you do it in the Railway dashboard / shell (I can't). ✅ = already prepared in the repo.

## Architecture

```
 browser ──HTTPS──▶ frontend service (nginx, static SPA)      built from frontend/Dockerfile
    │                     └ VITE_API_URL baked at build time ─┐
    └──HTTPS (cookies: credentials include)──▶ backend service (uvicorn) ── Postgres (tokaido)
                                                    └ Railway VOLUME mounted at UPLOAD_DIR
                                                      serves /static/img/<name>
```
Two services + the existing DB. Cookies are cross-origin (`SameSite=none; Secure`), so CORS must
name the exact frontend origin. Images are served by the backend from the volume.

## Already prepared in the repo ✅

- Backend `Dockerfile` (runs `alembic upgrade head` on boot, `--proxy-headers`), `railway.json` (Dockerfile builder, healthcheck `/health`).
- Frontend `Dockerfile` (multi-stage; `ARG VITE_API_URL`; nginx SPA fallback), `nginx.conf`, `railway.json`.
- `config.py` fail-fast on missing `SECRET_KEY`/`DATABASE_URL`; CORS `allow_credentials` + exact origins; cookie flags env-driven.
- `.dockerignore`s keep secrets (`.env.migration`) and the dev `.uploads/` out of images.
- **Media**: the 52 content images are baked into the backend image (`backend/seed_media/`) and auto-seed an empty volume on boot (`app/media_seed.py`, copy-if-absent) — no manual media upload needed.
- Cutover scripts: `migration/prepare_prod.py` (remove dev/test users), `migration/make_kolya_admin.py`, `migration/media_to_volume.py` (only if re-running the ETL into a fresh DB — not needed for tokaido reuse), `migration/run.py` (full ETL).
- `.env.example` (both services) document every var.

---

## Part A — Backend service 🖐

1. New Railway service → **Deploy from repo**, root directory `backend/` (builder = Dockerfile, auto-detected from `railway.json`).
2. Attach a **Volume**, mount path **`/app/uploads`** (this is `UPLOAD_DIR`). This is what makes uploads + served images survive redeploys.
3. Set **Variables**:

   | Variable | Value |
   |---|---|
   | `SECRET_KEY` | a fresh 64-char random (`python -c "import secrets;print(secrets.token_urlsafe(48))"`) — NOT the dev one |
   | `DATABASE_URL` | the tokaido Postgres URL (Railway can reference the DB service's connection var) |
   | `CORS_ORIGINS` | the **staging** frontend URL for now (exact, no trailing slash) — you'll get it in Part B; set a placeholder, then update |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_SAMESITE` | `none` |
   | `UPLOAD_DIR` | `/app/uploads` |
   | `DEBUG` | `false` |

4. Deploy. On boot the container runs `alembic upgrade head` (schema already current — idempotent) and seeds the volume from `seed_media`.
5. Verify: `GET https://<backend>/health` → 200; `GET https://<backend>/api/content` → **401** (auth-gated = healthy); `GET https://<backend>/static/img/pornstar.webp` → 200 (media seeded). Note the backend's public URL.

## Part B — Frontend service 🖐

1. New Railway service → **Deploy from repo**, root directory `frontend/` (Dockerfile builder).
2. Set the **build-time** variable **`VITE_API_URL`** = the backend public URL from Part A (exact, `https://…`, no trailing slash). It's baked at build time — a runtime var won't work; if Railway only exposes it as a plain variable, ensure it's available to the Docker build (Railway passes service variables as build args for Dockerfile builds).
3. Deploy. Note the frontend public (staging) URL.
4. Verify: the SPA loads; `/classics` deep-link refreshes without 404 (nginx fallback).

## Part C — Wire cross-origin 🖐

1. Back on the **backend** service, set `CORS_ORIGINS` = the frontend staging URL from Part B (exact). Redeploy the backend.
2. Sanity: from the staging frontend, log in → the `klktv_session` cookie is set and `/api/content` returns data (not 401). If login "succeeds" but every call is 401, it's almost always a cookie/CORS mismatch: confirm `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and `CORS_ORIGINS` exactly equals the frontend origin.

## Part D — Pre-go-live DB cleanup 🖐 (against tokaido, right before QA/switch)

```
cd backend && set -a; source .env.migration; set +a      # .env.migration DEST=tokaido
uv run python -m migration.prepare_prod          # removes v2tester + smoke_* dev users
uv run python -m migration.make_kolya_admin      # ensure kolya=admin (already done, idempotent)
```
Do NOT run `prepare_prod` while still doing local dev — it deletes `v2tester`, which local login uses.
(Optional, if any stray test content exists: check `SELECT slug FROM drinks WHERE slug LIKE 'test-%' OR slug LIKE 'zzz-%';` — should be empty; the smoke drink was already cleaned.)

## Part E — Staging QA checklist (as kolya)

- Log in as `kolya` (admin). Guest side: Авторские (spirit filter works), Классика, Спириты (bottle thumbs/price), Кухня (nutrition incl. /100г), Прогресс → Мой/Команда tabs (last visit + activity).
- Images load (logos, kitchen photos) — they come from `<backend>/static/img/…`.
- **Админка** (`/admin`): create/edit/delete one of each type; upload a photo (lands on the volume, shows in the guide); Юзеры: create a test user, change role, reset password, delete it; confirm you can't delete/demote yourself.
- Reader account sees no «Админка» and gets 403 on `/api/admin/*`.

## Part F — Switch the domain 🖐

1. Point `cocktails.klktv.tech` at the **v2 frontend** service (Railway custom domain).
2. If the frontend's public URL/domain changes, **rebuild the frontend** with `VITE_API_URL` = the final backend domain, and update backend `CORS_ORIGINS` to the final frontend domain; redeploy both.
3. Re-run the Part E smoke on the real domain. Keep v1 running until you're satisfied.

## Part G — Security (owner, do this too) 🖐

- **Rotate + purge the 12 plaintext staff passwords from git history.** They were removed from HEAD but remain in history on `main`. Rotate the real passwords and purge history (e.g. `git filter-repo`) before the repo is shared/exposed. This is independent of the deploy but must happen.
- Generate a fresh prod `SECRET_KEY` (Part A) — never reuse the dev `dev-v2-local-secret…`.

## Rollback

v1 is untouched until Part F. To roll back: repoint `cocktails.klktv.tech` back at the v1 service. Since v2 reuses tokaido (a separate DB from v1's), v1 data is unaffected by anything above.

## Env var reference

**Backend:** `SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `UPLOAD_DIR=/app/uploads`, `DEBUG=false`. (`SRC_/DEST_DATABASE_URL` only for ETL, not the running app.)
**Frontend (build arg):** `VITE_API_URL`.
