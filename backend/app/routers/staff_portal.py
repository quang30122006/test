from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    SystemConfig, Period, Employee, SalaryImportRow, ViolationRecord
)
from ..auth import get_current_user
from ..audit import log_audit
from ..engine import compute_period_kpi_and_payroll, compute_accumulation_v3
from ..utils_vi import doc_so_thanh_chu

router = APIRouter(prefix="/api/staff", tags=["Staff Self-Service Portal"])


class StaffKsvReviewReq(BaseModel):
    decision: str  # APPROVED | REJECTED
    ksv_note: str = ""


@router.get("/my-payslip")
def get_my_payslip(period_code: Optional[str] = None, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Cán bộ xem phiếu lương & KPI của CHÍNH MÌNH (chặn xem của người khác ở cấp API)."""
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    emp_code = user.get("emp_code")
    if user["role"] != "STAFF" or not emp_code:
        raise HTTPException(status_code=403, detail="Cổng này dành riêng cho Cán bộ nhân viên")

    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ cán bộ")

    calc = compute_period_kpi_and_payroll(db, pcode)
    k_row = next((r for r in calc["kpi_rows"] if r["emp_code"] == emp_code), None)
    p_row = next((r for r in calc["payroll_rows"] if r["emp_code"] == emp_code), None)
    targets = [d for d in calc["execution_details"] if d["emp_code"] == emp_code]
    periods = db.query(Period).order_by(Period.month_num.asc()).all()

    return {
        "org_name": cfg.org_name,
        "period_code": calc["period_code"],
        "period_name": calc["period_name"],
        "standard_workdays": calc["standard_workdays"],
        "available_periods": [{"period_code": p.period_code, "period_name": p.period_name, "status": p.status} for p in periods],
        "employee": {
            "emp_code": emp.emp_code,
            "full_name": emp.full_name,
            "title": emp.title,
            "department": emp.department,
            "group_name": emp.group_name,
            "labor_type": emp.labor_type,
        },
        "kpi": k_row,
        "payroll": p_row,
        "takehome_in_words": doc_so_thanh_chu(p_row["takehome"] if p_row else 0),
        "targets": targets,
    }


@router.get("/my-accumulation")
def get_my_accumulation(include_open: bool = Query(True), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    emp_code = user.get("emp_code")
    if user["role"] != "STAFF" or not emp_code:
        raise HTTPException(status_code=403, detail="Cổng này dành riêng cho Cán bộ nhân viên")
    v3 = compute_accumulation_v3(db, include_open_period=include_open)
    my_row = next((r for r in v3["rows"] if r["emp_code"] == emp_code), None)
    return {
        "year_num": v3["year_num"],
        "include_open": include_open,
        "v3_allocation_method": v3["v3_allocation_method"],
        "row": my_row,
    }


@router.get("/my-attendance-violations")
def get_my_attendance_and_violations(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    emp_code = user.get("emp_code")
    if user["role"] != "STAFF" or not emp_code:
        raise HTTPException(status_code=403, detail="Cổng này dành riêng cho Cán bộ nhân viên")

    periods = {p.period_code: p for p in db.query(Period).all()}
    sal_rows = db.query(SalaryImportRow).filter(SalaryImportRow.emp_code == emp_code).order_by(SalaryImportRow.period_code.asc()).all()
    attendance = [
        {
            "period_code": s.period_code,
            "period_name": periods[s.period_code].period_name if s.period_code in periods else s.period_code,
            "standard_days": periods[s.period_code].standard_days if s.period_code in periods else 22.0,
            "actual_workdays": s.actual_workdays,
            "note": s.note,
        }
        for s in sal_rows
    ]

    my_violations = db.query(ViolationRecord).filter(ViolationRecord.emp_code == emp_code).order_by(ViolationRecord.id.desc()).all()
    ksv_assigned = db.query(ViolationRecord).filter(
        ViolationRecord.has_ksv_resp == True,
        ViolationRecord.ksv_emp_code == emp_code,
    ).order_by(ViolationRecord.id.desc()).all()

    def ser(v: ViolationRecord):
        return {
            "record_code": v.record_code,
            "created_date": v.created_date,
            "period_code": v.period_code,
            "period_name": v.period_name,
            "emp_code": v.emp_code,
            "emp_name": v.emp_name,
            "pillar_type": v.pillar_type,
            "error_code": v.error_code,
            "error_detail": v.error_detail,
            "emp_deduction": v.emp_deduction,
            "ksv_emp_code": v.ksv_emp_code,
            "ksv_emp_name": v.ksv_emp_name,
            "ksv_proposed_points": v.ksv_proposed_points,
            "ksv_status": v.ksv_status,
            "ksv_applied_points": v.ksv_applied_points,
            "ksv_note": v.ksv_note,
            "ksv_reviewed_at": v.ksv_reviewed_at,
        }

    return {
        "attendance": attendance,
        "my_violations": [ser(v) for v in my_violations],
        "ksv_assigned": [ser(v) for v in ksv_assigned],
    }


@router.post("/ksv-review/{record_code}")
def staff_ksv_review(record_code: str, req: StaffKsvReviewReq, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Cho phép chính Kiểm soát viên được gán trên biên bản thực hiện Chấp nhận hoặc Từ chối kèm giải trình."""
    emp_code = user.get("emp_code")
    if user["role"] != "STAFF" or not emp_code:
        raise HTTPException(status_code=403, detail="Chỉ dành cho tài khoản Cán bộ / KSV")

    rec = db.query(ViolationRecord).filter(ViolationRecord.record_code == record_code).first()
    if not rec or not rec.has_ksv_resp:
        raise HTTPException(status_code=404, detail="Không tìm thấy biên bản cần KSV thẩm duyệt")
    if rec.ksv_emp_code != emp_code:
        raise HTTPException(status_code=403, detail="Bạn không phải KSV được phân công trên biên bản này")

    p = db.query(Period).filter(Period.period_code == rec.period_code).first()
    if p and p.status == "ĐÃ KHÓA":
        raise HTTPException(status_code=400, detail="Kỳ đánh giá đã khóa, không thể thay đổi")
    if req.decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")

    rec.ksv_status = req.decision
    rec.ksv_note = req.ksv_note.strip()
    rec.ksv_reviewed_at = datetime.now().strftime("%d/%m/%Y %H:%M")
    rec.ksv_applied_points = rec.ksv_proposed_points if req.decision == "APPROVED" else 0.0
    db.commit()
    log_audit(db, f"KSV {emp_code}", f"KSV_{req.decision}", record_code, f"KSV tự thẩm duyệt {record_code} -> {req.decision}")
    return {"message": f"Đã gửi kết quả thẩm duyệt {record_code}"}

