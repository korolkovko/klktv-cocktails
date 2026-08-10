"""phase-A drinks: is_archived, ice_types, ice_id, is_hot

Revision ID: 7e94d69094d0
Revises: b2c3d4e5f6a7
Create Date: 2026-08-10 22:12:25.014605

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e94d69094d0'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    for t in ("drinks", "classics", "spirit_entries", "kitchen_dishes"):
        op.add_column(t, sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table("ice_types",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(32), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"))
    op.create_index("ix_ice_types_key", "ice_types", ["key"], unique=True)
    op.add_column("drinks", sa.Column("ice_id", sa.Integer, sa.ForeignKey("ice_types.id", ondelete="SET NULL"), nullable=True))
    op.add_column("drinks", sa.Column("is_hot", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("drinks", "is_hot")
    op.drop_column("drinks", "ice_id")
    op.drop_index("ix_ice_types_key", table_name="ice_types")
    op.drop_table("ice_types")
    for t in ("drinks", "classics", "spirit_entries", "kitchen_dishes"):
        op.drop_column(t, "is_archived")
