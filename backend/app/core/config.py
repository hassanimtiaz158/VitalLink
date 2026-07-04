from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/vitallink"
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "noreply@vitallink.local"

    model_config = {"env_file": ".env"}


settings = Settings()
