"""Application configuration loaded from environment variables.

All secrets and connection strings come from the environment so the same
image runs unchanged across local, Render, and CI. See .env.example.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Core
    database_url: str = "postgresql+psycopg2://tasap:tasap@localhost:5432/tasap"
    secret_key: str = "change-me"
    app_base_url: str = "http://localhost:8000"

    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_hours: int = 8
    refresh_token_expire_days: int = 30

    # Cookies
    cookie_secure: bool = False  # set True in production (HTTPS only)
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    # Supabase Storage (NOT AWS)
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "tasap-uploads"

    # CORS — comma-separated string (kept as a plain str so pydantic-settings
    # doesn't try to JSON-decode it); use cors_origins_list for the parsed form.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
