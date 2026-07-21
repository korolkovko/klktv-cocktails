# Bearer-Token Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch v2 auth from an HttpOnly session cookie to a JWT sent in the `Authorization: Bearer` header, so login works when the frontend and backend live on different sites (front on `klktv.tech`, back on `*.up.railway.app`) — which Safari/iOS blocks for cross-site cookies.

**Architecture:** Same JWT (`create_access_token`/`decode_token`, HS256) — only the *transport* changes: the token is returned in the login response body and stored client-side (localStorage), then attached as `Authorization: Bearer <jwt>` on every API call. `get_current_user` reads that header instead of a cookie. No cookies are set at all. `/static/img` is a public mount and is unaffected (images load via `<img>`).

**Tech Stack:** FastAPI + SQLAlchemy + python-jose (backend); React 19 + Vite + TS (frontend). Tests: pytest (backend), vitest (frontend).

## Global Constraints

These bind BOTH tasks — the exact wire contract:

- **`POST /api/auth/login`** on success returns **HTTP 200** with body:
  ```json
  { "access_token": "<jwt>", "token_type": "bearer",
    "user": { "username": "kolya", "name": "Коля", "role": "admin" } }
  ```
  `user` is the existing `UserResponse` shape (`username`, `name` nullable, `role`) — unchanged. On bad creds → **401** `{"detail":"Неверный логин или пароль"}` (unchanged). Rate-limit → **429** (unchanged). **No `Set-Cookie` header** is emitted anymore.
- **`GET /api/auth/me`** returns **200** `UserResponse` when a valid `Authorization: Bearer <jwt>` is present, else **401**.
- **`POST /api/auth/logout`** returns **204** and is a stateless no-op (client discards its token). Kept for API symmetry.
- **All protected endpoints** authenticate from `Authorization: Bearer <jwt>`. Missing/malformed/expired/unknown-user → **401** with the SAME detail strings as today: `"Not authenticated"` (no/blank credentials), `"Invalid session"` (undecodable / bad `sub`), `"User not found"`.
- **localStorage key** for the token: `klktv_token`.
- The JWT itself, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_HOURS`, `ALGORITHM`, roles, and the `last_seen_at` throttle logic are **unchanged**.
- Do **not** delete the `COOKIE_*` constants from `app/config.py` (leave them unused; `test_config.py` may reference them). Just stop using them in `auth.py`.
- **Running backend tests (off-prod):** from `backend/`, `set -a; source .env.test; set +a; uv run pytest -q`. `.env.test` points at a **local pg18 replica** on `127.0.0.1:55432` — NEVER tokaido/prod. Baseline before changes: **81 passed**. Use `--timeout` generously; local run is ~12s.

---

## Task 1: Backend — read JWT from the Authorization header

**Files:**
- Modify: `backend/app/schemas.py` (add `TokenResponse`)
- Modify: `backend/app/auth.py` (`get_current_user` reads bearer; drop cookie helpers)
- Modify: `backend/app/routers/auth.py` (`login` returns token in body; `logout` no-op)
- Modify: `backend/tests/conftest.py` (`login_client` captures token → default header)
- Modify: `backend/tests/test_auth.py` (malformed-token test uses header, not cookie)
- Create/extend tests in: `backend/tests/test_auth.py`

**Interfaces:**
- Produces: `POST /api/auth/login` → `TokenResponse{access_token, token_type, user}`; `get_current_user` authenticating via `Authorization: Bearer`. Task 2 (frontend) consumes exactly this contract.

- [ ] **Step 1: Add `TokenResponse` schema.** In `backend/app/schemas.py`, next to `UserResponse`, add:

```python
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
```
(Confirm `UserResponse` is already defined in this file; if `UserResponse` lives elsewhere, import it so `TokenResponse` can nest it.)

- [ ] **Step 2: Rewrite `get_current_user` to read the bearer header.** In `backend/app/auth.py`:
  - Replace the `Cookie`/`Response` imports with the bearer scheme. Change the top imports from `from fastapi import Cookie, Depends, HTTPException, Response, status` to `from fastapi import Depends, HTTPException, status` and add `from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials`.
  - Drop the cookie-config imports (`COOKIE_DOMAIN, COOKIE_NAME, COOKIE_SAMESITE, COOKIE_SECURE`) from the `app.config` import (keep `ACCESS_TOKEN_EXPIRE_HOURS, SECRET_KEY`).
  - Delete `set_auth_cookie` and `clear_auth_cookie` entirely.
  - Add a module-level `_bearer = HTTPBearer(auto_error=False)` and rewrite the dependency:

```python
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    now = datetime.now(timezone.utc)
    if user.last_seen_at is None or (now - user.last_seen_at) > timedelta(minutes=5):
        user.last_seen_at = now
        db.commit()
    return user
```
`require_admin` / `require_editor` are unchanged (they depend on `get_current_user`).

- [ ] **Step 3: Update the `login` and `logout` handlers.** In `backend/app/routers/auth.py`:
  - Import `TokenResponse` (and keep `UserResponse`) from `app.schemas`.
  - `login`: drop the `response: Response` parameter and the `set_auth_cookie(...)` call; change `response_model=UserResponse` → `response_model=TokenResponse`; return the token in the body. Keep the rate-limit / verify / `_clear_failures` logic exactly as-is:

```python
@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    username = req.username.lower().strip()
    key = (ip, username)

    if _is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many attempts, try again later")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(req.password, user.password_hash):
        _record_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")

    _clear_failures(key)
    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(username=user.username, name=user.name, role=user.role),
    )
```
  - `logout`: remove `clear_auth_cookie`; return 204 no-op. Keep the injected-`Response` pattern OR simply:

```python
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    # Stateless bearer auth: client discards its token; nothing to clear
    # server-side. Endpoint kept for API symmetry / future revocation.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```
(Keep whatever imports `Response` needs; remove now-unused `set_auth_cookie`/`clear_auth_cookie` imports.)

- [ ] **Step 4: Fix the test auth helper to use the header.** In `backend/tests/conftest.py`, change `login_client` so every role fixture (`editor_client`/`reader_client`/`admin_client`) authenticates by header:

```python
def login_client(client, username: str = SMOKE_USER, password: str = SMOKE_PASS):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
```

- [ ] **Step 5: Fix the malformed-token test.** In `backend/tests/test_auth.py`, `test_malformed_token_is_401_not_500` currently sets a cookie; switch to the header:

```python
def test_malformed_token_is_401_not_500():
    with TestClient(app) as client:
        client.headers.update({"Authorization": "Bearer not.a.jwt"})
        r = client.get("/api/auth/me")
        assert r.status_code == 401
```

- [ ] **Step 6: Add bearer-contract tests.** Append to `backend/tests/test_auth.py`:

```python
def test_login_returns_bearer_token_and_user():
    with TestClient(app) as client:
        r = client.post("/api/auth/login", json={"username": SMOKE_USER, "password": SMOKE_PASS})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["token_type"] == "bearer"
        assert isinstance(body["access_token"], str) and body["access_token"]
        assert body["user"]["username"] == SMOKE_USER
        assert "role" in body["user"]
        # No cookie is set anymore
        assert "set-cookie" not in {k.lower() for k in r.headers}


def test_me_requires_bearer_header():
    with TestClient(app) as client:
        assert client.get("/api/auth/me").status_code == 401  # no header
        token = client.post("/api/auth/login",
                            json={"username": SMOKE_USER, "password": SMOKE_PASS}).json()["access_token"]
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["username"] == SMOKE_USER


def test_protected_endpoint_rejects_missing_and_bad_bearer():
    with TestClient(app) as client:
        assert client.get("/api/me/progress").status_code == 401           # missing
        client.headers.update({"Authorization": "Bearer not.a.jwt"})
        assert client.get("/api/me/progress").status_code == 401           # malformed
```

- [ ] **Step 7: Run the backend suite.** From `backend/`: `set -a; source .env.test; set +a; uv run pytest -q --timeout=120`. Expected: all pass (81 prior + the 3 new = 84). If any role-gated test now 401s, it means `login_client` isn't attaching the header — recheck Step 4.

- [ ] **Step 8: Commit.** `git add -A && git commit -m "feat(auth): bearer-token auth — read JWT from Authorization header, return it on login"`

---

## Task 2: Frontend — store the token and send it as a bearer header

**Files:**
- Modify: `frontend/src/lib/api.ts` (token store + `Authorization` header; drop `credentials`)
- Modify: `frontend/src/admin/api.ts` (`uploadImage` sends bearer header)
- Modify: `frontend/src/auth/AuthContext.tsx` (login stores token; bootstrap from localStorage; logout/401 clear token)
- Modify/extend tests: `frontend/src/admin/api.test.ts` and a new `frontend/src/lib/api.test.ts`

**Interfaces:**
- Consumes: the login contract from Task 1 (`{access_token, token_type, user}`) and `Authorization: Bearer <jwt>` on protected calls.

- [ ] **Step 1: Add a token store + header injection in `frontend/src/lib/api.ts`.** Keep the existing `onUnauthorized` machinery. Add near the top (after `BASE`):

```ts
const TOKEN_KEY = "klktv_token"
let token: string | null = null
try { token = localStorage.getItem(TOKEN_KEY) } catch { token = null }

export function setToken(t: string | null) {
  token = t
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore storage errors (private mode / disabled) */ }
}
export function getToken(): string | null {
  return token
}
```
Then in `request()`, build headers with the token and drop `credentials`:

```ts
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  // ...unchanged from here (204 handling, 401 -> onUnauthorized, error throw)...
}
```

- [ ] **Step 2: Send the bearer header from the multipart upload.** In `frontend/src/admin/api.ts`, import `getToken` and attach the header in `uploadImage`, dropping `credentials`:

```ts
import { api, BASE, notifyUnauthorized, getToken } from "@/lib/api"
// ...
  uploadImage: async (file: File): Promise<UploadImageResult> => {
    const form = new FormData()
    form.append("file", file)
    const headers: Record<string, string> = {}
    const t = getToken()
    if (t) headers["Authorization"] = `Bearer ${t}`
    const res = await fetch(`${BASE}/api/admin/uploads/image`, {
      method: "POST",
      headers,
      body: form,
    })
    // ...unchanged 401/notifyUnauthorized + error handling...
  },
```
(Do NOT set `Content-Type` for `FormData` — the browser sets the multipart boundary.)

- [ ] **Step 3: Wire the token through `AuthContext`.** In `frontend/src/auth/AuthContext.tsx`:
  - Import `setToken, getToken` from `@/lib/api`.
  - Add a login-response type and use it: `interface LoginResponse { access_token: string; token_type: string; user: User }`.
  - Bootstrap: only probe `/api/auth/me` when a token exists.
  - On any 401, clear the token too.
  - `login` stores the token; `logout` clears it (drop the now-useless network call).

```tsx
React.useEffect(() => {
  if (!getToken()) { setLoading(false); return }
  api.get<User>("/api/auth/me")
    .then(setUser)
    .catch(() => { setToken(null); setUser(null) })
    .finally(() => setLoading(false))
}, [])

React.useEffect(() => {
  setUnauthorizedHandler(() => { setToken(null); setUser(null) })
  return () => setUnauthorizedHandler(null)
}, [])

const login = async (username: string, password: string) => {
  const res = await api.post<LoginResponse>("/api/auth/login", {
    username: username.trim().toLowerCase(),
    password,
  })
  setToken(res.access_token)
  setUser(res.user)
}

const logout = async () => {
  setToken(null)
  setUser(null)
}
```

- [ ] **Step 4: Update `frontend/src/admin/api.test.ts`.** It currently asserts `uploadImage` sends `credentials: "include"`; change those expectations to assert an `Authorization: Bearer <token>` header is sent (set a token via `setToken("t123")` in the test first) and that `credentials` is no longer required. Keep all other assertions.

- [ ] **Step 5: Add `frontend/src/lib/api.test.ts`.** Cover: (a) `setToken`/`getToken` round-trip and localStorage persistence; (b) `request()` attaches `Authorization: Bearer <token>` when a token is set (mock `fetch`, inspect the headers arg); (c) no `Authorization` header when no token. Example skeleton:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { api, setToken, getToken } from "./api"

beforeEach(() => { setToken(null); vi.restoreAllMocks() })

it("stores and persists the token", () => {
  setToken("abc")
  expect(getToken()).toBe("abc")
  expect(localStorage.getItem("klktv_token")).toBe("abc")
  setToken(null)
  expect(localStorage.getItem("klktv_token")).toBeNull()
})

it("sends Authorization when a token is set", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetchMock)
  setToken("tok123")
  await api.get("/api/content")
  const init = fetchMock.mock.calls[0][1]
  expect(init.headers["Authorization"]).toBe("Bearer tok123")
})

it("omits Authorization when no token", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetchMock)
  setToken(null)
  await api.get("/api/content")
  const init = fetchMock.mock.calls[0][1]
  expect(init.headers["Authorization"]).toBeUndefined()
})
```
(Adjust the `fetch` mock shape to match how `request()` reads the response — the existing `admin/api.test.ts` shows the project's convention; follow it.)

- [ ] **Step 6: Run the frontend checks.** From `frontend/`: `npm run test -- --run` (vitest), then `npm run build`, then `npm run lint` (use whatever scripts exist in `package.json`). Expected: all green (existing 56 + new).

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(auth): bearer-token client — store JWT in localStorage, send Authorization header"`

---

## Self-Review notes (author)
- Contract types match across tasks: backend `TokenResponse{access_token, token_type, user}` ↔ frontend `LoginResponse` with the same fields; `getToken`/`setToken` names identical in `lib/api.ts` and consumers.
- Coverage: cookie→bearer transport (both sides), test helper switch, new contract tests, image path unaffected (public), logout/401 token-clear.
- No placeholders; all steps carry real code.
