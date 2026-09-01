"""
RevenuePilot AI — AWS S3 Storage Integration
Uploads operational reports to S3 and generates presigned access URLs with local fallback support.
"""
from typing import Any, Dict, Optional, Union
import time

from app.core.config import settings
from app.core.logging import get_logger
from app.services.aws_client import aws_client

logger = get_logger(__name__)


def generate_signed_url(
    object_name: str,
    bucket_name: Optional[str] = None,
    expiration: int = 3600,
    content_type: Optional[str] = None,
    content_disposition: Optional[str] = None,
) -> str:
    """
    Requirement 6 — Generate presigned S3 download URL.
    Returns local route if AWS credentials are missing or in local mode.
    """
    bucket = bucket_name or settings.AWS_S3_BUCKET_NAME

    if aws_client.is_local_mode or not aws_client.s3_client:
        return f"/automation/reports/download/{object_name}"

    try:
        params: Dict[str, Any] = {"Bucket": bucket, "Key": object_name}
        if content_type:
            params["ResponseContentType"] = content_type
        if content_disposition:
            params["ResponseContentDisposition"] = content_disposition

        url = aws_client.s3_client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expiration,
        )
        return url
    except Exception as err:
        logger.error("Failed to generate presigned S3 URL", error=str(err), object_name=object_name)
        return f"/automation/reports/download/{object_name}"


def upload_report(
    file_content: Union[str, bytes],
    object_name: str,
    bucket_name: Optional[str] = None,
    content_type: str = "text/csv",
    content_disposition: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Requirement 6 — Upload operational report file to Amazon S3.
    Falls back gracefully if AWS credentials are missing or AWS_MODE=local.
    """
    bucket = bucket_name or settings.AWS_S3_BUCKET_NAME

    if aws_client.is_local_mode or not aws_client.s3_client:
        logger.info(
            "AWS S3 running in Local Fallback Mode",
            object_name=object_name,
            bucket=bucket,
        )
        local_url = f"local://reports/{object_name}"
        download_url = f"/automation/reports/download/{object_name}"
        return {
            "status": "uploaded_local_fallback",
            "bucket": bucket,
            "object_name": object_name,
            "s3_url": local_url,
            "download_url": download_url,
            "mode": "local",
        }

    try:
        body = file_content.encode("utf-8") if isinstance(file_content, str) else file_content
        put_kwargs = {
            "Bucket": bucket,
            "Key": object_name,
            "Body": body,
            "ContentType": content_type,
        }
        disp = content_disposition or ("inline" if content_type == "application/pdf" else None)
        if disp:
            put_kwargs["ContentDisposition"] = disp

        aws_client.s3_client.put_object(**put_kwargs)

        s3_url = f"https://{bucket}.s3.{aws_client.region}.amazonaws.com/{object_name}"
        signed_url = generate_signed_url(
            object_name=object_name,
            bucket_name=bucket,
            content_type=content_type,
            content_disposition=disp
        )

        logger.info("Report successfully uploaded to AWS S3", s3_url=s3_url)
        return {
            "status": "uploaded",
            "bucket": bucket,
            "object_name": object_name,
            "s3_url": s3_url,
            "download_url": signed_url,
            "mode": "cloud",
        }
    except Exception as err:
        logger.error("S3 upload exception", error=str(err), object_name=object_name)
        return {
            "status": "failed_fallback_local",
            "error": str(err),
            "s3_url": f"local://reports/{object_name}",
            "download_url": f"/automation/reports/download/{object_name}",
            "mode": "cloud_error",
        }
