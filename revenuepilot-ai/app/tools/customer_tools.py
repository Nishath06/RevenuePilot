"""
RevenuePilot AI — Customer Tools (Agno Toolkit)
Exposes customer acquisition, purchase frequency, lifetime value, and top customer profiles.
"""
from __future__ import annotations

from agno.tools import Toolkit
from app.services import analytics


class CustomerTools(Toolkit):
    """Agno Toolkit exposing customer analytics."""

    def __init__(self) -> None:
        super().__init__(name="customer_tools")
        self.register(self.get_customer_acquisition_summary)
        self.register(self.get_top_customers)
        self.register(self.customer_purchase_frequency)
        self.register(self.customer_lifetime_value)
        self.register(self.get_repeat_customers)
        self.register(self.get_first_time_customers)
        self.register(self.get_inactive_customers)
        self.register(self.get_customer_retention_rate)
        self.register(self.get_all_customer_metrics)

    async def get_customer_acquisition_summary(self) -> dict:
        """Return customer acquisition summary (new, repeat, repeat rate, top spender, avg spend)."""
        return await analytics.customer_acquisition_summary()

    async def get_top_customers(self) -> dict:
        """Return top 10 customers aggregated by total spending with contact details."""
        customers = await analytics.top_customers()
        return {"top_customers": [c.model_dump() for c in customers]}

    async def customer_purchase_frequency(self) -> dict:
        """Return average purchase frequency and order breakdown per customer."""
        return await analytics.customer_purchase_frequency()

    async def customer_lifetime_value(self) -> dict:
        """Return customer lifetime value (LTV) distribution and average LTV."""
        return await analytics.customer_lifetime_value()

    async def get_repeat_customers(self) -> dict:
        """Return count of repeat customers who have placed >1 paid order."""
        count = await analytics.repeat_customers()
        return {"repeat_customers": count}

    async def get_first_time_customers(self) -> dict:
        """Return count of first-time customers with exactly 1 paid order."""
        count = await analytics.first_time_customers()
        return {"first_time_customers": count}

    async def get_inactive_customers(self) -> dict:
        """Return count of customers inactive for the past 30 days."""
        count = await analytics.inactive_customers()
        return {"inactive_customers_last_30_days": count}

    async def get_customer_retention_rate(self) -> dict:
        """Return customer retention rate percentage."""
        rate = await analytics.customer_retention_rate()
        return {"retention_rate_percentage": rate}

    async def get_all_customer_metrics(self) -> dict:
        """Return all customer metrics in one call."""
        metrics = await analytics.get_customer_metrics()
        return metrics.model_dump()
