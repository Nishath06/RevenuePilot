import re
with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\analytics.py", "r", encoding="utf-8") as f:
    content = f.read()

new_logic = """async def get_failed_recovery_orders(period: str = "all") -> list[dict]:
    from app.services import dashboard_analytics
    return await dashboard_analytics.get_recoverable_failed_orders(period)

async def get_cancelled_recovery_orders(period: str = "all") -> list[dict]:
    from app.services import dashboard_analytics
    return await dashboard_analytics.get_recoverable_cancelled_orders(period)

async def abandoned_carts(period: str = "all") -> list[dict]:
    from app.services import dashboard_analytics
    return await dashboard_analytics.get_recoverable_abandoned_carts(period)
"""

# Remove old get_failed_recovery_orders
content = re.sub(r"async def get_failed_recovery_orders.*?return \[r for r in results if r is not None\]", "", content, flags=re.DOTALL)
# Wait, I might have messed up the regex. Let me just replace the specific functions.

