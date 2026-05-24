import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.album import Album
from app.models.user import User

AlbumRole = Enum("owner", "member", name="album_role")


class AlbumMember(Base):
    __tablename__ = "album_members"
    __table_args__ = (UniqueConstraint("album_id", "user_id", name="uq_album_member"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    album_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("albums.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(AlbumRole, nullable=False, default="member")
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    album: Mapped[Album] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")
