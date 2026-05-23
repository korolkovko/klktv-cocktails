from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Lightweight column migrations.
# Base.metadata.create_all() only creates missing TABLES — it never alters
# existing ones. As schema evolves we keep idempotent ALTERs here. Once
# this grows past ~10 entries, switch to Alembic.
_COLUMN_MIGRATIONS = [
    "ALTER TABLE zc_drinks ADD COLUMN IF NOT EXISTS is_carbonated BOOLEAN",
]


def init_db():
    from app import models  # noqa: F401 — register models on Base
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for stmt in _COLUMN_MIGRATIONS:
            conn.execute(text(stmt))
        conn.commit()
