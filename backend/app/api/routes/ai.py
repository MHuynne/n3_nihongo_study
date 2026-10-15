from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.routes.auth import limiter
from app.core.config import Settings
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.study_data import StudyDataRepository
from app.schemas.study import FlashcardQuestionRequest, FlashcardQuestionResponse
from app.services.ai_questions import GeminiResponseError, generate_flashcard_question

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI study tools"])
repository = StudyDataRepository()


@router.post(
    "/flashcard-question",
    response_model=FlashcardQuestionResponse,
)
@limiter.limit("10/minute")
async def create_flashcard_question(
    request: Request,
    payload: FlashcardQuestionRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> FlashcardQuestionResponse:
    settings: Settings = request.app.state.settings
    if settings.gemini_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tính năng AI chưa được cấu hình API key trên máy chủ.",
        )

    study_data = await repository.get_for_user(db, user.id)
    card = next(
        (
            item
            for item in (study_data.payload.get("data", []) if study_data else [])
            if item.get("id") == payload.card_id
        ),
        None,
    )
    if card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy flashcard trong tài khoản của bạn.",
        )

    try:
        question = await generate_flashcard_question(
            settings,
            term=card.get("term", ""),
            meaning=card.get("meaning", ""),
            reading=card.get("reading", ""),
            category=card.get("category", ""),
            example=card.get("example", ""),
        )
    except httpx.TimeoutException as error:
        logger.warning("Gemini flashcard question request timed out: %s", error)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Gemini phản hồi quá lâu. Hãy thử lại sau.",
        ) from error
    except httpx.HTTPStatusError as error:
        logger.error("Gemini rejected flashcard question request: %s", error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini chưa thể tạo câu hỏi. Hãy kiểm tra cấu hình API key rồi thử lại.",
        ) from error
    except (httpx.RequestError, GeminiResponseError) as error:
        logger.error("Gemini flashcard question request failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Không tạo được câu hỏi từ Gemini. Hãy thử lại sau.",
        ) from error

    return FlashcardQuestionResponse(question=question)
