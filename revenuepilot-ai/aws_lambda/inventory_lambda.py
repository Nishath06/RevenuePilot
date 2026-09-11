"""
RevenuePilot AWS Lambda — InventoryLambda (v3.0 Refactored)
Handles automated inventory scans, stock velocity calculation, stockout alerts,
inventory reorder recommendations, and EventBridge scan completion publishing.
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from aws_lambda.utils.aws_lambda_base import (
    get_database,
    serialize_bson,
    publish_eventbridge_event,
    handle_lambda_exceptions,
    config,
    logger
)


def calculate_stock_velocity(product: Dict[str, Any]) -> float:
    """Calculates daily sales velocity for inventory forecasting."""
    sales = float(product.get("sales") or product.get("units_sold") or 0)
    monthly_sales = float(product.get("monthly_sales") or (sales / 3.0))
    daily_velocity = round(monthly_sales / 30.0, 2)
    return max(0.01, daily_velocity)


@handle_lambda_exceptions("InventoryLambda")
def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    AWS Lambda entry point for Inventory Processing & Stock Intelligence.
    Reads products from MongoDB Atlas or payload, calculates stock velocity,
    forecasts stockout dates, performs bulk recommendation updates, and dispatches EventBridge alert events.
    """
    db = get_database()
    merchant_id = event.get("merchant_id", "merch_default") if isinstance(event, dict) else "merch_default"
    trace_id = event.get("trace_id") if isinstance(event, dict) else None
    if not trace_id and context and hasattr(context, "aws_request_id"):
        trace_id = context.aws_request_id

    # 1. Fetch products from MongoDB Atlas if items not directly provided in event
    items_input = event.get("items") if isinstance(event, dict) else None
    products: List[Dict[str, Any]] = []

    if items_input and isinstance(items_input, list) and len(items_input) > 0:
        products = items_input
    elif db is not None:
        try:
            # Query products with merchant isolation and non-deleted filter
            prod_query: Dict[str, Any] = {
                "$or": [{"is_deleted": {"$ne": True}}, {"is_deleted": {"$exists": False}}]
            }
            if merchant_id and merchant_id != "all":
                prod_query["merchant_id"] = merchant_id

            cursor = db.products.find(prod_query, {"_id": 0}).limit(500)
            products = list(cursor)
        except Exception as err:
            logger.warning(f"[InventoryLambda] PyMongo fetch failed: {err}")

    low_stock_threshold = int(event.get("low_stock_threshold") or config.low_stock_threshold)
    low_stock_items: List[Dict[str, Any]] = []
    out_of_stock_items: List[Dict[str, Any]] = []
    recommendations: List[Dict[str, Any]] = []
    processed_count = 0
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()

    # 2. Process products & calculate stock velocity and forecast stockout date
    for p in products:
        if not isinstance(p, dict):
            continue
        processed_count += 1
        sku = p.get("sku") or p.get("product_id") or f"SKU-{processed_count}"
        name = p.get("name") or p.get("title") or "Unnamed Product"
        try:
            stock = int(p.get("stock") if p.get("stock") is not None else 0)
        except (ValueError, TypeError):
            stock = 0

        price = float(p.get("price") or 0.0)
        velocity = calculate_stock_velocity(p)
        days_until_stockout = round(stock / velocity, 1) if velocity > 0 else 999.0
        
        # Forecast estimated stockout date
        estimated_stockout_dt = now_dt + timedelta(days=min(365, days_until_stockout))
        estimated_stockout_date = estimated_stockout_dt.strftime("%Y-%m-%d")

        item_detail = {
            "sku": sku,
            "product_id": p.get("product_id", sku),
            "name": name,
            "stock": stock,
            "price": price,
            "daily_velocity": velocity,
            "days_until_stockout": days_until_stockout,
            "estimated_stockout_date": estimated_stockout_date,
            "merchant_id": p.get("merchant_id", merchant_id)
        }

        if stock == 0:
            item_detail["status"] = "OUT_OF_STOCK"
            out_of_stock_items.append(item_detail)
            recommendations.append({
                "recommendation_id": f"rec_out_{sku}",
                "type": "URGENT_RESTOCK",
                "product_id": p.get("product_id", sku),
                "sku": sku,
                "merchant_id": p.get("merchant_id", merchant_id),
                "title": f"Urgent Reorder Required: {name}",
                "description": f"Product {name} ({sku}) is OUT OF STOCK. Estimated lost revenue per day: ₹{round(velocity * price, 2)}",
                "suggested_reorder_qty": max(50, int(velocity * 30)),
                "priority": "CRITICAL",
                "days_until_stockout": 0.0,
                "estimated_stockout_date": now_dt.strftime("%Y-%m-%d"),
                "status": "OPEN",
                "created_at": now_iso,
                "updated_at": now_iso
            })
        elif stock <= low_stock_threshold:
            item_detail["status"] = "LOW_STOCK"
            low_stock_items.append(item_detail)
            recommendations.append({
                "recommendation_id": f"rec_low_{sku}",
                "type": "SAFETY_RESTOCK",
                "product_id": p.get("product_id", sku),
                "sku": sku,
                "merchant_id": p.get("merchant_id", merchant_id),
                "title": f"Low Stock Warning: {name}",
                "description": f"Stock ({stock}) below threshold ({low_stock_threshold}). Days until stockout: {days_until_stockout}",
                "suggested_reorder_qty": max(25, int(velocity * 20)),
                "priority": "HIGH",
                "days_until_stockout": days_until_stockout,
                "estimated_stockout_date": estimated_stockout_date,
                "status": "OPEN",
                "created_at": now_iso,
                "updated_at": now_iso
            })

    # 3. Save recommendations to MongoDB using bulk writes or upsert updates
    if db is not None and recommendations:
        try:
            for rec in recommendations:
                db.recommendations.update_one(
                    {"recommendation_id": rec["recommendation_id"]},
                    {"$set": rec},
                    upsert=True
                )
        except Exception as err:
            logger.warning(f"[InventoryLambda] Failed to save recommendations to Mongo: {err}")

    # 4. Prepare execution payload
    execution_result = {
        "status": "SUCCESS",
        "function_name": "InventoryLambda",
        "merchant_id": merchant_id,
        "trace_id": trace_id,
        "processed_count": processed_count,
        "low_stock_count": len(low_stock_items),
        "out_of_stock_count": len(out_of_stock_items),
        "low_stock_items": len(low_stock_items),      # Backward compatibility requirement
        "out_of_stock_items": len(out_of_stock_items),  # Backward compatibility requirement
        "low_stock_list": low_stock_items[:10],
        "out_of_stock_list": out_of_stock_items[:10],
        "recommendations_generated": len(recommendations),
        "timestamp": now_iso
    }

    # 5. Emit EventBridge event if low/out of stock anomalies found
    if low_stock_items or out_of_stock_items:
        publish_eventbridge_event(
            db=db,
            event_type="INVENTORY_SCAN_COMPLETED",
            detail=execution_result,
            source="revenuepilot.inventory.lambda",
            merchant_id=merchant_id,
            trace_id=trace_id
        )

    return {
        "statusCode": 200,
        "body": json.dumps(execution_result)
    }
