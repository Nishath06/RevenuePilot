"""
RevenuePilot AI — Insights API
Structured analytics endpoints consumed by the Merchant Dashboard.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import verify_api_key
from app.models.response import InsightResponse
from app.services import merchant_service

router = APIRouter(prefix="/insights", tags=["Insights"])


def _build_recommendations(revenue, payments, orders) -> list[str]:
    recs = []
    if revenue.growth_percentage < -10:
        recs.append("Revenue is declining. Consider a promotional campaign.")
    if payments.success_rate < 90:
        recs.append("Payment success rate needs attention. Check Razorpay webhook logs.")
    if orders.pending > orders.paid:
        recs.append("More pending orders than paid. Review checkout flow for blockers.")
    if not recs:
        recs.append("Business is performing well. Keep monitoring daily trends.")
    return recs


@router.get(
    "/today",
    response_model=InsightResponse,
    summary="Today's business insights",
)
async def insights_today(_: str = Depends(verify_api_key)) -> InsightResponse:
    revenue = await merchant_service.get_revenue_metrics()
    orders = await merchant_service.get_order_metrics()
    payments = await merchant_service.get_payment_metrics()
    customers = await merchant_service.get_customer_metrics()
    return InsightResponse(
        period="today",
        revenue=revenue.model_dump(),
        orders={"today": orders.today, "paid": orders.paid, "pending": orders.pending},
        payments={"success_rate": payments.success_rate, "failed": payments.failed},
        customers={"abandoned_carts": len(customers.abandoned_carts)},
        recommendations=_build_recommendations(revenue, payments, orders),
    )


@router.get(
    "/week",
    response_model=InsightResponse,
    summary="This week's business insights",
)
async def insights_week(_: str = Depends(verify_api_key)) -> InsightResponse:
    revenue = await merchant_service.get_revenue_metrics()
    orders = await merchant_service.get_order_metrics()
    payments = await merchant_service.get_payment_metrics()
    customers = await merchant_service.get_customer_metrics()
    return InsightResponse(
        period="this_week",
        revenue={"this_week": revenue.this_week, "growth_percentage": revenue.growth_percentage},
        orders={"this_week": orders.this_week, "paid": orders.paid},
        payments={"success_rate": payments.success_rate, "successful": payments.successful},
        customers={"repeat_customers": customers.repeat_customers},
        recommendations=_build_recommendations(revenue, payments, orders),
    )


@router.get(
    "/month",
    response_model=InsightResponse,
    summary="This month's business insights",
)
async def insights_month(_: str = Depends(verify_api_key)) -> InsightResponse:
    revenue = await merchant_service.get_revenue_metrics()
    orders = await merchant_service.get_order_metrics()
    payments = await merchant_service.get_payment_metrics()
    customers = await merchant_service.get_customer_metrics()
    return InsightResponse(
        period="this_month",
        revenue={"this_month": revenue.this_month, "average_order_value": revenue.average_order_value},
        orders={"total": orders.total, "paid": orders.paid, "cancelled": orders.cancelled},
        payments={"success_rate": payments.success_rate, "method_breakdown": [m.model_dump() for m in payments.method_breakdown]},
        customers={"top_customers": len(customers.top_customers), "repeat_rate": customers.repeat_customers},
        recommendations=_build_recommendations(revenue, payments, orders),
    )


@router.get(
    "/payments",
    summary="Payment analytics deep-dive",
)
async def insights_payments(_: str = Depends(verify_api_key)) -> dict:
    metrics = await merchant_service.get_payment_metrics()
    return {
        "period": "all_time",
        "successful_payments": metrics.successful,
        "failed_payments": metrics.failed,
        "success_rate_percentage": metrics.success_rate,
        "method_breakdown": [m.model_dump() for m in metrics.method_breakdown],
    }


@router.get(
    "/inventory",
    summary="Inventory intelligence",
)
async def insights_inventory(_: str = Depends(verify_api_key)) -> dict:
    metrics = await merchant_service.get_inventory_metrics()
    return {
        "low_stock_count": len(metrics.low_stock),
        "out_of_stock_count": len(metrics.out_of_stock),
        "low_stock_products": [p.model_dump() for p in metrics.low_stock],
        "out_of_stock_products": [p.model_dump() for p in metrics.out_of_stock],
        "best_selling": [p.model_dump() for p in metrics.best_selling[:5]],
        "category_revenue": metrics.category_revenue,
    }


@router.get(
    "/customers",
    summary="Customer intelligence",
)
async def insights_customers(_: str = Depends(verify_api_key)) -> dict:
    metrics = await merchant_service.get_customer_metrics()
    return {
        "repeat_customers": metrics.repeat_customers,
        "first_time_customers": metrics.first_time_customers,
        "inactive_customers": metrics.inactive_customers,
        "abandoned_carts_count": len(metrics.abandoned_carts),
        "abandoned_cart_value": round(sum(c.subtotal for c in metrics.abandoned_carts), 2),
        "top_customers": [c.model_dump() for c in metrics.top_customers[:5]],
    }
