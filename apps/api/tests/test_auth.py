import hashlib
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.jwt import create_access_token, decode_access_token
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.services import auth as auth_service


async def test_register_returns_verifiable_jwt(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/register",
        json={"email": "a@example.com", "password": "password1", "display_name": "A"},
    )
    assert res.status_code == 201
    token = res.json()["token"]
    # トークンは UUID ではなく検証可能な JWT
    with pytest.raises(ValueError):
        uuid.UUID(token)
    assert isinstance(decode_access_token(token), uuid.UUID)


async def test_login_then_access_protected_endpoint(client: AsyncClient) -> None:
    await client.post(
        "/auth/register",
        json={"email": "b@example.com", "password": "password1", "display_name": "B"},
    )
    login = await client.post(
        "/auth/login", json={"email": "b@example.com", "password": "password1"}
    )
    assert login.status_code == 200
    token = login.json()["token"]
    ok = await client.get("/albums", headers={"authorization": f"Bearer {token}"})
    assert ok.status_code == 200


async def test_invalid_token_rejected(client: AsyncClient) -> None:
    res = await client.get(
        "/albums", headers={"authorization": "Bearer not-a-valid-token"}
    )
    assert res.status_code == 401


async def test_legacy_sha256_password_still_verifies() -> None:
    # 旧形式 "salt:digest" のハッシュが引き続き検証できること(既存ユーザー救済)
    salt = "deadbeef"
    digest = hashlib.sha256(f"{salt}:secretpw".encode()).hexdigest()
    legacy = f"{salt}:{digest}"
    assert verify_password("secretpw", legacy) is True
    assert verify_password("wrongpw", legacy) is False


async def test_bcrypt_roundtrip() -> None:
    stored = hash_password("hunter22")
    assert stored.startswith("$2")
    assert verify_password("hunter22", stored) is True
    assert verify_password("nope", stored) is False


async def test_google_login_creates_user(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, session: AsyncSession
) -> None:
    monkeypatch.setattr(auth_service.settings, "google_client_ids", ["test-client-id"])
    monkeypatch.setattr(
        auth_service.google_id_token,
        "verify_oauth2_token",
        lambda *a, **k: {
            "sub": "google-sub-123",
            "email": "g@example.com",
            "email_verified": True,
            "name": "Google User",
            "picture": "https://example.com/p.png",
        },
    )
    res = await client.post("/auth/google", json={"id_token": "fake"})
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "g@example.com"
    assert body["user"]["avatar_url"] == "https://example.com/p.png"
    assert isinstance(decode_access_token(body["token"]), uuid.UUID)


async def test_google_login_links_existing_account(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, session: AsyncSession
) -> None:
    # 既存 email/password ユーザーに Google を紐付け、別ユーザーを作らない
    await client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "password1", "display_name": "D"},
    )
    monkeypatch.setattr(auth_service.settings, "google_client_ids", ["test-client-id"])
    monkeypatch.setattr(
        auth_service.google_id_token,
        "verify_oauth2_token",
        lambda *a, **k: {
            "sub": "google-sub-dup",
            "email": "dup@example.com",
            "email_verified": True,
            "name": "Dup",
        },
    )
    res = await client.post("/auth/google", json={"id_token": "fake"})
    assert res.status_code == 200
    user = (
        await session.get(User, decode_access_token(res.json()["token"]))
    )
    assert user is not None
    assert user.google_sub == "google-sub-dup"


async def test_google_login_invalid_token_rejected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_service.settings, "google_client_ids", ["test-client-id"])

    def _raise(*a: object, **k: object) -> dict:
        raise ValueError("invalid")

    monkeypatch.setattr(auth_service.google_id_token, "verify_oauth2_token", _raise)
    res = await client.post("/auth/google", json={"id_token": "bad"})
    assert res.status_code == 401


def test_create_access_token_roundtrip() -> None:
    uid = uuid.uuid4()
    assert decode_access_token(create_access_token(uid)) == uid
