import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings


def create_access_token(user_id: uuid.UUID) -> str:
    """ユーザーIDを sub に持つ署名付きアクセストークン(JWT)を発行する。"""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_min),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    """アクセストークンを検証し sub(ユーザーID)を返す。

    署名不一致・期限切れ・不正な形式の場合は jwt.PyJWTError 系または
    ValueError を送出する(呼び出し側で 401 に変換する)。
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    return uuid.UUID(payload["sub"])
