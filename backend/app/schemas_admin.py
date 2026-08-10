"""Admin (editor-only) request/response shapes. Kept separate from the
consumer `app/schemas.py` — admin shapes edit raw/typed pairs (e.g.
`abv_raw` + parsed `abv`) and lookup keys/labels that the read-only
`/api/content` bundle doesn't need to expose.
"""
from pydantic import BaseModel, Field


# ── Dictionaries (glasses / badges / ice types) ───────────────
# Flat key/label/sort_order lookups, each with its own admin CRUD screen
# (unlike spirits/flavors/tags/descriptors, which stay get-or-create-only
# off the drink/classic write path). `key` is optional on write — the
# server derives it from `label` via `_slugify` when omitted (see
# app/routers/admin.py's `_register_lookup_routes`).

class LookupWriteIn(BaseModel):
    key: str | None = Field(default=None, max_length=32)
    label: str = Field(max_length=64)
    sort_order: int = 0


class LookupAdminOut(LookupWriteIn):
    id: int
    key: str = Field(max_length=32)


# ── Drink categories ─────────────────────────────────────────

class DrinkCategoryWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    label: str = Field(max_length=128)
    sort_order: int = 0


class DrinkCategoryAdminOut(DrinkCategoryWriteIn):
    id: int


# ── Drinks ───────────────────────────────────────────────────

class DrinkDetailIn(BaseModel):
    label: str
    text: str
    sort_order: int = 0


class DrinkWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    category: str                   # drink-category slug (must exist; not get-or-created)
    name: str = Field(max_length=128)
    img: str | None = Field(default=None, max_length=256)
    photos: list[str] = []          # ordered photo urls (see DrinkPhoto); [0] is primary
    subtitle: str | None = None     # drinks.subtitle is Text — unbounded, no cap
    abv_raw: str | None = Field(default=None, max_length=32)
    price_raw: str | None = Field(default=None, max_length=64)
    price_currency: str = Field(default="₽", max_length=8)
    volume_ml: int | None = None
    glass: str | None = Field(default=None, max_length=32)   # glass key (get-or-create)
    badge: str | None = Field(default=None, max_length=32)   # badge key (get-or-create)
    ice: str | None = Field(default=None, max_length=32)     # ice-type key (strict — must exist)
    sort_order: int = 0
    is_alcoholic: bool = True
    is_zero_culture: bool = False
    is_hot: bool = False
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
    is_archived: bool = False


class DrinkAdminOut(DrinkWriteIn):
    id: int
    abv: float | None = None        # parsed
    price_amount: float | None = None
    photo: str | None = None        # primary = photos[0] if any; kept for list/card thumbnail


# ── Classics ─────────────────────────────────────────────────

class ClassicWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    name: str = Field(max_length=128)
    family: str                     # family key (must exist; not get-or-created)
    year: int | None = None
    origin: str | None = Field(default=None, max_length=128)
    composition: str | None = None  # classics.composition is Text — unbounded, no cap
    glass: str | None = Field(default=None, max_length=32)   # glass key (get-or-create)
    garnish: str | None = None      # classics.garnish is Text — unbounded, no cap
    history: str | None = None      # classics.history is Text — unbounded, no cap
    for_whom: str | None = None     # classics.for_whom is Text — unbounded, no cap
    sort_order: int = 0
    spirits: list[str] = []         # spirit keys
    descriptors: list[str] = []     # descriptor labels
    related_drinks: list[str] = []  # drink slugs (unknown ones are skipped)
    is_archived: bool = False


class ClassicAdminOut(ClassicWriteIn):
    id: int


# ── Spirits ──────────────────────────────────────────────────

class SpiritCategoryWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    label: str = Field(max_length=128)
    sort_order: int = 0
    is_archived: bool = False


class SpiritCategoryAdminOut(SpiritCategoryWriteIn):
    id: int


class SpiritEntryWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    category: str                   # spirit-category slug (must exist; not get-or-created)
    name: str = Field(max_length=256)
    img: str | None = Field(default=None, max_length=256)
    abv_raw: str | None = Field(default=None, max_length=32)
    price_raw: str | None = Field(default=None, max_length=64)
    flavour: str | None = None       # spirit_entries.flavour is Text — unbounded, no cap
    brand: str | None = None         # Text
    country: str | None = None       # Text
    description: str | None = None   # Text
    features: str | None = None      # Text
    cocktail_pairings: str | None = None  # Text
    fact: str | None = None          # Text
    source_url: str | None = None    # Text
    sort_order: int = 0
    is_archived: bool = False


class SpiritEntryAdminOut(SpiritEntryWriteIn):
    id: int
    abv: float | None = None         # parsed
    price_amount: float | None = None
    serving_ml: int | None = None


# ── Kitchen ──────────────────────────────────────────────────

class KitchenCategoryWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    label: str = Field(max_length=128)
    sort_order: int = 0


class KitchenCategoryAdminOut(KitchenCategoryWriteIn):
    id: int


class KitchenDishWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    category: str                    # kitchen-category slug (must exist; not get-or-created)
    name: str = Field(max_length=256)
    img: str | None = Field(default=None, max_length=256)
    price_raw: str | None = Field(default=None, max_length=32)
    tagline: str | None = None       # kitchen_dishes.tagline is Text — unbounded, no cap
    description: str | None = None   # Text
    timing_raw: str | None = Field(default=None, max_length=32)
    weight_raw: str | None = Field(default=None, max_length=64)
    nutrition_raw: str | None = None  # Text
    # Direct numeric overrides — when provided (non-None), win over the
    # values parsed from `nutrition_raw` (see `_apply_kitchen_dish`).
    kcal_portion: float | None = None
    protein_g: float | None = None
    fat_g: float | None = None
    carb_g: float | None = None
    kcal_100g: float | None = None
    serving: str | None = None       # Text
    interesting_facts: str | None = None  # Text
    sort_order: int = 0
    is_archived: bool = False


class KitchenDishAdminOut(KitchenDishWriteIn):
    id: int
    price_amount: float | None = None
    timing_min_low: int | None = None
    timing_min_high: int | None = None
    weight_g: int | None = None


# ── Families ─────────────────────────────────────────────────

class FamilyWriteIn(BaseModel):
    key: str = Field(min_length=1, max_length=32)
    label: str = Field(max_length=64)
    sub: str | None = Field(default=None, max_length=128)
    color: str | None = Field(default=None, max_length=16)
    logic: str | None = None       # families.logic is Text — unbounded, no cap
    evolution: str | None = None   # Text
    tip: str | None = None         # Text
    sort_order: int = 0


class FamilyAdminOut(FamilyWriteIn):
    id: int


# ── Categories / sections ─────────────────────────────────────
# Fixed set (seeded via migration) — no create/delete here, just
# relabel/show-hide/reorder from the admin "Разделы" tab.

class CategoryAdminOut(BaseModel):
    id: int
    key: str
    label: str
    kind: str
    sort_order: int
    is_visible: bool


class CategoryPatchIn(BaseModel):
    label: str | None = Field(default=None, max_length=64)
    is_visible: bool | None = None
    sort_order: int | None = None


class CategoryReorderIn(BaseModel):
    keys: list[str]
