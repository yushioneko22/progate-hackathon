import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.todo import Todo
from app.repositories.todo import TodoRepository
from app.schemas.todo import TodoCreate, TodoUpdate


class TodoNotFoundError(Exception):
    pass


class TodoService:
    """Business logic for Todo. Coordinates the repository and owns the unit
    of work (commit/rollback). Routers must not import the repository directly."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = TodoRepository(session)

    async def list(self) -> Sequence[Todo]:
        return await self._repo.list_all()

    async def create(self, payload: TodoCreate) -> Todo:
        todo = await self._repo.create(title=payload.title)
        await self._session.commit()
        return todo

    async def update(self, todo_id: uuid.UUID, payload: TodoUpdate) -> Todo:
        todo = await self._repo.get(todo_id)
        if todo is None:
            raise TodoNotFoundError(str(todo_id))
        updated = await self._repo.update(
            todo, title=payload.title, completed=payload.completed
        )
        await self._session.commit()
        return updated

    async def delete(self, todo_id: uuid.UUID) -> None:
        deleted = await self._repo.delete(todo_id)
        if not deleted:
            raise TodoNotFoundError(str(todo_id))
        await self._session.commit()
