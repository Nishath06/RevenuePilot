"""
RevenuePilot AWS Lambda — Shared Base & Utilities Module
Provides MongoDB Atlas connection pooling, BSON serialization, AWS Boto3 client wrappers,
structured JSON logging, audit logging, execution telemetry, EventBridge dispatch, and unified exception handling.
"""

import os
import sys
import json
import time
import uuid
import logging
from datetime import datetime, timezone, date
from typing import Any, Dict, List, Optional, Tuple, Callable
from functools import wraps

# PyMongo & BSON imports
try:
    from pymongo import MongoClient
    from bson import ObjectId, Decimal128
    HAS_PYMONGO = True
except ImportError:
    MongoClient = None
    ObjectId = None
    Decimal128 = None
    HAS_PYMONGO = False

try:
    import certifi
    HAS_CERTIFI = True
except ImportError:
    certifi = None
    HAS_CERTIFI = False

# Boto3 import
try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    HAS_BOTO3 = True
except ImportError:
    boto3 = None
    BotoCoreError = Exception
    ClientError = Exception
    HAS_BOTO3 = False

# Configure root logger
logger = logging.getLogger("revenuepilot_lambda")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)


# ─── BSON / DATETIME SERIALIZATION HELPER ────────────────────────────────────

def serialize_bson(obj: Any) -> Any:
    """
    Recursively converts BSON objects (ObjectId, Decimal128), datetime, date, sets,
    and bytes into JSON-serializable Python data structures.
    """
    if obj is None:
        return None
    if isinstance(obj, (int, float, str, bool)):
        return obj
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if ObjectId and isinstance(obj, ObjectId):
        return str(obj)
    if Decimal128 and isinstance(obj, Decimal128):
        return float(obj.to_decimal())
    if isinstance(obj, set):
        return [serialize_bson(item) for item in obj]
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    if isinstance(obj, dict):
        return {str(k): serialize_bson(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [serialize_bson(item) for item in obj]
    return str(obj)


# ─── MONGODB ATLAS SINGLETON CLIENT ──────────────────────────────────────────

_mongo_client_instance: Optional[Any] = None

def get_mongo_client() -> Any:
    """
    Returns a singleton MongoClient instance with connection pooling.
    Reuses connection across Lambda warm invocations.
    Uses certifi.where() for MongoDB Atlas TLS validation.
    """
    global _mongo_client_instance
    if not HAS_PYMONGO:
        logger.warning("[MongoDB Base] PyMongo module not installed in environment")
        return None

    if _mongo_client_instance is None:
        mongo_url = os.environ.get("MONGODB_URL") or os.environ.get("MONGO_URI") or "mongodb://localhost:27017"
        db_name = os.environ.get("DATABASE_NAME", "revenuepilot")
        try:
            client_kwargs = {
                "serverSelectionTimeoutMS": 5000,
                "connectTimeoutMS": 5000,
                "socketTimeoutMS": 10000,
                "maxPoolSize": 10,
                "minPoolSize": 1,
                "retryWrites": True,
            }
            if HAS_CERTIFI and certifi:
                client_kwargs["tls"] = True
                client_kwargs["tlsCAFile"] = certifi.where()

            _mongo_client_instance = MongoClient(mongo_url, **client_kwargs)
            # Ping test
            _mongo_client_instance.admin.command('ping')
            logger.info("MongoDB connected successfully.")
            logger.info(f"Database: {db_name}")
            logger.info("Collection: recovery_candidates")
        except Exception as err:
            logger.error(f"[MongoDB Base] Failed to connect to MongoDB: {err}")
            _mongo_client_instance = None

    return _mongo_client_instance


def get_database(db_name: Optional[str] = None) -> Any:
    """
    Returns the target PyMongo Database object.
    """
    client = get_mongo_client()
    if client is None:
        return None
    target_db_name = db_name or os.environ.get("DATABASE_NAME", "revenuepilot")
    return client[target_db_name]


# ─── ENVIRONMENT & CONFIGURATION ────────────────────────────────────────────

class LambdaConfig:
    def __init__(self):
        raw_mode: str = os.environ.get("AWS_MODE", "local").strip().lower()
        key_id: str = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
        secret: str = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()

        # Enable AWS Cloud mode if valid credentials are set
        _has_creds = bool(key_id and secret and not key_id.startswith("your-") and not key_id.startswith("sk-"))
        self.aws_mode: str = raw_mode
        self.is_local_mode: bool = not _has_creds if _has_creds else (raw_mode not in _cloud_aliases)

        self.aws_region: str = os.environ.get("AWS_REGION", "ap-south-1").strip()
        self.event_bus_name: str = os.environ.get("EVENTBRIDGE_BUS_NAME", "revenuepilot-event-bus").strip()
        self.s3_bucket_name: str = os.environ.get("REPORTS_S3_BUCKET", "revenuepilot-reports-bucket").strip()
        self.sns_topic_arn: str = os.environ.get("SNS_ALERT_TOPIC_ARN", "").strip()
        self.ses_sender_email: str = (
            os.environ.get("SES_FROM_EMAIL")
            or os.environ.get("SES_SENDER_EMAIL")
            or "noreply@revenuepilot.ai"
        ).strip()
        self.cloudwatch_namespace: str = os.environ.get("CLOUDWATCH_NAMESPACE", "RevenuePilot/AutoOps").strip()
        self.low_stock_threshold: int = int(os.environ.get("LOW_STOCK_THRESHOLD", "5"))


config = LambdaConfig()


# ─── AWS BOTO3 CLIENTS LAZY INITIALIZER ──────────────────────────────────────

_boto3_clients: Dict[str, Any] = {}

def get_boto3_client(service_name: str) -> Any:
    """
    Returns a lazy-initialized Boto3 client for AWS Cloud mode.
    Returns None if SDK is missing or boto3 client creation fails.
    """
    if not HAS_BOTO3:
        return None

    if service_name not in _boto3_clients or _boto3_clients[service_name] is None:
        try:
            region = config.aws_region or os.environ.get("AWS_REGION", "ap-south-1")
            _boto3_clients[service_name] = boto3.client(service_name, region_name=region)
        except Exception as err:
            logger.warning(f"[AWS Boto3] Could not initialize {service_name} client: {err}")
            _boto3_clients[service_name] = None

    return _boto3_clients[service_name]


# ─── STRUCTURED LOGGING & AUDITING HELPERS ───────────────────────────────────

def get_merchant_filter(merchant_id: Optional[str]) -> Dict[str, Any]:
    """
    Returns MongoDB query filter for merchant isolation.
    """
    if not merchant_id or merchant_id == "all":
        return {}
    return {"merchant_id": merchant_id}


def log_json(
    lambda_name: str,
    trace_id: str,
    merchant_id: str,
    status: str,
    duration_ms: float,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Emits structured JSON log to stdout (captured by CloudWatch / Terminal).
    """
    log_record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lambda": lambda_name,
        "trace_id": trace_id,
        "merchant_id": merchant_id,
        "status": status,
        "duration_ms": duration_ms,
        "details": details or {}
    }
    logger.info(json.dumps(log_record))
    return log_record


def save_execution_log(
    db: Any,
    exec_id: str,
    trace_id: str,
    function_name: str,
    merchant_id: str,
    duration_ms: float,
    status: str,
    payload: Dict[str, Any],
    response: Dict[str, Any],
    started_at_iso: Optional[str] = None
) -> None:
    """
    Persists execution summary into MongoDB `lambda_executions` collection.
    """
    if db is None:
        return
    try:
        now_dt = datetime.now(timezone.utc)
        completed_at = now_dt.isoformat()
        started_at = started_at_iso or (now_dt - timedelta(milliseconds=duration_ms)).isoformat()
        
        doc = {
            "execution_id": exec_id,
            "trace_id": trace_id,
            "lambda_name": function_name,
            "function_name": function_name,
            "merchant_id": merchant_id,
            "duration_ms": duration_ms,
            "status": status,
            "started_at": started_at,
            "completed_at": completed_at,
            "aws_mode": "aws" if not config.is_local_mode else "local",
            "payload": serialize_bson(payload),
            "response": serialize_bson(response),
            "aws_request_id": exec_id,
            "execution_mode": "AWS Boto3 Lambda" if not config.is_local_mode else "Local Simulation Mode",
            "execution_time": completed_at,
            "timestamp": completed_at,
            "created_at": completed_at
        }
        db.lambda_executions.insert_one(doc)
    except Exception as err:
        logger.warning(f"[Audit] Failed to insert lambda execution log: {err}")


def save_audit_log(
    db: Any,
    trace_id: str,
    lambda_name: str,
    merchant_id: str,
    action: str,
    payload: Dict[str, Any],
    response: Dict[str, Any],
    status: str,
    latency_ms: float
) -> None:
    """
    Persists audit entry into MongoDB `aws_audit_logs` collection.
    """
    if db is None:
        return
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        audit_doc = {
            "audit_id": f"aud_{uuid.uuid4().hex[:10]}",
            "trace_id": trace_id,
            "lambda_name": lambda_name,
            "merchant_id": merchant_id,
            "service": "Lambda",
            "resource": lambda_name,
            "action": action,
            "latency_ms": latency_ms,
            "status": status,
            "payload": serialize_bson(payload),
            "response": serialize_bson(response),
            "created_at": now_iso,
            "timestamp": now_iso
        }
        db.aws_audit_logs.insert_one(audit_doc)
    except Exception as err:
        logger.warning(f"[Audit] Failed to insert audit log: {err}")


# ─── EVENTBRIDGE PUBLISHER ───────────────────────────────────────────────────

def publish_eventbridge_event(
    db: Any,
    event_type: str,
    detail: Dict[str, Any],
    source: str = "revenuepilot.lambda",
    merchant_id: str = "merch_default",
    trace_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Publishes event to AWS EventBridge if in AWS mode, or saves into MongoDB `events` collection.
    """
    evt_id = f"evt_{uuid.uuid4().hex[:10]}"
    t_id = trace_id or f"trace_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Ensure detail has merchant_id, trace_id, status
    clean_detail = serialize_bson(detail)
    if isinstance(clean_detail, dict):
        clean_detail.setdefault("merchant_id", merchant_id)
        clean_detail.setdefault("trace_id", t_id)
        clean_detail.setdefault("status", "SUCCESS")

    event_record = {
        "event_id": evt_id,
        "event_type": event_type,
        "source": source,
        "merchant_id": merchant_id,
        "trace_id": t_id,
        "payload": clean_detail,
        "execution_mode": "AWS EventBridge Mode" if not config.is_local_mode else "Local Event Bus Mode",
        "timestamp": now_iso,
        "created_at": now_iso,
        "status": "processed"
    }

    # AWS Mode Publish
    events_client = get_boto3_client("events")
    published_aws = False
    if events_client:
        try:
            events_client.put_events(
                Entries=[{
                    'Source': source,
                    'DetailType': event_type,
                    'Detail': json.dumps(clean_detail),
                    'EventBusName': config.event_bus_name
                }]
            )
            published_aws = True
        except Exception as err:
            logger.warning(f"[EventBridge] AWS put_events fallback: {err}")

    # Local Mode & Audit Save
    if db is not None:
        try:
            db.events.insert_one(event_record)
        except Exception as err:
            logger.warning(f"[EventBridge] Failed to save event doc to Mongo: {err}")

    return {
        "published_aws": published_aws,
        "event_id": evt_id,
        "event_type": event_type,
        "trace_id": t_id
    }


# ─── UNIFIED EXCEPTION HANDLER DECORATOR ─────────────────────────────────────

def handle_lambda_exceptions(lambda_name: str):
    """
    Decorator for AWS Lambda handlers to ensure production-grade structured logging,
    MongoDB execution audit tracking, and graceful error response formatting.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(event: Dict[str, Any], context: Any = None):
            start_time = time.perf_counter()
            started_at_dt = datetime.now(timezone.utc)
            started_at_iso = started_at_dt.isoformat()
            
            exec_id = f"lam_{uuid.uuid4().hex[:10]}"
            trace_id = event.get("trace_id") if isinstance(event, dict) else None
            if not trace_id and context and hasattr(context, "aws_request_id"):
                trace_id = context.aws_request_id
            if not trace_id:
                trace_id = f"trace_{uuid.uuid4().hex[:10]}"

            merchant_id = event.get("merchant_id", "merch_default") if isinstance(event, dict) else "merch_default"
            db = get_database()

            try:
                result = func(event, context)
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

                # Extract response body or dictionary
                if isinstance(result, dict) and "statusCode" in result:
                    status_code = result.get("statusCode", 200)
                    body = result.get("body", {})
                    if isinstance(body, str):
                        try:
                            body_dict = json.loads(body)
                        except Exception:
                            body_dict = {"text": body}
                    else:
                        body_dict = body
                else:
                    status_code = 200
                    body_dict = result

                log_json(lambda_name, trace_id, merchant_id, "SUCCESS", elapsed_ms, body_dict)
                save_execution_log(db, exec_id, trace_id, lambda_name, merchant_id, elapsed_ms, "SUCCESS", event, body_dict, started_at_iso)
                save_audit_log(db, trace_id, lambda_name, merchant_id, f"INVOKE_{lambda_name.upper()}", event, body_dict, "SUCCESS", elapsed_ms)

                return result

            except Exception as exc:
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                err_msg = str(exc)
                logger.error(f"[{lambda_name}] Execution Failed: {err_msg}", exc_info=True)

                error_response = {
                    "status": "FAILED",
                    "function_name": lambda_name,
                    "merchant_id": merchant_id,
                    "trace_id": trace_id,
                    "error": err_msg,
                    "duration_ms": elapsed_ms
                }

                log_json(lambda_name, trace_id, merchant_id, "FAILED", elapsed_ms, {"error": err_msg})
                save_execution_log(db, exec_id, trace_id, lambda_name, merchant_id, elapsed_ms, "FAILED", event, error_response, started_at_iso)
                save_audit_log(db, trace_id, lambda_name, merchant_id, f"INVOKE_{lambda_name.upper()}", event, error_response, "FAILED", elapsed_ms)

                return {
                    "statusCode": 500,
                    "body": json.dumps(error_response)
                }

        return wrapper
    return decorator
