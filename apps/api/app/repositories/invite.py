import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite_code import InviteCode


class InviteCodeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_code(self, code: str) -> InviteCode | None:
        result = await self._session.execute(
            select(InviteCode).where(InviteCode.code == code)
        )
        return result.scalar_one_or_none()

    async def exists(self, code: str) -> bool:
        result = await self._session.execute(
            select(InviteCode.id).where(InviteCode.code == code)
        )
        return result.first() is not None

    async def create(
        self,
        *,
        album_id: uuid.UUID,
        code: str,
        created_by: uuid.UUID,
        expires_at: datetime | None,
    ) -> InviteCode:
        invite = InviteCode(
            album_id=album_id,
            code=code,
            created_by=created_by,
            expires_at=expires_at,
        )
        self._session.add(invite)
        await self._session.flush()
        return invite
