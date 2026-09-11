"""
RevenuePilot AI — Test Suite
Tests for MongoDB connection, all analytics functions, and API endpoints.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def app():
    """Create the FastAPI app with a real MongoDB connection for integration tests."""
    from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
    from app.main import create_app

    await connect_to_mongodb()
    application = create_app()
    yield application
    await close_mongodb_connection()


@pytest_asyncio.fixture(scope="session")
async def client(app):
    from app.core.config import settings
    import jwt
    from datetime import datetime, timedelta, timezone

    token_payload = {
        "user_id": "test_user_123",
        "merchant_id": "merch_default",
        "role": "merchant",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    jwt_secret = getattr(settings, "JWT_SECRET", "supersecretjwtkey")
    token = jwt.encode(token_payload, jwt_secret, algorithm=getattr(settings, "JWT_ALGORITHM", "HS256"))
    headers = {"Authorization": f"Bearer {token}"}

    try:
        from httpx import AsyncClient, ASGITransport
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers) as ac:
            yield ac
    except ImportError:
        from httpx import AsyncClient
        async with AsyncClient(app=app, base_url="http://test", headers=headers) as ac:
            yield ac


# ─────────────────────────────────────────────────────────────────────────────
# MongoDB Connection Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mongodb_connection():
    """MongoDB should be reachable and return True from health_check."""
    from app.db.mongodb import health_check
    result = await health_check()
    assert result is True, "MongoDB health check must return True when connected"


@pytest.mark.asyncio
async def test_mongodb_get_database():
    """get_database() should return a valid database object."""
    from app.db.mongodb import get_database
    db = get_database()
    assert db is not None
    assert db.name in ["revenuepilot", "revenuepilot_store"]


# ─────────────────────────────────────────────────────────────────────────────
# Revenue Metric Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_revenue_today_returns_float():
    from app.services.analytics import revenue_today
    result = await revenue_today()
    assert isinstance(result, float)
    assert result >= 0.0


@pytest.mark.asyncio
async def test_revenue_this_week_gte_today():
    from app.services.analytics import revenue_today, revenue_this_week
    today = await revenue_today()
    week = await revenue_this_week()
    assert week >= today, "Weekly revenue must be >= today's revenue"


@pytest.mark.asyncio
async def test_revenue_this_month_gte_this_week():
    from app.services.analytics import revenue_this_month, revenue_this_week
    from datetime import datetime, timezone
    month = await revenue_this_month()
    week = await revenue_this_week()
    now_day = datetime.now(timezone.utc).day
    assert month >= week or now_day <= 7, "Monthly revenue must be >= weekly revenue unless early in the month"


@pytest.mark.asyncio
async def test_average_order_value_non_negative():
    from app.services.analytics import average_order_value
    result = await average_order_value()
    assert result >= 0.0


@pytest.mark.asyncio
async def test_growth_percentage_is_float():
    from app.services.analytics import growth_percentage
    result = await growth_percentage()
    assert isinstance(result, float)


@pytest.mark.asyncio
async def test_get_revenue_metrics_structure():
    from app.services.analytics import get_revenue_metrics
    metrics = await get_revenue_metrics()
    assert hasattr(metrics, "today")
    assert hasattr(metrics, "this_week")
    assert hasattr(metrics, "this_month")
    assert hasattr(metrics, "growth_percentage")
    assert hasattr(metrics, "average_order_value")


# ─────────────────────────────────────────────────────────────────────────────
# Inventory Metric Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_low_stock_products_returns_list():
    from app.services.analytics import low_stock_products
    result = await low_stock_products()
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_best_selling_products_returns_list():
    from app.services.analytics import best_selling_products
    result = await best_selling_products()
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_category_revenue_returns_dict():
    from app.services.analytics import category_revenue
    result = await category_revenue()
    assert isinstance(result, dict)


# ─────────────────────────────────────────────────────────────────────────────
# Payment Metric Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_payment_success_rate_in_range():
    from app.services.analytics import get_payment_metrics
    metrics = await get_payment_metrics()
    assert 0.0 <= metrics.success_rate <= 100.0


@pytest.mark.asyncio
async def test_payment_method_breakdown_returns_list():
    from app.services.analytics import payment_method_breakdown
    result = await payment_method_breakdown()
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_failed_payments_non_negative():
    from app.services.analytics import failed_payments
    result = await failed_payments()
    assert result >= 0


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoint Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "mongodb" in data
    assert "version" in data
    assert "ai_ready" in data


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "RevenuePilot AI"


@pytest.mark.asyncio
async def test_chat_endpoint(client: AsyncClient):
    response = await client.post(
        "/chat",
        json={"message": "What is today's revenue?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "agent" in data
    assert ("answer" in data or "summary" in data or "error" in data or "metrics" in data)
    assert "metrics" in data


@pytest.mark.asyncio
async def test_chat_endpoint_requires_message(client: AsyncClient):
    response = await client.post("/chat", json={"message": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_insights_today_endpoint(client: AsyncClient):
    response = await client.get("/insights/today")
    assert response.status_code == 200
    data = response.json()
    assert "period" in data
    assert data["period"] == "today"


@pytest.mark.asyncio
async def test_insights_week_endpoint(client: AsyncClient):
    response = await client.get("/insights/week")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_insights_month_endpoint(client: AsyncClient):
    response = await client.get("/insights/month")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_insights_payments_endpoint(client: AsyncClient):
    response = await client.get("/insights/payments")
    assert response.status_code == 200
    data = response.json()
    assert "success_rate_percentage" in data


@pytest.mark.asyncio
async def test_insights_inventory_endpoint(client: AsyncClient):
    response = await client.get("/insights/inventory")
    assert response.status_code == 200
    data = response.json()
    assert "low_stock_count" in data


@pytest.mark.asyncio
async def test_insights_customers_endpoint(client: AsyncClient):
    response = await client.get("/insights/customers")
    assert response.status_code == 200
    data = response.json()
    assert "repeat_customers" in data


@pytest.mark.asyncio
async def test_merchant_prompts_endpoint(client: AsyncClient):
    response = await client.get("/merchant/prompts")
    assert response.status_code == 200
    data = response.json()
    assert "prompts" in data
    assert len(data["prompts"]) > 0
    prompt = data["prompts"][0]
    assert "label" in prompt
    assert "query" in prompt
    assert "category" in prompt


@pytest.mark.asyncio
async def test_merchant_recovery_endpoint(client: AsyncClient):
    response = await client.get("/merchant/recovery")
    assert response.status_code == 200
    data = response.json()
    assert "abandoned_carts" in data
    assert "failed_payments" in data


@pytest.mark.asyncio
async def test_merchant_snapshot_endpoint(client: AsyncClient):
    response = await client.get("/merchant/snapshot")
    assert response.status_code == 200
    data = response.json()
    assert "revenue" in data
    assert "orders" in data
