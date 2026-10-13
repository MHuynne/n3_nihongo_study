from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("/live")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def readiness(
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}
