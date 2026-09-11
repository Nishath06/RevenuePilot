# RevenuePilot v4.0 — Autonomous Recovery Intelligence Agent

## Implementation Summary

### Status: ✅ Production-Ready (38/38 tests passing)

---

## Architecture

```
EventBridge Cron (every 6h)
        ↓
RecoveryIntelligenceAgent.run()
        ↓ (batches of 25, parallel)
  ┌─────────────────────────────────────────────────┐
  │  Per-Customer Pipeline                          │
  │  compute_customer_features() → DB queries        │
  │  assign_segment() → VIP/LOYAL/NEW/AT_RISK etc.  │
  │  build_recovery_prompt() → structured JSON       │
  │  _call_llm() → Gemini/Grok/OpenAI / Local Sim   │
  │  score_candidate() → RecoveryCandidate           │
  └─────────────────────────────────────────────────┘
        ↓
RecoveryCandidateRepository.upsert_candidates()
        ↓
MongoDB: recovery_candidates (status=APPROVED)
        ↓
POST /automation/recovery/run-approved
        ↓
RecoveryLambda (UNCHANGED — execution only)
        ↓
    SES Email + SNS SMS
        ↓
CloudWatch Metrics + EventBridge Events
```

---

## Files Created / Modified

| File | Status | Description |
|------|--------|-------------|
| `app/services/recovery_intelligence_agent.py` | ✅ NEW | Main AI orchestration agent |
| `app/services/recovery_scoring.py` | ✅ NEW | Feature engineering, segmentation, scoring |
| `app/services/recovery_prompt_builder.py` | ✅ NEW | LLM prompt construction (versioned) |
| `app/services/recovery_candidate_repository.py` | ✅ NEW | MongoDB CRUD for `recovery_candidates` |
| `app/api/automation.py` | ✅ EXTENDED | 8 new Recovery AI endpoints appended |
| `aws_lambda/recovery_lambda.py` | ✅ PRESERVED | Unchanged — reads APPROVED candidates |
| `.env` | ✅ UPDATED | Recovery AI config vars added |
| `tests/test_recovery_ai.py` | ✅ NEW | 38-test comprehensive suite |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/automation/recovery/analyze` | Run AI agent now — analyze all customers |
| `POST` | `/automation/recovery/run-approved` | Invoke RecoveryLambda for APPROVED candidates |
| `GET` | `/automation/recovery/candidates` | List AI candidates (filterable by status) |
| `GET` | `/automation/recovery/history` | Campaign dispatch history |
| `GET` | `/automation/recovery/insights` | AI dashboard: revenue, scores, segments |
| `GET` | `/automation/recovery/analytics` | Alias for /insights |
| `POST` | `/automation/recovery/approve/{id}` | Manually approve a PENDING candidate |
| `POST` | `/automation/recovery/skip/{id}` | Skip a candidate |

---

## Scoring Thresholds

| Score Range | Priority | Action |
|-------------|----------|--------|
| 90–100 | **CRITICAL** | Immediate dispatch, 20% discount |
| 75–89 | **HIGH** | Scheduled dispatch, 15% discount |
| 60–74 | **MEDIUM** | Next batch dispatch, 10% discount |
| < 60 | **IGNORE** | No candidate created |

---

## Score Boost Rules

| Signal | Boost |
|--------|-------|
| Cart value > ₹5,000 | +5 |
| Failure type = GATEWAY_TIMEOUT | +3 |
| Previous recovery success > 0 | +4 |

---

## Coupon Intelligence

| Segment | LTV Threshold | Discount |
|---------|---------------|----------|
| CRITICAL recovery (score ≥ 90) | any | **20%** (cap) |
| VIP | > ₹5,000 | **15%** |
| LOYAL / HIGH_VALUE | > ₹2,500 | **10%** |
| NEW | any | **5%** |
| Default | any | **10%** |

Coupons are single-use, expire in 24h, stored with `expires_at` timestamp.

---

## Customer Segments

| Segment | Criteria |
|---------|----------|
| VIP | LTV > ₹50,000 |
| LOYAL | LTV > ₹20,000, orders ≥ 5 |
| NEW | 0 successful orders |
| CHURN_RISK | LTV > 0, days since purchase > 90 |
| AT_RISK | Days since purchase > 30 |
| HIGH_VALUE | LTV > ₹10,000 |
| PRICE_SENSITIVE | Coupon usage rate > 50% |

---

## LLM Integration

- **Primary:** Gemini (via existing `GeminiProvider`) — zero extra dependencies
- **Fallback:** Deterministic local simulation (always works offline)
- **Retry:** Up to 2 retries on malformed JSON, then falls back to simulation
- **Batch size:** 25 customers processed in parallel per batch
- **Cache:** Skips customers already analyzed within `RECOVERY_AGENT_CACHE_HOURS`

---

## MongoDB Schema: `recovery_candidates`

```json
{
  "candidate_id": "cand_abc123def4",
  "customer_id": "cust_001",
  "merchant_id": "merch_default",
  "order_id": "ord_xyz789",
  "customer_name": "Rohan Sharma",
  "customer_email": "rohan@example.com",
  "customer_phone": "+919876543210",
  "recovery_score": 92.3,
  "confidence": 0.973,
  "priority": "CRITICAL",
  "recoverable_revenue": 4999.0,
  "recommended_discount": 20,
  "coupon_code": "RP20_A3F1",
  "recommended_channel": "EMAIL+SMS",
  "reasoning": "Gateway timeout on high-value cart...",
  "email_subject": "Your cart is waiting — 20% off just for you",
  "email_body_html": "<p>Hi Rohan...</p>",
  "email_body_text": "Hi Rohan...",
  "sms_message": "RevenuePilot: Use RP20_A3F1 for 20% OFF!",
  "whatsapp_message": "👋 Hey Rohan! Your cart ₹4,999 is saved...",
  "segment": "HIGH_VALUE",
  "llm_model": "gemini-3.5-flash",
  "status": "APPROVED",
  "created_at": "2026-09-02T01:25:00Z",
  "expires_at": "2026-09-03T01:25:00Z",
  "scheduled_send_time": "18:30 IST",
  "trace_id": "trace_ria_abc123"
}
```

---

## CloudWatch Metrics Published

Namespace: `RevenuePilot/RecoveryAI`

| Metric | Unit |
|--------|------|
| `CustomersAnalyzed` | Count |
| `CandidatesApproved` | Count |
| `RecoverableRevenue` | None |
| `CouponGenerated` | Count |
| `AverageLLMLatency` | None (ms) |

---

## Test Coverage: 38/38 Passed ✅

| Test Class | Tests | Coverage |
|------------|-------|----------|
| `TestSegmentation` | 7 | All 7 segments |
| `TestCouponGeneration` | 7 | Rules, format, expiry |
| `TestRecoveryScoring` | 8 | All priority levels, boosts |
| `TestPromptBuilder` | 5 | Structure, fields, version |
| `TestLLMResponseValidation` | 4 | Schema, malformed fallback |
| `TestCandidateRepository` | 2 | Upsert, analytics |
| `TestLocalSimulation` | 4 | All message formats |
| `TestAgentEndToEnd` | 1 | Full pipeline mock |

---

## Environment Variables

```bash
RECOVERY_AGENT_BATCH_SIZE=25       # Customers per LLM batch
RECOVERY_AGENT_SCORE_THRESHOLD=60  # Minimum score to create candidate
RECOVERY_AGENT_CRON=6h             # How often agent runs
RECOVERY_AGENT_CACHE_HOURS=6       # Skip re-analysis within this window
```

---

> **Architecture Decision:** RecoveryLambda was intentionally left unchanged.
> It reads `status=APPROVED` candidates from MongoDB and executes dispatch.
> All intelligence — scoring, LLM, segmentation, coupon generation — lives exclusively
> in the AI Agent layer. This gives a clean separation: **AI decides, Lambda executes.**
