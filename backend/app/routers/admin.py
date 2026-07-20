"""Editor/admin CRUD on the v2 unified content schema.

All writes go through `require_editor` (admin or editor role).
Lookup rows (glasses, badges, spirits, tags, flavors, descriptors) are
auto-created when the editor references a new key/label — keeps the UX
simple without a separate lookup-management screen.

This module starts with Drinks (the CRUD template); Tasks 3–6 append
classics/spirits/kitchen/families endpoints to this same router.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import require_editor
from app.database import get_db
from app import models as m
from app.schemas_admin import DrinkAdminOut, DrinkWriteIn

# migration.parsers are pure functions (no I/O) — safe to import into the app.
from migration.parsers import parse_abv, parse_price

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_editor)])


# ── Lookup helpers (find-or-create) ────────────────────────

def _get_or_create_glass(db: Session, key: str) -> m.Glass:
    key = key.strip()
    obj = db.scalar(select(m.Glass).where(m.Glass.key == key))
    if not obj:
        obj = m.Glass(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_badge(db: Session, key: str) -> m.Badge:
    key = key.strip()
    obj = db.scalar(select(m.Badge).where(m.Badge.key == key))
    if not obj:
        obj = m.Badge(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_spirit(db: Session, key: str) -> m.Spirit:
    key = key.strip()
    obj = db.scalar(select(m.Spirit).where(m.Spirit.key == key))
    if not obj:
        obj = m.Spirit(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_tag(db: Session, key: str) -> m.Tag:
    key = key.strip()
    obj = db.scalar(select(m.Tag).where(m.Tag.key == key))
    if not obj:
        obj = m.Tag(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_flavor(db: Session, label: str) -> m.Flavor:
    label = label.strip()
    obj = db.scalar(select(m.Flavor).where(m.Flavor.label == label))
    if not obj:
        obj = m.Flavor(label=label)
        db.add(obj); db.flush()
    return obj


def _get_or_create_descriptor(db: Session, label: str) -> m.Descriptor:
    label = label.strip()
    obj = db.scalar(select(m.Descriptor).where(m.Descriptor.label == label))
    if not obj:
        obj = m.Descriptor(label=label)
        db.add(obj); db.flush()
    return obj


# ── Drinks ────────────────────────────────────────────────

_DRINK_OPTIONS = (
    selectinload(m.Drink.spirits).selectinload(m.DrinkSpirit.spirit),
    selectinload(m.Drink.flavors).selectinload(m.DrinkFlavor.flavor),
    selectinload(m.Drink.tags).selectinload(m.DrinkTag.tag),
    selectinload(m.Drink.details),
    selectinload(m.Drink.glass),
    selectinload(m.Drink.badge),
)


def _num(x):
    return None if x is None else float(x)


def _to_admin_out(obj: m.Drink) -> DrinkAdminOut:
    return DrinkAdminOut(
        id=obj.id, slug=obj.slug, name=obj.name, img=obj.img, photo=obj.photo,
        subtitle=obj.subtitle,
        abv_raw=obj.abv_raw, abv=_num(obj.abv),
        price_raw=obj.price_raw, price_amount=_num(obj.price_amount),
        price_currency=obj.price_currency, volume_ml=obj.volume_ml,
        glass=obj.glass.key if obj.glass else None,
        badge=obj.badge.key if obj.badge else None,
        sort_order=obj.sort_order,
        is_alcoholic=obj.is_alcoholic, is_zero_culture=obj.is_zero_culture,
        caffeine_level=obj.caffeine_level, is_carbonated=obj.is_carbonated,
        recipe=obj.recipe, garnish=obj.garnish, pitch=obj.pitch,
        about=obj.about, naming=obj.naming, faq=obj.faq,
        spirits=[ds.spirit.key for ds in obj.spirits],
        flavors=[df.flavor.label for df in obj.flavors],
        tags=[dt.tag.key for dt in obj.tags],
        details=[{"label": dd.label, "text": dd.text, "sort_order": dd.sort_order} for dd in obj.details],
    )


def _apply_drink(db: Session, obj: m.Drink, data: DrinkWriteIn) -> None:
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


def _get_drink_or_404(db: Session, slug: str) -> m.Drink:
    obj = db.scalar(select(m.Drink).options(*_DRINK_OPTIONS).where(m.Drink.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Drink not found")
    return obj


@router.get("/drinks", response_model=list[DrinkAdminOut])
def list_drinks(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.Drink).options(*_DRINK_OPTIONS).order_by(m.Drink.sort_order, m.Drink.name)
    ).all()
    return [_to_admin_out(d) for d in rows]


@router.get("/drinks/{slug}", response_model=DrinkAdminOut)
def get_drink(slug: str, db: Session = Depends(get_db)):
    obj = _get_drink_or_404(db, slug)
    return _to_admin_out(obj)


@router.post("/drinks", status_code=status.HTTP_201_CREATED, response_model=DrinkAdminOut)
def create_drink(data: DrinkWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.Drink).where(m.Drink.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Drink with this slug already exists")
    obj = m.Drink(slug=data.slug)
    db.add(obj)
    _apply_drink(db, obj, data)
    db.commit()
    return _to_admin_out(_get_drink_or_404(db, obj.slug))


@router.patch("/drinks/{slug}", response_model=DrinkAdminOut)
def update_drink(slug: str, data: DrinkWriteIn, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.Drink).where(m.Drink.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Drink not found")
    if data.slug != slug and db.scalar(select(m.Drink).where(m.Drink.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New slug already in use")
    obj.slug = data.slug
    _apply_drink(db, obj, data)
    db.commit()
    return _to_admin_out(_get_drink_or_404(db, obj.slug))


@router.delete("/drinks/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drink(slug: str, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.Drink).where(m.Drink.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Drink not found")
    db.query(m.ClassicRelatedDrink).filter(m.ClassicRelatedDrink.drink_id == obj.id).delete(synchronize_session=False)
    db.query(m.LearningProgress).filter(
        m.LearningProgress.kind == "menu", m.LearningProgress.slug == slug
    ).delete(synchronize_session=False)
    db.delete(obj)
    db.commit()
