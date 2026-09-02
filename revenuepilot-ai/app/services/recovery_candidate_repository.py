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
    """

    COLLECTION = "recovery_candidates"

    # ── Write ──────────────────────────────────────────────────────────────────

    async def upsert_candidates(
        self,
        candidates: list,           # List[RecoveryCandidate]
        merchant_id: str,
    ) -> int:
        """
        Upserts a list of RecoveryCandidate objects into MongoDB.
        Uses candidate_id as the upsert key.
        Returns the number of documents inserted/updated.
        """
        db = get_mongodb()
        inserted = 0

        for cand in candidates:
            try:
                doc = cand.to_dict()
                doc.setdefault("created_at", datetime.now(timezone.utc).isoformat())

                await db[self.COLLECTION].update_one(
                    {"candidate_id": doc["candidate_id"]},
                    {"$set": doc},
                    upsert=True,
                )
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
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Returns APPROVED or SCHEDULED candidates ready for RecoveryLambda."""
        db = get_mongodb()
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor = db[self.COLLECTION].find(
            {
                "merchant_id": merchant_id,
                "status": {"$in": ["APPROVED", "SCHEDULED"]},
                "$or": [
                    {"expires_at": {"$gte": now_iso}},
                    {"expires_at": None},
                    {"expires_at": ""},
                ],
            },
            {"_id": 0},
        ).sort("recovery_score", -1).limit(limit)

        return await cursor.to_list(length=limit)

    async def list_candidates(
        self,
        merchant_id: str,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """List all candidates with optional status filter."""
        db = get_mongodb()
        query: Dict[str, Any] = {"merchant_id": merchant_id}
        if status:
            query["status"] = status

        cursor = db[self.COLLECTION].find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_analytics(self, merchant_id: str) -> Dict[str, Any]:
        """Returns aggregated metrics for the Recovery AI dashboard."""
        db = get_mongodb()

        total = await db[self.COLLECTION].count_documents({"merchant_id": merchant_id})
        approved = await db[self.COLLECTION].count_documents({"merchant_id": merchant_id, "status": "SCHEDULED"})
        sent = await db[self.COLLECTION].count_documents({"merchant_id": merchant_id, "status": "SENT"})
        pending = await db[self.COLLECTION].count_documents({"merchant_id": merchant_id, "status": "PENDING_AI_REVIEW"})

        # Recoverable revenue
        rev_agg = await db[self.COLLECTION].aggregate([
            {"$match": {"merchant_id": merchant_id, "status": {"$in": ["APPROVED", "SCHEDULED"]}}},
            {"$group": {"_id": None, "total_rev": {"$sum": "$recoverable_revenue"}, "avg_score": {"$avg": "$recovery_score"}}},
        ]).to_list(length=1)

        recoverable = rev_agg[0]["total_rev"] if rev_agg else 0.0
        avg_score = rev_agg[0]["avg_score"] if rev_agg else 0.0

        # Top segments
        seg_agg = await db[self.COLLECTION].aggregate([
            {"$match": {"merchant_id": merchant_id}},
            {"$group": {"_id": "$segment", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5},
        ]).to_list(length=5)
        
        # Priorities for critical/high/medium counts in insights
        priority_agg = await db[self.COLLECTION].aggregate([
            {"$match": {"merchant_id": merchant_id, "status": "SCHEDULED"}},
            {"$group": {"_id": "$priority", "count": {"$sum": 1}}}
        ]).to_list(length=10)
        priorities = {p["_id"]: p["count"] for p in priority_agg if p["_id"]}

        # Top reasons
        reason_agg = await db[self.COLLECTION].aggregate([
            {"$match": {"merchant_id": merchant_id}},
            {"$group": {"_id": "$reasoning", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 3},
        ]).to_list(length=3)

        # Campaign history (sent)
        email_sent = await db.communication_logs.count_documents({
            "merchant_id": merchant_id, "channel": "SES_EMAIL", "status": {"$regex": "SUCCESS"}
        })
        sms_sent = await db.communication_logs.count_documents({
            "merchant_id": merchant_id, "channel": "SNS_SMS", "status": {"$regex": "SUCCESS"}
        })

        # Customers analyzed (unique customer_ids)
        customers_analyzed = len(await db[self.COLLECTION].distinct("customer_id", {"merchant_id": merchant_id}))

        return {
            "customers_analyzed": max(customers_analyzed, total),
            "total_candidates": total,
            "approved_candidates": approved,
            "pending_review": pending,
            "emails_sent": email_sent,
            "sms_sent": sms_sent,
            "campaigns_sent": sent,
            "recoverable_revenue": round(recoverable, 2),
            "average_ai_score": round(avg_score, 1),
            "top_segments": [{"segment": s["_id"], "count": s["count"]} for s in seg_agg if s["_id"]],
            "priorities": priorities,
            "top_recovery_reasons": [r["_id"][:100] for r in reason_agg if r["_id"]],
        }

    # ── Update ─────────────────────────────────────────────────────────────────

    async def update_status(
        self,
        candidate_id: str,
        status: str,
        extra: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update status of a single candidate (used by RecoveryLambda after dispatch)."""
        db = get_mongodb()
        update_doc: Dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if extra:
            update_doc.update(extra)

        result = await db[self.COLLECTION].update_one(
            {"candidate_id": candidate_id},
            {"$set": update_doc},
        )
        return result.modified_count > 0
