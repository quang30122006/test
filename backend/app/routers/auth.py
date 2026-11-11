from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import PUBLIC_STAFF_DIRECTORY
from ..database import get_db
from ..models import SystemConfig, Employee
from ..auth import verify_password, hash_password, create_access_token, get_current_user
from ..audit import log_audit

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class AdminLoginReq(BaseModel):
    password: str


class StaffLoginReq(BaseModel):
    emp_code: str
    password: str


class ChangePasswordReq(BaseModel):
    old_password: str
    new_password: str


@router.get("/staff-directory")
def list_staff_login_options(db: Session = Depends(get_db)):
    """Danh sách mã & tên cán bộ để chọn đăng nhập (tắt mặc định khi public trên Vercel)."""
    if not PUBLIC_STAFF_DIRECTORY:
        return []
    emps = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc(), Employee.id.asc()).all()
    return [
        {
            "emp_code": e.emp_code,
            "full_name": e.full_name,
            "department": e.department,
            "title": e.title,
        }
        for e in emps
    ]


@router.post("/login-admin")
def login_admin(req: AdminLoginReq, db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    if not cfg or not verify_password(req.password, cfg.admin_password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mật khẩu Quản trị không chính xác")
    token = create_access_token(role="ADMIN", subject="admin", full_name="Quản trị / Ban Giám đốc")
    log_audit(db, "Admin_QuanLy", "DANG_NHAP_ADMIN", cfg.current_period_name, "Đăng nhập thành công quyền Quản trị trên Web")
    return {
        "access_token": token,
        "role": "ADMIN",
        "full_name": "Quản trị / Ban Giám đốc",
        "current_period_code": cfg.current_period_code,
        "current_period_name": cfg.current_period_name,
    }


@router.post("/login-staff")
def login_staff(req: StaffLoginReq, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.emp_code == req.emp_code.strip(), Employee.is_active == True).first()
    if not emp or not verify_password(req.password, emp.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mã cán bộ hoặc mật khẩu không chính xác")
    cfg = db.query(SystemConfig).first()
    token = create_access_token(role="STAFF", subject=emp.emp_code, emp_code=emp.emp_code, full_name=emp.full_name)
    log_audit(db, f"{emp.emp_code} ({emp.full_name})", "DANG_NHAP_CAN_BO", cfg.current_period_name if cfg else "", "Cán bộ đăng nhập cổng tra cứu cá nhân")
    return {
        "access_token": token,
        "role": "STAFF",
        "emp_code": emp.emp_code,
        "full_name": emp.full_name,
        "title": emp.title,
        "department": emp.department,
        "is_ksv": bool(emp.is_ksv or emp.group_id in (3, 5)),
        "current_period_code": cfg.current_period_code if cfg else "2026-10",
        "current_period_name": cfg.current_period_name if cfg else "Tháng 10/2026",
    }


@router.get("/me")
def get_me(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    res = {
        "role": user["role"],
        "emp_code": user.get("emp_code", ""),
        "full_name": user.get("full_name", ""),
        "is_ksv": user.get("is_ksv", False),
        "org_name": cfg.org_name if cfg else "",
        "unit_name": cfg.unit_name if cfg else "",
        "current_period_code": cfg.current_period_code if cfg else "2026-10",
        "current_period_name": cfg.current_period_name if cfg else "Tháng 10/2026",
    }
    if user["role"] == "STAFF":
        emp = db.query(Employee).filter(Employee.emp_code == user["emp_code"]).first()
        if emp:
            res.update({
                "title": emp.title,
                "department": emp.department,
                "group_id": emp.group_id,
                "group_name": emp.group_name,
                "labor_type": emp.labor_type,
            })
    return res


@router.post("/change-password")
def change_password(req: ChangePasswordReq, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if len(req.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 4 ký tự")
    if user["role"] == "ADMIN":
        cfg = db.query(SystemConfig).first()
        if not verify_password(req.old_password, cfg.admin_password_hash):
            raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
        cfg.admin_password_hash = hash_password(req.new_password.strip())
        db.commit()
        log_audit(db, "Admin_QuanLy", "DOI_MAT_KHAU", "Admin", "Đã đổi mật khẩu Quản trị hệ thống")
    else:
        emp = db.query(Employee).filter(Employee.emp_code == user["emp_code"]).first()
        if not emp or not verify_password(req.old_password, emp.password_hash):
            raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
        emp.password_hash = hash_password(req.new_password.strip())
        db.commit()
        log_audit(db, f"{emp.emp_code}", "DOI_MAT_KHAU_CB", emp.emp_code, "Cán bộ tự đổi mật khẩu")
    return {"message": "Đổi mật khẩu thành công"}

