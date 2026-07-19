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
