"""
RevenuePilot AI — Core Configuration & AWS Settings
Loads environment variables safely via Pydantic Settings and defines AwsSettings dataclass.
"""
from dataclasses import dataclass, field
from functools import lru_cache
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


@dataclass
class AwsSettings:
    AWS_MODE: str = "local"
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_SESSION_TOKEN: str = ""
    EVENT_BUS_NAME: str = "revenuepilot-event-bus"
    AWS_SNS_TOPIC_ARN_PAYMENTS: str = ""
    AWS_SNS_TOPIC_ARN_INVENTORY: str = ""
    AWS_SNS_TOPIC_ARN_INCIDENTS: str = ""
    AWS_S3_BUCKET_NAME: str = "revenuepilot-reports"
    AWS_CLOUDWATCH_NAMESPACE: str = "RevenuePilot/AutoOps"
    AWS_CLOUDWATCH_LOG_GROUP: str = "/revenuepilot/autoops"
    AWS_CLOUDWATCH_LOG_STREAM: str = "autoops-stream"
    execution_mode: str = "local"

    @classmethod
    def load_from_env(cls) -> "AwsSettings":
        key_id = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
        secret = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
        forced_mode = os.getenv("AWS_MODE", "local").strip().lower()

        # Determine execution mode safely
        if key_id and secret and forced_mode != "local":
            exec_mode = "aws"
        else:
            exec_mode = "local"

        return cls(
            AWS_MODE=forced_mode,
            AWS_REGION=os.getenv("AWS_REGION", "ap-south-1").strip(),
            AWS_ACCESS_KEY_ID=key_id,
            AWS_SECRET_ACCESS_KEY=secret,
            AWS_SESSION_TOKEN=os.getenv("AWS_SESSION_TOKEN", "").strip(),
            EVENT_BUS_NAME=os.getenv("EVENT_BUS_NAME", "revenuepilot-event-bus").strip(),
            AWS_SNS_TOPIC_ARN_PAYMENTS=os.getenv("AWS_SNS_TOPIC_ARN_PAYMENTS", "arn:aws:sns:ap-south-1:123456789012:revenuepilot-payments").strip(),
            AWS_SNS_TOPIC_ARN_INVENTORY=os.getenv("AWS_SNS_TOPIC_ARN_INVENTORY", "arn:aws:sns:ap-south-1:123456789012:revenuepilot-inventory").strip(),
            AWS_SNS_TOPIC_ARN_INCIDENTS=os.getenv("AWS_SNS_TOPIC_ARN_INCIDENTS", "arn:aws:sns:ap-south-1:123456789012:revenuepilot-incidents").strip(),
            AWS_S3_BUCKET_NAME=os.getenv("AWS_S3_BUCKET_NAME", "revenuepilot-reports").strip(),
            AWS_CLOUDWATCH_NAMESPACE=os.getenv("AWS_CLOUDWATCH_NAMESPACE", "RevenuePilot/AutoOps").strip(),
            AWS_CLOUDWATCH_LOG_GROUP=os.getenv("AWS_CLOUDWATCH_LOG_GROUP", "/revenuepilot/autoops").strip(),
            AWS_CLOUDWATCH_LOG_STREAM=os.getenv("AWS_CLOUDWATCH_LOG_STREAM", "autoops-stream").strip(),
            execution_mode=exec_mode,
        )


from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "RevenuePilot AI"
    VERSION: str = "2.6.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    PORT: int = 8001

    # ── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URL: str = os.getenv("MONGODB_URL")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME")

    # ── LLM / Gemini / Grok / OpenAI ──────────────────────────────────────────
    LLM_PROVIDER: str = "gemini"
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    GROK_API_KEY: str = ""
    GROK_MODEL: str = "grok-4-fast"
    GROK_BASE_URL: str = "https://api.groq.com/openai/v1"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── Auth ──────────────────────────────────────────────────────────────────
    API_SECRET_KEY: str = ""
    API_KEY: str = ""
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:8000",
        "http://localhost:8001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:5173",
    ]

    # ── Cache ─────────────────────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = 10

    # ── AWS Integration ──────────────────────────────────────────────────────
    AWS_MODE: str = "local"
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

    # ── Notification / Email Target Settings ─────────────────────────────────
    NOTIFICATION_EMAIL: str = "jpnishath@gmail.com"
    TEST_EMAIL_RECIPIENT: str = "jpnishath@gmail.com"

    # ── Store Backend ─────────────────────────────────────────────────────────
    STORE_BACKEND_URL: str = "http://localhost:8000"

    def validate_runtime_configuration(self) -> None:
        if self.ENVIRONMENT.lower() in {"production", "staging"} and not self.JWT_SECRET:
            raise RuntimeError("JWT_SECRET is required in production")

    @property
    def aws_settings(self) -> AwsSettings:
        return AwsSettings.load_from_env()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
aws_env = AwsSettings.load_from_env()
