import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routers.auth import _ATTEMPTS


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # The login rate-limiter is deliberately in-process/global state (see
    # app/routers/auth.py). TestClient requests all share one fake client IP,
    # so without resetting this here, test_login_rate_limited_after_5 would
    # leak a maxed-out counter into every other test file's real logins
    # (test_content.py, test_progress.py) within the same 60s window.
    _ATTEMPTS.clear()
    yield
    _ATTEMPTS.clear()


def test_malformed_token_is_401_not_500():
    with TestClient(app) as client:
        client.cookies.set("klktv_session", "not.a.jwt")
        r = client.get("/api/auth/me")
        assert r.status_code == 401


def test_login_rate_limited_after_5():
    with TestClient(app) as client:
        codes = [client.post("/api/auth/login", json={"username": "nope", "password": "x"}).status_code
                 for _ in range(6)]
        assert codes[-1] == 429
