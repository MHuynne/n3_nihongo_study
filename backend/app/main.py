from __future__ import annotations

from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from authlib.integrations.starlette_client import OAuth
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.auth import limiter as auth_limiter
from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.study_data import router as study_data_router
from app.core.config import Settings, get_settings

MAX_REQUEST_BYTES = 2 * 1024 * 1024
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class RequestSecurityMiddleware:
    def __init__(self, app, max_body_bytes: int = MAX_REQUEST_BYTES) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or not scope.get("path", "").startswith("/api/"):
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        method = scope.get("method", "GET").upper()
        if method in UNSAFE_METHODS:
            origin = headers.get(b"origin")
            host = headers.get(b"host")
            forwarded_proto = headers.get(b"x-forwarded-proto", b"").split(b",", 1)[0]
            scheme = forwarded_proto.strip() or scope.get("scheme", "http").encode("ascii")
            parsed_origin = urlsplit(origin.decode("latin-1")) if origin else None
            expected_host = host.decode("latin-1").lower() if host else ""
            if (
                parsed_origin is None
                or parsed_origin.netloc.lower() != expected_host
                or parsed_origin.scheme not in {"http", "https"}
                or parsed_origin.scheme.encode("ascii") != scheme
            ):
                await self._reject(send, 403, "Yêu cầu không cùng nguồn bị từ chối.")
                return

        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > self.max_body_bytes:
                    await self._reject(send, 413, "Dữ liệu gửi lên quá lớn.")
                    return
            except ValueError:
                await self._reject(send, 400, "Content-Length không hợp lệ.")
                return

        if method not in UNSAFE_METHODS:
            await self.app(scope, receive, send)
            return

        messages = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            messages.append(message)
            size += len(message.get("body", b""))
            if size > self.max_body_bytes:
                await self._reject(send, 413, "Dữ liệu gửi lên quá lớn.")
                return
            if not message.get("more_body", False):
                break

        async def replay_body():
            if messages:
                return messages.pop(0)
            return await receive()

        await self.app(scope, replay_body, send)

    @staticmethod
    async def _reject(send, status_code: int, message: str) -> None:
        body = ('{"detail":"' + message + '"}').encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json; charset=utf-8"),
                    (b"content-length", str(len(body)).encode("ascii")),
                    (b"x-content-type-options", b"nosniff"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


def create_app(settings: Settings | None = None, engine: AsyncEngine | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    owns_engine = engine is None
    db_engine = engine or create_async_engine(
        app_settings.database_url,
        pool_pre_ping=True,
        pool_recycle=1800,
    )
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        yield
        if owns_engine:
            await db_engine.dispose()

    application = FastAPI(
        title="N3 Study Studio API",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.state.settings = app_settings
    application.state.session_factory = session_factory
    application.state.limiter = auth_limiter
    application.state.oauth = None

    if app_settings.google_client_id and app_settings.google_client_secret:
        oauth = OAuth()
        oauth.register(
            name="google",
            client_id=app_settings.google_client_id,
            client_secret=app_settings.google_client_secret.get_secret_value(),
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
        application.state.oauth = oauth

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, _error: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"detail": "Dữ liệu yêu cầu không hợp lệ."},
        )

    @application.exception_handler(RateLimitExceeded)
    async def rate_limit_error_handler(
        _request: Request, _error: RateLimitExceeded
    ) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": "Quá nhiều lần thử. Vui lòng chờ rồi thử lại."},
        )

    application.include_router(auth_router)
    application.include_router(study_data_router)
    application.include_router(health_router)
    application.add_middleware(RequestSecurityMiddleware)
    application.add_middleware(
        SessionMiddleware,
        secret_key=app_settings.session_secret.get_secret_value(),
        session_cookie="n3studio.sid",
        max_age=14 * 24 * 60 * 60,
        same_site="lax",
        https_only=app_settings.session_cookie_secure,
    )
    application.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=app_settings.trusted_hosts,
    )
    application.mount(
        "/",
        StaticFiles(directory=app_settings.frontend_directory, html=True, check_dir=True),
        name="frontend",
    )
    return application


app = create_app()
