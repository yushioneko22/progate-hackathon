import uuid
from datetime import datetime

from pydantic import BaseModel


class PhotoRead(BaseModel):
    id: uuid.UUID
    album_id: uuid.UUID
    url: str
    filter_preset: str | None
    taken_at: datetime | None
    created_at: datetime
