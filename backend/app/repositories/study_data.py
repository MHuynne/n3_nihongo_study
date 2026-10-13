from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.study_data import StudyData


class StudyDataRepository:
    async def get_for_user(self, db: AsyncSession, user_id: int) -> StudyData | None:
        result = await db.execute(select(StudyData).where(StudyData.user_id == user_id))
        return result.scalar_one_or_none()

    async def create_for_user(self, db: AsyncSession, user_id: int, payload: dict) -> StudyData:
        study_data = StudyData(user_id=user_id, payload=payload)
        db.add(study_data)
        await db.flush()
        return study_data

    async def save_for_user(self, db: AsyncSession, user_id: int, payload: dict) -> StudyData:
        study_data = await self.get_for_user(db, user_id)
        if study_data is None:
            return await self.create_for_user(db, user_id, payload)
        study_data.payload = payload
        await db.flush()
        return study_data
