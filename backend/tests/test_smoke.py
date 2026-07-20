from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import login_client


def test_full_happy_path():
    with TestClient(app) as client:
        login_client(client)
        b = client.get("/api/content").json()
        assert b["drinks"] and b["classics"] and b["spirits"] and b["kitchen"]
        slug = b["kitchen"][0]["id"]
        client.post(f"/api/me/progress/kitchen/{slug}")
        assert slug in client.get("/api/me/progress").json()["kitchen"]
        client.delete(f"/api/me/progress/kitchen/{slug}")


def test_admin_and_docs_disabled():
    with TestClient(app) as client:
        assert client.get("/api/docs").status_code == 404
        assert client.post("/api/admin/cocktails", json={}).status_code in (404, 405)
