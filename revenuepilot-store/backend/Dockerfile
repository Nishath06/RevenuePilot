# =============================================================================
# RevenuePilot Store Backend — Production Hardened Dockerfile
# FastAPI Store API | Multi-Stage Build | Trivy Zero-Vulnerability Target
#
# ROOT CAUSE OF TRIVY FAILURES (why previous fixes did not work):
#
#   python:3.12-slim-bookworm ships Python at /usr/local/lib/python3.12/
#   Trivy scans this SYSTEM location independently of /opt/venv.
#
#   Previous Dockerfile set `ENV PATH="/opt/venv/bin:$PATH"` BEFORE the
#   `RUN python -m pip install` command. In Docker, ENV applies immediately,
#   so `python` and `pip` resolved to /opt/venv/bin/python — patching the
#   venv but leaving the SYSTEM Python at /usr/local/lib/python3.12/
#   with the vulnerable old versions (setuptools 70.3.0, msgpack 1.1.2).
#
# THE CORRECT FIX:
#   Use /usr/local/bin/pip (absolute path) to patch system Python BEFORE
#   setting the venv PATH env var. This ensures Trivy finds patched versions
#   at /usr/local/lib/python3.12/site-packages/ (system) AND /opt/venv/.
#
# SECURITY STRATEGY:
#   1. /usr/local/bin/pip upgrades system Python packages in runtime stage
#      (absolute path bypasses venv PATH, targets system Python directly).
#   2. Pinned packages installed in venv BEFORE requirements.txt.
#   3. Re-assert pinned versions after requirements.txt.
#   4. pip check validates no conflicts.
#   5. gcc/build-essential only in builder stage.
#   6. Non-root appuser (UID 1001).
# =============================================================================

# Pinned security versions (single source of truth — update here for CVE remediation):
#   setuptools    == 84.0.0
#   wheel         == 0.46.2
#   msgpack       == 1.2.1
#   jaraco.context == 6.1.2

# =============================================================================
# Stage 1 — Builder
# =============================================================================
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Patch system Python FIRST using absolute path — before any venv is activated.
# /usr/local/bin/pip targets /usr/local/lib/python3.12/site-packages/ directly.
RUN /usr/local/bin/pip install --no-cache-dir --upgrade \
        pip \
        "setuptools==84.0.0" \
        "wheel==0.46.2" \
        "msgpack==1.2.1" \
        "jaraco.context==6.1.2"

# Install compiler build tools + apply OS security patches (builder stage only)
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        gcc \
        build-essential \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create isolated virtual environment
RUN python -m venv /opt/venv

# Activate venv for all subsequent RUN commands in this stage
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade venv pip + install pinned security packages into the venv FIRST
# so pip resolver cannot downgrade them when installing requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        "setuptools==84.0.0" \
        "wheel==0.46.2" \
        "msgpack==1.2.1" \
        "jaraco.context==6.1.2"

# Install application requirements AFTER pinned packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Re-assert pinned versions — requirements.txt transitive deps may have downgraded them
RUN pip install --no-cache-dir --upgrade \
        "setuptools==84.0.0" \
        "wheel==0.46.2" \
        "msgpack==1.2.1" \
        "jaraco.context==6.1.2"

# Fail fast if any dependency conflict was introduced
RUN pip check

# =============================================================================
# Stage 2 — Runtime
# =============================================================================
FROM python:3.12-slim-bookworm AS runtime

LABEL maintainer="RevenuePilot Team" \
      org.opencontainers.image.title="RevenuePilot Store Backend" \
      org.opencontainers.image.description="RevenuePilot Store FastAPI Service" \
      org.opencontainers.image.version="1.0.0"

WORKDIR /app

# ==========================================================================
# CRITICAL: Patch SYSTEM Python using absolute path /usr/local/bin/pip
# BEFORE setting PATH to /opt/venv/bin.
#
# If ENV PATH="/opt/venv/bin:$PATH" runs first, then `pip` resolves to
# the venv pip and the system Python at /usr/local/lib/python3.12/ stays
# unpatched — this is exactly what caused Trivy to report old versions.
# ==========================================================================
RUN /usr/local/bin/pip install --no-cache-dir --upgrade \
        pip \
        "setuptools==84.0.0" \
        "wheel==0.46.2" \
        "msgpack==1.2.1" \
        "jaraco.context==6.1.2"

# Install only runtime OS dependencies + apply all available OS security patches
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Now set the venv PATH — all subsequent python/pip commands use the venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Copy the fully-patched virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Create non-root system user (UID 1001)
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home appuser

# Copy application source with correct ownership
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup requirements.txt .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]