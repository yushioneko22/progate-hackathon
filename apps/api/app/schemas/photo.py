import uuid
from datetime import datetime

from pydantic import BaseModel


class PhotoRead(BaseModel):
    id: uuid.UUID
    album_id: uuid.UUID
    url: str
    taken_at: datetime | None
    created_at: datetime
