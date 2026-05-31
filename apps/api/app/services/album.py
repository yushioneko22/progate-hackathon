from __future__ import annotations

import math
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.album import Album
from app.repositories.album import AlbumRepository
from app.repositories.invite import InviteCodeRepository
from app.schemas.album import AlbumCreate, AlbumRead, InviteCodeRead, MemberRead

# 招待コードの文字集合。見間違いやすい O/0/I/1 を除外。
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6


class AlbumService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = AlbumRepository(session)
        self._invite_repo = InviteCodeRepository(session)

    async def list_for_user(self, user_id: uuid.UUID) -> list[AlbumRead]:
        albums = await self._repo.list_by_user(user_id)
        return [self._to_read(a, self._role_of(a, user_id)) for a in albums]

    @staticmethod
    def _role_of(album: Album, user_id: uuid.UUID) -> str | None:
        for member in album.members:
            if member.user_id == user_id:
                return str(member.role)
        return None

    async def create(self, payload: AlbumCreate, creator_id: uuid.UUID) -> AlbumRead:
        album = await self._repo.create(
            title=payload.title,
            created_by=creator_id,
            reveal_date=payload.reveal_date,
            max_exposures=payload.max_exposures,
            bgm_url=payload.bgm_url,
        )
        await self._repo.add_member(
            album_id=album.id, user_id=creator_id, role="owner"
        )
        await self._session.commit()
        await self._session.refresh(album)
        # リフレッシュ後はメンバー・写真を再取得
        albums = await self._repo.list_by_user(creator_id)
        created = next(a for a in albums if a.id == album.id)
        return self._to_read(created, "owner")

    async def delete_album(self, album_id: uuid.UUID, user_id: uuid.UUID) -> None:
        member = await self._repo.get_member(album_id=album_id, user_id=user_id)
        if member is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="album not found")
        if member.role != "owner":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="only the owner can delete the album",
            )
        await self._repo.delete_by_id(album_id)
        await self._session.commit()

    async def create_invite(
        self, album_id: uuid.UUID, user_id: uuid.UUID
    ) -> InviteCodeRead:
        member = await self._repo.get_member(album_id=album_id, user_id=user_id)
        if member is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="album not found")
        if member.role != "owner":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="only the owner can create an invite",
            )
        code = await self._generate_unique_code()
        invite = await self._invite_repo.create(
            album_id=album_id, code=code, created_by=user_id, expires_at=None
        )
        await self._session.commit()
        return InviteCodeRead(code=invite.code, expires_at=invite.expires_at)

    async def join_by_code(self, code: str, user_id: uuid.UUID) -> AlbumRead:
        invite = await self._invite_repo.find_by_code(code.strip().upper())
        if invite is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail="invalid invite code"
            )
        if invite.expires_at is not None:
            expires = invite.expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires < datetime.now(UTC):
                raise HTTPException(status.HTTP_410_GONE, detail="invite code expired")

        existing = await self._repo.get_member(
            album_id=invite.album_id, user_id=user_id
        )
        if existing is None:
            await self._repo.add_member(
                album_id=invite.album_id, user_id=user_id, role="member"
            )
            await self._session.commit()

        albums = await self._repo.list_by_user(user_id)
        album = next((a for a in albums if a.id == invite.album_id), None)
        if album is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="album not found")
        return self._to_read(album, self._role_of(album, user_id))

    async def list_members(
        self, album_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[MemberRead]:
        member = await self._repo.get_member(album_id=album_id, user_id=user_id)
        if member is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="album not found")
        members = await self._repo.list_members(album_id)
        return [
            MemberRead(
                user_id=m.user_id,
                display_name=m.user.display_name,
                avatar_url=m.user.avatar_url,
                role=m.role,
                joined_at=m.joined_at,
            )
            for m in members
        ]

    async def _generate_unique_code(self) -> str:
        for _ in range(10):
            code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
            if not await self._invite_repo.exists(code):
                return code
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="could not generate a unique invite code",
        )

    @staticmethod
    def _to_read(album: Album, my_role: str | None = None) -> AlbumRead:
        now = datetime.now(UTC)
        reveal = album.reveal_date
        # DB から取得した datetime が naive の場合は UTC と見なす
        if reveal.tzinfo is None:
            reveal = reveal.replace(tzinfo=UTC)
        is_opened = reveal <= now
        days_left = None if is_opened else math.ceil((reveal - now).total_seconds() / 86400)
        return AlbumRead(
            id=album.id,
            title=album.title,
            reveal_date=reveal,
            max_exposures=album.max_exposures,
            bgm_url=album.bgm_url,
            status="opened" if is_opened else "sealed",
            days_left=days_left,
            member_count=len(album.members),
            photo_count=len(album.photos),
            my_role=my_role,
            created_at=album.created_at,
        )
