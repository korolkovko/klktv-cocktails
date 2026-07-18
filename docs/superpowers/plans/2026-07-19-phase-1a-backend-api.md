# Phase 1a — Backend API on v2 schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the `klktv-cocktails` backend so the consumer API (auth + `/api/content` bundle + progress) serves the already-migrated v2 schema, shaped to feed the Kollektiv `block-cocktail-guide` kit, and apply the operational/security cleanups the audit flagged.

**Architecture:** Keep FastAPI + SQLAlchemy 2.0. Alembic owns the schema (drop all `create_all`/ad-hoc DDL). `/api/content` is a user-agnostic catalog bundle; per-user "learned" state lives only in `/api/me/progress`. Admin/editor CRUD + uploads write-path are Phase 2 — disabled, not rewritten.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, `uv`, pytest + FastAPI TestClient. Postgres 15 (Railway).

**Reference:** [phase-1a-backend-blueprint.md](phase-1a-backend-blueprint.md) — exact field→column maps, gaps, and rationale. This plan is authoritative for code; the blueprint for context.

## Global Constraints

- The running app targets the **migrated v2 DB** via `DATABASE_URL` (the new Railway DB). Schema managed **only** by Alembic — no `create_all`, no ad-hoc `ALTER`.
- `SECRET_KEY` and `DATABASE_URL` are **required**; the app must fail fast at startup if either is unset (audit C-2).
- `/api/content` is **catalog-only**: no per-item `learned` field, no per-user data. `Section.total` = true catalog count; `learned` counts are **not** sent (frontend intersects with progress slugs).
- Progress `kind` is **exactly** one of `menu | classics | spirits | kitchen`. Persisted identity for `spirits` is `spirit_entries.slug` (not the kit's `category:name` composite — that translation is a frontend adapter concern, Phase 1b).
- **JSON keys must match the kit's `data.ts` exactly** (camelCase where the kit uses it): drink `logo`(=img)/`subtitle`/`price`/`volume`/`abv`/`spirit`/`spirits`/`descriptors`/`badge`/`recipe`/`garnish`/`pitch`/`photo`/`about`/`naming`/`faq`; classic `city`(=origin)/`recipe`(=composition)/`fits`(=for_whom)/`ourAnswers`; family `tint`(=key)/`code`(=key.upper)/`title`(=label); spirit `pairings`(=cocktail_pairings)/`sourceUrl`(=source_url)/`brandDetail`(=description); dish `subtitle`(=tagline)/`photo`(=img)/`fact`(=interesting_facts). Getting a key wrong silently breaks a UI section (audit item 18 was exactly this).
- Numerics serialize as JSON numbers: `price`/`volume`/`weight`/`timing`/nutrition as rounded ints, `abv` as float. `Decimal` → `float`/`int`, never a quoted string.
- Admin (`admin`, `admin_users`, `uploads`) routers are **not included**; the read-only `/static/img` mount stays.
- Every task ends green: `cd backend && set -a; source .env.migration; set +a; uv run pytest -q`. DB creds come from the gitignored `backend/.env.migration` (`DATABASE_URL` for the app = the DEST/migrated DB; set `DATABASE_URL=$DEST_DATABASE_URL` when running the app/tests).

---

## Task 1: Config & secrets hardening (fail-fast)

**Files:** Modify `backend/app/config.py`; Test `backend/tests/test_config.py`

**Interfaces:**
- Produces: `SECRET_KEY: str` (required), `DATABASE_URL: str` (required), `DEBUG: bool`, `require_env(name)` helper. Importing `app.config` with either required var unset raises `RuntimeError` with a clear message.

- [ ] **Step 1: Failing test**

Create `backend/tests/test_config.py`:
```python
import importlib
import pytest


def test_missing_secret_key_fails_fast(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://x/y")
    import app.config as c
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        importlib.reload(c)


def test_missing_database_url_fails_fast(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import app.config as c
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        importlib.reload(c)
```

- [ ] **Step 2: Run → fail** — `uv run pytest tests/test_config.py -q` (fails: today defaults are returned, no raise).

- [ ] **Step 3: Implement** — in `backend/app/config.py` replace the `SECRET_KEY`/`DATABASE_URL` default-bearing lines with:
```python
def require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"{name} is required and must be set (no default in v2).")
    return val

SECRET_KEY = require_env("SECRET_KEY")
DATABASE_URL = require_env("DATABASE_URL")
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
```
Leave the cookie/token constants as-is. (Move `SRC_DATABASE_URL`/`DEST_DATABASE_URL` getters, if present, to be plain `os.environ.get` — they're ETL-only and must not be required by the API.)

- [ ] **Step 4: Run → pass**, then run the whole suite (`uv run pytest -q`) with `SECRET_KEY`/`DATABASE_URL` set via `.env.migration` (`DATABASE_URL=$DEST_DATABASE_URL`).

- [ ] **Step 5: Commit** — `git add app/config.py tests/test_config.py && git commit -m "feat(backend): require SECRET_KEY/DATABASE_URL, fail-fast (audit C-2)"`

---

## Task 2: Database bootstrap cleanup + DB-checked /health

**Files:** Modify `backend/app/database.py`, `backend/app/main.py`; Test `backend/tests/test_health.py`

**Interfaces:**
- Removes `init_db`, `_COLUMN_MIGRATIONS`, `_DATA_MIGRATIONS`, `create_all`. Produces `GET /health` → 200 `{"status":"ok"}` when `SELECT 1` succeeds, 503 otherwise.

- [ ] **Step 1:** In `backend/app/database.py`, delete `_COLUMN_MIGRATIONS`, `_DATA_MIGRATIONS`, and the whole `init_db()` function (incl. its `Base.metadata.create_all` call and the swallowing try/except). Keep `Base`, `engine`, `SessionLocal`, `get_db`.

- [ ] **Step 2:** In `backend/app/main.py`: remove the `init_db` import and its call in `lifespan` (keep the `UPLOAD_DIR.mkdir` and the `/static/img` mount). Remove `admin, admin_users, uploads` from the `from app.routers import ...` line and their `include_router` calls. Gate docs: `FastAPI(title="KLKTV Cocktails API", docs_url="/api/docs" if DEBUG else None, redoc_url=None if not DEBUG else "/api/redoc", openapi_url="/api/openapi.json" if DEBUG else None, lifespan=lifespan)` (import `DEBUG` from `app.config`).

- [ ] **Step 3:** Replace the `/health` handler:
```python
from sqlalchemy import text
from fastapi import Response
from app.database import SessionLocal

@app.get("/health")
def health(response: Response):
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        response.status_code = 503
        return {"status": "db_unreachable"}
```

- [ ] **Step 4: Test** — `backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from app.main import app


def test_health_ok():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
```

- [ ] **Step 5:** Run `uv run pytest tests/test_health.py -q` (needs a reachable DB via env). Confirm the app imports with admin routers gone (no ImportError).

- [ ] **Step 6: Commit** — `git commit -m "feat(backend): Alembic-only schema, drop init_db/create_all, DB-checked /health, disable admin routers (Phase 2)"`

---

## Task 3: Auth hardening (logout cookie, 401-not-500, drop role claim, login rate-limit)

**Files:** Modify `backend/app/auth.py`, `backend/app/routers/auth.py`; Test `backend/tests/test_auth.py`

**Interfaces:**
- `create_access_token(user_id: int) -> str` (role claim dropped). `clear_auth_cookie` passes `secure`/`samesite`. `get_current_user` returns 401 (not 500) on a malformed token. `POST /api/auth/login` is rate-limited per client IP.

- [ ] **Step 1:** In `backend/app/auth.py`: (a) `create_access_token(user_id: int)` — drop the `"role"` claim from the payload; (b) `clear_auth_cookie` — add `secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE` to the `delete_cookie` call (match `set_auth_cookie`); (c) in `get_current_user`, wrap the sub parse: 
```python
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user = db.get(User, user_id)
```

- [ ] **Step 2:** In `backend/app/routers/auth.py`, update the call site `create_access_token(user.id, user.role)` → `create_access_token(user.id)`.

- [ ] **Step 3: Login rate-limit.** Add a tiny in-process fixed-window limiter (no new dependency) in `backend/app/routers/auth.py`:
```python
import time
from collections import defaultdict
from fastapi import Request

_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_WINDOW_S = 60
_MAX_ATTEMPTS = 5

def _rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [t for t in _ATTEMPTS[ip] if now - t < _WINDOW_S]
    if len(hits) >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts, try again later")
    hits.append(now)
    _ATTEMPTS[ip] = hits
```
Call `_rate_limit(request)` at the top of the `login` handler (add `request: Request` to its signature). (Note in the report: single-process only; a multi-replica deploy needs a shared store — acceptable for this small app, flagged for later.)

- [ ] **Step 4: Tests** — `backend/tests/test_auth.py`:
```python
from fastapi.testclient import TestClient
from app.main import app


def test_malformed_token_is_401_not_500():
    with TestClient(app) as client:
        client.cookies.set("klktv_session", "not.a.jwt")
        r = client.get("/api/auth/me")
        assert r.status_code == 401


def test_login_rate_limited_after_5():
    with TestClient(app) as client:
        codes = [client.post("/api/auth/login", json={"username": "nope", "password": "x"}).status_code
                 for _ in range(6)]
        assert codes[-1] == 429
```
(Cookie name: confirm `COOKIE_NAME` value in config; adjust the literal if it differs.)

- [ ] **Step 5:** Run `uv run pytest tests/test_auth.py -q` → pass. Manually confirm a real login still sets the cookie and `/api/auth/me` returns the user.

- [ ] **Step 6: Commit** — `git commit -m "feat(backend): auth hardening — logout cookie attrs, 401 on bad token, drop dead role claim, login rate-limit"`

---

## Task 4: seed.py reduced to one-shot admin bootstrap (no boot seeding, no plaintext roster)

**Files:** Rewrite `backend/seed.py`; Modify `backend/Dockerfile`; Test `backend/tests/test_seed.py`

**Interfaces:**
- `seed.py` `main()`: if the `users` table is non-empty → no-op. If empty AND `SEED_ADMIN_USERNAME`+`SEED_ADMIN_PASSWORD` env set → create exactly one admin. No hardcoded users, no content seeding, not on the boot path.

- [ ] **Step 1: Rewrite `backend/seed.py`** entirely to:
```python
"""One-shot admin bootstrap. NOT run on boot. v2 content+users come from the ETL
(backend/migration). Only bootstraps an admin when the users table is empty."""
import os
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password


def bootstrap_admin() -> str:
    with SessionLocal() as db:
        if db.query(User).first() is not None:
            return "users table not empty — skip (v2 users migrated from prod)"
        username = os.environ.get("SEED_ADMIN_USERNAME")
        password = os.environ.get("SEED_ADMIN_PASSWORD")
        if not (username and password):
            return "empty users table but SEED_ADMIN_USERNAME/PASSWORD not set — skip"
        db.add(User(username=username.strip().lower(),
                    password_hash=hash_password(password), role="admin", name="Admin"))
        db.commit()
        return f"bootstrapped admin '{username}'"


if __name__ == "__main__":
    print(bootstrap_admin())
```
Delete all the old seeding machinery (USERS roster, DEFAULT_CATEGORIES, seed_users/seed_categories/seed_kitchen/seed_encyclopedia/seed_content/_cleanup_legacy_urls, data-path constants).

- [ ] **Step 2:** In `backend/Dockerfile`, change the final `CMD` from `python seed.py && exec uvicorn ...` to run migrations instead of seeding:
`CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]`

- [ ] **Step 3: Test** — `backend/tests/test_seed.py`:
```python
from app.database import SessionLocal
from app.models import User
from seed import bootstrap_admin


def test_bootstrap_is_noop_when_users_exist():
    # the migrated DB already has users
    assert SessionLocal().query(User).first() is not None
    before = SessionLocal().query(User).count()
    msg = bootstrap_admin()
    after = SessionLocal().query(User).count()
    assert after == before
    assert "skip" in msg
```

- [ ] **Step 4:** Run `uv run pytest tests/test_seed.py -q` → pass (bootstrap is a no-op against the populated DB). **Report to the user (operational, not code):** the old plaintext passwords in git history must be rotated + purged — this task removes them from HEAD but not from history.

- [ ] **Step 5: Commit** — `git commit -m "feat(backend): seed = one-shot admin bootstrap only; drop plaintext roster + boot seeding (audit C-1/HIGH-1)"`

---

## Task 5: Pydantic v2 output schemas for the bundle

**Files:** Rewrite `backend/app/schemas.py` (output models); Test `backend/tests/test_schemas.py`

**Interfaces:**
- Produces: `DrinkOut, ClassicOut, FamilyOut, SpiritEntryOut, SpiritCategoryOut, KitchenDishOut, KitchenCategoryOut, SectionOut, FiltersOut, ContentBundleOut, UserResponse`. All `model_config = ConfigDict(from_attributes=False)` (we build dicts explicitly in Task 6). Field names EXACTLY per Global Constraints.

- [ ] **Step 1: Write the output schemas** in `backend/app/schemas.py` (keep any auth/request schemas like `LoginRequest`, `UserResponse` that other routers import; replace all content/output models):
```python
from pydantic import BaseModel


class DrinkOut(BaseModel):
    id: str
    name: str
    logo: str | None = None
    subtitle: str | None = None
    price: int | None = None
    volume: int | None = None
    abv: float | None = None
    spirit: str = ""
    spirits: list[str] = []
    glass: str = ""
    descriptors: list[str] = []
    badge: str | None = None
    recipe: str | None = None
    garnish: str | None = None
    pitch: str | None = None
    photo: str | None = None
    about: str | None = None
    naming: str | None = None
    faq: str | None = None
    # forward-compat (kit type doesn't read these yet; Phase 1b kit extension will)
    isAlcoholic: bool = True
    isZeroCulture: bool = False
    caffeineLevel: int | None = None
    isCarbonated: bool | None = None


class OurAnswer(BaseModel):
    label: str
    menuId: str | None = None


class ClassicOut(BaseModel):
    id: str
    name: str
    year: str | None = None
    city: str | None = None
    family: str
    spirit: str = ""
    glass: str = ""
    descriptors: list[str] = []
    recipe: str | None = None
    garnish: str | None = None
    history: str | None = None
    fits: str | None = None
    ourAnswers: list[OurAnswer] = []


class FamilyOut(BaseModel):
    tint: str
    code: str
    title: str
    logic: str | None = None
    evolution: str | None = None
    tip: str | None = None
    total: int = 0


class SpiritEntryOut(BaseModel):
    slug: str
    categorySlug: str
    name: str
    img: str | None = None
    abv: float | None = None
    country: str | None = None
    flavour: str | None = None
    brand: str | None = None
    brandDetail: str | None = None
    features: str | None = None
    pairings: str | None = None
    fact: str | None = None
    sourceUrl: str | None = None


class SpiritCategoryOut(BaseModel):
    slug: str
    label: str
    isArchived: bool = False


class DishNutritionOut(BaseModel):
    kcal: int | None = None
    protein: float | None = None
    fat: float | None = None
    carb: float | None = None


class KitchenDishOut(BaseModel):
    id: str
    categorySlug: str
    name: str
    subtitle: str | None = None
    price: int | None = None
    weight: int | None = None
    timing: int | None = None
    photo: str | None = None
    description: str | None = None
    serving: str | None = None
    fact: str | None = None
    nutrition: DishNutritionOut = DishNutritionOut()


class KitchenCategoryOut(BaseModel):
    slug: str
    label: str


class SectionOut(BaseModel):
    id: str
    label: str
    total: int


class FiltersOut(BaseModel):
    spirits: list[str]
    glasses: list[str]
    classicSpirits: list[str]


class ContentBundleOut(BaseModel):
    sections: list[SectionOut]
    drinks: list[DrinkOut]
    classics: list[ClassicOut]
    families: list[FamilyOut]
    spiritCategories: list[SpiritCategoryOut]
    spirits: list[SpiritEntryOut]
    kitchenCategories: list[KitchenCategoryOut]
    kitchen: list[KitchenDishOut]
    filters: FiltersOut
```

- [ ] **Step 2: Test** — `backend/tests/test_schemas.py` asserts the models accept a minimal dict and round-trip the exact field names:
```python
from app.schemas import DrinkOut, ClassicOut, ContentBundleOut


def test_drink_out_keys():
    d = DrinkOut(id="x", name="X").model_dump()
    for k in ("logo","subtitle","price","volume","abv","spirit","spirits","glass",
              "descriptors","badge","recipe","garnish","pitch","photo","about","naming","faq"):
        assert k in d
    assert d["isAlcoholic"] is True


def test_bundle_shape():
    b = ContentBundleOut(sections=[], drinks=[], classics=[], families=[],
                         spiritCategories=[], spirits=[], kitchenCategories=[],
                         kitchen=[], filters={"spirits": [], "glasses": [], "classicSpirits": []})
    assert set(b.model_dump().keys()) == {"sections","drinks","classics","families",
        "spiritCategories","spirits","kitchenCategories","kitchen","filters"}
```

- [ ] **Step 3:** Run `uv run pytest tests/test_schemas.py -q` → pass. **Commit** — `git commit -m "feat(backend): v2 bundle output schemas (kit-shaped)"`

---

## Task 6: /api/content bundle serialization

**Files:** Rewrite `backend/app/routers/content.py`; Test `backend/tests/test_content.py`

**Interfaces:**
- Consumes: Task 5 schemas, `app.models`. Produces: `GET /api/content -> ContentBundleOut` serving the v2 DB. Drops standalone `/cocktails`,`/classics`,`/families`.

- [ ] **Step 1: Rewrite `backend/app/routers/content.py`.** Use eager loading to avoid N+1. Full serializers:
```python
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.auth import get_current_user
from app import models as m
from app.schemas import (DrinkOut, ClassicOut, FamilyOut, SpiritEntryOut, SpiritCategoryOut,
    KitchenDishOut, KitchenCategoryOut, SectionOut, FiltersOut, ContentBundleOut, DishNutritionOut, OurAnswer)

router = APIRouter(prefix="/api", tags=["content"], dependencies=[Depends(get_current_user)])


def _num(x):
    return None if x is None else (int(x) if x == int(x) else float(x))


def _serialize_drink(d: m.Drink) -> DrinkOut:
    spirits = [ds.spirit.label for ds in d.spirits]
    flavors = [df.flavor.label for df in d.flavors]
    return DrinkOut(
        id=d.slug, name=d.name, logo=d.img, subtitle=d.subtitle,
        price=None if d.price_amount is None else int(d.price_amount),
        volume=d.volume_ml, abv=None if d.abv is None else float(d.abv),
        spirit=spirits[0] if spirits else "", spirits=spirits,
        glass=d.glass.label if d.glass else "",
        descriptors=[s.upper() for s in spirits] + [f.upper() for f in flavors],
        badge=d.badge.key.upper() if d.badge else None,
        recipe=d.recipe, garnish=d.garnish, pitch=d.pitch, photo=d.photo,
        about=d.about, naming=d.naming, faq=d.faq,
        isAlcoholic=d.is_alcoholic, isZeroCulture=d.is_zero_culture,
        caffeineLevel=d.caffeine_level, isCarbonated=d.is_carbonated,
    )


def _serialize_classic(c: m.Classic) -> ClassicOut:
    return ClassicOut(
        id=c.slug, name=c.name, year=None if c.year is None else str(c.year),
        city=c.origin, family=c.family.key,
        spirit=c.spirits[0].spirit.label if c.spirits else "",
        glass=c.glass.label if c.glass else "",
        descriptors=[cd.descriptor.label for cd in c.descriptors],
        recipe=c.composition, garnish=c.garnish, history=c.history, fits=c.for_whom,
        ourAnswers=[OurAnswer(label=r.drink.name, menuId=r.drink.slug) for r in c.related_drinks],
    )


def _serialize_spirit(e: m.SpiritEntry, category_slug: str) -> SpiritEntryOut:
    return SpiritEntryOut(
        slug=e.slug, categorySlug=category_slug, name=e.name, img=e.img,
        abv=None if e.abv is None else float(e.abv), country=e.country,
        flavour=e.flavour, brand=e.brand, brandDetail=e.description,
        features=e.features, pairings=e.cocktail_pairings, fact=e.fact, sourceUrl=e.source_url,
    )


def _serialize_dish(k: m.KitchenDish, category_slug: str) -> KitchenDishOut:
    timing = None
    if k.timing_min_low is not None and k.timing_min_high is not None:
        timing = round((k.timing_min_low + k.timing_min_high) / 2)
    elif k.timing_min_low is not None:
        timing = k.timing_min_low
    return KitchenDishOut(
        id=k.slug, categorySlug=category_slug, name=k.name, subtitle=k.tagline,
        price=None if k.price_amount is None else int(k.price_amount),
        weight=k.weight_g, timing=timing, photo=k.img, description=k.description,
        serving=k.serving, fact=k.interesting_facts,
        nutrition=DishNutritionOut(
            kcal=None if k.kcal_portion is None else round(float(k.kcal_portion)),
            protein=_num(k.protein_g), fat=_num(k.fat_g), carb=_num(k.carb_g)),
    )


@router.get("/content", response_model=ContentBundleOut)
def get_content(db: Session = Depends(get_db)):
    drinks = db.scalars(select(m.Drink).options(
        selectinload(m.Drink.spirits).selectinload(m.DrinkSpirit.spirit),
        selectinload(m.Drink.flavors).selectinload(m.DrinkFlavor.flavor),
        selectinload(m.Drink.glass), selectinload(m.Drink.badge),
    ).order_by(m.Drink.sort_order, m.Drink.name)).all()

    classics = db.scalars(select(m.Classic).options(
        selectinload(m.Classic.family), selectinload(m.Classic.glass),
        selectinload(m.Classic.spirits).selectinload(m.ClassicSpirit.spirit),
        selectinload(m.Classic.descriptors).selectinload(m.ClassicDescriptor.descriptor),
        selectinload(m.Classic.related_drinks).selectinload(m.ClassicRelatedDrink.drink),
    ).order_by(m.Classic.sort_order, m.Classic.name)).all()

    families = db.scalars(select(m.Family).order_by(m.Family.sort_order)).all()
    fam_counts = dict(db.execute(select(m.Classic.family_id, func.count()).group_by(m.Classic.family_id)).all())

    spirit_cats = db.scalars(select(m.SpiritCategory).options(
        selectinload(m.SpiritCategory.entries)).order_by(m.SpiritCategory.sort_order)).all()
    kitchen_cats = db.scalars(select(m.KitchenCategory).options(
        selectinload(m.KitchenCategory.dishes)).order_by(m.KitchenCategory.sort_order)).all()

    # sections (catalog counts; learned omitted)
    counts = {
        "menu": db.scalar(select(func.count()).select_from(m.Drink)),
        "classics": db.scalar(select(func.count()).select_from(m.Classic)),
        "spirits": db.scalar(select(func.count()).select_from(m.SpiritEntry)),
        "kitchen": db.scalar(select(func.count()).select_from(m.KitchenDish)),
    }
    cats = db.scalars(select(m.Category).where(m.Category.kind.in_(list(counts)),
        m.Category.is_visible).order_by(m.Category.sort_order)).all()
    sections = [SectionOut(id=c.key, label=c.label, total=counts.get(c.kind, 0)) for c in cats]

    # filters (derived, deduped, order-preserving)
    def _distinct(vals):
        seen, out = set(), []
        for v in vals:
            if v and v not in seen:
                seen.add(v); out.append(v)
        return out
    menu_spirits = _distinct(ds.spirit.label for d in drinks for ds in d.spirits)
    menu_glasses = _distinct(d.glass.label for d in drinks if d.glass)
    classic_spirits = _distinct(cs.spirit.label for c in classics for cs in c.spirits)

    return ContentBundleOut(
        sections=sections,
        drinks=[_serialize_drink(d) for d in drinks],
        classics=[_serialize_classic(c) for c in classics],
        families=[FamilyOut(tint=f.key, code=f.key.upper(), title=f.label, logic=f.logic,
                            evolution=f.evolution, tip=f.tip, total=fam_counts.get(f.id, 0)) for f in families],
        spiritCategories=[SpiritCategoryOut(slug=sc.slug, label=sc.label, isArchived=sc.is_archived) for sc in spirit_cats],
        spirits=[_serialize_spirit(e, sc.slug) for sc in spirit_cats for e in sc.entries],
        kitchenCategories=[KitchenCategoryOut(slug=kc.slug, label=kc.label) for kc in kitchen_cats],
        kitchen=[_serialize_dish(dish, kc.slug) for kc in kitchen_cats for dish in kc.dishes],
        filters=FiltersOut(spirits=menu_spirits, glasses=menu_glasses, classicSpirits=classic_spirits),
    )
```
(Delete the old serializers and the standalone `/cocktails`,`/classics`,`/families` routes.)

- [ ] **Step 2: Shared login fixture** — create `backend/tests/conftest.py` (used by this task and Tasks 7 & 9; creates a throwaway `smoke_reader` since no migrated user's password is known, and deletes it after):
```python
import pytest
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password

SMOKE_USER = "smoke_reader"
SMOKE_PASS = "smoke-pass-12345"


@pytest.fixture(autouse=True, scope="session")
def _smoke_user():
    with SessionLocal() as db:
        existing = db.query(User).filter_by(username=SMOKE_USER).first()
        created = existing is None
        if created:
            db.add(User(username=SMOKE_USER, password_hash=hash_password(SMOKE_PASS), role="reader", name="Smoke"))
            db.commit()
    yield
    if created:
        with SessionLocal() as db:
            db.query(User).filter_by(username=SMOKE_USER).delete(); db.commit()


def login_client(client):
    r = client.post("/api/auth/login", json={"username": SMOKE_USER, "password": SMOKE_PASS})
    assert r.status_code == 200, r.text
    return client
```

- [ ] **Step 3: Test** — `backend/tests/test_content.py`:
```python
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import login_client


def test_content_bundle_shape_and_counts():
    with TestClient(app) as client:
        login_client(client)
        r = client.get("/api/content")
        assert r.status_code == 200
        b = r.json()
        assert {"sections","drinks","classics","families","spiritCategories","spirits",
                "kitchenCategories","kitchen","filters"} <= set(b)
        assert len(b["drinks"]) == 26 and len(b["classics"]) == 67
        assert len(b["spirits"]) == 74 and len(b["kitchen"]) == 33
        # a non-alcoholic drink is present in the unified menu
        assert any(d["isAlcoholic"] is False for d in b["drinks"])
        # kit-exact keys
        d0 = b["drinks"][0]
        assert "logo" in d0 and "subtitle" in d0 and isinstance(d0["descriptors"], list)
        # spirit pairings key is camelCase (audit item 18)
        assert all("pairings" in s and "sourceUrl" in s for s in b["spirits"])
```

- [ ] **Step 4:** Run `uv run pytest tests/test_content.py -q` → pass (the `_smoke_user` session fixture auto-provisions the login user). **Commit** — `git add app/routers/content.py tests/conftest.py tests/test_content.py && git commit -m "feat(backend): /api/content bundle on v2 schema, kit-shaped (drinks unified, camelCase keys)"`

---

## Task 7: Progress endpoints for v2 kinds + upsert

**Files:** Rewrite `backend/app/routers/me.py`; Test `backend/tests/test_progress.py`

**Interfaces:**
- `GET /api/me/progress -> {"menu":[...],"classics":[...],"spirits":[...],"kitchen":[...]}`. `POST|DELETE /api/me/progress/{kind}/{slug}` → 204. Unknown kind → 400. Unknown slug on POST → 404. Concurrent duplicate POST does not 500.

- [ ] **Step 1: Rewrite `backend/app/routers/me.py`:**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app import models as m

router = APIRouter(prefix="/api/me", tags=["me"])

KIND_MODELS = {"menu": m.Drink, "classics": m.Classic, "kitchen": m.KitchenDish, "spirits": m.SpiritEntry}


@router.get("/progress", response_model=dict[str, list[str]])
def get_progress(user=Depends(get_current_user), db: Session = Depends(get_db)):
    out = {k: [] for k in KIND_MODELS}
    rows = db.scalars(select(m.LearningProgress).where(m.LearningProgress.user_id == user.id)).all()
    for r in rows:
        if r.kind in out:
            out[r.kind].append(r.slug)
    return out


def _check(kind: str, slug: str, db: Session):
    model = KIND_MODELS.get(kind)
    if model is None:
        raise HTTPException(status_code=400, detail="Unknown kind")
    if db.scalar(select(model).where(model.slug == slug)) is None:
        raise HTTPException(status_code=404, detail="Unknown slug")


@router.post("/progress/{kind}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def mark(kind: str, slug: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _check(kind, slug, db)
    stmt = insert(m.LearningProgress).values(user_id=user.id, kind=kind, slug=slug)
    stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "kind", "slug"])
    db.execute(stmt); db.commit()


@router.delete("/progress/{kind}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def unmark(kind: str, slug: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(m.LearningProgress).filter_by(user_id=user.id, kind=kind, slug=slug).delete()
    db.commit()
```
(Delete the legacy classics-only shortcut routes.)

- [ ] **Step 2: Test** — `backend/tests/test_progress.py` (authenticated; reuse the login helper):
```python
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import login_client  # created in Task 6


def test_progress_roundtrip():
    with TestClient(app) as client:
        login_client(client)
        slug = client.get("/api/content").json()["classics"][0]["id"]
        assert client.post(f"/api/me/progress/classics/{slug}").status_code == 204
        assert slug in client.get("/api/me/progress").json()["classics"]
        # idempotent second POST does not error
        assert client.post(f"/api/me/progress/classics/{slug}").status_code == 204
        assert client.delete(f"/api/me/progress/classics/{slug}").status_code == 204
        assert slug not in client.get("/api/me/progress").json()["classics"]


def test_unknown_kind_400():
    with TestClient(app) as client:
        login_client(client)
        assert client.post("/api/me/progress/bogus/x").status_code == 400
```

- [ ] **Step 3:** Run → pass. **Commit** — `git commit -m "feat(backend): progress endpoints for v2 kinds (menu/classics/spirits/kitchen) + upsert"`

---

## Task 8: Deploy/manifest cleanup

**Files:** Modify `backend/Dockerfile`, `backend/railway.json`

- [ ] **Step 1:** In `backend/Dockerfile`, replace the hand-maintained `pip install <long list>` with an install from the manifest/lock (whichever the base image supports), e.g. `RUN uv pip install --system --no-cache -e .` (or `uv sync --frozen`). Keep the `CMD` from Task 4 (`alembic upgrade head && uvicorn`). Confirm `alembic` is on PATH in the image.

- [ ] **Step 2:** In `backend/railway.json`, ensure `healthcheckPath` is `/health` (now DB-checked) and no `startCommand` overrides the Dockerfile `CMD` (single source of truth). Leave build config otherwise.

- [ ] **Step 3:** Verify the image builds and boots against the migrated DB (or, if Docker isn't available in this environment, at minimum `uv run alembic upgrade head` is a no-op (already at head) and `uv run uvicorn app.main:app` starts and serves `/health`). Document what was verified.

- [ ] **Step 4: Commit** — `git commit -m "chore(backend): Dockerfile installs from manifest, boots via alembic upgrade (no seed on boot)"`

---

## Task 9: TestClient smoke suite (login → content → progress)

**Files:** Create `backend/tests/test_smoke.py` (reuses `tests/conftest.py`'s `login_client` created in Task 6)

**Interfaces:**
- Consumes: `login_client` from `tests/conftest.py` (Task 6). Produces an end-to-end happy-path test + the Phase-2-disabled assertions.

- [ ] **Step 1: `backend/tests/test_smoke.py`:**
```python
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import login_client


def test_full_happy_path():
    with TestClient(app) as client:
        login_client(client)
        b = client.get("/api/content").json()
        assert b["drinks"] and b["classics"] and b["spirits"] and b["kitchen"]
        slug = b["kitchen"][0]["id"]
        client.post(f"/api/me/progress/kitchen/{slug}")
        assert slug in client.get("/api/me/progress").json()["kitchen"]
        client.delete(f"/api/me/progress/kitchen/{slug}")


def test_admin_and_docs_disabled():
    with TestClient(app) as client:
        assert client.get("/api/docs").status_code == 404
        assert client.post("/api/admin/cocktails", json={}).status_code in (404, 405)
```

- [ ] **Step 2:** Run the full suite `uv run pytest -q` (all tasks' tests) → green. **Commit** — `git add tests/test_smoke.py && git commit -m "test(backend): TestClient smoke suite (login → content → progress)"`

---

## Self-Review (done during planning)

- **Spec coverage:** blueprint Part A (bundle) → Tasks 5-6; Part B (progress) → Task 7; Part C cleanups → Tasks 1-4, 8 (database/config/main/auth/seed/deploy each mapped); Part D task order preserved. Audit fixes covered: C-2 (T1), init_db/create_all + /health (T2), auth logout/401/role/rate-limit (T3), C-1/HIGH-1 seed (T4), Swagger-off + admin-disabled (T2), pairings camelCase (T6), mark_learned race (T7), manifest/Dockerfile (T4/T8). HIGH-2 (slug-rename orphans progress) is an admin-mutation concern → Phase 2 (no admin here), noted.
- **Placeholder scan:** none — every code step is complete. The one runtime unknown (a known password for a migrated user) is resolved deterministically by the `smoke_reader` fixture (Task 9), which Tasks 6-7 depend on.
- **Type consistency:** schema field names in Task 5 match the serializer outputs in Task 6 and the kit's `data.ts`; `KIND_MODELS` (Task 7) uses `m.Drink/Classic/KitchenDish/SpiritEntry` matching `models.py`.

## Notes for the executor / follow-ups (not 1a blockers)
- **Operational:** rotate + purge the plaintext passwords still in git history (Task 4 removes them from HEAD only).
- **Content/schema gaps (Phase 2 / content pass):** `Spirit.region`, `Spirit.meta` short style tag, `Dish.allergens`, `Classic.ourAnswers` custom labels/unlinked entries — no source columns yet; bundle emits null/omits. `drink_details`/`drink_tags` not shipped (no kit consumer) — if any drink's story lives only in generic detail rows, it's invisible until backfilled into the named columns.
- **Kit extension (Phase 1b):** the kit `Cocktail` type has no `isAlcoholic`/`isZeroCulture`/`caffeineLevel`/`isCarbonated`; the bundle ships them but the frontend needs a small kit-extension to render 0%/zero items and to drop the vestigial `zero`/`zc` nav entries.
- **Token revocation/TTL (M-2):** deferred; consider a `token_version` column when admin lands.
