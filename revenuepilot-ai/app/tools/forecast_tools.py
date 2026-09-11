"""
RevenuePilot AI — Forecast Tools (Agno Toolkit)
Exposes predictive revenue forecasting and trend analytics.
"""
from __future__ import annotations

from agno.tools import Toolkit
from app.services import analytics


class ForecastTools(Toolkit):
    """Agno Toolkit exposing revenue forecasting analytics."""

    def __init__(self) -> None:
        super().__init__(name="forecast_tools")
        self.register(self.get_revenue_forecast)

    async def get_revenue_forecast(self) -> dict:
        """Return predictive revenue forecasts for tomorrow, next week, and next month."""
        return await analytics.get_revenue_forecast()
