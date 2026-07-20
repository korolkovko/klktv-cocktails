# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working functional (non-kit) admin for staff (editor+) to CRUD all guide content, manage users, and upload images to the Railway volume; `kolya` gets admin access.

**Architecture:** Three backend routers under `/api/admin/*` — `admin.py` (content CRUD, rewritten for the unified v2 `Drink` schema), `admin_users.py` (users, reused), `uploads.py` (image resize→volume, reused). Frontend admin area at `/admin` (editor-gated) built from shared plain-Tailwind form primitives + thin per-entity editors. All media lives on the Railway volume, served at `/static/img/`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic + `uv`/pytest (backend); React 19 + Vite + TS + Tailwind v4 + vitest (frontend). Pillow for image resize.

## Global Constraints

- Unified drink: авторские/безалко/zero-culture are ONE `Drink` (slug-keyed), distinguished by `is_alcoholic` + `is_zero_culture` (+ `caffeine_level`, `is_carbonated`). No cocktail/zero/zc entities.
- ALL images under `UPLOAD_DIR`, served at `/static/img/<name>`. No new media in `frontend/public`. Dev `UPLOAD_DIR=backend/.uploads` (gitignored, stable); prod = Railway volume mount.
- Roles: `reader` (consumer only), `editor` (content CRUD + uploads), `admin` (+ users + destructive). Reuse `require_editor`/`require_admin` from `app/auth.py`.
- Admin write endpoints use camelCase-free snake fields? NO — follow existing bundle convention: admin request/response bodies use the DB-native snake_case field names (these are internal editor shapes, not the kit bundle). Slugs/keys are the natural keys.
- Content reads are live from DEST (`/api/content` reflects edits immediately) — no cache.
- Every backend task: `cd backend && set -a; source .env.migration; export COOKIE_SECURE=false COOKIE_SAMESITE=lax UPLOAD_DIR=$(pwd)/.uploads; set +a` before running the app/tests. Frontend: `npm run build && npm run test`.
- Reference (do not copy blindly — it targets retired models): the existing `backend/app/routers/admin.py` (v2, on old split models) and `git show main:backend/app/routers/admin.py` for endpoint/`_get_or_create_*` patterns.

---

## File Structure

**Backend**
- `backend/app/routers/admin.py` — REWRITE: content CRUD for the v2 schema. Split is acceptable if it grows >~600 lines: `admin.py` (drinks+classics) + `admin_catalog.py` (spirits+kitchen+families+categories). Decide during Task 2 by size.
- `backend/app/routers/admin_users.py` — verify against current `User`, mount.
- `backend/app/routers/uploads.py` — mount as-is.
- `backend/app/schemas_admin.py` — CREATE: all `*WriteIn` / `*AdminOut` Pydantic models (keep them out of the consumer `schemas.py`).
- `backend/app/main.py` — mount the three routers.
- `backend/migration/media_to_volume.py` — CREATE: one-time, re-runnable media migration.
- `backend/tests/test_admin_*.py` — CREATE: per-area CRUD + auth tests.

**Frontend**
- `frontend/src/admin/AdminPage.tsx` — admin shell: tabs + list/editor host.
- `frontend/src/admin/api.ts` — typed `/api/admin/*` client.
- `frontend/src/admin/components/` — `FormFields.tsx` (Text/TextArea/Number/Checkbox/Select), `ImageUploadField.tsx`, `RelationTags.tsx`, `EntityList.tsx`, `EditorShell.tsx`.
- `frontend/src/admin/editors/` — `DrinkEditor.tsx`, `ClassicEditor.tsx`, `SpiritEditor.tsx`, `KitchenEditor.tsx`, `FamilyEditor.tsx`, `CategoriesTab.tsx`, `UsersPage.tsx`.
- `frontend/src/lib/img.ts` — simplify (drop `/logos/` special-case).
- `frontend/src/App.tsx` + guest shell — add `/admin` route + editor-gated "Админка" entry.

---

### Task 1: Media → volume migration + enable uploads

**Files:**
- Create: `backend/migration/media_to_volume.py`
- Create: `backend/tests/test_uploads.py`
- Modify: `backend/app/main.py` (mount `uploads` router; ensure `/static/img` static mount points at `UPLOAD_DIR`)
- Modify: `frontend/src/lib/img.ts`
- Modify: `backend/.gitignore` (add `.uploads/`)

**Interfaces:**
- Produces: uploads endpoint live at `POST /api/admin/uploads/image` returning `{url:"/static/img/<name>", filename, size}`; all drink/kitchen `img` in DB start with `/static/img/`.

- [ ] **Step 1: Write the failing test** `backend/tests/test_uploads.py`

```python
import io
from PIL import Image

def _png_bytes(w=2000, h=1000):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()

def test_upload_resizes_and_returns_static_path(editor_client):
    files = {"file": ("hero.png", _png_bytes(), "image/png")}
    r = editor_client.post("/api/admin/uploads/image", files=files)
    assert r.status_code == 201
    body = r.json()
    assert body["url"].startswith("/static/img/")
    assert body["filename"].endswith(".png")

def test_upload_rejects_non_image(editor_client):
    files = {"file": ("notes.txt", b"hello", "text/plain")}
    r = editor_client.post("/api/admin/uploads/image", files=files)
    assert r.status_code == 415

def test_upload_requires_editor(reader_client):
    files = {"file": ("x.png", _png_bytes(10, 10), "image/png")}
    assert reader_client.post("/api/admin/uploads/image", files=files).status_code == 403
```

(`editor_client`/`reader_client` = TestClient logged in as an editor/reader — add these fixtures to `backend/tests/conftest.py` following the existing authed-client fixture; if none exists, create one that logs in via `/api/auth/login` against a seeded user of each role.)

- [ ] **Step 2: Run to verify it fails** — `uv run pytest tests/test_uploads.py -q` → FAIL (router not mounted).

- [ ] **Step 3: Mount uploads + confirm static mount.** In `backend/app/main.py`, add `uploads` to the routers import and `app.include_router(uploads.router)`. Confirm there is a `app.mount("/static/img", StaticFiles(directory=UPLOAD_DIR), name="img")` (or equivalent) pointing at `UPLOAD_DIR`; add it if missing (create the dir on startup).

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Write the media migration** `backend/migration/media_to_volume.py`:

```python
"""One-time, re-runnable: consolidate all media onto UPLOAD_DIR and rewrite
DB image paths to /static/img/<name>. Copies frontend/public/logos/* and any
kitchen photos into UPLOAD_DIR, then updates drinks.img/photo + kitchen img.
Idempotent: copy-if-absent, and only rewrites /logos/ -> /static/img/."""
import os, shutil, re
from pathlib import Path
from sqlalchemy import create_engine, text

REPO = Path(__file__).resolve().parents[2]
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", REPO / "backend/.uploads"))
LOGOS = REPO / "frontend/public/logos"

def _safe(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", name)

def run(dest_url: str):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    # 1) copy logo files into the volume (rename spaces etc. to safe names)
    copied = {}
    if LOGOS.is_dir():
        for p in LOGOS.iterdir():
            if p.is_file():
                dst_name = _safe(p.name)
                dst = UPLOAD_DIR / dst_name
                if not dst.exists():
                    shutil.copy2(p, dst)
                copied[f"/logos/{p.name}"] = f"/static/img/{dst_name}"
    # 2) rewrite drinks.img (/logos/<f> -> /static/img/<safe f>)
    engine = create_engine(dest_url)
    with engine.begin() as c:
        rows = c.execute(text("SELECT id, img FROM drinks WHERE img LIKE '/logos/%'")).mappings().all()
        for r in rows:
            new = copied.get(r["img"], "/static/img/" + _safe(r["img"].split("/")[-1]))
            c.execute(text("UPDATE drinks SET img=:i WHERE id=:id"), {"i": new, "id": r["id"]})
        print(f"rewrote {len(rows)} drink logo paths")
    engine.dispose()

if __name__ == "__main__":
    run(os.environ["DEST_DATABASE_URL"])
```

- [ ] **Step 6: Simplify `frontend/src/lib/img.ts`** — every non-`http(s)` path is now backend-served; keep absolute passthrough, prefix everything else with `BASE`:

```ts
const BASE = import.meta.env.VITE_API_URL ?? ""
export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  return `${BASE}${url}` // /static/img/… (and legacy /logos/… if any remain)
}
```

- [ ] **Step 7: Run the migration** (dev): `cd backend && set -a; source .env.migration; export UPLOAD_DIR=$(pwd)/.uploads; set +a; uv run python -m migration.media_to_volume`. Expected: "rewrote 24 drink logo paths". Then re-fetch `/api/content` and confirm drink `logo` now starts `/static/img/`.

- [ ] **Step 8: Commit** — `git add backend/migration/media_to_volume.py backend/tests/test_uploads.py backend/app/main.py frontend/src/lib/img.ts backend/.gitignore && git commit -m "feat(admin): media→volume migration + enable image uploads"`

---

### Task 2: Backend — Drinks CRUD (the template)

**Files:**
- Create: `backend/app/schemas_admin.py` (start with drink models)
- Modify/Create: `backend/app/routers/admin.py` (rewrite; start with drinks + shared helpers)
- Create: `backend/tests/test_admin_drinks.py`

**Interfaces:**
- Produces: `DrinkWriteIn`, `DrinkAdminOut` (schemas_admin.py); `_get_or_create_glass/_badge/_spirit/_tag/_flavor`, `_apply_drink(db, obj, data)`; router `admin.router` prefix `/api/admin` dep `require_editor`; endpoints `GET/POST /drinks`, `GET/PATCH/DELETE /drinks/{slug}`.

- [ ] **Step 1: Write the failing test** `backend/tests/test_admin_drinks.py`:

```python
def test_create_update_delete_drink(editor_client):
    payload = {
        "slug": "test-negroni", "name": "Тест Негрони", "subtitle": "проверка",
        "is_alcoholic": True, "is_zero_culture": False,
        "abv_raw": "24%", "price_raw": "650", "volume_ml": 90,
        "glass": "rocks", "badge": None,
        "spirits": ["gin"], "flavors": ["Горький"], "tags": ["gin", "bitter"],
        "details": [{"label": "О коктейле", "text": "многострочный\nтекст", "sort_order": 0}],
        "recipe": "джин, кампари, вермут", "sort_order": 500,
    }
    r = editor_client.post("/api/admin/drinks", json=payload)
    assert r.status_code == 201
    # reflected in the consumer bundle
    bundle = editor_client.get("/api/content").json()
    d = next(x for x in bundle["drinks"] if x["id"] == "test-negroni")
    assert d["spirit"] == "Джин" and "Джин" in d["spirits"]
    assert d["abv"] == 24 and d["price"] == 650 and d["volume"] == 90
    assert any(dt["label"] == "О коктейле" for dt in d["details"])
    # update
    r = editor_client.patch("/api/admin/drinks/test-negroni", json={**payload, "name": "Переименован"})
    assert r.status_code == 200
    assert editor_client.get("/api/admin/drinks/test-negroni").json()["name"] == "Переименован"
    # delete
    assert editor_client.delete("/api/admin/drinks/test-negroni").status_code == 204
    assert editor_client.get("/api/admin/drinks/test-negroni").status_code == 404

def test_create_drink_duplicate_slug_conflicts(editor_client):
    p = {"slug": "dieter", "name": "dup", "is_alcoholic": True, "is_zero_culture": False}
    assert editor_client.post("/api/admin/drinks", json=p).status_code == 409

def test_drinks_require_editor(reader_client):
    assert reader_client.get("/api/admin/drinks").status_code == 403
```

- [ ] **Step 2: Run to verify it fails** — `uv run pytest tests/test_admin_drinks.py -q` → FAIL.

- [ ] **Step 3: Write `schemas_admin.py` drink models.** Reuse the migration parsers for raw→typed so admin input matches the ETL:

```python
from pydantic import BaseModel, Field

class DrinkDetailIn(BaseModel):
    label: str
    text: str
    sort_order: int = 0

class DrinkWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=128)
    name: str
    img: str | None = None
    photo: str | None = None
    subtitle: str | None = None
    abv_raw: str | None = None
    price_raw: str | None = None
    price_currency: str = "₽"
    volume_ml: int | None = None
    glass: str | None = None        # glass key (get-or-create)
    badge: str | None = None        # badge key (get-or-create)
    sort_order: int = 0
    is_alcoholic: bool = True
    is_zero_culture: bool = False
    caffeine_level: int | None = None
    is_carbonated: bool | None = None
    recipe: str | None = None
    garnish: str | None = None
    pitch: str | None = None
    about: str | None = None
    naming: str | None = None
    faq: str | None = None
    spirits: list[str] = []         # spirit keys
    flavors: list[str] = []         # flavor labels
    tags: list[str] = []            # tag keys
    details: list[DrinkDetailIn] = []

class DrinkAdminOut(DrinkWriteIn):
    id: int
    abv: float | None = None        # parsed
    price_amount: float | None = None
```

- [ ] **Step 4: Write `admin.py` drinks + helpers.** Router: `APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_editor)])`. Get-or-create helpers (adapt from the existing admin.py / `git show main:backend/app/routers/admin.py`), keyed by the v2 lookups. `_apply_drink`:

```python
# migration.parsers are pure functions (no I/O) — safe to import into the app.
from migration.parsers import parse_abv, parse_price

def _apply_drink(db, obj, data: DrinkWriteIn):
    abv, _ = parse_abv(data.abv_raw)
    price, _ = parse_price(data.price_raw)
    obj.name = data.name; obj.img = data.img; obj.photo = data.photo
    obj.subtitle = data.subtitle
    obj.abv = abv; obj.abv_raw = data.abv_raw
    obj.price_amount = price; obj.price_raw = data.price_raw; obj.price_currency = data.price_currency
    obj.volume_ml = data.volume_ml; obj.sort_order = data.sort_order
    obj.is_alcoholic = data.is_alcoholic; obj.is_zero_culture = data.is_zero_culture
    obj.caffeine_level = data.caffeine_level; obj.is_carbonated = data.is_carbonated
    obj.recipe = data.recipe; obj.garnish = data.garnish; obj.pitch = data.pitch
    obj.about = data.about; obj.naming = data.naming; obj.faq = data.faq
    g = _get_or_create_glass(db, data.glass) if data.glass else None
    obj.glass_id = g.id if g else None
    b = _get_or_create_badge(db, data.badge) if data.badge else None
    obj.badge_id = b.id if b else None
    db.flush()
    # rebuild relations (delete-then-insert), mirroring the ETL
    for tbl in (m.DrinkSpirit, m.DrinkFlavor, m.DrinkTag, m.DrinkDetail):
        db.query(tbl).filter(tbl.drink_id == obj.id).delete(synchronize_session=False)
    for i, key in enumerate(data.spirits):
        sp = _get_or_create_spirit(db, key)
        db.add(m.DrinkSpirit(drink_id=obj.id, spirit_id=sp.id, sort_order=i))
    for i, label in enumerate(data.flavors):
        fl = _get_or_create_flavor(db, label)
        db.add(m.DrinkFlavor(drink_id=obj.id, flavor_id=fl.id, sort_order=i))
    for i, key in enumerate(data.tags):
        tg = _get_or_create_tag(db, key)
        db.add(m.DrinkTag(drink_id=obj.id, tag_id=tg.id, sort_order=i))
    for det in data.details:
        db.add(m.DrinkDetail(drink_id=obj.id, label=det.label, text=det.text, sort_order=det.sort_order))
```

Endpoints:

```python
@router.get("/drinks", response_model=list[DrinkAdminOut])
def list_drinks(db=Depends(get_db)): ...            # order_by sort_order, name

@router.get("/drinks/{slug}", response_model=DrinkAdminOut)
def get_drink(slug, db=Depends(get_db)): ...        # 404 if absent

@router.post("/drinks", status_code=201, response_model=DrinkAdminOut)
def create_drink(data: DrinkWriteIn, db=Depends(get_db)):
    if db.scalar(select(m.Drink).where(m.Drink.slug == data.slug)):
        raise HTTPException(409, "slug exists")
    obj = m.Drink(slug=data.slug); db.add(obj); db.flush()
    _apply_drink(db, obj, data); db.commit(); ...

@router.patch("/drinks/{slug}", response_model=DrinkAdminOut)
def update_drink(slug, data: DrinkWriteIn, db=Depends(get_db)): ...  # 404 if absent

@router.delete("/drinks/{slug}", status_code=204)
def delete_drink(slug, db=Depends(get_db)):
    obj = ...  # 404 if absent
    db.query(m.ClassicRelatedDrink).filter_by(drink_id=obj.id).delete(synchronize_session=False)
    db.query(m.LearningProgress).filter_by(kind="menu", slug=slug).delete(synchronize_session=False)
    db.delete(obj); db.commit()
```

The `DrinkAdminOut` serializer reads relations back to keys/labels (`spirits=[ds.spirit.key ...]`, `flavors=[df.flavor.label ...]`, `tags=[dt.tag.key ...]`, `details=[...]`, `glass=obj.glass.key`, `badge=obj.badge.key`). Mount `admin.router` in `main.py` now (`from app.routers import admin; app.include_router(admin.router)`); Tasks 3–6 just add more endpoints to the same router.

- [ ] **Step 5: Run tests** — PASS. Also run the full suite `uv run pytest -q` (existing 39 stay green; if `require_editor` fixtures needed conftest changes, confirm no regressions).

- [ ] **Step 6: Commit** — `git commit -m "feat(admin): drinks CRUD on unified schema (+ get-or-create lookups)"`

---

### Task 3: Backend — Classics CRUD

**Files:** Modify `admin.py`, `schemas_admin.py`; Create `backend/tests/test_admin_classics.py`.
**Interfaces:** Produces `ClassicWriteIn`/`ClassicAdminOut`, `_apply_classic`, endpoints `GET/POST /classics`, `GET/PATCH/DELETE /classics/{slug}`.

Follow the Task 2 template exactly, with these fields: `slug, name, family (key), year:int|None, origin, composition, glass (key), garnish, history, for_whom, sort_order`; relations `spirits:list[str]` (keys → ClassicSpirit), `descriptors:list[str]` (labels → ClassicDescriptor via `_get_or_create_descriptor`), `related_drinks:list[str]` (drink slugs → ClassicRelatedDrink; skip unknown slugs). `_apply_classic` rebuilds the three link tables delete-then-insert. Delete removes ClassicSpirit/ClassicDescriptor/ClassicRelatedDrink children + `learning_progress` kind="classics".

- [ ] **Step 1: Failing test** — create/patch/delete a classic; assert it appears in `/api/content` classics with family + ourAnswers resolved; `related_drinks:["dieter"]` yields an `ourAnswers` entry; `reader_client` → 403; duplicate slug → 409.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `ClassicWriteIn`/`ClassicAdminOut` + `_apply_classic` + endpoints (Task 2 shapes).
- [ ] **Step 4: Run → PASS** (+ full suite green).
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): classics CRUD"`

---

### Task 4: Backend — Spirits + spirit-categories CRUD

**Files:** Modify `admin.py`, `schemas_admin.py`; Create `backend/tests/test_admin_spirits.py`.
**Interfaces:** `SpiritCategoryWriteIn`/`Out`, `SpiritEntryWriteIn`/`Out`, endpoints `GET/POST/PATCH/DELETE /spirit-categories/{slug}` and `/spirits/{slug}`.

Spirit category fields: `slug, label, sort_order, is_archived`. Spirit entry fields: `slug, category (slug→category_id), name, img, abv_raw (→abv), price_raw (→price_amount+serving via parse_price), flavour, brand, country, description, features, cocktail_pairings, fact, source_url, sort_order`. Delete category → 409 if it still has entries (clear message); delete entry → also clears `learning_progress` kind="spirits", slug.

- [ ] **Step 1: Failing test** — create category + entry; assert entry appears under the category in `/api/content` spirits with price/serving parsed; deleting a non-empty category → 409; reader → 403.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (Task 2 template).
- [ ] **Step 4: Run → PASS** (+ full suite).
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): spirits + categories CRUD"`

---

### Task 5: Backend — Kitchen + kitchen-categories CRUD

**Files:** Modify `admin.py`, `schemas_admin.py`; Create `backend/tests/test_admin_kitchen.py`.
**Interfaces:** `KitchenCategoryWriteIn`/`Out`, `KitchenDishWriteIn`/`Out`, endpoints `/kitchen-categories/{slug}`, `/kitchen-dishes/{slug}`.

Category fields: `slug, label, sort_order`. Dish fields: `slug, category (slug), name, img, price_raw (→price_amount), tagline, description, timing_raw (→timing_min_low/high via parse_timing), weight_raw (→weight_g via parse_weight_g), nutrition_raw (→kcal_portion/protein_g/fat_g/carb_g/kcal_100g via parse_nutrition), serving, interesting_facts, sort_order`. Also allow direct numeric overrides for the nutrition fields (optional inputs win over parsed). Delete category → 409 if non-empty; delete dish → clear `learning_progress` kind="kitchen".

- [ ] **Step 1: Failing test** — create category + dish with `nutrition_raw`; assert dish appears in `/api/content` kitchen with parsed nutrition + kcal100; reader → 403.
- [ ] **Step 2: Run → FAIL.** — [ ] **Step 3: Implement.** — [ ] **Step 4: PASS** (+ full suite). — [ ] **Step 5: Commit** `feat(admin): kitchen + categories CRUD`.

---

### Task 6: Backend — Families, Categories/sections; mount all + kolya→admin

**Files:** Modify `admin.py`, `schemas_admin.py`, `backend/app/main.py`; verify `admin_users.py`; Create `backend/tests/test_admin_families_users.py`; Create `backend/migration/make_kolya_admin.py`.

Family fields: `key, label, sub, color, logic, evolution, tip, sort_order` — `GET/POST /families`, `GET/PATCH/DELETE /families/{key}`. Categories: `GET /categories`, `PATCH /categories/{key}` (label, is_visible, sort_order), `POST /categories/reorder`.

- [ ] **Step 1: Failing tests** in `test_admin_families_users.py`:
  - family create/patch/delete reflected in `/api/content` families; reader → 403.
  - `admin_users`: `admin_client` can list/create/patch(role,password)/delete users; `editor_client` gets 403 on `/api/admin/users`; an admin cannot delete or demote themselves (expect 400/403).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement families + categories endpoints.** Verify `admin_users.py` uses current `User` (no password_hash leak in `UserOut`; never writes `last_seen_at`); adjust if stale. In `main.py` add `from app.routers import admin, admin_users` and `app.include_router(admin.router); app.include_router(admin_users.router)` (uploads already mounted in Task 1). Write `make_kolya_admin.py`:

```python
import os
from sqlalchemy import create_engine, text
def run(url):
    e = create_engine(url)
    with e.begin() as c:
        c.execute(text("UPDATE users SET role='admin' WHERE username='kolya'"))
        print("kolya role:", c.execute(text("SELECT role FROM users WHERE username='kolya'")).scalar())
if __name__ == "__main__":
    run(os.environ["DEST_DATABASE_URL"])
```

- [ ] **Step 4: Run → PASS** (+ full suite green). Run `uv run python -m migration.make_kolya_admin` → prints `kolya role: admin`.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): families+categories CRUD; mount admin routers; kolya→admin"`

---

### Task 7: Frontend — admin shell, routing, shared primitives, editor gate

**Files:** Create `frontend/src/admin/api.ts`, `frontend/src/admin/AdminPage.tsx`, `frontend/src/admin/components/{FormFields,ImageUploadField,RelationTags,EntityList,EditorShell}.tsx`; Modify `frontend/src/App.tsx` + guest shell to add `/admin` route + editor-gated entry.

**Interfaces:**
- Produces: `adminApi.list/get/create/update/remove(entity, body?)`, `adminApi.uploadImage(file): Promise<{url:string}>`; `<TextField/> <TextArea/> <NumberField/> <CheckboxField/> <SelectField/> <ImageUploadField value onChange/> <RelationTags value onChange options?/> <EntityList items columns onEdit onNew onDelete/> <EditorShell title onSave onClose onDelete?/>`.

- [ ] **Step 1:** `admin/api.ts` — typed wrappers over `api` (credentials include). `uploadImage` posts `multipart/form-data` to `/api/admin/uploads/image`.
- [ ] **Step 2:** shared primitives (plain Tailwind; controlled inputs). `ImageUploadField`: file input → `adminApi.uploadImage` → preview via `resolveImageUrl` → stores returned `url`. `RelationTags`: add/remove chips (free-text key/label, or a `<datalist>` from `options`).
- [ ] **Step 3:** `AdminPage.tsx` — tab bar (Авторские · Классика · Спириты · Кухня · Семейства · Разделы · Юзеры) + hosts `EntityList` and the active editor. Route `/admin` in `App.tsx`; if `user.role === 'reader'`, redirect to guide. Add an "Админка" link (desktop user menu + mobile sections sheet) shown only when `role !== 'reader'`.
- [ ] **Step 4:** `npm run build` clean; a vitest asserting `adminApi` builds the right URLs/bodies (`admin/api.test.ts`).
- [ ] **Step 5: Commit** — `feat(admin/frontend): shell, routing, shared form primitives, editor gate`.

---

### Task 8: Frontend — DrinkEditor (template) with image upload

**Files:** Create `frontend/src/admin/editors/DrinkEditor.tsx`; wire into `AdminPage`.
**Interfaces:** Produces `<DrinkEditor slug?|null onSaved onClose/>` — loads via `adminApi.get('drinks', slug)` (or blank for new), renders all `DrinkWriteIn` fields with primitives (Checkbox for is_alcoholic/is_zero_culture/is_carbonated; NumberField volume/caffeine/sort_order; ImageUploadField for img + photo; RelationTags for spirits[keys]/flavors[labels]/tags[keys]; repeatable details rows), saves via create/update, deletes via `EntityList`.

- [ ] **Step 1:** Build `DrinkEditor` from primitives; the Авторские tab lists drinks (`EntityList`, columns: name, slug, alc/zc badges, price) with New/Edit/Delete.
- [ ] **Step 2:** Manual smoke via running app: create a drink with an uploaded logo → appears in the guide Авторские; edit → reflected; delete → gone. (No heavy test; redesign pending.)
- [ ] **Step 3:** `npm run build` clean.
- [ ] **Step 4: Commit** — `feat(admin/frontend): DrinkEditor (авторские) with image upload`.

---

### Task 9: Frontend — remaining content editors

**Files:** Create `ClassicEditor.tsx`, `SpiritEditor.tsx` (+ category rows), `KitchenEditor.tsx` (+ category rows), `FamilyEditor.tsx`, `CategoriesTab.tsx`; wire tabs.

Each mirrors the DrinkEditor pattern against its own `*WriteIn` fields (Task 3–6). Spirit/Kitchen tabs manage their categories (simple inline list with add/rename/reorder/archive). CategoriesTab manages section visibility/order + reorder.

- [ ] **Step 1:** Implement the five editors + category management.
- [ ] **Step 2:** Manual smoke: create/edit/delete one of each → reflected in the guide.
- [ ] **Step 3:** `npm run build` clean.
- [ ] **Step 4: Commit** — `feat(admin/frontend): classics/spirits/kitchen/families/categories editors`.

---

### Task 10: Frontend — UsersPage (admin-only)

**Files:** Create `frontend/src/admin/editors/UsersPage.tsx`; wire tab (visible only when `role === 'admin'`).
**Interfaces:** list users (name, username, role, last_seen), create (username/name/role/password), edit (name/role/reset password), delete — via `adminApi` `/users`. Hide destructive actions on your own row.

- [ ] **Step 1:** Implement UsersPage; the Юзеры tab renders only for admins (editors don't see it; backend enforces `require_admin` regardless).
- [ ] **Step 2:** Manual smoke as admin (kolya): create a test user, change a role, reset a password, delete the test user; confirm you cannot delete/demote yourself.
- [ ] **Step 3:** `npm run build` clean.
- [ ] **Step 4: Commit** — `feat(admin/frontend): user management (admin-only)`.
