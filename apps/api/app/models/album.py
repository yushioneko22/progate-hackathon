import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reveal_date: Mapped[date] = mapped_column(Date, nullable=False)
    max_exposures: Mapped[int] = mapped_column(Integer, nullable=False, default=27)
    bgm_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    members: Mapped[list["AlbumMember"]] = relationship(back_populates="album")  # noqa: F821
    photos: Mapped[list["Photo"]] = relationship(back_populates="album")  # noqa: F821
    invite_codes: Mapped[list["InviteCode"]] = relationship(back_populates="album")  # noqa: F821
