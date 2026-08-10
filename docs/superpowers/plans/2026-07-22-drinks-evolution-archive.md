# Авторские evolution + Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drink categories (Kitchen-style sections), an `is_hot` flag, an `ice` field, glass/badge/ice managed as dictionaries, portrait multi-photo galleries, and archive-instead-of-delete for all content items.

**Architecture:** Additive Postgres schema (one Alembic revision per phase) + FastAPI admin/consumer wiring + the kit-based admin pages + the guest cocktail-guide. Every new admin capability mirrors an existing pattern already in the repo (kitchen-categories subpanel, EntityTable toolbar chip, §50 form fields). Spec: `docs/superpowers/specs/2026-07-22-drinks-evolution-archive-design.md`.

**Tech Stack:** SQLAlchemy 2 + Alembic, FastAPI, Pydantic v2, React 19 + Vite + TS + Tailwind v4 + the `@kollektiv` kit.

## Global Constraints

- **Branch `v2`.** Prod is live; every schema change is **additive + backfilled**, never destructive. **No re-ETL.**
- **Alembic:** one revision per phase; chain from the current head `b2c3d4e5f6a7`. Hand-written `upgrade()`/`downgrade()` (see `alembic/versions/b2c3d4e5f6a7_*.py` for the template). Keep `models.py` in sync with every migration. **Revision filenames/ids in this plan are illustrative** — scaffold each with `alembic revision -m "<msg>"` (generates a real id) or pick a unique hex, and set `down_revision` to the actual prior head so the chain is linear.
- **Backend tests run against the real migrated test DB** (`backend/.env.test`, ephemeral local pg18 replica of tokaido — recreate if gone; never touch live `tokaido`). Run `alembic upgrade head` on it before running a phase's tests. Test via `/api/admin/*` + `/api/content` (the existing `test_admin_*.py` pattern; `editor_client`/`admin_client`/`reader_client` fixtures).
- **Frontend gate:** `cd frontend && npm run build && npm run test && npm run lint` all green. Kit pages can't be `renderToStaticMarkup`'d under node-vitest → test pure mappers/helpers only.
- **Archive semantics:** `is_archived` on **items only** (`drinks`, `classics`, `spirit_entries`, `kitchen_dishes`); `/api/content` filters them out **entirely** (guest never sees archived); admin keeps hard-delete AND adds an archive toggle. `learning_progress` rows on archived items are left intact (no cascade).
- **Dictionaries:** the admin never shows or asks for a raw `key`; the user types a `label` and the key is derived server-side. Existing `_get_or_create_glass/badge` stays; new explicit CRUD added.
- **Categories** (drinks) are **required** (`NOT NULL` FK); migration seeds `Основные` and backfills all drinks. **not** get-or-created on write (must exist, like `kitchen.category`).
- **Copy:** Russian UI, mono-caps field labels, matching the existing admin pages. Delete UX = ⋯ arcade hold-3s + ConfirmDialog (unchanged).
- **Media:** photos upload via `adminApi.uploadImage` → `/static/img/…` on the Railway volume (unchanged pipeline).

## File map

- **Schema/models:** `backend/app/models.py`; migrations `backend/alembic/versions/<rev>_*.py`.
- **Backend shapes:** `backend/app/schemas_admin.py` (admin), `backend/app/schemas.py` (consumer).
- **Backend routes:** `backend/app/routers/admin.py` (CRUD + appliers/serializers), `backend/app/routers/content.py` (bundle).
- **Backend tests:** `backend/tests/test_admin_*.py`, plus new `test_admin_dictionaries.py`, `test_archive.py`.
- **Frontend admin:** `frontend/src/admin/api.ts` (entity names), `frontend/src/admin/editors/{Drinks,Classics,Spirits,Kitchen}Page.tsx`, new `frontend/src/admin/components/kit/{dictionary-field,archive-filter,multi-image-field}.tsx`.
- **Frontend guest:** `frontend/src/data/mapBundle.ts` + `frontend/src/pages/cocktail-guide/{data.ts,views.tsx,detail-sheet.tsx}`.

---

# PHASE A — Archive + dictionaries + «Горячий»

### Task A1: Phase-A schema (migration + models)

**Files:** Create `backend/alembic/versions/c3phaseA_drinks_a.py`; Modify `backend/app/models.py`.

**Interfaces — Produces:**
- `drinks.is_archived: bool` (NOT NULL default false), `classics.is_archived`, `spirit_entries.is_archived`, `kitchen_dishes.is_archived` — same column.
- New model `IceType(id, key:str UNIQUE, label:str, sort_order:int)` → table `ice_types` (mirror `Glass`).
- `drinks.ice_id: int | None` FK → `ice_types.id` `ON DELETE SET NULL`; `Drink.ice` relationship.
- `drinks.is_hot: bool` (NOT NULL default false).

- [ ] **Step 1 — models.py:** add `is_archived` to `Drink`, `Classic`, `SpiritEntry`, `KitchenDish` (`mapped_column(Boolean, default=False, nullable=False)`); add `class IceType(Base)` (copy `Glass`, `__tablename__="ice_types"`); add `ice_id` + `ice` relationship + `is_hot` to `Drink`.
- [ ] **Step 2 — migration** `upgrade()`:
```python
def upgrade() -> None:
    for t in ("drinks", "classics", "spirit_entries", "kitchen_dishes"):
        op.add_column(t, sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table("ice_types",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(32), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"))
    op.create_index("ix_ice_types_key", "ice_types", ["key"], unique=True)
    op.add_column("drinks", sa.Column("ice_id", sa.Integer, sa.ForeignKey("ice_types.id", ondelete="SET NULL"), nullable=True))
    op.add_column("drinks", sa.Column("is_hot", sa.Boolean(), nullable=False, server_default=sa.false()))
```
`downgrade()` drops them in reverse. `revision`/`down_revision='b2c3d4e5f6a7'`. `import sqlalchemy as sa`.
- [ ] **Step 3 — apply + verify:** `cd backend && alembic upgrade head` on the test DB; `alembic downgrade -1 && alembic upgrade head` to prove reversibility.
- [ ] **Step 4 — commit:** `feat(schema): phase-A drinks — is_archived, ice_types, drinks.ice_id/is_hot`.

*(No behavior test here — columns are exercised by A2/A4/A6. A1's gate: migration applies + reverses clean, models import.)*

### Task A2: Archive — backend

**Files:** Modify `backend/app/schemas_admin.py`, `backend/app/routers/admin.py`, `backend/app/routers/content.py`; Create `backend/tests/test_archive.py`.

**Interfaces — Consumes:** A1 `is_archived`. **Produces:** every `*WriteIn`/`*AdminOut` for drinks/classics/spirits/kitchen gains `is_archived: bool = False`; `/api/content` excludes archived.

- [ ] **Step 1 — failing test** `test_archive.py`:
```python
def test_archived_drink_hidden_from_content_but_visible_in_admin(editor_client):
    p = {"slug": "arch-x", "name": "Арх", "is_alcoholic": True, "is_zero_culture": False, "is_archived": True}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/arch-x").json()["is_archived"] is True
        bundle = editor_client.get("/api/content").json()
        assert all(d["id"] != "arch-x" for d in bundle["drinks"])   # hidden from guest
    finally:
        editor_client.delete("/api/admin/drinks/arch-x")
```
Add the equivalent for a classic, a spirit entry (post to `/api/admin/spirits` under an existing category), and a kitchen dish.
- [ ] **Step 2 — run, expect FAIL** (`is_archived` unknown field / still present in bundle).
- [ ] **Step 3 — implement:** add `is_archived: bool = False` to `DrinkWriteIn`, `ClassicWriteIn`, `SpiritEntryWriteIn`, `KitchenDishWriteIn` (and it flows to each `*AdminOut` via subclassing). In each `_apply_*` in `admin.py` set `obj.is_archived = data.is_archived`. In `content.py` add `.where(m.Drink.is_archived == sa.false())` (import), same for `Classic`, and filter spirit/kitchen entries in the comprehensions: `for e in sc.entries if not e.is_archived` / `for dish in kc.dishes if not dish.is_archived`. Counts in `content.py` (`counts` dict + `fam_counts`) must also exclude archived — add the same filter to those `select(func.count())` queries.
- [ ] **Step 4 — run, expect PASS.** Then full suite: `uv run pytest -q`.
- [ ] **Step 5 — commit:** `feat(admin,content): is_archived on items; content hides archived`.

### Task A3: Archive — frontend admin

**Files:** Create `frontend/src/admin/components/kit/archive-filter.tsx`; Modify `frontend/src/admin/editors/{Drinks,Classics,Spirits,Kitchen}Page.tsx` (+ their `.test.tsx` for the mappers).

**Interfaces — Consumes:** A2 `is_archived` on rows/bodies. **Produces:** an `ArchiveFilter` chip + a `useArchiveFilter(rows)` helper; each page threads `is_archived` through its `fromAdminOut`/`toWriteIn` and adds the toggle + filter.

- [ ] **Step 1 — helper + failing mapper test:** add `is_archived: boolean` to each page's `*Form`/`*WriteIn`/`*AdminOut` interfaces and mappers (`fromAdminOut` copies `row.is_archived ?? false`; `toWriteIn` passes `form.is_archived`). Extend each `*Page.test.tsx` full-body round-trip to assert `is_archived` threads through. Add a pure helper in `archive-filter.tsx`:
```ts
export type ArchiveView = "active" | "archived" | "all"
export function matchesArchiveView(isArchived: boolean, view: ArchiveView): boolean {
  return view === "all" ? true : view === "archived" ? isArchived : !isArchived
}
```
with its own test file (`archive-filter.test.ts`, 3 cases).
- [ ] **Step 2 — run FE tests, expect the new mapper asserts to FAIL** until mappers updated; then implement mappers → PASS.
- [ ] **Step 3 — UI:** in each of the 4 pages: (a) `ArchiveFilter` = a `ChipMenu` (reuse `components/kit/chip-menu`) bound to an `archiveView` state (default `"active"`), placed in the `filters` slot; filter `filteredRows` through `matchesArchiveView(row.is_archived, archiveView)`; (b) a muted «архив» pill in the identity/columns render when `row.is_archived`; (c) form: a `CheckboxField` «В архиве» (kit form); (d) a ⋯ action «В архив»/«Вернуть» that PATCHes `{...toWriteIn(form-from-row), is_archived: !row.is_archived}` — simplest: reload the row via `adminApi.update(entity, key, {...fullBody, is_archived: !current})`. Keep the existing arcade-delete action.
- [ ] **Step 4 — gate:** `npm run build && npm run test && npm run lint`.
- [ ] **Step 5 — commit:** `feat(admin): archive filter + toggle on all item pages`.

### Task A4: Dictionaries — backend (glasses / badges / ice-types + drink.ice)

**Files:** Modify `backend/app/schemas_admin.py`, `backend/app/schemas.py`, `backend/app/routers/admin.py`, `backend/app/routers/content.py`; Create `backend/tests/test_admin_dictionaries.py`.

**Interfaces — Consumes:** A1 `ice_types`, `drinks.ice_id`. **Produces:** admin CRUD `/api/admin/{glasses,badges,ice-types}` (`LookupWriteIn{key?:str, label:str, sort_order:int=0}` → `LookupAdminOut{id,key,label,sort_order}`); `DrinkWriteIn.ice: str | None` (ice-type key), `DrinkAdminOut.ice`; `DrinkOut.ice: str | None` (label) for the guest.

- [ ] **Step 1 — failing tests** `test_admin_dictionaries.py`:
```python
def test_ice_dictionary_crud_and_drink_uses_it(editor_client):
    assert editor_client.post("/api/admin/ice-types", json={"label": "Большой куб"}).status_code == 201
    ice = next(i for i in editor_client.get("/api/admin/ice-types").json() if i["label"] == "Большой куб")
    assert ice["key"]  # server-derived, non-empty
    try:
        p = {"slug": "ice-drink", "name": "Айс", "is_alcoholic": True, "is_zero_culture": False, "ice": ice["key"]}
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/ice-drink").json()["ice"] == ice["key"]
        d = next(x for x in editor_client.get("/api/content").json()["drinks"] if x["id"] == "ice-drink")
        assert d["ice"] == "Большой куб"          # guest sees the label
    finally:
        editor_client.delete("/api/admin/drinks/ice-drink")

def test_delete_ice_type_in_use_conflicts(editor_client):
    ...  # create ice-type, create drink using it, DELETE ice-type -> 409, cleanup

def test_dictionaries_require_editor(reader_client):
    for e in ("glasses", "badges", "ice-types"):
        assert reader_client.get(f"/api/admin/{e}").status_code == 403
```
- [ ] **Step 2 — run, expect FAIL** (routes 404 / `ice` unknown).
- [ ] **Step 3 — implement:**
  - `schemas_admin.py`: `LookupWriteIn{key: str | None = None; label: str; sort_order: int = 0}`, `LookupAdminOut(LookupWriteIn){id:int; key:str}`. Add `ice: str | None = None` to `DrinkWriteIn`.
  - `schemas.py`: add `ice: str | None = None` to `DrinkOut`.
  - `admin.py`: a generic lookup CRUD factory over `(m.Glass, "glasses")`, `(m.Badge, "badges")`, `(m.IceType, "ice-types")` — GET list/one, POST (derive `key` from `label` via a slugify if `key` omitted; 409 on dup key), PATCH, DELETE (409 if any `drinks.glass_id/badge_id/ice_id` references it). Reuse the existing slug helper if present, else add `_slugify(label)->str` (lowercase, latin transliterate or fallback to a short hash). Thread `ice` in `_apply_drink` (`obj.ice_id = _get_ice(db, data.ice)` — get by key, 400 if unknown) and in `_to_admin_out` (`ice=obj.ice.key if obj.ice else None`).
  - `content.py`: `_serialize_drink` → `ice=d.ice.label if d.ice else None`; add `selectinload(m.Drink.ice)` to the drinks query.
- [ ] **Step 4 — run, expect PASS** + full suite.
- [ ] **Step 5 — commit:** `feat(admin): glass/badge/ice dictionaries + drink.ice`.

### Task A5: Dictionaries — frontend admin (DictionaryField + panel)

**Files:** Create `frontend/src/admin/components/kit/dictionary-field.tsx`; Modify `frontend/src/admin/api.ts` (add entities `"glasses" | "badges" | "ice-types"`), `frontend/src/admin/editors/DrinksPage.tsx` (+ test).

**Interfaces — Consumes:** A4 CRUD + `DrinkWriteIn.ice`. **Produces:** `DictionaryField` (select of `{key,label}` + inline «＋ добавить»), a `DictionariesPanel` (collapsible manager, mirror the kitchen category subpanel).

- [ ] **Step 1 — `DictionaryField`:**
```tsx
// select of existing options + an inline "add" row: type a label -> POST to the
// dictionary entity -> onCreated(newKey) selects it. No raw key ever shown.
export function DictionaryField({ label, value, options, onChange, onQuickAdd, placeholder }: {
  label: string; value: string; options: {key:string;label:string}[];
  onChange:(key:string)=>void; onQuickAdd:(label:string)=>Promise<string>; placeholder?:string
}) { /* SelectField + a small Input + Button "＋"; on add: key = await onQuickAdd(text); onChange(key) */ }
```
Use kit `SelectField` (map options to `{value:key,label}`), plus a compact add-row. Keep it pure-ish; the async `onQuickAdd` is provided by DrinksPage.
- [ ] **Step 2 — DrinksPage wiring:** load glasses/badges/ice-types (`adminApi.list("glasses")` …) into state; replace the three raw-key `TextField`s (Стакан/Бейдж) + add Лёд with `DictionaryField`; `onQuickAdd(label)` = `await adminApi.create(entity,{label})` then reload that dict, return the new key. Add `ice` to `DrinkForm`/mappers (thread through `fromAdminOut`/`toWriteIn`); extend `DrinksPage.test.tsx` to assert `ice` threads through.
- [ ] **Step 3 — DictionariesPanel:** a collapsible «Справочники» panel above/near the drinks table (copy `SpiritCategoriesPanel` shape) with three mini-managers (Стаканы/Бейджи/Лёд): EntityTable + §50 form (label + sort_order; key shown read-only/derived) + fire-delete (surfaces 409 as a toast). Reloads the dicts on change.
- [ ] **Step 4 — gate** (build/test/lint).
- [ ] **Step 5 — commit:** `feat(admin): dictionary fields + Справочники panel (glass/badge/ice)`.

### Task A6: `is_hot` — backend + backfill

**Files:** Modify `backend/app/schemas_admin.py`, `backend/app/schemas.py`, `backend/app/routers/admin.py`, `backend/app/routers/content.py`; extend the A1 migration OR add a small data migration `c3phaseA2_backfill_hot.py`; Modify `backend/tests/test_admin_drinks.py`.

**Interfaces — Consumes:** A1 `drinks.is_hot`. **Produces:** `DrinkWriteIn.is_hot: bool = False`, `DrinkAdminOut.is_hot`, `DrinkOut.isHot: bool`.

- [ ] **Step 1 — failing test** (append to `test_admin_drinks.py`):
```python
def test_is_hot_roundtrips_and_reaches_guest(editor_client):
    p = {"slug":"hot-x","name":"Горячий","is_alcoholic":True,"is_zero_culture":False,"is_hot":True}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/hot-x").json()["is_hot"] is True
        d = next(x for x in editor_client.get("/api/content").json()["drinks"] if x["id"]=="hot-x")
        assert d["isHot"] is True and d.get("badge") in (None,)  # hot is its own flag, not a badge
    finally:
        editor_client.delete("/api/admin/drinks/hot-x")
```
- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement:** `DrinkWriteIn.is_hot: bool = False`; `_apply_drink` sets `obj.is_hot`; `_to_admin_out` returns it; `DrinkOut.isHot`; `content.py` `_serialize_drink` → `isHot=d.is_hot`. **Backfill migration** (new revision after A1): `UPDATE drinks SET is_hot=true WHERE badge_id IN (SELECT id FROM badges WHERE upper(key)='HOT'); UPDATE drinks SET badge_id=NULL WHERE badge_id IN (SELECT id FROM badges WHERE upper(key)='HOT'); DELETE FROM badges WHERE upper(key)='HOT';` (guard each with existence; `downgrade()` is a no-op documented as irreversible-data). Apply to test DB.
- [ ] **Step 4 — run, expect PASS** + full suite.
- [ ] **Step 5 — commit:** `feat(admin,content): drinks.is_hot + backfill from HOT badge`.

### Task A7: `is_hot` + `ice` — guest frontend

**Files:** Modify `frontend/src/data/mapBundle.ts`, `frontend/src/pages/cocktail-guide/{data.ts,views.tsx,detail-sheet.tsx}` (+ mapBundle test if present).

**Interfaces — Consumes:** A4 `DrinkOut.ice`, A6 `DrinkOut.isHot`. **Produces:** guest drink type gains `isHot: boolean`, `ice?: string`.

- [ ] **Step 1 — data types:** add `isHot?: boolean` and `ice?: string` to the guide drink type in `data.ts`; map them in `mapBundle.ts` from `isHot`/`ice`. Extend `mapBundle.test.ts` to assert both map through.
- [ ] **Step 2 — is_hot chip:** in `views.tsx` + `detail-sheet.tsx`, replace `c.badge === "HOT"` with `c.isHot` (drive the existing red HOT chip next to the name off `isHot`); the `badge` prop keeps rendering non-HOT badges.
- [ ] **Step 3 — ice in detail:** in `detail-sheet.tsx` drink section, add «Лёд: {c.ice}» in the left meta area (next to glass/volume), rendered only when `c.ice`.
- [ ] **Step 4 — gate** (build/test/lint).
- [ ] **Step 5 — commit:** `feat(guide): is_hot chip + ice in drink detail`.

---

# PHASE B — Categories for Авторские

### Task B1: drink_categories schema + seed/backfill

**Files:** Create `backend/alembic/versions/c4phaseB_drink_categories.py`; Modify `backend/app/models.py`.

**Interfaces — Produces:** `DrinkCategory(id, slug UNIQUE, label, sort_order)` → `drink_categories` (mirror `KitchenCategory`); `drinks.category_id` FK `RESTRICT` NOT NULL; `Drink.category` relationship; `DrinkCategory.drinks` back_populates.

- [ ] **Step 1 — models.py:** add `class DrinkCategory` (copy `KitchenCategory`, `__tablename__="drink_categories"`, `drinks` relationship `order_by="Drink.sort_order, Drink.name"`); add `category_id` + `category` to `Drink`.
- [ ] **Step 2 — migration:**
```python
def upgrade():
    op.create_table("drink_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"))
    op.create_index("ix_drink_categories_slug", "drink_categories", ["slug"], unique=True)
    op.execute("INSERT INTO drink_categories (slug,label,sort_order) VALUES ('osnovnye','Основные',0)")
    op.add_column("drinks", sa.Column("category_id", sa.Integer, sa.ForeignKey("drink_categories.id", ondelete="RESTRICT"), nullable=True))
    op.execute("UPDATE drinks SET category_id=(SELECT id FROM drink_categories WHERE slug='osnovnye')")
    op.alter_column("drinks", "category_id", nullable=False)
```
`downgrade()` reverses.
- [ ] **Step 3 — apply + reverse** on test DB.
- [ ] **Step 4 — commit:** `feat(schema): drink_categories + drinks.category_id (default Основные)`.

### Task B2: categories — backend (CRUD + drink.category + content grouping)

**Files:** Modify `backend/app/schemas_admin.py`, `backend/app/schemas.py`, `backend/app/routers/admin.py`, `backend/app/routers/content.py`; Create `backend/tests/test_admin_drink_categories.py`.

**Interfaces — Consumes:** B1. **Produces:** `/api/admin/drink-categories` CRUD (mirror kitchen-categories exactly); `DrinkWriteIn.category: str` (drink-category slug, must exist), `DrinkAdminOut.category`; bundle gains `drinkCategories: [{slug,label}]` and `DrinkOut.categorySlug: str`.

- [ ] **Step 1 — failing test:**
```python
def test_drink_category_crud_and_grouping(editor_client):
    assert editor_client.post("/api/admin/drink-categories", json={"slug":"signature","label":"Сигнатурные"}).status_code == 201
    p = {"slug":"cat-drink","name":"Кэт","is_alcoholic":True,"is_zero_culture":False,"category":"signature"}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        b = editor_client.get("/api/content").json()
        assert any(c["slug"]=="signature" for c in b["drinkCategories"])
        assert next(d for d in b["drinks"] if d["id"]=="cat-drink")["categorySlug"] == "signature"
    finally:
        editor_client.delete("/api/admin/drinks/cat-drink")
        editor_client.delete("/api/admin/drink-categories/signature")

def test_delete_nonempty_drink_category_conflicts(editor_client): ...   # category with a drink -> 409
def test_create_drink_unknown_category_400(editor_client): ...          # category slug that doesn't exist
```
- [ ] **Step 2 — run FAIL.**
- [ ] **Step 3 — implement:** copy the kitchen-category CRUD block in `admin.py` for `drink-categories` (`_apply_drink_category`, `_to_drink_category_admin_out`, list/get/post/patch/delete with 409-on-nonempty). `DrinkCategoryWriteIn/AdminOut` in `schemas_admin.py` (mirror `KitchenCategoryWriteIn`). `DrinkWriteIn.category: str`; `_apply_drink` sets `obj.category_id = _get_drink_category(db, data.category)` (404/400 if missing); `_to_admin_out` returns `category=obj.category.slug`. `content.py`: load `drink_categories` ordered; add `drinkCategories=[{slug,label}]` to the bundle and `categorySlug=d.category.slug` to `_serialize_drink` (add `selectinload(m.Drink.category)`). `ContentBundleOut` + `DrinkOut` schema updated. Keep the flat `drinks` list (frontend groups by `categorySlug`).
- [ ] **Step 4 — run PASS** + full suite.
- [ ] **Step 5 — commit:** `feat(admin,content): drink-categories CRUD + grouping`.

### Task B3: categories — frontend admin

**Files:** Modify `frontend/src/admin/api.ts` (add `"drink-categories"`), `frontend/src/admin/editors/DrinksPage.tsx` (+ test).

**Interfaces — Consumes:** B2. **Produces:** category select + subpanel in DrinksPage.

- [ ] **Step 1:** add `category: string` to `DrinkForm`/mappers (thread through; test asserts it). Load drink-categories; add a `SelectField` «Категория» (required; gate Save on empty like ClassicsPage's family) + a `DrinkCategoriesPanel` inline (copy `KitchenCategoriesPanel`) + a category filter chip in the toolbar.
- [ ] **Step 2 — gate.**
- [ ] **Step 3 — commit:** `feat(admin): drink category select + subpanel`.

### Task B4: categories — guest frontend (sections)

**Files:** Modify `frontend/src/data/mapBundle.ts`, `frontend/src/pages/cocktail-guide/{data.ts,views.tsx}`.

**Interfaces — Consumes:** B2 `drinkCategories` + `categorySlug`. **Produces:** the Авторские view renders category sections.

- [ ] **Step 1 — data:** map `drinkCategories` + each drink's `categorySlug` in `mapBundle.ts`/`data.ts` (mirror how kitchen categories/dishes are mapped). Test the mapping.
- [ ] **Step 2 — view:** in `views.tsx`, render the Авторские list grouped into **sections by drink category** (mirror the Kitchen view's category sections), sorted by category `sort_order`; the Алко/Безалко filter + Спирит/Бокал/Тип dropdowns apply within; hide empty sections.
- [ ] **Step 3 — gate.**
- [ ] **Step 4 — commit:** `feat(guide): Авторские grouped into category sections`.

---

# PHASE C — Photos (aspect + multiple + gallery)

### Task C1: drink_photos schema + backfill

**Files:** Create `backend/alembic/versions/c5phaseC_drink_photos.py`; Modify `backend/app/models.py`.

**Interfaces — Produces:** `DrinkPhoto(id, drink_id FK CASCADE, url:str, sort_order:int)` → `drink_photos`; `Drink.photos` relationship ordered by `sort_order`.

- [ ] **Step 1 — models.py:** `class DrinkPhoto(Base)` (drink_id PK-part or own id + FK cascade, `url String(256)`, `sort_order`); `Drink.photos = relationship(order_by="DrinkPhoto.sort_order", cascade="all, delete-orphan")`.
- [ ] **Step 2 — migration:** create table + index on `drink_id`; backfill `INSERT INTO drink_photos (drink_id,url,sort_order) SELECT id, photo, 0 FROM drinks WHERE photo IS NOT NULL AND photo <> ''`. Leave `drinks.photo` column in place (unused by writes). `downgrade()` drops the table.
- [ ] **Step 3 — apply + reverse.**
- [ ] **Step 4 — commit:** `feat(schema): drink_photos (+ backfill from drinks.photo)`.

### Task C2: photos — backend

**Files:** Modify `backend/app/schemas_admin.py`, `backend/app/schemas.py`, `backend/app/routers/admin.py`, `backend/app/routers/content.py`; Modify `backend/tests/test_admin_drinks.py`.

**Interfaces — Consumes:** C1. **Produces:** `DrinkWriteIn.photos: list[str] = []` (ordered urls, replaces scalar `photo` on write), `DrinkAdminOut.photos`, `DrinkOut.photos: list[str]` (+ keep `photo` = `photos[0]` for card back-compat).

- [ ] **Step 1 — failing test:**
```python
def test_drink_photos_roundtrip_and_primary(editor_client):
    p = {"slug":"pic-x","name":"Пик","is_alcoholic":True,"is_zero_culture":False,
         "photos":["/static/img/a.webp","/static/img/b.webp"]}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/pic-x").json()["photos"] == p["photos"]
        d = next(x for x in editor_client.get("/api/content").json()["drinks"] if x["id"]=="pic-x")
        assert d["photos"] == p["photos"] and d["photo"] == "/static/img/a.webp"
    finally:
        editor_client.delete("/api/admin/drinks/pic-x")
```
- [ ] **Step 2 — run FAIL.**
- [ ] **Step 3 — implement:** `DrinkWriteIn.photos: list[str] = []`; `_apply_drink` delete-then-insert `DrinkPhoto` rows in order (same pattern as `DrinkDetail`); `_to_admin_out` returns `photos=[p.url for p in obj.photos]`. `DrinkOut.photos` + keep `photo=obj.photos[0].url if obj.photos else None`; add `selectinload(m.Drink.photos)`. Remove `photo` from `DrinkWriteIn` (writes now go through `photos`).
- [ ] **Step 4 — run PASS** + full suite.
- [ ] **Step 5 — commit:** `feat(admin,content): drink multi-photos (photos[])`.

### Task C3: photos — frontend admin (multi-upload)

**Files:** Create `frontend/src/admin/components/kit/multi-image-field.tsx`; Modify `frontend/src/admin/editors/DrinksPage.tsx` (+ test).

**Interfaces — Consumes:** C2 `photos`. **Produces:** `MultiImageField({value:string[], onChange})` — upload several, reorder, remove.

- [ ] **Step 1 — MultiImageField:** reuse `adminApi.uploadImage` per file (multiple input), render thumbnails with remove + up/down reorder; `onChange(urls)`.
- [ ] **Step 2 — DrinksPage:** replace the single `photo` `ImageField` with `MultiImageField` bound to `form.photos`; drop scalar `photo` from `DrinkForm`/mappers, add `photos: string[]`; test asserts `photos` threads through. Keep the `img` (logo) single `ImageField`.
- [ ] **Step 3 — gate.**
- [ ] **Step 4 — commit:** `feat(admin): drink multi-image upload`.

### Task C4: photos — guest gallery + aspect

**Files:** Modify `frontend/src/data/mapBundle.ts`, `frontend/src/pages/cocktail-guide/{data.ts,detail-sheet.tsx,views.tsx}`.

**Interfaces — Consumes:** C2 `photos`. **Produces:** guide drink type gains `photos: string[]`; card uses `photos[0]`; detail shows a carousel.

- [ ] **Step 1 — data:** add `photos?: string[]` to the guide drink type; map from `photos` (fallback `[photo]` if empty). Card thumbnail uses `photos[0] ?? logo`. Test the mapping.
- [ ] **Step 2 — gallery:** in `detail-sheet.tsx`, replace the single drink `Photo` with a **carousel** over `photos` (horizontal snap-scroll + dot indicators; kit-styled, no new dep — a simple `overflow-x-auto snap-x` track). Frame: `aspect-[3/4]` + `object-contain` on a neutral bg (verticals fill, horizontals letterbox). Single photo → no dots.
- [ ] **Step 3 — gate.** Owner eyeballs on real photos and we tune the exact ratio if needed (follow-up commit).
- [ ] **Step 4 — commit:** `feat(guide): drink photo gallery (carousel, portrait-safe)`.

---

## Rollout & ordering

Sequential within the hard dependency chain: **A1→A2/A4/A6 (backend, share `admin.py`/`content.py` → sequential) → A3/A5/A7 (frontend) ; B1→B2→B3→B4 ; C1→C2→C3→C4.** Frontend tasks that touch different files than a concurrent backend task may run in parallel, but A3/A5/A7 all touch `DrinksPage`/guide files → keep sequential. Deploy phase-by-phase to `v2` (build/test/lint → owner-approved push → Railway → live verify). Each phase is independently shippable.

## Self-review notes

- **Spec coverage:** #1 categories → B1-B4; #2 is_hot → A6/A7; #3 ice → A1/A4/A5/A7; #4 glass/badge dictionaries + key explanation → A4/A5; #5 photo aspect → C4; #6 multi-photo → C1-C4; #7 archive → A1/A2/A3. All covered.
- **Type consistency:** `is_archived: bool` (backend) ↔ `is_archived: boolean` (front) everywhere; `ice` = key on write / label on guest; `photos: string[]` write+guest; `category`/`categorySlug` = drink-category slug; dictionary CRUD entity names `glasses|badges|ice-types|drink-categories` identical in `admin.py` routes and `frontend/src/admin/api.ts`.
