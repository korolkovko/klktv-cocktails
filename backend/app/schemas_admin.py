"""Admin (editor-only) request/response shapes. Kept separate from the
consumer `app/schemas.py` — admin shapes edit raw/typed pairs (e.g.
`abv_raw` + parsed `abv`) and lookup keys/labels that the read-only
`/api/content` bundle doesn't need to expose.
"""
from pydantic import BaseModel, Field


# ── Drinks ───────────────────────────────────────────────────

class DrinkDetailIn(BaseModel):
    label: str
    text: str
    sort_order: int = 0


class DrinkWriteIn(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    name: str = Field(max_length=128)
    img: str | None = Field(default=None, max_length=256)
    photo: str | None = Field(default=None, max_length=256)
    subtitle: str | None = None     # drinks.subtitle is Text — unbounded, no cap
    abv_raw: str | None = Field(default=None, max_length=32)
    price_raw: str | None = Field(default=None, max_length=64)
    price_currency: str = Field(default="₽", max_length=8)
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
