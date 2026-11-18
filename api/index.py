"""Vercel Serverless Function entry point for AGRIBANK 3P.

Resilient to cold starts, container freezes, and environment bootstrap hiccups.
"""
import sys
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logger = logging.getLogger("agribank.serverless")

try:
    from app.main import app  # noqa: E402, F401
except Exception as exc:
    logger.exception("Cold start failure importing main FastAPI application: %s", exc)
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(
        title="AGRIBANK 3P - Resilient Serverless Fallback",
        description="Cold start resilience fallback mode",
    )

    @app.get("/api/health")
    def health_fallback():
        return {
            "status": "degraded",
            "service": "AGRIBANK 3P",
            "cold_start_error": str(exc),
        }

    @app.api_route(
        "/{full_path:path}",
        methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    )
    async def cold_start_handler(full_path: str):
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "error": "ColdStartInitializationError",
                "message": "Hệ thống đang khởi động hoặc chưa hoàn tất cấu hình môi trường serverless.",
                "detail": str(exc),
            },
        )
