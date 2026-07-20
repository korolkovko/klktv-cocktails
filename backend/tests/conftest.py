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
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from app.database import SessionLocal
from app.main import app
from app.models import User
from app.auth import hash_password

SMOKE_USER = "smoke_reader"
SMOKE_PASS = "smoke-pass-12345"
EDITOR_USER = "smoke_editor"
EDITOR_PASS = "editor-pass-12345"
READER_USER = "smoke_reader2"
READER_PASS = "reader-pass-12345"


def _get_or_create_user(username: str, password: str, role: str, name: str) -> bool:
    # Race-safe get-or-create: two concurrent test runs (or a leftover row
    # from a prior run that crashed before teardown) can both see "no
    # existing user" and both attempt the insert. Rely on the DB's unique
    # constraint on username to arbitrate — whoever loses the race just
    # rolls back and re-queries the row the winner created, rather than
    # raising and failing collection.
    created = False
    with SessionLocal() as db:
        existing = db.query(User).filter_by(username=username).first()
        if existing is None:
            db.add(User(username=username, password_hash=hash_password(password), role=role, name=name))
            try:
                db.commit()
                created = True
            except IntegrityError:
                db.rollback()
                existing = db.query(User).filter_by(username=username).first()
                assert existing is not None, "insert failed but no existing row found on retry"
    return created


def _delete_user(username: str) -> None:
    with SessionLocal() as db:
        db.query(User).filter_by(username=username).delete(); db.commit()


@pytest.fixture(autouse=True, scope="session")
def _smoke_user():
    created = _get_or_create_user(SMOKE_USER, SMOKE_PASS, "reader", "Smoke")
    yield
    if created:
        _delete_user(SMOKE_USER)


@pytest.fixture(autouse=True, scope="session")
def _editor_user():
    created = _get_or_create_user(EDITOR_USER, EDITOR_PASS, "editor", "Smoke Editor")
    yield
    if created:
        _delete_user(EDITOR_USER)


@pytest.fixture(autouse=True, scope="session")
def _reader_user():
    created = _get_or_create_user(READER_USER, READER_PASS, "reader", "Smoke Reader")
    yield
    if created:
        _delete_user(READER_USER)


def login_client(client, username: str = SMOKE_USER, password: str = SMOKE_PASS):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return client


@pytest.fixture
def editor_client():
    """TestClient authenticated as an `editor`-role user."""
    with TestClient(app) as client:
        yield login_client(client, EDITOR_USER, EDITOR_PASS)


@pytest.fixture
def reader_client():
    """TestClient authenticated as a `reader`-role user."""
    with TestClient(app) as client:
        yield login_client(client, READER_USER, READER_PASS)
