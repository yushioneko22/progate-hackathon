from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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

    # 認証: 自前のセッショントークン(JWT)の署名鍵と有効期限。
    # 本番では必ず環境変数 JWT_SECRET を上書きすること(既定値は開発用)。
    jwt_secret: str = "dev-insecure-change-me-please-set-jwt-secret-env"
    jwt_algorithm: str = "HS256"
    jwt_expires_min: int = 60 * 24 * 30  # 30日

    # Google ログイン: 検証時に許容する audience(client ID)の一覧。
    # iOS / Android / Web で別々の client ID が発行されるため複数許容する。
    # 環境変数 GOOGLE_CLIENT_IDS にカンマ区切りで指定 (例: "xxx.apps...,yyy.apps...")。
    # NoDecode: pydantic-settings の JSON 自動デコードを抑止し、下の validator で
    # カンマ区切り文字列を list へ変換する(JSON 配列での指定も不要にする)。
    google_client_ids: Annotated[list[str], NoDecode] = []

    @field_validator("google_client_ids", mode="before")
    @classmethod
    def _split_client_ids(cls, value: object) -> object:
        # env からは文字列で渡るためカンマ区切りを list に変換する。
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    # Supabase Storage (写真の実体を保存するオブジェクトストレージ)
    # supabase_key は service_role(secret) キーを使う(anon ではアップロード不可)
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_bucket: str = "photos"

    # Gemini API（AI写真加工機能）
    gemini_api_key: str = ""

    # リアルタイムフィルタープレビュー (Phase B / 課金機能) の解放フラグ。
    # 現状は器のみ。課金連携を入れる際はユーザー単位の判定に置き換える。
    realtime_preview_enabled: bool = False


settings = Settings()
