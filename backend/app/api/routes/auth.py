from __future__ import annotations

from typing import Annotated
from urllib.parse import urlsplit

from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import Settings
from app.core.config import get_settings as load_settings
from app.db.session import get_db_session
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.auth import (
    AuthenticatedUser,
    Credentials,
    CurrentUserResponse,
    ProviderResponse,
)
from app.services.auth import authenticate_user, get_or_create_google_user, register_user

router = APIRouter(prefix="/api/auth", tags=["authentication"])
users = UserRepository()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=load_settings().rate_limit_storage_uri,
)


def get_request_settings(request: Request) -> Settings:
    return request.app.state.settings


def set_authenticated_session(request: Request, user: User) -> AuthenticatedUser:
    request.session.clear()
    request.session["user_id"] = user.id
    request.session["username"] = user.username
    return AuthenticatedUser(id=user.id, username=user.username, avatar_url=user.avatar_url)


def verified_google_avatar(profile: object) -> str | None:
    if not isinstance(profile, dict):
        return None
    avatar_url = profile.get("picture")
    if not isinstance(avatar_url, str) or len(avatar_url) > 2048:
        return None
    parsed_url = urlsplit(avatar_url)
    hostname = parsed_url.hostname or ""
    if (
        parsed_url.scheme != "https"
        or parsed_url.username is not None
        or parsed_url.password is not None
        or not (hostname == "googleusercontent.com" or hostname.endswith(".googleusercontent.com"))
    ):
        return None
    return avatar_url


@router.get("/me", response_model=CurrentUserResponse)
async def current_session(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> CurrentUserResponse:
    user_id = request.session.get("user_id")
    if not isinstance(user_id, int):
        return CurrentUserResponse(user=None)
    user = await db.get(User, user_id)
    if user is None:
        request.session.clear()
        return CurrentUserResponse(user=None)
    return CurrentUserResponse(
        user=AuthenticatedUser(id=user.id, username=user.username, avatar_url=user.avatar_url)
    )


@router.get("/providers", response_model=ProviderResponse)
async def available_providers(request: Request) -> ProviderResponse:
    return ProviderResponse(google=request.app.state.oauth is not None)


@router.post("/register", response_model=AuthenticatedUser, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/15minutes")
async def register(
    request: Request,
    credentials: Credentials,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthenticatedUser:
    user = await register_user(db, credentials.username, credentials.password.get_secret_value())
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên tài khoản này đã được sử dụng.",
        )
    return set_authenticated_session(request, user)


@router.post("/login", response_model=AuthenticatedUser)
@limiter.limit("20/15minutes")
async def login(
    request: Request,
    credentials: Credentials,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthenticatedUser:
    password = credentials.password.get_secret_value()
    user = await authenticate_user(db, credentials.username, password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên tài khoản hoặc mật khẩu không đúng.",
        )
    return set_authenticated_session(request, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    _user: Annotated[User, Depends(get_current_user)],
) -> None:
    request.session.clear()


@router.get("/google")
@limiter.limit("20/15minutes")
async def google_login(
    request: Request,
    settings: Annotated[Settings, Depends(get_request_settings)],
):
    oauth = request.app.state.oauth
    if oauth is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Đăng nhập Google chưa được cấu hình.",
        )
    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    oauth = request.app.state.oauth
    if oauth is None:
        return RedirectResponse("/?authError=google-unavailable", status_code=303)
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse("/?authError=google-cancelled", status_code=303)

    profile = token.get("userinfo")
    if not profile or not profile.get("sub") or profile.get("email_verified") is not True:
        return RedirectResponse("/?authError=google-unverified", status_code=303)

    user = await get_or_create_google_user(
        db, str(profile["sub"]), verified_google_avatar(profile)
    )
    set_authenticated_session(request, user)
    return RedirectResponse("/", status_code=303)
