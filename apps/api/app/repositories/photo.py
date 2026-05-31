import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.album import Album
from app.models.album_member import AlbumMember
from app.models.photo import Photo


class PhotoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, photo_id: uuid.UUID) -> "Photo | None":
        return await self._session.get(Photo, photo_id)

    async def get_album(self, album_id: uuid.UUID) -> Album | None:
        return await self._session.get(Album, album_id)

    async def is_member(self, album_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(AlbumMember.id).where(
                AlbumMember.album_id == album_id,
                AlbumMember.user_id == user_id,
            )
        )
        return result.first() is not None

    async def count_by_album(self, album_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count()).select_from(Photo).where(Photo.album_id == album_id)
        )
        return result.scalar_one()

    async def create(
        self,
        *,
        album_id: uuid.UUID,
        uploaded_by: uuid.UUID,
        storage_key: str,
        original_key: str | None = None,
        filter_preset: str | None = None,
        taken_at: datetime | None = None,
    ) -> Photo:
        photo = Photo(
            album_id=album_id,
            uploaded_by=uploaded_by,
            storage_key=storage_key,
            original_key=original_key,
            filter_preset=filter_preset,
            taken_at=taken_at,
        )
        self._session.add(photo)
        await self._session.flush()
        await self._session.refresh(photo)
        return photo

    async def list_by_album(self, album_id: uuid.UUID) -> list[Photo]:
        result = await self._session.execute(
            select(Photo).where(Photo.album_id == album_id).order_by(Photo.created_at)
        )
        return list(result.scalars().all())
