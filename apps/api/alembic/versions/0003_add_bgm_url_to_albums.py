"""add bgm_url to albums

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-30

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "albums",
        sa.Column("bgm_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("albums", "bgm_url")
