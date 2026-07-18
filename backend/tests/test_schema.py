import os
from sqlalchemy import create_engine, inspect


def test_expected_tables_exist():
    engine = create_engine(os.environ["DEST_DATABASE_URL"])
    names = set(inspect(engine).get_table_names())
    for t in ["drinks", "drink_tags", "drink_flavors", "drink_spirits",
              "drink_details", "classics", "classic_related_drinks",
              "spirit_entries", "kitchen_dishes", "learning_progress",
              "timeline_entries", "users"]:
        assert t in names, f"missing {t}"
    for gone in ["classic_progress", "zero_cocktails", "zc_drinks"]:
        assert gone not in names, f"legacy table present: {gone}"
