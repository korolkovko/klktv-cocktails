"""Editor/admin CRUD on the v2 unified content schema.

All writes go through `require_editor` (admin or editor role).
Lookup rows (glasses, badges, spirits, tags, flavors, descriptors) are
auto-created when the editor references a new key/label — keeps the UX
simple without a separate lookup-management screen.

This module starts with Drinks (the CRUD template); Tasks 3–6 append
classics/spirits/kitchen/families endpoints to this same router.
"""
import hashlib
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.auth import require_editor
from app.database import get_db
from app import models as m
from app.schemas_admin import (
    DrinkAdminOut, DrinkWriteIn, ClassicAdminOut, ClassicWriteIn,
    SpiritCategoryAdminOut, SpiritCategoryWriteIn, SpiritEntryAdminOut, SpiritEntryWriteIn,
    KitchenCategoryAdminOut, KitchenCategoryWriteIn, KitchenDishAdminOut, KitchenDishWriteIn,
    FamilyAdminOut, FamilyWriteIn,
    CategoryAdminOut, CategoryPatchIn, CategoryReorderIn,
    LookupAdminOut, LookupWriteIn,
)

# migration.parsers are pure functions (no I/O) — safe to import into the app.
from migration.parsers import parse_abv, parse_price, parse_timing, parse_weight_g, parse_nutrition

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_editor)])


# ── Lookup helpers (find-or-create) ────────────────────────

def _get_or_create_glass(db: Session, key: str) -> m.Glass:
    key = key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Glass key must not be blank")
    obj = db.scalar(select(m.Glass).where(m.Glass.key == key))
    if not obj:
        obj = m.Glass(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_badge(db: Session, key: str) -> m.Badge:
    key = key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Badge key must not be blank")
    obj = db.scalar(select(m.Badge).where(m.Badge.key == key))
    if not obj:
        obj = m.Badge(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_spirit(db: Session, key: str) -> m.Spirit:
    key = key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Spirit key must not be blank")
    obj = db.scalar(select(m.Spirit).where(m.Spirit.key == key))
    if not obj:
        obj = m.Spirit(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_tag(db: Session, key: str) -> m.Tag:
    key = key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Tag key must not be blank")
    obj = db.scalar(select(m.Tag).where(m.Tag.key == key))
    if not obj:
        obj = m.Tag(key=key, label=key.title())
        db.add(obj); db.flush()
    return obj


def _get_or_create_flavor(db: Session, label: str) -> m.Flavor:
    label = label.strip()
    if not label:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Flavor label must not be blank")
    obj = db.scalar(select(m.Flavor).where(m.Flavor.label == label))
    if not obj:
        obj = m.Flavor(label=label)
        db.add(obj); db.flush()
    return obj


def _get_or_create_descriptor(db: Session, label: str) -> m.Descriptor:
    label = label.strip()
    if not label:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Descriptor label must not be blank")
    obj = db.scalar(select(m.Descriptor).where(m.Descriptor.label == label))
    if not obj:
        obj = m.Descriptor(label=label)
        db.add(obj); db.flush()
    return obj


def _get_family_or_400(db: Session, key: str) -> m.Family:
    # Families are managed by their own editor screen — not get-or-created
    # here, unlike glasses/spirits/tags/flavors/descriptors above.
    key = key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Family key must not be blank")
    obj = db.scalar(select(m.Family).where(m.Family.key == key))
    if not obj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown family: {key}")
    return obj


def _get_ice_or_400(db: Session, key: str) -> m.IceType:
    # Unlike glass/badge, ice is a *strict* reference on the drink write
    # path (not get-or-create) — editors pick from the ice-types dictionary
    # (managed below) rather than free-typing a new one from the drink form.
    key = key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Ice type key must not be blank")
    obj = db.scalar(select(m.IceType).where(m.IceType.key == key))
    if not obj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown ice type: {key}")
    return obj


# ── Dictionaries (glasses / badges / ice types) ────────────
# Flat key/label/sort_order lookups, each with its own admin CRUD screen —
# unlike the get-or-create-only lookups above (spirits/tags/flavors/
# descriptors), these get real list/create/rename/delete endpoints so the
# editor can curate a fixed vocabulary. `key` is optional on write; the
# server derives it from `label` when omitted.

_CYRILLIC_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
    "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def _slugify(label: str) -> str:
    """Derive a short, DB-safe key from a label: lowercase, transliterate
    Cyrillic letter-by-letter to Latin, then collapse anything outside
    [a-z0-9] to single hyphens. Falls back to a short deterministic hash
    suffix when that leaves nothing (e.g. an all-emoji/punctuation label)
    — a lookup `key` must never end up blank. Truncated to fit the `key`
    column (String(32)); a resulting collision with an existing key is
    still handled by the normal 409-on-duplicate check, same as any other
    slug/key field in this router."""
    s = "".join(_CYRILLIC_TRANSLIT.get(ch, ch) for ch in label.strip().lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if not s:
        s = "x" + hashlib.sha1(label.encode("utf-8")).hexdigest()[:8]
    return s[:32]


# (model, url path segment, human name for error messages, drink FK column)
_LOOKUP_DICTIONARIES = (
    (m.Glass, "glasses", "Glass", m.Drink.glass_id),
    (m.Badge, "badges", "Badge", m.Drink.badge_id),
    (m.IceType, "ice-types", "Ice type", m.Drink.ice_id),
)


def _register_lookup_routes(model, path: str, name: str, drink_fk_col) -> None:
    def _to_out(obj) -> LookupAdminOut:
        return LookupAdminOut(id=obj.id, key=obj.key, label=obj.label, sort_order=obj.sort_order)

    def _get_or_404(db: Session, key: str):
        obj = db.scalar(select(model).where(model.key == key))
        if not obj:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{name} not found")
        return obj

    def _resolve_key(db: Session, data: LookupWriteIn, *, current: str | None = None) -> str:
        key = (data.key or _slugify(data.label)).strip()
        if not key:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{name} key must not be blank")
        if key != current and db.scalar(select(model).where(model.key == key)):
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"{name} with this key already exists")
        return key

    @router.get(f"/{path}", response_model=list[LookupAdminOut], name=f"list_{path}")
    def _list(db: Session = Depends(get_db)):
        rows = db.scalars(select(model).order_by(model.sort_order, model.label)).all()
        return [_to_out(r) for r in rows]

    @router.get(f"/{path}/{{key}}", response_model=LookupAdminOut, name=f"get_{path}")
    def _get(key: str, db: Session = Depends(get_db)):
        return _to_out(_get_or_404(db, key))

    @router.post(f"/{path}", status_code=status.HTTP_201_CREATED, response_model=LookupAdminOut, name=f"create_{path}")
    def _create(data: LookupWriteIn, db: Session = Depends(get_db)):
        key = _resolve_key(db, data)
        obj = model(key=key, label=data.label, sort_order=data.sort_order)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return _to_out(obj)

    @router.patch(f"/{path}/{{key}}", response_model=LookupAdminOut, name=f"update_{path}")
    def _update(key: str, data: LookupWriteIn, db: Session = Depends(get_db)):
        obj = _get_or_404(db, key)
        obj.key = _resolve_key(db, data, current=key)
        obj.label = data.label
        obj.sort_order = data.sort_order
        db.commit()
        db.refresh(obj)
        return _to_out(obj)

    @router.delete(f"/{path}/{{key}}", status_code=status.HTTP_204_NO_CONTENT, name=f"delete_{path}")
    def _delete(key: str, db: Session = Depends(get_db)):
        obj = _get_or_404(db, key)
        in_use = db.scalar(select(func.count()).select_from(m.Drink).where(drink_fk_col == obj.id))
        if in_use:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"{name} '{key}' still used by {in_use} drink{'' if in_use == 1 else 's'} — "
                       f"change or remove them first",
            )
        db.delete(obj)
        db.commit()


for _model, _path, _name, _fk in _LOOKUP_DICTIONARIES:
    _register_lookup_routes(_model, _path, _name, _fk)


# ── Drinks ────────────────────────────────────────────────

_DRINK_OPTIONS = (
    selectinload(m.Drink.spirits).selectinload(m.DrinkSpirit.spirit),
    selectinload(m.Drink.flavors).selectinload(m.DrinkFlavor.flavor),
    selectinload(m.Drink.tags).selectinload(m.DrinkTag.tag),
    selectinload(m.Drink.details),
    selectinload(m.Drink.glass),
    selectinload(m.Drink.badge),
    selectinload(m.Drink.ice),
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
        ice=obj.ice.key if obj.ice else None,
        sort_order=obj.sort_order,
        is_alcoholic=obj.is_alcoholic, is_zero_culture=obj.is_zero_culture,
        is_hot=obj.is_hot,
        caffeine_level=obj.caffeine_level, is_carbonated=obj.is_carbonated,
        recipe=obj.recipe, garnish=obj.garnish, pitch=obj.pitch,
        about=obj.about, naming=obj.naming, faq=obj.faq,
        spirits=[ds.spirit.key for ds in obj.spirits],
        flavors=[df.flavor.label for df in obj.flavors],
        tags=[dt.tag.key for dt in obj.tags],
        details=[{"label": dd.label, "text": dd.text, "sort_order": dd.sort_order} for dd in obj.details],
        is_archived=obj.is_archived,
    )


def _apply_drink(db: Session, obj: m.Drink, data: DrinkWriteIn) -> None:
    abv, _ = parse_abv(data.abv_raw)
    price, _ = parse_price(data.price_raw)
    obj.name = data.name; obj.img = data.img; obj.photo = data.photo
    obj.subtitle = data.subtitle
    obj.abv = abv; obj.abv_raw = data.abv_raw
    obj.price_amount = price; obj.price_raw = data.price_raw; obj.price_currency = data.price_currency
    obj.volume_ml = data.volume_ml; obj.sort_order = data.sort_order
    obj.is_archived = data.is_archived
    obj.is_alcoholic = data.is_alcoholic; obj.is_zero_culture = data.is_zero_culture
    obj.is_hot = data.is_hot
    obj.caffeine_level = data.caffeine_level; obj.is_carbonated = data.is_carbonated
    obj.recipe = data.recipe; obj.garnish = data.garnish; obj.pitch = data.pitch
    obj.about = data.about; obj.naming = data.naming; obj.faq = data.faq
    g = _get_or_create_glass(db, data.glass) if data.glass else None
    obj.glass_id = g.id if g else None
    b = _get_or_create_badge(db, data.badge) if data.badge else None
    obj.badge_id = b.id if b else None
    ice = _get_ice_or_400(db, data.ice) if data.ice else None
    obj.ice_id = ice.id if ice else None
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
    if data.slug != slug:
        db.query(m.LearningProgress).filter_by(kind="menu", slug=slug).update(
            {"slug": data.slug}, synchronize_session=False
        )
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


# ── Classics ──────────────────────────────────────────────

_CLASSIC_OPTIONS = (
    selectinload(m.Classic.family),
    selectinload(m.Classic.glass),
    selectinload(m.Classic.spirits).selectinload(m.ClassicSpirit.spirit),
    selectinload(m.Classic.descriptors).selectinload(m.ClassicDescriptor.descriptor),
    selectinload(m.Classic.related_drinks).selectinload(m.ClassicRelatedDrink.drink),
)


def _to_classic_admin_out(obj: m.Classic) -> ClassicAdminOut:
    return ClassicAdminOut(
        id=obj.id, slug=obj.slug, name=obj.name,
        family=obj.family.key,
        year=obj.year, origin=obj.origin, composition=obj.composition,
        glass=obj.glass.key if obj.glass else None,
        garnish=obj.garnish, history=obj.history, for_whom=obj.for_whom,
        sort_order=obj.sort_order,
        spirits=[cs.spirit.key for cs in obj.spirits],
        descriptors=[cd.descriptor.label for cd in obj.descriptors],
        related_drinks=[cr.drink.slug for cr in obj.related_drinks],
        is_archived=obj.is_archived,
    )


def _apply_classic(db: Session, obj: m.Classic, data: ClassicWriteIn) -> None:
    fam = _get_family_or_400(db, data.family)
    obj.name = data.name; obj.family_id = fam.id
    obj.year = data.year; obj.origin = data.origin; obj.composition = data.composition
    obj.garnish = data.garnish; obj.history = data.history; obj.for_whom = data.for_whom
    obj.sort_order = data.sort_order
    obj.is_archived = data.is_archived
    g = _get_or_create_glass(db, data.glass) if data.glass else None
    obj.glass_id = g.id if g else None
    db.flush()
    # rebuild relations (delete-then-insert), mirroring the ETL
    for tbl in (m.ClassicSpirit, m.ClassicDescriptor, m.ClassicRelatedDrink):
        db.query(tbl).filter(tbl.classic_id == obj.id).delete(synchronize_session=False)
    for i, key in enumerate(data.spirits):
        sp = _get_or_create_spirit(db, key)
        db.add(m.ClassicSpirit(classic_id=obj.id, spirit_id=sp.id, sort_order=i))
    for i, label in enumerate(data.descriptors):
        de = _get_or_create_descriptor(db, label)
        db.add(m.ClassicDescriptor(classic_id=obj.id, descriptor_id=de.id, sort_order=i))
    i = 0
    for slug in data.related_drinks:
        # A classic can reference drinks that don't (yet) exist in this DB —
        # skip unknown slugs silently rather than 400ing the whole write.
        drink = db.scalar(select(m.Drink).where(m.Drink.slug == slug))
        if not drink:
            continue
        db.add(m.ClassicRelatedDrink(classic_id=obj.id, drink_id=drink.id, sort_order=i))
        i += 1


def _get_classic_or_404(db: Session, slug: str) -> m.Classic:
    obj = db.scalar(select(m.Classic).options(*_CLASSIC_OPTIONS).where(m.Classic.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Classic not found")
    return obj


@router.get("/classics", response_model=list[ClassicAdminOut])
def list_classics(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.Classic).options(*_CLASSIC_OPTIONS).order_by(m.Classic.sort_order, m.Classic.name)
    ).all()
    return [_to_classic_admin_out(c) for c in rows]


@router.get("/classics/{slug}", response_model=ClassicAdminOut)
def get_classic(slug: str, db: Session = Depends(get_db)):
    obj = _get_classic_or_404(db, slug)
    return _to_classic_admin_out(obj)


@router.post("/classics", status_code=status.HTTP_201_CREATED, response_model=ClassicAdminOut)
def create_classic(data: ClassicWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.Classic).where(m.Classic.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Classic with this slug already exists")
    obj = m.Classic(slug=data.slug)
    db.add(obj)
    _apply_classic(db, obj, data)
    db.commit()
    return _to_classic_admin_out(_get_classic_or_404(db, obj.slug))


@router.patch("/classics/{slug}", response_model=ClassicAdminOut)
def update_classic(slug: str, data: ClassicWriteIn, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.Classic).where(m.Classic.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Classic not found")
    if data.slug != slug and db.scalar(select(m.Classic).where(m.Classic.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New slug already in use")
    if data.slug != slug:
        db.query(m.LearningProgress).filter_by(kind="classics", slug=slug).update(
            {"slug": data.slug}, synchronize_session=False
        )
    obj.slug = data.slug
    _apply_classic(db, obj, data)
    db.commit()
    return _to_classic_admin_out(_get_classic_or_404(db, obj.slug))


@router.delete("/classics/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classic(slug: str, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.Classic).where(m.Classic.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Classic not found")
    for tbl in (m.ClassicSpirit, m.ClassicDescriptor, m.ClassicRelatedDrink):
        db.query(tbl).filter(tbl.classic_id == obj.id).delete(synchronize_session=False)
    db.query(m.LearningProgress).filter(
        m.LearningProgress.kind == "classics", m.LearningProgress.slug == slug
    ).delete(synchronize_session=False)
    db.delete(obj)
    db.commit()


# ── Spirit categories ─────────────────────────────────────

def _get_spirit_category_or_400(db: Session, slug: str) -> m.SpiritCategory:
    # Spirit categories are managed by their own editor screen — not
    # get-or-created here, mirroring `_get_family_or_400` for classics.
    slug = slug.strip()
    if not slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Spirit category slug must not be blank")
    obj = db.scalar(select(m.SpiritCategory).where(m.SpiritCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown spirit category: {slug}")
    return obj


def _to_spirit_category_admin_out(obj: m.SpiritCategory) -> SpiritCategoryAdminOut:
    return SpiritCategoryAdminOut(
        id=obj.id, slug=obj.slug, label=obj.label,
        sort_order=obj.sort_order, is_archived=obj.is_archived,
    )


def _apply_spirit_category(db: Session, obj: m.SpiritCategory, data: SpiritCategoryWriteIn) -> None:
    obj.label = data.label
    obj.sort_order = data.sort_order
    obj.is_archived = data.is_archived


def _get_spirit_category_or_404(db: Session, slug: str) -> m.SpiritCategory:
    obj = db.scalar(select(m.SpiritCategory).where(m.SpiritCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Spirit category not found")
    return obj


@router.get("/spirit-categories", response_model=list[SpiritCategoryAdminOut])
def list_spirit_categories(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.SpiritCategory).order_by(m.SpiritCategory.sort_order, m.SpiritCategory.label)
    ).all()
    return [_to_spirit_category_admin_out(c) for c in rows]


@router.get("/spirit-categories/{slug}", response_model=SpiritCategoryAdminOut)
def get_spirit_category(slug: str, db: Session = Depends(get_db)):
    obj = _get_spirit_category_or_404(db, slug)
    return _to_spirit_category_admin_out(obj)


@router.post("/spirit-categories", status_code=status.HTTP_201_CREATED, response_model=SpiritCategoryAdminOut)
def create_spirit_category(data: SpiritCategoryWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.SpiritCategory).where(m.SpiritCategory.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Spirit category with this slug already exists")
    obj = m.SpiritCategory(slug=data.slug)
    db.add(obj)
    _apply_spirit_category(db, obj, data)
    db.commit()
    return _to_spirit_category_admin_out(_get_spirit_category_or_404(db, obj.slug))


@router.patch("/spirit-categories/{slug}", response_model=SpiritCategoryAdminOut)
def update_spirit_category(slug: str, data: SpiritCategoryWriteIn, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.SpiritCategory).where(m.SpiritCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Spirit category not found")
    if data.slug != slug and db.scalar(select(m.SpiritCategory).where(m.SpiritCategory.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New slug already in use")
    obj.slug = data.slug
    _apply_spirit_category(db, obj, data)
    db.commit()
    return _to_spirit_category_admin_out(_get_spirit_category_or_404(db, obj.slug))


@router.delete("/spirit-categories/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spirit_category(slug: str, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.SpiritCategory).where(m.SpiritCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Spirit category not found")
    entry_count = db.scalar(
        select(func.count()).select_from(m.SpiritEntry).where(m.SpiritEntry.category_id == obj.id)
    )
    if entry_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Spirit category '{slug}' still has {entry_count} spirit entr"
                   f"{'y' if entry_count == 1 else 'ies'} — move or delete them first",
        )
    db.delete(obj)
    db.commit()


# ── Spirits ───────────────────────────────────────────────

_SPIRIT_OPTIONS = (
    selectinload(m.SpiritEntry.category),
)


def _to_spirit_admin_out(obj: m.SpiritEntry) -> SpiritEntryAdminOut:
    return SpiritEntryAdminOut(
        id=obj.id, slug=obj.slug, category=obj.category.slug,
        name=obj.name, img=obj.img,
        abv_raw=obj.abv_raw, abv=_num(obj.abv),
        price_raw=obj.price_raw, price_amount=_num(obj.price_amount), serving_ml=obj.serving_ml,
        flavour=obj.flavour, brand=obj.brand, country=obj.country, description=obj.description,
        features=obj.features, cocktail_pairings=obj.cocktail_pairings, fact=obj.fact,
        source_url=obj.source_url, sort_order=obj.sort_order,
        is_archived=obj.is_archived,
    )


def _apply_spirit(db: Session, obj: m.SpiritEntry, data: SpiritEntryWriteIn) -> None:
    cat = _get_spirit_category_or_400(db, data.category)
    abv, _ = parse_abv(data.abv_raw)
    price, serving = parse_price(data.price_raw)
    obj.category_id = cat.id
    obj.name = data.name; obj.img = data.img
    obj.abv = abv; obj.abv_raw = data.abv_raw
    obj.price_amount = price; obj.price_raw = data.price_raw; obj.serving_ml = serving
    obj.flavour = data.flavour; obj.brand = data.brand; obj.country = data.country
    obj.description = data.description
    obj.features = data.features; obj.cocktail_pairings = data.cocktail_pairings; obj.fact = data.fact
    obj.source_url = data.source_url; obj.sort_order = data.sort_order
    obj.is_archived = data.is_archived


def _get_spirit_or_404(db: Session, slug: str) -> m.SpiritEntry:
    obj = db.scalar(select(m.SpiritEntry).options(*_SPIRIT_OPTIONS).where(m.SpiritEntry.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Spirit not found")
    return obj


@router.get("/spirits", response_model=list[SpiritEntryAdminOut])
def list_spirits(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.SpiritEntry).options(*_SPIRIT_OPTIONS).order_by(m.SpiritEntry.sort_order, m.SpiritEntry.name)
    ).all()
    return [_to_spirit_admin_out(e) for e in rows]


@router.get("/spirits/{slug}", response_model=SpiritEntryAdminOut)
def get_spirit(slug: str, db: Session = Depends(get_db)):
    obj = _get_spirit_or_404(db, slug)
    return _to_spirit_admin_out(obj)


@router.post("/spirits", status_code=status.HTTP_201_CREATED, response_model=SpiritEntryAdminOut)
def create_spirit(data: SpiritEntryWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.SpiritEntry).where(m.SpiritEntry.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Spirit with this slug already exists")
    obj = m.SpiritEntry(slug=data.slug)
    db.add(obj)
    _apply_spirit(db, obj, data)
    db.commit()
    return _to_spirit_admin_out(_get_spirit_or_404(db, obj.slug))


@router.patch("/spirits/{slug}", response_model=SpiritEntryAdminOut)
def update_spirit(slug: str, data: SpiritEntryWriteIn, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.SpiritEntry).where(m.SpiritEntry.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Spirit not found")
    if data.slug != slug and db.scalar(select(m.SpiritEntry).where(m.SpiritEntry.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New slug already in use")
    if data.slug != slug:
        db.query(m.LearningProgress).filter_by(kind="spirits", slug=slug).update(
            {"slug": data.slug}, synchronize_session=False
        )
    obj.slug = data.slug
    _apply_spirit(db, obj, data)
    db.commit()
    return _to_spirit_admin_out(_get_spirit_or_404(db, obj.slug))


@router.delete("/spirits/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spirit(slug: str, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.SpiritEntry).where(m.SpiritEntry.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Spirit not found")
    db.query(m.LearningProgress).filter(
        m.LearningProgress.kind == "spirits", m.LearningProgress.slug == slug
    ).delete(synchronize_session=False)
    db.delete(obj)
    db.commit()


# ── Kitchen categories ────────────────────────────────────

def _get_kitchen_category_or_400(db: Session, slug: str) -> m.KitchenCategory:
    # Kitchen categories are managed by their own editor screen — not
    # get-or-created here, mirroring `_get_spirit_category_or_400`.
    slug = slug.strip()
    if not slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Kitchen category slug must not be blank")
    obj = db.scalar(select(m.KitchenCategory).where(m.KitchenCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown kitchen category: {slug}")
    return obj


def _to_kitchen_category_admin_out(obj: m.KitchenCategory) -> KitchenCategoryAdminOut:
    return KitchenCategoryAdminOut(
        id=obj.id, slug=obj.slug, label=obj.label, sort_order=obj.sort_order,
    )


def _apply_kitchen_category(db: Session, obj: m.KitchenCategory, data: KitchenCategoryWriteIn) -> None:
    obj.label = data.label
    obj.sort_order = data.sort_order


def _get_kitchen_category_or_404(db: Session, slug: str) -> m.KitchenCategory:
    obj = db.scalar(select(m.KitchenCategory).where(m.KitchenCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kitchen category not found")
    return obj


@router.get("/kitchen-categories", response_model=list[KitchenCategoryAdminOut])
def list_kitchen_categories(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.KitchenCategory).order_by(m.KitchenCategory.sort_order, m.KitchenCategory.label)
    ).all()
    return [_to_kitchen_category_admin_out(c) for c in rows]


@router.get("/kitchen-categories/{slug}", response_model=KitchenCategoryAdminOut)
def get_kitchen_category(slug: str, db: Session = Depends(get_db)):
    obj = _get_kitchen_category_or_404(db, slug)
    return _to_kitchen_category_admin_out(obj)


@router.post("/kitchen-categories", status_code=status.HTTP_201_CREATED, response_model=KitchenCategoryAdminOut)
def create_kitchen_category(data: KitchenCategoryWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.KitchenCategory).where(m.KitchenCategory.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Kitchen category with this slug already exists")
    obj = m.KitchenCategory(slug=data.slug)
    db.add(obj)
    _apply_kitchen_category(db, obj, data)
    db.commit()
    return _to_kitchen_category_admin_out(_get_kitchen_category_or_404(db, obj.slug))


@router.patch("/kitchen-categories/{slug}", response_model=KitchenCategoryAdminOut)
def update_kitchen_category(slug: str, data: KitchenCategoryWriteIn, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.KitchenCategory).where(m.KitchenCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kitchen category not found")
    if data.slug != slug and db.scalar(select(m.KitchenCategory).where(m.KitchenCategory.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New slug already in use")
    obj.slug = data.slug
    _apply_kitchen_category(db, obj, data)
    db.commit()
    return _to_kitchen_category_admin_out(_get_kitchen_category_or_404(db, obj.slug))


@router.delete("/kitchen-categories/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_kitchen_category(slug: str, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.KitchenCategory).where(m.KitchenCategory.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kitchen category not found")
    dish_count = db.scalar(
        select(func.count()).select_from(m.KitchenDish).where(m.KitchenDish.category_id == obj.id)
    )
    if dish_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Kitchen category '{slug}' still has {dish_count} dish"
                   f"{'' if dish_count == 1 else 'es'} — move or delete them first",
        )
    db.delete(obj)
    db.commit()


# ── Kitchen dishes ────────────────────────────────────────

_KITCHEN_DISH_OPTIONS = (
    selectinload(m.KitchenDish.category),
)

_NUTRITION_FIELDS = ("kcal_portion", "protein_g", "fat_g", "carb_g", "kcal_100g")


def _to_kitchen_dish_admin_out(obj: m.KitchenDish) -> KitchenDishAdminOut:
    return KitchenDishAdminOut(
        id=obj.id, slug=obj.slug, category=obj.category.slug,
        name=obj.name, img=obj.img,
        price_raw=obj.price_raw, price_amount=_num(obj.price_amount),
        tagline=obj.tagline, description=obj.description,
        timing_raw=obj.timing_raw, timing_min_low=obj.timing_min_low, timing_min_high=obj.timing_min_high,
        weight_raw=obj.weight_raw, weight_g=obj.weight_g,
        nutrition_raw=obj.nutrition_raw,
        kcal_portion=_num(obj.kcal_portion), protein_g=_num(obj.protein_g),
        fat_g=_num(obj.fat_g), carb_g=_num(obj.carb_g), kcal_100g=_num(obj.kcal_100g),
        serving=obj.serving, interesting_facts=obj.interesting_facts,
        sort_order=obj.sort_order,
        is_archived=obj.is_archived,
    )


def _apply_kitchen_dish(db: Session, obj: m.KitchenDish, data: KitchenDishWriteIn) -> None:
    cat = _get_kitchen_category_or_400(db, data.category)
    price, _ = parse_price(data.price_raw)
    timing_low, timing_high = parse_timing(data.timing_raw)
    weight = parse_weight_g(data.weight_raw)
    nutrition = parse_nutrition(data.nutrition_raw)
    # Direct numeric overrides win over the parsed nutrition values.
    for field in _NUTRITION_FIELDS:
        override = getattr(data, field)
        if override is not None:
            nutrition[field] = override
    obj.category_id = cat.id
    obj.name = data.name; obj.img = data.img
    obj.price_amount = price; obj.price_raw = data.price_raw
    obj.tagline = data.tagline; obj.description = data.description
    obj.timing_min_low = timing_low; obj.timing_min_high = timing_high; obj.timing_raw = data.timing_raw
    obj.weight_g = weight; obj.weight_raw = data.weight_raw
    obj.nutrition_raw = data.nutrition_raw
    obj.kcal_portion = nutrition["kcal_portion"]; obj.protein_g = nutrition["protein_g"]
    obj.fat_g = nutrition["fat_g"]; obj.carb_g = nutrition["carb_g"]; obj.kcal_100g = nutrition["kcal_100g"]
    obj.serving = data.serving; obj.interesting_facts = data.interesting_facts
    obj.sort_order = data.sort_order
    obj.is_archived = data.is_archived


def _get_kitchen_dish_or_404(db: Session, slug: str) -> m.KitchenDish:
    obj = db.scalar(select(m.KitchenDish).options(*_KITCHEN_DISH_OPTIONS).where(m.KitchenDish.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kitchen dish not found")
    return obj


@router.get("/kitchen-dishes", response_model=list[KitchenDishAdminOut])
def list_kitchen_dishes(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(m.KitchenDish).options(*_KITCHEN_DISH_OPTIONS).order_by(m.KitchenDish.sort_order, m.KitchenDish.name)
    ).all()
    return [_to_kitchen_dish_admin_out(d) for d in rows]


@router.get("/kitchen-dishes/{slug}", response_model=KitchenDishAdminOut)
def get_kitchen_dish(slug: str, db: Session = Depends(get_db)):
    obj = _get_kitchen_dish_or_404(db, slug)
    return _to_kitchen_dish_admin_out(obj)


@router.post("/kitchen-dishes", status_code=status.HTTP_201_CREATED, response_model=KitchenDishAdminOut)
def create_kitchen_dish(data: KitchenDishWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.KitchenDish).where(m.KitchenDish.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Kitchen dish with this slug already exists")
    obj = m.KitchenDish(slug=data.slug)
    db.add(obj)
    _apply_kitchen_dish(db, obj, data)
    db.commit()
    return _to_kitchen_dish_admin_out(_get_kitchen_dish_or_404(db, obj.slug))


@router.patch("/kitchen-dishes/{slug}", response_model=KitchenDishAdminOut)
def update_kitchen_dish(slug: str, data: KitchenDishWriteIn, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.KitchenDish).where(m.KitchenDish.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kitchen dish not found")
    if data.slug != slug and db.scalar(select(m.KitchenDish).where(m.KitchenDish.slug == data.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New slug already in use")
    if data.slug != slug:
        db.query(m.LearningProgress).filter_by(kind="kitchen", slug=slug).update(
            {"slug": data.slug}, synchronize_session=False
        )
    obj.slug = data.slug
    _apply_kitchen_dish(db, obj, data)
    db.commit()
    return _to_kitchen_dish_admin_out(_get_kitchen_dish_or_404(db, obj.slug))


@router.delete("/kitchen-dishes/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_kitchen_dish(slug: str, db: Session = Depends(get_db)):
    obj = db.scalar(select(m.KitchenDish).where(m.KitchenDish.slug == slug))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Kitchen dish not found")
    db.query(m.LearningProgress).filter(
        m.LearningProgress.kind == "kitchen", m.LearningProgress.slug == slug
    ).delete(synchronize_session=False)
    db.delete(obj)
    db.commit()


# ── Families ──────────────────────────────────────────────
# No M:N relations (unlike drinks/classics) — a flat CRUD, natural key `key`.
# Deletion is blocked while classics still reference the family (its FK is
# ondelete=RESTRICT and non-nullable), mirroring the spirit/kitchen category
# delete guards above.

def _to_family_admin_out(obj: m.Family) -> FamilyAdminOut:
    return FamilyAdminOut(
        id=obj.id, key=obj.key, label=obj.label, sub=obj.sub, color=obj.color,
        logic=obj.logic, evolution=obj.evolution, tip=obj.tip, sort_order=obj.sort_order,
    )


def _apply_family(obj: m.Family, data: FamilyWriteIn) -> None:
    obj.label = data.label; obj.sub = data.sub; obj.color = data.color
    obj.logic = data.logic; obj.evolution = data.evolution; obj.tip = data.tip
    obj.sort_order = data.sort_order


def _get_family_or_404(db: Session, key: str) -> m.Family:
    obj = db.scalar(select(m.Family).where(m.Family.key == key))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Family not found")
    return obj


@router.get("/families", response_model=list[FamilyAdminOut])
def list_families(db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Family).order_by(m.Family.sort_order, m.Family.label)).all()
    return [_to_family_admin_out(f) for f in rows]


@router.get("/families/{key}", response_model=FamilyAdminOut)
def get_family(key: str, db: Session = Depends(get_db)):
    return _to_family_admin_out(_get_family_or_404(db, key))


@router.post("/families", status_code=status.HTTP_201_CREATED, response_model=FamilyAdminOut)
def create_family(data: FamilyWriteIn, db: Session = Depends(get_db)):
    if db.scalar(select(m.Family).where(m.Family.key == data.key)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Family with this key already exists")
    obj = m.Family(key=data.key)
    db.add(obj)
    _apply_family(obj, data)
    db.commit()
    return _to_family_admin_out(_get_family_or_404(db, obj.key))


@router.patch("/families/{key}", response_model=FamilyAdminOut)
def update_family(key: str, data: FamilyWriteIn, db: Session = Depends(get_db)):
    obj = _get_family_or_404(db, key)
    if data.key != key and db.scalar(select(m.Family).where(m.Family.key == data.key)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="New key already in use")
    obj.key = data.key
    _apply_family(obj, data)
    db.commit()
    return _to_family_admin_out(_get_family_or_404(db, obj.key))


@router.delete("/families/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family(key: str, db: Session = Depends(get_db)):
    obj = _get_family_or_404(db, key)
    classic_count = db.scalar(
        select(func.count()).select_from(m.Classic).where(m.Classic.family_id == obj.id)
    )
    if classic_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Family '{key}' still has {classic_count} classic"
                   f"{'' if classic_count == 1 else 's'} — move or delete them first",
        )
    db.delete(obj)
    db.commit()


# ── Categories / sections ─────────────────────────────────
# Fixed set seeded by the migration (menu|classics|spirits|kitchen sections) —
# no create/delete, just relabel/show-hide/reorder from the "Разделы" tab.

def _to_category_admin_out(obj: m.Category) -> CategoryAdminOut:
    return CategoryAdminOut(
        id=obj.id, key=obj.key, label=obj.label, kind=obj.kind,
        sort_order=obj.sort_order, is_visible=obj.is_visible,
    )


def _get_category_or_404(db: Session, key: str) -> m.Category:
    obj = db.scalar(select(m.Category).where(m.Category.key == key))
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Category not found")
    return obj


@router.get("/categories", response_model=list[CategoryAdminOut])
def list_categories(db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Category).order_by(m.Category.sort_order, m.Category.label)).all()
    return [_to_category_admin_out(c) for c in rows]


@router.patch("/categories/{key}", response_model=CategoryAdminOut)
def update_category(key: str, data: CategoryPatchIn, db: Session = Depends(get_db)):
    obj = _get_category_or_404(db, key)
    if data.label is not None:
        obj.label = data.label
    if data.is_visible is not None:
        obj.is_visible = data.is_visible
    if data.sort_order is not None:
        obj.sort_order = data.sort_order
    db.commit()
    return _to_category_admin_out(obj)


@router.post("/categories/reorder", response_model=list[CategoryAdminOut])
def reorder_categories(data: CategoryReorderIn, db: Session = Depends(get_db)):
    rows = {c.key: c for c in db.scalars(select(m.Category)).all()}
    unknown = [key for key in data.keys if key not in rows]
    if unknown:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown category keys: {', '.join(unknown)}")
    for i, key in enumerate(data.keys):
        rows[key].sort_order = i
    db.commit()
    return [
        _to_category_admin_out(c)
        for c in db.scalars(select(m.Category).order_by(m.Category.sort_order, m.Category.label)).all()
    ]
