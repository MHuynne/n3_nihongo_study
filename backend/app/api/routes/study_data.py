from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.study import SaveStudyDataResponse, StudyDataPayload
from app.services.study_data import get_or_create_study_data, save_study_data

router = APIRouter(prefix="/api/study-data", tags=["study data"])


@router.get("", response_model=StudyDataPayload)
async def read_study_data(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    return await get_or_create_study_data(db, user.id)


@router.put("", response_model=SaveStudyDataResponse)
async def write_study_data(
    payload: StudyDataPayload,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> SaveStudyDataResponse:
    await save_study_data(db, user.id, payload)
    return SaveStudyDataResponse(saved=True)
