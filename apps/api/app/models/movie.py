import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.album import Album

# 動画生成ジョブの状態
STATUS_PENDING = "pending"
STATUS_PROCESSING = "processing"
STATUS_READY = "ready"
STATUS_FAILED = "failed"


class Movie(Base):
    """アルバムの写真から生成するスライドショー動画の生成ジョブ。"""

    __tablename__ = "movies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    album_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("albums.id", ondelete="CASCADE"), nullable=False
    )
    # pending / processing / ready / failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=STATUS_PENDING)
    # 生成完了時の動画オブジェクトキー(Supabase)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 失敗時のエラー概要
    error: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    album: Mapped[Album] = relationship()
