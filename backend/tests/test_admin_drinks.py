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


def test_blank_tag_key_rejected_and_not_persisted(editor_client):
    from app.database import SessionLocal
    from app.models import Tag, Flavor

    payload = {
        "slug": "test-blank-tag", "name": "Blank Tag Test",
        "is_alcoholic": True, "is_zero_culture": False,
        "tags": ["   "],
    }
    try:
        r = editor_client.post("/api/admin/drinks", json=payload)
        assert r.status_code == 400, r.text
        assert editor_client.get("/api/admin/drinks/test-blank-tag").status_code == 404

        # Same guard applies on PATCH against an existing drink, and blank
        # flavors must be rejected too — neither should leave a row behind.
        p = {**payload, "tags": ["gin"]}
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        r = editor_client.patch(
            "/api/admin/drinks/test-blank-tag",
            json={**p, "flavors": ["  "]},
        )
        assert r.status_code == 400, r.text
    finally:
        editor_client.delete("/api/admin/drinks/test-blank-tag")
        with SessionLocal() as db:
            assert db.query(Tag).filter_by(key="").first() is None
            assert db.query(Flavor).filter_by(label="").first() is None


def test_slug_rename_reconciles_learning_progress(editor_client):
    slug = "test-rename-progress"
    new_slug = "test-rename-progress-v2"
    payload = {
        "slug": slug, "name": "Rename Progress Test",
        "is_alcoholic": True, "is_zero_culture": False,
    }
    try:
        assert editor_client.post("/api/admin/drinks", json=payload).status_code == 201
        # Mark learned as the logged-in (editor) user against the OLD slug.
        assert editor_client.post(f"/api/me/progress/menu/{slug}").status_code == 204
        assert slug in editor_client.get("/api/me/progress").json()["menu"]

        r = editor_client.patch(f"/api/admin/drinks/{slug}", json={**payload, "slug": new_slug})
        assert r.status_code == 200, r.text

        progress = editor_client.get("/api/me/progress").json()["menu"]
        assert new_slug in progress
        assert slug not in progress
    finally:
        editor_client.delete(f"/api/admin/drinks/{slug}")
        editor_client.delete(f"/api/admin/drinks/{new_slug}")
        editor_client.delete(f"/api/me/progress/menu/{slug}")
        editor_client.delete(f"/api/me/progress/menu/{new_slug}")


def test_is_hot_roundtrips_and_reaches_guest(editor_client):
    p = {"slug":"hot-x","name":"Горячий","is_alcoholic":True,"is_zero_culture":False,"is_hot":True}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/hot-x").json()["is_hot"] is True
        d = next(x for x in editor_client.get("/api/content").json()["drinks"] if x["id"]=="hot-x")
        assert d["isHot"] is True and d.get("badge") in (None,)  # hot is its own flag, not a badge
    finally:
        editor_client.delete("/api/admin/drinks/hot-x")
