"""
RevenuePilot AI — Inventory Tools (Agno)
"""
from __future__ import annotations

from agno.tools import Toolkit

from app.services import analytics


class InventoryTools(Toolkit):
    """Agno Toolkit exposing inventory and product analytics."""

    def __init__(self) -> None:
        super().__init__(name="inventory_tools")
        self.register(self.get_low_stock_products)
        self.register(self.get_out_of_stock_products)
        self.register(self.get_best_selling_products)
        self.register(self.get_slow_selling_products)
        self.register(self.get_category_revenue)
        self.register(self.get_all_inventory_metrics)

    async def get_low_stock_products(self) -> dict:
        """Return products with stock <= 10 units, sorted ascending."""
        products = await analytics.low_stock_products()
        return {"low_stock_products": [p.model_dump() for p in products], "count": len(products)}

    async def get_out_of_stock_products(self) -> dict:
        """Return products with zero stock."""
        products = await analytics.out_of_stock_products()
        return {"out_of_stock_products": [p.model_dump() for p in products], "count": len(products)}

    async def get_best_selling_products(self) -> dict:
        """Return top 10 products by units sold from paid orders."""
        products = await analytics.best_selling_products()
        return {"best_selling": [p.model_dump() for p in products]}

    async def get_slow_selling_products(self) -> dict:
        """Return bottom 10 products by units sold."""
        products = await analytics.slow_selling_products()
        return {"slow_selling": [p.model_dump() for p in products]}

    async def get_category_revenue(self) -> dict:
        """Return revenue breakdown by product category."""
        data = await analytics.category_revenue()
        return {"category_revenue": data}

    async def get_all_inventory_metrics(self) -> dict:
        """Return all inventory metrics in one call."""
        metrics = await analytics.get_inventory_metrics()
        return metrics.model_dump()
