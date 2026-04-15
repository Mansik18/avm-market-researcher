"""Application settings loaded from .env file and environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    exa_api_key: str = ""
    llm_api_key: str = ""
    llm_base_url: str = "https://llmserver.codecrafters.kz/v1"
    llm_model: str = "gpt-5.2"

    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", protected_namespaces=("settings_",)
    )


settings = Settings()
