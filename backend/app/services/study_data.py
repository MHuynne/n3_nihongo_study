import json
from functools import lru_cache
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import PROJECT_ROOT
from app.repositories.study_data import StudyDataRepository
from app.schemas.study import StudyDataPayload

repository = StudyDataRepository()
SEED_FILE = PROJECT_ROOT / "dist" / "seed.json"


@lru_cache
def load_seed_data() -> dict[str, Any]:
    with SEED_FILE.open(encoding="utf-8") as seed_file:
        rows = json.load(seed_file)
    return StudyDataPayload(data=rows, state={}, notes=[], history=[]).as_json()


async def get_or_create_study_data(db: AsyncSession, user_id: int) -> dict[str, Any]:
    record = await repository.get_for_user(db, user_id)
    if record is not None:
        return record.payload
    record = await repository.create_for_user(db, user_id, load_seed_data())
    await db.commit()
    return record.payload


async def save_study_data(db: AsyncSession, user_id: int, payload: StudyDataPayload) -> None:
    await repository.save_for_user(db, user_id, payload.as_json())
    await db.commit()
