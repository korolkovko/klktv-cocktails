from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Auth ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    name: str | None
    role: str


# ── Team progress (all authenticated users, not admin-only) ──

class TeamMemberOut(BaseModel):
    """Per-staffer learning progress for the team view. `learned` is
    keyed by kind (menu/classics/spirits/kitchen); the frontend divides
    by `TeamOut.totals` to get per-section %. `lastActiveAt` is the most
    recent learned_at (proxy for activity — no login tracking)."""
    username: str
    name: str | None
    role: str
    learned: dict[str, int]
    lastActiveAt: datetime | None = None


class TeamOut(BaseModel):
    totals: dict[str, int]
    members: list[TeamMemberOut]


# ── Content bundle v2 output schemas (kit-shaped) ──────────

class DrinkDetailOut(BaseModel):
    label: str
    text: str


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
    # Free-form story blocks (label+text) migrated from prod cocktail/zero/zc
    # details. Prod stored ALL author-drink prose here, not in the structured
    # columns above — so this is where the "О коктейле"/"Отсылки"/etc. text lives.
    details: list[DrinkDetailOut] = []

    model_config = ConfigDict(from_attributes=False)


class OurAnswer(BaseModel):
    label: str
    menuId: str | None = None

    model_config = ConfigDict(from_attributes=False)


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

    model_config = ConfigDict(from_attributes=False)


class FamilyOut(BaseModel):
    tint: str
    code: str
    title: str
    logic: str | None = None
    evolution: str | None = None
    tip: str | None = None
    total: int = 0

    model_config = ConfigDict(from_attributes=False)


class SpiritEntryOut(BaseModel):
    slug: str
    categorySlug: str
    name: str
    img: str | None = None
    abv: float | None = None
    country: str | None = None
    price: int | None = None
    serving: int | None = None
    flavour: str | None = None
    brand: str | None = None
    brandDetail: str | None = None
    features: str | None = None
    pairings: str | None = None
    fact: str | None = None
    sourceUrl: str | None = None

    model_config = ConfigDict(from_attributes=False)


class SpiritCategoryOut(BaseModel):
    slug: str
    label: str
    isArchived: bool = False

    model_config = ConfigDict(from_attributes=False)


class DishNutritionOut(BaseModel):
    kcal: int | None = None
    protein: float | None = None
    fat: float | None = None
    carb: float | None = None
    kcal100: int | None = None

    model_config = ConfigDict(from_attributes=False)


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

    model_config = ConfigDict(from_attributes=False)


class KitchenCategoryOut(BaseModel):
    slug: str
    label: str

    model_config = ConfigDict(from_attributes=False)


class SectionOut(BaseModel):
    id: str
    label: str
    total: int

    model_config = ConfigDict(from_attributes=False)


class FiltersOut(BaseModel):
    spirits: list[str]
    glasses: list[str]
    classicSpirits: list[str]

    model_config = ConfigDict(from_attributes=False)


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

    model_config = ConfigDict(from_attributes=False)
