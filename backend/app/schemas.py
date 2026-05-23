from pydantic import BaseModel, ConfigDict


# ── Auth ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    name: str | None
    role: str


# ── Lookups ──────────────────────────────────────────────

class FilterOut(BaseModel):
    key: str
    label: str

    model_config = ConfigDict(from_attributes=True)


class CategoryOut(BaseModel):
    key: str
    label: str
    kind: str
    sort_order: int
    is_visible: bool

    model_config = ConfigDict(from_attributes=True)


class FamilyOut(BaseModel):
    key: str
    label: str
    sub: str | None
    color: str | None
    logic: str | None
    evolution: str | None
    tip: str | None

    model_config = ConfigDict(from_attributes=True)


class TimelineOut(BaseModel):
    period: str
    description: str
    examples: str | None

    model_config = ConfigDict(from_attributes=True)


# ── Cocktails ────────────────────────────────────────────

class CocktailDetailOut(BaseModel):
    label: str
    text: str


class CocktailBadgeOut(BaseModel):
    key: str
    label: str


class CocktailOut(BaseModel):
    id: str          # slug, matches the old JS `id`
    name: str
    img: str | None
    abv: str | None
    glass: str | None
    glass_tag: str | None
    tagline: str | None
    tags: list[str]
    flavors: list[str]
    details: list[CocktailDetailOut]
    badge: CocktailBadgeOut | None


# ── Classics ─────────────────────────────────────────────

class ClassicOut(BaseModel):
    id: str          # slug
    name: str
    family: str      # family key
    year: int | None
    origin: str | None
    spirits: list[str]
    composition: str | None
    glass: str | None
    glass_tag: str | None
    garnish: str | None
    descriptors: list[str]
    history: str | None
    for_whom: str | None
    related_ours: list[str]   # cocktail slugs


# ── Content bundle (single call returns everything for first page render) ──

class ContentBundleOut(BaseModel):
    categories: list[CategoryOut]
    cocktails: list[CocktailOut]
    classics: list[ClassicOut]
    families: list[FamilyOut]
    cocktail_spirit_filters: list[FilterOut]
    cocktail_glass_filters: list[FilterOut]
    timeline: list[TimelineOut]
