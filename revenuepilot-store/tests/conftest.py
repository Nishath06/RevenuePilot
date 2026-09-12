import pytest
import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.core.security import get_password_hash, create_access_token

@pytest.fixture
def mock_user_data():
    return {
        "name": "Test User",
        "email": "test@example.com",
        "phone": "9876543210",
        "password": "Password123!"
    }


def pytest_configure(config):
    config.addinivalue_line("markers", "unit: Fast unit tests")
    config.addinivalue_line("markers", "integration: Requires external services")
    config.addinivalue_line("markers", "aws: Requires AWS credentials")
    config.addinivalue_line("markers", "llm: Requires LLM keys")
    config.addinivalue_line("markers", "razorpay: Requires Razorpay credentials")

