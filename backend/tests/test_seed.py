from app.database import SessionLocal
from app.models import User
from seed import bootstrap_admin


def test_bootstrap_is_noop_when_users_exist():
    # the migrated DB already has users
    assert SessionLocal().query(User).first() is not None
    before = SessionLocal().query(User).count()
    msg = bootstrap_admin()
    after = SessionLocal().query(User).count()
    assert after == before
    assert "skip" in msg
