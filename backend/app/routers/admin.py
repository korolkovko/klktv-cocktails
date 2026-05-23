"""Editor/admin CRUD for cocktails, classics, families.

All writes go through `require_editor` (admin or editor role).
Lookup rows (tags, flavors, descriptors, glasses, spirits, badges) are
auto-created when the editor uses a new label — keeps the UX simple
without a separate management screen.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth import require_editor
from app.database import get_db
from app.models import (
    Badge, Category, Classic, ClassicDescriptor, ClassicRelatedCocktail, ClassicSpirit,
    Cocktail, CocktailDetail, CocktailFlavor, CocktailTag,
    Descriptor, Family, Flavor, Glass, KitchenCategory, KitchenDish,
    Spirit, Tag, User,
    ZCDrink, ZCDrinkDetail, ZeroCocktail, ZeroCocktailDetail,
)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_editor)])


# ── Input schemas ──────────────────────────────────────────

class CocktailDetailIn(BaseModel):
    label: str
    text: str

    model_config = ConfigDict(extra="ignore")


class CocktailWriteIn(BaseModel):
    slug: str
    name: str
    img: str | None = None
    abv: str | None = None
    glass_key: str | None = None
    glass_label_override: str | None = None
    badge_key: str | None = None
    badge_label: str | None = None
    tagline: str | None = None
    tags: list[str] = []
    flavors: list[str] = []
    details: list[CocktailDetailIn] = []
    sort_order: int = 0


class ClassicWriteIn(BaseModel):
    slug: str
    name: str
    family_key: str
    year: int | None = None
    origin: str | None = None
    spirits: list[str] = []
    composition: str | None = None
    glass_key: str | None = None
    glass_label_override: str | None = None
    garnish: str | None = None
    descriptors: list[str] = []
    history: str | None = None
    for_whom: str | None = None
    related_ours: list[str] = []
    sort_order: int = 0


class KitchenCategoryWriteIn(BaseModel):
    slug: str
    label: str
    sort_order: int = 0


class KitchenDishWriteIn(BaseModel):
    slug: str
    category_slug: str
    name: str
    img: str | None = None
    description: str | None = None
    timing: str | None = None
    weight: str | None = None
    nutrition: str | None = None
    serving: str | None = None
    interesting_facts: str | None = None
    sort_order: int = 0


class ZeroDetailIn(BaseModel):
    label: str
    text: str

    model_config = ConfigDict(extra="ignore")


class ZeroCocktailWriteIn(BaseModel):
    slug: str
    name: str
    img: str | None = None
    price: str | None = None
    abv: str | None = None
    glass_key: str | None = None
    glass_label_override: str | None = None
    tagline: str | None = None
    ingredients_text: str | None = None
    details: list[ZeroDetailIn] = []
    sort_order: int = 0


class ZCDrinkWriteIn(BaseModel):
    slug: str
    name: str
    img: str | None = None
    is_alcoholic: bool = True
    price: str | None = None
    abv: str | None = None
    glass_key: str | None = None
    glass_label_override: str | None = None
    tagline: str | None = None
    caffeine_level: int | None = None    # ignored when is_alcoholic=True
    is_carbonated: bool | None = None    # ignored when is_alcoholic=True
    details: list[ZeroDetailIn] = []
    sort_order: int = 0


class CategoryWriteIn(BaseModel):
    """Admin-editable fields. `key` and `kind` are structural and not
    editable from the UI — they're set when seeding/scaffolding new types."""
    label: str
    sort_order: int = 0
    is_visible: bool = True


class CategoryReorderIn(BaseModel):
    keys: list[str]  # full ordered list of category keys


class FamilyWriteIn(BaseModel):
    key: str
    label: str
    sub: str | None = None
    color: str | None = None
    logic: str | None = None
    evolution: str | None = None
    tip: str | None = None
    sort_order: int = 0


# ── Lookup helpers (find-or-create) ────────────────────────

def _get_or_create_tag(db: Session, key: str) -> Tag:
    key = key.strip()
    if not key:
        raise HTTPException(400, detail="Tag key required")
    obj = db.query(Tag).filter(Tag.key == key).first()
    if not obj:
        obj = Tag(key=key)
        db.add(obj); db.flush()
    return obj


def _get_or_create_flavor(db: Session, label: str) -> Flavor:
    label = label.strip()
    if not label:
        raise HTTPException(400, detail="Flavor label required")
    obj = db.query(Flavor).filter(Flavor.label == label).first()
    if not obj:
        obj = Flavor(label=label)
        db.add(obj); db.flush()
    return obj


def _get_or_create_descriptor(db: Session, label: str) -> Descriptor:
    label = label.strip()
    if not label:
        raise HTTPException(400, detail="Descriptor label required")
    obj = db.query(Descriptor).filter(Descriptor.label == label).first()
    if not obj:
        obj = Descriptor(label=label)
        db.add(obj); db.flush()
    return obj


def _get_or_create_glass(db: Session, key: str, label: str | None = None) -> Glass | None:
    if not key: return None
    key = key.strip()
    obj = db.query(Glass).filter(Glass.key == key).first()
    if not obj:
        obj = Glass(key=key, label=label or key.title())
        db.add(obj); db.flush()
    elif label and obj.label != label:
        obj.label = label
    return obj


def _get_or_create_badge(db: Session, key: str | None, label: str | None) -> Badge | None:
    if not key: return None
    obj = db.query(Badge).filter(Badge.key == key).first()
    if not obj:
        obj = Badge(key=key, label=label or key.title())
        db.add(obj); db.flush()
    elif label and obj.label != label:
        obj.label = label
    return obj


def _get_spirit(db: Session, key: str) -> Spirit | None:
    return db.query(Spirit).filter(Spirit.key == key.strip()).first()


def _get_or_create_spirit(db: Session, key: str) -> Spirit:
    key = key.strip()
    obj = _get_spirit(db, key)
    if not obj:
        obj = Spirit(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_family(db: Session, key: str) -> Family:
    obj = db.query(Family).filter(Family.key == key.strip()).first()
    if not obj:
        raise HTTPException(400, detail=f"Family {key!r} not found — create it first")
    return obj


# ── Cocktails ─────────────────────────────────────────────

def _apply_cocktail(db: Session, obj: Cocktail, data: CocktailWriteIn) -> None:
    glass = _get_or_create_glass(db, data.glass_key, data.glass_label_override) if data.glass_key else None
    badge = _get_or_create_badge(db, data.badge_key, data.badge_label) if data.badge_key else None

    obj.name = data.name
    obj.img = data.img
    obj.abv = data.abv
    obj.tagline = data.tagline
    obj.glass_id = glass.id if glass else None
    obj.glass_label_override = data.glass_label_override if not glass else None
    obj.badge_id = badge.id if badge else None
    obj.sort_order = data.sort_order

    if obj.id is None:
        db.flush()  # need PK before junctions

    # Replace tags/flavors/details wholesale (rare op, small data, simplest)
    db.query(CocktailTag).filter(CocktailTag.cocktail_id == obj.id).delete()
    for i, key in enumerate(data.tags):
        tag = _get_or_create_tag(db, key)
        db.add(CocktailTag(cocktail_id=obj.id, tag_id=tag.id, sort_order=i))

    db.query(CocktailFlavor).filter(CocktailFlavor.cocktail_id == obj.id).delete()
    for i, label in enumerate(data.flavors):
        flavor = _get_or_create_flavor(db, label)
        db.add(CocktailFlavor(cocktail_id=obj.id, flavor_id=flavor.id, sort_order=i))

    db.query(CocktailDetail).filter(CocktailDetail.cocktail_id == obj.id).delete()
    for i, d in enumerate(data.details):
        db.add(CocktailDetail(cocktail_id=obj.id, label=d.label, text=d.text, sort_order=i))


@router.post("/cocktails", status_code=status.HTTP_201_CREATED)
def create_cocktail(data: CocktailWriteIn, db: Session = Depends(get_db)):
    if db.query(Cocktail).filter(Cocktail.slug == data.slug).first():
        raise HTTPException(409, detail="Cocktail with this slug already exists")
    obj = Cocktail(slug=data.slug)
    db.add(obj)
    _apply_cocktail(db, obj, data)
    db.commit()
    return {"slug": obj.slug}


@router.patch("/cocktails/{slug}")
def update_cocktail(slug: str, data: CocktailWriteIn, db: Session = Depends(get_db)):
    obj = db.query(Cocktail).filter(Cocktail.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Cocktail not found")
    if data.slug != slug:
        # Slug change: ensure new slug isn't taken
        if db.query(Cocktail).filter(Cocktail.slug == data.slug).first():
            raise HTTPException(409, detail="New slug already in use")
        obj.slug = data.slug
    _apply_cocktail(db, obj, data)
    db.commit()
    return {"slug": obj.slug}


@router.delete("/cocktails/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cocktail(slug: str, db: Session = Depends(get_db)):
    obj = db.query(Cocktail).filter(Cocktail.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Cocktail not found")
    db.delete(obj)
    db.commit()


# ── Classics ──────────────────────────────────────────────

def _apply_classic(db: Session, obj: Classic, data: ClassicWriteIn) -> None:
    family = _get_family(db, data.family_key)
    glass = _get_or_create_glass(db, data.glass_key, data.glass_label_override) if data.glass_key else None

    obj.name = data.name
    obj.family_id = family.id
    obj.year = data.year
    obj.origin = data.origin
    obj.composition = data.composition
    obj.glass_id = glass.id if glass else None
    obj.glass_label_override = data.glass_label_override if not glass else None
    obj.garnish = data.garnish
    obj.history = data.history
    obj.for_whom = data.for_whom
    obj.sort_order = data.sort_order

    if obj.id is None:
        db.flush()

    db.query(ClassicSpirit).filter(ClassicSpirit.classic_id == obj.id).delete()
    for i, key in enumerate(data.spirits):
        spirit = _get_or_create_spirit(db, key)
        db.add(ClassicSpirit(classic_id=obj.id, spirit_id=spirit.id, sort_order=i))

    db.query(ClassicDescriptor).filter(ClassicDescriptor.classic_id == obj.id).delete()
    for i, label in enumerate(data.descriptors):
        desc = _get_or_create_descriptor(db, label)
        db.add(ClassicDescriptor(classic_id=obj.id, descriptor_id=desc.id, sort_order=i))

    db.query(ClassicRelatedCocktail).filter(ClassicRelatedCocktail.classic_id == obj.id).delete()
    for i, slug in enumerate(data.related_ours):
        related = db.query(Cocktail).filter(Cocktail.slug == slug).first()
        if related:
            db.add(ClassicRelatedCocktail(classic_id=obj.id, cocktail_id=related.id, sort_order=i))


@router.post("/classics", status_code=status.HTTP_201_CREATED)
def create_classic(data: ClassicWriteIn, db: Session = Depends(get_db)):
    if db.query(Classic).filter(Classic.slug == data.slug).first():
        raise HTTPException(409, detail="Classic with this slug already exists")
    obj = Classic(slug=data.slug)
    db.add(obj)
    _apply_classic(db, obj, data)
    db.commit()
    return {"slug": obj.slug}


@router.patch("/classics/{slug}")
def update_classic(slug: str, data: ClassicWriteIn, db: Session = Depends(get_db)):
    obj = db.query(Classic).filter(Classic.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Classic not found")
    if data.slug != slug:
        if db.query(Classic).filter(Classic.slug == data.slug).first():
            raise HTTPException(409, detail="New slug already in use")
        obj.slug = data.slug
    _apply_classic(db, obj, data)
    db.commit()
    return {"slug": obj.slug}


@router.delete("/classics/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classic(slug: str, db: Session = Depends(get_db)):
    obj = db.query(Classic).filter(Classic.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Classic not found")
    db.delete(obj)
    db.commit()


# ── Families ──────────────────────────────────────────────

@router.post("/families", status_code=status.HTTP_201_CREATED)
def create_family(data: FamilyWriteIn, db: Session = Depends(get_db)):
    if db.query(Family).filter(Family.key == data.key).first():
        raise HTTPException(409, detail="Family with this key already exists")
    obj = Family(
        key=data.key, label=data.label, sub=data.sub, color=data.color,
        logic=data.logic, evolution=data.evolution, tip=data.tip,
        sort_order=data.sort_order,
    )
    db.add(obj); db.commit()
    return {"key": obj.key}


@router.patch("/families/{key}")
def update_family(key: str, data: FamilyWriteIn, db: Session = Depends(get_db)):
    obj = db.query(Family).filter(Family.key == key).first()
    if not obj:
        raise HTTPException(404, detail="Family not found")
    if data.key != key and db.query(Family).filter(Family.key == data.key).first():
        raise HTTPException(409, detail="New key already in use")
    obj.key = data.key; obj.label = data.label; obj.sub = data.sub
    obj.color = data.color; obj.logic = data.logic
    obj.evolution = data.evolution; obj.tip = data.tip
    obj.sort_order = data.sort_order
    db.commit()
    return {"key": obj.key}


@router.delete("/families/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family(key: str, db: Session = Depends(get_db)):
    obj = db.query(Family).filter(Family.key == key).first()
    if not obj:
        raise HTTPException(404, detail="Family not found")
    if db.query(Classic).filter(Classic.family_id == obj.id).first():
        raise HTTPException(409, detail="Family has classics — reassign them first")
    db.delete(obj)
    db.commit()


# ── Categories ────────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    """Admin view: ALL categories (including invisible ones)."""
    rows = db.query(Category).order_by(Category.sort_order, Category.id).all()
    return [
        {"key": r.key, "label": r.label, "kind": r.kind,
         "sort_order": r.sort_order, "is_visible": r.is_visible}
        for r in rows
    ]


@router.patch("/categories/{key}")
def update_category(key: str, data: CategoryWriteIn, db: Session = Depends(get_db)):
    obj = db.query(Category).filter(Category.key == key).first()
    if not obj:
        raise HTTPException(404, detail="Category not found")
    obj.label = data.label
    obj.sort_order = data.sort_order
    obj.is_visible = data.is_visible
    db.commit()
    return {"key": obj.key}


@router.post("/categories/reorder")
def reorder_categories(data: CategoryReorderIn, db: Session = Depends(get_db)):
    """Set sort_order from the position of each key in the provided list.
    Unknown keys are skipped. Missing keys keep their old sort_order."""
    for i, key in enumerate(data.keys):
        obj = db.query(Category).filter(Category.key == key).first()
        if obj:
            obj.sort_order = i
    db.commit()
    return {"count": len(data.keys)}


# ── Zero cocktails (non-alc) ──────────────────────────────

def _apply_zero(db: Session, obj: ZeroCocktail, data: ZeroCocktailWriteIn) -> None:
    glass = _get_or_create_glass(db, data.glass_key, data.glass_label_override) if data.glass_key else None
    obj.name = data.name
    obj.img = data.img
    obj.price = data.price
    obj.abv = data.abv
    obj.glass_id = glass.id if glass else None
    obj.glass_label_override = data.glass_label_override if not glass else None
    obj.tagline = data.tagline
    obj.ingredients_text = data.ingredients_text
    obj.sort_order = data.sort_order
    if obj.id is None:
        db.flush()
    db.query(ZeroCocktailDetail).filter(ZeroCocktailDetail.parent_id == obj.id).delete()
    for i, d in enumerate(data.details):
        db.add(ZeroCocktailDetail(parent_id=obj.id, label=d.label, text=d.text, sort_order=i))


@router.post("/zero-cocktails", status_code=status.HTTP_201_CREATED)
def create_zero(data: ZeroCocktailWriteIn, db: Session = Depends(get_db)):
    if db.query(ZeroCocktail).filter(ZeroCocktail.slug == data.slug).first():
        raise HTTPException(409, detail="Zero cocktail with this slug already exists")
    obj = ZeroCocktail(slug=data.slug); db.add(obj)
    _apply_zero(db, obj, data); db.commit()
    return {"slug": obj.slug}


@router.patch("/zero-cocktails/{slug}")
def update_zero(slug: str, data: ZeroCocktailWriteIn, db: Session = Depends(get_db)):
    obj = db.query(ZeroCocktail).filter(ZeroCocktail.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Zero cocktail not found")
    if data.slug != slug and db.query(ZeroCocktail).filter(ZeroCocktail.slug == data.slug).first():
        raise HTTPException(409, detail="New slug already in use")
    obj.slug = data.slug
    _apply_zero(db, obj, data); db.commit()
    return {"slug": obj.slug}


@router.delete("/zero-cocktails/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zero(slug: str, db: Session = Depends(get_db)):
    obj = db.query(ZeroCocktail).filter(ZeroCocktail.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Zero cocktail not found")
    db.delete(obj); db.commit()


# ── Zero Culture drinks ──────────────────────────────────

def _apply_zc(db: Session, obj: ZCDrink, data: ZCDrinkWriteIn) -> None:
    glass = _get_or_create_glass(db, data.glass_key, data.glass_label_override) if data.glass_key else None
    obj.name = data.name
    obj.img = data.img
    obj.is_alcoholic = data.is_alcoholic
    obj.price = data.price
    obj.abv = data.abv
    obj.glass_id = glass.id if glass else None
    obj.glass_label_override = data.glass_label_override if not glass else None
    obj.tagline = data.tagline
    obj.caffeine_level = data.caffeine_level if not data.is_alcoholic else None
    obj.is_carbonated = data.is_carbonated if not data.is_alcoholic else None
    obj.sort_order = data.sort_order
    if obj.id is None:
        db.flush()
    db.query(ZCDrinkDetail).filter(ZCDrinkDetail.parent_id == obj.id).delete()
    for i, d in enumerate(data.details):
        db.add(ZCDrinkDetail(parent_id=obj.id, label=d.label, text=d.text, sort_order=i))


@router.post("/zc-drinks", status_code=status.HTTP_201_CREATED)
def create_zc(data: ZCDrinkWriteIn, db: Session = Depends(get_db)):
    if db.query(ZCDrink).filter(ZCDrink.slug == data.slug).first():
        raise HTTPException(409, detail="ZC drink with this slug already exists")
    obj = ZCDrink(slug=data.slug); db.add(obj)
    _apply_zc(db, obj, data); db.commit()
    return {"slug": obj.slug}


@router.patch("/zc-drinks/{slug}")
def update_zc(slug: str, data: ZCDrinkWriteIn, db: Session = Depends(get_db)):
    obj = db.query(ZCDrink).filter(ZCDrink.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="ZC drink not found")
    if data.slug != slug and db.query(ZCDrink).filter(ZCDrink.slug == data.slug).first():
        raise HTTPException(409, detail="New slug already in use")
    obj.slug = data.slug
    _apply_zc(db, obj, data); db.commit()
    return {"slug": obj.slug}


@router.delete("/zc-drinks/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zc(slug: str, db: Session = Depends(get_db)):
    obj = db.query(ZCDrink).filter(ZCDrink.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="ZC drink not found")
    db.delete(obj); db.commit()


# ── Kitchen ───────────────────────────────────────────────

def _resolve_kitchen_cat(db: Session, slug: str) -> KitchenCategory:
    obj = db.query(KitchenCategory).filter(KitchenCategory.slug == slug).first()
    if not obj:
        raise HTTPException(400, detail=f"Kitchen category {slug!r} not found")
    return obj


@router.post("/kitchen-categories", status_code=status.HTTP_201_CREATED)
def create_kitchen_cat(data: KitchenCategoryWriteIn, db: Session = Depends(get_db)):
    if db.query(KitchenCategory).filter(KitchenCategory.slug == data.slug).first():
        raise HTTPException(409, detail="Kitchen category with this slug already exists")
    obj = KitchenCategory(slug=data.slug, label=data.label, sort_order=data.sort_order)
    db.add(obj); db.commit()
    return {"slug": obj.slug}


@router.patch("/kitchen-categories/{slug}")
def update_kitchen_cat(slug: str, data: KitchenCategoryWriteIn, db: Session = Depends(get_db)):
    obj = _resolve_kitchen_cat(db, slug)
    if data.slug != slug and db.query(KitchenCategory).filter(KitchenCategory.slug == data.slug).first():
        raise HTTPException(409, detail="New slug already in use")
    obj.slug = data.slug; obj.label = data.label; obj.sort_order = data.sort_order
    db.commit()
    return {"slug": obj.slug}


@router.delete("/kitchen-categories/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_kitchen_cat(slug: str, db: Session = Depends(get_db)):
    obj = _resolve_kitchen_cat(db, slug)
    if db.query(KitchenDish).filter(KitchenDish.category_id == obj.id).first():
        raise HTTPException(409, detail="Category has dishes — reassign them first")
    db.delete(obj); db.commit()


def _apply_dish(db: Session, obj: KitchenDish, data: KitchenDishWriteIn) -> None:
    cat = _resolve_kitchen_cat(db, data.category_slug)
    obj.name = data.name; obj.img = data.img; obj.description = data.description
    obj.timing = data.timing; obj.weight = data.weight
    obj.nutrition = data.nutrition; obj.serving = data.serving
    obj.interesting_facts = data.interesting_facts
    obj.category_id = cat.id; obj.sort_order = data.sort_order
    if obj.id is None:
        db.flush()


@router.post("/kitchen-dishes", status_code=status.HTTP_201_CREATED)
def create_dish(data: KitchenDishWriteIn, db: Session = Depends(get_db)):
    if db.query(KitchenDish).filter(KitchenDish.slug == data.slug).first():
        raise HTTPException(409, detail="Dish with this slug already exists")
    obj = KitchenDish(slug=data.slug); db.add(obj)
    _apply_dish(db, obj, data); db.commit()
    return {"slug": obj.slug}


@router.patch("/kitchen-dishes/{slug}")
def update_dish(slug: str, data: KitchenDishWriteIn, db: Session = Depends(get_db)):
    obj = db.query(KitchenDish).filter(KitchenDish.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Dish not found")
    if data.slug != slug and db.query(KitchenDish).filter(KitchenDish.slug == data.slug).first():
        raise HTTPException(409, detail="New slug already in use")
    obj.slug = data.slug
    _apply_dish(db, obj, data); db.commit()
    return {"slug": obj.slug}


@router.delete("/kitchen-dishes/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dish(slug: str, db: Session = Depends(get_db)):
    obj = db.query(KitchenDish).filter(KitchenDish.slug == slug).first()
    if not obj:
        raise HTTPException(404, detail="Dish not found")
    db.delete(obj); db.commit()
