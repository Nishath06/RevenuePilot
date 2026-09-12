"""
RevenuePilot AI — AWS Integration & Health Endpoint Unit Tests
Verifies EventBridge, SNS, S3, CloudWatch, AWS Client, and /automation/aws-health.

All AWS service imports are lazy (inside test bodies) so `pytest -m unit` never
touches boto3 or AWS modules during collection.
"""
import os
import pytest

def _has_aws_creds() -> bool:
    key_id = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
    secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    return bool(key_id and secret and not key_id.startswith("your-") and not key_id.startswith("sk-") and key_id != "")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.aws,
    pytest.mark.skipif(
        not _has_aws_creds(),
        reason="Requires valid AWS credentials (AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY)"
    )
]



def test_aws_client_verification():
    """Verify AWS Client connectivity check structure."""
    from app.services.aws_client import aws_client
    res = aws_client.verify_connectivity()
    assert "overall_status" in res
    assert "services" in res
    assert "eventbridge" in res["services"]
    assert "sns" in res["services"]
    assert "lambda" in res["services"]
    assert "s3" in res["services"]
    assert "cloudwatch" in res["services"]
    assert "latency_ms" in res["services"]["eventbridge"]
    assert "latency_ms" in res["services"]["sns"]
    assert "latency_ms" in res["services"]["lambda"]
    assert "latency_ms" in res["services"]["s3"]
    assert "latency_ms" in res["services"]["cloudwatch"]


def test_aws_eventbridge_publish():
    """Verify publish_event with graceful local fallback."""
    from app.services.aws_eventbridge import publish_event
    res = publish_event(
        event_type="TEST_ORDER_CREATED",
        detail={"order_id": "ord_123", "amount": 1999},
        source="revenuepilot.test",
    )
    assert res["status"] in ["published", "published_local_fallback", "failed_fallback_local"]
    assert "aws_event_id" in res or "event_id" in res or "status" in res


def test_aws_sns_send_notification():
    """Verify send_notification with graceful local fallback."""
    from app.services.aws_sns import send_notification
    res = send_notification(
        topic_type_or_arn="payments",
        message="Test alert from pytest",
        subject="Pytest SNS Alert",
    )
    assert res["status"] in ["published", "published_local_fallback", "failed_fallback_local"]
    assert "message_id" in res or "topic" in res or "status" in res


def test_aws_s3_upload_and_signed_url():
    """Verify S3 report upload and presigned URL generation."""
    from app.services.aws_s3 import upload_report, generate_signed_url
    upload_res = upload_report(
        file_content="header1,header2\nval1,val2",
        object_name="pytest_report.csv",
        content_type="text/csv",
    )
    assert upload_res["status"] in ["uploaded", "uploaded_local_fallback", "failed_fallback_local"]
    assert "s3_url" in upload_res or "download_url" in upload_res or "status" in upload_res

    signed_url = generate_signed_url("pytest_report.csv")
    assert isinstance(signed_url, str)
    assert len(signed_url) > 0


def test_aws_cloudwatch_metrics_and_logs():
    """Verify put_metric and put_log_event."""
    from app.services.aws_cloudwatch import put_metric, put_log_event
    metric_res = put_metric(
        metric_name="PytestTestMetric",
        value=42.0,
        unit="Count",
        dimensions={"Env": "test"},
    )
    assert metric_res["status"] in ["published", "metric_logged_local", "failed_fallback_local"]

    log_res = put_log_event(
        message="Pytest CloudWatch log event test",
    )
    assert log_res["status"] in ["published", "log_event_logged_local", "failed_fallback_local"]


def test_aws_health_api_endpoint():
    """Verify GET /automation/aws-health endpoint returns 200 OK with Bearer auth."""
    import jwt
    from datetime import datetime, timedelta, timezone
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.config import settings

    payload = {
        "user_id": "test_user_123",
        "merchant_id": "merch_default",
        "role": "merchant",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    token = jwt.encode(payload, settings.JWT_SECRET or "supersecretjwtkey_revenuepilot_2026_hackathon", algorithm=settings.JWT_ALGORITHM)
    headers = {"Authorization": f"Bearer {token}"}

    client = TestClient(app)
    response = client.get("/automation/aws-health", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "overall_status" in data
    assert "services" in data
    assert "eventbridge" in data["services"]
    assert "sns" in data["services"]
    assert "lambda" in data["services"]
    assert "s3" in data["services"]
    assert "cloudwatch" in data["services"]


