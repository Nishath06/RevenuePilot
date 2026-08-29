"""
RevenuePilot AI — Automated Report Generator Service
Generates downloadable CSV, JSON, and Text/PDF operational reports.
Uploads to Amazon S3 if AWS credentials exist, or stores locally.
"""
from typing import Any, Dict, List, Optional
import json
import csv
import io
import uuid
from datetime import datetime
from app.db.mongodb import get_mongodb
from app.services.aws_eventbridge import aws_manager
from app.core.logging import get_logger

logger = get_logger(__name__)


from datetime import datetime, timedelta

class ReportsService:
    def __init__(self):
        pass

    async def generate_report(self, report_type: str, format_type: str = "csv", date_range: str = "7d") -> Dict[str, Any]:
        """
        Generates operational report file in CSV, JSON, TXT, or PDF format based on date filter.
        """
        db = get_mongodb()
        now_str = datetime.utcnow().strftime("%Y-%m-%d_%H%M%S")
        fmt_clean = format_type.lower()
        ext = fmt_clean if fmt_clean in ["csv", "json", "pdf", "txt"] else "csv"
        filename = f"revenuepilot_{report_type}_{date_range}_{now_str}.{ext}"

        # Compute date cutoff
        now = datetime.utcnow()
        if date_range == "today":
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif date_range == "yesterday":
            cutoff = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif date_range == "30d":
            cutoff = now - timedelta(days=30)
        else:  # default 7d
            cutoff = now - timedelta(days=7)

        cutoff_iso = cutoff.isoformat()

        # Build collection query
        date_query = {"$or": [{"created_at": {"$gte": cutoff_iso}}, {"timestamp": {"$gte": cutoff_iso}}, {"generated_at": {"$gte": cutoff_iso}}]}

        # Correct Mongo collection mapping
        col_map = {
            "revenue": db.orders,
            "payment": db.payments,
            "inventory": db.products,
            "customer": db.customers,
            "recovery": db.recovery_campaigns,
            "automation": db.execution_history,
            "incident": db.incidents,
            "security": db.aws_audit_logs,
        }
        col = col_map.get(report_type, db.events)

        try:
            data = await col.find(date_query, {"_id": 0}).sort("created_at", -1).to_list(length=200)
            if not data:
                data = await col.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
        except Exception:
            data = await col.find({}, {"_id": 0}).to_list(length=200)

        content = ""
        if ext == "csv":
            if data:
                # Dynamically collect all keys across records
                keys_set = []
                for row in data:
                    for k in row.keys():
                        if k not in keys_set:
                            keys_set.append(k)
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=keys_set)
                writer.writeheader()
                for row in data:
                    formatted_row = {}
                    for k in keys_set:
                        val = row.get(k, "")
                        if isinstance(val, (dict, list)):
                            formatted_row[k] = json.dumps(val)
                        elif val is None:
                            formatted_row[k] = ""
                        else:
                            formatted_row[k] = str(val)
                    writer.writerow(formatted_row)
                content = output.getvalue()
            else:
                content = "id,status,created_at,date_range\n1,no_data,now," + date_range
        elif ext == "json":
            content = json.dumps(data, indent=2, default=str)
        else:  # pdf or txt
            content = f"========================================================================\n"
            content += f" REVENUEPILOT ENTERPRISE OPERATIONAL REPORT ({report_type.upper()})\n"
            content += f"========================================================================\n"
            content += f"Generated At : {datetime.utcnow().isoformat()} UTC\n"
            content += f"Format       : {format_type.upper()}\n"
            content += f"Date Range   : {date_range.upper()}\n"
            content += f"Total Records: {len(data)}\n"
            content += f"Storage Path : local://reports/{filename}\n"
            content += f"------------------------------------------------------------------------\n\n"
            content += json.dumps(data, indent=2, default=str)

        # Upload to S3 (real AWS or local fallback)
        from app.services.aws_s3 import upload_report
        media_type = "text/csv" if ext == "csv" else ("application/json" if ext == "json" else ("application/pdf" if ext == "pdf" else "text/plain"))
        s3_upload_res = upload_report(file_content=content, object_name=filename, content_type=media_type)
        s3_url = s3_upload_res.get("s3_url", f"local://reports/{filename}")

        # Invoke ReportsLambda via Boto3 / Simulation
        from app.services.cloud_event_bus import cloud_event_bus
        rep_payload = {
            "merchant_id": "merch_default",
            "report_type": report_type,
            "format": format_type,
            "date_range": date_range,
            "filename": filename,
            "s3_url": s3_url,
        }
        await cloud_event_bus.invoke_reports_lambda(rep_payload)

        file_size_bytes = len(content.encode('utf-8'))

        report_record = {
            "report_id": f"rep_{uuid.uuid4().hex[:8]}",
            "report_type": report_type,
            "format": format_type,
            "date_range": date_range,
            "filename": filename,
            "size": file_size_bytes,
            "record_count": len(data),
            "generated_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "status": "COMPLETED",
            "download_url": s3_upload_res.get("download_url") or f"/automation/reports/download/{filename}",
            "s3_url": s3_url,
            "content": content,
        }

        # Store in both `reports` and `generated_reports`
        await db.reports.insert_one(report_record.copy())
        await db.generated_reports.insert_one(report_record.copy())
        return report_record

    async def get_reports_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Retrieves generated report audit trail.
        """
        db = get_mongodb()
        cursor = db.reports.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_report_by_id_or_filename(self, identifier: str) -> Optional[Dict[str, Any]]:
        """
        Finds a report document by report_id or filename.
        """
        db = get_mongodb()
        rep = await db.reports.find_one(
            {"$or": [{"report_id": identifier}, {"filename": identifier}]},
            {"_id": 0}
        )
        return rep


reports_service = ReportsService()
