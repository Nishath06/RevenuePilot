"""
RevenuePilot AI — Recovery Tools (Agno Toolkit)
Exposes abandoned cart targets, failed payment recovery targets, and multi-channel campaign previews (WhatsApp/Email/Coupon).
"""
from __future__ import annotations

from agno.tools import Toolkit
from app.services import analytics


class RecoveryTools(Toolkit):
    """Agno Toolkit exposing revenue recovery analytics and automated outreach campaign previews."""

    def __init__(self) -> None:
        super().__init__(name="recovery_tools")
        self.register(self.abandoned_cart_customers)
        self.register(self.failed_payment_recovery_targets)
        self.register(self.generate_recovery_campaign)

    async def abandoned_cart_customers(self) -> dict:
        """Return detailed list of customers with abandoned carts including cart value and item titles."""
        carts = await analytics.abandoned_cart_customers()
        return {"abandoned_cart_customers": carts, "count": len(carts)}

    async def failed_payment_recovery_targets(self) -> dict:
        """Return priority list of customers with failed payments including priority score and contact details."""
        targets = await analytics.failed_payment_recovery_targets()
        return {"recovery_targets": targets, "count": len(targets)}

    async def generate_recovery_campaign(self) -> dict:
        """Generate ready-to-send WhatsApp preview, Email preview, and promo coupon suggestion (e.g. RECOVER10)."""
        return await analytics.generate_recovery_campaign()
