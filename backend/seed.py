"""
Seed the users table with the initial 12 accounts.

Idempotent: existing users are updated (password + role + name reset to defaults).
Run with: python -m seed
"""

from dotenv import load_dotenv

load_dotenv()

from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.models import User  # noqa: E402

USERS = [
    # username, password, role, display name
    ("admin",   "kollektiv77", "admin",  "Админ"),
    ("max",     "dieter17",    "reader", "Макс"),
    ("sasha",   "gentle88",    "reader", "Саша"),
    ("kolya",   "braindead44", "reader", "Коля"),
    ("diana",   "candy55",     "reader", "Диана"),
    ("michael", "springer33",  "reader", "Майкл"),
    ("olya",    "bigapple22",  "reader", "Оля"),
    ("kirill",  "jungle99",    "reader", "Кирилл"),
    ("artur",   "viking11",    "reader", "Артур"),
    ("misha",   "mezcal66",    "reader", "Миша"),
    ("milana",  "peach88",     "reader", "Милана"),
    ("stepa",   "rocket44",    "reader", "Степа"),
]


def main():
    init_db()
    db = SessionLocal()
    try:
        for username, password, role, name in USERS:
            existing = db.query(User).filter(User.username == username).first()
            if existing:
                existing.password_hash = hash_password(password)
                existing.role = role
                existing.name = name
                action = "updated"
            else:
                db.add(User(
                    username=username,
                    password_hash=hash_password(password),
                    role=role,
                    name=name,
                ))
                action = "created"
            print(f"  {action}: {username} ({role})")
        db.commit()
        print(f"\nSeeded {len(USERS)} users.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
