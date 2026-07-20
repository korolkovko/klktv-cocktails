import os
import shutil
import tempfile
from pathlib import Path

# Self-configure the test env BEFORE any `app.*` module is imported (below, or by any
# test module — conftest.py is collected first). Without this, TestClient sessions
# 401 (Secure cookie dropped over plain http) and app.main's UPLOAD_DIR.mkdir() fails
# outside a container (default is /app/uploads) when no UPLOAD_DIR is exported at
# all. Uses setdefault so it's purely an *import-time* safety net against that crash
# — it is NOT what isolates test uploads from a real dev UPLOAD_DIR (the documented
# dev workflow exports `UPLOAD_DIR=$(pwd)/.uploads` in the same shell tests run from,
# which makes setdefault a no-op). That isolation is enforced unconditionally below
# by the `_isolated_upload_dir` fixture. SECRET_KEY/DATABASE_URL are NOT faked here
# — they must come from the real env (see app/config.py's require_env).
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("COOKIE_SAMESITE", "lax")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="klktv-test-uploads-import-"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
import app.main as app_main
import app.routers.uploads as uploads_module
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
def _isolated_upload_dir():
    """Uploads written during tests must NEVER land in a real dev UPLOAD_DIR
    (e.g. backend/.uploads) — the documented dev workflow exports
    `UPLOAD_DIR=$(pwd)/.uploads` in the same shell tests are run from, which
    makes the import-time `os.environ.setdefault(...)` above a no-op. So this
    override is unconditional: regardless of what UPLOAD_DIR resolved to at
    import time, patch the already-imported module attributes the upload
    endpoints actually read at request time (plain module globals, re-looked-up
    on every call rather than captured at import) to point at a fresh temp dir
    for the whole test session."""
    tmp = Path(tempfile.mkdtemp(prefix="klktv-test-uploads-"))
    uploads_module.UPLOAD_DIR = tmp  # actual write path: uploads.upload_image() / resize_existing()
    app_main.UPLOAD_DIR = tmp        # read by app.main's lifespan mkdir on every TestClient startup
    yield
    shutil.rmtree(tmp, ignore_errors=True)


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
