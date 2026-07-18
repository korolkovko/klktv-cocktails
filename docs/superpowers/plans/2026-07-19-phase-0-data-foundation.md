# Phase 0 — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the evolved v2 database schema (Alembic-managed) in the new Railway Postgres and populate it losslessly from the live prod DB via a re-runnable ETL, with automated verification.

**Architecture:** New SQLAlchemy 2.0 models are the schema source of truth; Alembic creates the schema in the (empty) new DB. A standalone `migration` package reads prod **read-only** (raw SQL), runs pure parser functions to convert free-text fields into structured columns (keeping raw text in `*_raw`), merges the two non-alcoholic subsystems into a unified `drinks` table, and upserts into the new DB by slug (idempotent). A verification module asserts counts, integrity, and flags rows needing manual review.

**Tech Stack:** Python 3.12, FastAPI/SQLAlchemy 2.0 (existing), Alembic, psycopg2, pytest, `uv` for deps. Postgres 15 on Railway.

## Global Constraints

- Prod DB is **read-only** for this phase: SELECT only, never write. Connection via `SRC_DATABASE_URL` env.
- New DB target via `DEST_DATABASE_URL` env. All writes go here.
- Every re-typed field keeps its original text in a `*_raw` column — no data loss, ever.
- ETL must be **idempotent / re-runnable** (upsert by natural key `slug`); running twice yields the same DB state.
- Russian decimals use comma (`29,0` → `29.0`). Parsers normalize comma→dot.
- All money defaults to currency `₽`.
- Schema is managed **only** by Alembic — no `create_all`, no ad-hoc ALTER.
- Reference full schema in [spec §4](../specs/2026-07-19-klktv-cocktails-v2-design.md); this plan is authoritative for exact columns.

---

## File Structure

- `backend/pyproject.toml` — add `alembic`, `psycopg2-binary`, `python-multipart`, `Pillow`; commit `uv.lock`.
- `backend/app/models.py` — **rewritten** evolved models (schema source of truth).
- `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/` — Alembic setup + baseline migration.
- `backend/migration/__init__.py`
- `backend/migration/parsers.py` — pure parser functions (no DB).
- `backend/migration/source.py` — prod read-only readers (raw SQL → dict rows).
- `backend/migration/load.py` — transform + upsert into new DB.
- `backend/migration/verify.py` — post-migration verification + attention log.
- `backend/migration/run.py` — CLI: `python -m migration.run [--verify-only]`.
- `backend/tests/test_parsers.py` — parser unit tests (TDD).
- `backend/tests/test_schema.py` — schema smoke test.

---

## Task 1: Fix backend dependency manifest & dual-DB settings

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/migration/__init__.py` (empty)
- Modify: `backend/app/config.py` (add SRC/DEST url getters — additive, non-breaking)

**Interfaces:**
- Produces: env-driven `SRC_DATABASE_URL`, `DEST_DATABASE_URL` readable in migration code.

- [ ] **Step 1: Add missing runtime deps + Alembic to the manifest**

Edit `backend/pyproject.toml` `[project].dependencies` to include (keep existing entries; add these if absent):

```toml
  "alembic>=1.13",
  "psycopg2-binary>=2.9",
  "python-multipart>=0.0.9",
  "Pillow>=11",
```

Add a dev group if not present:

```toml
[dependency-groups]
dev = ["pytest>=8"]
```

- [ ] **Step 2: Lock and sync**

Run: `cd backend && uv sync`
Expected: resolves, creates/updates `backend/uv.lock`, no `ModuleNotFoundError`.

- [ ] **Step 3: Verify Pillow importable (the MEDIUM-1 bug from the audit)**

Run: `cd backend && uv run python -c "import PIL, multipart, alembic, psycopg2; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Create the migration package marker**

Create `backend/migration/__init__.py` with a single line:

```python
"""Prod → v2 ETL. Prod is read-only; all writes target DEST_DATABASE_URL."""
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add pyproject.toml uv.lock migration/__init__.py
git commit -m "chore(backend): fix dep manifest (Pillow/multipart), add alembic, lock deps"
```

---

## Task 2: Pure parsers (TDD)

The riskiest code. Pure functions, no DB. Test cases are the **actual distinct prod values**.

**Files:**
- Create: `backend/migration/parsers.py`
- Test: `backend/tests/test_parsers.py`

**Interfaces:**
- Produces:
  - `parse_abv(raw: str | None) -> tuple[Decimal | None, bool]` → `(abv, is_alcoholic)`. `Non Alc`/blank → `(None, False)`; numeric>0 → `(value, True)`.
  - `parse_price(raw: str | None) -> tuple[Decimal | None, int | None]` → `(amount, serving_ml)`.
  - `parse_weight_g(raw: str | None) -> int | None`.
  - `parse_timing(raw: str | None) -> tuple[int | None, int | None]` → `(min_low, min_high)`.
  - `parse_nutrition(raw: str | None) -> dict` → keys `kcal_portion, protein_g, fat_g, carb_g, kcal_100g` (Decimal|None).
  - `parse_spirit_origin(brand, country, brand_country) -> dict` → keys `brand, country, description, source_url`.
  - `_num(s: str) -> Decimal | None` helper (comma→dot, strip spaces).

- [ ] **Step 1: Write failing tests for `parse_abv`**

Create `backend/tests/test_parsers.py`:

```python
from decimal import Decimal
from migration.parsers import (
    parse_abv, parse_price, parse_weight_g, parse_timing, parse_nutrition,
    parse_spirit_origin,
)


def test_parse_abv_cocktail_percent():
    assert parse_abv("12.0%") == (Decimal("12.0"), True)
    assert parse_abv("6.4%") == (Decimal("6.4"), True)

def test_parse_abv_spirit_bare():
    assert parse_abv("40") == (Decimal("40"), True)
    assert parse_abv("41.3") == (Decimal("41.3"), True)

def test_parse_abv_zc_comma_word():
    assert parse_abv("6,4 Alc") == (Decimal("6.4"), True)

def test_parse_abv_non_alc():
    assert parse_abv("Non Alc") == (None, False)
    assert parse_abv("") == (None, False)
    assert parse_abv(None) == (None, False)
```

- [ ] **Step 2: Run — verify fail**

Run: `cd backend && uv run pytest tests/test_parsers.py -q`
Expected: FAIL (`ModuleNotFoundError: migration.parsers` or ImportError).

- [ ] **Step 3: Implement `_num` + `parse_abv`**

Create `backend/migration/parsers.py`:

```python
import re
from decimal import Decimal, InvalidOperation


def _num(s):
    """First numeric token in s → Decimal; comma decimals allowed. None if none."""
    if s is None:
        return None
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(s))
    if not m:
        return None
    try:
        return Decimal(m.group(0).replace(",", "."))
    except InvalidOperation:
        return None


_NONALC = re.compile(r"non\s*alc", re.IGNORECASE)


def parse_abv(raw):
    """(abv, is_alcoholic). 'Non Alc'/blank → (None, False)."""
    if raw is None or str(raw).strip() == "":
        return (None, False)
    if _NONALC.search(str(raw)):
        return (None, False)
    val = _num(raw)
    if val is None or val == 0:
        return (None, False)
    return (val, True)
```

- [ ] **Step 4: Run — verify abv tests pass**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k abv`
Expected: 4 passed.

- [ ] **Step 5: Write failing tests for `parse_price`**

Append to `tests/test_parsers.py`:

```python
def test_parse_price_plain():
    assert parse_price("400") == (Decimal("400"), None)
    assert parse_price("250₽") == (Decimal("250"), None)
    assert parse_price("430 ₽") == (Decimal("430"), None)

def test_parse_price_with_serving():
    assert parse_price("400 за 30") == (Decimal("400"), 30)
    assert parse_price("550р за 100мл") == (Decimal("550"), 100)

def test_parse_price_with_newline_serving():
    assert parse_price("800р\nза 100мл") == (Decimal("800"), 100)
    assert parse_price("550\nза\n30мл") == (Decimal("550"), 30)

def test_parse_price_blank():
    assert parse_price(None) == (None, None)
    assert parse_price("") == (None, None)
```

- [ ] **Step 6: Run — verify fail**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k price`
Expected: FAIL (`parse_price` not defined).

- [ ] **Step 7: Implement `parse_price`**

Append to `migration/parsers.py`:

```python
_SERVING = re.compile(r"за\s*(\d+)\s*мл?", re.IGNORECASE | re.DOTALL)


def parse_price(raw):
    """(amount, serving_ml). Amount = leading numeric (strip 'р'/'₽'); serving from 'за N[мл]'."""
    if raw is None or str(raw).strip() == "":
        return (None, None)
    text = str(raw)
    amount = _num(text)
    serving = None
    m = _SERVING.search(text)
    if m:
        serving = int(m.group(1))
    return (amount, serving)
```

- [ ] **Step 8: Run — verify price tests pass**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k price`
Expected: 4 passed.

- [ ] **Step 9: Write failing tests for weight + timing**

Append:

```python
def test_parse_weight_g():
    assert parse_weight_g("329") == 329
    assert parse_weight_g("30") == 30
    assert parse_weight_g(None) is None
    assert parse_weight_g("") is None

def test_parse_timing_single():
    assert parse_timing("10") == (10, 10)
    assert parse_timing("1") == (1, 1)

def test_parse_timing_range():
    assert parse_timing("10-12") == (10, 12)

def test_parse_timing_blank():
    assert parse_timing(None) == (None, None)
    assert parse_timing("") == (None, None)
```

- [ ] **Step 10: Run — verify fail, then implement**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k "weight or timing"` → FAIL.

Append to `migration/parsers.py`:

```python
def parse_weight_g(raw):
    n = _num(raw)
    return int(n) if n is not None else None


def parse_timing(raw):
    """(min_low, min_high). '10-12'→(10,12); '10'→(10,10)."""
    if raw is None or str(raw).strip() == "":
        return (None, None)
    nums = re.findall(r"\d+", str(raw))
    if not nums:
        return (None, None)
    if len(nums) == 1:
        v = int(nums[0])
        return (v, v)
    return (int(nums[0]), int(nums[1]))
```

- [ ] **Step 11: Run — verify pass**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k "weight or timing"`
Expected: all passed.

- [ ] **Step 12: Write failing tests for `parse_nutrition` (both formats)**

Append:

```python
def test_parse_nutrition_format_a():
    raw = "На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7\nНа 100г: 153 ккал"
    r = parse_nutrition(raw)
    assert r["kcal_portion"] == Decimal("503")
    assert r["protein_g"] == Decimal("29.0")
    assert r["fat_g"] == Decimal("6.8")
    assert r["carb_g"] == Decimal("75.7")
    assert r["kcal_100g"] == Decimal("153")

def test_parse_nutrition_format_b():
    raw = "На порцию б 0,16 ж 18,62 у 5,96 195,2  ккал \nНа 100гр б 0,4  ж 46,55  у 14,92 488,01 ккал"
    r = parse_nutrition(raw)
    assert r["protein_g"] == Decimal("0.16")
    assert r["fat_g"] == Decimal("18.62")
    assert r["carb_g"] == Decimal("5.96")
    assert r["kcal_portion"] == Decimal("195.2")
    assert r["kcal_100g"] == Decimal("488.01")

def test_parse_nutrition_blank():
    r = parse_nutrition(None)
    assert all(v is None for v in r.values())
```

- [ ] **Step 13: Run — verify fail**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k nutrition` → FAIL.

- [ ] **Step 14: Implement `parse_nutrition`**

Append to `migration/parsers.py`:

```python
_EMPTY_NUTR = {"kcal_portion": None, "protein_g": None, "fat_g": None,
               "carb_g": None, "kcal_100g": None}

# Format A: "На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7"
_A_PORTION = re.compile(
    r"порци[юя].*?(\d[\d.,]*)\s*ккал.*?б\s*([\d.,]+).*?ж\s*([\d.,]+).*?у\s*([\d.,]+)",
    re.IGNORECASE | re.DOTALL)
# Format B: "На порцию б 0,16 ж 18,62 у 5,96 195,2 ккал"
_B_PORTION = re.compile(
    r"порци[юя]\s*б\s*([\d.,]+)\s*ж\s*([\d.,]+)\s*у\s*([\d.,]+)\s*([\d.,]+)\s*ккал",
    re.IGNORECASE | re.DOTALL)
_PER100 = re.compile(r"на\s*100\s*гр?\D*?(\d[\d.,]*)\s*ккал", re.IGNORECASE | re.DOTALL)


def parse_nutrition(raw):
    if raw is None or str(raw).strip() == "":
        return dict(_EMPTY_NUTR)
    text = str(raw)
    out = dict(_EMPTY_NUTR)
    mb = _B_PORTION.search(text)
    if mb:
        out["protein_g"] = _num(mb.group(1))
        out["fat_g"] = _num(mb.group(2))
        out["carb_g"] = _num(mb.group(3))
        out["kcal_portion"] = _num(mb.group(4))
    else:
        ma = _A_PORTION.search(text)
        if ma:
            out["kcal_portion"] = _num(ma.group(1))
            out["protein_g"] = _num(ma.group(2))
            out["fat_g"] = _num(ma.group(3))
            out["carb_g"] = _num(ma.group(4))
    m100 = _PER100.search(text)
    if m100:
        out["kcal_100g"] = _num(m100.group(1))
    return out
```

- [ ] **Step 15: Run — verify nutrition tests pass**

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k nutrition`
Expected: 3 passed.

- [ ] **Step 16: Write failing tests + implement `parse_spirit_origin`**

Append tests:

```python
def test_spirit_origin_extracts_url_and_strips_region():
    r = parse_spirit_origin(brand="", country="регион:Испания",
                            brand_country="История бренда. https://example.com/x подробнее")
    assert r["country"] == "Испания"
    assert r["source_url"] == "https://example.com/x"
    assert "https://" not in r["description"]

def test_spirit_origin_prefers_clean_fields():
    r = parse_spirit_origin(brand="Orendain", country="Мексика", brand_country="")
    assert r["brand"] == "Orendain"
    assert r["country"] == "Мексика"
```

Run: `cd backend && uv run pytest tests/test_parsers.py -q -k origin` → FAIL, then append:

```python
_URL = re.compile(r"https?://\S+")
_REGION = re.compile(r"^\s*регион:\s*", re.IGNORECASE)


def parse_spirit_origin(brand, country, brand_country):
    brand = (brand or "").strip() or None
    country = (country or "").strip()
    country = _REGION.sub("", country).strip() or None
    bc = brand_country or ""
    url_m = _URL.search(bc)
    source_url = url_m.group(0) if url_m else None
    description = _URL.sub("", bc).strip() or None
    return {"brand": brand, "country": country,
            "description": description, "source_url": source_url}
```

- [ ] **Step 17: Run full parser suite + commit**

Run: `cd backend && uv run pytest tests/test_parsers.py -q`
Expected: all passed.

```bash
cd backend && git add migration/parsers.py tests/test_parsers.py
git commit -m "feat(migration): field parsers (abv/price/weight/timing/nutrition/origin) with real-data tests"
```

---

## Task 3: Evolved models + Alembic baseline (creates schema in new DB)

**Files:**
- Rewrite: `backend/app/models.py`
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/` (autogenerated)
- Test: `backend/tests/test_schema.py`

**Interfaces:**
- Produces: SQLAlchemy models per spec §4 (`Drink`, `DrinkTag`, `DrinkFlavor`, `DrinkSpirit`, `DrinkDetail`, `Classic`, `ClassicSpirit`, `ClassicDescriptor`, `ClassicRelatedDrink`, `SpiritCategory`, `SpiritEntry`, `KitchenCategory`, `KitchenDish`, `LearningProgress`, `TimelineEntry`, lookups). `alembic upgrade head` against `DEST_DATABASE_URL` builds the schema.

- [ ] **Step 1: Rewrite `backend/app/models.py`**

Replace the file with the evolved schema below (drops `classic_progress`, `zero_*`, `zc_*`; unifies drinks; adds `*_raw` + structured columns per spec §4). Use `Numeric` for money/abv, `Integer` for grams/ml/minutes.

```python
from datetime import datetime
from sqlalchemy import (
    Boolean, Integer, Numeric, String, Text, DateTime, ForeignKey, func,
)
from sqlalchemy.orm import relationship, mapped_column, Mapped
from app.database import Base


# ── Users ──
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="reader")
    name: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Lookups ──
class Glass(Base):
    __tablename__ = "glasses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Spirit(Base):
    __tablename__ = "spirits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(64))  # added for consistency
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Flavor(Base):
    __tablename__ = "flavors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)


class Descriptor(Base):
    __tablename__ = "descriptors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Family(Base):
    __tablename__ = "families"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sub: Mapped[str | None] = mapped_column(String(128))
    color: Mapped[str | None] = mapped_column(String(16))
    logic: Mapped[str | None] = mapped_column(Text)
    evolution: Mapped[str | None] = mapped_column(Text)
    tip: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    classics: Mapped[list["Classic"]] = relationship(back_populates="family")


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # menu|classics|spirits|kitchen
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ── Drinks (author menu; absorbs cocktails + zero + zc) ──
class Drink(Base):
    __tablename__ = "drinks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    subtitle: Mapped[str | None] = mapped_column(Text)
    is_alcoholic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_zero_culture: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    abv: Mapped[Numeric | None] = mapped_column(Numeric(5, 2))
    abv_raw: Mapped[str | None] = mapped_column(String(32))
    price_amount: Mapped[Numeric | None] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(8), default="₽", nullable=False)
    price_raw: Mapped[str | None] = mapped_column(String(64))
    volume_ml: Mapped[int | None] = mapped_column(Integer)
    caffeine_level: Mapped[int | None] = mapped_column(Integer)
    is_carbonated: Mapped[bool | None] = mapped_column(Boolean)
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    badge_id: Mapped[int | None] = mapped_column(ForeignKey("badges.id", ondelete="SET NULL"))
    recipe: Mapped[str | None] = mapped_column(Text)
    garnish: Mapped[str | None] = mapped_column(Text)
    pitch: Mapped[str | None] = mapped_column(Text)
    about: Mapped[str | None] = mapped_column(Text)
    naming: Mapped[str | None] = mapped_column(Text)
    faq: Mapped[str | None] = mapped_column(Text)
    photo: Mapped[str | None] = mapped_column(String(256))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    glass: Mapped["Glass | None"] = relationship()
    badge: Mapped["Badge | None"] = relationship()
    tags: Mapped[list["DrinkTag"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkTag.sort_order")
    flavors: Mapped[list["DrinkFlavor"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkFlavor.sort_order")
    spirits: Mapped[list["DrinkSpirit"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkSpirit.sort_order")
    details: Mapped[list["DrinkDetail"]] = relationship(back_populates="drink", cascade="all, delete-orphan", order_by="DrinkDetail.sort_order")


class DrinkTag(Base):
    __tablename__ = "drink_tags"
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()


class DrinkFlavor(Base):
    __tablename__ = "drink_flavors"
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    flavor_id: Mapped[int] = mapped_column(ForeignKey("flavors.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="flavors")
    flavor: Mapped["Flavor"] = relationship()


class DrinkSpirit(Base):
    __tablename__ = "drink_spirits"
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    spirit_id: Mapped[int] = mapped_column(ForeignKey("spirits.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="spirits")
    spirit: Mapped["Spirit"] = relationship()


class DrinkDetail(Base):
    __tablename__ = "drink_details"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    drink: Mapped["Drink"] = relationship(back_populates="details")


# ── Classics ──
class Classic(Base):
    __tablename__ = "classics"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="RESTRICT"), index=True)
    year: Mapped[int | None] = mapped_column(Integer)
    origin: Mapped[str | None] = mapped_column(String(128))
    composition: Mapped[str | None] = mapped_column(Text)
    glass_id: Mapped[int | None] = mapped_column(ForeignKey("glasses.id", ondelete="SET NULL"))
    garnish: Mapped[str | None] = mapped_column(Text)
    history: Mapped[str | None] = mapped_column(Text)
    for_whom: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    family: Mapped["Family"] = relationship(back_populates="classics")
    glass: Mapped["Glass | None"] = relationship()
    spirits: Mapped[list["ClassicSpirit"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicSpirit.sort_order")
    descriptors: Mapped[list["ClassicDescriptor"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicDescriptor.sort_order")
    related_drinks: Mapped[list["ClassicRelatedDrink"]] = relationship(back_populates="classic", cascade="all, delete-orphan", order_by="ClassicRelatedDrink.sort_order")


class ClassicSpirit(Base):
    __tablename__ = "classic_spirits"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    spirit_id: Mapped[int] = mapped_column(ForeignKey("spirits.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    classic: Mapped["Classic"] = relationship(back_populates="spirits")
    spirit: Mapped["Spirit"] = relationship()


class ClassicDescriptor(Base):
    __tablename__ = "classic_descriptors"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    descriptor_id: Mapped[int] = mapped_column(ForeignKey("descriptors.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    classic: Mapped["Classic"] = relationship(back_populates="descriptors")
    descriptor: Mapped["Descriptor"] = relationship()


class ClassicRelatedDrink(Base):
    __tablename__ = "classic_related_drinks"
    classic_id: Mapped[int] = mapped_column(ForeignKey("classics.id", ondelete="CASCADE"), primary_key=True)
    drink_id: Mapped[int] = mapped_column(ForeignKey("drinks.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    classic: Mapped["Classic"] = relationship(back_populates="related_drinks")
    drink: Mapped["Drink"] = relationship()


# ── Spirits catalog ──
class SpiritCategory(Base):
    __tablename__ = "spirit_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entries: Mapped[list["SpiritEntry"]] = relationship(back_populates="category", order_by="SpiritEntry.sort_order")


class SpiritEntry(Base):
    __tablename__ = "spirit_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("spirit_categories.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    abv: Mapped[Numeric | None] = mapped_column(Numeric(5, 2))
    abv_raw: Mapped[str | None] = mapped_column(String(32))
    price_amount: Mapped[Numeric | None] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(8), default="₽", nullable=False)
    serving_ml: Mapped[int | None] = mapped_column(Integer)
    price_raw: Mapped[str | None] = mapped_column(String(64))
    flavour: Mapped[str | None] = mapped_column(Text)
    brand: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    features: Mapped[str | None] = mapped_column(Text)
    cocktail_pairings: Mapped[str | None] = mapped_column(Text)
    fact: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category: Mapped["SpiritCategory"] = relationship(back_populates="entries")


# ── Kitchen ──
class KitchenCategory(Base):
    __tablename__ = "kitchen_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    dishes: Mapped[list["KitchenDish"]] = relationship(back_populates="category", order_by="KitchenDish.sort_order")


class KitchenDish(Base):
    __tablename__ = "kitchen_dishes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("kitchen_categories.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    img: Mapped[str | None] = mapped_column(String(256))
    price_amount: Mapped[Numeric | None] = mapped_column(Numeric(10, 2))
    price_currency: Mapped[str] = mapped_column(String(8), default="₽", nullable=False)
    price_raw: Mapped[str | None] = mapped_column(String(32))
    tagline: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    timing_min_low: Mapped[int | None] = mapped_column(Integer)
    timing_min_high: Mapped[int | None] = mapped_column(Integer)
    timing_raw: Mapped[str | None] = mapped_column(String(32))
    weight_g: Mapped[int | None] = mapped_column(Integer)
    weight_raw: Mapped[str | None] = mapped_column(String(64))
    kcal_portion: Mapped[Numeric | None] = mapped_column(Numeric(7, 2))
    protein_g: Mapped[Numeric | None] = mapped_column(Numeric(7, 2))
    fat_g: Mapped[Numeric | None] = mapped_column(Numeric(7, 2))
    carb_g: Mapped[Numeric | None] = mapped_column(Numeric(7, 2))
    kcal_100g: Mapped[Numeric | None] = mapped_column(Numeric(7, 2))
    nutrition_raw: Mapped[str | None] = mapped_column(Text)
    serving: Mapped[str | None] = mapped_column(Text)
    interesting_facts: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category: Mapped["KitchenCategory"] = relationship(back_populates="dishes")


# ── Progress (slug-keyed; rename-migration handled in CRUD layer, Phase 1) ──
class LearningProgress(Base):
    __tablename__ = "learning_progress"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), primary_key=True)
    learned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Timeline (retained; not surfaced yet) ──
class TimelineEntry(Base):
    __tablename__ = "timeline_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    examples: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
```

- [ ] **Step 2: Initialize Alembic**

Run: `cd backend && uv run alembic init alembic`
Expected: creates `alembic.ini` + `alembic/`.

- [ ] **Step 3: Wire Alembic to models + env URL**

Edit `backend/alembic/env.py`: after the existing imports, set metadata and URL from env:

```python
import os
from app.database import Base
import app.models  # noqa: F401  (register all tables on Base.metadata)

target_metadata = Base.metadata

def _url():
    url = os.environ.get("DEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Set DEST_DATABASE_URL (or DATABASE_URL) for Alembic")
    return url
```

Replace the `config.get_main_option("sqlalchemy.url")` usages in both `run_migrations_offline()` and `run_migrations_online()` with `_url()`. In `alembic.ini`, leave `sqlalchemy.url` empty.

- [ ] **Step 4: Autogenerate the baseline migration**

Run: `cd backend && DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run alembic revision --autogenerate -m "v2 baseline schema"`
Expected: a new file in `alembic/versions/` creating all tables. Open it and confirm `drinks`, `drink_*`, `classic_related_drinks`, evolved `spirit_entries`/`kitchen_dishes`, and **no** `classic_progress`/`zero_*`/`zc_*`.

- [ ] **Step 5: Apply to the new DB**

Run: `cd backend && DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run alembic upgrade head`
Expected: `Running upgrade -> ...`, no errors. (New DB must be empty; if not, drop its public schema first — it's a fresh dev DB.)

- [ ] **Step 6: Schema smoke test**

Create `backend/tests/test_schema.py`:

```python
import os
from sqlalchemy import create_engine, inspect


def test_expected_tables_exist():
    engine = create_engine(os.environ["DEST_DATABASE_URL"])
    names = set(inspect(engine).get_table_names())
    for t in ["drinks", "drink_tags", "drink_flavors", "drink_spirits",
              "drink_details", "classics", "classic_related_drinks",
              "spirit_entries", "kitchen_dishes", "learning_progress",
              "timeline_entries", "users"]:
        assert t in names, f"missing {t}"
    for gone in ["classic_progress", "zero_cocktails", "zc_drinks"]:
        assert gone not in names, f"legacy table present: {gone}"
```

Run: `cd backend && DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run pytest tests/test_schema.py -q`
Expected: passed.

- [ ] **Step 7: Commit**

```bash
cd backend && git add app/models.py alembic.ini alembic/ tests/test_schema.py
git commit -m "feat(schema): evolved v2 models + Alembic baseline (unified drinks, typed fields)"
```

---

## Task 4: Prod read-only source readers

**Files:**
- Create: `backend/migration/source.py`

**Interfaces:**
- Produces: `read_all(src_url) -> dict` returning lists of dict rows per prod table (cocktails, cocktail_details/tags/flavors, classics + links, families, glasses, spirits, tags, flavors, descriptors, badges, categories, spirit_categories/entries, kitchen_categories/dishes, zero_cocktails/details, zc_drinks/details, learning_progress, timeline_entries, users). Read-only (SELECT).

- [ ] **Step 1: Implement `source.py`**

```python
from sqlalchemy import create_engine, text

_TABLES = [
    "users", "glasses", "spirits", "tags", "flavors", "descriptors", "badges",
    "families", "categories",
    "cocktails", "cocktail_details", "cocktail_tags", "cocktail_flavors",
    "classics", "classic_spirits", "classic_descriptors", "classic_related_cocktails",
    "spirit_categories", "spirit_entries",
    "kitchen_categories", "kitchen_dishes",
    "zero_cocktails", "zero_cocktail_details",
    "zc_drinks", "zc_drink_details",
    "learning_progress", "timeline_entries",
]


def read_all(src_url):
    engine = create_engine(src_url)
    out = {}
    with engine.connect() as conn:  # read-only: only SELECT issued
        for t in _TABLES:
            rows = conn.execute(text(f"SELECT * FROM {t}")).mappings().all()
            out[t] = [dict(r) for r in rows]
    return out
```

- [ ] **Step 2: Integration check against prod (read-only)**

Run:
```bash
cd backend && SRC_DATABASE_URL="$SRC_DATABASE_URL" uv run python -c "
from migration.source import read_all; import os
d = read_all(os.environ['SRC_DATABASE_URL'])
print({k: len(v) for k in ['cocktails','classics','spirit_entries','kitchen_dishes','zero_cocktails','zc_drinks','learning_progress'] for k,v in [(k,d[k])]})
"
```
Expected: `{'cocktails': 24, 'classics': 67, 'spirit_entries': 74, 'kitchen_dishes': 33, 'zero_cocktails': 1, 'zc_drinks': 2, 'learning_progress': 189}`.

- [ ] **Step 3: Commit**

```bash
cd backend && git add migration/source.py
git commit -m "feat(migration): prod read-only source readers"
```

---

## Task 5: Transform + load into new DB (idempotent)

**Files:**
- Create: `backend/migration/load.py`
- Create: `backend/migration/run.py`

**Interfaces:**
- Consumes: `source.read_all`, all `parsers.*`, all `app.models`.
- Produces: `load(src_url, dest_url) -> dict` (stats). `run.py` CLI wires env → `load`, then `verify`.

**Key mapping rules:**
- Lookups (glasses, spirits, tags, flavors, descriptors, badges, families, categories, users, spirit_categories, kitchen_categories, timeline) copy by natural key/slug; `tags.label` defaults to `key.title()` when absent; drop `categories` rows with key in `{zero, zc}`.
- `cocktails` → `drinks(is_alcoholic via parse_abv)`; `zero_cocktails` → `drinks(is_alcoholic=False)`; `zc_drinks` → `drinks(is_zero_culture=True, is_alcoholic per row, caffeine_level, is_carbonated)`.
- **Upcykle dedup:** if a `zc_drinks` slug normalizes to an existing cocktail drink (`upcykle_cola` vs `upcyklecola`), skip the zc row's drink creation but keep its detail blocks merged into the existing drink; log it.
- Details: `cocktail_details`/`zero_cocktail_details`/`zc_drink_details` → `drink_details` (generic blocks). Known kit sections are left in `drink_details` for Phase 1 mapping; nothing dropped.
- `classic_related_cocktails` → `classic_related_drinks`.
- `learning_progress` copied verbatim (kinds classics/kitchen/menu are valid post-merge).
- Test-junk filter: skip flavors/descriptors/tags with labels in `{"ДОБАВЛЕНО ИЗ UI", "Тестовый", "Обновлённый", "test-tag"}`.

- [ ] **Step 1: Implement `load.py`**

```python
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app import models as m
from migration.source import read_all
from migration.parsers import (
    parse_abv, parse_price, parse_weight_g, parse_timing, parse_nutrition,
    parse_spirit_origin,
)

JUNK = {"ДОБАВЛЕНО ИЗ UI", "Тестовый", "Обновлённый", "test-tag", "test_tag"}


def _slugnorm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load(src_url, dest_url):
    src = read_all(src_url)
    engine = create_engine(dest_url)
    stats = {}
    with Session(engine) as s:
        # 1) lookups
        for row in src["glasses"]:
            s.merge(m.Glass(**{k: row[k] for k in ("id", "key", "label", "sort_order")}))
        for row in src["spirits"]:
            s.merge(m.Spirit(**{k: row[k] for k in ("id", "key", "label", "sort_order")}))
        for row in src["tags"]:
            s.merge(m.Tag(id=row["id"], key=row["key"], label=row["key"].title()))
        for row in src["flavors"]:
            if row["label"] in JUNK:
                continue
            s.merge(m.Flavor(id=row["id"], label=row["label"]))
        for row in src["descriptors"]:
            if row["label"] in JUNK:
                continue
            s.merge(m.Descriptor(id=row["id"], label=row["label"]))
        for row in src["badges"]:
            s.merge(m.Badge(id=row["id"], key=row["key"], label=row["label"]))
        for row in src["families"]:
            s.merge(m.Family(**{k: row.get(k) for k in
                    ("id", "key", "label", "sub", "color", "logic", "evolution", "tip", "sort_order")}))
        for row in src["categories"]:
            if row["key"] in ("zero", "zc"):
                continue
            s.merge(m.Category(**{k: row[k] for k in ("id", "key", "label", "kind", "sort_order", "is_visible")}))
        for row in src["users"]:
            s.merge(m.User(**{k: row[k] for k in ("id", "username", "password_hash", "role", "name", "created_at")}))
        for row in src["spirit_categories"]:
            s.merge(m.SpiritCategory(**{k: row[k] for k in ("id", "slug", "label", "sort_order", "is_archived")}))
        for row in src["kitchen_categories"]:
            s.merge(m.KitchenCategory(**{k: row[k] for k in ("id", "slug", "label", "sort_order")}))
        for row in src["timeline_entries"]:
            s.merge(m.TimelineEntry(**{k: row[k] for k in ("id", "period", "description", "examples", "sort_order")}))
        s.flush()

        # 2) drinks from cocktails
        drink_slugs = {}  # normalized -> slug
        next_id = 1
        for row in src["cocktails"]:
            abv, is_alc = parse_abv(row.get("abv"))
            d = m.Drink(
                id=next_id, slug=row["slug"], name=row["name"], img=row.get("img"),
                subtitle=row.get("tagline"), is_alcoholic=is_alc, abv=abv, abv_raw=row.get("abv"),
                glass_id=row.get("glass_id"), badge_id=row.get("badge_id"),
                sort_order=row.get("sort_order", 0),
            )
            s.merge(d)
            drink_slugs[_slugnorm(row["slug"])] = row["slug"]
            next_id += 1
        s.flush()

        # 3) zero_cocktails → drinks (non-alc)
        for row in src["zero_cocktails"]:
            price_amt, _ = parse_price(row.get("price"))
            s.merge(m.Drink(
                id=next_id, slug=row["slug"], name=row["name"], img=row.get("img"),
                subtitle=row.get("tagline"), is_alcoholic=False, abv=None, abv_raw=row.get("abv"),
                price_amount=price_amt, price_raw=row.get("price"),
                glass_id=row.get("glass_id"), sort_order=row.get("sort_order", 0),
            ))
            drink_slugs[_slugnorm(row["slug"])] = row["slug"]
            next_id += 1
        s.flush()

        # 4) zc_drinks → drinks (dedup Upcykle by normalized slug)
        upcykle_merges = 0
        for row in src["zc_drinks"]:
            norm = _slugnorm(row["slug"])
            price_amt, _ = parse_price(row.get("price"))
            abv, is_alc = parse_abv(row.get("abv"))
            if norm in drink_slugs:
                upcykle_merges += 1  # duplicate product; keep existing drink, details merged in step 6
                continue
            s.merge(m.Drink(
                id=next_id, slug=row["slug"], name=row["name"], img=row.get("img"),
                subtitle=row.get("tagline"), is_alcoholic=bool(row.get("is_alcoholic")),
                is_zero_culture=True, abv=abv, abv_raw=row.get("abv"),
                price_amount=price_amt, price_raw=row.get("price"),
                caffeine_level=row.get("caffeine_level"), is_carbonated=row.get("is_carbonated"),
                glass_id=row.get("glass_id"), sort_order=row.get("sort_order", 0),
            ))
            drink_slugs[norm] = row["slug"]
            next_id += 1
        s.flush()
        stats["upcykle_merges"] = upcykle_merges

        # 5) resolve drink slug -> new id map
        id_by_slug = {d.slug: d.id for d in s.query(m.Drink).all()}

        # 6) details from all three legacy detail tables → drink_details
        det_id = 1
        def _add_details(rows, parent_key, slug_by_parent):
            nonlocal det_id
            for r in rows:
                slug = slug_by_parent.get(r[parent_key])
                did = id_by_slug.get(slug)
                if did is None:
                    continue
                s.merge(m.DrinkDetail(id=det_id, drink_id=did, label=r["label"], text=r["text"],
                                      sort_order=r.get("sort_order", 0)))
                det_id += 1
        ck_slug = {r["id"]: r["slug"] for r in src["cocktails"]}
        z0_slug = {r["id"]: r["slug"] for r in src["zero_cocktails"]}
        zc_slug = {r["id"]: (r["slug"] if _slugnorm(r["slug"]) not in
                   {_slugnorm(x) for x in ck_slug.values()} else
                   drink_slugs[_slugnorm(r["slug"])]) for r in src["zc_drinks"]}
        _add_details(src["cocktail_details"], "cocktail_id", ck_slug)
        _add_details(src["zero_cocktail_details"], "parent_id", z0_slug)
        _add_details(src["zc_drink_details"], "parent_id", zc_slug)

        # 7) drink M:N (tags/flavors) from cocktails only (zero/zc had none)
        for r in src["cocktail_tags"]:
            did = id_by_slug.get(ck_slug.get(r["cocktail_id"]))
            if did:
                s.merge(m.DrinkTag(drink_id=did, tag_id=r["tag_id"], sort_order=r.get("sort_order", 0)))
        for r in src["cocktail_flavors"]:
            did = id_by_slug.get(ck_slug.get(r["cocktail_id"]))
            if did:
                s.merge(m.DrinkFlavor(drink_id=did, flavor_id=r["flavor_id"], sort_order=r.get("sort_order", 0)))
        s.flush()

        # 8) classics + links
        for row in src["classics"]:
            s.merge(m.Classic(**{k: row.get(k) for k in
                    ("id", "slug", "name", "family_id", "year", "origin", "composition",
                     "glass_id", "garnish", "history", "for_whom", "sort_order")}))
        s.flush()
        for r in src["classic_spirits"]:
            s.merge(m.ClassicSpirit(classic_id=r["classic_id"], spirit_id=r["spirit_id"], sort_order=r.get("sort_order", 0)))
        for r in src["classic_descriptors"]:
            s.merge(m.ClassicDescriptor(classic_id=r["classic_id"], descriptor_id=r["descriptor_id"], sort_order=r.get("sort_order", 0)))
        for r in src["classic_related_cocktails"]:
            did = id_by_slug.get(ck_slug.get(r["cocktail_id"]))
            if did:
                s.merge(m.ClassicRelatedDrink(classic_id=r["classic_id"], drink_id=did, sort_order=r.get("sort_order", 0)))

        # 9) spirit_entries (parsed)
        for row in src["spirit_entries"]:
            abv, _ = parse_abv(row.get("abv"))
            amt, serving = parse_price(row.get("price"))
            origin = parse_spirit_origin(row.get("brand"), row.get("country"), row.get("brand_country"))
            s.merge(m.SpiritEntry(
                id=row["id"], slug=row["slug"], category_id=row["category_id"], name=row["name"],
                img=row.get("img"), abv=abv, abv_raw=row.get("abv"),
                price_amount=amt, serving_ml=serving, price_raw=row.get("price"),
                flavour=row.get("flavour"), brand=origin["brand"], country=origin["country"],
                description=origin["description"], source_url=origin["source_url"] or row.get("source_url"),
                features=row.get("features"), cocktail_pairings=row.get("cocktail_pairings"),
                fact=row.get("fact"), sort_order=row.get("sort_order", 0),
            ))

        # 10) kitchen_dishes (parsed)
        for row in src["kitchen_dishes"]:
            amt, _ = parse_price(row.get("price"))
            lo, hi = parse_timing(row.get("timing"))
            nutr = parse_nutrition(row.get("nutrition"))
            s.merge(m.KitchenDish(
                id=row["id"], slug=row["slug"], category_id=row["category_id"], name=row["name"],
                img=row.get("img"), price_amount=amt, price_raw=row.get("price"),
                tagline=row.get("tagline"), description=row.get("description"),
                timing_min_low=lo, timing_min_high=hi, timing_raw=row.get("timing"),
                weight_g=parse_weight_g(row.get("weight")), weight_raw=row.get("weight"),
                nutrition_raw=row.get("nutrition"), serving=row.get("serving"),
                interesting_facts=row.get("interesting_facts"), sort_order=row.get("sort_order", 0),
                **nutr,
            ))

        # 11) progress
        for r in src["learning_progress"]:
            s.merge(m.LearningProgress(user_id=r["user_id"], kind=r["kind"], slug=r["slug"], learned_at=r.get("learned_at")))

        s.commit()
        stats["drinks"] = s.query(m.Drink).count()
    return stats
```

- [ ] **Step 2: Implement `run.py`**

```python
import os
from migration.load import load
from migration.verify import verify


def main():
    src = os.environ["SRC_DATABASE_URL"]
    dest = os.environ["DEST_DATABASE_URL"]
    stats = load(src, dest)
    print("LOAD:", stats)
    verify(src, dest)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the load (idempotent) against the new DB**

Run:
```bash
cd backend && SRC_DATABASE_URL="$SRC_DATABASE_URL" DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run python -m migration.load 2>/dev/null; \
SRC_DATABASE_URL="$SRC_DATABASE_URL" DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run python -c "from migration.load import load; import os; print(load(os.environ['SRC_DATABASE_URL'], os.environ['DEST_DATABASE_URL']))"
```
Expected: prints stats incl. `drinks`: 27 (24 cocktails + 1 zero + 2 zc − 1 Upcykle dedup = 26; confirm actual) and `upcykle_merges`: 1. Re-running yields identical counts (idempotent merge).

- [ ] **Step 4: Commit**

```bash
cd backend && git add migration/load.py migration/run.py
git commit -m "feat(migration): idempotent transform+load prod→v2 (unified drinks, parsed fields)"
```

---

## Task 6: Verification + attention log

**Files:**
- Create: `backend/migration/verify.py`

**Interfaces:**
- Consumes: `source.read_all`, `app.models`.
- Produces: `verify(src_url, dest_url) -> None` — raises `AssertionError` on integrity failure; prints a report + a "NEEDS ATTENTION" list of rows where a raw field was non-empty but its parsed value is null.

- [ ] **Step 1: Implement `verify.py`**

```python
from sqlalchemy import create_engine, func
from sqlalchemy.orm import Session
from app import models as m
from migration.source import read_all


def verify(src_url, dest_url):
    src = read_all(src_url)
    engine = create_engine(dest_url)
    with Session(engine) as s:
        drinks = s.query(m.Drink).count()
        expected_drinks = len(src["cocktails"]) + len(src["zero_cocktails"]) + len(src["zc_drinks"]) - 1  # Upcykle dedup
        assert drinks == expected_drinks, f"drinks {drinks} != {expected_drinks}"

        # counts preserved
        assert s.query(m.Classic).count() == len(src["classics"])
        assert s.query(m.SpiritEntry).count() == len(src["spirit_entries"])
        assert s.query(m.KitchenDish).count() == len(src["kitchen_dishes"])
        assert s.query(m.LearningProgress).count() == len(src["learning_progress"])

        # no orphan progress (every slug resolves in its kind)
        drink_slugs = {d.slug for d in s.query(m.Drink).all()}
        classic_slugs = {c.slug for c in s.query(m.Classic).all()}
        dish_slugs = {k.slug for k in s.query(m.KitchenDish).all()}
        kind_sets = {"menu": drink_slugs, "classics": classic_slugs, "kitchen": dish_slugs}
        orphans = [(p.kind, p.slug) for p in s.query(m.LearningProgress).all()
                   if p.kind in kind_sets and p.slug not in kind_sets[p.kind]]
        assert not orphans, f"orphan progress rows: {orphans}"

        # attention: raw present but parse produced null
        attention = []
        for d in s.query(m.Drink).all():
            if d.abv_raw and d.is_alcoholic and d.abv is None:
                attention.append(("drink.abv", d.slug, d.abv_raw))
        for e in s.query(m.SpiritEntry).all():
            if e.price_raw and e.price_amount is None:
                attention.append(("spirit.price", e.slug, e.price_raw))
            if e.abv_raw and e.abv is None:
                attention.append(("spirit.abv", e.slug, e.abv_raw))
        for k in s.query(m.KitchenDish).all():
            if k.nutrition_raw and k.kcal_portion is None:
                attention.append(("dish.nutrition", k.slug, k.nutrition_raw[:40]))

        print(f"OK drinks={drinks} classics={s.query(m.Classic).count()} "
              f"spirits={s.query(m.SpiritEntry).count()} dishes={s.query(m.KitchenDish).count()} "
              f"progress={s.query(m.LearningProgress).count()}")
        if attention:
            print(f"⚠ NEEDS ATTENTION ({len(attention)}):")
            for a in attention:
                print("  ", a)
        else:
            print("✓ all raw fields parsed cleanly")
```

- [ ] **Step 2: Run verification**

Run: `cd backend && SRC_DATABASE_URL="$SRC_DATABASE_URL" DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run python -m migration.run`
Expected: `LOAD: {...}` then `OK drinks=... classics=67 spirits=74 dishes=33 progress=189`, integrity assertions pass, and a short NEEDS ATTENTION list (only genuinely non-numeric rows).

- [ ] **Step 3: Commit**

```bash
cd backend && git add migration/verify.py
git commit -m "feat(migration): post-migration verification + attention log"
```

---

## Task 7: Full run + manual review of flagged rows

- [ ] **Step 1: Fresh idempotency check**

Run the load twice in a row; confirm `verify` counts are identical both times (upsert idempotency).

- [ ] **Step 2: Eyeball the NEEDS ATTENTION rows**

For each flagged row, confirm the raw value is genuinely non-structured (e.g. a spirit price with an odd serving note) and that `*_raw` retains it. Record decisions inline in this plan (checkbox notes). No code change unless a parser gap is found — if so, add a test case to `test_parsers.py` and fix the parser (back to Task 2 discipline).

- [ ] **Step 3: Spot-check merged data**

Run:
```bash
cd backend && DEST_DATABASE_URL="$DEST_DATABASE_URL" uv run python -c "
from sqlalchemy import create_engine, text; import os
e=create_engine(os.environ['DEST_DATABASE_URL'])
with e.connect() as c:
    print('non-alc drinks:', c.execute(text(\"select count(*) from drinks where is_alcoholic=false\")).scalar())
    print('zc drinks:', c.execute(text(\"select count(*) from drinks where is_zero_culture=true\")).scalar())
    print('upcykle:', [r[0] for r in c.execute(text(\"select slug from drinks where slug ilike '%upcykle%'\"))])
"
```
Expected: non-alc ≥ 1, zc ≥ 1, exactly one Upcykle drink slug.

- [ ] **Step 4: Final commit (any parser fixes / notes)**

```bash
cd backend && git add -A && git commit -m "chore(migration): phase-0 data run verified; attention rows reviewed"
```

---

## Self-Review (done during planning)

- **Spec coverage:** §4 schema → Task 3 models; §5 ETL → Tasks 4–6; unified drinks + Upcykle dedup → Task 5 steps 2–6; parsers for abv/price/nutrition/weight/timing/origin → Task 2; verification + attention → Task 6; Alembic → Task 3; dep/manifest fix (audit MEDIUM-1) → Task 1. Backend cleanup (seed/secrets/CRUD factory) and frontend are **Phase 1** (separate plan) — intentionally out of scope here.
- **Placeholder scan:** none — every code step has runnable code; test cases use real prod values.
- **Type consistency:** parser signatures in Task 2 interfaces match calls in `load.py` (Task 5) and `verify.py` (Task 6); model names in Task 3 match usages `m.Drink`, `m.DrinkDetail`, `m.ClassicRelatedDrink`, `m.SpiritEntry`, `m.KitchenDish`, `m.LearningProgress`.

## Open items for the executor
- `drinks` count expectation: 24 + 1 + 2 − 1 = **26** (confirm the Upcykle dup is the only cross-subsystem duplicate; if a second surfaces, adjust `expected_drinks` and log it — do not silently pass).
- `glass_label_override`: the single ZC bottle that used it (glass_id NULL) — on merge, capture its label into `subtitle` or add a `glasses` row; decide during Task 5 review (1 row).
