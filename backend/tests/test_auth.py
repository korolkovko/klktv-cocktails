import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routers.auth import _FAILED_ATTEMPTS
from tests.conftest import SMOKE_USER, SMOKE_PASS


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # The login rate-limiter is deliberately in-process/global state (see
    # app/routers/auth.py). TestClient requests all share one fake client IP,
    # so without resetting this here, test_login_rate_limited_after_5 would
    # leak a maxed-out counter into every other test file's real logins
    # (test_content.py, test_progress.py) within the same 60s window.
    _FAILED_ATTEMPTS.clear()
    yield
    _FAILED_ATTEMPTS.clear()


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


def test_login_successes_do_not_trip_limiter():
    # Redesign guard: the limiter tracks FAILURES per (ip, username), not
    # attempts overall — 6 consecutive successful logins for the same
    # account (e.g. several staff sharing a venue NAT) must all succeed.
    with TestClient(app) as client:
        codes = [client.post("/api/auth/login", json={"username": SMOKE_USER, "password": SMOKE_PASS}).status_code
                 for _ in range(6)]
        assert codes == [200] * 6
