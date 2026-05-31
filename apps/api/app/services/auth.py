from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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

    async def login_with_google(self, raw_id_token: str) -> User:
        if not settings.google_client_ids:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="google login is not configured",
            )
        try:
            claims = google_id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]
                raw_id_token,
                google_requests.Request(),
                audience=settings.google_client_ids,
            )
        except ValueError as err:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, detail="invalid google token"
            ) from err

        if not claims.get("email_verified"):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, detail="google email not verified"
            )

        sub = claims["sub"]
        email = claims["email"]
        display_name = claims.get("name") or email.split("@")[0]
        avatar_url = claims.get("picture")

        user = await self._repo.find_by_email(email)
        if user is None:
            user = await self._repo.create(
                email=email,
                password_hash=None,
                display_name=display_name[:50],
                avatar_url=avatar_url,
                google_sub=sub,
            )
        elif user.google_sub is None:
            # 既存の email/password アカウントに Google アカウントを紐付ける
            user.google_sub = sub
            if user.avatar_url is None:
                user.avatar_url = avatar_url
        await self._session.commit()
        await self._session.refresh(user)
        return user
