"""rename users.last_login_at -> last_seen_at

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-20 19:30:00.000000

The metric became "last visit" (updated on every authenticated request, not
just on login), so the column is renamed to match.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'last_login_at', new_column_name='last_seen_at')


def downgrade() -> None:
    op.alter_column('users', 'last_seen_at', new_column_name='last_login_at')
