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
        json={"title": "旅行", "reveal_date": reveal, "max_exposures": 27},
        headers=_auth(token),
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.fixture
async def owner_token(client: AsyncClient) -> str:
    return await _register(client, "owner@example.com")


async def test_owner_creates_invite_and_member_joins(
    client: AsyncClient, owner_token: str
) -> None:
    album_id = await _create_album(client, owner_token)

    # オーナーが招待コードを発行
    res = await client.post(f"/albums/{album_id}/invites", headers=_auth(owner_token))
    assert res.status_code == 201
    code = res.json()["code"]
    assert len(code) == 6

    # 別ユーザーがコードで参加
    member_token = await _register(client, "friend@example.com")
    join = await client.post(
        "/albums/join", json={"code": code}, headers=_auth(member_token)
    )
    assert join.status_code == 200
    assert join.json()["id"] == album_id
    assert join.json()["member_count"] == 2

    # 参加後、メンバーのアルバム一覧に出る
    albums = await client.get("/albums", headers=_auth(member_token))
    assert any(a["id"] == album_id for a in albums.json())

    # メンバー一覧に owner と member が居る
    members = await client.get(
        f"/albums/{album_id}/members", headers=_auth(member_token)
    )
    roles = sorted(m["role"] for m in members.json())
    assert roles == ["member", "owner"]


async def test_non_owner_cannot_create_invite(
    client: AsyncClient, owner_token: str
) -> None:
    album_id = await _create_album(client, owner_token)
    code = (
        await client.post(f"/albums/{album_id}/invites", headers=_auth(owner_token))
    ).json()["code"]
    member_token = await _register(client, "friend2@example.com")
    await client.post("/albums/join", json={"code": code}, headers=_auth(member_token))

    # member ロールでは招待発行できない
    res = await client.post(f"/albums/{album_id}/invites", headers=_auth(member_token))
    assert res.status_code == 403


async def test_join_with_invalid_code(client: AsyncClient, owner_token: str) -> None:
    res = await client.post(
        "/albums/join", json={"code": "ZZZZZZ"}, headers=_auth(owner_token)
    )
    assert res.status_code == 404


async def test_join_twice_is_idempotent(
    client: AsyncClient, owner_token: str
) -> None:
    album_id = await _create_album(client, owner_token)
    code = (
        await client.post(f"/albums/{album_id}/invites", headers=_auth(owner_token))
    ).json()["code"]
    member_token = await _register(client, "friend3@example.com")
    await client.post("/albums/join", json={"code": code}, headers=_auth(member_token))
    again = await client.post(
        "/albums/join", json={"code": code}, headers=_auth(member_token)
    )
    assert again.status_code == 200
    # 二重参加で重複しない
    assert again.json()["member_count"] == 2


async def test_outsider_cannot_list_members(
    client: AsyncClient, owner_token: str
) -> None:
    album_id = await _create_album(client, owner_token)
    outsider = await _register(client, "outsider@example.com")
    res = await client.get(f"/albums/{album_id}/members", headers=_auth(outsider))
    assert res.status_code == 404
