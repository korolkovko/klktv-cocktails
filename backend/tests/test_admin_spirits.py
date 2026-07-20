def test_create_update_delete_category_and_entry(editor_client):
    cat_payload = {
        "slug": "test-spirit-category-gin", "label": "Тест Джин",
        "sort_order": 500, "is_archived": False,
    }
    entry_payload = {
        "slug": "test-spirit-gin-entry", "category": "test-spirit-category-gin",
        "name": "Тест Бифитер", "img": "gin.jpg",
        "abv_raw": "40%", "price_raw": "500р за 50 мл",
        "flavour": "цитрусовый", "brand": "Beefeater", "country": "UK",
        "description": "классический лондонский сухой джин",
        "features": "хвойные ноты", "cocktail_pairings": "Мартини, Джин-тоник",
        "fact": "производится с 1863 года",
        "source_url": "https://example.com/beefeater",
        "sort_order": 10,
    }
    try:
        r = editor_client.post("/api/admin/spirit-categories", json=cat_payload)
        assert r.status_code == 201, r.text

        r = editor_client.post("/api/admin/spirits", json=entry_payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["abv"] == 40
        assert body["price_amount"] == 500 and body["serving_ml"] == 50
        assert body["category"] == "test-spirit-category-gin"

        # reflected in the consumer bundle, grouped under the category
        bundle = editor_client.get("/api/content").json()
        assert any(
            sc["slug"] == "test-spirit-category-gin"
            for sc in bundle["spiritCategories"]
        )
        e = next(x for x in bundle["spirits"] if x["slug"] == "test-spirit-gin-entry")
        assert e["categorySlug"] == "test-spirit-category-gin"
        assert e["abv"] == 40
        assert e["price"] == 500 and e["serving"] == 50
        assert e["brand"] == "Beefeater"

        # deleting a non-empty category is rejected
        r = editor_client.delete("/api/admin/spirit-categories/test-spirit-category-gin")
        assert r.status_code == 409, r.text

        # update entry
        r = editor_client.patch(
            "/api/admin/spirits/test-spirit-gin-entry",
            json={**entry_payload, "name": "Переименован"},
        )
        assert r.status_code == 200, r.text
        assert editor_client.get("/api/admin/spirits/test-spirit-gin-entry").json()["name"] == "Переименован"
    finally:
        editor_client.delete("/api/admin/spirits/test-spirit-gin-entry")
        r = editor_client.delete("/api/admin/spirit-categories/test-spirit-category-gin")
        assert r.status_code == 204, r.text
        assert editor_client.get("/api/admin/spirit-categories/test-spirit-category-gin").status_code == 404
        assert editor_client.get("/api/admin/spirits/test-spirit-gin-entry").status_code == 404


def test_create_spirit_category_duplicate_slug_conflicts(editor_client):
    p = {"slug": "test-spirit-category-dup", "label": "dup"}
    try:
        assert editor_client.post("/api/admin/spirit-categories", json=p).status_code == 201
        assert editor_client.post("/api/admin/spirit-categories", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/spirit-categories/test-spirit-category-dup")


def test_create_spirit_duplicate_slug_conflicts(editor_client):
    cat = {"slug": "test-spirit-category-dupentry", "label": "dup entry cat"}
    p = {"slug": "test-spirit-dup-entry", "category": "test-spirit-category-dupentry", "name": "dup"}
    try:
        assert editor_client.post("/api/admin/spirit-categories", json=cat).status_code == 201
        assert editor_client.post("/api/admin/spirits", json=p).status_code == 201
        assert editor_client.post("/api/admin/spirits", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/spirits/test-spirit-dup-entry")
        editor_client.delete("/api/admin/spirit-categories/test-spirit-category-dupentry")


def test_spirits_require_editor(reader_client):
    assert reader_client.get("/api/admin/spirits").status_code == 403
    assert reader_client.get("/api/admin/spirit-categories").status_code == 403


def test_create_spirit_unknown_category_rejected(editor_client):
    payload = {
        "slug": "test-spirit-unknown-category", "category": "no-such-spirit-category",
        "name": "Unknown Category Test",
    }
    r = editor_client.post("/api/admin/spirits", json=payload)
    assert r.status_code == 400, r.text
    assert editor_client.get("/api/admin/spirits/test-spirit-unknown-category").status_code == 404
