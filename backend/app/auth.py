import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS
from .database import get_db
from .models import SystemConfig, Employee

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 an toàn kèm salt ngẫu nhiên."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2${salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or not password:
        return False
    if stored_hash.startswith("pbkdf2$"):
        try:
            _, salt, hex_dk = stored_hash.split("$", 2)
            dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
            return hmac.compare_digest(dk.hex(), hex_dk)
        except Exception:
            return False
    return hmac.compare_digest(password, stored_hash)


def create_access_token(role: str, subject: str, emp_code: Optional[str] = None, full_name: str = "") -> str:
    now = datetime.utcnow()
    payload = {
        "role": role,
        "sub": subject,
        "emp_code": emp_code or "",
        "full_name": full_name,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập hệ thống")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Phiên đăng nhập đã hết hạn")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")

    role = payload.get("role")
    emp_code = payload.get("emp_code", "")
    if role == "STAFF":
        emp = db.query(Employee).filter(Employee.emp_code == emp_code, Employee.is_active == True).first()
        if not emp:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản cán bộ không tồn tại hoặc đã khóa")
        payload["full_name"] = emp.full_name
        payload["is_ksv"] = bool(emp.is_ksv or emp.group_id in (3, 5))
    elif role == "ADMIN":
        cfg = db.query(SystemConfig).first()
        if not cfg:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Thiếu cấu hình hệ thống")
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vai trò không hợp lệ")
    return payload


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chức năng chỉ dành cho Quản trị / Ban Giám đốc",
        )
    return user

