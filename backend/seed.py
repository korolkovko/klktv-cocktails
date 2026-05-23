"""
Idempotent seed: creates the 12 users and migrates cocktail/classic data
from data/seed_data.json into the normalized tables.

The JSON file is produced from the canonical JS sources via
scripts/dump-data.mjs at the repo root (run before deploying).

Run with: python seed.py
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy.orm import Session  # noqa: E402
from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.models import (  # noqa: E402
    Badge, Category, Classic, ClassicDescriptor, ClassicRelatedCocktail, ClassicSpirit,
    Cocktail, CocktailDetail, CocktailFlavor, CocktailTag,
    Descriptor, Family, Flavor, Glass, KitchenCategory, KitchenDish,
    Spirit, Tag, TimelineEntry, User,
)


USERS = [
    ("admin",   "kollektiv77", "admin",  "Админ"),
    ("max",     "dieter17",    "reader", "Макс"),
    ("sasha",   "gentle88",    "reader", "Саша"),
    ("kolya",   "braindead44", "reader", "Коля"),
    ("diana",   "candy55",     "reader", "Диана"),
    ("michael", "springer33",  "reader", "Майкл"),
    ("olya",    "bigapple22",  "reader", "Оля"),
    ("kirill",  "jungle99",    "reader", "Кирилл"),
    ("artur",   "viking11",    "reader", "Артур"),
    ("misha",   "mezcal66",    "reader", "Миша"),
    ("milana",  "peach88",     "reader", "Милана"),
    ("stepa",   "rocket44",    "reader", "Степа"),
]

DATA_PATH = Path(__file__).parent / "data" / "seed_data.json"
KITCHEN_PATH = Path(__file__).parent / "data" / "kitchen_seed.json"


DEFAULT_CATEGORIES = [
    # (key, label, kind, is_visible)
    ("menu",     "Меню",         "menu",     True),
    ("classics", "Классика",     "classics", True),
    ("spirits",  "Крепкое",      "spirits",  False),  # filled in D-5
    ("kitchen",  "Кухня",        "kitchen",  False),  # filled in D-4
    ("zero",     "Безалко",      "zero",     False),  # filled in D-3
    ("zc",       "Zero Culture", "zc",       False),  # filled in D-3
]


def seed_categories(db: Session) -> None:
    """Create the default category rows if the table is empty.
    Once populated, admin edits (label/order/visibility) are preserved
    on every restart.
    """
    if db.query(Category).first():
        print("  categories: skip (admin edits preserved)")
        return
    for i, (key, label, kind, is_visible) in enumerate(DEFAULT_CATEGORIES):
        db.add(Category(key=key, label=label, kind=kind,
                        sort_order=i, is_visible=is_visible))
    db.commit()
    print(f"  categories: {len(DEFAULT_CATEGORIES)} created (defaults)")


def seed_kitchen(db: Session) -> None:
    """First-run only: load the kitchen menu from JSON. Subsequent
    starts preserve any admin edits (per the has-content guard below)."""
    if not KITCHEN_PATH.exists():
        print("  kitchen: skip (no JSON)")
        return
    if db.query(KitchenDish).first():
        print("  kitchen: skip (already seeded)")
        return
    data = json.loads(KITCHEN_PATH.read_text(encoding="utf-8"))
    cat_by_slug: dict[str, KitchenCategory] = {}
    for c in data["categories"]:
        obj = KitchenCategory(slug=c["slug"], label=c["label"], sort_order=c["sort_order"])
        db.add(obj); db.flush()
        cat_by_slug[c["slug"]] = obj
    for d in data["dishes"]:
        cat = cat_by_slug.get(d["category_slug"])
        if not cat:
            continue
        db.add(KitchenDish(
            slug=d["slug"][:80],
            category_id=cat.id,
            name=d["name"],
            description=d.get("description"),
            timing=d.get("timing"),
            weight=d.get("weight"),
            nutrition=d.get("nutrition"),
            serving=d.get("serving"),
            sort_order=d["sort_order"],
        ))
    db.commit()
    print(f"  kitchen: {len(data['categories'])} categories, {len(data['dishes'])} dishes")


def seed_users(db: Session) -> None:
    for username, password, role, name in USERS:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            existing.password_hash = hash_password(password)
            existing.role = role
            existing.name = name
        else:
            db.add(User(
                username=username,
                password_hash=hash_password(password),
                role=role,
                name=name,
            ))
    db.commit()
    print(f"  users: {len(USERS)} synced")


def upsert_lookup(db: Session, model, key_field: str, key_value: str, **defaults):
    """Find-or-create a lookup row by `key_field=key_value`. Updates `defaults`."""
    obj = db.query(model).filter(getattr(model, key_field) == key_value).first()
    if obj:
        for k, v in defaults.items():
            setattr(obj, k, v)
    else:
        obj = model(**{key_field: key_value}, **defaults)
        db.add(obj)
        db.flush()  # so caller can use .id immediately
    return obj


def seed_content(db: Session, data: dict) -> None:
    # ── Families ────────────────────────────────────────────
    family_by_key: dict[str, Family] = {}
    for i, f in enumerate(data["classicFamilies"]):
        obj = upsert_lookup(
            db, Family, "key", f["key"],
            label=f["label"], sub=f.get("sub"),
            color=f.get("color"), logic=f.get("logic"),
            evolution=f.get("evolution"), tip=f.get("tip"),
            sort_order=i,
        )
        family_by_key[f["key"]] = obj
    print(f"  families: {len(family_by_key)} synced")

    # ── Spirits (from classic_filters + classics.spirits) ───
    # Build from classic filter labels in JS for canonical labels; ensure all observed spirit keys exist.
    spirit_labels = {
        "gin": "Джин", "vodka": "Водка", "rum": "Ром",
        "whiskey": "Виски", "brandy": "Бренди", "tequila": "Текила",
        "mezcal": "Мескаль", "other": "Аперитив",
        "bourbon": "Бурбон",
    }
    observed_spirits: set[str] = set()
    for c in data["classics"]:
        observed_spirits.update(c.get("spirits") or [])
    spirit_by_key: dict[str, Spirit] = {}
    for i, key in enumerate(sorted(observed_spirits | set(spirit_labels.keys()))):
        label = spirit_labels.get(key, key.title())
        spirit_by_key[key] = upsert_lookup(db, Spirit, "key", key, label=label, sort_order=i)
    print(f"  spirits: {len(spirit_by_key)} synced")

    # ── Glasses (from cocktail.glassTag + classic.glassTag) ─
    glass_labels: dict[str, str] = {}
    for f in data.get("cocktailGlassFilters", []):
        if f["key"] != "all":
            glass_labels[f["key"]] = f["label"]
    # Add observed keys from cocktails and classics
    for c in data["cocktails"]:
        if c.get("glassTag") and c["glassTag"] not in glass_labels:
            glass_labels[c["glassTag"]] = c.get("glass") or c["glassTag"].title()
    for c in data["classics"]:
        if c.get("glassTag") and c["glassTag"] not in glass_labels:
            glass_labels[c["glassTag"]] = c.get("glass") or c["glassTag"].title()
    glass_by_key: dict[str, Glass] = {}
    for i, (key, label) in enumerate(sorted(glass_labels.items())):
        glass_by_key[key] = upsert_lookup(db, Glass, "key", key, label=label, sort_order=i)
    print(f"  glasses: {len(glass_by_key)} synced")

    # ── Tags (cocktail tags) ────────────────────────────────
    all_tags: set[str] = set()
    for c in data["cocktails"]:
        all_tags.update(c.get("tags") or [])
    tag_by_key: dict[str, Tag] = {}
    for key in sorted(all_tags):
        tag_by_key[key] = upsert_lookup(db, Tag, "key", key)
    print(f"  tags: {len(tag_by_key)} synced")

    # ── Flavors (cocktail flavors) ─────────────────────────
    all_flavors: set[str] = set()
    for c in data["cocktails"]:
        all_flavors.update(c.get("flavors") or [])
    flavor_by_label: dict[str, Flavor] = {}
    for label in sorted(all_flavors):
        flavor_by_label[label] = upsert_lookup(db, Flavor, "label", label)
    print(f"  flavors: {len(flavor_by_label)} synced")

    # ── Descriptors (classic descriptors) ───────────────────
    all_descs: set[str] = set()
    for c in data["classics"]:
        all_descs.update(c.get("descriptors") or [])
    descriptor_by_label: dict[str, Descriptor] = {}
    for label in sorted(all_descs):
        descriptor_by_label[label] = upsert_lookup(db, Descriptor, "label", label)
    print(f"  descriptors: {len(descriptor_by_label)} synced")

    # ── Badges (cocktail badges) ────────────────────────────
    badge_labels = {}
    for c in data["cocktails"]:
        b = c.get("badge")
        if b:
            badge_labels[b["type"]] = b["label"]
    badge_by_key: dict[str, Badge] = {}
    for key, label in sorted(badge_labels.items()):
        badge_by_key[key] = upsert_lookup(db, Badge, "key", key, label=label)
    print(f"  badges: {len(badge_by_key)} synced")

    db.commit()  # commit lookups before creating entities that reference them

    # ── Cocktails (must come before classics; classics reference them) ──
    cocktail_by_slug: dict[str, Cocktail] = {}
    for i, c in enumerate(data["cocktails"]):
        existing = db.query(Cocktail).filter(Cocktail.slug == c["id"]).first()
        glass = glass_by_key.get(c.get("glassTag")) if c.get("glassTag") else None
        badge = badge_by_key.get(c["badge"]["type"]) if c.get("badge") else None
        if existing:
            existing.name = c["name"]
            existing.img = c.get("img")
            existing.abv = c.get("abv")
            existing.tagline = c.get("tagline")
            existing.glass_id = glass.id if glass else None
            existing.glass_label_override = c.get("glass") if not glass else None
            existing.badge_id = badge.id if badge else None
            existing.sort_order = i
            obj = existing
        else:
            obj = Cocktail(
                slug=c["id"],
                name=c["name"],
                img=c.get("img"),
                abv=c.get("abv"),
                tagline=c.get("tagline"),
                glass_id=glass.id if glass else None,
                glass_label_override=c.get("glass") if not glass else None,
                badge_id=badge.id if badge else None,
                sort_order=i,
            )
            db.add(obj)
            db.flush()
        cocktail_by_slug[c["id"]] = obj

        # Replace tags, flavors, details (wipe + recreate)
        db.query(CocktailTag).filter(CocktailTag.cocktail_id == obj.id).delete()
        for j, tag_key in enumerate(c.get("tags") or []):
            db.add(CocktailTag(cocktail_id=obj.id, tag_id=tag_by_key[tag_key].id, sort_order=j))

        db.query(CocktailFlavor).filter(CocktailFlavor.cocktail_id == obj.id).delete()
        for j, flavor_label in enumerate(c.get("flavors") or []):
            db.add(CocktailFlavor(cocktail_id=obj.id, flavor_id=flavor_by_label[flavor_label].id, sort_order=j))

        db.query(CocktailDetail).filter(CocktailDetail.cocktail_id == obj.id).delete()
        for j, d in enumerate(c.get("details") or []):
            db.add(CocktailDetail(
                cocktail_id=obj.id,
                label=d["label"],
                text=d["text"],
                sort_order=j,
            ))
    print(f"  cocktails: {len(cocktail_by_slug)} synced")

    # ── Classics ────────────────────────────────────────────
    classic_count = 0
    for i, c in enumerate(data["classics"]):
        family = family_by_key.get(c["family"])
        if not family:
            print(f"    SKIP classic {c['id']!r}: unknown family {c['family']!r}")
            continue
        glass = glass_by_key.get(c.get("glassTag")) if c.get("glassTag") else None

        existing = db.query(Classic).filter(Classic.slug == c["id"]).first()
        if existing:
            existing.name = c["name"]
            existing.family_id = family.id
            existing.year = c.get("year")
            existing.origin = c.get("origin")
            existing.composition = c.get("composition")
            existing.glass_id = glass.id if glass else None
            existing.glass_label_override = c.get("glass") if not glass else None
            existing.garnish = c.get("garnish")
            existing.history = c.get("history")
            existing.for_whom = c.get("forWhom")
            existing.sort_order = i
            obj = existing
        else:
            obj = Classic(
                slug=c["id"],
                name=c["name"],
                family_id=family.id,
                year=c.get("year"),
                origin=c.get("origin"),
                composition=c.get("composition"),
                glass_id=glass.id if glass else None,
                glass_label_override=c.get("glass") if not glass else None,
                garnish=c.get("garnish"),
                history=c.get("history"),
                for_whom=c.get("forWhom"),
                sort_order=i,
            )
            db.add(obj)
            db.flush()
        classic_count += 1

        # Spirits
        db.query(ClassicSpirit).filter(ClassicSpirit.classic_id == obj.id).delete()
        for j, key in enumerate(c.get("spirits") or []):
            sp = spirit_by_key.get(key)
            if sp:
                db.add(ClassicSpirit(classic_id=obj.id, spirit_id=sp.id, sort_order=j))

        # Descriptors
        db.query(ClassicDescriptor).filter(ClassicDescriptor.classic_id == obj.id).delete()
        for j, label in enumerate(c.get("descriptors") or []):
            d = descriptor_by_label.get(label)
            if d:
                db.add(ClassicDescriptor(classic_id=obj.id, descriptor_id=d.id, sort_order=j))

        # Related author cocktails
        db.query(ClassicRelatedCocktail).filter(ClassicRelatedCocktail.classic_id == obj.id).delete()
        for j, slug in enumerate(c.get("relatedOurs") or []):
            related = cocktail_by_slug.get(slug)
            if related:
                db.add(ClassicRelatedCocktail(classic_id=obj.id, cocktail_id=related.id, sort_order=j))
    print(f"  classics: {classic_count} synced")

    # ── Timeline ────────────────────────────────────────────
    db.query(TimelineEntry).delete()
    for i, t in enumerate(data.get("cocktailTimeline") or []):
        db.add(TimelineEntry(
            period=t["period"],
            description=t["desc"],
            examples=t.get("examples"),
            sort_order=i,
        ))
    print(f"  timeline: {len(data.get('cocktailTimeline') or [])} synced")

    db.commit()


def main():
    init_db()
    db = SessionLocal()
    try:
        print(">>> seeding users")
        seed_users(db)

        print(">>> seeding categories")
        seed_categories(db)

        print(">>> seeding kitchen")
        seed_kitchen(db)

        # Content is seeded ONLY on first deploy (when the DB is empty).
        # Subsequent restarts must not overwrite admin/editor changes made
        # through the UI. To force a re-seed (e.g. after a destructive
        # migration), drop the cocktails table or set SEED_CONTENT_FORCE=1.
        from app.models import Cocktail  # local to avoid top-level cycles
        force = os.environ.get("SEED_CONTENT_FORCE") == "1"
        has_content = db.query(Cocktail).first() is not None
        if force or not has_content:
            if DATA_PATH.exists():
                print(f">>> seeding content from {DATA_PATH} (force={force}, had_content={has_content})")
                with open(DATA_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                seed_content(db, data)
            else:
                print(f"  WARNING: {DATA_PATH} not found, skipping content seed")
        else:
            print(">>> skipping content seed (DB already has cocktails — set SEED_CONTENT_FORCE=1 to override)")

        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
