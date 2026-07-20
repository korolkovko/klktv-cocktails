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
from sqlalchemy.exc import IntegrityError
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password

SMOKE_USER = "smoke_reader"
SMOKE_PASS = "smoke-pass-12345"


@pytest.fixture(autouse=True, scope="session")
def _smoke_user():
    # Race-safe get-or-create: two concurrent test runs (or a leftover row
    # from a prior run that crashed before teardown) can both see "no
    # existing user" and both attempt the insert. Rely on the DB's unique
    # constraint on username to arbitrate — whoever loses the race just
    # rolls back and re-queries the row the winner created, rather than
    # raising and failing collection.
    created = False
    with SessionLocal() as db:
        existing = db.query(User).filter_by(username=SMOKE_USER).first()
        if existing is None:
            db.add(User(username=SMOKE_USER, password_hash=hash_password(SMOKE_PASS), role="reader", name="Smoke"))
            try:
                db.commit()
                created = True
            except IntegrityError:
                db.rollback()
                existing = db.query(User).filter_by(username=SMOKE_USER).first()
                assert existing is not None, "insert failed but no existing row found on retry"
    yield
    if created:
        with SessionLocal() as db:
            db.query(User).filter_by(username=SMOKE_USER).delete(); db.commit()


def login_client(client):
    r = client.post("/api/auth/login", json={"username": SMOKE_USER, "password": SMOKE_PASS})
    assert r.status_code == 200, r.text
    return client
