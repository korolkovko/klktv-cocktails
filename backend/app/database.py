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
    "ALTER TABLE kitchen_dishes ADD COLUMN IF NOT EXISTS interesting_facts TEXT",
]

# Idempotent data migrations (each must be safe to re-run on every startup).
_DATA_MIGRATIONS = [
    # Move classic_progress → learning_progress (kind='classics').
    # ON CONFLICT DO NOTHING handles re-runs and partial state.
    """
    INSERT INTO learning_progress (user_id, kind, slug, learned_at)
    SELECT cp.user_id, 'classics', c.slug, cp.learned_at
      FROM classic_progress cp
      JOIN classics c ON c.id = cp.classic_id
    ON CONFLICT (user_id, kind, slug) DO NOTHING
    """,
]


def init_db():
    from app import models  # noqa: F401 — register models on Base
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for stmt in _COLUMN_MIGRATIONS:
            conn.execute(text(stmt))
        for stmt in _DATA_MIGRATIONS:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                # Tolerate first-deploy state where source tables may be empty
                print(f"  data migration skipped: {e}")
        conn.commit()
