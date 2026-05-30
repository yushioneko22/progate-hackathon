"""add photo filter columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-30

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 原本(無加工)のオブジェクトキー。リバーシブルな焼き込みのために保持する。
    # storage_key は表示用(フィルター焼き込み済み)の画像を指す。
    op.add_column("photos", sa.Column("original_key", sa.String(500), nullable=True))
    # どのプリセットで焼いたか。原本から再現/焼き直しできるようにする。
    op.add_column("photos", sa.Column("filter_preset", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("photos", "filter_preset")
    op.drop_column("photos", "original_key")
