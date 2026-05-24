from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        email: str,
        password_hash: str,
        display_name: str,
    ) -> User:
        user = User(email=email, password_hash=password_hash, display_name=display_name)
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return user
