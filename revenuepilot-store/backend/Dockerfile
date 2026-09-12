# =============================================================================
# RevenuePilot Store Backend — Production Hardened Dockerfile
# FastAPI Store API | Multi-Stage Build | Trivy Zero-Vulnerability Target
#
# SECURITY STRATEGY:
#   1. System-level pip/setuptools/wheel upgraded in BOTH builder & runtime stages.
#      Trivy scans /usr/lib/python3/ (system) independently of /opt/venv.
#      Both layers must be clean.
#   2. Pinned security packages installed BEFORE requirements.txt so pip resolver
#      cannot downgrade them via transitive dependencies.
#   3. Final re-assert of pinned versions after requirements.txt install.
#   4. `pip check` validates no dependency conflicts exist.
#   5. Build-essential and gcc are ONLY in the builder stage (never in runtime).
#   6. Non-root appuser (UID 1001) for runtime execution.
# =============================================================================

# Pinned security versions (update these to remediate future CVEs):
#   setuptools == 84.0.0
#   wheel      == 0.46.2
#   msgpack    == 1.2.1
#   jaraco.context == 6.1.2

# =============================================================================
# Stage 1 — Builder
# Compiles wheels, installs all dependencies into /opt/venv
# =============================================================================
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# --- Upgrade system-level pip toolchain FIRST ---
# Trivy scans /usr/lib/python3/dist-packages (system) AND /opt/venv separately.
# We must patch the SYSTEM python's setuptools/wheel as well as the venv.
RUN python -m pip install --no-cache-dir --upgrade \
        pip \
        "setuptools==84.0.0" \
        "wheel==0.46.2"

# --- Install OS build tools (compiler only in builder stage) ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        build-essential \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# --- Create isolated virtual environment ---
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# --- Upgrade venv pip toolchain and install pinned security packages FIRST ---
# Install pinned packages BEFORE requirements.txt so pip resolver cannot
# downgrade them when resolving transitive dependencies.
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        "setuptools==84.0.0" \
        "wheel==0.46.2" \
        "msgpack==1.2.1" \
        "jaraco.context==6.1.2"

# --- Copy dependency manifest and install application requirements ---
# requirements.txt comes AFTER the security pins so it cannot override them.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Re-assert pinned versions to prevent requirements.txt from downgrading ---
RUN pip install --no-cache-dir --upgrade \
        "setuptools==84.0.0" \
        "wheel==0.46.2" \
        "msgpack==1.2.1" \
        "jaraco.context==6.1.2"

# --- Validate: fail fast if any dependency conflict exists ---
RUN pip check

# =============================================================================
# Stage 2 — Runtime
# Minimal image: only what is needed to RUN the application
# =============================================================================
FROM python:3.12-slim-bookworm AS runtime

LABEL maintainer="RevenuePilot Team" \
      org.opencontainers.image.title="RevenuePilot Store Backend" \
      org.opencontainers.image.description="RevenuePilot Store FastAPI Service" \
      org.opencontainers.image.version="1.0.0"

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# --- Upgrade SYSTEM-level pip toolchain in runtime stage ---
# This is the layer Trivy scans when it checks /usr/lib/python3/dist-packages.
# MUST be done in runtime stage independently of the builder venv.
RUN python -m pip install --no-cache-dir --upgrade \
        pip \
        "setuptools==84.0.0" \
        "wheel==0.46.2"

# --- Install ONLY runtime OS dependencies (no compilers, no dev tools) ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# --- Copy virtual environment from builder ---
COPY --from=builder /opt/venv /opt/venv

# --- Create non-root system user (UID 1001) ---
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --no-create-home appuser

# --- Copy application source with correct ownership ---
# Explicit file-by-file copy is safer than `COPY . .` which can include
# unintended files even with .dockerignore
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup requirements.txt .

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]