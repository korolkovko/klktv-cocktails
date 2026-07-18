from sqlalchemy import create_engine, func
from sqlalchemy.orm import Session
from app import models as m
from migration.source import read_all


def verify(src_url, dest_url):
    src = read_all(src_url)
    engine = create_engine(dest_url)
    with Session(engine) as s:
        drinks = s.query(m.Drink).count()
        expected_drinks = len(src["cocktails"]) + len(src["zero_cocktails"]) + len(src["zc_drinks"]) - 1  # Upcykle dedup
        assert drinks == expected_drinks, f"drinks {drinks} != {expected_drinks}"

        # counts preserved
        assert s.query(m.Classic).count() == len(src["classics"])
        assert s.query(m.SpiritEntry).count() == len(src["spirit_entries"])
        assert s.query(m.KitchenDish).count() == len(src["kitchen_dishes"])
        assert s.query(m.LearningProgress).count() == len(src["learning_progress"])

        # no orphan progress (every slug resolves in its kind)
        drink_slugs = {d.slug for d in s.query(m.Drink).all()}
        classic_slugs = {c.slug for c in s.query(m.Classic).all()}
        dish_slugs = {k.slug for k in s.query(m.KitchenDish).all()}
        kind_sets = {"menu": drink_slugs, "classics": classic_slugs, "kitchen": dish_slugs}
        orphans = [(p.kind, p.slug) for p in s.query(m.LearningProgress).all()
                   if p.kind in kind_sets and p.slug not in kind_sets[p.kind]]
        assert not orphans, f"orphan progress rows: {orphans}"

        # attention: raw present but parse produced null
        attention = []
        for d in s.query(m.Drink).all():
            if d.abv_raw and d.is_alcoholic and d.abv is None:
                attention.append(("drink.abv", d.slug, d.abv_raw))
        for e in s.query(m.SpiritEntry).all():
            if e.price_raw and e.price_amount is None:
                attention.append(("spirit.price", e.slug, e.price_raw))
            if e.abv_raw and e.abv is None:
                attention.append(("spirit.abv", e.slug, e.abv_raw))
        for k in s.query(m.KitchenDish).all():
            if k.nutrition_raw and k.kcal_portion is None:
                attention.append(("dish.nutrition", k.slug, k.nutrition_raw[:40]))

        print(f"OK drinks={drinks} classics={s.query(m.Classic).count()} "
              f"spirits={s.query(m.SpiritEntry).count()} dishes={s.query(m.KitchenDish).count()} "
              f"progress={s.query(m.LearningProgress).count()}")
        if attention:
            print(f"⚠ NEEDS ATTENTION ({len(attention)}):")
            for a in attention:
                print("  ", a)
        else:
            print("✓ all raw fields parsed cleanly")
