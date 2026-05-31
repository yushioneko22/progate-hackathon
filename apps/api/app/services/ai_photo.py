import uuid

from fastapi import HTTPException, status
from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.config import settings
from app.models.photo import Photo
from app.repositories.photo import PhotoRepository
from app.schemas.photo import PhotoRead


class AiPhotoService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = PhotoRepository(session)

    async def transform(
        self,
        *,
        album_id: uuid.UUID,
        photo_id: uuid.UUID,
        user_id: uuid.UUID,
        prompt: str,
    ) -> PhotoRead:
        if not settings.gemini_api_key:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI加工機能は現在利用できません",
            )

        photo = await self._repo.get(photo_id)
        if photo is None or photo.album_id != album_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="写真が見つかりません")
        if not await self._repo.is_member(album_id, user_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="このアルバムのメンバーではありません"
            )

        # Supabase から元画像をダウンロード
        image_url = storage.public_url(photo.storage_key)
        image_bytes = await storage.download(image_url)

        # Gemini で加工
        transformed_bytes = await _call_gemini(image_bytes=image_bytes, prompt=prompt)

        # 加工後の画像をアップロード
        key = await storage.upload_photo(data=transformed_bytes, content_type="image/jpeg")

        new_photo = await self._repo.create(
            album_id=album_id,
            uploaded_by=user_id,
            storage_key=key,
            original_key=key,
            filter_preset="ai-transform",
        )
        await self._session.commit()
        await self._session.refresh(new_photo)
        return _to_read(new_photo)


async def _call_gemini(*, image_bytes: bytes, prompt: str) -> bytes:
    client = genai.Client(api_key=settings.gemini_api_key)

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash-preview-image-generation",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    types.Part.from_text(
                        f"この写真を次の指示に従って加工してください。出力は加工後の画像のみにしてください。\n指示: {prompt}"
                    ),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data

    raise HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        detail="Gemini APIから画像が返されませんでした",
    )


def _to_read(photo: Photo) -> PhotoRead:
    return PhotoRead(
        id=photo.id,
        album_id=photo.album_id,
        url=storage.public_url(photo.storage_key),
        filter_preset=photo.filter_preset,
        taken_at=photo.taken_at,
        created_at=photo.created_at,
    )
