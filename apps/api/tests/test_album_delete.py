from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


async def _register(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password1", "display_name": email[:5]},
    )
    assert res.status_code == 201
    return res.json()["token"]


def _auth(token: str) -> dict[str, str]:
    return {"authorization": f"Bearer {token}"}


async def _create_album(client: AsyncClient, token: str) -> str:
    reveal = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    res = await client.post(
        "/albums",
        json={"title": "削除テスト", "reveal_date": reveal, "max_exposures": 27},
        headers=_auth(token),
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.fixture
async def owner_token(client: AsyncClient) -> str:
    return await _register(client, "delowner@example.com")


async def test_owner_deletes_album(client: AsyncClient, owner_token: str) -> None:
    album_id = await _create_album(client, owner_token)
    res = await client.delete(f"/albums/{album_id}", headers=_auth(owner_token))
    assert res.status_code == 204
    # 一覧から消える
    albums = await client.get("/albums", headers=_auth(owner_token))
    assert all(a["id"] != album_id for a in albums.json())


async def test_member_cannot_delete(client: AsyncClient, owner_token: str) -> None:
    album_id = await _create_album(client, owner_token)
    code = (
        await client.post(f"/albums/{album_id}/invites", headers=_auth(owner_token))
    ).json()["code"]
    member = await _register(client, "delmember@example.com")
    await client.post("/albums/join", json={"code": code}, headers=_auth(member))

    res = await client.delete(f"/albums/{album_id}", headers=_auth(member))
    assert res.status_code == 403
    # オーナーには残っている
    albums = await client.get("/albums", headers=_auth(owner_token))
    assert any(a["id"] == album_id for a in albums.json())


async def test_outsider_cannot_delete(client: AsyncClient, owner_token: str) -> None:
    album_id = await _create_album(client, owner_token)
    outsider = await _register(client, "deloutsider@example.com")
    res = await client.delete(f"/albums/{album_id}", headers=_auth(outsider))
    assert res.status_code == 404


async def test_delete_nonexistent_album(client: AsyncClient, owner_token: str) -> None:
    res = await client.delete(
        "/albums/00000000-0000-0000-0000-000000000000", headers=_auth(owner_token)
    )
    assert res.status_code == 404
