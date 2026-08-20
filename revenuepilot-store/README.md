# RevenuePilot Store — Day 1 Production Foundation

[![RevenuePilot Store CI Pipeline](https://github.com/revenuepilot/store/actions/workflows/ci.yml/badge.svg)](https://github.com/revenuepilot/store/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.2+-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Motor%2FBeanie-47A248.svg?logo=mongodb)](https://www.mongodb.com)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test%20Mode-02042B.svg?logo=razorpay)](https://razorpay.com)

**RevenuePilot Store** is the customer-facing e-commerce foundation for the RevenuePilot hackathon ecosystem. It is designed to be a high-performance, production-ready REST service and interactive React storefront that handles customer shopping, persistent carts, order checkout via Razorpay Test Mode, signature verification, and idempotent webhook processing.

---

## 🏗️ Architecture Overview

```
[ Customer Browser ]
        │
        ▼
[ React 18 + Vite + Tailwind Frontend ] (Port 3000)
        │
        │ REST API calls (JWT Bearer Auth)
        ▼
[ FastAPI + Beanie ODM Backend ] (Port 8000)
   ├── Motor Async Engine
   ├── Razorpay Test Mode Integration
   ├── Webhook Signature & Idempotency Engine
   └── Merchant Telemetry & Read-Only APIs
        │
        ├──► [ MongoDB (Local / Atlas) ] (Port 27017)
        └──► [ External RevenuePilot AI Platform ] (Consumes /merchant/* APIs)
```

---

## 📁 Repository Folder Structure

```
revenuepilot-store/
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components (Navbar, Footer, ProductCard, etc.)
│   │   ├── pages/              # Store pages (Landing, Catalog, ProductDetail, Cart, Checkout, Orders, Auth, Merchant)
│   │   ├── services/           # Axios API services (auth, product, cart, checkout, merchant)
│   │   ├── store/              # Zustand state stores (cartStore, authStore)
│   │   ├── types/              # TypeScript interfaces & API types
│   │   ├── App.tsx             # React Router config & Providers
│   │   ├── main.tsx            # App Entrypoint
│   │   └── index.css           # Tailwind CSS Design System
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile              # Multi-stage Nginx production build
├── backend/
│   ├── app/
│   │   ├── api/                # Dependencies & API router setup
│   │   ├── core/               # App config, security (bcrypt, JWT), structured logging
│   │   ├── db/                 # Motor MongoDB & Beanie ODM initialization
│   │   ├── models/             # Beanie ODM models (User, Product, Cart, Order, Payment, WebhookEvent)
│   │   ├── schemas/            # Pydantic v2 validation models
│   │   ├── services/           # Business logic (Razorpay SDK, Cart sync, Auto-Seeder)
│   │   ├── routers/            # FastAPI routes (auth, products, cart, checkout, webhooks, merchant)
│   │   ├── middleware/         # Security headers & rate limiting middlewares
│   │   └── main.py             # FastAPI App definition
│   ├── requirements.txt
│   ├── pytest.ini
│   └── Dockerfile
├── tests/                      # Automated Pytest test suite
│   ├── test_auth.py
│   ├── test_products.py
│   ├── test_cart.py
│   ├── test_checkout.py
│   ├── test_razorpay.py
│   └── test_webhooks.py
├── .github/workflows/ci.yml    # GitHub Actions CI Pipeline
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔌 Complete API Specification

### Authentication Module (`/api/v1/auth`)
* `POST /api/v1/auth/register` — Register customer account (Password hashed with bcrypt, returns JWT).
* `POST /api/v1/auth/login` — Customer login (Returns JWT token).
* `GET /api/v1/auth/me` — Protected customer profile endpoint.

### Products Module (`/api/v1/products`)
* `GET /api/v1/products` — List all products with category filter and pagination.
* `GET /api/v1/products/{product_id}` — Get detailed product info.
* `GET /api/v1/products/categories` — Get list of distinct product categories.
* `GET /api/v1/products/search?q={query}` — Full-text regex search across titles, descriptions, and tags.

### Cart Module (`/api/v1/cart`)
* `GET /api/v1/cart` — Retrieve current user's persistent cart.
* `POST /api/v1/cart/items` — Add product to cart.
* `PATCH /api/v1/cart/items/{product_id}` — Update item quantity.
* `DELETE /api/v1/cart/items/{product_id}` — Remove specific item from cart.
* `DELETE /api/v1/cart` — Clear cart.

### Checkout & Orders Module (`/api/v1/checkout` & `/api/v1/orders`)
* `POST /api/v1/checkout/create-order` — Create Razorpay Test Mode order & MongoDB pending order.
* `POST /api/v1/checkout/verify-payment` — Verify Razorpay HMAC SHA256 payment signature & update order to `Paid`.
* `GET /api/v1/orders` — List authenticated user's order history.
* `GET /api/v1/orders/{order_id}` — Retrieve specific order details.

### Webhook Processing Module (`/api/v1/webhooks`)
* `POST /api/v1/webhooks/razorpay` — Razorpay webhook listener:
  * Signature verification against `RAZORPAY_WEBHOOK_SECRET`.
  * Idempotency check via `webhook_events` collection.
  * Processes `payment.captured`, `payment.failed`, and `order.paid`.

### Merchant & AI Integration APIs (`/api/v1/merchant`)
* `GET /api/v1/merchant/orders` — Read-only feed of all merchant orders.
* `GET /api/v1/merchant/payments` — Read-only feed of payment ledger records.
* `GET /api/v1/merchant/customers` — Read-only list of registered store customers.
* `GET /api/v1/merchant/revenue-summary` — Telemetry summary (Total orders, revenue, paid, failed, pending).
* `GET /api/v1/merchant/events` — Read-only log of processed webhook events.

---

## 🗄️ MongoDB Database Setup

MongoDB Community Edition runs locally on `mongodb://localhost:27017/revenuepilot_store`.

### Beanie ODM Document Collections:
1. `users` — Index: `email` (unique).
2. `products` — Index: `product_id` (unique), `category`. Automatically seeded with 10 electronics products on startup.
3. `carts` — Index: `user_id` (unique).
4. `orders` — Index: `order_id` (unique), `user_id`, `razorpay_order_id`.
5. `payments` — Index: `payment_id` (unique), `order_id`, `razorpay_payment_id`.
6. `webhook_events` — Index: `event_id` (unique, enforces event idempotency).

**Switching to MongoDB Atlas**: Change `MONGODB_URL` in `.env` or Docker environment to your MongoDB Atlas connection URI:
```env
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
```

---

## 💳 Razorpay Test Mode Setup

1. Sign up for a Razorpay Test Account at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Navigate to **Settings -> API Keys** and generate **Key ID** and **Key Secret**.
3. Navigate to **Settings -> Webhooks** and add `http://your-domain/api/v1/webhooks/razorpay` with secret `RAZORPAY_WEBHOOK_SECRET`.
4. Update `.env`:
```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

---

## 🐳 Docker & Docker Compose Setup

Run the entire platform (Frontend + Backend) in containerized mode:

```bash
# Build and start services in detached mode
docker-compose up --build -d

# View logs
docker-compose logs -f
```

* Frontend: `http://localhost:3000`
* Backend API: `http://localhost:8000`
* Interactive API Docs (Swagger): `http://localhost:8000/api/v1/docs`

---

## ⚙️ GitHub Actions CI Pipeline

The CI pipeline `.github/workflows/ci.yml` runs on every push and pull request:
1. **Backend Job**: Sets up Python 3.12, starts an ephemeral MongoDB service container, installs dependencies, and runs Pytest suites.
2. **Frontend Job**: Sets up Node 20, installs npm dependencies, and verifies production bundle compilation (`npm run build`).
3. **Docker Build Job**: Verifies Dockerfile builds for backend and frontend.

---

## 🧪 Running Automated Tests

Run backend tests using Pytest:

```bash
cd backend
python -m pytest ../tests -v
```

---

## 🤖 Future Integration with RevenuePilot AI

RevenuePilot AI will run as a completely independent service that reads business telemetry from this repository via the stable, read-only `/api/v1/merchant/*` endpoints.

This clean decoupling guarantees that the customer-facing store remains fast, reliable, and production-tested while allowing AI agents to analyze transactions asynchronously.
