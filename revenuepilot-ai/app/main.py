"""
RevenuePilot AI — FastAPI Application Entry Point
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agents.coordinator import get_coordinator
from app.api import automation, chat, health, insights, merchant
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.middleware.request_timer import RequestTimerMiddleware

# Configure logging before anything else
configure_logging()
logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "Starting RevenuePilot AI",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        port=settings.PORT,
    )

    # Connect to MongoDB
    await connect_to_mongodb()

    # Initialize coordinator (builds agents based on active provider)
    coord = get_coordinator()

    logger.info("RevenuePilot AI is ready", provider=coord.provider.name if coord.provider else settings.LLM_PROVIDER, ai_ready=coord.ai_ready)

    yield

    logger.info("Shutting down RevenuePilot AI")
    await close_mongodb_connection()


# ─────────────────────────────────────────────────────────────────────────────
# Application Factory
# ─────────────────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="RevenuePilot AI",
        description=(
            "Enterprise-grade AI Revenue Intelligence Microservice. "
            "Answers natural language merchant questions using live MongoDB data."
        ),
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── Middleware ──────────────────────────────────────────────────────────
    app.add_middleware(RequestTimerMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ─────────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(chat.router)
    app.include_router(insights.router)
    app.include_router(merchant.router)
    app.include_router(automation.router)

    # ── Root ────────────────────────────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root():
        return JSONResponse(
            {
                "service": "RevenuePilot AI",
                "version": settings.VERSION,
                "status": "running",
                "docs": "/docs",
                "health": "/health",
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config=None,  # Structlog handles logging
    )
