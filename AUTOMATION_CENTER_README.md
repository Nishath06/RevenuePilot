# ⚡ RevenuePilot AutoOps Control Center — Complete Technical Architecture & Operations Guide

Welcome to the **RevenuePilot AutoOps Control Center** documentation. This guide details the A-to-Z architecture, multi-layer service configuration, cloud integrations, feature set, and operational setup required for the autonomous merchant automation system.

---

## 1. Executive Summary & Core Purpose

The **AutoOps Control Center** is the autonomous orchestration engine of RevenuePilot. It monitors live merchant events (payment failures, inventory drops, revenue anomalies, checkout abandonments), evaluates rule-based decision trees, and executes multi-stage recovery actions across local microservices and AWS Cloud infrastructure.

### Key Capabilities:
- **Event-Driven Automation Engine**: Evaluates rules against live payloads with GT/LT/EQ operators.
- **Dual-Mode Cloud Integration**: Runs seamlessly in **AWS Connected Mode** (EventBridge, SNS, Lambda, S3, CloudWatch) or **Local Fallback Mode** (In-memory simulation & local file fallback).
- **Merchant Health Score Engine**: Calculates a composite 0–100 index evaluating revenue growth, payment approval rates, inventory safety, and infrastructure performance.
- **Automated Report Generation**: Exports operational data to **CSV**, **JSON**, and **PDF** stored in Amazon S3 or local disk.
- **Developer & Demo Tools**: Includes a live test event generator and a 90-day production store seeding engine.

---

## 2. End-to-End System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      MERCHANT OPERATIONS CENTER (React/Vite)                     │
│                        (http://localhost:3001 or 3002)                           │
│     [AutomationCenter.tsx]  [ReportsCenter.tsx]  [TopNav.tsx]  [api.ts]           │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ REST API / CORS
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         REVENUEPILOT AI ENGINE (FastAPI)                         │
│                               (http://localhost:8001)                            │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐               │
│  │ automation.py (API Router)  │  │ automation_engine.py       │               │
│  └──────────────┬──────────────┘  └──────────────┬──────────────┘               │
│                 │                                │                              │
│                 ▼                                ▼                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐               │
│  │ watchdog_service.py         │  │ reports_service.py          │               │
│  └──────────────┬──────────────┘  └──────────────┬──────────────┘               │
│                 │                                │                              │
│                 ▼                                ▼                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐               │
│  │ devops_service.py           │  │ cloud_event_bus.py          │               │
│  └─────────────────────────────┘  └──────────────┬──────────────┘               │
└──────────────────────────────────────────────────┼───────────────────────────────┘
                                                   │
                         ┌─────────────────────────┴────────────────────────┐
                         │                                                  │
                         ▼                                                  ▼
      ┌────────────────────────────────────┐             ┌────────────────────────────────────┐
      │          MONGODB DATABASE          │             │         AWS CLOUD ECOSYSTEM        │
      │       (revenuepilot_store)         │             │    (AWS_MODE=Cloud or Local)       │
      │ ─── ─── ─── ─── ─── ─── ─── ─── ─── │             │ ─── ─── ─── ─── ─── ─── ─── ─── ─── │
      │ • rules                            │             │ • EventBridge (revenuepilot-bus)   │
      │ • events                           │             │ • SNS Topics (payments/inventory)  │
      │ • execution_history                │             │ • Lambda (RecoveryLambda/Reports) │
      │ • incidents                        │             │ • S3 Bucket (revenuepilot-reports) │
      │ • aws_audit_logs                   │             │ • CloudWatch Logs & Metrics        │
      │ • reports & generated_reports      │             └────────────────────────────────────┘
      └────────────────────────────────────┘
```

---

## 3. A-to-Z Feature Breakdown & Functionality

### 1. Automation Rules Engine (`Tab: rules`)
- **Prebuilt & Custom Rules**: Enables/disables rules dynamically via MongoDB state toggle.
- **Supported Triggers**:
  - `PAYMENT_FAILED`: Triggered on payment gateways decline or timeout.
  - `LOW_STOCK`: Triggered when product stock drops below threshold (e.g. $\le 5$).
  - `REVENUE_DROP`: Triggered when 24h revenue drops by $>20\%$.
  - `ABANDONED_CART`: Triggered on uncompleted checkout sessions.
  - `REPEAT_CUSTOMER`: Triggered when customer completes $>3$ orders.
- **Condition Evaluators**: Supports `gt` (greater than), `lt` (less than), `eq` (equal), and `contains` operators on payload fields.
- **Action Dispatcher**: Executes multi-actions including incident creation, coupon generation (`RECOVER10`), SMS/WhatsApp queueing, SNS topic publishing, and AWS Lambda invocation.

### 2. Workflow Builder (`Tab: builder`)
- Visual 3-stage node workflow: **Event Trigger** $\rightarrow$ **Payload Condition** $\rightarrow$ **Multi-Actions Execution**.
- Integrated with n8n workflow pipeline representation.

### 3. Business Health Score Engine (`Tab: health_score`)
- Calculates a real-time composite score ($0-100$) broken down into 5 components:
  1. **Revenue Growth Index** (Max 25 pts)
  2. **Payment Gateway Approval Rate** (Max 25 pts)
  3. **Inventory & SKU Health** (Max 20 pts)
  4. **Recovery Campaign Efficiency** (Max 15 pts)
  5. **System & Infrastructure SLA** (Max 15 pts)

### 4. CloudWatch Observability & Latency Percentiles (`Tab: observability`)
- Renders live system throughput metrics: Requests/min, Webhook Latency (ms), MongoDB Query Latency (ms), Recovery Success Rate (%).
- Integrates interactive **Recharts** trend charts.

### 5. Infrastructure System Topology (`Tab: topology`)
- Node connectivity graph showing operational statuses and latencies across Storefront, Merchant Portal, AI Microservice, Store Backend, MongoDB, Razorpay Gateway, and AWS EventBridge.

### 6. Live Business Event Bus Stream (`Tab: events`)
- Real-time sub-second audit stream of all incoming events published to the EventBus queue.

### 7. Execution Audit Trail (`Tab: history`)
- Immutable log recording `execution_id`, `rule_name`, `trigger`, execution `duration_ms`, and ISO timestamp.

### 8. DevOps Compliance & Audit Logs (`Tab: audit_logs`)
- Tracks actor actions, resource modifications, trace IDs, and request latency for security auditing.

### 9. Operational Report Generator (`Tab: reports`)
- Generates on-demand reports across 6 domains: **Revenue**, **Payment Audit**, **Inventory**, **Customer LTV**, **Recovery**, and **Security**.
- Export formats: **CSV Spreadsheet**, **JSON Stream**, and **PDF / Formatted Text**.
- Uploads files to AWS S3 (`revenuepilot-reports`) with presigned download links or local HTTP fallback endpoints.

### 10. CI/CD & Kubernetes Status (`Tab: cicd`)
- Displays GitHub Actions build pipeline status, Docker image registry tags (`revenuepilot-ai:v2.6.0`), Kubernetes pod health (`ap-south-1`), and Terraform state sync status.

### 11. Security Audit & Latency SLA (`Tab: security`)
- Displays security compliance parameters: JWT validation (`HS256`), HMAC-SHA256 signature verification, Rate Limiting ($200$ req/min), and latency SLAs ($p_{50}, p_{95}, p_{99}$).

### 12. Developer Test Event Generator (`Tab: test_generator`)
- Allows developers to select event types (`PAYMENT_FAILED`, `LOW_STOCK`, `REVENUE_DROP`, etc.), customize payload attributes (customer name, amount, failure reason), and dispatch test events directly to the EventBus queue.

### 13. Demo Data Seeding Engine (`Tab: demo_data`)
- Provisions 90 days of realistic merchant data into MongoDB Atlas:
  - 120 Products, 650 Customers, 2,500 Orders, 2,500 Payments, 180 Recovery Campaigns, 700 Security Audit Logs, and 40 Historical Reports.

---

## 4. Pre-Flight Checklist & Configuration Requirements

To ensure the AutoOps Control Center functions properly without errors, verify the following configuration checklist:

### 🛠️ Configuration Checklist

| Area | Component | Verification / Requirement | Status Check Command |
| :--- | :--- | :--- | :--- |
| **Services** | Store Backend | Must run on port `8000` | `GET http://localhost:8000/api/v1/health` $\rightarrow 200\text{ OK}$ |
| **Services** | AI Engine | Must run on port `8001` | `GET http://localhost:8001/health` $\rightarrow 200\text{ OK}$ |
| **Services** | Merchant Dashboard | Runs on port `3001` or `3002` | `http://localhost:3001` or `3002` |
| **Services** | MongoDB | Local or Atlas on port `27017` | `mongodb://localhost:27017` |
| **CORS** | FastAPI Middleware | Dynamic regex matching allowed for localhost origins | `allow_origin_regex=r"https?://(localhost\|127\.0\.0\.1)(:\d+)?"` |
| **Environment**| `.env` Configuration | Correct MONGODB_URL and AWS_MODE | Check `revenuepilot-ai/.env` |
| **Database** | Demo Data | Seed collections with 90-day history | Run `python scripts/seed_production_data.py` |

---

## 5. Environment Variables Setup (`revenuepilot-ai/.env`)

Ensure the `revenuepilot-ai/.env` file is properly populated:

```env
# App Configuration
ENVIRONMENT=development
PORT=8001
DEBUG=true

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=revenuepilot_store

# AI Model Provider
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash

# Security & CORS
JWT_SECRET=supersecretjwtkey_revenuepilot_2026_hackathon
JWT_ALGORITHM=HS256

# AWS Integration (Set AWS_MODE=local for local fallback mode)
AWS_MODE=Cloud
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=revenuepilot-reports
EVENT_BUS_NAME=revenuepilot-event-bus
AWS_SNS_TOPIC_ARN_PAYMENTS=arn:aws:sns:ap-south-1:177001539059:revenuepilot-payments
AWS_SNS_TOPIC_ARN_INVENTORY=arn:aws:sns:ap-south-1:177001539059:revenuepilot-inventory
```

---

## 6. How to Run & Verify

1. **Launch All Services**:
   ```bash
   python run_local.py
   ```
2. **Seed Initial Demo Data**:
   ```bash
   cd revenuepilot-ai
   .\venv\Scripts\python.exe scripts/seed_production_data.py
   ```
3. **Access Merchant Dashboard**:
   Open browser at `http://localhost:3001` or `http://localhost:3002` and navigate to **AutoOps Control Center**.
4. **Test Report Generation**:
   Select report type (e.g. **Revenue Operations**), format (**CSV**, **JSON**, or **PDF**), click **Generate & Download**, and verify file download.
5. **Test Event Dispatch**:
   Navigate to **Developer Test Panel**, choose `PAYMENT_FAILED`, click **Emit Event to EventBus Queue**, and verify execution in **Event Bus Stream** and **Execution History**.

---
*Documentation maintained by RevenuePilot DevOps & AI Team.*
