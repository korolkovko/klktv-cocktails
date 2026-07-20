def test_create_update_delete_category_and_dish(editor_client):
    cat_payload = {
        "slug": "test-kitchen-category-snacks", "label": "Тест Закуски",
        "sort_order": 500,
    }
    dish_payload = {
        "slug": "test-kitchen-dish-nachos", "category": "test-kitchen-category-snacks",
        "name": "Тест Начос", "img": "nachos.jpg",
        "price_raw": "450р", "tagline": "хрустящие",
        "description": "начос с сыром и сальсой",
        "timing_raw": "10-15", "weight_raw": "300 г",
        "nutrition_raw": "На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7. На 100 г: 250 ккал",
        "serving": "подаётся с сальсой", "interesting_facts": "родом из Мексики",
        "sort_order": 10,
    }
    try:
        r = editor_client.post("/api/admin/kitchen-categories", json=cat_payload)
        assert r.status_code == 201, r.text

        r = editor_client.post("/api/admin/kitchen-dishes", json=dish_payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["price_amount"] == 450
        assert body["timing_min_low"] == 10 and body["timing_min_high"] == 15
        assert body["weight_g"] == 300
        assert body["kcal_portion"] == 503
        assert body["protein_g"] == 29 and body["fat_g"] == 6.8 and body["carb_g"] == 75.7
        assert body["kcal_100g"] == 250
        assert body["category"] == "test-kitchen-category-snacks"

        # reflected in the consumer bundle, grouped under the category, with
        # parsed nutrition (incl. kcal100)
        bundle = editor_client.get("/api/content").json()
        assert any(
            kc["slug"] == "test-kitchen-category-snacks"
            for kc in bundle["kitchenCategories"]
        )
        d = next(x for x in bundle["kitchen"] if x["id"] == "test-kitchen-dish-nachos")
        assert d["categorySlug"] == "test-kitchen-category-snacks"
        assert d["price"] == 450 and d["weight"] == 300
        assert d["nutrition"]["kcal"] == 503
        assert d["nutrition"]["protein"] == 29
        assert d["nutrition"]["kcal100"] == 250

        # deleting a non-empty category is rejected
        r = editor_client.delete("/api/admin/kitchen-categories/test-kitchen-category-snacks")
        assert r.status_code == 409, r.text

        # update dish
        r = editor_client.patch(
            "/api/admin/kitchen-dishes/test-kitchen-dish-nachos",
            json={**dish_payload, "name": "Переименован"},
        )
        assert r.status_code == 200, r.text
        assert editor_client.get("/api/admin/kitchen-dishes/test-kitchen-dish-nachos").json()["name"] == "Переименован"
    finally:
        editor_client.delete("/api/admin/kitchen-dishes/test-kitchen-dish-nachos")
        r = editor_client.delete("/api/admin/kitchen-categories/test-kitchen-category-snacks")
        assert r.status_code == 204, r.text
        assert editor_client.get("/api/admin/kitchen-categories/test-kitchen-category-snacks").status_code == 404
        assert editor_client.get("/api/admin/kitchen-dishes/test-kitchen-dish-nachos").status_code == 404


def test_nutrition_override_wins_over_parsed(editor_client):
    cat = {"slug": "test-kitchen-category-override", "label": "override cat"}
    payload = {
        "slug": "test-kitchen-dish-override", "category": "test-kitchen-category-override",
        "name": "Override Dish",
        "nutrition_raw": "На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7. На 100 г: 250 ккал",
        "kcal_portion": 999,
    }
    try:
        assert editor_client.post("/api/admin/kitchen-categories", json=cat).status_code == 201
        r = editor_client.post("/api/admin/kitchen-dishes", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        # direct override wins over the parsed value (503)
        assert body["kcal_portion"] == 999
        # other parsed nutrition fields are unaffected
        assert body["protein_g"] == 29 and body["kcal_100g"] == 250
    finally:
        editor_client.delete("/api/admin/kitchen-dishes/test-kitchen-dish-override")
        editor_client.delete("/api/admin/kitchen-categories/test-kitchen-category-override")


def test_create_kitchen_category_duplicate_slug_conflicts(editor_client):
    p = {"slug": "test-kitchen-category-dup", "label": "dup"}
    try:
        assert editor_client.post("/api/admin/kitchen-categories", json=p).status_code == 201
        assert editor_client.post("/api/admin/kitchen-categories", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/kitchen-categories/test-kitchen-category-dup")


def test_create_kitchen_dish_duplicate_slug_conflicts(editor_client):
    cat = {"slug": "test-kitchen-category-dupentry", "label": "dup entry cat"}
    p = {"slug": "test-kitchen-dish-dup", "category": "test-kitchen-category-dupentry", "name": "dup"}
    try:
        assert editor_client.post("/api/admin/kitchen-categories", json=cat).status_code == 201
        assert editor_client.post("/api/admin/kitchen-dishes", json=p).status_code == 201
        assert editor_client.post("/api/admin/kitchen-dishes", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/kitchen-dishes/test-kitchen-dish-dup")
        editor_client.delete("/api/admin/kitchen-categories/test-kitchen-category-dupentry")


def test_kitchen_requires_editor(reader_client):
    assert reader_client.get("/api/admin/kitchen-dishes").status_code == 403
    assert reader_client.get("/api/admin/kitchen-categories").status_code == 403


def test_create_kitchen_dish_unknown_category_rejected(editor_client):
    payload = {
        "slug": "test-kitchen-dish-unknown-category", "category": "no-such-kitchen-category",
        "name": "Unknown Category Test",
    }
    r = editor_client.post("/api/admin/kitchen-dishes", json=payload)
    assert r.status_code == 400, r.text
    assert editor_client.get("/api/admin/kitchen-dishes/test-kitchen-dish-unknown-category").status_code == 404
