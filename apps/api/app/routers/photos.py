import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.db import get_session
from app.schemas.photo import PhotoRead
from app.services.photo import PhotoService

router = APIRouter(prefix="/albums/{album_id}/photos", tags=["photos"])


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> PhotoService:
    return PhotoService(session)


ServiceDep = Annotated[PhotoService, Depends(get_service)]


@router.get("", response_model=list[PhotoRead])
async def list_photos(
    album_id: uuid.UUID, service: ServiceDep, current_user: CurrentUser
) -> list[PhotoRead]:
    return await service.list(album_id=album_id, user_id=current_user.id)


@router.post("", response_model=PhotoRead, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    album_id: uuid.UUID,
    service: ServiceDep,
    current_user: CurrentUser,
    file: Annotated[UploadFile, File()],
    filter_preset: Annotated[str | None, Form()] = None,
    filter_preset_b: Annotated[str | None, Form()] = None,
    filter_mix: Annotated[float, Form()] = 0.0,
    filter_strength: Annotated[float, Form()] = 1.0,
) -> PhotoRead:
    data = await file.read()
    return await service.upload(
        album_id=album_id,
        user_id=current_user.id,
        data=data,
        content_type=file.content_type or "image/jpeg",
        filter_preset=filter_preset,
        filter_preset_b=filter_preset_b,
        filter_mix=filter_mix,
        filter_strength=filter_strength,
    )
