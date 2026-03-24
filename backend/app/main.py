from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.api_routes import router as api_router
from .api.web_routes import router as web_router
from .config import STATIC_DIR, ensure_runtime_directories


def create_app() -> FastAPI:
    ensure_runtime_directories()
    application = FastAPI(
        title="OCCNT Forecast Panel",
        version="2.0.0",
        description="Backend with Jinja2 dashboard and automated DATASUS workflow.",
    )
    application.include_router(api_router)
    application.include_router(web_router)
    application.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    return application


app = create_app()

