from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import LoginRequest, RegisterRequest


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = UserRepository(session)

    async def register(self, payload: RegisterRequest) -> User:
        existing = await self._repo.find_by_email(payload.email)
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="email already registered"
            )
        user = await self._repo.create(
            email=payload.email,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
        )
        await self._session.commit()
        return user

    async def login(self, payload: LoginRequest) -> User:
        user = await self._repo.find_by_email(payload.email)
        if user is None or user.password_hash is None:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, detail="invalid email or password"
            )
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, detail="invalid email or password"
            )
        return user
