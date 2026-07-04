from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/vitallink"
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "noreply@vitallink.local"
    # Base URL for building one-click "I can help" response links.
    BASE_URL: str = "http://localhost:3000"
    # Secret key used to sign JWT tokens embedded in response links.
    # In production, set this to a long random string via env var.
    RESPONSE_TOKEN_SECRET: str = "dev-secret-change-in-production"
    # Token expires after 7 days (matches the hackathon demo window).
    RESPONSE_TOKEN_EXPIRY_DAYS: int = 7

    model_config = {"env_file": ".env"}


settings = Settings()
