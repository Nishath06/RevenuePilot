"""
RevenuePilot AI — Revenue Tools (Agno)
Wraps analytics service so agents can call structured revenue queries.
"""
from __future__ import annotations

from agno.tools import Toolkit

from app.services import analytics


class RevenueTools(Toolkit):
    """Agno Toolkit exposing revenue metrics to agents."""

    def __init__(self) -> None:
        super().__init__(name="revenue_tools")
        self.register(self.get_revenue_today)
        self.register(self.get_revenue_yesterday)
        self.register(self.get_revenue_this_week)
        self.register(self.get_revenue_this_month)
        self.register(self.get_growth_percentage)
        self.register(self.get_average_order_value)
        self.register(self.get_all_revenue_metrics)

    async def get_revenue_today(self) -> dict:
        """Return total revenue generated today (INR)."""
        value = await analytics.revenue_today()
        return {"today_revenue": value, "currency": "INR"}

    async def get_revenue_yesterday(self) -> dict:
        """Return total revenue generated yesterday (INR)."""
        value = await analytics.revenue_yesterday()
        return {"yesterday_revenue": value, "currency": "INR"}

    async def get_revenue_this_week(self) -> dict:
        """Return total revenue generated this week (INR)."""
        value = await analytics.revenue_this_week()
        return {"week_revenue": value, "currency": "INR"}

    async def get_revenue_this_month(self) -> dict:
        """Return total revenue generated this month (INR)."""
        value = await analytics.revenue_this_month()
        return {"month_revenue": value, "currency": "INR"}

    async def get_growth_percentage(self) -> dict:
        """Return day-over-day revenue growth percentage."""
        value = await analytics.growth_percentage()
        return {"growth_percentage": value, "direction": "up" if value >= 0 else "down"}

    async def get_average_order_value(self) -> dict:
        """Return the average value of all paid orders."""
        value = await analytics.average_order_value()
        return {"average_order_value": value, "currency": "INR"}

    async def get_all_revenue_metrics(self) -> dict:
        """Return all revenue metrics in a single call."""
        metrics = await analytics.get_revenue_metrics()
        return metrics.model_dump()
