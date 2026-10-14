from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=32)
    password: SecretStr = Field(min_length=12, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if not all(character.isalnum() or character in "_.-" for character in value):
            raise ValueError("Username may contain letters, numbers, _, . and - only.")
        return value.lower()


class AuthenticatedUser(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None


class CurrentUserResponse(BaseModel):
    user: AuthenticatedUser | None


class ProviderResponse(BaseModel):
    google: bool
