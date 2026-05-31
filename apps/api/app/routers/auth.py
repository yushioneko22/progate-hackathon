from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.jwt import create_access_token
from app.schemas.user import (
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserRead,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AuthService:
    return AuthService(session)


ServiceDep = Annotated[AuthService, Depends(get_service)]


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, service: ServiceDep) -> TokenResponse:
    user = await service.register(payload)
    return TokenResponse(
        token=create_access_token(user.id), user=UserRead.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, service: ServiceDep) -> TokenResponse:
    user = await service.login(payload)
    return TokenResponse(
        token=create_access_token(user.id), user=UserRead.model_validate(user)
    )


@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleLoginRequest, service: ServiceDep) -> TokenResponse:
    user = await service.login_with_google(payload.id_token)
    return TokenResponse(
        token=create_access_token(user.id), user=UserRead.model_validate(user)
    )
