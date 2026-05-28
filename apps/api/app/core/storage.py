import uuid

import httpx

from app.core.config import settings

_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}


def _ext(content_type: str) -> str:
    return _EXT_BY_TYPE.get(content_type.lower(), ".jpg")


async def upload_photo(*, data: bytes, content_type: str) -> str:
    """Supabase Storage に画像を保存し、保存先のオブジェクトキーを返す。"""
    key = f"{uuid.uuid4().hex}{_ext(content_type)}"
    url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket}/{key}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_key}",
        "apikey": settings.supabase_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, content=data, headers=headers)
        res.raise_for_status()
    return key


def public_url(key: str) -> str:
    """public バケット上のオブジェクトの公開 URL を組み立てる。"""
    return f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_bucket}/{key}"
