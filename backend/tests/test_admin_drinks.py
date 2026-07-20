def test_create_update_delete_drink(editor_client):
    payload = {
        "slug": "test-negroni", "name": "Тест Негрони", "subtitle": "проверка",
        "is_alcoholic": True, "is_zero_culture": False,
        "abv_raw": "24%", "price_raw": "650", "volume_ml": 90,
        "glass": "rocks", "badge": None,
        "spirits": ["gin"], "flavors": ["Горький"], "tags": ["gin", "bitter"],
        "details": [{"label": "О коктейле", "text": "многострочный\nтекст", "sort_order": 0}],
        "recipe": "джин, кампари, вермут", "sort_order": 500,
    }
    try:
        r = editor_client.post("/api/admin/drinks", json=payload)
        assert r.status_code == 201
        # reflected in the consumer bundle
        bundle = editor_client.get("/api/content").json()
        d = next(x for x in bundle["drinks"] if x["id"] == "test-negroni")
        assert d["spirit"] == "Джин" and "Джин" in d["spirits"]
        assert d["abv"] == 24 and d["price"] == 650 and d["volume"] == 90
        assert any(dt["label"] == "О коктейле" for dt in d["details"])
        # update
        r = editor_client.patch("/api/admin/drinks/test-negroni", json={**payload, "name": "Переименован"})
        assert r.status_code == 200
        assert editor_client.get("/api/admin/drinks/test-negroni").json()["name"] == "Переименован"
    finally:
        # delete
        assert editor_client.delete("/api/admin/drinks/test-negroni").status_code == 204
        assert editor_client.get("/api/admin/drinks/test-negroni").status_code == 404


def test_create_drink_duplicate_slug_conflicts(editor_client):
    p = {"slug": "dieter", "name": "dup", "is_alcoholic": True, "is_zero_culture": False}
    assert editor_client.post("/api/admin/drinks", json=p).status_code == 409


def test_drinks_require_editor(reader_client):
    assert reader_client.get("/api/admin/drinks").status_code == 403
