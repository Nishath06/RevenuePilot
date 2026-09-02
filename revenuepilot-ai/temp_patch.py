import re
with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\merchant_service.py", "r", encoding="utf-8") as f:
    content = f.read()

new_recovery_data = """async def get_recovery_data(period: str = \"all\") -> RecoveryResponse:
    \"\"\"Build recovery payload using shared dashboard analytics.\"\"\"
    from app.services import dashboard_analytics
    
    # Use the shared analytics service (Single Source of Truth)
    recoverable = await dashboard_analytics.get_recoverable_orders(period)
    failed_order_docs = recoverable[\"failed_orders\"]
    cancelled_order_docs = recoverable[\"cancelled_orders\"]
    carts = recoverable[\"abandoned_carts\"]

    failed_items = []
    for o in failed_order_docs:
        customer_name = o.get(\"customer_name\")
        amount = o.get(\"total_amount\", 0.0)
        wa_msg = f\"Hi {customer_name}! ?? Your payment of ?{amount:.0f} failed. Need help? Reply to chat with support.\"
        email_msg = f\"Subject: Complete your transaction\\nHi {customer_name},\\nWe noticed your recent payment attempt failed. You can try again securely via this link.\"
        failed_items.append({
            \"order_id\": o.get(\"order_id\"),
            \"customer_name\": customer_name,
            \"customer_email\": o.get(\"customer_email\"),
            \"customer_phone\": o.get(\"customer_phone\"),
            \"amount\": amount,
            \"failure_reason\": o.get(\"failure_reason\"),
            \"error_code\": o.get(\"error_code\"),
            \"created_at\": o.get(\"created_at\").isoformat() if hasattr(o.get(\"created_at\"), \"isoformat\") else str(o.get(\"created_at\")),
            \"whatsapp_message\": wa_msg,
            \"email_message\": email_msg,
            \"type\": \"failed\"
        })

    cancelled_items = []
    for o in cancelled_order_docs:
        customer_name = o.get(\"customer_name\")
        amount = o.get(\"total_amount\", 0.0)
        wa_msg = f\"Hi {customer_name}! ?? We saw you cancelled your purchase of ?{amount:.0f}. Still thinking about it?\"
        email_msg = f\"Subject: Resume checkout\\nHi {customer_name},\\nYou were almost there! Resume your checkout where you left off.\"
        cancelled_items.append({
            \"order_id\": o.get(\"order_id\"),
            \"customer_name\": customer_name,
            \"customer_email\": o.get(\"customer_email\"),
            \"customer_phone\": o.get(\"customer_phone\"),
            \"amount\": amount,
            \"failure_reason\": o.get(\"failure_reason\", \"Customer cancelled checkout\"),
            \"created_at\": o.get(\"created_at\").isoformat() if hasattr(o.get(\"created_at\"), \"isoformat\") else str(o.get(\"created_at\")),
            \"whatsapp_message\": wa_msg,
            \"email_message\": email_msg,
            \"type\": \"cancelled\"
        })

    abandoned_cart_list = []
    whatsapp_msgs = []
    email_msgs = []
    
    for cart in carts:
        customer_name = cart.get(\"customer_name\")
        amount = cart.get(\"subtotal\", 0.0)
        wa = f\"Hi {customer_name}! ?? You left {cart.get(\"items_count\", 0)} items in your cart. Click here to checkout securely: [Link]\"
        em = f\"Subject: Your cart is waiting!\\nHi {customer_name},\\nYour items are reserved. Complete your purchase now before they sell out.\"
        whatsapp_msgs.append(wa)
        email_msgs.append(em)

        abandoned_cart_list.append({
            \"user_id\": cart.get(\"user_id\"),
            \"items_count\": cart.get(\"items_count\", 0),
            \"subtotal\": amount,
            \"updated_at\": cart.get(\"updated_at\").isoformat() if hasattr(cart.get(\"updated_at\"), \"isoformat\") else str(cart.get(\"updated_at\")),
            \"whatsapp_message\": wa,
            \"email_message\": em,
            \"type\": \"abandoned\"
        })

    from app.services import analytics
    top_customers = await analytics.top_customers(limit=5)
    
    total_recoverable = sum(item[\"amount\"] for item in failed_items) + sum(item[\"amount\"] for item in cancelled_items) + sum(item[\"subtotal\"] for item in abandoned_cart_list)

    return RecoveryResponse(
        failed_payments=failed_items + cancelled_items,
        abandoned_carts=abandoned_cart_list,
        whatsapp_messages=whatsapp_msgs,
        email_messages=email_msgs,
        priority_customers=[c.model_dump() for c in top_customers],
        total_recoverable_amount=round(total_recoverable, 2),
    )"""

content = re.sub(r"async def get_recovery_data.*?return RecoveryResponse\([^)]+\)", new_recovery_data, content, flags=re.DOTALL)

with open(r"e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\merchant_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated merchant_service.py")

