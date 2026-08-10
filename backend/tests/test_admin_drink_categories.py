"""Admin CRUD for drink-categories and drink.category wiring — Task B2 of
the drinks-evolution plan.

Mirrors `test_admin_kitchen.py`'s kitchen-category conventions:
`DrinkWriteIn.category` is a *strict* reference (400 on an unknown slug),
not get-or-create; DELETE 409s while a drink still points at the category.
"""


def test_drink_category_crud_and_grouping(editor_client):
    assert editor_client.post("/api/admin/drink-categories", json={"slug": "signature", "label": "Сигнатурные"}).status_code == 201
    p = {"slug": "cat-drink", "name": "Кэт", "is_alcoholic": True, "is_zero_culture": False, "category": "signature"}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        b = editor_client.get("/api/content").json()
        assert any(c["slug"] == "signature" for c in b["drinkCategories"])
        assert next(d for d in b["drinks"] if d["id"] == "cat-drink")["categorySlug"] == "signature"
    finally:
        editor_client.delete("/api/admin/drinks/cat-drink")
        editor_client.delete("/api/admin/drink-categories/signature")


def test_delete_nonempty_drink_category_conflicts(editor_client):
    assert editor_client.post("/api/admin/drink-categories", json={"slug": "test-dc-nonempty", "label": "Непустая"}).status_code == 201
    p = {
        "slug": "test-dc-nonempty-drink", "name": "Непустой Напиток",
        "is_alcoholic": True, "is_zero_culture": False, "category": "test-dc-nonempty",
    }
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        r = editor_client.delete("/api/admin/drink-categories/test-dc-nonempty")
        assert r.status_code == 409, r.text
    finally:
        editor_client.delete("/api/admin/drinks/test-dc-nonempty-drink")
    # no longer referenced -> delete now succeeds
    assert editor_client.delete("/api/admin/drink-categories/test-dc-nonempty").status_code == 204


def test_create_drink_unknown_category_400(editor_client):
    p = {
        "slug": "test-dc-unknown-category-drink", "name": "Unknown Category Test",
        "is_alcoholic": True, "is_zero_culture": False, "category": "no-such-drink-category",
    }
    r = editor_client.post("/api/admin/drinks", json=p)
    assert r.status_code == 400, r.text
    assert editor_client.get("/api/admin/drinks/test-dc-unknown-category-drink").status_code == 404


def test_drink_category_duplicate_slug_conflicts(editor_client):
    p = {"slug": "test-dc-dup", "label": "dup"}
    try:
        assert editor_client.post("/api/admin/drink-categories", json=p).status_code == 201
        assert editor_client.post("/api/admin/drink-categories", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/drink-categories/test-dc-dup")


def test_drink_categories_require_editor(reader_client):
    assert reader_client.get("/api/admin/drink-categories").status_code == 403


def test_drink_category_update_roundtrip(editor_client):
    p = {"slug": "test-dc-rename", "label": "До", "sort_order": 5}
    try:
        assert editor_client.post("/api/admin/drink-categories", json=p).status_code == 201
        r = editor_client.patch("/api/admin/drink-categories/test-dc-rename", json={**p, "label": "После"})
        assert r.status_code == 200, r.text
        assert editor_client.get("/api/admin/drink-categories/test-dc-rename").json()["label"] == "После"
    finally:
        editor_client.delete("/api/admin/drink-categories/test-dc-rename")
        assert editor_client.get("/api/admin/drink-categories/test-dc-rename").status_code == 404
