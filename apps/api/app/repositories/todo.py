import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.todo import Todo


class TodoRepository:
    """Persistence layer for Todo. Only this class touches the ORM directly."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> Sequence[Todo]:
        result = await self._session.execute(
            select(Todo).order_by(Todo.created_at.desc())
        )
        return result.scalars().all()

    async def get(self, todo_id: uuid.UUID) -> Todo | None:
        return await self._session.get(Todo, todo_id)

    async def create(self, *, title: str) -> Todo:
        todo = Todo(title=title)
        self._session.add(todo)
        await self._session.flush()
        await self._session.refresh(todo)
        return todo

    async def update(
        self,
        todo: Todo,
        *,
        title: str | None = None,
        completed: bool | None = None,
    ) -> Todo:
        if title is not None:
            todo.title = title
        if completed is not None:
            todo.completed = completed
        await self._session.flush()
        await self._session.refresh(todo)
        return todo

    async def delete(self, todo_id: uuid.UUID) -> bool:
        todo = await self._session.get(Todo, todo_id)
        if todo is None:
            return False
        await self._session.delete(todo)
        await self._session.flush()
        return True
