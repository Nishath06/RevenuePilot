import re
with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\analytics.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace _filter_recovered_orders and get_failed_recovery_orders
start_str = "async def _filter_recovered_orders"
end_str = "return await _filter_recovered_orders(docs)"

start_idx = content.find(start_str)
end_idx = content.find(end_str) + len(end_str)

new_logic = """async def get_failed_recovery_orders(limit: int = 100) -> list[dict]:
    from app.services import dashboard_analytics
    return await dashboard_analytics.get_recoverable_failed_orders("all")

async def get_cancelled_recovery_orders(limit: int = 100) -> list[dict]:
    from app.services import dashboard_analytics
    return await dashboard_analytics.get_recoverable_cancelled_orders("all")"""

content = content[:start_idx] + new_logic + content[end_idx:]

start_str_carts = "async def abandoned_carts"
end_str_carts = "subtotal=float(d.get(\"subtotal\") or 0.0),\n        )\n        for d in unrecovered\n    ]"

start_idx_carts = content.find(start_str_carts)
end_idx_carts = content.find(end_str_carts) + len(end_str_carts)

new_carts = """async def abandoned_carts(limit: int = 20):
    from app.services import dashboard_analytics
    carts = await dashboard_analytics.get_recoverable_abandoned_carts("all")
    return [CartSnapshot(
        user_id=c.get("user_id", ""),
        items_count=c.get("items_count", 0),
        subtotal=c.get("subtotal", 0.0),
        updated_at=c.get("updated_at")
    ) for c in carts]"""

content = content[:start_idx_carts] + new_carts + content[end_idx_carts:]

with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\analytics.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated analytics.py")

