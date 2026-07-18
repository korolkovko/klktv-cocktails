# Security Audit — KLKTV / Kollektiv Cocktails (closed login-only menu)

**Scope:** FastAPI backend + React frontend, JWT-in-HttpOnly-cookie auth, roles (admin/editor/reader), image uploads, Railway deploy.
**Type:** Formal, read-only, authorized defensive review. No files were modified.
**Date:** 2026-07-19
**Reviewer target paths:** `_src/backend/app/*`, `_src/backend/seed.py`, `_src/frontend/src/auth/*`

All paths below are absolute-relative to
`/Users/korolkovnikolai/Library/CloudStorage/Dropbox/claude-apps/klktv-cocktails-new/_src`.

---

## Executive summary

The app's **authorization model is solid** — role checks are applied consistently at the router level, there is no missing `require_admin`/`require_editor`, queries use the ORM (no SQL injection), JWT uses an explicitly-pinned algorithm (no alg-confusion), the upload path re-encodes through Pillow (defeats polyglot/path-traversal), and there are sensible last-admin / self-demotion guards.

The serious problems are in **secrets and credential management**: production login credentials (including the admin) are committed to the repository in plaintext *and* are force-reset into the DB on every deploy, and the JWT signing key has a known hard-coded fallback with no fail-fast. Secondary issues: no brute-force protection, a 4-character minimum password policy, OpenAPI docs exposed unauthenticated, no server-side token revocation, and a Pillow image-DoS vector.

**Ranked findings:** 2 Critical, 2 High, 6 Medium, 4 Low.

---

## CRITICAL

### C-1. Production credentials hard-coded in `seed.py` and re-seeded on every deploy
**Severity:** Critical — **Confirmed**
**File:** `backend/seed.py:32-45` (USER list), `backend/seed.py:205-220` (`seed_users`), `backend/Dockerfile:30` (runs `python seed.py` on every container start).

All 12 accounts, including `admin`, are defined with plaintext passwords in a git-tracked file:

```
("admin", "kollektiv77", "admin", "Админ"),
("max",   "dieter17",    "reader", ...), ... ("stepa", "rocket44", "reader", ...)
```

Confirmed git-tracked: `git ls-files backend/seed.py` returns the file.

Two compounding problems:
1. **Plaintext secrets in source control.** Anyone with repo/history access (current or former team member, a leaked clone, a misconfigured CI) obtains the admin password and every user password. Because they are committed to history, rotating them requires history rewriting, not just a new commit.
2. **`seed_users()` unconditionally overwrites `password_hash`, `role`, and `name` for these usernames on every startup** (`existing.password_hash = hash_password(password)` — no "only if new" guard), and the Dockerfile CMD (`python seed.py && exec uvicorn …`) runs it on every deploy/restart. Consequences:
   - You **cannot rotate the admin password through the UI** — any change is reverted to `kollektiv77` on the next restart.
   - You cannot change a seeded user's role via the admin UI durably; it snaps back on restart.

**Exploit scenario:** An attacker who has ever seen the repo (or its history) browses to the site and logs in as `admin`/`kollektiv77`, gaining full content + user-management control (create users, reset any password, delete users). No brute-force needed.

**Fix:**
- Remove all plaintext credentials from `seed.py`. Seed only a single bootstrap admin whose password comes from an env var (e.g. `INITIAL_ADMIN_PASSWORD`), and only create it **if no users exist** — never overwrite existing hashes.
- Treat the committed passwords as burned: rotate every account after removing them, and purge from git history (`git filter-repo`) or, more realistically for a small app, reset every password out-of-band.
- Do not run destructive seeding on every boot; gate it behind an explicit one-shot job/flag.

---

### C-2. Known hard-coded fallback `SECRET_KEY`, no fail-fast in production
**Severity:** Critical (conditional on env) — **Confirmed code flaw**
**File:** `backend/app/config.py:3`

```python
SECRET_KEY = os.environ.get("SECRET_KEY", "klktv-cocktails-dev-secret-change-in-prod")
```

The fallback string is committed and public. It is the HS256 signing key for all session JWTs (`backend/app/auth.py:31-37,42`). If `SECRET_KEY` is not set in the Railway environment, the server signs and verifies tokens with a value anyone can read in the repo.

**Exploit scenario:** If the env var is unset (easy to forget on a new "v2" deploy), an attacker forges a token: `jwt.encode({"sub":"1","role":"admin","exp": …}, "klktv-cocktails-dev-secret-change-in-prod", algorithm="HS256")`, sets it as the `klktv_session` cookie, and is authenticated as user id 1 — full admin — without any password. Authorization reads role from the DB (good), but `sub=<any real admin id>` still yields admin.

**Fix:** Fail closed at startup — if `SECRET_KEY` is unset (or equals the dev fallback) while not in an explicit dev mode, raise and refuse to boot. Never ship a usable default secret. Require a ≥32-byte random key. Rotating the key also invalidates all existing tokens (desirable given C-1).

---

## HIGH

### H-1. No brute-force protection / rate limiting on login
**Severity:** High — **Confirmed**
**File:** `backend/app/routers/auth.py:18-28`; no rate-limiting middleware anywhere (confirmed: no `slowapi`/`Limiter`/`ratelimit` in the codebase).

Login accepts unlimited attempts. Combined with weak seeded passwords (`candy55`, `peach88`, `rocket44`, … — short, lowercase+digits, dictionary-guessable) and the 4-char minimum policy (H-2), an attacker can enumerate/guess credentials offline-style at HTTP speed. bcrypt cost 12 slows per-guess but does not stop sustained guessing of weak passwords, and does nothing against a leaked-list credential-stuffing run.

**Exploit scenario:** Script POSTs `/api/auth/login` with a wordlist against `admin` and the known short passwords; no lockout, throttle, CAPTCHA, or delay intervenes.

**Fix:** Add per-IP and per-username rate limiting / exponential backoff / temporary lockout on `/api/auth/login` (e.g. `slowapi`, or a Redis counter). Consider a small artificial delay and an account-lock threshold. Put the app behind Railway/Cloudflare rate limits as defense-in-depth.

### H-2. Weak password policy
**Severity:** High — **Confirmed**
**File:** `backend/app/routers/admin_users.py:37,45` — `password: str = Field(min_length=4, max_length=128)`.

A 4-character password is permitted for any account, including admins created via the UI. There is no complexity, breach-list, or length-≥12 requirement. This directly amplifies H-1.

**Fix:** Raise minimum length (≥12 for admins, ≥10 generally), reject common/breached passwords, and consider a strength meter on the client. Note bcrypt silently truncates input beyond 72 bytes (L-2).

---

## MEDIUM

### M-1. OpenAPI docs and schema exposed unauthenticated in production
**Severity:** Medium — **Confirmed**
**File:** `backend/app/main.py:26` — `FastAPI(title=…, docs_url="/api/docs", …)`. `docs_url` is set (not disabled), and `/openapi.json` + `/redoc` remain at defaults. None are behind `get_current_user`.

For a deliberately-closed app, this hands an anonymous attacker the complete API map (every admin/editor/user-management route, request schemas, enum of roles) to plan attacks against C-2/H-1.

**Fix:** In production set `docs_url=None, redoc_url=None, openapi_url=None`, or gate them behind auth. Keep them only in a dev profile.

### M-2. No server-side token revocation; logout is client-side only; 24h lifetime
**Severity:** Medium — **Confirmed**
**File:** `backend/app/auth.py:31-45,60-65`; `backend/app/routers/auth.py:31-34`; `ACCESS_TOKEN_EXPIRE_HOURS=24` (`config.py:13`).

JWTs are stateless with no denylist/jti. `logout` only calls `delete_cookie` — it removes the cookie from the *current* browser but does nothing to a token that has already been captured; that token stays valid for up to 24h. There is no way to force-logout a user, invalidate a leaked token, or end all sessions after a password reset. (Positive: `get_current_user` re-loads the user from the DB each request, so **role changes and account deletion do take effect immediately** — only outstanding-token revocation is missing.)

**Fix:** Shorten access-token lifetime (e.g. 1-4h) and/or add a revocation mechanism: a `token_version`/`sessions` table checked in `get_current_user`, or a short-lived access token + rotating refresh token. Bump `token_version` on password change and logout-all.

### M-3. CSRF defense relies entirely on CORS + `SameSite=None`; upload endpoint is not preflight-protected
**Severity:** Medium — **Confirmed (design), impact Low-Medium**
**File:** `backend/app/config.py:10` (`COOKIE_SAMESITE` default `"none"`), `backend/app/main.py:28-34` (CORS), `backend/app/auth.py:47-57`.

Auth is a cookie sent cross-site (`SameSite=None`, required for the split frontend/backend origins on Railway). There is no CSRF token. JSON mutation endpoints are effectively protected because `application/json` bodies trigger a CORS preflight that a foreign origin fails — **but this protection collapses if `CORS_ORIGINS` is ever set to `*` or too broadly**, and the multipart upload endpoint (`POST /api/admin/uploads/image`, `multipart/form-data`) is a CORS "simple request" that is **not** preflighted, so a cross-origin page could trigger an authenticated editor's browser to upload files (attacker can't read the response, but can write junk images to the volume).

**Fix:** Add an explicit CSRF defense-in-depth (double-submit cookie or `X-Requested-With` header required on all mutations, including uploads). Keep `CORS_ORIGINS` a strict allowlist and assert it is never `*` when `allow_credentials=True`.

### M-4. Pillow image-decompression DoS on upload
**Severity:** Medium — **Confirmed**
**File:** `backend/app/routers/uploads.py:28,58-99,102-128`.

`MAX_BYTES = 12 MB` bounds the *compressed* upload, but a small highly-compressed image (decompression bomb) can expand to an enormous pixel buffer when `Image.open(...)` / `resize(...)` runs. `Image.MAX_IMAGE_PIXELS` is left at Pillow's default (warns, doesn't hard-block by default), and there is no explicit width/height guard before decode. A few concurrent crafted uploads can exhaust the container's memory (single-worker Railway box). `resize-existing` (admin-only) has the same exposure over volume files.

**Fix:** Set a strict `Image.MAX_IMAGE_PIXELS` cap and reject images whose declared dimensions exceed a sane bound *before* full decode; cap total pixels; run image work with a memory/time budget. Keep Pillow patched (see M-6).

### M-5. Login user-enumeration via timing side-channel
**Severity:** Medium — **Confirmed**
**File:** `backend/app/routers/auth.py:20-25`.

```python
if not user or not verify_password(...):
```

Short-circuit `or`: when the username does not exist, bcrypt is **never** called, so the response returns markedly faster than for a valid username (where a full bcrypt-12 verify runs). An attacker measuring response latency can enumerate valid usernames despite the generic error message. (The generic message itself is good — see Positives.)

**Fix:** Always perform a bcrypt comparison against a fixed dummy hash when the user is missing, so both paths take constant time.

### M-6. Dependency risk: `python-jose` (unmaintained) and unpinned floors
**Severity:** Medium — **Confirmed (posture)**
**File:** `backend/pyproject.toml:6-15`, `backend/Dockerfile:12-22`.

- `python-jose[cryptography]>=3.3.0` — python-jose is largely unmaintained and has known CVEs (e.g. CVE-2024-33663 algorithm-confusion, CVE-2024-33664 JWE decompression DoS). Not directly exploitable here (HS256-only, no JWE decoding, algorithm pinned), but the library is a liability going forward.
- All deps use `>=` floors with no lockfile, so builds float to whatever is current — non-reproducible, and a future resolve could pull a regressed version. `Pillow>=11.0.0` (Dockerfile) similarly floats; Pillow has a steady stream of image-parsing CVEs (ties to M-4).

**Fix:** For the new version, migrate JWT to **PyJWT** (actively maintained). Pin exact versions and commit a lockfile (`uv.lock`). Add automated dependency scanning (Dependabot / `pip-audit`).

---

## LOW

### L-1. Error/exception detail leakage on editor/admin endpoints
**Severity:** Low — **Confirmed**
**File:** `backend/app/routers/uploads.py:64` (`f"Не могу распознать формат: {e}"`), `uploads.py:161` (`errors.append(f"{p.name}: {e}")`).

Raw exception text and volume filenames are returned to the caller. Only reachable by authenticated editor/admin, so low impact, but it leaks internal detail. (FastAPI's default 500 handler does not expose tracebacks since `debug` is not enabled — good.)

**Fix:** Return generic messages; log details server-side.

### L-2. bcrypt 72-byte truncation not handled
**Severity:** Low — **Confirmed**
**File:** `backend/app/auth.py:23-28`.

bcrypt silently ignores bytes past 72; the schema allows 128-char passwords, so long passwords are truncated, and two passwords sharing the first 72 bytes are equivalent. Minor.

**Fix:** Pre-hash with SHA-256 before bcrypt, or enforce a ≤72-byte effective limit and document it.

### L-3. CORS `allow_methods`/`allow_headers` wildcard + reliance on env correctness
**Severity:** Low — **Confirmed**
**File:** `backend/app/main.py:28-34`.

Origins are a strict env-driven allowlist (good, default `http://localhost:5173`, not `*`), but methods and headers are `["*"]` and the whole CSRF posture (M-3) hinges on `CORS_ORIGINS` being set correctly in prod. A future misconfiguration to `*` combined with `allow_credentials=True` would be dangerous (Starlette would reflect the origin).

**Fix:** Constrain methods/headers to what's used; add a startup assertion that `CORS_ORIGINS` is non-empty and not `*`.

### L-4. Editor-controlled `img` / `source_url` fields; verify no `dangerouslySetInnerHTML`
**Severity:** Low — **Theoretical**
**File:** `backend/app/routers/admin.py` (e.g. `img`, `source_url` accepted unvalidated), `frontend/src/auth/api.js:43-48` (`resolveImageUrl` passes `http(s)://` through unchanged).

An editor can store arbitrary URLs (external image / tracking / `javascript:`-style values depend on frontend rendering). Editors are trusted, so impact is low, but two things to confirm in the new version: (a) content fields (history/tagline/etc.) are only ever rendered through React's escaping — **not** `dangerouslySetInnerHTML** (React auto-escaping otherwise prevents stored XSS); (b) `img`/`source_url` are validated to `http(s)`/relative and rendered as `src`/`href` only.

**Fix:** Validate URL scheme on write (allow only `https:` and `/static/…`/relative). Confirm no raw-HTML rendering of user content.

---

## Confirmed-good (do carry forward)

These were checked and are correct — worth preserving in v2:

- **Consistent authorization.** Every mutating surface is gated at the router level: `admin.py` → `dependencies=[Depends(require_editor)]` (line 23); `admin_users.py` → `require_admin` (line 20); `uploads.py` → `require_editor` (line 24) with `resize-existing` additionally `require_admin` (line 131); `content.py` → `get_current_user` on the whole router (line 21, closed menu). **No mutating/admin endpoint is missing its guard.**
- **No privilege escalation via role claim.** `get_current_user` re-loads the user from the DB each request and `require_admin`/`require_editor` check the **DB** role (`auth.py:83-92`), so the JWT `role` claim is not trusted for authz; demotion/deletion take effect immediately.
- **No IDOR in per-user state.** `me.py` scopes every progress row by `user.id`; a user cannot read/modify another's data.
- **Last-admin / self-demotion protection.** `admin_users.py:105-113,133-136` prevents removing the last admin and self-demotion lock-out.
- **No SQL injection.** All access is via SQLAlchemy ORM with bound parameters; the only raw SQL (`database.py:25-46`) is static, no interpolation. `.like('%http%')` in `seed.py` is a literal.
- **No JWT alg-confusion.** `jwt.decode(..., algorithms=["HS256"])` pins the algorithm (`auth.py:42`); `exp` is verified by default; encode uses HS256.
- **Upload hardening.** Files are re-decoded and re-encoded through Pillow (`_shrink_and_encode`) — this strips polyglot/embedded payloads and validates real image content beyond the extension check; filenames are sanitized (`SAFE_BASENAME` regex, `_safe_stem`) with a random suffix and an allowlisted extension → **no path traversal**, no attacker-controlled filename.
- **`resize-existing` is NOT an SSRF.** It only iterates local `UPLOAD_DIR` files (`uploads.py:131-162`); it takes no URL/user input and fetches nothing remote. (Its only real risk is the shared Pillow-DoS surface, M-4.)
- **HttpOnly cookie** (`auth.py:52`) keeps the token out of JS (mitigates XSS token theft); `Secure`/`SameSite` are env-configurable.
- **Generic login error** ("Неверный логин или пароль", `auth.py:22-25`) — no direct username enumeration (only the timing channel, M-5).
- **Indexing suppressed.** `frontend/index.html` has `robots noindex,nofollow,noarchive,nosnippet` (+ googlebot/yandex) and `frontend/public/robots.txt` is `Disallow: /` for all major bots.
- **Secrets git-hygiene.** `.gitignore` and `.dockerignore` exclude `.env`/`.env.*` (keep `.env.example`); no `.env` file is committed. (The credential leak is via `seed.py`/`config.py`, C-1/C-2 — not a stray `.env`.)

---

## Priority fix list for the new version

1. **(C-1)** Remove all plaintext creds from `seed.py`; seed only a bootstrap admin from an env var, only when no users exist; stop overwriting existing hashes on every boot; rotate all leaked passwords.
2. **(C-2)** Require `SECRET_KEY` from env; fail-fast if missing/default; ≥32 random bytes.
3. **(H-1/H-2)** Add login rate limiting/lockout; raise password minimums and check against breach lists.
4. **(M-1)** Disable `/api/docs`, `/redoc`, `/openapi.json` in prod (or auth-gate).
5. **(M-2)** Shorten token lifetime and add revocation (`token_version`/session table).
6. **(M-3)** Add CSRF defense-in-depth (incl. the multipart upload path); assert strict CORS.
7. **(M-4)** Cap Pillow pixel dimensions before decode.
8. **(M-6)** Move to PyJWT, pin+lock all dependencies, add `pip-audit`/Dependabot.
9. **(M-5, L-1..L-4)** Constant-time login, generic errors, bcrypt pre-hash, URL-scheme validation, confirm no raw-HTML rendering.
