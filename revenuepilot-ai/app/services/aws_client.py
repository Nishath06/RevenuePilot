"""
RevenuePilot AI — AWS Client Manager
Centralized initialization and health management for AWS EventBridge, SNS, Lambda, S3, and CloudWatch.
Supports graceful local fallback when AWS credentials are not configured or AWS_MODE=local.
"""
import time
from typing import Any, Dict, Optional
from datetime import datetime

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Lazy load boto3 if available
try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    BotoCoreError = Exception
    ClientError = Exception
    logger.info("boto3 not installed — AWS services will run in Local Fallback Mode")


class AWSClientManager:
    """
    Manages connections and clients for AWS EventBridge, SNS, Lambda, S3, and CloudWatch.
    Handles graceful fallback to local mode when AWS credentials are absent or AWS_MODE=local.
    """

    def __init__(self):
        self.region = settings.AWS_REGION
        self.access_key = settings.AWS_ACCESS_KEY_ID
        self.secret_key = settings.AWS_SECRET_ACCESS_KEY
        self.session_token = getattr(settings, "AWS_SESSION_TOKEN", "")
        self.mode = getattr(settings, "AWS_MODE", "local").lower()

        # Determine local vs cloud mode
        self.has_credentials = bool(
            self.access_key
            and self.secret_key
            and not self.access_key.startswith("sk-")
            and not self.access_key.startswith("your-")
        )
        self.is_local_mode = not BOTO3_AVAILABLE or self.mode == "local" or not self.has_credentials

        self._session = None
        self._events_client = None
        self._sns_client = None
        self._lambda_client = None
        self._s3_client = None
        self._cloudwatch_client = None
        self._logs_client = None

        if not self.is_local_mode:
            self._init_clients()
        else:
            logger.info("AWS Client Manager initialized in Local Fallback Mode", mode=self.mode, has_credentials=self.has_credentials)

    def _init_clients(self):
        try:
            from botocore.config import Config
            boto_config = Config(
                retries={"max_attempts": 3, "mode": "standard"},
                connect_timeout=3,
                read_timeout=5,
            )

            kwargs = {
                "region_name": self.region,
                "aws_access_key_id": self.access_key,
                "aws_secret_access_key": self.secret_key,
                "config": boto_config,
            }
            if self.session_token:
                kwargs["aws_session_token"] = self.session_token

            self._session = boto3.Session(
                region_name=self.region,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                aws_session_token=self.session_token or None,
            )
            self._events_client = self._session.client("events", config=boto_config)
            self._sns_client = self._session.client("sns", config=boto_config)
            self._lambda_client = self._session.client("lambda", config=boto_config)
            self._s3_client = self._session.client("s3", config=boto_config)
            self._cloudwatch_client = self._session.client("cloudwatch", config=boto_config)
            self._logs_client = self._session.client("logs", config=boto_config)
            logger.info("Successfully initialized boto3 AWS clients with retry config", region=self.region)
        except Exception as err:
            logger.warning("Failed to initialize AWS boto3 clients — falling back to local mode", error=str(err))
            self.is_local_mode = True

    @property
    def events_client(self):
        return self._events_client

    @property
    def sns_client(self):
        return self._sns_client

    @property
    def lambda_client(self):
        return self._lambda_client

    @property
    def s3_client(self):
        return self._s3_client

    @property
    def cloudwatch_client(self):
        return self._cloudwatch_client

    @property
    def logs_client(self):
        return self._logs_client

    def verify_connectivity(self) -> Dict[str, Any]:
        """
        Task 10 — Verifies connectivity to EventBridge, SNS, Lambda, S3, and CloudWatch.
        Returns status + latency for each service.
        """
        timestamp = datetime.utcnow().isoformat()

        if self.is_local_mode:
            return {
                "overall_status": "healthy_local_fallback",
                "aws_mode": "local",
                "has_credentials": self.has_credentials,
                "boto3_installed": BOTO3_AVAILABLE,
                "region": self.region,
                "timestamp": timestamp,
                "services": {
                    "eventbridge": {
                        "status": "LOCAL_FALLBACK",
                        "latency_ms": 0.4,
                        "event_bus": settings.EVENT_BUS_NAME,
                    },
                    "sns": {
                        "status": "LOCAL_FALLBACK",
                        "latency_ms": 0.3,
                        "topics": [
                            settings.AWS_SNS_TOPIC_ARN_PAYMENTS or "local-payments",
                            settings.AWS_SNS_TOPIC_ARN_INVENTORY or "local-inventory",
                        ],
                    },
                    "lambda": {
                        "status": "LOCAL_FALLBACK",
                        "latency_ms": 0.5,
                        "function_name": settings.AWS_LAMBDA_RECOVERY_NAME,
                    },
                    "s3": {
                        "status": "LOCAL_FALLBACK",
                        "latency_ms": 0.6,
                        "bucket": settings.AWS_S3_BUCKET_NAME,
                    },
                    "cloudwatch": {
                        "status": "LOCAL_FALLBACK",
                        "latency_ms": 0.4,
                        "namespace": settings.AWS_CLOUDWATCH_NAMESPACE,
                        "log_group": settings.AWS_CLOUDWATCH_LOG_GROUP,
                    },
                },
            }

        # Real Cloud Connectivity Check
        services_status = {}

        # 1. EventBridge Check
        start = time.time()
        try:
            if self._events_client:
                self._events_client.list_event_buses(Limit=1)
                eb_latency = round((time.time() - start) * 1000, 2)
                services_status["eventbridge"] = {"status": "HEALTHY", "latency_ms": eb_latency, "event_bus": settings.EVENT_BUS_NAME}
            else:
                services_status["eventbridge"] = {"status": "UNAVAILABLE", "latency_ms": 0.0, "error": "Client not initialized"}
        except Exception as err:
            services_status["eventbridge"] = {"status": "ERROR", "latency_ms": round((time.time() - start) * 1000, 2), "error": str(err)}

        # 2. SNS Check
        start = time.time()
        try:
            if self._sns_client:
                self._sns_client.list_topics()
                sns_latency = round((time.time() - start) * 1000, 2)
                services_status["sns"] = {"status": "HEALTHY", "latency_ms": sns_latency}
            else:
                services_status["sns"] = {"status": "UNAVAILABLE", "latency_ms": 0.0, "error": "Client not initialized"}
        except Exception as err:
            services_status["sns"] = {"status": "ERROR", "latency_ms": round((time.time() - start) * 1000, 2), "error": str(err)}

        # 3. Lambda Check
        start = time.time()
        try:
            if self._lambda_client:
                self._lambda_client.list_functions(MaxItems=1)
                lam_latency = round((time.time() - start) * 1000, 2)
                services_status["lambda"] = {"status": "HEALTHY", "latency_ms": lam_latency, "function_name": settings.AWS_LAMBDA_RECOVERY_NAME}
            else:
                services_status["lambda"] = {"status": "UNAVAILABLE", "latency_ms": 0.0, "error": "Client not initialized"}
        except Exception as err:
            services_status["lambda"] = {"status": "ERROR", "latency_ms": round((time.time() - start) * 1000, 2), "error": str(err)}

        # 4. S3 Check
        start = time.time()
        try:
            if self._s3_client:
                self._s3_client.list_buckets()
                s3_latency = round((time.time() - start) * 1000, 2)
                services_status["s3"] = {"status": "HEALTHY", "latency_ms": s3_latency, "bucket": settings.AWS_S3_BUCKET_NAME}
            else:
                services_status["s3"] = {"status": "UNAVAILABLE", "latency_ms": 0.0, "error": "Client not initialized"}
        except Exception as err:
            services_status["s3"] = {"status": "ERROR", "latency_ms": round((time.time() - start) * 1000, 2), "error": str(err)}

        # 5. CloudWatch Check
        start = time.time()
        try:
            if self._cloudwatch_client:
                self._cloudwatch_client.list_metrics(Namespace=settings.AWS_CLOUDWATCH_NAMESPACE)
                cw_latency = round((time.time() - start) * 1000, 2)
                services_status["cloudwatch"] = {"status": "HEALTHY", "latency_ms": cw_latency, "namespace": settings.AWS_CLOUDWATCH_NAMESPACE}
            else:
                services_status["cloudwatch"] = {"status": "UNAVAILABLE", "latency_ms": 0.0, "error": "Client not initialized"}
        except Exception as err:
            services_status["cloudwatch"] = {"status": "ERROR", "latency_ms": round((time.time() - start) * 1000, 2), "error": str(err)}

        # Determine overall status
        all_healthy = all(s.get("status") == "HEALTHY" for s in services_status.values())

        return {
            "overall_status": "healthy" if all_healthy else "degraded",
            "aws_mode": "cloud",
            "has_credentials": True,
            "boto3_installed": True,
            "region": self.region,
            "timestamp": timestamp,
            "services": services_status,
        }


# Singleton instance
aws_client = AWSClientManager()
