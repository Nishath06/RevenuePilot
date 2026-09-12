# =============================================================================
# RevenuePilot AI — Production Hardened Dockerfile
# FastAPI + AI Microservice + Multi-Stage Build + Trivy Hardened
# =============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install only compiler build tools needed for wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy dependency manifest
COPY requirements.txt .

# Upgrade packaging tools and force-install pinned security versions
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir setuptools==84.0.0 wheel==0.46.2 msgpack==1.2.1 jaraco.context==6.1.2 && \
    pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="RevenuePilot AI" \
      org.opencontainers.image.description="AI Microservice for RevenuePilot" \
      org.opencontainers.image.version="1.0.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8001

WORKDIR /app

# Install ONLY runtime network certificates and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create non-root system user (UID 1001 / GID 1001)
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup --create-home appuser

# Copy application source code with non-root ownership
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup aws_lambda ./aws_lambda
COPY --chown=appuser:appgroup scripts ./scripts
COPY --chown=appuser:appgroup requirements.txt .
COPY --chown=appuser:appgroup pytest.ini .

# Switch to unprivileged user
USER appuser

EXPOSE 8001

# FastAPI container healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]