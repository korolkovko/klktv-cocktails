from sqlalchemy import create_engine, text

_TABLES = [
    "users", "glasses", "spirits", "tags", "flavors", "descriptors", "badges",
    "families", "categories",
    "cocktails", "cocktail_details", "cocktail_tags", "cocktail_flavors",
    "classics", "classic_spirits", "classic_descriptors", "classic_related_cocktails",
    "spirit_categories", "spirit_entries",
    "kitchen_categories", "kitchen_dishes",
    "zero_cocktails", "zero_cocktail_details",
    "zc_drinks", "zc_drink_details",
    "learning_progress", "timeline_entries",
]


def read_all(src_url):
    engine = create_engine(src_url)
    out = {}
    with engine.connect() as conn:  # read-only: only SELECT issued
        for t in _TABLES:
            rows = conn.execute(text(f"SELECT * FROM {t}")).mappings().all()
            out[t] = [dict(r) for r in rows]
    return out
