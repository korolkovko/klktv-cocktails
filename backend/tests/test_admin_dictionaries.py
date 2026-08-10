"""Admin CRUD for the small lookup dictionaries (glasses/badges/ice-types)
and `drink.ice` wiring — Task A4 of the drinks-evolution plan.

Glasses/badges/ice-types are flat key/label/sort_order rows, much like
`families` (see test_admin_families_users.py — same key-in-URL,
try/finally-cleanup conventions), except they're also referenced by
`drinks.glass_id` / `badge_id` / `ice_id`, so DELETE must 409 while a
drink still points at them (mirroring the family/classic 409 guard).

`ice` differs from `glass`/`badge` on the drink-write path: it's a
*strict* reference (400 on an unknown key), not get-or-create — see
`_get_ice_or_400` in app/routers/admin.py.
"""
import pytest


def test_ice_dictionary_crud_and_drink_uses_it(editor_client):
    assert editor_client.post("/api/admin/ice-types", json={"label": "Большой куб"}).status_code == 201
    ice = next(i for i in editor_client.get("/api/admin/ice-types").json() if i["label"] == "Большой куб")
    assert ice["key"]  # server-derived, non-empty
    try:
        p = {"slug": "ice-drink", "name": "Айс", "category": "osnovnye", "is_alcoholic": True, "is_zero_culture": False, "ice": ice["key"]}
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        assert editor_client.get("/api/admin/drinks/ice-drink").json()["ice"] == ice["key"]
        d = next(x for x in editor_client.get("/api/content").json()["drinks"] if x["id"] == "ice-drink")
        assert d["ice"] == "Большой куб"          # guest sees the label
    finally:
        editor_client.delete("/api/admin/drinks/ice-drink")
        editor_client.delete(f"/api/admin/ice-types/{ice['key']}")


def test_delete_ice_type_in_use_conflicts(editor_client):
    assert editor_client.post(
        "/api/admin/ice-types", json={"key": "test-ice-inuse", "label": "Тест лёд"}
    ).status_code == 201
    try:
        p = {
            "slug": "ice-inuse-drink", "name": "Тест", "category": "osnovnye", "is_alcoholic": True,
            "is_zero_culture": False, "ice": "test-ice-inuse",
        }
        assert editor_client.post("/api/admin/drinks", json=p).status_code == 201
        try:
            r = editor_client.delete("/api/admin/ice-types/test-ice-inuse")
            assert r.status_code == 409, r.text
        finally:
            editor_client.delete("/api/admin/drinks/ice-inuse-drink")
        # no longer referenced -> delete now succeeds
        assert editor_client.delete("/api/admin/ice-types/test-ice-inuse").status_code == 204
    finally:
        editor_client.delete("/api/admin/ice-types/test-ice-inuse")


def test_dictionaries_require_editor(reader_client):
    for e in ("glasses", "badges", "ice-types"):
        assert reader_client.get(f"/api/admin/{e}").status_code == 403


def test_drink_write_rejects_unknown_ice_key(editor_client):
    p = {
        "slug": "bad-ice-drink", "name": "X", "category": "osnovnye", "is_alcoholic": True,
        "is_zero_culture": False, "ice": "no-such-ice-key",
    }
    try:
        r = editor_client.post("/api/admin/drinks", json=p)
        assert r.status_code == 400, r.text
        assert editor_client.get("/api/admin/drinks/bad-ice-drink").status_code == 404
    finally:
        editor_client.delete("/api/admin/drinks/bad-ice-drink")


def test_drink_ice_is_optional(editor_client):
    # Omitting `ice` entirely must not break drink writes (most drinks won't
    # set it) — ice_id stays NULL and the admin/guest views both show None.
    p = {"slug": "no-ice-drink", "name": "Без льда", "category": "osnovnye", "is_alcoholic": True, "is_zero_culture": False}
    try:
        r = editor_client.post("/api/admin/drinks", json=p)
        assert r.status_code == 201, r.text
        assert r.json()["ice"] is None
        d = next(x for x in editor_client.get("/api/content").json()["drinks"] if x["id"] == "no-ice-drink")
        assert d["ice"] is None
    finally:
        editor_client.delete("/api/admin/drinks/no-ice-drink")


@pytest.mark.parametrize("entity", ["glasses", "badges", "ice-types"])
def test_dictionary_crud_roundtrip(editor_client, entity):
    payload = {"key": f"test-{entity}-crud", "label": "Тест", "sort_order": 7}
    try:
        r = editor_client.post(f"/api/admin/{entity}", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["key"] == payload["key"]
        assert body["label"] == "Тест"
        assert body["sort_order"] == 7
        assert isinstance(body["id"], int)

        assert editor_client.get(f"/api/admin/{entity}/{payload['key']}").json() == body

        r = editor_client.patch(
            f"/api/admin/{entity}/{payload['key']}", json={**payload, "label": "Переименован"}
        )
        assert r.status_code == 200, r.text
        assert editor_client.get(f"/api/admin/{entity}/{payload['key']}").json()["label"] == "Переименован"

        r = editor_client.delete(f"/api/admin/{entity}/{payload['key']}")
        assert r.status_code == 204, r.text
        assert editor_client.get(f"/api/admin/{entity}/{payload['key']}").status_code == 404
    finally:
        editor_client.delete(f"/api/admin/{entity}/{payload['key']}")


@pytest.mark.parametrize("entity", ["glasses", "badges", "ice-types"])
def test_dictionary_key_derived_from_label_when_omitted(editor_client, entity):
    r = editor_client.post(f"/api/admin/{entity}", json={"label": "Кубический Лёд Тест"})
    assert r.status_code == 201, r.text
    key = r.json()["key"]
    assert key  # server-derived, non-empty
    try:
        assert editor_client.get(f"/api/admin/{entity}/{key}").status_code == 200
    finally:
        editor_client.delete(f"/api/admin/{entity}/{key}")


@pytest.mark.parametrize("entity", ["glasses", "badges", "ice-types"])
def test_dictionary_duplicate_key_conflicts(editor_client, entity):
    p = {"key": f"test-{entity}-dup", "label": "dup"}
    try:
        assert editor_client.post(f"/api/admin/{entity}", json=p).status_code == 201
        assert editor_client.post(f"/api/admin/{entity}", json=p).status_code == 409
    finally:
        editor_client.delete(f"/api/admin/{entity}/{p['key']}")


def test_get_missing_dictionary_entry_404(editor_client):
    for e in ("glasses", "badges", "ice-types"):
        assert editor_client.get(f"/api/admin/{e}/no-such-key").status_code == 404
