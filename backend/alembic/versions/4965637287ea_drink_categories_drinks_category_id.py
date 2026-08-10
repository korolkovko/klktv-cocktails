"""drink_categories + drinks.category_id

Revision ID: 4965637287ea
Revises: f98c4260db6c
Create Date: 2026-08-10 23:44:07.672745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4965637287ea'
down_revision: Union[str, Sequence[str], None] = 'f98c4260db6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table("drink_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"))
    op.create_index("ix_drink_categories_slug", "drink_categories", ["slug"], unique=True)
    op.execute("INSERT INTO drink_categories (slug,label,sort_order) VALUES ('osnovnye','Основные',0)")
    op.add_column("drinks", sa.Column("category_id", sa.Integer, sa.ForeignKey("drink_categories.id", ondelete="RESTRICT"), nullable=True))
    op.execute("UPDATE drinks SET category_id=(SELECT id FROM drink_categories WHERE slug='osnovnye')")
    op.alter_column("drinks", "category_id", nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("drinks", "category_id")
    op.drop_index("ix_drink_categories_slug", table_name="drink_categories")
    op.drop_table("drink_categories")
