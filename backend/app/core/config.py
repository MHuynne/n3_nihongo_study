from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


def find_project_root() -> Path:
    source_root = Path(__file__).resolve().parents[3]
    for candidate in (source_root, Path.cwd(), Path.cwd().parent):
        if (candidate / "dist" / "seed.json").is_file():
            return candidate.resolve()
    return source_root


PROJECT_ROOT = find_project_root()


class Settings(BaseSettings):
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = Field(
        default=8000,
        validation_alias=AliasChoices("APP_PORT", "PORT"),
    )
    session_secret: SecretStr
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_user: str
    mysql_password: SecretStr
    mysql_database: str
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str | None = None
    rate_limit_storage_uri: str = "memory://"
    forwarded_allow_ips: str = "127.0.0.1"
    trusted_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    frontend_directory: Path = PROJECT_ROOT / "dist"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator(
        "google_client_id",
        "google_client_secret",
        "google_redirect_uri",
        mode="before",
    )
    @classmethod
    def normalize_optional_google_settings(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def validate_secrets_and_oauth(self) -> Settings:
        if len(self.session_secret.get_secret_value()) < 32:
            raise ValueError("SESSION_SECRET must contain at least 32 characters.")
        google_values = (
            self.google_client_id,
            self.google_client_secret,
            self.google_redirect_uri,
        )
        if any(google_values) and not all(google_values):
            raise ValueError(
                "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and "
                "GOOGLE_REDIRECT_URI must be set together."
            )
        if not self.rate_limit_storage_uri.strip():
            raise ValueError("RATE_LIMIT_STORAGE_URI must not be empty.")
        if self.app_env == "production" and (
            "*" in self.trusted_hosts or "testserver" in self.trusted_hosts
        ):
            raise ValueError("Set TRUSTED_HOSTS to the public application domains in production.")
        if self.app_env == "production" and (
            "*" in self.forwarded_allow_ips or not self.forwarded_allow_ips.strip()
        ):
            raise ValueError("Set FORWARDED_ALLOW_IPS to trusted proxy IPs in production.")
        if (
            self.google_redirect_uri
            and self.app_env == "production"
            and not self.google_redirect_uri.startswith("https://")
        ):
            raise ValueError("GOOGLE_REDIRECT_URI must use HTTPS in production.")
        return self

    @property
    def database_url(self) -> str:
        return URL.create(
            "mysql+asyncmy",
            username=self.mysql_user,
            password=self.mysql_password.get_secret_value(),
            host=self.mysql_host,
            port=self.mysql_port,
            database=self.mysql_database,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)

    @property
    def session_cookie_secure(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
