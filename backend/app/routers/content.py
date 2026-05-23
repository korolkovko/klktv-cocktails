"""Read-only content API: cocktails, classics, families, timeline, filters."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Category, Classic, ClassicDescriptor, ClassicRelatedCocktail, ClassicSpirit,
    Cocktail, CocktailFlavor, CocktailTag, Family, TimelineEntry,
)
from app.schemas import (
    CategoryOut, ClassicOut, CocktailBadgeOut, CocktailDetailOut, CocktailOut,
    ContentBundleOut, FamilyOut, FilterOut, TimelineOut,
)

# Content is only available to authenticated users — the menu is closed.
router = APIRouter(prefix="/api", tags=["content"], dependencies=[Depends(get_current_user)])


# ── Hardcoded filter lists (canonical labels, shown in nav) ───────────
# These mirror the previous JS spiritFilters/glassFilters arrays. Easier
# to keep them here than to derive sort/labels from the DB-rows.
COCKTAIL_SPIRIT_FILTERS = [
    {"key": "all", "label": "Все"},
    {"key": "gin", "label": "Джин"},
    {"key": "vodka", "label": "Водка"},
    {"key": "rum", "label": "Ром"},
    {"key": "bourbon", "label": "Бурбон"},
    {"key": "brandy", "label": "Бренди"},
    {"key": "mezcal", "label": "Мескаль"},
]
COCKTAIL_GLASS_FILTERS = [
    {"key": "all", "label": "Все"},
    {"key": "oldfashioned", "label": "Олд Фэшн"},
    {"key": "ponyglass", "label": "Пони Гласс"},
    {"key": "collins", "label": "Коллинз"},
    {"key": "rocks", "label": "Рокс"},
    {"key": "metal", "label": "Металл"},
    {"key": "wine", "label": "Винный"},
    {"key": "piala", "label": "Пиала"},
    {"key": "bottle", "label": "Бутылка"},
]


def _serialize_cocktail(c: Cocktail) -> CocktailOut:
    return CocktailOut(
        id=c.slug,
        name=c.name,
        img=c.img,
        abv=c.abv,
        glass=(c.glass.label if c.glass else c.glass_label_override),
        glass_tag=(c.glass.key if c.glass else None),
        tagline=c.tagline,
        tags=[t.tag.key for t in c.tags],
        flavors=[f.flavor.label for f in c.flavors],
        details=[CocktailDetailOut(label=d.label, text=d.text) for d in c.details],
        badge=CocktailBadgeOut(key=c.badge.key, label=c.badge.label) if c.badge else None,
    )


def _serialize_classic(c: Classic) -> ClassicOut:
    return ClassicOut(
        id=c.slug,
        name=c.name,
        family=c.family.key,
        year=c.year,
        origin=c.origin,
        spirits=[s.spirit.key for s in c.spirits],
        composition=c.composition,
        glass=(c.glass.label if c.glass else c.glass_label_override),
        glass_tag=(c.glass.key if c.glass else None),
        garnish=c.garnish,
        descriptors=[d.descriptor.label for d in c.descriptors],
        history=c.history,
        for_whom=c.for_whom,
        related_ours=[r.cocktail.slug for r in c.related_cocktails],
    )


def _cocktails_query(db: Session) -> list[Cocktail]:
    return (
        db.query(Cocktail)
        .options(
            selectinload(Cocktail.glass),
            selectinload(Cocktail.badge),
            selectinload(Cocktail.tags).selectinload(CocktailTag.tag),
            selectinload(Cocktail.flavors).selectinload(CocktailFlavor.flavor),
            selectinload(Cocktail.details),
        )
        .order_by(Cocktail.sort_order, Cocktail.id)
        .all()
    )


def _classics_query(db: Session) -> list[Classic]:
    return (
        db.query(Classic)
        .options(
            selectinload(Classic.family),
            selectinload(Classic.glass),
            selectinload(Classic.spirits).selectinload(ClassicSpirit.spirit),
            selectinload(Classic.descriptors).selectinload(ClassicDescriptor.descriptor),
            selectinload(Classic.related_cocktails).selectinload(ClassicRelatedCocktail.cocktail),
        )
        .order_by(Classic.sort_order, Classic.id)
        .all()
    )


@router.get("/content", response_model=ContentBundleOut)
def get_content_bundle(db: Session = Depends(get_db)):
    """Single endpoint that returns everything needed for the SPA's first
    render. Avoids the N+1 of having each page fetch its own slice.

    Categories are returned to all logged-in users (filtered by is_visible
    in the frontend's burger render; admins also need invisible ones for
    the editor — they can request /api/admin/categories for the full set).
    """
    categories = db.query(Category).order_by(Category.sort_order, Category.id).all()
    families = db.query(Family).order_by(Family.sort_order, Family.id).all()
    timeline = db.query(TimelineEntry).order_by(TimelineEntry.sort_order, TimelineEntry.id).all()
    return ContentBundleOut(
        categories=[CategoryOut.model_validate(c) for c in categories],
        cocktails=[_serialize_cocktail(c) for c in _cocktails_query(db)],
        classics=[_serialize_classic(c) for c in _classics_query(db)],
        families=[FamilyOut.model_validate(f) for f in families],
        cocktail_spirit_filters=[FilterOut(**f) for f in COCKTAIL_SPIRIT_FILTERS],
        cocktail_glass_filters=[FilterOut(**f) for f in COCKTAIL_GLASS_FILTERS],
        timeline=[
            TimelineOut(period=t.period, description=t.description, examples=t.examples)
            for t in timeline
        ],
    )


@router.get("/cocktails", response_model=list[CocktailOut])
def list_cocktails(db: Session = Depends(get_db)):
    return [_serialize_cocktail(c) for c in _cocktails_query(db)]


@router.get("/classics", response_model=list[ClassicOut])
def list_classics(db: Session = Depends(get_db)):
    return [_serialize_classic(c) for c in _classics_query(db)]


@router.get("/families", response_model=list[FamilyOut])
def list_families(db: Session = Depends(get_db)):
    families = db.query(Family).order_by(Family.sort_order, Family.id).all()
    return [FamilyOut.model_validate(f) for f in families]
