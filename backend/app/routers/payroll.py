from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import io

from ..database import get_db
from ..models import (
    SystemConfig, Period, Employee, ViolationRecord, KpiMonthlyOverride, MonthlyHistorySnapshot, AuditLog
)
from ..auth import require_admin
from ..audit import log_audit
from ..engine import compute_period_kpi_and_payroll, compute_accumulation_v3
from ..excel_io import (
    export_payroll_workbook, build_template_salary_excel, build_template_targets_excel
)
from ..utils_vi import doc_so_thanh_chu

router = APIRouter(prefix="/api/payroll", tags=["Payroll & Reports (Blocks 3 & 4)"])


class PriorityOverrideReq(BaseModel):
    period_code: Optional[str] = None
    emp_code: str
    priority_points: float
    note: str = ""


class HistoryCellUpdateReq(BaseModel):
    year_num: int = 2026
    month_num: int
    emp_code: str
    kpi_score: Optional[float] = None
    workdays: Optional[float] = None
    v2_paid: Optional[float] = None
    v1_paid: Optional[float] = None


@router.get("/kpi-month")
def get_kpi_month(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    calc = compute_period_kpi_and_payroll(db, pcode)
    return {
        "period_code": calc["period_code"],
        "period_name": calc["period_name"],
        "config_effective": calc["config_effective"],
        "rows": calc["kpi_rows"],
    }


@router.put("/kpi-month/priority")
def update_priority_points(req: PriorityOverrideReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = req.period_code or cfg.current_period_code
    p = db.query(Period).filter(Period.period_code == pcode).first()
    if p and p.status == "ĐÃ KHÓA":
        raise HTTPException(status_code=400, detail="Kỳ đã khóa, không thể chỉnh sửa điểm ưu tiên")

    ovr = db.query(KpiMonthlyOverride).filter(
        KpiMonthlyOverride.period_code == pcode,
        KpiMonthlyOverride.emp_code == req.emp_code,
    ).first()
    if ovr:
        ovr.priority_points = req.priority_points
        ovr.note = req.note
    else:
        db.add(KpiMonthlyOverride(
            period_code=pcode,
            emp_code=req.emp_code,
            priority_points=req.priority_points,
            note=req.note,
        ))
    db.commit()
    log_audit(db, "Admin_QuanLy", "CHINH_UU_TIEN_KPI", req.emp_code, f"Cập nhật điểm cộng ưu tiên {req.priority_points} cho {req.emp_code} kỳ {pcode}")
    return {"message": "Đã cập nhật điểm ưu tiên"}


@router.get("/bang-luong-3p")
def get_bang_luong_3p(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    return compute_period_kpi_and_payroll(db, pcode)


@router.get("/tich-luy-v3")
def get_tich_luy_v3(
    year_num: int = 2026,
    include_open: bool = Query(False),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return compute_accumulation_v3(db, year_num=year_num, include_open_period=include_open)


@router.put("/tich-luy-v3/cell")
def update_tich_luy_cell(req: HistoryCellUpdateReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if not (1 <= req.month_num <= 12):
        raise HTTPException(status_code=400, detail="Tháng cập nhật phải nằm trong khoảng 1..12")
    emp = db.query(Employee).filter(Employee.emp_code == req.emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy cán bộ {req.emp_code}")
    snap = db.query(MonthlyHistorySnapshot).filter(
        MonthlyHistorySnapshot.year_num == req.year_num,
        MonthlyHistorySnapshot.month_num == req.month_num,
        MonthlyHistorySnapshot.emp_code == req.emp_code,
    ).first()
    if not snap:
        snap = MonthlyHistorySnapshot(
            year_num=req.year_num,
            month_num=req.month_num,
            emp_code=req.emp_code,
            is_frozen=True,
        )
        db.add(snap)
    if req.kpi_score is not None:
        snap.kpi_score = req.kpi_score
    if req.workdays is not None:
        snap.workdays = req.workdays
    if req.v2_paid is not None:
        snap.v2_paid = req.v2_paid
    if req.v1_paid is not None:
        snap.v1_paid = req.v1_paid
    db.commit()
    log_audit(db, "Admin_QuanLy", "DIEU_CHINH_TICH_LUY_V3", f"{req.emp_code} T{req.month_num}", "Chỉnh sửa số liệu tích lũy lịch sử trên TichLuy_V3")
    return {"message": "Đã cập nhật số liệu lịch sử"}


@router.get("/dashboard")
def get_dashboard(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    calc = compute_period_kpi_and_payroll(db, pcode)
    v3 = compute_accumulation_v3(db, include_open_period=True)
    return {
        "org_name": cfg.org_name,
        "period_code": calc["period_code"],
        "period_name": calc["period_name"],
        "dashboard": calc["dashboard"],
        "top_performers": sorted(calc["payroll_rows"], key=lambda x: (x["work_score"], x["takehome"]), reverse=True)[:5],
        "v3_summary": {
            "v3_fund": v3["totals"]["v3_fund"],
            "v2_qt_year": v3["totals"]["v2_qt"],
            "v2_bonus_final": v3["totals"]["v2_bonus_final"],
        },
    }


@router.get("/payslip/{emp_code}")
def get_employee_payslip_admin(
    emp_code: str,
    period_code: Optional[str] = None,
    include_open_in_v3: bool = True,
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy cán bộ")
    calc = compute_period_kpi_and_payroll(db, pcode)
    k_row = next((r for r in calc["kpi_rows"] if r["emp_code"] == emp_code), None)
    p_row = next((r for r in calc["payroll_rows"] if r["emp_code"] == emp_code), None)
    targets = [d for d in calc["execution_details"] if d["emp_code"] == emp_code]

    viols = db.query(ViolationRecord).filter(
        ViolationRecord.emp_code == emp_code
    ).order_by(ViolationRecord.id.desc()).all()
    viol_items = [
        {
            "record_code": v.record_code,
            "created_date": v.created_date,
            "period_code": v.period_code,
            "period_name": v.period_name,
            "pillar_type": v.pillar_type,
            "error_code": v.error_code,
            "error_detail": v.error_detail,
            "emp_deduction": v.emp_deduction,
            "ksv_emp_name": v.ksv_emp_name,
            "ksv_status": v.ksv_status,
            "ksv_applied_points": v.ksv_applied_points,
        }
        for v in viols
    ]

    v3 = compute_accumulation_v3(db, include_open_period=include_open_in_v3)
    acc_row = next((r for r in v3["rows"] if r["emp_code"] == emp_code), None)

    return {
        "org_name": cfg.org_name,
        "unit_name": cfg.unit_name,
        "period_code": calc["period_code"],
        "period_name": calc["period_name"],
        "standard_workdays": calc["standard_workdays"],
        "employee": {
            "emp_code": emp.emp_code,
            "full_name": emp.full_name,
            "title": emp.title,
            "department": emp.department,
            "group_id": emp.group_id,
            "group_name": emp.group_name,
            "labor_type": emp.labor_type,
            "hsl_v1": emp.hsl_v1,
            "pccv": emp.pccv,
            "base_v1": emp.base_v1,
            "base_v2": emp.base_v2,
            "is_ksv": emp.is_ksv,
            "is_active": emp.is_active,
        },
        "kpi": k_row,
        "payroll": p_row,
        "takehome_in_words": doc_so_thanh_chu(p_row["takehome"] if p_row else 0),
        "targets": targets,
        "violations_period": [v for v in viol_items if v["period_code"] == pcode],
        "violations_all": viol_items,
        "accumulation": acc_row,
    }


@router.get("/print-v2")
def get_print_v2(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    calc = compute_period_kpi_and_payroll(db, pcode)
    return {
        "org_name": cfg.org_name,
        "unit_name": cfg.unit_name,
        "period_name": calc["period_name"],
        "rows": calc["payroll_rows"],
        "totals": calc["totals"],
    }


@router.get("/print-v3")
def get_print_v3(include_open: bool = Query(False), user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    v3 = compute_accumulation_v3(db, include_open_period=include_open)
    return {
        "org_name": cfg.org_name,
        "unit_name": cfg.unit_name,
        "year_num": v3["year_num"],
        "include_open": include_open,
        "v3_allocation_method": v3["v3_allocation_method"],
        "rows": v3["rows"],
        "totals": v3["totals"],
    }


@router.get("/audit-log")
def get_audit_log(limit: int = 200, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "log_code": l.log_code,
            "timestamp": l.timestamp,
            "actor": l.actor,
            "action": l.action,
            "target_data": l.target_data,
            "details": l.details,
        }
        for l in logs
    ]


@router.get("/export-excel")
def download_export_excel(period_code: Optional[str] = None, include_open_in_v3: bool = False, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    data = export_payroll_workbook(db, pcode, include_open_in_v3=include_open_in_v3)
    log_audit(db, "Admin_QuanLy", "XUAT_EXCEL", pcode, f"Xuất file Excel tổng hợp 3P & V2/V3 kỳ {pcode}")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="BangLuong_3P_{pcode}.xlsx"'},
    )


@router.get("/template/salary")
def download_salary_template(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    data = build_template_salary_excel(db)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="FILE_MAU_IMPORT_LUONG_V1_V2.xlsx"'},
    )


@router.get("/template/targets")
def download_targets_template(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    data = build_template_targets_excel(db)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="FILE_MAU_IMPORT_CHI_TIEU.xlsx"'},
    )

