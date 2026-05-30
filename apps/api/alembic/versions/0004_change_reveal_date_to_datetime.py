"""change reveal_date to datetime with timezone

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-30

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "albums",
        "reveal_date",
        type_=sa.DateTime(timezone=True),
        postgresql_using="reveal_date::timestamp with time zone",
    )


def downgrade() -> None:
    op.alter_column(
        "albums",
        "reveal_date",
        type_=sa.Date(),
        postgresql_using="reveal_date::date",
    )
