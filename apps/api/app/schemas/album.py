import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AlbumCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    reveal_date: date
    max_exposures: int = Field(default=27, ge=1, le=99)
    bgm_url: str | None = Field(default=None, max_length=500)


class AlbumRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    reveal_date: date
    max_exposures: int
    bgm_url: str | None
    status: str          # "sealed" | "opened"
    days_left: int | None
    member_count: int
    photo_count: int
    created_at: datetime
