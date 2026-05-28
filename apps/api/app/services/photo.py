import uuid

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.models.photo import Photo
from app.repositories.photo import PhotoRepository
from app.schemas.photo import PhotoRead


class PhotoService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = PhotoRepository(session)

    async def upload(
        self,
        *,
        album_id: uuid.UUID,
        user_id: uuid.UUID,
        data: bytes,
        content_type: str,
    ) -> PhotoRead:
        album = await self._repo.get_album(album_id)
        if album is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="アルバムが見つかりません")
        if not await self._repo.is_member(album_id, user_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="このアルバムのメンバーではありません"
            )
        count = await self._repo.count_by_album(album_id)
        if count >= album.max_exposures:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="フィルムを使い切りました")

        try:
            key = await storage.upload_photo(data=data, content_type=content_type)
        except httpx.HTTPError as err:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, detail="ストレージへの保存に失敗しました"
            ) from err

        photo = await self._repo.create(
            album_id=album_id, uploaded_by=user_id, storage_key=key
        )
        await self._session.commit()
        await self._session.refresh(photo)
        return self._to_read(photo)

    async def list(self, *, album_id: uuid.UUID, user_id: uuid.UUID) -> list[PhotoRead]:
        if not await self._repo.is_member(album_id, user_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="このアルバムのメンバーではありません"
            )
        photos = await self._repo.list_by_album(album_id)
        return [self._to_read(p) for p in photos]

    @staticmethod
    def _to_read(photo: Photo) -> PhotoRead:
        return PhotoRead(
            id=photo.id,
            album_id=photo.album_id,
            url=storage.public_url(photo.storage_key),
            taken_at=photo.taken_at,
            created_at=photo.created_at,
        )
