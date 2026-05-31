import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.db import get_session
from app.schemas.album import (
    AlbumCreate,
    AlbumRead,
    InviteCodeRead,
    JoinRequest,
    MemberRead,
)
from app.services.album import AlbumService

router = APIRouter(prefix="/albums", tags=["albums"])


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AlbumService:
    return AlbumService(session)


ServiceDep = Annotated[AlbumService, Depends(get_service)]


@router.get("", response_model=list[AlbumRead])
async def list_albums(service: ServiceDep, current_user: CurrentUser) -> list[AlbumRead]:
    return await service.list_for_user(current_user.id)


@router.post("", response_model=AlbumRead, status_code=status.HTTP_201_CREATED)
async def create_album(
    payload: AlbumCreate, service: ServiceDep, current_user: CurrentUser
) -> AlbumRead:
    return await service.create(payload, creator_id=current_user.id)


@router.post("/join", response_model=AlbumRead)
async def join_album(
    payload: JoinRequest, service: ServiceDep, current_user: CurrentUser
) -> AlbumRead:
    return await service.join_by_code(payload.code, user_id=current_user.id)


@router.post(
    "/{album_id}/invites",
    response_model=InviteCodeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite(
    album_id: uuid.UUID, service: ServiceDep, current_user: CurrentUser
) -> InviteCodeRead:
    return await service.create_invite(album_id, user_id=current_user.id)


@router.get("/{album_id}/members", response_model=list[MemberRead])
async def list_members(
    album_id: uuid.UUID, service: ServiceDep, current_user: CurrentUser
) -> list[MemberRead]:
    return await service.list_members(album_id, user_id=current_user.id)
