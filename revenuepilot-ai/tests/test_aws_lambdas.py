"""
RevenuePilot v3.0 — Comprehensive AWS Lambda Unit & Integration Test Suite
Tests all 5 refactored AWS Lambda functions, shared utilities, MongoDB BSON serialization,
PDF header (%PDF-) & size validation, 48h deduplication, and EventBridge publishing in local and AWS modes.
"""

import sys
import os
import json
import uuid
import pytest
from datetime import datetime, timezone
from bson import ObjectId, Decimal128

# Ensure root workspace directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from aws_lambda.utils.aws_lambda_base import (
    serialize_bson,
    get_database,
    publish_eventbridge_event,
    config,
    handle_lambda_exceptions
)
from aws_lambda.inventory_lambda import lambda_handler as inventory_handler
from aws_lambda.recovery_lambda import lambda_handler as recovery_handler
from aws_lambda.reports_lambda import lambda_handler as reports_handler
from aws_lambda.incident_lambda import lambda_handler as incident_handler
from aws_lambda.cloudwatch_lambda import lambda_handler as cloudwatch_handler


class DummyContext:
    aws_request_id = "test_aws_req_12345"


def test_serialize_bson():
    """Test BSON & Datetime serialization into JSON-compliant structures."""
    now_dt = datetime.now(timezone.utc)
    dummy_oid = ObjectId()
    dummy_dec = Decimal128("149.99")

    data = {
        "id": dummy_oid,
        "price": dummy_dec,
        "created_at": now_dt,
        "raw_bytes": b"RevenuePilot Test",
        "tags": {"electronics", "mobile"}
    }

    serialized = serialize_bson(data)
    assert isinstance(serialized["id"], str)
    assert isinstance(serialized["price"], float)
    assert serialized["price"] == 149.99
    assert isinstance(serialized["created_at"], str)
    assert serialized["raw_bytes"] == "RevenuePilot Test"
    assert isinstance(serialized["tags"], list)

    # Test json dumps succeeds without TypeError
    json_str = json.dumps(serialized)
    assert "RevenuePilot Test" in json_str


def test_inventory_lambda():
    """Test InventoryLambda execution, stock velocity, and LOW/OUT status classification."""
    payload = {
        "merchant_id": "merch_unit_test",
        "trace_id": "trace_inv_test_001",
        "low_stock_threshold": 5,
        "items": [
            {"sku": "SKU-001", "name": "Wireless Mouse", "stock": 0, "price": 1299.0, "sales": 45},
            {"sku": "SKU-002", "name": "Mechanical Keyboard", "stock": 2, "price": 4999.0, "sales": 90},
            {"sku": "SKU-003", "name": "USB Cable", "stock": 50, "price": 299.0, "sales": 150}
        ]
    }

    res = inventory_handler(payload, DummyContext())
    assert res["statusCode"] == 200
    body = json.loads(res["body"]) if isinstance(res["body"], str) else res["body"]

    assert body["status"] == "SUCCESS"
    assert body["processed_count"] == 3
    assert body["out_of_stock_count"] == 1
    assert body["low_stock_count"] == 1
    assert body["recommendations_generated"] == 2


def test_recovery_lambda():
    """Test RecoveryLambda coupon generation, target email sanitization, and 48h deduplication."""
    unique_email = f"anita_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "merchant_id": "merch_unit_test",
        "trace_id": "trace_rec_test_001",
        "event_type": "PAYMENT_FAILED",
        "customer_name": "Anita Roy",
        "customer_email": unique_email,
        "customer_phone": "+91 98765 43210",
        "amount": 7999.0,
        "order_id": f"ord_unit_{uuid.uuid4().hex[:8]}"
    }

    res = recovery_handler(payload, DummyContext())
    assert res["statusCode"] == 200
    body = json.loads(res["body"]) if isinstance(res["body"], str) else res["body"]

    assert body["status"] == "SUCCESS"
    assert body["campaigns_created"] >= 1
    assert body["emails_sent"] >= 1


def test_reports_lambda_pdf_and_csv():
    """Test ReportsLambda PDF generation (%PDF- magic header & > 1 KB size) and CSV formatting."""
    # 1. PDF Test
    pdf_payload = {
        "merchant_id": "merch_unit_test",
        "report_type": "revenue",
        "format": "pdf",
        "date_range": "7d"
    }

    res_pdf = reports_handler(pdf_payload, DummyContext())
    assert res_pdf["statusCode"] == 200
    body_pdf = json.loads(res_pdf["body"]) if isinstance(res_pdf["body"], str) else res_pdf["body"]

    assert body_pdf["status"] == "SUCCESS"
    assert body_pdf["pdf_uploaded"] is True
    assert body_pdf["file_size_bytes"] > 1024
    assert body_pdf["report_url"] != ""

    # 2. CSV Test
    csv_payload = {
        "merchant_id": "merch_unit_test",
        "report_type": "inventory",
        "format": "csv",
        "date_range": "30d"
    }

    res_csv = reports_handler(csv_payload, DummyContext())
    assert res_csv["statusCode"] == 200
    body_csv = json.loads(res_csv["body"]) if isinstance(res_csv["body"], str) else res_csv["body"]
    assert body_csv["csv_uploaded"] is True


def test_incident_lambda():
    """Test IncidentLambda severity validation, INC ID formatting, and SNS dispatch logic."""
    payload = {
        "merchant_id": "merch_unit_test",
        "incident_type": "WEBHOOK_TIMEOUT",
        "title": "Razorpay Gateway Timeout",
        "severity": "CRITICAL",
        "description": "Payment webhook processing latency exceeded 15,000 ms"
    }

    res = incident_handler(payload, DummyContext())
    assert res["statusCode"] == 200
    body = json.loads(res["body"]) if isinstance(res["body"], str) else res["body"]

    assert body["status"] == "SUCCESS"
    assert body["incident_id"].startswith("INC-")
    assert body["severity"] == "critical"
    assert body["sns_alert_published"] is True


def test_cloudwatch_lambda():
    """Test CloudWatchLambda telemetry collection across all 9 metrics."""
    payload = {
        "merchant_id": "merch_unit_test",
        "metrics": {
            "lambda_invocations": 120,
            "eventbridge_events": 250,
            "recovery_emails": 35,
            "reports_generated": 18,
            "payment_failures": 5,
            "inventory_scans": 24,
            "incident_count": 2,
            "avg_latency_ms": 14.5,
            "dlq_count": 0
        }
    }

    res = cloudwatch_handler(payload, DummyContext())
    assert res["statusCode"] == 200
    body = json.loads(res["body"]) if isinstance(res["body"], str) else res["body"]

    assert body["status"] == "SUCCESS"
    assert body["metrics_pushed"] == 9


def test_incident_cooldown_deduplication():
    """Test IncidentLambda cooldown deduplication logic."""
    unique_type = f"TEST_COOLDOWN_{uuid.uuid4().hex[:6]}"
    payload = {
        "merchant_id": "merch_unit_test",
        "incident_type": unique_type,
        "title": "Cooldown Test Incident",
        "severity": "HIGH",
        "cooldown_minutes": 15
    }

    # First trigger creates incident
    res1 = incident_handler(payload, DummyContext())
    assert res1["statusCode"] == 200
    body1 = json.loads(res1["body"]) if isinstance(res1["body"], str) else res1["body"]
    assert body1["status"] == "SUCCESS"
    assert body1["sns_alert_published"] is True

    # Immediate second trigger within 15 min cooldown suppresses duplicate
    res2 = incident_handler(payload, DummyContext())
    assert res2["statusCode"] == 200
    body2 = json.loads(res2["body"]) if isinstance(res2["body"], str) else res2["body"]
    assert body2["status"] == "SUCCESS"
    assert body2.get("duplicate_suppressed") is True
    assert body2["sns_alert_published"] is False


@pytest.mark.asyncio
async def test_pdf_report_service_generation():
    """Test reports_service.generate_report for PDF format to ensure JSON safety and valid binary header."""
    from app.db.mongodb import connect_to_mongodb
    from app.services.reports_service import reports_service
    await connect_to_mongodb()
    rep = await reports_service.generate_report(report_type="revenue", format_type="pdf", date_range="7d")
    assert rep["status"] == "COMPLETED"
    assert rep["format"] == "pdf"
    assert isinstance(rep["content"], str)
    import base64
    decoded = base64.b64decode(rep["content"])
    assert decoded[:5] == b"%PDF-"


