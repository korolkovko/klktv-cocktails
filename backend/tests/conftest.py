import os
import tempfile

# Self-configure the test env BEFORE any `app.*` module is imported (below, or by any
# test module — conftest.py is collected first). Without this, TestClient sessions
# 401 (Secure cookie dropped over plain http) and app.main's UPLOAD_DIR.mkdir() fails
# outside a container (default is /app/uploads). Uses setdefault so a real CI/prod
# value set in the environment always wins. SECRET_KEY/DATABASE_URL are NOT faked here
# — they must come from the real env (see app/config.py's require_env).
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("COOKIE_SAMESITE", "lax")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="klktv-test-uploads-"))

import pytest
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password

SMOKE_USER = "smoke_reader"
SMOKE_PASS = "smoke-pass-12345"


@pytest.fixture(autouse=True, scope="session")
def _smoke_user():
    with SessionLocal() as db:
        existing = db.query(User).filter_by(username=SMOKE_USER).first()
        created = existing is None
        if created:
            db.add(User(username=SMOKE_USER, password_hash=hash_password(SMOKE_PASS), role="reader", name="Smoke"))
            db.commit()
    yield
    if created:
        with SessionLocal() as db:
            db.query(User).filter_by(username=SMOKE_USER).delete(); db.commit()


def login_client(client):
    r = client.post("/api/auth/login", json={"username": SMOKE_USER, "password": SMOKE_PASS})
    assert r.status_code == 200, r.text
    return client
