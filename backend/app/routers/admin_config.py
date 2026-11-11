from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import IS_SQLITE
from ..database import get_db
from ..models import (
    SystemConfig, RatingTier, Period, Employee, Indicator, InternalRule, KpiErrorCode,
    SalaryImportRow, TargetExecutionRow, ViolationRecord,
    KpiMonthlyOverride, MonthlyHistorySnapshot, AuditLog
)
from ..auth import require_admin, get_current_user
from ..audit import log_audit
from ..engine import compute_period_kpi_and_payroll, compute_accumulation_v3, sync_period_snapshot

router = APIRouter(prefix="/api/admin", tags=["Admin Config & Periods"])


class ConfigUpdateReq(BaseModel):
    org_name: Optional[str] = None
    unit_name: Optional[str] = None
    w_cm: Optional[float] = None
    w_kpi: Optional[float] = None
    w_reserve: Optional[float] = None
    w_kpi_dv: Optional[float] = None
    w_kpi_hdv: Optional[float] = None
    w_kpi_dn: Optional[float] = None
    indirect_target_ratio: Optional[float] = None
    cm_base_score: Optional[float] = None
    cm_max_score: Optional[float] = None
    cm_min_score: Optional[float] = None
    cm_floor_enabled: Optional[bool] = None
    max_total_deduction: Optional[float] = None
    ksv_deduction_ratio: Optional[float] = None
    ksv_monthly_cap: Optional[float] = None
    approver_deduction_ratio: Optional[float] = None
    approver_monthly_cap: Optional[float] = None
    standard_workdays: Optional[float] = None
    use_period_standard_days: Optional[bool] = None
    v2_monthly_fund: Optional[float] = None
    v2_fund_mode: Optional[str] = None
    base_salary_agribank: Optional[float] = None
    kv2_general: Optional[float] = None
    tcv_max_cap: Optional[float] = None
    tcv_min_floor: Optional[float] = None
    qns_mode: Optional[str] = None
    qns_months: Optional[float] = None
    qns_manual_amount: Optional[float] = None
    v3_fund_amount: Optional[float] = None
    sync_v3_with_qns: Optional[bool] = None
    dv_agg_mode: Optional[str] = None
    kpi_cap_mode: Optional[str] = None
    missing_kpi_policy: Optional[str] = None
    tcv_mode: Optional[str] = None
    workday_ratio_cap: Optional[bool] = None
    nsi_basis: Optional[str] = None
    monthly_takehome_mode: Optional[str] = None
    v3_allocation_method: Optional[str] = None
    rounding_residual_to_last: Optional[bool] = None
    recalc_indirect_targets: bool = False


class TierItem(BaseModel):
    code: str
    sort_order: int
    min_score: float
    max_score: float
    ki_month: float
    kq_settlement: float
    h3_v3: float
    description: str


class SimulateReq(BaseModel):
    period_code: Optional[str] = None
    config: Dict[str, Any] = {}
    tiers: Optional[List[Dict[str, Any]]] = None
    include_open_in_v3: bool = False


class PeriodUpdateReq(BaseModel):
    standard_days: Optional[float] = None
    note: Optional[str] = None
    status: Optional[str] = None


class ClearMonthsReq(BaseModel):
    period_codes: List[str]
    scopes: Optional[List[str]] = None


def _serialize_config(cfg: SystemConfig) -> Dict[str, Any]:
    return {
        "org_name": cfg.org_name,
        "unit_name": cfg.unit_name,
        "current_period_code": cfg.current_period_code,
        "current_period_name": cfg.current_period_name,
        "w_cm": cfg.w_cm,
        "w_kpi": cfg.w_kpi,
        "w_reserve": cfg.w_reserve,
        "w_kpi_dv": cfg.w_kpi_dv,
        "w_kpi_hdv": cfg.w_kpi_hdv,
        "w_kpi_dn": cfg.w_kpi_dn,
        "indirect_target_ratio": cfg.indirect_target_ratio,
        "cm_base_score": cfg.cm_base_score,
        "cm_max_score": cfg.cm_max_score,
        "cm_min_score": cfg.cm_min_score,
        "cm_floor_enabled": cfg.cm_floor_enabled,
        "max_total_deduction": cfg.max_total_deduction,
        "ksv_deduction_ratio": cfg.ksv_deduction_ratio,
        "ksv_monthly_cap": cfg.ksv_monthly_cap,
        "approver_deduction_ratio": cfg.approver_deduction_ratio,
        "approver_monthly_cap": cfg.approver_monthly_cap,
        "standard_workdays": cfg.standard_workdays,
        "use_period_standard_days": cfg.use_period_standard_days,
        "v2_monthly_fund": cfg.v2_monthly_fund,
        "v2_fund_mode": cfg.v2_fund_mode,
        "base_salary_agribank": cfg.base_salary_agribank,
        "kv2_general": cfg.kv2_general,
        "tcv_max_cap": cfg.tcv_max_cap,
        "tcv_min_floor": cfg.tcv_min_floor,
        "qns_mode": cfg.qns_mode,
        "qns_months": cfg.qns_months,
        "qns_manual_amount": cfg.qns_manual_amount,
        "v3_fund_amount": cfg.v3_fund_amount,
        "sync_v3_with_qns": cfg.sync_v3_with_qns,
        "dv_agg_mode": cfg.dv_agg_mode,
        "kpi_cap_mode": cfg.kpi_cap_mode,
        "missing_kpi_policy": cfg.missing_kpi_policy,
        "tcv_mode": cfg.tcv_mode,
        "workday_ratio_cap": cfg.workday_ratio_cap,
        "nsi_basis": cfg.nsi_basis,
        "monthly_takehome_mode": cfg.monthly_takehome_mode,
        "v3_allocation_method": cfg.v3_allocation_method,
        "rounding_residual_to_last": cfg.rounding_residual_to_last,
    }


@router.get("/config")
def get_config(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    tiers = db.query(RatingTier).order_by(RatingTier.sort_order.asc()).all()
    inds = db.query(Indicator).order_by(Indicator.sort_order.asc()).all()
    return {
        "config": _serialize_config(cfg),
        "tiers": [
            {
                "id": t.id,
                "code": t.code,
                "sort_order": t.sort_order,
                "min_score": t.min_score,
                "max_score": t.max_score,
                "ki_month": t.ki_month,
                "kq_settlement": t.kq_settlement,
                "h3_v3": t.h3_v3,
                "description": t.description,
            }
            for t in tiers
        ],
        "indicator_weights": [
            {"code": i.code, "name": i.name, "kpi_branch": i.kpi_branch, "weight": i.weight}
            for i in inds
        ],
    }


@router.put("/config")
def update_config(req: ConfigUpdateReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    data = req.model_dump(exclude_none=True, exclude={"recalc_indirect_targets"})

    # Validate pillar weights
    new_w_cm = data.get("w_cm", cfg.w_cm)
    new_w_kpi = data.get("w_kpi", cfg.w_kpi)
    new_w_res = data.get("w_reserve", cfg.w_reserve)
    if abs((new_w_cm + new_w_kpi + new_w_res) - 1.0) > 0.001:
        raise HTTPException(status_code=400, detail="Tổng trọng số 3 trụ cột (Chuyên môn + KPI + Dự phòng) phải bằng 100% (1.0)")

    new_dv = data.get("w_kpi_dv", cfg.w_kpi_dv)
    new_hdv = data.get("w_kpi_hdv", cfg.w_kpi_hdv)
    new_dn = data.get("w_kpi_dn", cfg.w_kpi_dn)
    if abs((new_dv + new_hdv + new_dn) - 1.0) > 0.001:
        raise HTTPException(status_code=400, detail="Tổng trọng số con KPI (Dịch vụ + Huy động vốn + Dư nợ) phải bằng 100% (1.0)")

    for k, v in data.items():
        setattr(cfg, k, v)

    if req.recalc_indirect_targets:
        inds = db.query(Indicator).all()
        for ind in inds:
            ind.target_indirect = round(ind.target_direct * cfg.indirect_target_ratio, 4)

    db.commit()
    log_audit(db, "Admin_QuanLy", "CAP_NHAT_CONG_THUC", cfg.current_period_name, "Cập nhật tham số, trọng số và cấu hình công thức toàn hệ thống")
    return {"message": "Đã lưu cấu hình công thức & tham số thành công", "config": _serialize_config(cfg)}


@router.put("/rating-tiers")
def update_rating_tiers(tiers: List[TierItem], user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    for item in tiers:
        if item.min_score > item.max_score:
            raise HTTPException(
                status_code=400,
                detail=f"Mức điểm sàn ({item.min_score}) không thể lớn hơn điểm trần ({item.max_score}) ở hạng {item.code}",
            )
    for item in tiers:
        t = db.query(RatingTier).filter(RatingTier.code == item.code).first()
        if t:
            t.min_score = item.min_score
            t.max_score = item.max_score
            t.ki_month = item.ki_month
            t.kq_settlement = item.kq_settlement
            t.h3_v3 = item.h3_v3
            t.description = item.description
            t.sort_order = item.sort_order
        else:
            db.add(RatingTier(**item.model_dump()))
    db.commit()
    log_audit(db, "Admin_QuanLy", "CAP_NHAT_MA_TRAN_XEP_LOAI", "Admin_ThamSo", "Cập nhật Ma trận thang điểm xếp loại & hệ số lương")
    return {"message": "Đã cập nhật Ma trận xếp loại thành công"}


@router.post("/config/simulate")
def simulate_formulas(req: SimulateReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Chạy giả lập công thức & trọng số mới trên dữ liệu thực tế (Trước vs Sau) mà không ghi đè DB."""
    cfg = db.query(SystemConfig).first()
    pcode = req.period_code or cfg.current_period_code

    baseline = compute_period_kpi_and_payroll(db, pcode)
    simulated = compute_period_kpi_and_payroll(db, pcode, config_override=req.config, tiers_override=req.tiers)
    base_v3 = compute_accumulation_v3(db, include_open_period=req.include_open_in_v3)
    sim_v3 = compute_accumulation_v3(db, include_open_period=req.include_open_in_v3, config_override=req.config, tiers_override=req.tiers)

    base_pay_map = {r["emp_code"]: r for r in baseline["payroll_rows"]}
    base_v3_map = {r["emp_code"]: r for r in base_v3["rows"]}
    sim_v3_map = {r["emp_code"]: r for r in sim_v3["rows"]}

    comparisons = []
    for r in simulated["payroll_rows"]:
        ec = r["emp_code"]
        b = base_pay_map.get(ec, {})
        bv3 = base_v3_map.get(ec, {}).get("year", {}).get("v3_amount", 0.0)
        sv3 = sim_v3_map.get(ec, {}).get("year", {}).get("v3_amount", 0.0)
        comparisons.append({
            "emp_code": ec,
            "full_name": r["full_name"],
            "old_work_score": b.get("work_score", 0.0),
            "new_work_score": r["work_score"],
            "old_tcv": b.get("tcv", 0.0),
            "new_tcv": r["tcv"],
            "old_rating": b.get("rating", ""),
            "new_rating": r["rating"],
            "old_v2_adj": b.get("v2_adj", 0.0),
            "new_v2_adj": r["v2_adj"],
            "delta_v2": r["v2_adj"] - b.get("v2_adj", 0.0),
            "old_takehome": b.get("takehome", 0.0),
            "new_takehome": r["takehome"],
            "delta_takehome": r["takehome"] - b.get("takehome", 0.0),
            "old_v3": bv3,
            "new_v3": sv3,
            "delta_v3": sv3 - bv3,
        })

    return {
        "period_code": pcode,
        "baseline_totals": baseline["totals"],
        "simulated_totals": simulated["totals"],
        "baseline_avg_score": baseline["dashboard"]["avg_work_score"],
        "simulated_avg_score": simulated["dashboard"]["avg_work_score"],
        "baseline_v3_total": base_v3["totals"]["v3_amount"],
        "simulated_v3_total": sim_v3["totals"]["v3_amount"],
        "comparisons": comparisons,
    }


@router.post("/config/reset-defaults")
def reset_formula_defaults(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    cfg.w_cm = 0.75
    cfg.w_kpi = 0.25
    cfg.w_reserve = 0.0
    cfg.w_kpi_dv = 0.50
    cfg.w_kpi_hdv = 0.50
    cfg.w_kpi_dn = 0.0
    cfg.indirect_target_ratio = 0.50
    cfg.cm_base_score = 100.0
    cfg.cm_max_score = 100.0
    cfg.cm_min_score = 70.0
    cfg.cm_floor_enabled = False
    cfg.max_total_deduction = 0.0
    cfg.ksv_deduction_ratio = 0.50
    cfg.ksv_monthly_cap = 10.0
    cfg.approver_deduction_ratio = 0.25
    cfg.approver_monthly_cap = 5.0
    cfg.kv2_general = 1.0
    cfg.tcv_max_cap = 1.0
    cfg.tcv_min_floor = 0.0
    cfg.dv_agg_mode = "SIMPLE_AVG"
    cfg.kpi_cap_mode = "GROUP_CAP"
    cfg.missing_kpi_policy = "ZERO"
    cfg.tcv_mode = "LINEAR"
    cfg.workday_ratio_cap = False
    cfg.nsi_basis = "TOTAL_AFTER_ADJ"
    cfg.monthly_takehome_mode = "V1_V2_ONLY"
    cfg.v3_allocation_method = "V1_PLUS_V2QT"
    cfg.qns_mode = "AUTO_SUM_BEFORE_ADJ"
    cfg.sync_v3_with_qns = True
    cfg.rounding_residual_to_last = True
    db.commit()
    log_audit(db, "Admin_QuanLy", "KHOI_PHUC_MAC_DINH", "Admin_ThamSo", "Khôi phục bộ công thức & trọng số chuẩn Hội sở Agribank 2026")
    return {"message": "Đã khôi phục công thức & trọng số mặc định chuẩn 2026", "config": _serialize_config(cfg)}


# ---- PERIODS MANAGEMENT (TrangThai_Ky) ----
@router.get("/periods")
def list_periods(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    periods = db.query(Period).order_by(Period.month_num.asc()).all()
    cfg = db.query(SystemConfig).first()
    return {
        "current_period_code": cfg.current_period_code if cfg else "",
        "periods": [
            {
                "id": p.id,
                "period_code": p.period_code,
                "month_num": p.month_num,
                "year_num": p.year_num,
                "period_name": p.period_name,
                "status": p.status,
                "closed_date": p.closed_date,
                "note": p.note,
                "standard_days": p.standard_days,
            }
            for p in periods
        ],
    }


_VALID_PERIOD_STATUSES = ("CHƯA MỞ", "ĐANG MỞ", "ĐÃ KHÓA")


def _set_period_snapshots_frozen(db: Session, p: Period, frozen: bool):
    for s in db.query(MonthlyHistorySnapshot).filter(
        MonthlyHistorySnapshot.year_num == p.year_num,
        MonthlyHistorySnapshot.month_num == p.month_num,
    ).all():
        s.is_frozen = frozen


def _finalize_lock_period(db: Session, p: Period, sync_snapshot: bool = True) -> bool:
    has_sal = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == p.period_code).count() > 0
    synced = False
    if sync_snapshot and has_sal:
        sync_period_snapshot(db, p.period_code, frozen=True)
        synced = True
    else:
        _set_period_snapshots_frozen(db, p, True)
    today_str = datetime.now().strftime("%d/%m/%Y")
    p.status = "ĐÃ KHÓA"
    p.closed_date = today_str
    q_notes = {3: " & Quyết toán Quý I", 6: " & Quyết toán Quý II", 9: " & Quyết toán Quý III", 12: " & Quyết toán Quý IV / Cả Năm V3"}
    p.note = f"Đã chốt sổ ngày {today_str}{q_notes.get(p.month_num, '')}"
    return synced


@router.put("/periods/{period_code}")
def update_period(period_code: str, req: PeriodUpdateReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.query(Period).filter(Period.period_code == period_code).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỳ")

    prev_status = p.status
    prev_note = p.note
    target_status = req.status.strip() if req.status is not None else None
    if target_status is not None and target_status not in _VALID_PERIOD_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Trạng thái kỳ không hợp lệ '{target_status}'. Chỉ chấp nhận: {', '.join(_VALID_PERIOD_STATUSES)}",
        )

    if req.standard_days is not None:
        if req.standard_days <= 0:
            raise HTTPException(status_code=400, detail="Ngày công chuẩn phải lớn hơn 0")
        days_changed = abs(float(req.standard_days) - float(p.standard_days)) > 1e-9
        # Không cho đổi ngày công chuẩn trên kỳ đang ĐÃ KHÓA mà không mở khóa sửa
        if days_changed and prev_status == "ĐÃ KHÓA" and target_status in (None, "ĐÃ KHÓA"):
            raise HTTPException(
                status_code=400,
                detail=f"Kỳ {p.period_name} đang ĐÃ KHÓA, vui lòng Mở khóa sửa trước khi thay đổi ngày công chuẩn",
            )
        p.standard_days = req.standard_days

    snapshot_synced = False
    if target_status == "ĐÃ KHÓA":
        # Mọi luồng chuyển sang ĐÃ KHÓA đều phải đi qua bước đồng bộ & đóng băng Snapshot V3
        if prev_status != "ĐÃ KHÓA":
            snapshot_synced = _finalize_lock_period(db, p, sync_snapshot=True)
        else:
            _set_period_snapshots_frozen(db, p, True)
        if req.note is not None and req.note != prev_note:
            p.note = req.note
    else:
        if req.note is not None:
            p.note = req.note
        if target_status is not None and target_status != prev_status:
            p.status = target_status
            if prev_status == "ĐÃ KHÓA":
                p.closed_date = ""
                _set_period_snapshots_frozen(db, p, False)

    db.commit()
    log_audit(
        db,
        "Admin_QuanLy",
        "KHOA_KY_LUONG" if (target_status == "ĐÃ KHÓA" and prev_status != "ĐÃ KHÓA") else "CAP_NHAT_KY",
        p.period_name,
        f"Cập nhật kỳ {p.period_name}: Kchuẩn={p.standard_days}, Trạng thái={p.status} (snapshot_synced={snapshot_synced})",
    )
    return {
        "message": f"Đã cập nhật kỳ {p.period_name}",
        "period_code": p.period_code,
        "status": p.status,
        "standard_days": p.standard_days,
        "snapshot_synced": snapshot_synced,
    }


@router.post("/periods/close-current")
def close_current_period(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Chốt sổ & đóng băng kỳ ĐANG MỞ vào TichLuy_V3 (sửa lỗi lưu nhầm V1 ở VBA)."""
    cfg = db.query(SystemConfig).first()
    open_p = None
    if cfg and cfg.current_period_code:
        cand = db.query(Period).filter(Period.period_code == cfg.current_period_code, Period.status == "ĐANG MỞ").first()
        open_p = cand
    if not open_p:
        open_p = db.query(Period).filter(Period.status == "ĐANG MỞ").first()
    if not open_p:
        raise HTTPException(status_code=400, detail="Hiện tại không có kỳ nào ở trạng thái ĐANG MỞ")

    _finalize_lock_period(db, open_p, sync_snapshot=True)
    db.commit()
    log_audit(db, "Admin_QuanLy", "KHOA_KY_LUONG", open_p.period_name, f"Đã chốt sổ, đóng băng dữ liệu KPI/V1/V2/Ngày công kỳ {open_p.period_name} vào Tích lũy V3")
    return {"message": f"Đã chốt sổ & đóng băng thành công kỳ {open_p.period_name}"}


@router.post("/periods/{period_code}/reopen")
def reopen_period_for_edit(period_code: str, switch_to_current: bool = True, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Mở lại / mở khóa một kỳ ĐÃ KHÓA hoặc CHƯA MỞ sang trạng thái ĐANG MỞ để Quản trị chỉnh sửa dữ liệu."""
    p = db.query(Period).filter(Period.period_code == period_code).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỳ")
    prev_status = p.status
    p.status = "ĐANG MỞ"
    p.closed_date = ""
    p.note = f"Đang mở khóa chỉnh sửa (trước đó: {prev_status})"
    if prev_status == "ĐÃ KHÓA":
        _set_period_snapshots_frozen(db, p, False)
    cfg = db.query(SystemConfig).first()
    if switch_to_current and cfg:
        cfg.current_period_code = p.period_code
        cfg.current_period_name = p.period_name
    db.commit()
    log_audit(db, "Admin_QuanLy", "MO_KHOA_SUA_KY", p.period_name, f"Chuyển {p.period_name} từ '{prev_status}' sang 'ĐANG MỞ' để chỉnh sửa")
    return {
        "message": f"Đã mở khóa kỳ {p.period_name} sang ĐANG MỞ để chỉnh sửa",
        "period_code": p.period_code,
        "status": p.status,
    }


@router.post("/periods/{period_code}/lock")
def lock_specific_period(period_code: str, sync_snapshot: bool = True, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Chốt sổ & khóa trực tiếp kỳ được chọn (tự động đồng bộ Snapshot V3 nếu kỳ có dữ liệu chi tiết)."""
    p = db.query(Period).filter(Period.period_code == period_code).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỳ")
    _finalize_lock_period(db, p, sync_snapshot=sync_snapshot)
    db.commit()
    log_audit(db, "Admin_QuanLy", "KHOA_KY_LUONG", p.period_name, f"Đã chốt sổ & khóa kỳ {p.period_name} (sync_snapshot={sync_snapshot})")
    return {
        "message": f"Đã khóa thành công kỳ {p.period_name}",
        "period_code": p.period_code,
        "status": p.status,
    }


@router.post("/periods/open-next")
def open_next_period(carry_forward_data: bool = True, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Mở kỳ CHƯA MỞ tiếp theo (tùy chọn kế thừa danh sách nhân sự/chỉ tiêu sang kỳ mới nếu chưa có)."""
    open_p = db.query(Period).filter(Period.status == "ĐANG MỞ").first()
    if open_p:
        raise HTTPException(status_code=400, detail=f"Đang có kỳ [{open_p.period_name}] ở trạng thái ĐANG MỞ. Vui lòng chốt sổ kỳ này trước khi mở kỳ mới.")

    next_p = db.query(Period).filter(Period.status == "CHƯA MỞ").order_by(Period.month_num.asc()).first()
    if not next_p:
        raise HTTPException(status_code=400, detail="Tất cả 12 kỳ trong năm 2026 đã mở hoặc đã khóa")

    cfg = db.query(SystemConfig).first()
    prev_code = cfg.current_period_code

    next_p.status = "ĐANG MỞ"
    next_p.closed_date = ""
    next_p.note = "Kỳ tính toán & Import hiện hành"
    cfg.current_period_code = next_p.period_code
    cfg.current_period_name = next_p.period_name

    # Nếu chưa có dữ liệu lương kỳ mới và bật carry_forward_data -> khởi tạo khung mặc định từ 1.DM_CanBo để sẵn sàng chấm công/nhập liệu
    if carry_forward_data:
        existing_sal_cnt = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == next_p.period_code).count()
        if existing_sal_cnt == 0:
            for e in db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc()).all():
                db.add(SalaryImportRow(
                    period_code=next_p.period_code,
                    emp_code=e.emp_code,
                    full_name=e.full_name,
                    title=e.title,
                    department=e.department,
                    group_name=e.group_name,
                    labor_type=e.labor_type,
                    hsl_v1=e.hsl_v1,
                    base_v1=e.base_v1,
                    base_v2=e.base_v2,
                    actual_workdays=next_p.standard_days,
                    status="Hợp lệ",
                ))
        existing_tgt_cnt = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == next_p.period_code).count()
        if existing_tgt_cnt == 0 and prev_code:
            for tr in db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == prev_code).all():
                db.add(TargetExecutionRow(
                    period_code=next_p.period_code,
                    emp_code=tr.emp_code,
                    indicator_code=tr.indicator_code,
                    target_value=tr.target_value,
                    actual_value=0.0,
                    status="Khởi tạo kỳ mới",
                ))

    db.commit()
    log_audit(db, "Admin_QuanLy", "MO_KY_MOI", next_p.period_name, f"Đã mở kỳ tính lương mới: {next_p.period_name}")
    return {"message": f"Đã mở thành công kỳ {next_p.period_name}", "current_period_code": next_p.period_code, "current_period_name": next_p.period_name}


@router.post("/periods/switch/{period_code}")
def switch_current_period(period_code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.query(Period).filter(Period.period_code == period_code).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỳ")
    cfg = db.query(SystemConfig).first()
    cfg.current_period_code = p.period_code
    cfg.current_period_name = p.period_name
    db.commit()
    log_audit(db, "Admin_QuanLy", "DOI_KY_LAM_VIEC", p.period_name, f"Chuyển kỳ làm việc hiện hành sang: {p.period_name}")
    return {"message": f"Đã chuyển kỳ hiện hành sang {p.period_name}", "current_period_code": p.period_code, "current_period_name": p.period_name}


_VALID_CLEAR_SCOPES = ("salary", "targets", "violations", "overrides", "snapshot_v3")
_DEFAULT_OPERATIONAL_SCOPES = ["salary", "targets", "violations", "overrides"]


def _normalize_clear_scopes(scopes: Optional[List[str]]) -> List[str]:
    if not scopes:
        return list(_DEFAULT_OPERATIONAL_SCOPES)
    if "all" in scopes:
        return list(_VALID_CLEAR_SCOPES)
    invalid = [s for s in scopes if s not in _VALID_CLEAR_SCOPES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Phạm vi xóa dữ liệu không hợp lệ: {', '.join(invalid)}")
    # Giữ thứ tự chuẩn, loại trùng
    seen = set()
    normalized = []
    for s in scopes:
        if s not in seen:
            seen.add(s)
            normalized.append(s)
    return normalized


def _clear_period_by_scopes(db: Session, pcode: str, period_obj: Optional[Period], scopes: List[str]) -> Dict[str, int]:
    """Xóa dữ liệu theo từng nhóm bảng của một kỳ, trả về số dòng đã xóa theo từng phạm vi."""
    counts: Dict[str, int] = {}
    if "salary" in scopes:
        counts["salary"] = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode).delete()
    if "targets" in scopes:
        counts["targets"] = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == pcode).delete()
    if "violations" in scopes:
        counts["violations"] = db.query(ViolationRecord).filter(ViolationRecord.period_code == pcode).delete()
    if "overrides" in scopes:
        counts["overrides"] = db.query(KpiMonthlyOverride).filter(KpiMonthlyOverride.period_code == pcode).delete()
    if "snapshot_v3" in scopes and period_obj is not None:
        counts["snapshot_v3"] = db.query(MonthlyHistorySnapshot).filter(
            MonthlyHistorySnapshot.year_num == period_obj.year_num,
            MonthlyHistorySnapshot.month_num == period_obj.month_num,
        ).delete()
    return counts


@router.get("/periods/data-summary")
def get_periods_data_summary(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Thống kê số dòng dữ liệu hiện có của cả 12 kỳ để phục vụ kiểm soát & xóa dữ liệu theo tháng."""
    periods = db.query(Period).order_by(Period.year_num.asc(), Period.month_num.asc()).all()

    sal_map = dict(db.query(SalaryImportRow.period_code, func.count(SalaryImportRow.id)).group_by(SalaryImportRow.period_code).all())
    tgt_map = dict(db.query(TargetExecutionRow.period_code, func.count(TargetExecutionRow.id)).group_by(TargetExecutionRow.period_code).all())
    vio_map = dict(db.query(ViolationRecord.period_code, func.count(ViolationRecord.id)).group_by(ViolationRecord.period_code).all())
    ovr_map = dict(db.query(KpiMonthlyOverride.period_code, func.count(KpiMonthlyOverride.id)).group_by(KpiMonthlyOverride.period_code).all())
    snap_rows = db.query(
        MonthlyHistorySnapshot.year_num,
        MonthlyHistorySnapshot.month_num,
        func.count(MonthlyHistorySnapshot.id),
    ).group_by(MonthlyHistorySnapshot.year_num, MonthlyHistorySnapshot.month_num).all()
    snap_map = {(y, m): c for y, m, c in snap_rows}

    summary = []
    for p in periods:
        sal_cnt = int(sal_map.get(p.period_code, 0))
        tgt_cnt = int(tgt_map.get(p.period_code, 0))
        vio_cnt = int(vio_map.get(p.period_code, 0))
        ovr_cnt = int(ovr_map.get(p.period_code, 0))
        snap_cnt = int(snap_map.get((p.year_num, p.month_num), 0))
        summary.append({
            "period_code": p.period_code,
            "month_num": p.month_num,
            "year_num": p.year_num,
            "period_name": p.period_name,
            "status": p.status,
            "salary_count": sal_cnt,
            "target_count": tgt_cnt,
            "violation_count": vio_cnt,
            "override_count": ovr_cnt,
            "snapshot_count": snap_cnt,
            "total_rows": sal_cnt + tgt_cnt + vio_cnt + ovr_cnt + snap_cnt,
        })
    return {"periods": summary}


@router.post("/periods/clear-by-months")
def clear_data_by_months(req: ClearMonthsReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Xóa dữ liệu theo một hoặc nhiều tháng đã chọn với phạm vi dữ liệu tùy chọn (chặn kỳ ĐÃ KHÓA)."""
    if not req.period_codes:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một tháng cần xóa dữ liệu")

    scopes = _normalize_clear_scopes(req.scopes)
    # Loại trùng danh sách mã kỳ nhưng giữ nguyên thứ tự
    unique_codes = list(dict.fromkeys(c.strip() for c in req.period_codes if c and c.strip()))
    if not unique_codes:
        raise HTTPException(status_code=400, detail="Danh sách mã kỳ cần xóa không hợp lệ")

    periods_map = {
        p.period_code: p
        for p in db.query(Period).filter(Period.period_code.in_(unique_codes)).all()
    }
    missing = [c for c in unique_codes if c not in periods_map]
    if missing:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy kỳ: {', '.join(missing)}")

    locked = [periods_map[c].period_name for c in unique_codes if periods_map[c].status == "ĐÃ KHÓA"]
    if locked:
        raise HTTPException(
            status_code=400,
            detail=f"Các kỳ đang ĐÃ KHÓA ({', '.join(locked)}) không thể xóa dữ liệu. Hãy vào '1.2 Quản lý 12 kỳ' để Mở khóa sửa trước nếu cần.",
        )

    details: Dict[str, Dict[str, int]] = {}
    total_deleted = 0
    cleared_names = []
    for c in unique_codes:
        p = periods_map[c]
        counts = _clear_period_by_scopes(db, c, p, scopes)
        details[c] = counts
        total_deleted += sum(counts.values())
        cleared_names.append(p.period_name)

    db.commit()
    scope_label = ", ".join(scopes)
    log_audit(
        db,
        "Admin_QuanLy",
        "XOA_DU_LIEU_THANG",
        ", ".join(unique_codes),
        f"Đã xóa dữ liệu của {len(unique_codes)} kỳ ({', '.join(cleared_names)}); phạm vi=[{scope_label}]; tổng={total_deleted} dòng",
    )
    return {
        "message": f"Đã xóa {total_deleted} dòng dữ liệu cho {len(unique_codes)} tháng ({', '.join(cleared_names)})",
        "cleared_periods": unique_codes,
        "scopes": scopes,
        "total_deleted": total_deleted,
        "details": details,
    }


@router.post("/periods/clear-current-data")
def clear_current_period_data(period_code: Optional[str] = None, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    cfg = db.query(SystemConfig).first()
    pcode = period_code or cfg.current_period_code
    p = db.query(Period).filter(Period.period_code == pcode).first()
    if p and p.status == "ĐÃ KHÓA":
        raise HTTPException(status_code=400, detail=f"Kỳ {p.period_name} đang ĐÃ KHÓA, không thể xóa dữ liệu")

    counts = _clear_period_by_scopes(db, pcode, p, _DEFAULT_OPERATIONAL_SCOPES)
    total_deleted = sum(counts.values())
    db.commit()
    log_audit(db, "Admin_QuanLy", "XOA_DU_LIEU_KY", p.period_name if p else pcode, f"Đã xóa toàn bộ số liệu phát sinh (lương import, chỉ tiêu, chấm công, vi phạm) của kỳ {pcode} ({total_deleted} dòng)")
    return {"message": f"Đã làm sạch dữ liệu kỳ {p.period_name if p else pcode} ({total_deleted} dòng)", "deleted_counts": counts}


# ---- BẢNG DỮ LIỆU CSDL TRÊN WEB (DATABASE EXPLORER CHO QUẢN TRỊ) ----
_DB_TABLE_REGISTRY = [
    ("employees", "1. Danh mục Cán bộ (employees)", Employee),
    ("periods", "2. Danh sách 12 Kỳ lương (periods)", Period),
    ("salary_import_rows", "3. Bảng lương V1+V2 & Chấm công theo kỳ (salary_import_rows)", SalaryImportRow),
    ("indicators", "4. Cây Chỉ tiêu Giao khoán GK (indicators)", Indicator),
    ("target_execution_rows", "5. Kết quả thực hiện Chỉ tiêu P2 (target_execution_rows)", TargetExecutionRow),
    ("violation_records", "6. Nhật ký Vi phạm & Hàng chờ KSV (violation_records)", ViolationRecord),
    ("kpi_monthly_overrides", "7. Điểm Ưu tiên / Ghi chú tháng (kpi_monthly_overrides)", KpiMonthlyOverride),
    ("monthly_history_snapshots", "8. Lịch sử Tích lũy V3 12 tháng (monthly_history_snapshots)", MonthlyHistorySnapshot),
    ("internal_rules", "9. Danh mục Nội quy P1 (internal_rules)", InternalRule),
    ("kpi_error_codes", "10. Kho 1.118 Mã lỗi KPI P3 (kpi_error_codes)", KpiErrorCode),
    ("rating_tiers", "11. Ma trận Thang điểm & Hệ số (rating_tiers)", RatingTier),
    ("system_config", "12. Cấu hình Tham số & Công thức (system_config)", SystemConfig),
    ("audit_logs", "13. Nhật ký Kiểm toán (audit_logs)", AuditLog),
]
_DB_TABLE_MAP = {name: (label, model) for name, label, model in _DB_TABLE_REGISTRY}
_SECRET_COLS = {"password_hash", "admin_password_hash"}


def _serialize_model_row(obj, col_names: List[str]) -> Dict[str, Any]:
    out = {}
    for c in col_names:
        val = getattr(obj, c, None)
        out[c] = "*** (đã mã hóa)" if c in _SECRET_COLS and val else val
    return out


@router.get("/database-overview")
def get_database_overview(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Liệt kê toàn bộ 13 bảng dữ liệu của hệ thống Web cùng số dòng thực tế."""
    tables = []
    total_records = 0
    for name, label, model in _DB_TABLE_REGISTRY:
        cnt = db.query(model).count()
        total_records += cnt
        cols = [col.name for col in model.__table__.columns if col.name not in _SECRET_COLS]
        tables.append({
            "table_name": name,
            "label": label,
            "row_count": cnt,
            "column_count": len(cols),
            "columns": cols,
        })
    return {
        "engine": "SQLite (backend/data/agribank_kpi_3p.db)" if IS_SQLITE else "PostgreSQL (Cloud)",
        "table_count": len(tables),
        "total_records": total_records,
        "tables": tables,
    }


@router.get("/database-table/{table_name}")
def get_database_table_rows(
    table_name: str,
    q: str = Query(""),
    limit: int = Query(150, le=500),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if table_name not in _DB_TABLE_MAP:
        raise HTTPException(status_code=404, detail=f"Không tồn tại bảng dữ liệu '{table_name}'")
    label, model = _DB_TABLE_MAP[table_name]
    cols = [col.name for col in model.__table__.columns if col.name not in _SECRET_COLS]
    all_objs = db.query(model).all()

    ql = q.strip().lower()
    matched = []
    for obj in all_objs:
        row_dict = _serialize_model_row(obj, cols)
        if ql:
            haystack = " ".join(str(v) for v in row_dict.values() if v is not None).lower()
            if ql not in haystack:
                continue
        matched.append(row_dict)

    return {
        "table_name": table_name,
        "label": label,
        "total_matched": len(matched),
        "columns": cols,
        "rows": matched[offset: offset + limit],
    }

