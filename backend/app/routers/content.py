from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.auth import get_current_user
from app import models as m
from app.schemas import (DrinkOut, ClassicOut, FamilyOut, SpiritEntryOut, SpiritCategoryOut,
    KitchenDishOut, KitchenCategoryOut, SectionOut, FiltersOut, ContentBundleOut, DishNutritionOut, OurAnswer)

router = APIRouter(prefix="/api", tags=["content"], dependencies=[Depends(get_current_user)])


def _num(x):
    return None if x is None else (int(x) if x == int(x) else float(x))


def _serialize_drink(d: m.Drink) -> DrinkOut:
    spirits = [ds.spirit.label for ds in d.spirits]
    flavors = [df.flavor.label for df in d.flavors]
    return DrinkOut(
        id=d.slug, name=d.name, logo=d.img, subtitle=d.subtitle,
        price=_num(d.price_amount),
        volume=d.volume_ml, abv=None if d.abv is None else float(d.abv),
        spirit=spirits[0] if spirits else "", spirits=spirits,
        glass=d.glass.label if d.glass else "",
        descriptors=[s.upper() for s in spirits] + [f.upper() for f in flavors],
        badge=d.badge.key.upper() if d.badge else None,
        recipe=d.recipe, garnish=d.garnish, pitch=d.pitch, photo=d.photo,
        about=d.about, naming=d.naming, faq=d.faq,
        isAlcoholic=d.is_alcoholic, isZeroCulture=d.is_zero_culture,
        caffeineLevel=d.caffeine_level, isCarbonated=d.is_carbonated,
    )


def _serialize_classic(c: m.Classic) -> ClassicOut:
    return ClassicOut(
        id=c.slug, name=c.name, year=None if c.year is None else str(c.year),
        city=c.origin, family=c.family.key,
        spirit=c.spirits[0].spirit.label if c.spirits else "",
        glass=c.glass.label if c.glass else "",
        descriptors=[cd.descriptor.label for cd in c.descriptors],
        recipe=c.composition, garnish=c.garnish, history=c.history, fits=c.for_whom,
        ourAnswers=[OurAnswer(label=r.drink.name, menuId=r.drink.slug) for r in c.related_drinks],
    )


def _serialize_spirit(e: m.SpiritEntry, category_slug: str) -> SpiritEntryOut:
    return SpiritEntryOut(
        slug=e.slug, categorySlug=category_slug, name=e.name, img=e.img,
        abv=None if e.abv is None else float(e.abv), country=e.country,
        flavour=e.flavour, brand=e.brand, brandDetail=e.description,
        features=e.features, pairings=e.cocktail_pairings, fact=e.fact, sourceUrl=e.source_url,
    )


def _serialize_dish(k: m.KitchenDish, category_slug: str) -> KitchenDishOut:
    timing = None
    if k.timing_min_low is not None and k.timing_min_high is not None:
        timing = round((k.timing_min_low + k.timing_min_high) / 2)
    elif k.timing_min_low is not None:
        timing = k.timing_min_low
    return KitchenDishOut(
        id=k.slug, categorySlug=category_slug, name=k.name, subtitle=k.tagline,
        price=_num(k.price_amount),
        weight=k.weight_g, timing=timing, photo=k.img, description=k.description,
        serving=k.serving, fact=k.interesting_facts,
        nutrition=DishNutritionOut(
            kcal=None if k.kcal_portion is None else round(float(k.kcal_portion)),
            protein=_num(k.protein_g), fat=_num(k.fat_g), carb=_num(k.carb_g)),
    )


@router.get("/content", response_model=ContentBundleOut)
def get_content(db: Session = Depends(get_db)):
    drinks = db.scalars(select(m.Drink).options(
        selectinload(m.Drink.spirits).selectinload(m.DrinkSpirit.spirit),
        selectinload(m.Drink.flavors).selectinload(m.DrinkFlavor.flavor),
        selectinload(m.Drink.glass), selectinload(m.Drink.badge),
    ).order_by(m.Drink.sort_order, m.Drink.name)).all()

    classics = db.scalars(select(m.Classic).options(
        selectinload(m.Classic.family), selectinload(m.Classic.glass),
        selectinload(m.Classic.spirits).selectinload(m.ClassicSpirit.spirit),
        selectinload(m.Classic.descriptors).selectinload(m.ClassicDescriptor.descriptor),
        selectinload(m.Classic.related_drinks).selectinload(m.ClassicRelatedDrink.drink),
    ).order_by(m.Classic.sort_order, m.Classic.name)).all()

    families = db.scalars(select(m.Family).order_by(m.Family.sort_order)).all()
    fam_counts = dict(db.execute(select(m.Classic.family_id, func.count()).group_by(m.Classic.family_id)).all())

    spirit_cats = db.scalars(select(m.SpiritCategory).options(
        selectinload(m.SpiritCategory.entries)).order_by(m.SpiritCategory.sort_order)).all()
    kitchen_cats = db.scalars(select(m.KitchenCategory).options(
        selectinload(m.KitchenCategory.dishes)).order_by(m.KitchenCategory.sort_order)).all()

    # sections (catalog counts; learned omitted)
    counts = {
        "menu": db.scalar(select(func.count()).select_from(m.Drink)),
        "classics": db.scalar(select(func.count()).select_from(m.Classic)),
        "spirits": db.scalar(select(func.count()).select_from(m.SpiritEntry)),
        "kitchen": db.scalar(select(func.count()).select_from(m.KitchenDish)),
    }
    cats = db.scalars(select(m.Category).where(m.Category.kind.in_(list(counts)),
        m.Category.is_visible).order_by(m.Category.sort_order)).all()
    sections = [SectionOut(id=c.key, label=c.label, total=counts.get(c.kind, 0)) for c in cats]

    # filters (derived, deduped, order-preserving)
    def _distinct(vals):
        seen, out = set(), []
        for v in vals:
            if v and v not in seen:
                seen.add(v); out.append(v)
        return out
    menu_spirits = _distinct(ds.spirit.label for d in drinks for ds in d.spirits)
    menu_glasses = _distinct(d.glass.label for d in drinks if d.glass)
    classic_spirits = _distinct(cs.spirit.label for c in classics for cs in c.spirits)

    return ContentBundleOut(
        sections=sections,
        drinks=[_serialize_drink(d) for d in drinks],
        classics=[_serialize_classic(c) for c in classics],
        families=[FamilyOut(tint=f.key, code=f.key.upper(), title=f.label, logic=f.logic,
                            evolution=f.evolution, tip=f.tip, total=fam_counts.get(f.id, 0)) for f in families],
        spiritCategories=[SpiritCategoryOut(slug=sc.slug, label=sc.label, isArchived=sc.is_archived) for sc in spirit_cats],
        spirits=[_serialize_spirit(e, sc.slug) for sc in spirit_cats for e in sc.entries],
        kitchenCategories=[KitchenCategoryOut(slug=kc.slug, label=kc.label) for kc in kitchen_cats],
        kitchen=[_serialize_dish(dish, kc.slug) for kc in kitchen_cats for dish in kc.dishes],
        filters=FiltersOut(spirits=menu_spirits, glasses=menu_glasses, classicSpirits=classic_spirits),
    )
