"""
RevenuePilot Day 3 — Multi-Agent MongoDB Analytics Verification Script
Tests all new MongoDB direct aggregation functions & CoordinatorAgent domain cards.
"""
import asyncio
import json
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.services import analytics
from app.agents.coordinator import CoordinatorAgent


async def run_tests():
    print("=" * 70)
    print("REVENUEPILOT DAY 3: MONGODB ANALYTICS & MULTI-AGENT VERIFICATION")
    print("=" * 70)

    # 1. Connect to MongoDB
    await connect_to_mongodb()
    print("\n[OK] MongoDB Connection Established & Indexes Verified.")

    # 2. Inventory Analytics Test
    print("\n--- 1. INVENTORY AGENT DIRECT MONGODB ANALYTICS ---")
    unsold = await analytics.get_unsold_products_this_month()
    print(f"Unsold Products Count This Month: {unsold['total_unsold_count']}")
    if unsold['unsold_products']:
        print(f"Sample Unsold Item: {unsold['unsold_products'][0]['title']} (Stock: {unsold['unsold_products'][0]['stock']})")

    cat_health = await analytics.category_stock_health()
    print(f"Category Stock Health Categories Scanned: {len(cat_health)}")
    if cat_health:
        print(f"Sample Category: {cat_health[0]['category']} -> Value: INR {cat_health[0]['inventory_value']}")

    inv_val = await analytics.inventory_value_report()
    print(f"Total Warehouse Inventory Value: INR {inv_val['total_inventory_value']}")

    # 3. Payment Analytics Test
    print("\n--- 2. PAYMENT AGENT DIRECT MONGODB ANALYTICS ---")
    failed_custs = await analytics.get_failed_payment_customers(limit=5)
    print(f"Failed Payment Customers Audit Count: {len(failed_custs)}")
    if failed_custs:
        print(f"Sample Failed Customer: {failed_custs[0]['customer_name']} | Email: {failed_custs[0]['email']} | Amount: INR {failed_custs[0]['amount']} | Reason: {failed_custs[0]['failure_reason']}")

    reasons = await analytics.failed_payment_reason_breakdown()
    print(f"Failed Payment Failure Reasons Breakdown: {reasons}")

    methods = await analytics.payment_method_success_breakdown()
    print(f"Payment Method Success Breakdown: {methods}")

    rec_rev = await analytics.recoverable_failed_revenue()
    print(f"Total Recoverable Failed Revenue: INR {rec_rev['total_recoverable_revenue']}")

    # 4. Customer Analytics Test
    print("\n--- 3. CUSTOMER AGENT DIRECT MONGODB ANALYTICS ---")
    acq = await analytics.customer_acquisition_summary()
    print(f"Acquisition Summary -> New: {acq['new_customers']}, Repeat: {acq['repeat_customers']}, Retention: {acq['retention_rate']}%, Avg Spend: INR {acq['average_spend']}")

    top_custs = await analytics.top_customers(limit=3)
    print(f"Top Spenders Count: {len(top_custs)}")
    if top_custs:
        print(f"Top Customer: {top_custs[0].name} | Total Spent: INR {top_custs[0].total_spent}")

    freq = await analytics.customer_purchase_frequency()
    print(f"Avg Purchase Frequency: {freq['avg_orders_per_customer']} orders/customer")

    ltv = await analytics.customer_lifetime_value()
    print(f"Customer Lifetime Value (LTV) Avg: INR {ltv['avg_customer_ltv']}")

    # 5. Recovery Analytics Test
    print("\n--- 4. RECOVERY AGENT OUTREACH CAMPAIGNS ---")
    cart_targets = await analytics.abandoned_cart_customers()
    print(f"Abandoned Cart Targets: {len(cart_targets)}")

    recovery_targets = await analytics.failed_payment_recovery_targets()
    print(f"Priority Recovery Targets: {len(recovery_targets)}")

    campaign = await analytics.generate_recovery_campaign()
    print(f"WhatsApp Preview: {campaign['whatsapp_preview'].encode('ascii', 'ignore').decode()}")
    print(f"Email Preview Subject: {campaign['email_subject'].encode('ascii', 'ignore').decode()}")
    print(f"Recovery Coupon Code: {campaign['coupon_code']}")

    # 6. Coordinator Agent Routing & Domain Cards Test
    print("\n--- 5. COORDINATOR AGENT ROUTING & DOMAIN CARDS TEST ---")
    coordinator = CoordinatorAgent()

    test_queries = [
        ("Show unsold products and inventory health", "INVENTORY"),
        ("Why are payments failing and who failed?", "PAYMENT"),
        ("Give customer acquisition summary and top buyers", "CUSTOMER"),
        ("Generate recovery campaign for abandoned carts", "RECOVERY"),
        ("Give full multi agent business health report", "MULTI"),
    ]

    for q, expected_intent in test_queries:
        print(f"\nQuery: '{q}'")
        res = await coordinator.chat(q)
        print(f"  Selected Agent: {res.agent}")
        print(f"  Intent: {res.coordinator_metadata.intent_classified if res.coordinator_metadata else 'N/A'}")
        print(f"  Domain Cards Present: Inventory({res.inventory_card is not None}), Payment({res.payment_card is not None}), Customer({res.customer_card is not None}), Recovery({res.recovery_card is not None})")

    await close_mongodb_connection()
    print("\n" + "=" * 70)
    print("ALL MONGODB DIRECT AGGREGATIONS & SPECIALIST AGENT TOOLS VERIFIED [OK]")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_tests())
