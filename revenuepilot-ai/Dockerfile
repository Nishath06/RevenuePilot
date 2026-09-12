# =============================================================================
# RevenuePilot AI — Production Dockerfile
# FastAPI + AI Agents + Multi-stage Build + Trivy Optimized
# =============================================================================

############################
# Stage 1 — Builder
############################
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install only packages required to compile Python wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy dependency file first for Docker cache.
COPY requirements.txt .

# Upgrade packaging tools and install dependencies.
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

############################
# Stage 2 — Runtime
############################
FROM python:3.12-slim-bookworm

LABEL org.opencontainers.image.title="RevenuePilot AI" \
      org.opencontainers.image.description="AI Microservice for RevenuePilot" \
      org.opencontainers.image.version="1.0.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8001

WORKDIR /app

# Install only runtime certificates.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder.
COPY --from=builder /opt/venv /opt/venv

# Create non-root user.
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --create-home appuser

# Copy only application code.
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup aws_lambda ./aws_lambda
COPY --chown=appuser:appgroup scripts ./scripts
COPY --chown=appuser:appgroup requirements.txt .
COPY --chown=appuser:appgroup pytest.ini .

USER appuser

EXPOSE 8001

# FastAPI health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health').read()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]