# =============================================================================
# RevenuePilot Store Backend — Production Dockerfile
# FastAPI + Python 3.12 + Multi-stage Build + Trivy Optimized
# =============================================================================

############################
# Stage 1 — Builder
############################
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Only install packages needed to build Python wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies first for Docker cache.
COPY requirements.txt .

RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

############################
# Stage 2 — Runtime
############################
FROM python:3.12-slim-bookworm

LABEL org.opencontainers.image.title="RevenuePilot Store Backend" \
      org.opencontainers.image.description="FastAPI Store Backend for RevenuePilot" \
      org.opencontainers.image.version="1.0.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Install only runtime packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder.
COPY --from=builder /opt/venv /opt/venv

# Create non-root user.
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --create-home appuser

# Copy only application source.
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup requirements.txt .

USER appuser

EXPOSE 8000

# Healthcheck without curl (smaller image).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]