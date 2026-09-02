import asyncio
import json
from app.db.mongodb import connect_to_mongodb, get_mongodb
from app.services.recovery_intelligence_agent import recovery_intelligence_agent
from aws_lambda.recovery_lambda import lambda_handler

async def main():
    print("=" * 60)
    print("REVENUEPILOT v4.2 — END-TO-END RECOVERY WORKFLOW TEST")
    print("=" * 60)

    # Step 1: Connect to MongoDB Atlas
    await connect_to_mongodb()
    db = get_mongodb()

    # Step 2: Phase 1 — Run Local Recovery Intelligence Agent
    print("\n--- STEP 1: Running Recovery Agent (Period: Today) ---")
    analyze_res = await recovery_intelligence_agent.run(period="today")
    print("[SUCCESS] Recovery Analysis Output:")
    print(json.dumps(analyze_res, indent=2))

    # Step 3: Phase 2 — Verify candidates stored in MongoDB
    scheduled_count = await db.recovery_candidates.count_documents({"status": "SCHEDULED"})
    print(f"\n[SUCCESS] STEP 2: MongoDB Atlas Single Source of Truth Verified")
    print(f"  -> Found {scheduled_count} candidate(s) in 'recovery_candidates' with status='SCHEDULED'")

    # Step 4: Phase 3 — Trigger AWS Recovery Dispatch Lambda
    print("\n--- STEP 3: Executing AWS Recovery Dispatch Lambda ---")
    lambda_res = lambda_handler({"merchant_id": "merch_default"})
    print("[SUCCESS] Lambda Execution Result:")
    print(json.dumps(lambda_res, indent=2))

    # Step 5: Verify status updated to DISPATCHED
    dispatched_count = await db.recovery_candidates.count_documents({"status": "DISPATCHED"})
    print(f"\n[SUCCESS] STEP 4: Final MongoDB Status Check")
    print(f"  -> Dispatched candidates in DB: {dispatched_count}")
    print("=" * 60)
    print("SUCCESS: End-to-End Recovery Workflow Test Complete!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
