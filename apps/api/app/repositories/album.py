import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.album import Album
from app.models.album_member import AlbumMember
from app.models.photo import Photo


class AlbumRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_user(self, user_id: uuid.UUID) -> list[Album]:
        result = await self._session.execute(
            select(Album)
            .options(selectinload(Album.members), selectinload(Album.photos))
            .join(AlbumMember, Album.id == AlbumMember.album_id)
            .where(AlbumMember.user_id == user_id)
            .order_by(Album.reveal_date)
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        title: str,
        created_by: uuid.UUID,
        reveal_date: date,
        max_exposures: int,
    ) -> Album:
        album = Album(
            title=title,
            created_by=created_by,
            reveal_date=reveal_date,
            max_exposures=max_exposures,
        )
        self._session.add(album)
        await self._session.flush()
        await self._session.refresh(album)
        return album

    async def add_member(
        self, *, album_id: uuid.UUID, user_id: uuid.UUID, role: str
    ) -> AlbumMember:
        member = AlbumMember(album_id=album_id, user_id=user_id, role=role)
        self._session.add(member)
        await self._session.flush()
        return member
