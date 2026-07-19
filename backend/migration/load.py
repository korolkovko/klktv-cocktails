"""Transform + idempotent load: prod (SRC_DATABASE_URL) -> v2 (DEST_DATABASE_URL).

Idempotency strategy
---------------------
- Lookups (glasses/spirits/tags/flavors/descriptors/badges/families/categories/
  users/spirit_categories/kitchen_categories/timeline_entries) and slug-keyed
  catalogs with stable source ids (classics/spirit_entries/kitchen_dishes) and
  composite-PK rows (learning_progress) are natural-key upserts: `Session.merge`
  by primary key reproduces identical rows on every run.
- `drinks` has no stable source id of its own (it's a merge of three legacy
  tables), so it is upserted by its unique `slug`: look the row up first, update
  columns in place if found, otherwise insert a fresh row *without* setting
  `id` (the DB assigns it). This is what makes re-running the ETL safe even
  though ids are never chosen by this code.
- Child rows that have no natural unique key of their own (`drink_details`,
  `drink_tags`, `drink_flavors`, `classic_spirits`, `classic_descriptors`,
  `classic_related_drinks`) are fully re-derived from source on every run, so
  we delete the existing rows for the parents being (re)loaded and insert
  fresh ones (ids DB-assigned for `drink_details`). This is safe because this
  ETL is the sole writer to DEST during Phase 0.
- Explicit-id upserts never touch Postgres' own id sequences, so `load()`
  calls `_reset_sequences` once at the very end (after the final commit) to
  set every integer-`id`-PK table's sequence to `MAX(id)`. This keeps
  subsequent plain inserts (a new user signing up, admin CRUD, another
  ETL re-run) from picking a colliding id. See `_reset_sequences` docstring.

No-data-loss rescues
---------------------
Two source content columns have no destination column of their own and would
otherwise be silently discarded:
- `glass_label_override` (on `cocktails`/`zero_cocktails`/`zc_drinks`/
  `classics`) was replaced in the v2 schema by the single `glass_id` fallback.
  For drinks, a non-empty override is rescued as a synthetic
  `DrinkDetail(label="Бокал", ...)` row, inserted through the same
  delete-then-insert path as the rest of `drink_details` (so it stays stable
  across re-runs). `classics` has no `drink_details`-equivalent table to
  rescue into, so any non-empty override there is only counted and logged
  loudly rather than silently dropped (prod currently has zero).
- `zero_cocktails.ingredients_text` is rescued the same way, as a synthetic
  `DrinkDetail(label="Ингредиенты", ...)` row.

`is_alcoholic` default for cocktails
-------------------------------------
`cocktails` are author drinks and are alcoholic by definition; a blank/
missing raw `abv` only means the field wasn't filled in, not that the drink
is non-alcoholic. So `is_alcoholic` for this source is `True` unless the raw
abv explicitly carries the "Non Alc" marker (`parsers.is_nonalc_marker`);
`abv` itself is still the parsed numeric (`None` when blank/unparseable) and
`abv_raw` is preserved untouched either way. `zero_cocktails` (always
non-alcoholic by construction) and `zc_drinks` (per-row `is_alcoholic`
column) are unaffected by this and keep their existing derivation.

Timestamps
----------
`created_at` is preserved from the source row for every content table this
ETL writes (`drinks` via cocktails/zero_cocktails/zc_drinks, `classics`,
`spirit_entries`, `kitchen_dishes`) — re-running never resets it, since the
source value doesn't change. `updated_at` is left migration-managed
(defaults to now / bumps on update) rather than carried over, since it
doesn't have a well-defined single source across the three merged drink
tables.
"""
import re

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app import models as m
from migration.source import read_all
from migration.parsers import (
    parse_abv, parse_price, parse_weight_g, parse_timing, parse_nutrition,
    parse_spirit_origin, is_nonalc_marker,
)

# Exact-match delete list for test/QA artifacts found in prod's
# tags/flavors/descriptors lookup tables (see migration/README.md's
# "Test/junk filtering" note). This is NOT a place to fix content typos —
# `Габа.` (trailing period) and `Ирдандия` (misspelling of "Ирландия") are
# real prod content, not test junk, and are intentionally left out of this
# set; they're deliberately migrated as-is and left for a later content
# pass rather than silently dropped here.
JUNK = {"ДОБАВЛЕНО ИЗ UI", "Тестовый", "Обновлённый", "test-tag"}


def _slugnorm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _upsert_drink(existing_by_slug, s, slug, **fields):
    """Idempotent upsert of a Drink keyed by slug.

    Updates the existing row's columns in place if one exists for `slug`;
    otherwise inserts a new row without assigning `id` (DB-assigned).
    """
    d = existing_by_slug.get(slug)
    if d is None:
        d = m.Drink(slug=slug, **fields)
        s.add(d)
        existing_by_slug[slug] = d
    else:
        for k, v in fields.items():
            setattr(d, k, v)
    return d


def _reset_sequences(session):
    """Advance every integer-`id`-PK table's Postgres sequence to MAX(id).

    Most lookup/content tables above are loaded via `s.merge(Model(id=..., ...))`
    with an explicit id carried over from prod. That never touches the
    table's serial/identity sequence, so after a load the sequence can still
    read 1 while MAX(id) is far higher — the next plain `INSERT` with no
    explicit id (a new user signing up, Phase-2 admin CRUD, this ETL's own
    `drinks`/`drink_details` inserts) then picks a colliding id and fails
    with a duplicate-key error. Call this once, after the load's final
    commit, so every re-run (cutover is a re-run) leaves sequences correct.

    Tables are taken from SQLAlchemy metadata rather than a hardcoded name
    list. Only tables whose primary key is a single column named `id` are
    considered; composite-PK tables with no `id` column at all (drink_tags,
    drink_flavors, drink_spirits, classic_spirits, classic_descriptors,
    classic_related_drinks, learning_progress) don't match and are skipped
    automatically. `pg_get_serial_sequence` returns NULL for an `id` column
    that isn't backed by a sequence; that case is also skipped so `setval`
    is never called with a NULL target. Idempotent: setting a sequence to
    the same MAX(id) twice is harmless.
    """
    for table in m.Base.metadata.sorted_tables:
        pk_cols = list(table.primary_key.columns)
        if len(pk_cols) != 1 or pk_cols[0].name != "id":
            continue
        tbl = table.name  # from our own trusted model metadata, not user input
        seq = session.execute(
            text("SELECT pg_get_serial_sequence(:tbl, 'id')"), {"tbl": tbl}
        ).scalar()
        if seq is None:
            continue  # id column has no backing sequence -- nothing to reset
        session.execute(
            text(f"SELECT setval(:seq, COALESCE((SELECT MAX(id) FROM {tbl}), 1))"),
            {"seq": seq},
        )
    session.commit()


def load(src_url, dest_url):
    src = read_all(src_url)
    engine = create_engine(dest_url)
    stats = {}
    try:
        with Session(engine) as s:
            # 1) lookups (natural key -> merge is idempotent)
            for row in src["glasses"]:
                s.merge(m.Glass(**{k: row[k] for k in ("id", "key", "label", "sort_order")}))
            for row in src["spirits"]:
                s.merge(m.Spirit(**{k: row[k] for k in ("id", "key", "label", "sort_order")}))
            for row in src["tags"]:
                if row["key"] in JUNK:
                    continue
                s.merge(m.Tag(id=row["id"], key=row["key"], label=row["key"].title()))
            for row in src["flavors"]:
                if row["label"] in JUNK:
                    continue
                s.merge(m.Flavor(id=row["id"], label=row["label"]))
            for row in src["descriptors"]:
                if row["label"] in JUNK:
                    continue
                s.merge(m.Descriptor(id=row["id"], label=row["label"]))
            for row in src["badges"]:
                s.merge(m.Badge(id=row["id"], key=row["key"], label=row["label"]))
            for row in src["families"]:
                s.merge(m.Family(**{k: row.get(k) for k in
                        ("id", "key", "label", "sub", "color", "logic", "evolution", "tip", "sort_order")}))
            for row in src["categories"]:
                if row["key"] in ("zero", "zc"):
                    continue
                s.merge(m.Category(**{k: row[k] for k in ("id", "key", "label", "kind", "sort_order", "is_visible")}))
            for row in src["users"]:
                s.merge(m.User(**{k: row[k] for k in ("id", "username", "password_hash", "role", "name", "created_at")}))
            for row in src["spirit_categories"]:
                s.merge(m.SpiritCategory(**{k: row[k] for k in ("id", "slug", "label", "sort_order", "is_archived")}))
            for row in src["kitchen_categories"]:
                s.merge(m.KitchenCategory(**{k: row[k] for k in ("id", "slug", "label", "sort_order")}))
            for row in src["timeline_entries"]:
                s.merge(m.TimelineEntry(**{k: row[k] for k in ("id", "period", "description", "examples", "sort_order")}))
            s.flush()

            # 2) drinks: upsert by slug (idempotent; ids DB-assigned)
            existing_by_slug = {d.slug: d for d in s.query(m.Drink).all()}
            drink_slugs = {}  # normalized slug -> canonical slug already accounted for

            for row in src["cocktails"]:
                abv, _ = parse_abv(row.get("abv"))
                # Cocktails are author drinks: default to alcoholic. A blank/
                # missing abv just means it wasn't filled in yet (abv stays
                # unknown/None below) — it must NOT be read as non-alcoholic.
                # Only an explicit "Non Alc" marker in the raw abv text
                # flips this to False.
                is_alc = not is_nonalc_marker(row.get("abv"))
                _upsert_drink(
                    existing_by_slug, s, row["slug"],
                    name=row["name"], img=row.get("img"), subtitle=row.get("tagline"),
                    is_alcoholic=is_alc, is_zero_culture=False, abv=abv, abv_raw=row.get("abv"),
                    glass_id=row.get("glass_id"), badge_id=row.get("badge_id"),
                    sort_order=row.get("sort_order", 0), created_at=row["created_at"],
                )
                drink_slugs[_slugnorm(row["slug"])] = row["slug"]
            s.flush()

            # 3) zero_cocktails -> drinks (non-alc)
            for row in src["zero_cocktails"]:
                price_amt, _ = parse_price(row.get("price"))
                _upsert_drink(
                    existing_by_slug, s, row["slug"],
                    name=row["name"], img=row.get("img"), subtitle=row.get("tagline"),
                    is_alcoholic=False, is_zero_culture=False, abv=None, abv_raw=row.get("abv"),
                    price_amount=price_amt, price_raw=row.get("price"),
                    glass_id=row.get("glass_id"), sort_order=row.get("sort_order", 0),
                    created_at=row["created_at"],
                )
                drink_slugs[_slugnorm(row["slug"])] = row["slug"]
            s.flush()

            # 4) zc_drinks -> drinks (dedup Upcykle by normalized slug)
            upcykle_merges = 0
            # Forward-hardening for cutover: when a zc_drinks row is deduped
            # (its own slug dropped in favor of an already-created drink),
            # remember dropped-raw-slug -> kept-canonical-slug so any
            # learning_progress row still pointing at the dropped slug can
            # be remapped in step 11 instead of becoming orphan progress.
            slug_remap = {}
            for row in src["zc_drinks"]:
                norm = _slugnorm(row["slug"])
                price_amt, _ = parse_price(row.get("price"))
                abv, _ = parse_abv(row.get("abv"))
                if norm in drink_slugs:
                    upcykle_merges += 1  # duplicate product; keep existing drink, details merged in step 6
                    slug_remap[row["slug"]] = drink_slugs[norm]
                    continue
                _upsert_drink(
                    existing_by_slug, s, row["slug"],
                    name=row["name"], img=row.get("img"), subtitle=row.get("tagline"),
                    is_alcoholic=bool(row.get("is_alcoholic")), is_zero_culture=True,
                    abv=abv, abv_raw=row.get("abv"),
                    price_amount=price_amt, price_raw=row.get("price"),
                    caffeine_level=row.get("caffeine_level"), is_carbonated=row.get("is_carbonated"),
                    glass_id=row.get("glass_id"), sort_order=row.get("sort_order", 0),
                    created_at=row["created_at"],
                )
                drink_slugs[norm] = row["slug"]
            s.flush()
            stats["upcykle_merges"] = upcykle_merges

            # 5) resolve drink slug -> id map (rebuilt post-flush so DB-assigned ids resolve)
            id_by_slug = {d.slug: d.id for d in s.query(m.Drink).all()}

            # 6) details from all three legacy detail tables -> drink_details.
            #    No natural unique key on drink_details: delete existing rows for
            #    the drinks about to be (re)populated, then insert fresh (id
            #    DB-assigned). Every run repopulates details for every drink in
            #    id_by_slug, so this is a full re-derivation of the table.
            all_drink_ids = list(id_by_slug.values())
            if all_drink_ids:
                s.query(m.DrinkDetail).filter(m.DrinkDetail.drink_id.in_(all_drink_ids)) \
                    .delete(synchronize_session=False)

            def _add_details(rows, parent_key, slug_by_parent):
                for r in rows:
                    slug = slug_by_parent.get(r[parent_key])
                    did = id_by_slug.get(slug)
                    if did is None:
                        continue
                    s.add(m.DrinkDetail(drink_id=did, label=r["label"], text=r["text"],
                                         sort_order=r.get("sort_order", 0)))

            def _rescue_field(rows, slug_by_parent, field, label, sort_order=999):
                """Emit a synthetic DrinkDetail for a prod content column that
                has no destination column of its own, so a non-empty value is
                never silently discarded. `rows` are the parent table's own
                rows (keyed by their own `id`), not a *_details child table.
                Returns the number of rows rescued."""
                count = 0
                for r in rows:
                    val = (r.get(field) or "").strip()
                    if not val:
                        continue
                    did = id_by_slug.get(slug_by_parent.get(r["id"]))
                    if did is None:
                        continue
                    s.add(m.DrinkDetail(drink_id=did, label=label, text=val, sort_order=sort_order))
                    count += 1
                return count

            ck_slug = {r["id"]: r["slug"] for r in src["cocktails"]}
            z0_slug = {r["id"]: r["slug"] for r in src["zero_cocktails"]}
            # zc rows deduped against the Upcykle merge (step 4) resolve
            # against the full drink-slug universe (cocktails + zero_cocktails
            # + non-dup zc), not just cocktails, so a future zero/zc slug
            # collision can't silently drop detail rows the way a
            # cocktails-only check would.
            zc_slug = {r["id"]: drink_slugs.get(_slugnorm(r["slug"]), r["slug"]) for r in src["zc_drinks"]}

            _add_details(src["cocktail_details"], "cocktail_id", ck_slug)
            _add_details(src["zero_cocktail_details"], "parent_id", z0_slug)
            _add_details(src["zc_drink_details"], "parent_id", zc_slug)

            # No-data-loss rescues (see module docstring): synthetic detail
            # rows for prod columns with no destination column of their own.
            # Inserted in the same delete-then-insert pass as the rest of
            # drink_details, so re-runs stay idempotent.
            glass_overrides = 0
            glass_overrides += _rescue_field(src["cocktails"], ck_slug, "glass_label_override", "Бокал")
            glass_overrides += _rescue_field(src["zero_cocktails"], z0_slug, "glass_label_override", "Бокал")
            glass_overrides += _rescue_field(src["zc_drinks"], zc_slug, "glass_label_override", "Бокал")
            stats["glass_overrides"] = glass_overrides

            _rescue_field(src["zero_cocktails"], z0_slug, "ingredients_text", "Ингредиенты")

            s.flush()

            # 7) drink M:N (tags/flavors) from cocktails only (zero/zc had none).
            #    Same no-natural-key idempotency approach: delete rows for the
            #    parents about to be reloaded, then insert fresh.
            cocktail_drink_ids = [id_by_slug[slug] for slug in ck_slug.values() if slug in id_by_slug]
            if cocktail_drink_ids:
                s.query(m.DrinkTag).filter(m.DrinkTag.drink_id.in_(cocktail_drink_ids)) \
                    .delete(synchronize_session=False)
                s.query(m.DrinkFlavor).filter(m.DrinkFlavor.drink_id.in_(cocktail_drink_ids)) \
                    .delete(synchronize_session=False)
            for r in src["cocktail_tags"]:
                did = id_by_slug.get(ck_slug.get(r["cocktail_id"]))
                if did:
                    s.add(m.DrinkTag(drink_id=did, tag_id=r["tag_id"], sort_order=r.get("sort_order", 0)))
            for r in src["cocktail_flavors"]:
                did = id_by_slug.get(ck_slug.get(r["cocktail_id"]))
                if did:
                    s.add(m.DrinkFlavor(drink_id=did, flavor_id=r["flavor_id"], sort_order=r.get("sort_order", 0)))
            s.flush()

            # 8) classics + links
            for row in src["classics"]:
                s.merge(m.Classic(**{k: row.get(k) for k in
                        ("id", "slug", "name", "family_id", "year", "origin", "composition",
                         "glass_id", "garnish", "history", "for_whom", "sort_order")},
                        created_at=row["created_at"]))
            s.flush()

            # classics has no destination place to rescue glass_label_override
            # into (no classics-level details table), so a non-empty value
            # can't be silently dropped: count it and log the affected slugs
            # loudly instead. Prod currently has zero.
            classic_glass_overrides = [row["slug"] for row in src["classics"]
                                        if (row.get("glass_label_override") or "").strip()]
            print(f"classics glass_label_override: {len(classic_glass_overrides)} non-empty"
                  + (f", affected slugs: {classic_glass_overrides}" if classic_glass_overrides else ""))

            classic_ids = [row["id"] for row in src["classics"]]
            if classic_ids:
                s.query(m.ClassicSpirit).filter(m.ClassicSpirit.classic_id.in_(classic_ids)) \
                    .delete(synchronize_session=False)
                s.query(m.ClassicDescriptor).filter(m.ClassicDescriptor.classic_id.in_(classic_ids)) \
                    .delete(synchronize_session=False)
                s.query(m.ClassicRelatedDrink).filter(m.ClassicRelatedDrink.classic_id.in_(classic_ids)) \
                    .delete(synchronize_session=False)
            for r in src["classic_spirits"]:
                s.add(m.ClassicSpirit(classic_id=r["classic_id"], spirit_id=r["spirit_id"], sort_order=r.get("sort_order", 0)))
            for r in src["classic_descriptors"]:
                s.add(m.ClassicDescriptor(classic_id=r["classic_id"], descriptor_id=r["descriptor_id"], sort_order=r.get("sort_order", 0)))
            for r in src["classic_related_cocktails"]:
                did = id_by_slug.get(ck_slug.get(r["cocktail_id"]))
                if did:
                    s.add(m.ClassicRelatedDrink(classic_id=r["classic_id"], drink_id=did, sort_order=r.get("sort_order", 0)))
            s.flush()

            # 9) spirit_entries (parsed; stable source id -> merge is idempotent)
            for row in src["spirit_entries"]:
                abv, _ = parse_abv(row.get("abv"))
                amt, serving = parse_price(row.get("price"))
                origin = parse_spirit_origin(row.get("brand"), row.get("country"), row.get("brand_country"))
                s.merge(m.SpiritEntry(
                    id=row["id"], slug=row["slug"], category_id=row["category_id"], name=row["name"],
                    img=row.get("img"), abv=abv, abv_raw=row.get("abv"),
                    price_amount=amt, serving_ml=serving, price_raw=row.get("price"),
                    flavour=row.get("flavour"), brand=origin["brand"], country=origin["country"],
                    description=origin["description"], source_url=origin["source_url"] or row.get("source_url"),
                    features=row.get("features"), cocktail_pairings=row.get("cocktail_pairings"),
                    fact=row.get("fact"), sort_order=row.get("sort_order", 0),
                    created_at=row["created_at"],
                ))

            # 10) kitchen_dishes (parsed; stable source id -> merge is idempotent)
            for row in src["kitchen_dishes"]:
                amt, _ = parse_price(row.get("price"))
                lo, hi = parse_timing(row.get("timing"))
                nutr = parse_nutrition(row.get("nutrition"))
                s.merge(m.KitchenDish(
                    id=row["id"], slug=row["slug"], category_id=row["category_id"], name=row["name"],
                    img=row.get("img"), price_amount=amt, price_raw=row.get("price"),
                    tagline=row.get("tagline"), description=row.get("description"),
                    timing_min_low=lo, timing_min_high=hi, timing_raw=row.get("timing"),
                    weight_g=parse_weight_g(row.get("weight")), weight_raw=row.get("weight"),
                    nutrition_raw=row.get("nutrition"), serving=row.get("serving"),
                    interesting_facts=row.get("interesting_facts"), sort_order=row.get("sort_order", 0),
                    created_at=row["created_at"],
                    **nutr,
                ))

            # 11) progress (composite PK -> merge is idempotent)
            #     Cutover hardening: a "menu"-kind row whose slug is a
            #     zc_drinks slug dropped by the Upcykle-style dedup in step
            #     4 (see slug_remap) is rewritten to the kept drink slug
            #     before insert, so a stray "learned" mark on the dropped
            #     slug can't hard-fail verify.py's orphan-progress check.
            for r in src["learning_progress"]:
                slug = r["slug"]
                if r["kind"] == "menu" and slug in slug_remap:
                    slug = slug_remap[slug]
                s.merge(m.LearningProgress(user_id=r["user_id"], kind=r["kind"], slug=slug, learned_at=r.get("learned_at")))

            s.commit()

            stats["drinks"] = s.query(m.Drink).count()
            stats["classics"] = s.query(m.Classic).count()
            stats["spirit_entries"] = s.query(m.SpiritEntry).count()
            stats["kitchen_dishes"] = s.query(m.KitchenDish).count()
            stats["learning_progress"] = s.query(m.LearningProgress).count()

            # Must run after the final commit above: advances every
            # integer-id-PK table's sequence to MAX(id) so the next
            # plain INSERT (no explicit id) doesn't collide with an id
            # this ETL wrote explicitly. See docstring for details.
            _reset_sequences(s)
    finally:
        engine.dispose()
    return stats
