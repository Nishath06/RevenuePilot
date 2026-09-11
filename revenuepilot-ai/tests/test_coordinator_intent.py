"""
RevenuePilot Day 2 Patch — Multi-Agent Intent Classification Unit & Integration Tests
Tests intent classification, agent selection, confidence rules, and mixed intent routing.
"""
import pytest
from app.agents.coordinator import classify_intent, CoordinatorAgent


def test_inventory_intent_classification():
    inventory_queries = [
        "Which products have zero sales this month?",
        "Show products with no sales.",
        "Unsold products this month.",
        "Show low stock products.",
        "Which products are out of stock?",
        "Inventory health.",
        "Best selling products.",
        "Slow selling products.",
        "Category-wise sales.",
        "Which SKU sold the least?",
        "Show inventory alerts.",
        "Which products need restocking?",
        "Show unsold products.",
        "Inventory health summary.",
        "Show out-of-stock products.",
    ]

    for q in inventory_queries:
        res = classify_intent(q)
        assert res["selected_agent"] == "Inventory Agent", f"Failed for query '{q}': got {res['selected_agent']}"
        assert res["intent"] in ["inventory_analysis", "INVENTORY"], f"Failed intent for query '{q}': got {res['intent']}"
        assert res["confidence"] >= 0.90, f"Confidence too low for query '{q}': {res['confidence']}"
        assert len(res["matched_keywords"]) > 0, f"No matched keywords for query '{q}'"
        assert res["selected_agent"] != "Revenue Agent", f"Inventory query '{q}' incorrectly executed Revenue Agent!"


def test_payment_intent_classification():
    payment_queries = [
        "Failed payments today.",
        "Payment failures.",
        "Payment success rate.",
        "Razorpay breakdown.",
        "UPI vs Card payments.",
        "Netbanking success rate.",
        "Refund summary.",
        "Transaction failures.",
    ]

    for q in payment_queries:
        res = classify_intent(q)
        assert res["selected_agent"] == "Payment Agent", f"Failed for query '{q}': got {res['selected_agent']}"
        assert res["intent"] in ["payment_analysis", "PAYMENT"]
        assert res["confidence"] >= 0.90


def test_revenue_intent_classification():
    revenue_queries = [
        "Today's revenue.",
        "Weekly sales.",
        "Monthly revenue.",
        "Revenue growth.",
        "Compare today vs yesterday.",
        "Average order value.",
        "Revenue summary.",
        "Revenue trend.",
    ]

    for q in revenue_queries:
        res = classify_intent(q)
        assert res["selected_agent"] == "Revenue Agent", f"Failed for query '{q}': got {res['selected_agent']}"
        assert res["intent"] in ["revenue_analysis", "REVENUE"]
        assert res["confidence"] >= 0.90


def test_recovery_intent_classification():
    recovery_queries = [
        "Abandoned carts.",
        "Recovery campaign.",
        "Retry failed payments.",
        "Payment recovery.",
        "WhatsApp reminders.",
        "Email reminders.",
        "Lost revenue opportunities.",
    ]

    for q in recovery_queries:
        res = classify_intent(q)
        assert res["selected_agent"] == "Recovery Agent", f"Failed for query '{q}': got {res['selected_agent']}"
        assert res["intent"] in ["recovery_analysis", "RECOVERY"]
        assert res["confidence"] >= 0.90


def test_customer_intent_classification():
    customer_queries = [
        "Top customers.",
        "Repeat customers.",
        "Inactive customers.",
        "Customer acquisition.",
        "Retention report.",
        "Loyalty customers.",
    ]

    for q in customer_queries:
        res = classify_intent(q)
        assert res["selected_agent"] == "Customer Agent", f"Failed for query '{q}': got {res['selected_agent']}"
        assert res["intent"] in ["customer_analysis", "CUSTOMER"]
        assert res["confidence"] >= 0.90


def test_mixed_intent_detection():
    mixed_query = "Why is today's revenue low and which failed payments affected it?"
    res = classify_intent(mixed_query)
    
    assert res["selected_agent"] == "Multi-Agent Coordinator"
    assert res["intent"] in ["multi_agent_analysis", "MULTI"]
    assert res["confidence"] >= 0.95
    assert len(res["detected_intents"]) >= 2
    assert "revenue_analysis" in res["detected_intents"]
    assert "payment_analysis" in res["detected_intents"]


@pytest.mark.asyncio
async def test_coordinator_chat_execution_timeline():
    from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
    await connect_to_mongodb()
    
    coordinator = CoordinatorAgent()
    mixed_query = "Why is today's revenue low and which failed payments affected it?"
    chat_res = await coordinator.chat(mixed_query)
    
    assert chat_res.success is True
    assert chat_res.agent == "Multi-Agent Coordinator"
    assert chat_res.answer is not None
    assert "Execution Timeline" in chat_res.answer or "Multi-Agent Execution Timeline" in chat_res.answer
    assert chat_res.coordinator_metadata is not None
    assert chat_res.coordinator_metadata.confidence is not None

    await close_mongodb_connection()
