from contextlib import asynccontextmanager
import threading
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

from .config import FRONTEND_DIST_DIR, CORS_ORIGINS, SEED_DEMO_ONLY
from .database import Base, engine, SessionLocal
from .seed_from_excel import seed_database_if_empty
from .models import SystemConfig
from .audit import client_ip_ctx, user_agent_ctx
from .routers import auth, admin_config, catalogs, operations, payroll, staff_portal

_init_lock = threading.Lock()
_db_initialized = False


def ensure_database_initialized():
    """Khởi tạo schema & nạp dữ liệu gốc an toàn, tránh introspect lại toàn bộ bảng khi DB đã sẵn sàng."""
    global _db_initialized
    if _db_initialized:
        return
    with _init_lock:
        if _db_initialized:
            return
        try:
            with engine.connect() as conn:
                if conn.execute(text("SELECT 1 FROM system_config LIMIT 1")).first() is not None:
                    _db_initialized = True
                    return
        except (ProgrammingError, OperationalError):
            pass

        try:
            Base.metadata.create_all(bind=engine)
        except (IntegrityError, ProgrammingError):
            if not inspect(engine).has_table("system_config"):
                raise

        db = SessionLocal()
        try:
            seed_database_if_empty(db, demo_only=SEED_DEMO_ONLY)
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
async def _audit_context_middleware(request, call_next):
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "").strip()
        or (request.client.host if request.client else "")
    )
    user_agent = request.headers.get("user-agent", "")
    t_ip = client_ip_ctx.set(client_ip or None)
    t_ua = user_agent_ctx.set(user_agent or None)
    try:
        return await call_next(request)
    finally:
        client_ip_ctx.reset(t_ip)
        user_agent_ctx.reset(t_ua)


@app.middleware("http")
async def _ensure_db_on_request(request, call_next):
    if request.url.path.startswith("/api") and not request.url.path.startswith("/api/health") and not _db_initialized:
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
            raise HTTPException(status_code=404, detail="API endpoint not found")
        target = FRONTEND_DIST_DIR / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(str(target))
        index_file = FRONTEND_DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        raise HTTPException(status_code=404, detail="Frontend build not found")

