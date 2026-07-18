from app.schemas import (
    DrinkOut,
    OurAnswer,
    ClassicOut,
    FamilyOut,
    SpiritEntryOut,
    SpiritCategoryOut,
    DishNutritionOut,
    KitchenDishOut,
    KitchenCategoryOut,
    SectionOut,
    FiltersOut,
    ContentBundleOut,
)


def test_drink_out_keys():
    """Test that DrinkOut has all expected keys with correct field names (camelCase)."""
    d = DrinkOut(id="x", name="X").model_dump()
    for k in (
        "logo",
        "subtitle",
        "price",
        "volume",
        "abv",
        "spirit",
        "spirits",
        "glass",
        "descriptors",
        "badge",
        "recipe",
        "garnish",
        "pitch",
        "photo",
        "about",
        "naming",
        "faq",
    ):
        assert k in d, f"Missing key: {k}"
    assert d["isAlcoholic"] is True
    assert d["isZeroCulture"] is False


def test_bundle_shape():
    """Test that ContentBundleOut has exact structure and field names (camelCase)."""
    b = ContentBundleOut(
        sections=[],
        drinks=[],
        classics=[],
        families=[],
        spiritCategories=[],
        spirits=[],
        kitchenCategories=[],
        kitchen=[],
        filters={"spirits": [], "glasses": [], "classicSpirits": []},
    )
    dumped = b.model_dump()
    expected_keys = {
        "sections",
        "drinks",
        "classics",
        "families",
        "spiritCategories",
        "spirits",
        "kitchenCategories",
        "kitchen",
        "filters",
    }
    assert set(dumped.keys()) == expected_keys, f"Keys mismatch: {set(dumped.keys())} != {expected_keys}"


def test_classic_out_our_answers():
    """Test that ClassicOut correctly handles ourAnswers with OurAnswer objects."""
    c = ClassicOut(
        id="margarita",
        name="Margarita",
        family="sour",
        ourAnswers=[
            OurAnswer(label="Our Margarita", menuId="drink_1"),
        ],
    )
    dumped = c.model_dump()
    assert "ourAnswers" in dumped
    assert len(dumped["ourAnswers"]) == 1
    assert dumped["ourAnswers"][0]["label"] == "Our Margarita"
    assert dumped["ourAnswers"][0]["menuId"] == "drink_1"


def test_kitchen_dish_nutrition():
    """Test that KitchenDishOut correctly includes nutrition object."""
    k = KitchenDishOut(
        id="dish_1",
        categorySlug="appetizers",
        name="Tapas Plate",
        nutrition=DishNutritionOut(kcal=200, protein=15.0, fat=8.5, carb=12.0),
    )
    dumped = k.model_dump()
    assert "nutrition" in dumped
    assert dumped["nutrition"]["kcal"] == 200
    assert dumped["nutrition"]["protein"] == 15.0


def test_spirit_entry_camel_case():
    """Test that SpiritEntryOut uses camelCase field names (e.g., categorySlug, brandDetail, sourceUrl)."""
    s = SpiritEntryOut(
        slug="gin-1",
        categorySlug="gin",
        name="Premium Gin",
        brandDetail="A premium gin from London",
        pairings="Works great with tonic and citrus",
        sourceUrl="https://example.com",
    )
    dumped = s.model_dump()
    assert dumped["categorySlug"] == "gin"
    assert dumped["brandDetail"] == "A premium gin from London"
    assert dumped["pairings"] == "Works great with tonic and citrus"
    assert dumped["sourceUrl"] == "https://example.com"


def test_filters_out_shape():
    """Test that FiltersOut has the correct structure."""
    f = FiltersOut(spirits=["gin", "vodka"], glasses=["martini"], classicSpirits=["bourbon"])
    dumped = f.model_dump()
    assert "spirits" in dumped
    assert "glasses" in dumped
    assert "classicSpirits" in dumped
    assert dumped["classicSpirits"] == ["bourbon"]


def test_spirit_category_is_archived():
    """Test that SpiritCategoryOut correctly handles isArchived boolean."""
    sc = SpiritCategoryOut(slug="whiskey", label="Whiskey", isArchived=True)
    dumped = sc.model_dump()
    assert dumped["isArchived"] is True


def test_content_bundle_with_data():
    """Test ContentBundleOut with some sample data."""
    b = ContentBundleOut(
        sections=[SectionOut(id="classics", label="Classics", total=5)],
        drinks=[DrinkOut(id="d1", name="Drink 1")],
        classics=[],
        families=[FamilyOut(tint="red", code="sour", title="Sour")],
        spiritCategories=[SpiritCategoryOut(slug="gin", label="Gin")],
        spirits=[],
        kitchenCategories=[KitchenCategoryOut(slug="appetizers", label="Appetizers")],
        kitchen=[],
        filters=FiltersOut(spirits=[], glasses=[], classicSpirits=[]),
    )
    dumped = b.model_dump()
    assert len(dumped["sections"]) == 1
    assert len(dumped["drinks"]) == 1
    assert len(dumped["families"]) == 1
    assert dumped["sections"][0]["label"] == "Classics"
    assert dumped["drinks"][0]["name"] == "Drink 1"
