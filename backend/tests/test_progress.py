from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import login_client  # created in Task 6


def test_progress_roundtrip():
    with TestClient(app) as client:
        login_client(client)
        slug = client.get("/api/content").json()["classics"][0]["id"]
        assert client.post(f"/api/me/progress/classics/{slug}").status_code == 204
        assert slug in client.get("/api/me/progress").json()["classics"]
        # idempotent second POST does not error
        assert client.post(f"/api/me/progress/classics/{slug}").status_code == 204
        assert client.delete(f"/api/me/progress/classics/{slug}").status_code == 204
        assert slug not in client.get("/api/me/progress").json()["classics"]


def test_unknown_kind_400():
    with TestClient(app) as client:
        login_client(client)
        assert client.post("/api/me/progress/bogus/x").status_code == 400
