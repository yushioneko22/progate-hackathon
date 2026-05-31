import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlbumCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    reveal_date: datetime
    max_exposures: int = Field(default=27, ge=1, le=99)
    bgm_url: str | None = Field(default=None, max_length=500)


class AlbumRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    reveal_date: datetime
    max_exposures: int
    bgm_url: str | None
    status: str          # "sealed" | "opened"
    days_left: int | None
    member_count: int
    photo_count: int
    my_role: str | None = None   # 取得ユーザーのロール "owner" | "member"
    created_at: datetime


class InviteCodeRead(BaseModel):
    """発行された招待コード。これを共有して相手に入力してもらう。"""

    code: str
    expires_at: datetime | None


class JoinRequest(BaseModel):
    code: str = Field(min_length=1, max_length=20)


class MemberRead(BaseModel):
    user_id: uuid.UUID
    display_name: str
    avatar_url: str | None
    role: str            # "owner" | "member"
    joined_at: datetime
