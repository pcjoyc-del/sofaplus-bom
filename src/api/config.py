from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    DIRECT_URL: str
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "dev-secret-key-change-before-deploy"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_DEBUG: bool = True

    @property
    def async_database_url(self) -> str:
        # asyncpg ต้องการ postgresql+asyncpg:// prefix
        return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
