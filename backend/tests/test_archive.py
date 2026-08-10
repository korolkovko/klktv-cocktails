"""Task A2 — is_archived on drinks/classics/spirits/kitchen: hidden from the
guest-facing /api/content bundle (incl. section/family counts), still
listed (and gettable) in the admin CRUD surface.
"""


def test_archived_drink_hidden_from_content_but_visible_in_admin(editor_client):
    p = {"slug": "arch-x", "name": "Арх", "category": "osnovnye", "is_alcoholic": True, "is_zero_culture": False, "is_archived": True}
    try:
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/arch-x").json()["is_archived"] is True
        bundle = editor_client.get("/api/content").json()
        assert all(d["id"] != "arch-x" for d in bundle["drinks"])   # hidden from guest
    finally:
        editor_client.delete("/api/admin/drinks/arch-x")


def test_archived_classic_hidden_from_content_but_visible_in_admin(editor_client):
    p = {"slug": "arch-classic-x", "name": "Арх Классик", "family": "negroni", "is_archived": True}
    try:
        assert editor_client.post("/api/admin/classics", json=p).status_code == 201, editor_client.post("/api/admin/classics", json=p).text
        assert editor_client.get("/api/admin/classics/arch-classic-x").json()["is_archived"] is True
        bundle = editor_client.get("/api/content").json()
        assert all(c["id"] != "arch-classic-x" for c in bundle["classics"])   # hidden from guest
    finally:
        editor_client.delete("/api/admin/classics/arch-classic-x")


def test_archived_spirit_entry_hidden_from_content_but_visible_in_admin(editor_client):
    # Pick a real, existing spirit category (do not hard-code a guess).
    cats = editor_client.get("/api/admin/spirit-categories").json()
    assert cats, "no spirit categories seeded — cannot exercise this test"
    category = cats[0]["slug"]

    p = {"slug": "arch-spirit-x", "category": category, "name": "Арх Спирит", "is_archived": True}
    try:
        r = editor_client.post("/api/admin/spirits", json=p)
        assert r.status_code == 201, r.text
        assert editor_client.get("/api/admin/spirits/arch-spirit-x").json()["is_archived"] is True
        bundle = editor_client.get("/api/content").json()
        assert all(e["slug"] != "arch-spirit-x" for e in bundle["spirits"])   # hidden from guest
    finally:
        editor_client.delete("/api/admin/spirits/arch-spirit-x")


def test_archived_kitchen_dish_hidden_from_content_but_visible_in_admin(editor_client):
    # Pick a real, existing kitchen category (do not hard-code a guess).
    cats = editor_client.get("/api/admin/kitchen-categories").json()
    assert cats, "no kitchen categories seeded — cannot exercise this test"
    category = cats[0]["slug"]

    p = {"slug": "arch-dish-x", "category": category, "name": "Арх Блюдо", "is_archived": True}
    try:
        r = editor_client.post("/api/admin/kitchen-dishes", json=p)
        assert r.status_code == 201, r.text
        assert editor_client.get("/api/admin/kitchen-dishes/arch-dish-x").json()["is_archived"] is True
        bundle = editor_client.get("/api/content").json()
        assert all(d["id"] != "arch-dish-x" for d in bundle["kitchen"])   # hidden from guest
    finally:
        editor_client.delete("/api/admin/kitchen-dishes/arch-dish-x")
