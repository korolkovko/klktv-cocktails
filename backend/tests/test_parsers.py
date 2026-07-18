from decimal import Decimal
from migration.parsers import (
    parse_abv, parse_price, parse_weight_g, parse_timing, parse_nutrition,
    parse_spirit_origin,
)


def test_parse_abv_cocktail_percent():
    assert parse_abv("12.0%") == (Decimal("12.0"), True)
    assert parse_abv("6.4%") == (Decimal("6.4"), True)

def test_parse_abv_spirit_bare():
    assert parse_abv("40") == (Decimal("40"), True)
    assert parse_abv("41.3") == (Decimal("41.3"), True)

def test_parse_abv_zc_comma_word():
    assert parse_abv("6,4 Alc") == (Decimal("6.4"), True)

def test_parse_abv_non_alc():
    assert parse_abv("Non Alc") == (None, False)
    assert parse_abv("") == (None, False)
    assert parse_abv(None) == (None, False)


def test_parse_price_plain():
    assert parse_price("400") == (Decimal("400"), None)
    assert parse_price("250₽") == (Decimal("250"), None)
    assert parse_price("430 ₽") == (Decimal("430"), None)

def test_parse_price_with_serving():
    assert parse_price("400 за 30") == (Decimal("400"), 30)
    assert parse_price("550р за 100мл") == (Decimal("550"), 100)

def test_parse_price_with_newline_serving():
    assert parse_price("800р\nза 100мл") == (Decimal("800"), 100)
    assert parse_price("550\nза\n30мл") == (Decimal("550"), 30)

def test_parse_price_blank():
    assert parse_price(None) == (None, None)
    assert parse_price("") == (None, None)


def test_parse_weight_g():
    assert parse_weight_g("329") == 329
    assert parse_weight_g("30") == 30
    assert parse_weight_g(None) is None
    assert parse_weight_g("") is None

def test_parse_timing_single():
    assert parse_timing("10") == (10, 10)
    assert parse_timing("1") == (1, 1)

def test_parse_timing_range():
    assert parse_timing("10-12") == (10, 12)

def test_parse_timing_blank():
    assert parse_timing(None) == (None, None)
    assert parse_timing("") == (None, None)


def test_parse_nutrition_format_a():
    raw = "На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7\nНа 100г: 153 ккал"
    r = parse_nutrition(raw)
    assert r["kcal_portion"] == Decimal("503")
    assert r["protein_g"] == Decimal("29.0")
    assert r["fat_g"] == Decimal("6.8")
    assert r["carb_g"] == Decimal("75.7")
    assert r["kcal_100g"] == Decimal("153")

def test_parse_nutrition_format_b():
    raw = "На порцию б 0,16 ж 18,62 у 5,96 195,2  ккал \nНа 100гр б 0,4  ж 46,55  у 14,92 488,01 ккал"
    r = parse_nutrition(raw)
    assert r["protein_g"] == Decimal("0.16")
    assert r["fat_g"] == Decimal("18.62")
    assert r["carb_g"] == Decimal("5.96")
    assert r["kcal_portion"] == Decimal("195.2")
    assert r["kcal_100g"] == Decimal("488.01")

def test_parse_nutrition_blank():
    r = parse_nutrition(None)
    assert all(v is None for v in r.values())


def test_spirit_origin_extracts_url_and_strips_region():
    r = parse_spirit_origin(brand="", country="регион:Испания",
                            brand_country="История бренда. https://example.com/x подробнее")
    assert r["country"] == "Испания"
    assert r["source_url"] == "https://example.com/x"
    assert "https://" not in r["description"]

def test_spirit_origin_prefers_clean_fields():
    r = parse_spirit_origin(brand="Orendain", country="Мексика", brand_country="")
    assert r["brand"] == "Orendain"
    assert r["country"] == "Мексика"
