"""
RevenuePilot AI — Pytest Configuration & Shared Fixtures
=========================================================
* Loads .env before any test runs.
* Sets safe default environment variables so unit tests never need real secrets.
* Provides fixtures for mocked AWS clients, mocked LLM providers, MongoDB, Redis,
  and FastAPI TestClient setup.
* Integration tests that need real credentials rely on GitHub Actions secrets
  injected as environment variables — they override the defaults set here.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── Add revenuepilot-ai root to sys.path so `app.*` imports resolve ──────────
_AI_ROOT = Path(__file__).resolve().parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

# ── Load .env early (before any app module is imported) ──────────────────────
_env_file = _AI_ROOT / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file, override=False)  # don't override GitHub Actions secrets
    except ImportError:
        pass  # python-dotenv not installed — rely on real env vars


_UNIT_DEFAULTS: dict[str, str] = {
    "ENVIRONMENT": "test",
    "DEBUG": "false",
    "PORT": "8001",
    "AWS_MODE": "local",                      # never hit real AWS in unit tests
    "AWS_REGION": "ap-south-1",
    "AWS_ACCESS_KEY_ID": "",
    "AWS_SECRET_ACCESS_KEY": "",
    "AWS_SESSION_TOKEN": "",
    "LLM_PROVIDER": "gemini",
    "GEMINI_API_KEY": "unit-test-placeholder",
    "GROK_API_KEY": "unit-test-placeholder",
    "OPENAI_API_KEY": "unit-test-placeholder",
    "MONGODB_URL": os.environ.get("MONGODB_URL") or "mongodb://localhost:27017",
    "DATABASE_NAME": os.environ.get("DATABASE_NAME") or "revenuepilot_test",
    "REDIS_URL": os.environ.get("REDIS_URL") or "redis://localhost:6379/0",
    "RAZORPAY_KEY_ID": os.environ.get("RAZORPAY_KEY_ID") or "rzp_test_placeholder",
    "RAZORPAY_KEY_SECRET": os.environ.get("RAZORPAY_KEY_SECRET") or "placeholder_secret",
    "RAZORPAY_WEBHOOK_SECRET": os.environ.get("RAZORPAY_WEBHOOK_SECRET") or "placeholder_webhook",
    "JWT_SECRET": os.environ.get("JWT_SECRET") or "supersecretjwtkey_revenuepilot_2026_hackathon",
    "JWT_ALGORITHM": "HS256",
    "SES_FROM_EMAIL": "noreply@revenuepilot.ai",
}

for _key, _val in _UNIT_DEFAULTS.items():
    if not os.environ.get(_key, "").strip():
        os.environ[_key] = _val

# Sync with app settings singleton
try:
    from app.core.config import settings
    if not (settings.MONGODB_URL or "").strip():
        settings.MONGODB_URL = os.environ["MONGODB_URL"]
    if not (settings.DATABASE_NAME or "").strip():
        settings.DATABASE_NAME = os.environ["DATABASE_NAME"]
except Exception:
    pass



# ─────────────────────────────────────────────────────────────────────────────
# Fixtures — Mocked AWS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def mock_boto3_client():
    """
    Patches boto3.client so unit tests never make real AWS network calls.
    Returns the MagicMock that replaces the client.
    """
    mock_client = MagicMock()
    # Sensible default responses for common AWS calls
    mock_client.put_events.return_value = {"FailedEntryCount": 0, "Entries": [{"EventId": "mock-evt-id"}]}
    mock_client.publish.return_value = {"MessageId": "mock-msg-id"}
    mock_client.put_metric_data.return_value = {}
    mock_client.put_log_events.return_value = {"nextSequenceToken": "mock-token"}
    mock_client.create_presigned_url = MagicMock(return_value="https://s3.mock/presigned-url")
    with patch("boto3.client", return_value=mock_client):
        yield mock_client


@pytest.fixture()
def mock_aws_eventbridge(mock_boto3_client):
    """Convenience fixture: mocked EventBridge client only."""
    return mock_boto3_client


@pytest.fixture()
def mock_aws_sns(mock_boto3_client):
    """Convenience fixture: mocked SNS client only."""
    return mock_boto3_client


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures — Mocked LLM
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def mock_llm_provider():
    """
    Returns a MagicMock that mimics a BaseLLMProvider so unit tests can inject
    it without needing a real API key.
    """
    mock_provider = MagicMock()
    mock_provider.name = "mock"
    mock_provider.model = "mock-model"
    mock_provider.chat = AsyncMock(return_value={"answer": "mocked LLM response", "success": True})
    return mock_provider


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures — MongoDB & Redis
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def mock_mongodb():
    """
    Returns a fully mocked async MongoDB database object.
    Use this in unit tests instead of a real MongoDB connection.
    """
    mock_db = MagicMock()

    # Common collections
    for collection in (
        "orders", "payments", "products", "users", "carts",
        "recovery_candidates", "communication_logs", "events",
        "lambda_executions", "aws_audit_logs",
    ):
        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="mock_id"))
        mock_col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        mock_col.count_documents = AsyncMock(return_value=0)
        mock_col.aggregate = MagicMock(return_value=AsyncMock(to_list=AsyncMock(return_value=[])))
        setattr(mock_db, collection, mock_col)
        mock_db.__getitem__ = MagicMock(return_value=mock_col)

    return mock_db


@pytest.fixture()
def mongodb_url():
    """Returns the configured MONGODB_URL string."""
    return os.environ.get("MONGODB_URL", "mongodb://localhost:27017")


@pytest.fixture()
def mock_redis():
    """Returns a mocked Redis client instance for unit testing."""
    redis_mock = MagicMock()
    redis_mock.get = MagicMock(return_value=None)
    redis_mock.set = MagicMock(return_value=True)
    redis_mock.delete = MagicMock(return_value=1)
    redis_mock.ping = MagicMock(return_value=True)
    return redis_mock


@pytest.fixture()
def redis_url():
    """Returns the configured REDIS_URL string."""
    return os.environ.get("REDIS_URL", "redis://localhost:6379/0")


@pytest.fixture()
def auth_headers():
    """Returns valid Bearer JWT Authorization headers for test principal."""
    import jwt
    from datetime import datetime, timedelta, timezone
    from app.core.config import settings

    payload = {
        "user_id": "test_user_123",
        "merchant_id": "merch_default",
        "role": "merchant",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    secret = getattr(settings, "JWT_SECRET", None) or "supersecretjwtkey_revenuepilot_2026_hackathon"
    algorithm = getattr(settings, "JWT_ALGORITHM", "HS256")
    token = jwt.encode(payload, secret, algorithm=algorithm)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def test_client(auth_headers):
    """Shared FastAPI TestClient fixture with Bearer auth headers."""
    from fastapi.testclient import TestClient
    from app.main import create_app
    application = create_app()
    with TestClient(application, headers=auth_headers) as client:
        yield client


# ─────────────────────────────────────────────────────────────────────────────
# Markers — Register custom markers to suppress PytestUnknownMarkWarning
# ─────────────────────────────────────────────────────────────────────────────

def pytest_configure(config):
    config.addinivalue_line("markers", "unit: Fast unit tests (no external services)")
    config.addinivalue_line("markers", "integration: Requires external services")
    config.addinivalue_line("markers", "aws: Requires AWS credentials")
    config.addinivalue_line("markers", "llm: Requires OpenAI / Gemini / Grok API keys")
    config.addinivalue_line("markers", "razorpay: Requires Razorpay credentials")

