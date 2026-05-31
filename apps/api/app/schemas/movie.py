import uuid
from datetime import datetime

from pydantic import BaseModel


class MovieRead(BaseModel):
    id: uuid.UUID
    album_id: uuid.UUID
    status: str  # pending / processing / ready / failed
    url: str | None  # 生成完了時のみ動画の公開URL
    error: str | None
    created_at: datetime
    updated_at: datetime
