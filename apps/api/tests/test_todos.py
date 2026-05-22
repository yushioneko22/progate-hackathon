from httpx import AsyncClient


async def test_health(client: AsyncClient) -> None:
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


async def test_list_empty(client: AsyncClient) -> None:
    res = await client.get("/todos")
    assert res.status_code == 200
    assert res.json() == []


async def test_create_validates_title(client: AsyncClient) -> None:
    res = await client.post("/todos", json={"title": ""})
    assert res.status_code == 422


async def test_create_and_list(client: AsyncClient) -> None:
    created = await client.post("/todos", json={"title": "buy milk"})
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "buy milk"
    assert body["completed"] is False

    listed = await client.get("/todos")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_update_toggle_completed(client: AsyncClient) -> None:
    created = (await client.post("/todos", json={"title": "task"})).json()
    res = await client.patch(f"/todos/{created['id']}", json={"completed": True})
    assert res.status_code == 200
    assert res.json()["completed"] is True


async def test_update_not_found(client: AsyncClient) -> None:
    res = await client.patch(
        "/todos/00000000-0000-0000-0000-000000000000", json={"completed": True}
    )
    assert res.status_code == 404


async def test_delete(client: AsyncClient) -> None:
    created = (await client.post("/todos", json={"title": "x"})).json()
    res = await client.delete(f"/todos/{created['id']}")
    assert res.status_code == 204
    listed = await client.get("/todos")
    assert listed.json() == []


async def test_delete_not_found(client: AsyncClient) -> None:
    res = await client.delete("/todos/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
