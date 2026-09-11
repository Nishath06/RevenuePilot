# RevenuePilot AI 🚀

> **Enterprise-grade AI Revenue Intelligence Microservice for Razorpay-powered e-commerce stores.**

RevenuePilot AI is Day 2 of the RevenuePilot Buildathon — a production-ready FastAPI microservice that connects to your live MongoDB data and answers natural language merchant questions using a multi-agent AI system powered by Agno.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Merchant Dashboard (Port 3000)              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RevenuePilot AI (Port 8001)                    │
│                                                                 │
│  ┌──────────────┐    ┌───────────────────────────────────────┐  │
│  │  FastAPI App │    │         Coordinator Agent             │  │
│  │  + CORS      │───▶│  Intent Classification → Routing      │  │
│  │  + Auth      │    │                                       │  │
│  └──────────────┘    │  ┌─────────┐  ┌─────────┐            │  │
│                      │  │Revenue  │  │Payment  │            │  │
│  ┌──────────────┐    │  │Agent    │  │Agent    │            │  │
│  │  Insights API│    │  └─────────┘  └─────────┘            │  │
│  │  Merchant API│    │  ┌─────────┐  ┌─────────┐            │  │
│  │  Chat API    │    │  │Inventory│  │Recovery │            │  │
│  │  Health API  │    │  │Agent    │  │Agent    │            │  │
│  └──────────────┘    │  └─────────┘  └─────────┘            │  │
│                      └───────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Analytics Service (MongoDB Aggregations)               │   │
│  │  Revenue │ Orders │ Payments │ Inventory │ Customers    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               MongoDB: revenuepilot_store                       │
│  users │ products │ orders │ payments │ carts │ webhook_events  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
revenuepilot-ai/
│
├── app/
│   ├── api/               # FastAPI route handlers
│   │   ├── chat.py        # POST /chat
│   │   ├── insights.py    # GET /insights/*
│   │   ├── merchant.py    # GET /merchant/*
│   │   └── health.py      # GET /health
│   │
│   ├── agents/            # Agno multi-agent system
│   │   ├── coordinator.py # Intent classifier + router
│   │   ├── revenue_agent.py
│   │   ├── payment_agent.py
│   │   ├── inventory_agent.py
│   │   └── recovery_agent.py
│   │
│   ├── tools/             # Agno toolkits (MongoDB-backed)
│   │   ├── revenue_tools.py
│   │   ├── payment_tools.py
│   │   ├── inventory_tools.py
│   │   ├── customer_tools.py
│   │   └── recommendation_tools.py
│   │
│   ├── services/          # Business logic layer
│   │   ├── analytics.py   # All MongoDB aggregations
│   │   ├── merchant_service.py
│   │   └── cache.py       # In-memory TTL cache
│   │
│   ├── db/
│   │   └── mongodb.py     # Async Motor connection + health check
│   │
│   ├── prompts/           # AI system prompts
│   ├── models/            # Pydantic schemas
│   ├── core/              # Config, logging, security
│   ├── middleware/        # Request timer
│   └── main.py
│
├── tests/
│   └── test_api.py        # Full integration test suite
│
├── Dockerfile
├── requirements.txt
├── pytest.ini
└── .env.example
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URL` | ✅ | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | ✅ | `revenuepilot_store` | Must match the store DB |
| `OPENAI_API_KEY` | ⚠️ | — | Required for AI narration; service runs in data-only mode without it |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | OpenAI model for agents |
| `API_SECRET_KEY` | — | empty (disabled) | `X-API-Key` header value |
| `JWT_SECRET` | — | same as store | Cross-service auth |
| `ENVIRONMENT` | — | `development` | `development` or `production` |
| `PORT` | — | `8001` | Service port |
| `CACHE_TTL_SECONDS` | — | `300` | Analytics cache TTL |

---

## Quick Start

### 1. Local Development

```bash
# Navigate to the AI service directory
cd revenuepilot-ai

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
copy .env.example .env
# Edit .env: add your MONGODB_URL and OPENAI_API_KEY

# Start the service
uvicorn app.main:app --reload --port 8001
```

Service starts at: **http://localhost:8001**
API Docs: **http://localhost:8001/docs**

### 2. Docker

```bash
# Build image
docker build -t revenuepilot-ai:latest .

# Run container
docker run -d \
  --name revenuepilot-ai \
  -p 8001:8001 \
  -e MONGODB_URL=mongodb://host.docker.internal:27017 \
  -e OPENAI_API_KEY=sk-your-key \
  revenuepilot-ai:latest
```

### 3. Run Tests

```bash
# Ensure MongoDB is running
pytest tests/ -v
```

---

## API Documentation

### Chat

```http
POST /chat
Content-Type: application/json

{
  "message": "What is today's revenue?"
}
```

**Response:**
```json
{
  "agent": "Revenue Agent",
  "answer": "Today's revenue is ₹24,530 from 18 paid orders...",
  "metrics": {
    "today_revenue": 24530.0,
    "growth_percentage": 14.5,
    "paid_orders": 18,
    "payment_success_rate": 94.2
  },
  "recommendations": [
    "Revenue increased because laptop sales doubled today."
  ],
  "execution_time_ms": 1234.56
}
```

### Insights

| Endpoint | Description |
|---|---|
| `GET /insights/today` | Today's full KPI summary |
| `GET /insights/week` | Weekly revenue and orders |
| `GET /insights/month` | Monthly performance |
| `GET /insights/payments` | Razorpay payment analytics |
| `GET /insights/inventory` | Stock and product intelligence |
| `GET /insights/customers` | Customer behavior metrics |

### Merchant

| Endpoint | Description |
|---|---|
| `GET /merchant/prompts` | Suggested question chips for dashboard |
| `GET /merchant/recovery` | Abandoned carts + failed payment recovery |
| `GET /merchant/snapshot` | Full dashboard KPI snapshot |

### Health

```http
GET /health

{
  "status": "healthy",
  "mongodb": "connected",
  "ai_ready": true,
  "version": "1.0.0",
  "environment": "development",
  "uptime_seconds": 142.3
}
```

---

## Multi-Agent System

The coordinator uses **intent classification** to route questions to specialist agents:

| Agent | Handles |
|---|---|
| **Revenue Agent** | Revenue, growth, AOV, sales trends |
| **Payment Agent** | Razorpay success/failure, method breakdown |
| **Inventory Agent** | Stock levels, bestsellers, category revenue |
| **Recovery Agent** | Abandoned carts, failed payments, win-back messages |

**Fallback Mode**: If no `OPENAI_API_KEY` is configured, the service operates in data-only mode — returning live MongoDB metrics without AI narration.

---

## Future Roadmap (Day 3+)

- [ ] LangGraph stateful conversation flows
- [ ] Kafka event streaming for real-time alerts
- [ ] Kubernetes deployment with HPA
- [ ] Redis distributed cache
- [ ] Prometheus metrics + Grafana dashboard
- [ ] Webhook-triggered recovery campaigns
- [ ] Revenue forecasting with time-series ML
- [ ] Multi-tenant merchant isolation

---

## Built With

- **FastAPI** — High-performance async web framework
- **Agno** — Multi-agent AI framework
- **Motor** — Async MongoDB driver
- **Pydantic** — Data validation and settings
- **Structlog** — Structured production logging
- **Docker** — Container runtime
