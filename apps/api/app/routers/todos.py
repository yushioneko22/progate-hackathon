import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas.todo import TodoCreate, TodoRead, TodoUpdate
from app.services.todo import TodoNotFoundError, TodoService

router = APIRouter(prefix="/todos", tags=["todos"])


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> TodoService:
    return TodoService(session)


ServiceDep = Annotated[TodoService, Depends(get_service)]


@router.get("", response_model=list[TodoRead])
async def list_todos(service: ServiceDep) -> list[TodoRead]:
    todos = await service.list()
    return [TodoRead.model_validate(t) for t in todos]


@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
async def create_todo(payload: TodoCreate, service: ServiceDep) -> TodoRead:
    todo = await service.create(payload)
    return TodoRead.model_validate(todo)


@router.patch("/{todo_id}", response_model=TodoRead)
async def update_todo(
    todo_id: uuid.UUID, payload: TodoUpdate, service: ServiceDep
) -> TodoRead:
    try:
        todo = await service.update(todo_id, payload)
    except TodoNotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="todo not found") from e
    return TodoRead.model_validate(todo)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(todo_id: uuid.UUID, service: ServiceDep) -> None:
    try:
        await service.delete(todo_id)
    except TodoNotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="todo not found") from e
