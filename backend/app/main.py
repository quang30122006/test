from contextlib import asynccontextmanager
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, ProgrammingError

from .config import FRONTEND_DIST_DIR, CORS_ORIGINS
from .database import Base, engine, SessionLocal
from .seed_from_excel import seed_database_if_empty
from .models import SystemConfig
from .routers import auth, admin_config, catalogs, operations, payroll, staff_portal

_init_lock = threading.Lock()
_db_initialized = False


def ensure_database_initialized():
    """Khởi tạo schema & nạp dữ liệu gốc an toàn cả khi nhiều instance serverless khởi động cùng lúc."""
    global _db_initialized
    if _db_initialized:
        return
    with _init_lock:
        if _db_initialized:
            return
        try:
            Base.metadata.create_all(bind=engine)
        except (IntegrityError, ProgrammingError):
            if not inspect(engine).has_table("system_config"):
                raise

        db = SessionLocal()
        try:
            seed_database_if_empty(db)
        except IntegrityError:
            db.rollback()
            if db.query(SystemConfig).first() is None:
                raise
        finally:
            db.close()
        _db_initialized = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_database_initialized()
    yield


app = FastAPI(
    title="AGRIBANK 3P",
    description="Hệ thống Quản trị Tiền lương & Đánh giá KPI 3P",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=bool(CORS_ORIGINS and "*" not in CORS_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _ensure_db_on_request(request, call_next):
    if request.url.path.startswith("/api") and not _db_initialized:
        ensure_database_initialized()
    return await call_next(request)

app.include_router(auth.router)
app.include_router(admin_config.router)
app.include_router(catalogs.router)
app.include_router(operations.router)
app.include_router(payroll.router)
app.include_router(staff_portal.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AGRIBANK 3P"}


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return {"detail": "Not found"}
        target = FRONTEND_DIST_DIR / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(str(target))
        index_file = FRONTEND_DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"detail": "Frontend build not found"}

