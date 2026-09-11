"""
RevenuePilot v4.0 — Recovery Candidate Repository
===================================================
All MongoDB read/write operations for the `recovery_candidates` collection.
Single responsibility: data persistence. No business logic.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.db.mongodb import get_mongodb

logger = get_logger(__name__)


class RecoveryCandidateRepository:
    """
    Repository for `recovery_candidates` MongoDB collection.
    Provides upsert, query, and status-update operations.
    Single source of truth for all recovery candidates.
    """

    COLLECTION = "recovery_candidates"

    # ── Write ──────────────────────────────────────────────────────────────────

    async def upsert_candidate(
        self,
        candidate: Any,             # RecoveryCandidate or Dict
        merchant_id: str = "merch_default",
    ) -> bool:
        """
        Upserts a single RecoveryCandidate document into MongoDB.
        Prevents duplicates by order_id or candidate_id.
        Updates document fields if candidate already exists.
        """
        db = get_mongodb()
        doc = candidate.to_dict() if hasattr(candidate, "to_dict") else dict(candidate)
        doc["merchant_id"] = doc.get("merchant_id") or merchant_id

        order_id = doc.get("order_id")
        candidate_id = doc.get("candidate_id")

        query = {"$or": [{"order_id": order_id}, {"candidate_id": candidate_id}]} if order_id else {"candidate_id": candidate_id}

        existing = await db[self.COLLECTION].find_one(query, {"_id": 0})
        now_iso = datetime.now(timezone.utc).isoformat()
        doc["updated_at"] = now_iso

        if existing and isinstance(existing, dict):
            # Preserve created_at and candidate_id if present
            doc["candidate_id"] = existing.get("candidate_id", candidate_id)
            doc["created_at"] = existing.get("created_at", doc.get("created_at", now_iso))
            # Merge message history
            history = existing.get("message_history", [])
            if not isinstance(history, list):
                history = []
            history.append({
                "timestamp": now_iso,
                "action": "Candidate Updated",
                "by": "RecoveryIntelligenceAgent",
                "details": f"Updated score to {doc.get('recovery_score')} and status to {doc.get('status')}"
            })
            doc["message_history"] = history

        else:
            doc.setdefault("created_at", now_iso)

        await db[self.COLLECTION].update_one(
            {"candidate_id": doc["candidate_id"]},
            {"$set": doc},
            upsert=True,
        )

        return True

    async def upsert_candidates(
        self,
        candidates: list,           # List[RecoveryCandidate]
        merchant_id: str = "merch_default",
    ) -> int:
        """
        Upserts a list of RecoveryCandidate objects into MongoDB.
        """
        inserted = 0
        for cand in candidates:
            try:
                success = await self.upsert_candidate(cand, merchant_id)
                if success:
                    inserted += 1
            except Exception as exc:
                logger.warning(
                    "Candidate upsert failed",
                    candidate_id=getattr(cand, "candidate_id", "?"),
                    error=str(exc),
                )

        logger.info(
            "Candidates upserted",
            merchant_id=merchant_id,
            count=inserted,
        )
        return inserted

    async def create_campaign_run(self, summary: dict) -> str:
        """
        Inserts a campaign summary into the `campaign_runs` collection.
        Returns the inserted campaign ID.
        """
        db = get_mongodb()
        summary.setdefault("created_at", datetime.now(timezone.utc).isoformat())
        await db.campaign_runs.insert_one(summary)
        return summary["campaign_id"]

    # ── Read ───────────────────────────────────────────────────────────────────

    async def get_approved_candidates(
        self,
        merchant_id: str,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Returns APPROVED or SCHEDULED candidates ready for RecoveryLambda."""
        db = get_mongodb()
        cursor = db[self.COLLECTION].find(
            {
                "merchant_id": merchant_id,
                "status": {"$in": ["APPROVED", "SCHEDULED", "scheduled"]},
                "recovery_status": {"$ne": "RECOVERED"},
            },
            {"_id": 0},
        ).sort("recovery_score", -1).limit(limit)

        return await cursor.to_list(length=limit)

    async def get_candidates(
        self,
        merchant_id: str = "merch_default",
        status: Optional[str] = None,
        priority: Optional[str] = None,
        segment: Optional[str] = None,
        period: str = "all",
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """List candidates supporting status, priority, segment, and period filtering."""
        db = get_mongodb()
        query: Dict[str, Any] = {}
        if merchant_id and merchant_id != "all":
            query["merchant_id"] = merchant_id
        if status and status != "all":
            if status.upper() in ("SCHEDULED", "APPROVED"):
                query["status"] = {"$in": ["SCHEDULED", "scheduled", "APPROVED"]}
                query["recovery_status"] = {"$nin": ["DISPATCHED", "EMAIL_SENT", "SMS_SENT", "EMAIL+SMS_SENT", "FAILED", "SKIPPED", "RECOVERED"]}
            else:
                query["$or"] = [{"status": status}, {"recovery_status": status}]
        if priority and priority != "all":
            query["priority"] = priority.upper()
        if segment and segment != "all":
            query["segment"] = segment.upper()

        # Date filtering based on period
        if period != "all":
            from zoneinfo import ZoneInfo
            try:
                tz = ZoneInfo("Asia/Kolkata")
            except Exception:
                tz = timezone(timedelta(hours=5, minutes=30))
            now_ist = datetime.now(tz)

            if period in ("today", "Today"):
                start_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=tz)
            elif period in ("week", "this_week", "Week"):
                monday_ist = now_ist - timedelta(days=now_ist.weekday())
                start_ist = datetime(monday_ist.year, monday_ist.month, monday_ist.day, 0, 0, 0, tzinfo=tz)
            elif period in ("month", "this_month", "Month"):
                start_ist = datetime(now_ist.year, now_ist.month, 1, 0, 0, 0, tzinfo=tz)
            else:
                start_ist = None

            if start_ist:
                start_utc_iso = start_ist.astimezone(timezone.utc).isoformat()
                query["created_at"] = {"$gte": start_utc_iso}

        cursor = db[self.COLLECTION].find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def list_candidates(
        self,
        merchant_id: str = "merch_default",
        status: Optional[str] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        return await self.get_candidates(merchant_id=merchant_id, status=status, limit=limit)

    async def get_analytics(self, merchant_id: str = "merch_default", period: str = "all") -> Dict[str, Any]:
        """Returns aggregated metrics from the recovery_candidates collection."""
        db = get_mongodb()
        base_query: Dict[str, Any] = {}
        if merchant_id and merchant_id != "all":
            base_query["merchant_id"] = merchant_id

        if period != "all":
            from zoneinfo import ZoneInfo
            try:
                tz = ZoneInfo("Asia/Kolkata")
            except Exception:
                tz = timezone(timedelta(hours=5, minutes=30))
            now_ist = datetime.now(tz)

            if period in ("today", "Today"):
                start_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=tz)
            elif period in ("week", "this_week"):
                monday_ist = now_ist - timedelta(days=now_ist.weekday())
                start_ist = datetime(monday_ist.year, monday_ist.month, monday_ist.day, 0, 0, 0, tzinfo=tz)
            elif period in ("month", "this_month"):
                start_ist = datetime(now_ist.year, now_ist.month, 1, 0, 0, 0, tzinfo=tz)
            else:
                start_ist = None

            if start_ist:
                start_utc_iso = start_ist.astimezone(timezone.utc).isoformat()
                base_query["created_at"] = {"$gte": start_utc_iso}

        total = await db[self.COLLECTION].count_documents(base_query)
        scheduled = await db[self.COLLECTION].count_documents({**base_query, "status": "SCHEDULED"})
        dispatched = await db[self.COLLECTION].count_documents({**base_query, "status": {"$in": ["DISPATCHED", "EMAIL_SENT", "SMS_SENT", "EMAIL+SMS_SENT"]}})
        recovered = await db[self.COLLECTION].count_documents({**base_query, "status": "RECOVERED"})
        failed_dispatch = await db[self.COLLECTION].count_documents({**base_query, "status": "FAILED"})
        skipped = await db[self.COLLECTION].count_documents({**base_query, "status": "SKIPPED"})

        # Recoverable revenue (from SCHEDULED + DISPATCHED)
        rev_agg = await db[self.COLLECTION].aggregate([
            {"$match": {**base_query, "status": {"$in": ["SCHEDULED", "DISPATCHED", "EMAIL_SENT", "SMS_SENT", "EMAIL+SMS_SENT"]}}},
            {"$group": {"_id": None, "total_rev": {"$sum": "$recoverable_revenue"}, "avg_score": {"$avg": "$recovery_score"}}},
        ]).to_list(length=1)

        recoverable = rev_agg[0]["total_rev"] if rev_agg else 0.0
        avg_score = rev_agg[0]["avg_score"] if rev_agg else 0.0

        return {
            "total_candidates": total,
            "scheduled": scheduled,
            "dispatched": dispatched,
            "recovered": recovered,
            "failed_dispatch": failed_dispatch,
            "skipped": skipped,
            "recoverable_revenue": round(recoverable, 2),
            "average_ai_score": round(avg_score, 1),
        }

    # ── Update ─────────────────────────────────────────────────────────────────

    async def update_status(
        self,
        candidate_id: str,
        status: str,
        extra: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update status of a single candidate in recovery_candidates."""
        db = get_mongodb()
        update_doc: Dict[str, Any] = {
            "status": status,
            "recovery_status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if extra:
            update_doc.update(extra)

        result = await db[self.COLLECTION].update_one(
            {"candidate_id": candidate_id},
            {"$set": update_doc},
        )
        return result.modified_count > 0

