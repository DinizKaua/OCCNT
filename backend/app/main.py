from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.api_routes import router as api_router
from .config import ensure_runtime_directories
from .database import check_database_connection, ensure_database_schema


def create_app() -> FastAPI:
    ensure_runtime_directories()
    application = FastAPI(
        title="OCCNT Forecast API",
        version="3.0.0",
        description="API backend for DATASUS exports and disease forecasting consumed by the React frontend.",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.on_event("startup")
    def prepare_runtime() -> None:
        ensure_runtime_directories()
        database_ready, _ = check_database_connection()
        if database_ready:
            ensure_database_schema()

    @application.get("/", tags=["meta"])
    def api_index() -> dict:
        return {
            "name": "OCCNT Forecast API",
            "status": "online",
            "health_url": "/api/health",
            "docs_url": "/docs",
        }

    application.include_router(api_router)
    return application


app = create_app()

