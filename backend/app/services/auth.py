from __future__ import annotations

from hashlib import sha256

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.study_data import StudyDataRepository
from app.repositories.users import UserRepository
from app.services.study_data import load_seed_data

users = UserRepository()
study_data = StudyDataRepository()


async def register_user(db: AsyncSession, username: str, password: str) -> User | None:
    if await users.get_by_username(db, username):
        return None
    user = await users.create(db, username, hash_password(password))
    await study_data.create_for_user(db, user.id, load_seed_data())
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return None
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    user = await users.get_by_username(db, username)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


async def get_or_create_google_user(
    db: AsyncSession, google_sub: str, avatar_url: str | None = None
) -> User:
    user = await users.get_by_google_sub(db, google_sub)
    if user is not None:
        if user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            await db.commit()
        return user

    username = f"google_{sha256(google_sub.encode('utf-8')).hexdigest()[:24]}"
    user = await users.create(db, username, google_sub=google_sub, avatar_url=avatar_url)
    await study_data.create_for_user(db, user.id, load_seed_data())
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        user = await users.get_by_google_sub(db, google_sub)
        if user is None:
            raise
    return user
