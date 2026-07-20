def test_create_update_delete_classic(editor_client):
    payload = {
        "slug": "test-classic-negroni", "name": "Тест Классик Негрони",
        "family": "negroni", "year": 1919, "origin": "Флоренция",
        "composition": "джин, кампари, вермут", "glass": "rocks",
        "garnish": "апельсиновая цедра", "history": "давняя история",
        "for_whom": "для любителей горького", "sort_order": 500,
        "spirits": ["gin"], "descriptors": ["Горький"],
        "related_drinks": ["dieter"],
    }
    try:
        r = editor_client.post("/api/admin/classics", json=payload)
        assert r.status_code == 201, r.text
        # reflected in the consumer bundle
        bundle = editor_client.get("/api/content").json()
        c = next(x for x in bundle["classics"] if x["id"] == "test-classic-negroni")
        assert c["family"] == "negroni"
        assert c["year"] == "1919"
        assert any(oa["menuId"] == "dieter" for oa in c["ourAnswers"])
        # update
        r = editor_client.patch(
            "/api/admin/classics/test-classic-negroni",
            json={**payload, "name": "Переименован"},
        )
        assert r.status_code == 200, r.text
        assert editor_client.get("/api/admin/classics/test-classic-negroni").json()["name"] == "Переименован"
    finally:
        # delete
        assert editor_client.delete("/api/admin/classics/test-classic-negroni").status_code == 204
        assert editor_client.get("/api/admin/classics/test-classic-negroni").status_code == 404


def test_create_classic_duplicate_slug_conflicts(editor_client):
    p = {
        "slug": "test-classic-negroni-dup", "name": "dup", "family": "negroni",
    }
    try:
        assert editor_client.post("/api/admin/classics", json=p).status_code == 201
        assert editor_client.post("/api/admin/classics", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/classics/test-classic-negroni-dup")


def test_classics_require_editor(reader_client):
    assert reader_client.get("/api/admin/classics").status_code == 403


def test_create_classic_unknown_family_rejected(editor_client):
    payload = {
        "slug": "test-classic-unknown-family", "name": "Unknown Family Test",
        "family": "no-such-family",
    }
    r = editor_client.post("/api/admin/classics", json=payload)
    assert r.status_code == 400, r.text
    assert editor_client.get("/api/admin/classics/test-classic-unknown-family").status_code == 404


def test_create_classic_unknown_related_drink_skipped(editor_client):
    payload = {
        "slug": "test-classic-unknown-related", "name": "Unknown Related Test",
        "family": "negroni", "related_drinks": ["no-such-drink-slug"],
    }
    try:
        r = editor_client.post("/api/admin/classics", json=payload)
        assert r.status_code == 201, r.text
        assert r.json()["related_drinks"] == []
    finally:
        editor_client.delete("/api/admin/classics/test-classic-unknown-related")


def test_blank_descriptor_label_rejected_and_not_persisted(editor_client):
    from app.database import SessionLocal
    from app.models import Descriptor

    payload = {
        "slug": "test-classic-blank-descriptor", "name": "Blank Descriptor Test",
        "family": "negroni", "descriptors": ["   "],
    }
    try:
        r = editor_client.post("/api/admin/classics", json=payload)
        assert r.status_code == 400, r.text
        assert editor_client.get("/api/admin/classics/test-classic-blank-descriptor").status_code == 404

        p = {**payload, "descriptors": ["Крепкий"]}
        assert editor_client.post("/api/admin/classics", json=p).status_code == 201
        r = editor_client.patch(
            "/api/admin/classics/test-classic-blank-descriptor",
            json={**p, "spirits": ["  "]},
        )
        assert r.status_code == 400, r.text
    finally:
        editor_client.delete("/api/admin/classics/test-classic-blank-descriptor")
        with SessionLocal() as db:
            assert db.query(Descriptor).filter_by(label="").first() is None
