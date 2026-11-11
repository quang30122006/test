import os
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _normalize_database_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


BASE_DIR = Path(__file__).resolve().parent.parent.parent  # Thư mục gốc dự án
BACKEND_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = bool(os.environ.get("VERCEL"))

_RAW_DB_URL = _normalize_database_url(
    os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or ""
)

if _RAW_DB_URL:
    DATA_DIR = Path(os.environ.get("AGRIBANK_DATA_DIR") or (BACKEND_DIR / "data"))
    DB_PATH = DATA_DIR / "agribank_kpi_3p.db"
    DATABASE_URL = _RAW_DB_URL
    IS_SQLITE = DATABASE_URL.startswith("sqlite")
    if IS_SQLITE:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
else:
    if IS_VERCEL:
        raise RuntimeError(
            "Thiếu biến môi trường DATABASE_URL (PostgreSQL/Neon) khi triển khai trên Vercel."
        )
    DATA_DIR = Path(os.environ.get("AGRIBANK_DATA_DIR") or (BACKEND_DIR / "data"))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH = DATA_DIR / "agribank_kpi_3p.db"
    DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"
    IS_SQLITE = True

EXCEL_SOURCE_PATH = BASE_DIR / "New HE_THONG_TIEN_LUONG_KPI_V20_AGRIBANK_CHUAN.xlsm"
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"

_ENV_JWT_SECRET = (os.environ.get("AGRIBANK_KPI_JWT_SECRET") or os.environ.get("JWT_SECRET") or "").strip()
if not _ENV_JWT_SECRET:
    if IS_VERCEL:
        raise RuntimeError(
            "Thiếu biến môi trường AGRIBANK_KPI_JWT_SECRET khi triển khai trên Vercel."
        )
    _ENV_JWT_SECRET = "agribank-qb-3p-v20-secret-key-2026"

JWT_SECRET = _ENV_JWT_SECRET
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

_CORS_RAW = (os.environ.get("AGRIBANK_CORS_ORIGINS") or "").strip()
if _CORS_RAW:
    CORS_ORIGINS = [item.strip().rstrip("/") for item in _CORS_RAW.split(",") if item.strip()]
elif IS_VERCEL:
    _vercel_hosts = [
        os.environ.get("VERCEL_URL", "").strip(),
        os.environ.get("VERCEL_PROJECT_PRODUCTION_URL", "").strip(),
    ]
    CORS_ORIGINS = [f"https://{h}" for h in _vercel_hosts if h]
else:
    CORS_ORIGINS = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]

PUBLIC_STAFF_DIRECTORY = _env_bool("PUBLIC_STAFF_DIRECTORY", default=not IS_VERCEL)

