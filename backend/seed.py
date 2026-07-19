"""One-shot admin bootstrap. NOT run on boot. v2 content+users come from the ETL
(backend/migration). Only bootstraps an admin when the users table is empty."""
import os
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password


def bootstrap_admin() -> str:
    with SessionLocal() as db:
        if db.query(User).first() is not None:
            return "users table not empty — skip (v2 users migrated from prod)"
        username = os.environ.get("SEED_ADMIN_USERNAME")
        password = os.environ.get("SEED_ADMIN_PASSWORD")
        if not (username and password):
            return "empty users table but SEED_ADMIN_USERNAME/PASSWORD not set — skip"
        db.add(User(username=username.strip().lower(),
                    password_hash=hash_password(password), role="admin", name="Admin"))
        db.commit()
        return f"bootstrapped admin '{username}'"


if __name__ == "__main__":
    print(bootstrap_admin())
