"""Pre-cutover cleanup for reusing the dev DB (tokaido) as v2-prod.

Removes the known dev/test accounts (and their learning_progress) created
during development, so they don't ship to real staff. SAFE: only touches a
fixed allowlist of dev usernames — never real staff. Idempotent.

Run against the v2-prod DB right BEFORE go-live (NOT during active local dev,
which still logs in as v2tester):
    cd backend && set -a; source .env.migration; set +a
    uv run python -m migration.prepare_prod
"""
import os

from sqlalchemy import create_engine, text

DEV_USERS = ["v2tester", "smoke_admin", "smoke_editor", "smoke_reader", "smoke_reader2"]


def run(url: str) -> None:
    engine = create_engine(url)
    with engine.begin() as c:
        ids = [r[0] for r in c.execute(
            text("SELECT id FROM users WHERE username = ANY(:u)"), {"u": DEV_USERS}
        ).all()]
        if ids:
            c.execute(text("DELETE FROM learning_progress WHERE user_id = ANY(:ids)"), {"ids": ids})
            c.execute(text("DELETE FROM users WHERE id = ANY(:ids)"), {"ids": ids})
        remaining = c.execute(text("SELECT username, role FROM users ORDER BY id")).all()
    print(f"removed {len(ids)} dev/test user(s)" + (f": {DEV_USERS}" if ids else " (none present)"))
    print("remaining users:")
    for username, role in remaining:
        print(f"  {username} ({role})")
    print("\nreminder: confirm kolya has role=admin (migration/make_kolya_admin.py) if not already.")


if __name__ == "__main__":
    run(os.environ["DEST_DATABASE_URL"])
