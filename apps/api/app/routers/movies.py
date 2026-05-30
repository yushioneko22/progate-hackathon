import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.db import get_session
from app.schemas.movie import MovieRead
from app.services.movie import MovieService, generate

router = APIRouter(prefix="/albums/{album_id}/movie", tags=["movies"])


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> MovieService:
    return MovieService(session)


ServiceDep = Annotated[MovieService, Depends(get_service)]


@router.post("", response_model=MovieRead, status_code=status.HTTP_202_ACCEPTED)
async def create_movie(
    album_id: uuid.UUID,
    service: ServiceDep,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
) -> MovieRead:
    """スライドショー動画の生成を開始する(非同期)。pending のジョブを返す。"""
    movie = await service.request_generation(album_id=album_id, user_id=current_user.id)
    # レスポンス送出後にバックグラウンドで生成を実行する
    background_tasks.add_task(generate, movie.id)
    return movie


@router.get("", response_model=MovieRead)
async def get_movie(
    album_id: uuid.UUID, service: ServiceDep, current_user: CurrentUser
) -> MovieRead:
    """最新の動画生成ジョブの状態を返す。まだ無ければ404。"""
    movie = await service.latest(album_id=album_id, user_id=current_user.id)
    if movie is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="動画はまだありません")
    return movie
