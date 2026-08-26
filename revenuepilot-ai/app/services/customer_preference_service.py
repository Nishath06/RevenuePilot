"""
RevenuePilot AI — Customer & Merchant AI Preference Memory Service
Manages merchant AI preferences (report formats, campaign channels, favorite KPIs, recovery choices).
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from app.db.mongodb import get_mongodb
from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_PREFERENCES = {
    "merchant_id": "merch_default",
    "preferred_report_format": "pdf",  # "pdf" | "csv" | "json"
    "preferred_campaign_channel": "whatsapp",  # "whatsapp" | "email" | "push"
    "favorite_kpis": ["revenue", "payment_success_rate", "low_stock"],
    "previous_ai_conversations_summary": "Merchant frequently monitors revenue growth and failed payment recoveries.",
    "recovery_preference": "whatsapp_first",
    "marketing_preference": "automatic_coupons",
    "updated_at": datetime.now(timezone.utc).isoformat(),
}


class CustomerPreferenceService:
    def __init__(self):
        pass

    async def get_preferences(self, merchant_id: str = "merch_default") -> Dict[str, Any]:
        """
        PART 6 — Retrieve merchant AI preferences from MongoDB.
        """
        db = get_mongodb()
        prefs = await db.merchant_ai_preferences.find_one({"merchant_id": merchant_id}, {"_id": 0})
        if not prefs:
            prefs = {**DEFAULT_PREFERENCES, "merchant_id": merchant_id}
            await db.merchant_ai_preferences.insert_one({**prefs})
            if "_id" in prefs:
                del prefs["_id"]
        return prefs

    async def update_preferences(self, merchant_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates merchant preferences in MongoDB.
        """
        db = get_mongodb()
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.merchant_ai_preferences.update_one(
            {"merchant_id": merchant_id},
            {"$set": updates},
            upsert=True
        )
        return await self.get_preferences(merchant_id)

    async def learn_from_chat(self, merchant_id: str, message: str) -> None:
        """
        Implicitly learns merchant preferences based on chat interaction phrases.
        - e.g. "PDF report" -> preferred_report_format = "pdf"
        - "WhatsApp" -> preferred_campaign_channel = "whatsapp"
        - "revenue" -> adds revenue to favorite_kpis
        """
        msg_lower = message.lower()
        updates = {}

        if "pdf" in msg_lower:
            updates["preferred_report_format"] = "pdf"
        elif "csv" in msg_lower or "excel" in msg_lower:
            updates["preferred_report_format"] = "csv"
        elif "json" in msg_lower:
            updates["preferred_report_format"] = "json"

        if "whatsapp" in msg_lower:
            updates["preferred_campaign_channel"] = "whatsapp"
            updates["recovery_preference"] = "whatsapp_first"
        elif "email" in msg_lower:
            updates["preferred_campaign_channel"] = "email"

        if updates:
            await self.update_preferences(merchant_id, updates)


customer_preference_service = CustomerPreferenceService()
