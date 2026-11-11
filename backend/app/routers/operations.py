import io
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    SystemConfig, Period, Employee, Indicator,
    SalaryImportRow, TargetExecutionRow, ViolationRecord, MonthlyHistorySnapshot
)
from ..auth import require_admin
from ..audit import log_audit
from ..excel_io import (
    import_salary_excel, import_targets_excel,
    preview_salary_excel, commit_salary_dataset,
    preview_targets_excel, commit_targets_dataset,
    export_dataset_12_months_excel,
)
from ..engine import compute_period_kpi_and_payroll, sync_period_snapshot

router = APIRouter(prefix="/api/operations", tags=["Operations (Block 2)"])


def _ensure_period_editable(db: Session, period_code: str) -> Period:
    p = db.query(Period).filter(Period.period_code == period_code).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy kỳ {period_code}")
    if p.status == "ĐÃ KHÓA":
        raise HTTPException(status_code=400, detail=f"Kỳ {p.period_name} đang ở trạng thái ĐÃ KHÓA, không thể chỉnh sửa dữ liệu")
    return p


class SalaryRowUpdateReq(BaseModel):
    base_v1: Optional[float] = None
    base_v2: Optional[float] = None
    actual_workdays: Optional[float] = None
    hsl_v1: Optional[float] = None
    note: Optional[str] = None


class AttendanceUpdateItem(BaseModel):
    emp_code: str
    actual_workdays: float
    note: str = ""


class TargetExecutionItemReq(BaseModel):
    emp_code: str
    indicator_code: str
    target_value: float
    actual_value: float


class ViolationCreateReq(BaseModel):
    period_code: Optional[str] = None
    emp_code: str
    pillar_type: str = "3.3"  # 3.1 (Nội quy) | 3.3 (Nghiệp vụ)
    error_code: str
    error_detail: str
    emp_deduction: float
    has_ksv_resp: bool = False
    ksv_emp_code: str = ""
    ksv_proposed_points: Optional[float] = None
    has_approver_resp: bool = False
    approver_emp_code: str = ""
    approver_points: Optional[float] = None


class KsvReviewReq(BaseModel):
    decision: str  # APPROVED | REJECTED | PENDING
    ksv_note: str = ""


# ---- 1. IMPORT LƯƠNG V1 + V2 ----
@router.get("/salary-import")
def get_salary_import(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    rows = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode).order_by(SalaryImportRow.id.asc()).all()
    return {
        "period_code": pcode,
        "rows": [
            {
                "id": r.id,
                "emp_code": r.emp_code,
                "full_name": r.full_name,
                "title": r.title,
                "department": r.department,
                "group_name": r.group_name,
                "labor_type": r.labor_type,
                "hsl_v1": r.hsl_v1,
                "base_v1": r.base_v1,
                "base_v2": r.base_v2,
                "actual_workdays": r.actual_workdays,
                "status": r.status,
                "note": r.note,
            }
            for r in rows
        ],
    }


@router.post("/salary-import/upload")
async def upload_salary_excel(
    period_code: Optional[str] = Query(None),
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    p = _ensure_period_editable(db, pcode)
    content = await file.read()
    try:
        res = import_salary_excel(db, content, pcode, replace_existing=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    log_audit(db, "Admin_QuanLy", "IMPORT_LUONG", p.period_name, f"Nạp bảng lương từ file {file.filename} ({res['sheet_name']}) - {res['count']} cán bộ")
    return {"message": f"Đã nạp thành công {res['count']} cán bộ từ sheet '{res['sheet_name']}'", **res}


@router.post("/salary-import/sync-from-catalog")
def sync_salary_from_catalog(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    p = _ensure_period_editable(db, pcode)
    emps = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc()).all()
    count = 0
    for e in emps:
        row = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode, SalaryImportRow.emp_code == e.emp_code).first()
        if row:
            row.full_name = e.full_name
            row.title = e.title
            row.department = e.department
            row.group_name = e.group_name
            row.labor_type = e.labor_type
            row.hsl_v1 = e.hsl_v1
            row.base_v1 = e.base_v1
            row.base_v2 = e.base_v2
        else:
            db.add(SalaryImportRow(
                period_code=pcode,
                emp_code=e.emp_code,
                full_name=e.full_name,
                title=e.title,
                department=e.department,
                group_name=e.group_name,
                labor_type=e.labor_type,
                hsl_v1=e.hsl_v1,
                base_v1=e.base_v1,
                base_v2=e.base_v2,
                actual_workdays=p.standard_days,
                status="Hợp lệ",
            ))
        count += 1
    db.commit()
    log_audit(db, "Admin_QuanLy", "DONG_BO_LUONG", p.period_name, f"Đồng bộ {count} cán bộ từ Danh mục sang kỳ {p.period_name}")
    return {"message": f"Đã đồng bộ {count} cán bộ vào kỳ {p.period_name}"}


@router.put("/salary-import/{emp_code}")
def update_salary_row(emp_code: str, req: SalaryRowUpdateReq, period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    _ensure_period_editable(db, pcode)
    row = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode, SalaryImportRow.emp_code == emp_code).first()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy dòng lương cán bộ trong kỳ")
    if req.base_v1 is not None:
        row.base_v1 = req.base_v1
    if req.base_v2 is not None:
        row.base_v2 = req.base_v2
    if req.hsl_v1 is not None:
        row.hsl_v1 = req.hsl_v1
    if req.actual_workdays is not None:
        row.actual_workdays = req.actual_workdays
    if req.note is not None:
        row.note = req.note
    db.commit()
    return {"message": "Đã cập nhật dòng lương"}


# ---- 2. IMPORT & KẾT QUẢ CHỈ TIÊU KINH DOANH ----
@router.get("/targets-execution")
def get_targets_execution(period_code: Optional[str] = None, emp_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    calc = compute_period_kpi_and_payroll(db, pcode)
    details = calc["execution_details"]
    if emp_code:
        details = [d for d in details if d["emp_code"] == emp_code]
    return {"period_code": pcode, "rows": details}


@router.post("/targets-import/upload")
async def upload_targets_excel(
    period_code: Optional[str] = Query(None),
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    p = _ensure_period_editable(db, pcode)
    content = await file.read()
    try:
        res = import_targets_excel(db, content, pcode, replace_existing=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    log_audit(db, "Admin_QuanLy", "IMPORT_CHI_TIEU", p.period_name, f"Nạp kết quả chỉ tiêu từ file {file.filename} ({res['sheet_name']}) - {res['count']} bản ghi")
    return {"message": f"Đã nạp thành công {res['count']} bản ghi chỉ tiêu từ sheet '{res['sheet_name']}'", **res}


@router.post("/targets-execution/generate-from-catalog")
def generate_targets_from_catalog(period_code: Optional[str] = None, overwrite: bool = False, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Khởi tạo bộ 8 chỉ tiêu tháng (Mục tiêu năm / 12) theo Trực tiếp/Gián tiếp cho tất cả nhân sự active."""
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    p = _ensure_period_editable(db, pcode)
    emps = db.query(Employee).filter(Employee.is_active == True).all()
    inds = db.query(Indicator).all()
    if overwrite:
        db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == pcode).delete()
    created = 0
    for e in emps:
        for ind in inds:
            ti = round((ind.target_direct if e.labor_type == "Trực tiếp" else ind.target_indirect) / 12.0, 3)
            ex = db.query(TargetExecutionRow).filter(
                TargetExecutionRow.period_code == pcode,
                TargetExecutionRow.emp_code == e.emp_code,
                TargetExecutionRow.indicator_code == ind.code,
            ).first()
            if not ex:
                db.add(TargetExecutionRow(
                    period_code=pcode, emp_code=e.emp_code, indicator_code=ind.code,
                    target_value=ti, actual_value=0.0, status="Khởi tạo",
                ))
                created += 1
    db.commit()
    log_audit(db, "Admin_QuanLy", "KHOI_TAO_CHI_TIEU", p.period_name, f"Khởi tạo {created} bản ghi mục tiêu tháng từ Cây chỉ tiêu GK")
    return {"message": f"Đã khởi tạo {created} dòng mục tiêu tháng cho kỳ {p.period_name}"}


@router.put("/targets-execution")
def upsert_target_execution(req: TargetExecutionItemReq, period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    _ensure_period_editable(db, pcode)
    row = db.query(TargetExecutionRow).filter(
        TargetExecutionRow.period_code == pcode,
        TargetExecutionRow.emp_code == req.emp_code,
        TargetExecutionRow.indicator_code == req.indicator_code,
    ).first()
    if row:
        row.target_value = req.target_value
        row.actual_value = req.actual_value
        row.status = "Hợp lệ"
    else:
        db.add(TargetExecutionRow(
            period_code=pcode,
            emp_code=req.emp_code,
            indicator_code=req.indicator_code,
            target_value=req.target_value,
            actual_value=req.actual_value,
            status="Hợp lệ",
        ))
    db.commit()
    return {"message": "Đã lưu kết quả chỉ tiêu"}


# ---- 3. BẢNG CHẤM CÔNG ----
@router.get("/attendance")
def get_attendance(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    period = db.query(Period).filter(Period.period_code == pcode).first()
    std_days = float(period.standard_days) if (period and cfg.use_period_standard_days) else float(cfg.standard_workdays)
    emps = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc()).all()
    sal_map = {r.emp_code: r for r in db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode).all()}

    rows = []
    for idx, e in enumerate(emps, 1):
        sr = sal_map.get(e.emp_code)
        wd = float(sr.actual_workdays) if sr else std_days
        ratio = round(wd / std_days, 4) if std_days > 0 else 1.0
        auto_note = f"Nghỉ phép/công tác ({round(std_days - wd, 1):g} ngày)" if wd < std_days else ("Làm thêm/vượt chuẩn" if wd > std_days else "Đủ ngày công")
        rows.append({
            "stt": idx,
            "emp_code": e.emp_code,
            "full_name": e.full_name,
            "department": e.department,
            "title": e.title,
            "group_name": e.group_name,
            "labor_type": e.labor_type,
            "standard_workdays": std_days,
            "actual_workdays": wd,
            "workday_ratio": ratio,
            "note": (sr.note if sr and sr.note else auto_note),
        })
    return {"period_code": pcode, "period_name": period.period_name if period else pcode, "standard_workdays": std_days, "rows": rows}


@router.put("/attendance")
def save_attendance(items: List[AttendanceUpdateItem], period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    p = _ensure_period_editable(db, pcode)
    for item in items:
        sr = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode, SalaryImportRow.emp_code == item.emp_code).first()
        if sr:
            sr.actual_workdays = item.actual_workdays
            if item.note is not None:
                sr.note = item.note
        else:
            emp = db.query(Employee).filter(Employee.emp_code == item.emp_code).first()
            if emp:
                db.add(SalaryImportRow(
                    period_code=pcode,
                    emp_code=emp.emp_code,
                    full_name=emp.full_name,
                    title=emp.title,
                    department=emp.department,
                    group_name=emp.group_name,
                    labor_type=emp.labor_type,
                    hsl_v1=emp.hsl_v1,
                    base_v1=emp.base_v1,
                    base_v2=emp.base_v2,
                    actual_workdays=item.actual_workdays,
                    note=item.note,
                    status="Hợp lệ",
                ))
    db.commit()
    log_audit(db, "Admin_QuanLy", "CAP_NHAT_CHAM_CONG", p.period_name, f"Cập nhật ngày công thực tế cho {len(items)} cán bộ kỳ {p.period_name}")
    return {"message": f"Đã lưu bảng chấm công kỳ {p.period_name}"}


# ---- 4. GHI NHẬN VI PHẠM, NHẬT KÝ LỖI & HÀNG CHỜ KSV ----
@router.get("/violations")
def list_violations(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    q = db.query(ViolationRecord)
    if pcode != "ALL":
        q = q.filter(ViolationRecord.period_code == pcode)
    rows = q.order_by(ViolationRecord.id.desc()).all()
    items = [
        {
            "id": r.id,
            "record_code": r.record_code,
            "created_date": r.created_date,
            "period_code": r.period_code,
            "period_name": r.period_name,
            "emp_code": r.emp_code,
            "emp_name": r.emp_name,
            "pillar_type": r.pillar_type,
            "error_code": r.error_code,
            "error_detail": r.error_detail,
            "emp_deduction": r.emp_deduction,
            "has_ksv_resp": r.has_ksv_resp,
            "ksv_emp_code": r.ksv_emp_code,
            "ksv_emp_name": r.ksv_emp_name,
            "ksv_proposed_points": r.ksv_proposed_points,
            "ksv_status": r.ksv_status,
            "ksv_applied_points": r.ksv_applied_points,
            "ksv_note": r.ksv_note,
            "ksv_reviewed_at": r.ksv_reviewed_at,
            "has_approver_resp": r.has_approver_resp,
            "approver_emp_code": r.approver_emp_code,
            "approver_emp_name": r.approver_emp_name,
            "approver_points": r.approver_points,
            "approver_status": r.approver_status,
        }
        for r in rows
    ]
    ksv_items = [x for x in items if x["has_ksv_resp"]]
    summary = {
        "pending_count": sum(1 for x in ksv_items if x["ksv_status"] == "PENDING"),
        "approved_count": sum(1 for x in ksv_items if x["ksv_status"] == "APPROVED"),
        "rejected_count": sum(1 for x in ksv_items if x["ksv_status"] == "REJECTED"),
        "total_ksv_applied": sum(x["ksv_applied_points"] for x in ksv_items),
    }
    return {"period_code": pcode, "items": items, "ksv_summary": summary}


@router.post("/violations")
def create_violation(req: ViolationCreateReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = req.period_code or cfg.current_period_code
    p = _ensure_period_editable(db, pcode)

    emp = db.query(Employee).filter(Employee.emp_code == req.emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy cán bộ vi phạm")

    emp_ded = abs(float(req.emp_deduction))
    ksv_name = ""
    ksv_prop = 0.0
    ksv_status = "NONE"
    if req.has_ksv_resp and req.ksv_emp_code:
        ksv_emp = db.query(Employee).filter(Employee.emp_code == req.ksv_emp_code).first()
        ksv_name = ksv_emp.full_name if ksv_emp else req.ksv_emp_code
        ksv_prop = req.ksv_proposed_points if req.ksv_proposed_points is not None else round(emp_ded * cfg.ksv_deduction_ratio, 1)
        ksv_status = "PENDING"

    app_name = ""
    app_pts = 0.0
    app_status = "NONE"
    if req.has_approver_resp and req.approver_emp_code:
        app_emp = db.query(Employee).filter(Employee.emp_code == req.approver_emp_code).first()
        app_name = app_emp.full_name if app_emp else req.approver_emp_code
        app_pts = req.approver_points if req.approver_points is not None else round(emp_ded * cfg.approver_deduction_ratio, 1)
        app_status = "RECORDED"

    existing_cnt = db.query(ViolationRecord).count()
    rec_code = f"BB{existing_cnt + 1:03d}"
    while db.query(ViolationRecord).filter(ViolationRecord.record_code == rec_code).first():
        existing_cnt += 1
        rec_code = f"BB{existing_cnt + 1:03d}"

    rec = ViolationRecord(
        record_code=rec_code,
        created_date=datetime.now().strftime("%d/%m/%Y"),
        period_code=pcode,
        period_name=p.period_name,
        emp_code=emp.emp_code,
        emp_name=emp.full_name,
        pillar_type=req.pillar_type,
        error_code=req.error_code.strip(),
        error_detail=req.error_detail.strip(),
        emp_deduction=emp_ded,
        has_ksv_resp=req.has_ksv_resp and bool(req.ksv_emp_code),
        ksv_emp_code=req.ksv_emp_code if req.has_ksv_resp else "",
        ksv_emp_name=ksv_name,
        ksv_proposed_points=ksv_prop,
        ksv_status=ksv_status,
        ksv_applied_points=0.0,
        has_approver_resp=req.has_approver_resp and bool(req.approver_emp_code),
        approver_emp_code=req.approver_emp_code if req.has_approver_resp else "",
        approver_emp_name=app_name,
        approver_points=app_pts,
        approver_status=app_status,
    )
    db.add(rec)
    db.commit()
    log_audit(db, "Admin_QuanLy", "GHI_NHAN_VI_PHAM", rec_code, f"Ghi nhận {rec_code} cho {emp.full_name} ({req.error_code}, -{emp_ded}đ, KSV={ksv_status})")
    return {"message": f"Đã ghi nhận biên bản {rec_code}", "record_code": rec_code}


@router.post("/violations/{record_code}/ksv-review")
def review_ksv_record(record_code: str, req: KsvReviewReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    rec = db.query(ViolationRecord).filter(ViolationRecord.record_code == record_code).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy biên bản")
    _ensure_period_editable(db, rec.period_code)
    if req.decision not in ("APPROVED", "REJECTED", "PENDING"):
        raise HTTPException(status_code=400, detail="Trạng thái duyệt không hợp lệ")
    rec.ksv_status = req.decision
    rec.ksv_note = req.ksv_note.strip()
    rec.ksv_reviewed_at = datetime.now().strftime("%d/%m/%Y %H:%M")
    rec.ksv_applied_points = rec.ksv_proposed_points if req.decision == "APPROVED" else 0.0
    db.commit()
    log_audit(db, "Admin_QuanLy", f"KSV_{req.decision}", record_code, f"Thẩm duyệt KSV {record_code} -> {req.decision} ({rec.ksv_applied_points}đ)")
    return {"message": f"Đã cập nhật trạng thái {record_code} -> {req.decision}"}


@router.post("/violations/ksv-bulk-review")
def bulk_review_ksv(decision: str, period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ APPROVED hoặc REJECTED")
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    _ensure_period_editable(db, pcode)
    recs = db.query(ViolationRecord).filter(
        ViolationRecord.period_code == pcode,
        ViolationRecord.has_ksv_resp == True,
    ).all()
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    for r in recs:
        r.ksv_status = decision
        r.ksv_applied_points = r.ksv_proposed_points if decision == "APPROVED" else 0.0
        r.ksv_reviewed_at = now_str
    db.commit()
    log_audit(db, "Admin_QuanLy", f"KSV_BULK_{decision}", pcode, f"Xử lý hàng loạt {len(recs)} biên bản KSV -> {decision}")
    return {"message": f"Đã cập nhật {len(recs)} biên bản sang {decision}"}


@router.delete("/violations/{record_code}")
def delete_violation(record_code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    rec = db.query(ViolationRecord).filter(ViolationRecord.record_code == record_code).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy biên bản")
    _ensure_period_editable(db, rec.period_code)
    db.delete(rec)
    db.commit()
    log_audit(db, "Admin_QuanLy", "XOA_VI_PHAM", record_code, f"Đã xóa biên bản {record_code}")
    return {"message": f"Đã xóa biên bản {record_code}"}


# ---- 5. TRUNG TÂM QUẢN LÝ & IMPORT DATASET 12 THÁNG ----
def _parse_months_csv(selected_months: Optional[str]) -> Optional[List[int]]:
    if not selected_months or not selected_months.strip():
        return None
    out = []
    for part in selected_months.split(","):
        part = part.strip()
        if part.isdigit():
            m = int(part)
            if 1 <= m <= 12:
                out.append(m)
    return out or None


@router.get("/dataset/status")
def get_dataset_status(year_num: int = 2026, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Ma trận hiện trạng Dataset 12 tháng: Lương, Chỉ tiêu GK, Vi phạm & Snapshot V3."""
    cfg = db.query(SystemConfig).first()
    periods = db.query(Period).filter(Period.year_num == year_num).order_by(Period.month_num.asc()).all()
    items = []
    for p in periods:
        sal_rows = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == p.period_code).all()
        tgt_rows = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == p.period_code).all()
        viol_cnt = db.query(ViolationRecord).filter(ViolationRecord.period_code == p.period_code).count()
        snap_rows = db.query(MonthlyHistorySnapshot).filter(
            MonthlyHistorySnapshot.year_num == year_num,
            MonthlyHistorySnapshot.month_num == p.month_num,
        ).all()

        sal_cnt = len(sal_rows)
        tgt_cnt = len(tgt_rows)
        snap_cnt = len(snap_rows)
        if sal_cnt > 0 and tgt_cnt > 0:
            readiness = "Đủ dữ liệu chi tiết"
        elif sal_cnt > 0:
            readiness = "Thiếu chỉ tiêu GK"
        elif tgt_cnt > 0:
            readiness = "Thiếu bảng lương"
        elif snap_cnt > 0:
            readiness = "Chỉ có Snapshot V3"
        else:
            readiness = "Chưa có dữ liệu"

        items.append({
            "period_code": p.period_code,
            "month_num": p.month_num,
            "period_name": p.period_name,
            "status": p.status,
            "standard_days": p.standard_days,
            "salary_count": sal_cnt,
            "salary_v1_sum": sum(r.base_v1 for r in sal_rows),
            "salary_v2_sum": sum(r.base_v2 for r in sal_rows),
            "salary_workdays_sum": sum(r.actual_workdays for r in sal_rows),
            "target_count": tgt_cnt,
            "target_ti_sum": round(sum(r.target_value for r in tgt_rows), 2),
            "target_ai_sum": round(sum(r.actual_value for r in tgt_rows), 2),
            "violation_count": viol_cnt,
            "snapshot_count": snap_cnt,
            "snapshot_v2_sum": sum(s.v2_paid for s in snap_rows),
            "readiness": readiness,
        })
    return {
        "year_num": year_num,
        "current_period_code": cfg.current_period_code if cfg else "2026-10",
        "employee_master_count": db.query(Employee).filter(Employee.is_active == True).count(),
        "indicator_master_count": db.query(Indicator).count(),
        "months": items,
    }


@router.post("/dataset/preview-salary")
async def preview_salary_dataset_api(
    scope: str = Query("SINGLE"),
    period_code: Optional[str] = Query(None),
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        return preview_salary_excel(db, content, scope=scope, period_code=period_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dataset/commit-salary")
async def commit_salary_dataset_api(
    scope: str = Query("SINGLE"),
    period_code: Optional[str] = Query(None),
    selected_months: Optional[str] = Query(None),
    overwrite_locked: bool = Query(False),
    sync_history: bool = Query(False),
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    content = await file.read()
    months_list = _parse_months_csv(selected_months)
    try:
        res = commit_salary_dataset(
            db, content, scope=scope, period_code=period_code,
            selected_months=months_list, replace_existing=True,
            overwrite_locked=overwrite_locked, sync_history=sync_history,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    p_names = ", ".join(x["period_code"] for x in res["applied_periods"])
    log_audit(db, "Admin_QuanLy", "IMPORT_DATASET_LUONG", p_names or (period_code or "ALL"), f"Nạp {res['count']} dòng lương từ {file.filename} ({res['sheet_name']})")
    msg = f"Đã nạp {res['count']} dòng lương cho {len(res['applied_periods'])} kỳ"
    if res["skipped_locked"]:
        msg += f" (Bỏ qua {len(res['skipped_locked'])} kỳ ĐÃ KHÓA: {', '.join(res['skipped_locked'])})"
    return {"message": msg, **res}


@router.post("/dataset/preview-targets")
async def preview_targets_dataset_api(
    scope: str = Query("SINGLE"),
    period_code: Optional[str] = Query(None),
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        return preview_targets_excel(db, content, scope=scope, period_code=period_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dataset/commit-targets")
async def commit_targets_dataset_api(
    scope: str = Query("SINGLE"),
    period_code: Optional[str] = Query(None),
    selected_months: Optional[str] = Query(None),
    overwrite_locked: bool = Query(False),
    sync_history: bool = Query(False),
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    content = await file.read()
    months_list = _parse_months_csv(selected_months)
    try:
        res = commit_targets_dataset(
            db, content, scope=scope, period_code=period_code,
            selected_months=months_list, replace_existing=True,
            overwrite_locked=overwrite_locked, sync_history=sync_history,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    p_names = ", ".join(x["period_code"] for x in res["applied_periods"])
    log_audit(db, "Admin_QuanLy", "IMPORT_DATASET_CHITIEU", p_names or (period_code or "ALL"), f"Nạp {res['count']} dòng chỉ tiêu từ {file.filename} ({res['sheet_name']})")
    msg = f"Đã nạp {res['count']} dòng chỉ tiêu cho {len(res['applied_periods'])} kỳ"
    if res["skipped_locked"]:
        msg += f" (Bỏ qua {len(res['skipped_locked'])} kỳ ĐÃ KHÓA: {', '.join(res['skipped_locked'])})"
    return {"message": msg, **res}


@router.post("/dataset/recalculate-history")
def recalculate_history_from_dataset(
    period_code: Optional[str] = Query(None),
    year_num: int = Query(2026),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tính lại điểm KPI & Lương V1/V2 từ dữ liệu Dataset chi tiết và cập nhật Snapshot TichLuy_V3."""
    if period_code:
        p = db.query(Period).filter(Period.period_code == period_code).first()
        if not p:
            raise HTTPException(status_code=404, detail="Không tìm thấy kỳ")
        cnt = sync_period_snapshot(db, p.period_code, frozen=(p.status == "ĐÃ KHÓA"))
        db.commit()
        log_audit(db, "Admin_QuanLy", "DONG_BO_SNAPSHOT_V3", p.period_name, f"Tính lại và đồng bộ {cnt} bản ghi từ Dataset chi tiết sang TichLuy_V3")
        return {"message": f"Đã đồng bộ Snapshot V3 cho {p.period_name} ({cnt} cán bộ)", "synced_periods": [p.period_code]}

    periods = db.query(Period).filter(Period.year_num == year_num, Period.status == "ĐÃ KHÓA").order_by(Period.month_num.asc()).all()
    synced = []
    for p in periods:
        has_sal = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == p.period_code).count() > 0
        has_tgt = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == p.period_code).count() > 0
        if has_sal and has_tgt:
            sync_period_snapshot(db, p.period_code, frozen=True)
            synced.append(p.period_code)
    db.commit()
    if not synced:
        raise HTTPException(status_code=400, detail="Không có kỳ ĐÃ KHÓA nào đủ cả dữ liệu Lương & Chỉ tiêu chi tiết để đồng bộ lại")
    log_audit(db, "Admin_QuanLy", "DONG_BO_SNAPSHOT_V3_ALL", f"Năm {year_num}", f"Đồng bộ lại {len(synced)} kỳ: {', '.join(synced)}")
    return {"message": f"Đã đồng bộ Snapshot V3 cho {len(synced)} kỳ đã khóa", "synced_periods": synced}


@router.get("/dataset/export-12-months")
def download_dataset_12_months(
    kind: str = Query("salary"),
    year_num: int = Query(2026),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if kind not in ("salary", "targets"):
        raise HTTPException(status_code=400, detail="kind phải là salary hoặc targets")
    data = export_dataset_12_months_excel(db, kind=kind, year_num=year_num)
    fname = f"DATASET_LUONG_12_THANG_{year_num}.xlsx" if kind == "salary" else f"DATASET_CHI_TIEU_12_THANG_{year_num}.xlsx"
    log_audit(db, "Admin_QuanLy", "XUAT_DATASET_12_THANG", fname, f"Xuất toàn bộ dataset {kind} năm {year_num} (13 sheet chuẩn)")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )

