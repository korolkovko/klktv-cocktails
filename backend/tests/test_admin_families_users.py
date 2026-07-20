from fastapi.testclient import TestClient

from app.main import app


def test_create_update_delete_family_reflected_in_content(editor_client):
    payload = {
        "key": "test-family-tiki", "label": "Тест Тики", "sub": "тропический стиль",
        "color": "#FF6600", "logic": "ром + сок + сироп", "evolution": "от простого к сложному",
        "tip": "используйте свежий сок", "sort_order": 500,
    }
    try:
        r = editor_client.post("/api/admin/families", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["key"] == "test-family-tiki" and body["label"] == "Тест Тики"
        assert body["sub"] == "тропический стиль" and body["color"] == "#FF6600"

        # reflected in the consumer bundle (content.py maps key->code/tint)
        bundle = editor_client.get("/api/content").json()
        fam = next(f for f in bundle["families"] if f["code"] == "TEST-FAMILY-TIKI")
        assert fam["tint"] == "test-family-tiki"
        assert fam["title"] == "Тест Тики"
        assert fam["logic"] == "ром + сок + сироп"
        assert fam["total"] == 0

        # update
        r = editor_client.patch(
            "/api/admin/families/test-family-tiki",
            json={**payload, "label": "Переименован"},
        )
        assert r.status_code == 200, r.text
        assert editor_client.get("/api/admin/families/test-family-tiki").json()["label"] == "Переименован"

        bundle = editor_client.get("/api/content").json()
        fam = next(f for f in bundle["families"] if f["code"] == "TEST-FAMILY-TIKI")
        assert fam["title"] == "Переименован"
    finally:
        r = editor_client.delete("/api/admin/families/test-family-tiki")
        assert r.status_code == 204, r.text
        assert editor_client.get("/api/admin/families/test-family-tiki").status_code == 404

    bundle = editor_client.get("/api/content").json()
    assert not any(f["code"] == "TEST-FAMILY-TIKI" for f in bundle["families"])


def test_create_family_duplicate_key_conflicts(editor_client):
    p = {"key": "test-family-dup", "label": "dup"}
    try:
        assert editor_client.post("/api/admin/families", json=p).status_code == 201
        assert editor_client.post("/api/admin/families", json=p).status_code == 409
    finally:
        editor_client.delete("/api/admin/families/test-family-dup")


def test_families_require_editor(reader_client):
    assert reader_client.get("/api/admin/families").status_code == 403
    assert reader_client.post("/api/admin/families", json={"key": "x", "label": "x"}).status_code == 403


def test_delete_family_still_in_use_rejected(editor_client):
    # "negroni" is a real seeded family with classics attached — must be blocked.
    r = editor_client.delete("/api/admin/families/negroni")
    assert r.status_code == 409, r.text


def test_get_missing_family_404(editor_client):
    assert editor_client.get("/api/admin/families/no-such-family").status_code == 404


# ── Categories / sections ─────────────────────────────────────

def test_categories_require_editor(reader_client):
    assert reader_client.get("/api/admin/categories").status_code == 403


def test_list_categories_includes_fixed_set(editor_client):
    keys = {c["key"] for c in editor_client.get("/api/admin/categories").json()}
    assert {"menu", "classics", "spirits", "kitchen"} <= keys


def test_patch_and_reorder_categories_roundtrip(editor_client):
    # Snapshot so we can restore the real (shared, fixed) rows afterwards —
    # these drive /api/content's visible sections for every real user.
    original = editor_client.get("/api/admin/categories").json()
    try:
        target = next(c for c in original if c["key"] == "kitchen")
        r = editor_client.patch(
            "/api/admin/categories/kitchen",
            json={"label": "Кухня-Тест", "is_visible": False, "sort_order": 99},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["label"] == "Кухня-Тест"
        assert body["is_visible"] is False
        assert body["sort_order"] == 99
        assert body["kind"] == target["kind"]  # kind is not patchable

        ordered_keys = [c["key"] for c in sorted(original, key=lambda c: c["sort_order"])]
        reversed_keys = list(reversed(ordered_keys))
        r = editor_client.post("/api/admin/categories/reorder", json={"keys": reversed_keys})
        assert r.status_code == 200, r.text
        got = {c["key"]: c["sort_order"] for c in r.json()}
        for i, key in enumerate(reversed_keys):
            assert got[key] == i
    finally:
        for c in original:
            editor_client.patch(
                f"/api/admin/categories/{c['key']}",
                json={"label": c["label"], "is_visible": c["is_visible"], "sort_order": c["sort_order"]},
            )
        restored = editor_client.get("/api/admin/categories").json()
        for c in restored:
            orig = next(o for o in original if o["key"] == c["key"])
            assert c["label"] == orig["label"]
            assert c["is_visible"] == orig["is_visible"]
            assert c["sort_order"] == orig["sort_order"]


def test_reorder_categories_unknown_key_rejected(editor_client):
    r = editor_client.post("/api/admin/categories/reorder", json={"keys": ["no-such-category-key"]})
    assert r.status_code == 400, r.text


def test_patch_missing_category_404(editor_client):
    assert editor_client.patch("/api/admin/categories/no-such-category", json={"label": "x"}).status_code == 404


# ── admin_users ────────────────────────────────────────────────

def test_admin_users_requires_admin_role(editor_client):
    assert editor_client.get("/api/admin/users").status_code == 403


def test_admin_can_list_create_patch_delete_users(admin_client):
    create_payload = {
        "username": "test-throwaway-user", "password": "throwaway-pass-1",
        "role": "reader", "name": "Throwaway",
    }
    try:
        # list
        r = admin_client.get("/api/admin/users")
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list) and len(users) > 0
        for u in users:
            assert "password_hash" not in u
            assert "last_seen_at" in u  # present, read-only

        # create
        r = admin_client.post("/api/admin/users", json=create_payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["username"] == "test-throwaway-user"
        assert body["role"] == "reader"
        assert "password_hash" not in body

        # patch role + password
        r = admin_client.patch(
            "/api/admin/users/test-throwaway-user",
            json={"role": "editor", "password": "new-throwaway-pass"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "editor"
        assert "password_hash" not in r.json()

        # new password works for login — use a separate client so we don't
        # clobber admin_client's own session cookie with the throwaway user's
        with TestClient(app) as throwaway_client:
            login = throwaway_client.post(
                "/api/auth/login",
                json={"username": "test-throwaway-user", "password": "new-throwaway-pass"},
            )
            assert login.status_code == 200, login.text

        # delete
        r = admin_client.delete("/api/admin/users/test-throwaway-user")
        assert r.status_code == 204, r.text
        assert not any(
            u["username"] == "test-throwaway-user" for u in admin_client.get("/api/admin/users").json()
        )
    finally:
        admin_client.delete("/api/admin/users/test-throwaway-user")


def test_admin_cannot_delete_or_demote_self(admin_client):
    me = next(u for u in admin_client.get("/api/admin/users").json() if u["username"] == "smoke_admin")

    r = admin_client.patch(f"/api/admin/users/{me['id']}", json={"role": "reader"})
    assert r.status_code in (400, 403), r.text
    # role unchanged
    assert next(u for u in admin_client.get("/api/admin/users").json() if u["id"] == me["id"])["role"] == "admin"

    r = admin_client.delete(f"/api/admin/users/{me['id']}")
    assert r.status_code in (400, 403), r.text
    # still present
    assert any(u["id"] == me["id"] for u in admin_client.get("/api/admin/users").json())


def test_create_user_duplicate_username_conflicts(admin_client):
    p = {"username": "test-dup-user", "password": "dup-pass-12345", "role": "reader"}
    try:
        assert admin_client.post("/api/admin/users", json=p).status_code == 201
        assert admin_client.post("/api/admin/users", json=p).status_code == 409
    finally:
        admin_client.delete("/api/admin/users/test-dup-user")
