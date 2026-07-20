"""add users.last_login_at

Revision ID: a1b2c3d4e5f6
Revises: 8d4ec3b4729d
Create Date: 2026-07-20 18:00:00.000000

Tracks the last successful login per user (set in app/routers/auth.py). Nullable
because there is no historical login data — tracking starts now.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '8d4ec3b4729d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_login_at')
