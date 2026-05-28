from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://todo:todo@localhost:5432/todo"

    @field_validator("database_url")
    @classmethod
    def _force_asyncpg_driver(cls, value: str) -> str:
        # Managed Postgres (e.g. Render) hands out postgresql:// or postgres://
        # URLs, but our async engine and Alembic both require the asyncpg driver.
        for scheme in ("postgresql://", "postgres://"):
            if value.startswith(scheme):
                return "postgresql+asyncpg://" + value[len(scheme) :]
        return value
    # Dev origins: Next.js (3000), Expo web (8081), legacy Expo web (19006).
    # React Native (iOS/Android) does not enforce CORS, so no entry is needed.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
    ]
    api_port: int = 8787


settings = Settings()
