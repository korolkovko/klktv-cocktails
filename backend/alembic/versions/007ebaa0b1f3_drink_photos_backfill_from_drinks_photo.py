"""drink_photos + backfill from drinks.photo

Revision ID: 007ebaa0b1f3
Revises: 4965637287ea
Create Date: 2026-08-11 00:21:44.666503

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007ebaa0b1f3'
down_revision: Union[str, Sequence[str], None] = '4965637287ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table("drink_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("drink_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=256), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["drink_id"], ["drinks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"))
    op.create_index(op.f("ix_drink_photos_drink_id"), "drink_photos", ["drink_id"], unique=False)
    # Backfill: one drink_photos row per drink that already has a legacy
    # drinks.photo value. drinks.photo is left in place (unused by writes
    # after C2, not dropped here).
    op.execute(
        "INSERT INTO drink_photos (drink_id, url, sort_order) "
        "SELECT id, photo, 0 FROM drinks WHERE photo IS NOT NULL AND photo <> ''"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_drink_photos_drink_id"), table_name="drink_photos")
    op.drop_table("drink_photos")
