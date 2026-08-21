"""
RevenuePilot AI — Recommendation Tools (Agno)
Business-rule-based recommendation engine.
All logic uses live metric thresholds — no LLM calculations.
"""
from __future__ import annotations

from agno.tools import Toolkit

from app.services import analytics


class RecommendationTools(Toolkit):
    """Rule-based recommendation engine exposed as an Agno toolkit."""

    def __init__(self) -> None:
        super().__init__(name="recommendation_tools")
        self.register(self.generate_revenue_recommendations)
        self.register(self.generate_payment_recommendations)
        self.register(self.generate_inventory_recommendations)
        self.register(self.generate_customer_recommendations)
        self.register(self.generate_all_recommendations)

    async def generate_revenue_recommendations(self) -> dict:
        """Generate revenue-specific recommendations based on live metrics."""
        metrics = await analytics.get_revenue_metrics()
        recs: list[str] = []

        if metrics.growth_percentage < -20:
            recs.append(
                "[HIGH] Revenue dropped significantly. Run a 24-hour flash sale with 15% discount to recover momentum."
            )
        elif metrics.growth_percentage < 0:
            recs.append(
                "[MEDIUM] Revenue is slightly down. Consider promoting top-selling products on social media."
            )
        elif metrics.growth_percentage > 50:
            recs.append(
                "[LOW] Exceptional growth today! Ensure inventory is sufficient to meet demand and capture this momentum."
            )

        if metrics.average_order_value < 500:
            recs.append(
                "[MEDIUM] Average order value is low. Add product bundles or a minimum-order free shipping threshold to increase basket size."
            )

        if not recs:
            recs.append("Revenue metrics look healthy. Continue monitoring daily trends.")

        return {"revenue_recommendations": recs, "metrics_used": metrics.model_dump()}

    async def generate_payment_recommendations(self) -> dict:
        """Generate payment-specific recommendations."""
        metrics = await analytics.get_payment_metrics()
        recs: list[str] = []

        if metrics.success_rate < 85:
            recs.append(
                "[HIGH] Payment success rate is below 85%. Enable UPI Autopay and verify Razorpay webhook configuration immediately."
            )

        if metrics.failed > 5:
            recs.append(
                f"[HIGH] {metrics.failed} failed payments detected. Reach out to affected customers with retry links."
            )

        # Check payment method concentration
        if metrics.method_breakdown:
            top_method = metrics.method_breakdown[0]
            total_payments = sum(m.count for m in metrics.method_breakdown)
            if total_payments > 0:
                concentration = (top_method.count / total_payments) * 100
                if concentration > 70:
                    recs.append(
                        f"[MEDIUM] {top_method.method} accounts for {concentration:.0f}% of payments. "
                        "Diversify by promoting other payment methods to reduce dependency risk."
                    )

        if not recs:
            recs.append("Payment metrics are healthy. Success rate is above acceptable threshold.")

        return {"payment_recommendations": recs, "metrics_used": metrics.model_dump()}

    async def generate_inventory_recommendations(self) -> dict:
        """Generate inventory-specific recommendations."""
        metrics = await analytics.get_inventory_metrics()
        recs: list[str] = []

        if metrics.out_of_stock:
            products = ", ".join(p.title for p in metrics.out_of_stock[:3])
            recs.append(
                f"[HIGH] {len(metrics.out_of_stock)} products are out of stock ({products}...). "
                "Reorder immediately to avoid revenue loss."
            )

        if metrics.low_stock:
            products = ", ".join(p.title for p in metrics.low_stock[:3])
            recs.append(
                f"[MEDIUM] {len(metrics.low_stock)} products are running low ({products}...). "
                "Set restock alerts and initiate purchase orders."
            )

        if metrics.slow_selling:
            products = ", ".join(p.title for p in metrics.slow_selling[:2])
            recs.append(
                f"[LOW] Slow-moving products detected ({products}...). "
                "Consider bundling with bestsellers or running targeted promotions."
            )

        if not recs:
            recs.append("Inventory levels look healthy. No immediate action required.")

        return {"inventory_recommendations": recs, "low_stock_count": len(metrics.low_stock)}

    async def generate_customer_recommendations(self) -> dict:
        """Generate customer-specific recommendations."""
        metrics = await analytics.get_customer_metrics()
        recs: list[str] = []

        total_customers = metrics.repeat_customers + metrics.first_time_customers
        if total_customers > 0:
            repeat_rate = (metrics.repeat_customers / total_customers) * 100
            if repeat_rate < 20:
                recs.append(
                    f"[HIGH] Repeat customer rate is only {repeat_rate:.0f}%. "
                    "Launch a loyalty points program to increase retention and LTV."
                )

        if metrics.abandoned_carts:
            total_value = sum(c.subtotal for c in metrics.abandoned_carts)
            recs.append(
                f"[HIGH] ₹{total_value:.0f} is sitting in {len(metrics.abandoned_carts)} abandoned carts. "
                "Send WhatsApp recovery messages within 1 hour of abandonment."
            )

        if metrics.inactive_customers > 50:
            recs.append(
                f"[MEDIUM] {metrics.inactive_customers} customers haven't ordered in 30 days. "
                "Run a re-engagement campaign with a 10% win-back discount."
            )

        if not recs:
            recs.append("Customer metrics are healthy. Keep nurturing your loyal customer base.")

        return {"customer_recommendations": recs}

    async def generate_all_recommendations(self) -> dict:
        """Run all recommendation engines and return combined output."""
        revenue = await self.generate_revenue_recommendations()
        payments = await self.generate_payment_recommendations()
        inventory = await self.generate_inventory_recommendations()
        customers = await self.generate_customer_recommendations()

        all_recs = (
            revenue["revenue_recommendations"]
            + payments["payment_recommendations"]
            + inventory["inventory_recommendations"]
            + customers["customer_recommendations"]
        )

        # Sort by priority: HIGH > MEDIUM > LOW
        priority_order = {"[HIGH]": 0, "[MEDIUM]": 1, "[LOW]": 2}
        all_recs.sort(key=lambda r: priority_order.get(r[:6].strip(), 3))

        return {
            "all_recommendations": all_recs,
            "total": len(all_recs),
            "high_priority": sum(1 for r in all_recs if "[HIGH]" in r),
        }
