from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from .config import DATABASE_URL, IS_SQLITE, IS_VERCEL

if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA busy_timeout=5000;")
        cursor.close()
elif IS_VERCEL:
    # Trên Vercel Serverless: Sử dụng NullPool để giao việc quản lý kết nối cho PgBouncer của Neon (-pooler),
    # tránh lỗi đứt gãy socket SSL SYSCALL EOF khi Lambda container bị đóng băng/unfreeze.
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        pool_pre_ping=True,
        echo=False,
    )
else:
    # Giữ pool ổn định trên môi trường On-Premise / Server
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 120,
        "pool_timeout": 15,
        "pool_size": 5,
        "max_overflow": 10,
        "echo": False,
    }
    engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

