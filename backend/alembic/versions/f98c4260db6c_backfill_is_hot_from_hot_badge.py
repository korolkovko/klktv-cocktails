"""backfill is_hot from HOT badge

Revision ID: f98c4260db6c
Revises: 7e94d69094d0
Create Date: 2026-08-10 23:08:09.703032

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f98c4260db6c'
down_revision: Union[str, Sequence[str], None] = '7e94d69094d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Data backfill: any drink still carrying the legacy 'HOT' badge becomes
    is_hot=true (badge_id cleared), then the HOT badge itself is removed from
    the dictionary. Other badges (e.g. ONESIP) are untouched. Each statement
    is a no-op if no HOT badge/drink exists, so this is safe to run on a DB
    that never had one."""
    op.execute(
        "UPDATE drinks SET is_hot = true "
        "WHERE badge_id IN (SELECT id FROM badges WHERE upper(key) = 'HOT')"
    )
    op.execute(
        "UPDATE drinks SET badge_id = NULL "
        "WHERE badge_id IN (SELECT id FROM badges WHERE upper(key) = 'HOT')"
    )
    op.execute("DELETE FROM badges WHERE upper(key) = 'HOT'")


def downgrade() -> None:
    """No-op: irreversible data migration. Which drinks previously carried
    the HOT badge (vs. having is_hot set some other way after upgrade) isn't
    recorded anywhere, so there's no way to reconstruct the prior badge
    assignment or re-insert the HOT badge row with its original id."""
    pass
