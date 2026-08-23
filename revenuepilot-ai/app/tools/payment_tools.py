"""
RevenuePilot AI — Payment Tools (Agno)
Exposes Razorpay payment analytics, failed payment customer lookup, reason breakdown, and recoverable revenue.
"""
from __future__ import annotations

from agno.tools import Toolkit
from app.services import analytics


class PaymentTools(Toolkit):
    """Agno Toolkit exposing Razorpay payment analytics."""

    def __init__(self) -> None:
        super().__init__(name="payment_tools")
        self.register(self.get_successful_payments)
        self.register(self.get_failed_payments)
        self.register(self.get_failed_payment_customers)
        self.register(self.failed_payment_reason_breakdown)
        self.register(self.payment_method_success_breakdown)
        self.register(self.recoverable_failed_revenue)
        self.register(self.get_payment_success_rate)
        self.register(self.get_payment_method_breakdown)
        self.register(self.get_all_payment_metrics)

    async def get_successful_payments(self) -> dict:
        """Return count of successfully captured payments."""
        count = await analytics.successful_payments()
        return {"successful_payments": count}

    async def get_failed_payments(self) -> dict:
        """Return count of failed payments."""
        count = await analytics.failed_payments()
        return {"failed_payments": count}

    async def get_failed_payment_customers(self) -> dict:
        """Return customer details (name, email, phone, reason, amount) for failed payments."""
        customers = await analytics.get_failed_payment_customers()
        return {"failed_payment_customers": customers, "count": len(customers)}

    async def failed_payment_reason_breakdown(self) -> dict:
        """Return breakdown of failed payments grouped by failure reason."""
        reasons = await analytics.failed_payment_reason_breakdown()
        return {"failed_payment_reasons": reasons}

    async def payment_method_success_breakdown(self) -> dict:
        """Return breakdown of successful vs failed transactions by payment method (UPI, Card, Netbanking)."""
        methods = await analytics.payment_method_success_breakdown()
        return {"method_success_breakdown": methods}

    async def recoverable_failed_revenue(self) -> dict:
        """Return total recoverable monetary amount from failed payments, cancelled orders, and abandoned carts."""
        return await analytics.recoverable_failed_revenue()

    async def get_payment_success_rate(self) -> dict:
        """Return the overall payment success rate as a percentage."""
        total = await analytics.col_count("payments", {})
        success = await analytics.successful_payments()
        rate = round((success / total) * 100, 2) if total > 0 else 0.0
        return {"success_rate_percentage": rate, "total_payments": total}

    async def get_payment_method_breakdown(self) -> dict:
        """Return breakdown of payment counts by method (UPI, Card, Wallet, etc.)."""
        breakdown = await analytics.payment_method_breakdown()
        return {"payment_methods": [b.model_dump() for b in breakdown]}

    async def get_all_payment_metrics(self) -> dict:
        """Return all payment metrics in one call."""
        metrics = await analytics.get_payment_metrics()
        return metrics.model_dump()
