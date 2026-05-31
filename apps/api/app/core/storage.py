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


async def _upload(*, data: bytes, content_type: str, ext: str) -> str:
    """Supabase Storage に任意のファイルを保存し、保存先のオブジェクトキーを返す。"""
    key = f"{uuid.uuid4().hex}{ext}"
    url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket}/{key}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_key}",
        "apikey": settings.supabase_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(url, content=data, headers=headers)
        res.raise_for_status()
    return key


async def upload_photo(*, data: bytes, content_type: str) -> str:
    """Supabase Storage に画像を保存し、保存先のオブジェクトキーを返す。"""
    return await _upload(data=data, content_type=content_type, ext=_ext(content_type))


async def upload_video(*, data: bytes) -> str:
    """Supabase Storage に MP4 動画を保存し、保存先のオブジェクトキーを返す。"""
    return await _upload(data=data, content_type="video/mp4", ext=".mp4")


async def download(url: str) -> bytes:
    """公開URLからファイルをダウンロードする(動画生成時に写真を取得するのに使う)。"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.get(url)
        res.raise_for_status()
        return res.content


def public_url(key: str) -> str:
    """public バケット上のオブジェクトの公開 URL を組み立てる。"""
    return f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_bucket}/{key}"
