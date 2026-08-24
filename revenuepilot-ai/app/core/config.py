"""
RevenuePilot AI — Core Configuration
Loads environment variables via Pydantic Settings.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "RevenuePilot AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    PORT: int = 8001

    # ── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "revenuepilot_store"

    # ── LLM / Gemini / Grok / OpenAI ──────────────────────────────────────────
    LLM_PROVIDER: str = "gemini"
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    GROK_API_KEY: str = ""
    GROK_MODEL: str = "grok-4-fast"
    GROK_BASE_URL: str = "https://api.groq.com/openai/v1"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── Auth ──────────────────────────────────────────────────────────────────
    API_SECRET_KEY: str = "revenuepilot_ai_secret_key_2026"
    API_KEY: str = "revenuepilot_ai_secret_key_2026"
    JWT_SECRET: str = "supersecretjwtkey_revenuepilot_2026_hackathon"
    JWT_ALGORITHM: str = "HS256"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "http://localhost:5173",
    ]

    # ── Cache ─────────────────────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = 10  # 10 seconds for live merchant data

    # ── AWS Integration (EventBridge, SNS, Lambda, S3, CloudWatch) ───────────
    AWS_MODE: str = "local"  # "local" for graceful fallback, "cloud" for real AWS
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_SESSION_TOKEN: str = ""
    EVENT_BUS_NAME: str = "revenuepilot-event-bus"
    AWS_SNS_TOPIC_ARN_PAYMENTS: str = ""
    AWS_SNS_TOPIC_ARN_INVENTORY: str = ""
    AWS_SNS_TOPIC_ARN_INCIDENTS: str = ""
    AWS_SNS_TOPIC_ARN: str = ""
    AWS_S3_BUCKET_NAME: str = "revenuepilot-reports"
    AWS_CLOUDWATCH_LOG_GROUP: str = "/revenuepilot/autoops"
    AWS_CLOUDWATCH_LOG_STREAM: str = "autoops-stream"
    AWS_CLOUDWATCH_NAMESPACE: str = "RevenuePilot/AutoOps"
    AWS_LAMBDA_RECOVERY_NAME: str = "revenuepilot-recovery-lambda"

    # ── Store Backend ─────────────────────────────────────────────────────────
    STORE_BACKEND_URL: str = "http://localhost:8000"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
