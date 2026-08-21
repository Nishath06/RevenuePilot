"""
RevenuePilot AI — Customer Tools (Agno)
"""
from __future__ import annotations

from agno.tools import Toolkit

from app.services import analytics


class CustomerTools(Toolkit):
    """Agno Toolkit exposing customer analytics."""

    def __init__(self) -> None:
        super().__init__(name="customer_tools")
        self.register(self.get_repeat_customers)
        self.register(self.get_first_time_customers)
        self.register(self.get_abandoned_carts)
        self.register(self.get_inactive_customers)
        self.register(self.get_top_customers)
        self.register(self.get_all_customer_metrics)

    async def get_repeat_customers(self) -> dict:
        """Return count of customers who have placed more than 1 paid order."""
        count = await analytics.repeat_customers()
        return {"repeat_customers": count}

    async def get_first_time_customers(self) -> dict:
        """Return count of customers with exactly 1 paid order."""
        count = await analytics.first_time_customers()
        return {"first_time_customers": count}

    async def get_abandoned_carts(self) -> dict:
        """Return list of carts that were abandoned (items present, no recent order)."""
        carts = await analytics.abandoned_carts()
        return {
            "abandoned_carts": [c.model_dump() for c in carts],
            "total_count": len(carts),
            "total_value": round(sum(c.subtotal for c in carts), 2),
        }

    async def get_inactive_customers(self) -> dict:
        """Return count of customers inactive for the past 30 days."""
        count = await analytics.inactive_customers()
        return {"inactive_customers_last_30_days": count}

    async def get_top_customers(self) -> dict:
        """Return top 10 customers by lifetime spend."""
        customers = await analytics.top_customers()
        return {"top_customers": [c.model_dump() for c in customers]}

    async def get_all_customer_metrics(self) -> dict:
        """Return all customer metrics in one call."""
        metrics = await analytics.get_customer_metrics()
        return metrics.model_dump()
