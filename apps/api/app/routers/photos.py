import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.db import get_session
from app.schemas.photo import PhotoRead
from app.services.ai_photo import AiPhotoService
from app.services.photo import PhotoService

router = APIRouter(prefix="/albums/{album_id}/photos", tags=["photos"])


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> PhotoService:
    return PhotoService(session)


def get_ai_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AiPhotoService:
    return AiPhotoService(session)


ServiceDep   = Annotated[PhotoService,   Depends(get_service)]
AiServiceDep = Annotated[AiPhotoService, Depends(get_ai_service)]


class AiTransformRequest(BaseModel):
    prompt: str


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


@router.post(
    "/{photo_id}/ai-transform",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def ai_transform_photo(
    album_id: uuid.UUID,
    photo_id: uuid.UUID,
    body: AiTransformRequest,
    service: AiServiceDep,
    current_user: CurrentUser,
) -> PhotoRead:
    return await service.transform(
        album_id=album_id,
        photo_id=photo_id,
        user_id=current_user.id,
        prompt=body.prompt,
    )
