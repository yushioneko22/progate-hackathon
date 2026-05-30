import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.album import Album
from app.models.user import User


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    album_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("albums.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # 原本(無加工)のキー。storage_key はフィルター焼き込み済みの表示用画像を指す。
    original_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 焼き込みに使ったプリセットID(原本からの再現/焼き直し用)
    filter_preset: Mapped[str | None] = mapped_column(String(50), nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    album: Mapped[Album] = relationship(back_populates="photos")
    uploader: Mapped[User] = relationship(back_populates="uploaded_photos")
