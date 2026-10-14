from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    async def get_by_username(self, db: AsyncSession, username: str) -> User | None:
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_by_google_sub(self, db: AsyncSession, google_sub: str) -> User | None:
        result = await db.execute(select(User).where(User.google_sub == google_sub))
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        username: str,
        password_hash: str | None = None,
        google_sub: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        user = User(
            username=username,
            password_hash=password_hash,
            google_sub=google_sub,
            avatar_url=avatar_url,
        )
        db.add(user)
        await db.flush()
        return user
