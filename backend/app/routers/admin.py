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
    Badge, Classic, ClassicDescriptor, ClassicRelatedCocktail, ClassicSpirit,
    Cocktail, CocktailDetail, CocktailFlavor, CocktailTag,
    Descriptor, Family, Flavor, Glass, Spirit, Tag, User,
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
