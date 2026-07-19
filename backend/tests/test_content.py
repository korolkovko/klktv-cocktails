from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import login_client


def test_content_bundle_shape_and_counts():
    with TestClient(app) as client:
        login_client(client)
        r = client.get("/api/content")
        assert r.status_code == 200
        b = r.json()
        assert {"sections","drinks","classics","families","spiritCategories","spirits",
                "kitchenCategories","kitchen","filters"} <= set(b)
        assert len(b["drinks"]) == 26 and len(b["classics"]) == 67
        assert len(b["spirits"]) == 74 and len(b["kitchen"]) == 33
        # a non-alcoholic drink is present in the unified menu
        assert any(d["isAlcoholic"] is False for d in b["drinks"])
        # kit-exact keys
        d0 = b["drinks"][0]
        assert "logo" in d0 and "subtitle" in d0 and isinstance(d0["descriptors"], list)
        # spirit pairings key is camelCase (audit item 18)
        assert all("pairings" in s and "sourceUrl" in s for s in b["spirits"])
