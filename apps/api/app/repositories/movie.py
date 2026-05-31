import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.album import Album
from app.models.album_member import AlbumMember
from app.models.movie import Movie
from app.models.photo import Photo


class MovieRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

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

    async def list_photo_keys(self, album_id: uuid.UUID) -> list[str]:
        """アルバムの写真(表示用=フィルター焼き込み済み)のオブジェクトキーを撮影順で返す。"""
        result = await self._session.execute(
            select(Photo.storage_key)
            .where(Photo.album_id == album_id)
            .order_by(Photo.created_at)
        )
        return list(result.scalars().all())

    async def create(self, *, album_id: uuid.UUID) -> Movie:
        movie = Movie(album_id=album_id)
        self._session.add(movie)
        await self._session.flush()
        await self._session.refresh(movie)
        return movie

    async def get(self, movie_id: uuid.UUID) -> Movie | None:
        return await self._session.get(Movie, movie_id)

    async def latest_by_album(self, album_id: uuid.UUID) -> Movie | None:
        result = await self._session.execute(
            select(Movie)
            .where(Movie.album_id == album_id)
            .order_by(Movie.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
