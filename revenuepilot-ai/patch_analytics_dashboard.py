import re
with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\analytics.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace failed_orders_today and cancelled_orders_today
content = re.sub(r"async def failed_orders_today\(\) -> int:.*?return await _today_order_count\(\"Failed\"\)", 
"""async def failed_orders_today() -> int:
    from app.services import dashboard_analytics
    orders = await dashboard_analytics.get_failed_orders("today")
    return len(orders)""", content, flags=re.DOTALL)

content = re.sub(r"async def cancelled_orders_today\(\) -> int:.*?return await _today_order_count\(\"Cancelled\"\)", 
"""async def cancelled_orders_today() -> int:
    from app.services import dashboard_analytics
    orders = await dashboard_analytics.get_cancelled_orders("today")
    return len(orders)""", content, flags=re.DOTALL)

content = re.sub(r"async def failed_orders\(\) -> int:.*?return await get_collection\(\"orders\"\)\.count_documents\(\{\"payment_status\": \"Failed\"\}\)",
"""async def failed_orders() -> int:
    from app.services import dashboard_analytics
    orders = await dashboard_analytics.get_failed_orders("all")
    return len(orders)""", content, flags=re.DOTALL)

content = re.sub(r"async def cancelled_orders\(\) -> int:.*?return await get_collection\(\"orders\"\)\.count_documents\(\{\"payment_status\": \"Cancelled\"\}\)",
"""async def cancelled_orders() -> int:
    from app.services import dashboard_analytics
    orders = await dashboard_analytics.get_cancelled_orders("all")
    return len(orders)""", content, flags=re.DOTALL)

with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\analytics.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated analytics.py counts")

