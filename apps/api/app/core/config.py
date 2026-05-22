from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://todo:todo@localhost:5432/todo"
    cors_origins: list[str] = ["http://localhost:3000"]
    api_port: int = 8787


settings = Settings()
