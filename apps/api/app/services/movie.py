import tempfile
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.db import SessionLocal
from app.models.movie import (
    STATUS_FAILED,
    STATUS_PROCESSING,
    STATUS_READY,
    Movie,
)
from app.movie import builder
from app.repositories.movie import MovieRepository
from app.schemas.movie import MovieRead

# サーバー同梱の既定BGM (app/assets/bgm.mp3)
_DEFAULT_BGM = Path(__file__).resolve().parents[1] / "assets" / "bgm.mp3"


class MovieService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MovieRepository(session)

    async def request_generation(
        self, *, album_id: uuid.UUID, user_id: uuid.UUID
    ) -> MovieRead:
        """生成ジョブを作成し pending で返す。実際の生成は別途バックグラウンドで走らせる。"""
        if await self._repo.get_album(album_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="アルバムが見つかりません")
        if not await self._repo.is_member(album_id, user_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="このアルバムのメンバーではありません"
            )
        keys = await self._repo.list_photo_keys(album_id)
        if not keys:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="写真がまだありません"
            )

        movie = await self._repo.create(album_id=album_id)
        await self._session.commit()
        await self._session.refresh(movie)
        return self._to_read(movie)

    async def latest(self, *, album_id: uuid.UUID, user_id: uuid.UUID) -> MovieRead | None:
        if not await self._repo.is_member(album_id, user_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="このアルバムのメンバーではありません"
            )
        movie = await self._repo.latest_by_album(album_id)
        return self._to_read(movie) if movie else None

    @staticmethod
    def _to_read(movie: Movie) -> MovieRead:
        return MovieRead(
            id=movie.id,
            album_id=movie.album_id,
            status=movie.status,
            url=storage.public_url(movie.storage_key) if movie.storage_key else None,
            error=movie.error,
            created_at=movie.created_at,
            updated_at=movie.updated_at,
        )


async def generate(movie_id: uuid.UUID) -> None:
    """バックグラウンドで動画を生成する。専用のDBセッションを開いてジョブ状態を更新する。

    流れ: 写真をSupabaseからDL → ffmpegでスライドショー合成 → MP4をアップロード →
    ジョブを ready に更新。失敗時は failed + エラー概要を記録する。
    """
    async with SessionLocal() as session:
        repo = MovieRepository(session)
        movie = await repo.get(movie_id)
        if movie is None:
            return
        album = await repo.get_album(movie.album_id)
        keys = await repo.list_photo_keys(movie.album_id)

        movie.status = STATUS_PROCESSING
        await session.commit()

        try:
            if not keys:
                raise RuntimeError("写真がありません")

            with tempfile.TemporaryDirectory() as tmp:
                tmp_dir = Path(tmp)
                # 写真(表示用=フィルター焼き込み済み)をローカルにDL
                image_paths: list[Path] = []
                for i, key in enumerate(keys):
                    data = await storage.download(storage.public_url(key))
                    p = tmp_dir / f"p{i:04d}.jpg"
                    p.write_bytes(data)
                    image_paths.append(p)

                # BGM: アルバム指定があればそれを、無ければサーバー同梱の既定BGM
                bgm_path = _DEFAULT_BGM
                if album is not None and album.bgm_url:
                    bgm_data = await storage.download(album.bgm_url)
                    bgm_path = tmp_dir / "bgm.mp3"
                    bgm_path.write_bytes(bgm_data)

                out_path = tmp_dir / "movie.mp4"
                spec = builder.MovieSpec(
                    image_paths=image_paths,
                    bgm_path=bgm_path,
                    output_path=out_path,
                )
                await builder.render(spec)
                video_key = await storage.upload_video(data=out_path.read_bytes())

            movie.storage_key = video_key
            movie.status = STATUS_READY
            movie.error = None
            await session.commit()
        except Exception as err:  # noqa: BLE001 - 失敗内容をジョブに記録して握りつぶす
            movie.status = STATUS_FAILED
            movie.error = str(err)[:1000]
            await session.commit()
