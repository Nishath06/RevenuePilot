# ─────────────────────────────────────────────────────────────────────────────
# RevenuePilot AI Microservice — Production Dockerfile
# Stage 1: Build virtual environment & dependencies
# Stage 2: Minimal hardened Python 3.12 slim-bookworm runtime
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app

# Upgrade OS packages & install build essentials
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies with pip caching disabled
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

LABEL maintainer="RevenuePilot AI Team" \
      version="1.0.0" \
      description="RevenuePilot AI Microservice"

# Upgrade runtime OS packages to eliminate Trivy vulnerabilities
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder stage
COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001

WORKDIR /app

# Create non-root system user and group
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy application source code
COPY --chown=appuser:appgroup . .

# Switch to unprivileged user
USER appuser

EXPOSE 8001

# Container healthcheck using FastAPI /health route
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start Uvicorn ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
