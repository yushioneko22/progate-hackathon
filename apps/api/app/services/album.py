import math
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.album import Album
from app.repositories.album import AlbumRepository
from app.schemas.album import AlbumCreate, AlbumRead


class AlbumService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = AlbumRepository(session)

    async def list(self, user_id: uuid.UUID) -> list[AlbumRead]:
        albums = await self._repo.list_by_user(user_id)
        return [self._to_read(a) for a in albums]

    async def create(self, payload: AlbumCreate, creator_id: uuid.UUID) -> AlbumRead:
        album = await self._repo.create(
            title=payload.title,
            created_by=creator_id,
            reveal_date=payload.reveal_date,
            max_exposures=payload.max_exposures,
            bgm_url=payload.bgm_url,
        )
        await self._repo.add_member(
            album_id=album.id, user_id=creator_id, role="owner"
        )
        await self._session.commit()
        await self._session.refresh(album)
        # リフレッシュ後はメンバー・写真を再取得
        albums = await self._repo.list_by_user(creator_id)
        created = next(a for a in albums if a.id == album.id)
        return self._to_read(created)

    @staticmethod
    def _to_read(album: Album) -> AlbumRead:
        now = datetime.now(timezone.utc)
        reveal = album.reveal_date
        # DB から取得した datetime が naive の場合は UTC と見なす
        if reveal.tzinfo is None:
            reveal = reveal.replace(tzinfo=timezone.utc)
        is_opened = reveal <= now
        days_left = None if is_opened else math.ceil((reveal - now).total_seconds() / 86400)
        return AlbumRead(
            id=album.id,
            title=album.title,
            reveal_date=reveal,
            max_exposures=album.max_exposures,
            bgm_url=album.bgm_url,
            status="opened" if is_opened else "sealed",
            days_left=days_left,
            member_count=len(album.members),
            photo_count=len(album.photos),
            created_at=album.created_at,
        )
