from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from .models import (
    SystemConfig, RatingTier, Period, Employee, Indicator,
    SalaryImportRow, TargetExecutionRow, ViolationRecord,
    KpiMonthlyOverride, MonthlyHistorySnapshot
)
from .utils_vi import doc_so_thanh_chu


def excel_round(val, digits: int = 0) -> float:
    """Làm tròn kiểu Excel ROUND (half away from zero), hỗ trợ Decimal & float 15 chữ số."""
    if val is None:
        return 0.0
    if isinstance(val, Decimal):
        d = val
    else:
        # Excel giới hạn độ chính xác 15 chữ số có nghĩa trước khi ROUND (tránh .499999999 do binary float)
        d = Decimal(f"{float(val):.15g}")
    q = Decimal("1") if digits <= 0 else Decimal("0." + "0" * (digits - 1) + "1")
    rounded = d.quantize(q, rounding=ROUND_HALF_UP)
    return float(int(rounded)) if digits == 0 else float(rounded)


def determine_tier(score: float, tiers: List[RatingTier]) -> RatingTier:
    """Xác định xếp loại từ danh sách RatingTier sắp xếp theo min_score giảm dần."""
    ordered = sorted(tiers, key=lambda t: t.min_score, reverse=True)
    for t in ordered:
        if score >= t.min_score:
            return t
    return ordered[-1]


def compute_period_kpi_and_payroll(
    db: Session,
    period_code: str,
    config_override: Optional[Dict[str, Any]] = None,
    tiers_override: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Tính toán toàn bộ KPI_Thang, BangLuong_3P, Nhap_ThucHien và DASHBOARD cho một kỳ.
    Hỗ trợ truyền config_override / tiers_override để chạy giả lập (What-If Simulation)
    mà không thay đổi database.
    """
    cfg_row = db.query(SystemConfig).first()
    if not cfg_row:
        raise ValueError("Chưa khởi tạo SystemConfig")

    # Build effective config dict
    cfg = {
        "org_name": cfg_row.org_name,
        "unit_name": cfg_row.unit_name,
        "w_cm": cfg_row.w_cm,
        "w_kpi": cfg_row.w_kpi,
        "w_reserve": cfg_row.w_reserve,
        "w_kpi_dv": cfg_row.w_kpi_dv,
        "w_kpi_hdv": cfg_row.w_kpi_hdv,
        "w_kpi_dn": cfg_row.w_kpi_dn,
        "indirect_target_ratio": cfg_row.indirect_target_ratio,
        "cm_base_score": cfg_row.cm_base_score,
        "cm_max_score": cfg_row.cm_max_score,
        "cm_min_score": cfg_row.cm_min_score,
        "cm_floor_enabled": cfg_row.cm_floor_enabled,
        "max_total_deduction": cfg_row.max_total_deduction,
        "ksv_deduction_ratio": cfg_row.ksv_deduction_ratio,
        "ksv_monthly_cap": cfg_row.ksv_monthly_cap,
        "approver_deduction_ratio": cfg_row.approver_deduction_ratio,
        "approver_monthly_cap": cfg_row.approver_monthly_cap,
        "standard_workdays": cfg_row.standard_workdays,
        "use_period_standard_days": cfg_row.use_period_standard_days,
        "v2_monthly_fund": cfg_row.v2_monthly_fund,
        "v2_fund_mode": cfg_row.v2_fund_mode,
        "base_salary_agribank": cfg_row.base_salary_agribank,
        "kv2_general": cfg_row.kv2_general,
        "tcv_max_cap": cfg_row.tcv_max_cap,
        "tcv_min_floor": cfg_row.tcv_min_floor,
        "qns_mode": cfg_row.qns_mode,
        "qns_months": cfg_row.qns_months,
        "qns_manual_amount": cfg_row.qns_manual_amount,
        "v3_fund_amount": cfg_row.v3_fund_amount,
        "sync_v3_with_qns": cfg_row.sync_v3_with_qns,
        "dv_agg_mode": cfg_row.dv_agg_mode,
        "kpi_cap_mode": cfg_row.kpi_cap_mode,
        "missing_kpi_policy": cfg_row.missing_kpi_policy,
        "tcv_mode": cfg_row.tcv_mode,
        "workday_ratio_cap": cfg_row.workday_ratio_cap,
        "nsi_basis": cfg_row.nsi_basis,
        "monthly_takehome_mode": cfg_row.monthly_takehome_mode,
        "v3_allocation_method": cfg_row.v3_allocation_method,
        "rounding_residual_to_last": cfg_row.rounding_residual_to_last,
    }
    if config_override:
        for k, v in config_override.items():
            if k in cfg and v is not None:
                cfg[k] = v

    period = db.query(Period).filter(Period.period_code == period_code).first()
    period_name = period.period_name if period else period_code
    std_days = float(period.standard_days) if (period and cfg["use_period_standard_days"]) else float(cfg["standard_workdays"])
    if std_days <= 0:
        std_days = 22.0

    # Tiers
    if tiers_override:
        tiers = [
            RatingTier(
                code=t["code"],
                sort_order=t.get("sort_order", i + 1),
                min_score=float(t["min_score"]),
                max_score=float(t.get("max_score", 120)),
                ki_month=float(t["ki_month"]),
                kq_settlement=float(t["kq_settlement"]),
                h3_v3=float(t["h3_v3"]),
                description=t.get("description", ""),
            )
            for i, t in enumerate(tiers_override)
        ]
    else:
        tiers = db.query(RatingTier).order_by(RatingTier.sort_order.asc()).all()

    employees = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc(), Employee.id.asc()).all()
    indicators = db.query(Indicator).order_by(Indicator.sort_order.asc(), Indicator.id.asc()).all()
    ind_map = {ind.code: ind for ind in indicators}

    salary_rows = {
        r.emp_code: r
        for r in db.query(SalaryImportRow).filter(SalaryImportRow.period_code == period_code).all()
    }
    target_rows = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == period_code).all()
    violations = db.query(ViolationRecord).filter(ViolationRecord.period_code == period_code).all()
    overrides = {
        r.emp_code: r
        for r in db.query(KpiMonthlyOverride).filter(KpiMonthlyOverride.period_code == period_code).all()
    }

    # Index target execution rows per employee
    exec_by_emp: Dict[str, List[TargetExecutionRow]] = {}
    exec_details: List[Dict[str, Any]] = []
    for tr in target_rows:
        exec_by_emp.setdefault(tr.emp_code, []).append(tr)

    # Compute violation deductions per employee
    direct_deduct: Dict[str, float] = {}
    ksv_deduct_raw: Dict[str, float] = {}
    approver_deduct_raw: Dict[str, float] = {}

    for v in violations:
        ec = v.emp_code
        direct_deduct[ec] = direct_deduct.get(ec, 0.0) + abs(float(v.emp_deduction or 0.0))
        if v.has_ksv_resp and v.ksv_emp_code:
            if v.ksv_status == "APPROVED":
                pts = abs(float(v.ksv_applied_points or v.ksv_proposed_points or 0.0))
                ksv_deduct_raw[v.ksv_emp_code] = ksv_deduct_raw.get(v.ksv_emp_code, 0.0) + pts
            elif v.ksv_status == "NONE":
                pts = abs(float(v.ksv_applied_points or 0.0))
                ksv_deduct_raw[v.ksv_emp_code] = ksv_deduct_raw.get(v.ksv_emp_code, 0.0) + pts
        if v.has_approver_resp and v.approver_emp_code and v.approver_status != "REJECTED":
            pts = abs(float(v.approver_points or 0.0))
            approver_deduct_raw[v.approver_emp_code] = approver_deduct_raw.get(v.approver_emp_code, 0.0) + pts

    # Build KPI_Thang & pre-payroll rows
    kpi_rows = []
    pre_payroll = []

    for emp in employees:
        ec = emp.emp_code
        srow = salary_rows.get(ec)
        base_v1 = float(srow.base_v1) if srow and srow.base_v1 > 0 else float(emp.base_v1)
        base_v2 = float(srow.base_v2) if srow and srow.base_v2 > 0 else float(emp.base_v2)
        actual_wd = float(srow.actual_workdays) if srow else std_days

        # 1. Trụ cột Chuyên môn (P1 + P3)
        d_cb = round(direct_deduct.get(ec, 0.0), 2)
        d_ksv = min(float(cfg["ksv_monthly_cap"]), ksv_deduct_raw.get(ec, 0.0))
        d_pd = min(float(cfg["approver_monthly_cap"]), approver_deduct_raw.get(ec, 0.0))
        d_joint = round(d_ksv + d_pd, 2)

        total_deduct = d_cb + d_joint
        if float(cfg["max_total_deduction"]) > 0:
            total_deduct = min(float(cfg["max_total_deduction"]), total_deduct)

        raw_cm = float(cfg["cm_base_score"]) - total_deduct
        if cfg["cm_floor_enabled"]:
            cm_score = max(float(cfg["cm_min_score"]), min(float(cfg["cm_max_score"]), raw_cm))
        else:
            cm_score = max(0.0, min(float(cfg["cm_max_score"]), raw_cm))
        cm_score = round(cm_score, 2)

        # 2. Trụ cột KPI Kinh doanh (P2)
        emp_targets = exec_by_emp.get(ec, [])
        dv_ratios = []
        dv_weighted_num = 0.0
        dv_weighted_den = 0.0
        hdv_ratios = []
        dn_ratios = []

        for tr in emp_targets:
            ind = ind_map.get(tr.indicator_code)
            ti = float(tr.target_value or 0.0)
            ai = float(tr.actual_value or 0.0)
            ci = (ai / ti) if ti > 0 else 0.0
            si = min(ci, 1.0) * 100.0
            wi = float(ind.weight) if ind else 0.0

            exec_details.append({
                "emp_code": ec,
                "full_name": emp.full_name,
                "department": emp.department,
                "labor_type": emp.labor_type,
                "indicator_code": tr.indicator_code,
                "indicator_name": ind.name if ind else tr.indicator_code,
                "unit": ind.unit if ind else "",
                "kpi_branch": ind.kpi_branch if ind else "DV",
                "target_value": ti,
                "actual_value": ai,
                "ratio_ci": round(ci, 6),
                "score_si": round(si, 2),
                "weight_wi": wi,
                "weighted_score": round(si * wi, 2),
                "status": tr.status,
            })

            eff_ci = min(ci, 1.0) if cfg["kpi_cap_mode"] == "INDICATOR_CAP" else ci
            branch = ind.kpi_branch if ind else ("HDV" if tr.indicator_code == "CT07" else "DN" if tr.indicator_code == "CT08" else "DV")
            if branch == "HDV":
                hdv_ratios.append(eff_ci)
            elif branch == "DN":
                dn_ratios.append(eff_ci)
            else:
                dv_ratios.append(eff_ci)
                dv_weighted_num += eff_ci * wi
                dv_weighted_den += wi

        missing_val = 1.0 if cfg["missing_kpi_policy"] == "FULL_100" else 0.0

        pct_hdv = (sum(hdv_ratios) / len(hdv_ratios)) if hdv_ratios else missing_val
        if cfg["dv_agg_mode"] == "WEIGHTED_INDICATORS" and dv_weighted_den > 0:
            pct_dv = dv_weighted_num / dv_weighted_den
        else:
            pct_dv = (sum(dv_ratios) / len(dv_ratios)) if dv_ratios else missing_val
        pct_dn = (sum(dn_ratios) / len(dn_ratios)) if dn_ratios else missing_val

        # Áp dụng trần ở mức nhóm (GROUP_CAP hoặc INDICATOR_CAP đều chặn <= 1 trừ UNCAPPED)
        if cfg["kpi_cap_mode"] in ("GROUP_CAP", "INDICATOR_CAP"):
            cap_hdv = min(pct_hdv, 1.0)
            cap_dv = min(pct_dv, 1.0)
            cap_dn = min(pct_dn, 1.0)
        else:
            cap_hdv, cap_dv, cap_dn = pct_hdv, pct_dv, pct_dn

        w_sub_total = float(cfg["w_kpi_dv"]) + float(cfg["w_kpi_hdv"]) + float(cfg["w_kpi_dn"])
        if w_sub_total > 0:
            kpi_raw = 100.0 * (
                cap_dv * float(cfg["w_kpi_dv"]) +
                cap_hdv * float(cfg["w_kpi_hdv"]) +
                cap_dn * float(cfg["w_kpi_dn"])
            ) / w_sub_total
        else:
            kpi_raw = 0.0
        if cfg["kpi_cap_mode"] != "UNCAPPED":
            kpi_score = min(100.0, excel_round(kpi_raw, 2))
        else:
            kpi_score = excel_round(kpi_raw, 2)

        # 3. Tổng điểm công việc & Tcv
        # Nếu w_reserve > 0 (dự phòng), mặc định chuẩn hóa tổng w_cm + w_kpi (+ w_reserve giả sử 100đ)
        work_score = excel_round(
            cm_score * float(cfg["w_cm"]) +
            kpi_score * float(cfg["w_kpi"]) +
            100.0 * float(cfg["w_reserve"]),
            2,
        )
        ovr = overrides.get(ec)
        priority_pts = float(ovr.priority_points) if ovr else 0.0
        tier = determine_tier(work_score, tiers)

        if cfg["tcv_mode"] == "TIER_MATRIX":
            tcv_raw = float(tier.ki_month) + priority_pts
        else:
            tcv_raw = (work_score / 100.0) + priority_pts

        tcv = excel_round(
            min(float(cfg["tcv_max_cap"]), max(float(cfg["tcv_min_floor"]), tcv_raw)),
            4,
        )

        kpi_rows.append({
            "emp_code": ec,
            "full_name": emp.full_name,
            "department": emp.department,
            "title": emp.title,
            "group_id": emp.group_id,
            "labor_type": emp.labor_type,
            "cm_score": cm_score,
            "direct_deduction": d_cb,
            "joint_deduction": d_joint,
            "ksv_deduction": round(d_ksv, 2),
            "approver_deduction": round(d_pd, 2),
            "pct_hdv": round(pct_hdv, 6),
            "pct_dv": round(pct_dv, 6),
            "pct_dn": round(pct_dn, 6),
            "kpi_score": kpi_score,
            "work_score": work_score,
            "priority_points": priority_pts,
            "priority_note": ovr.note if ovr else "",
            "tcv": tcv,
            "rating": tier.code,
            "rating_desc": tier.description,
        })

        # 4. Tiền lương 3P
        wd_ratio = (actual_wd / std_days) if std_days > 0 else 1.0
        if cfg["workday_ratio_cap"]:
            wd_ratio = min(1.0, wd_ratio)

        v1_actual = excel_round(base_v1 * wd_ratio, 0)
        v2_adj = excel_round(base_v2 * tcv * float(cfg["kv2_general"]) * wd_ratio, 0)
        total_before = base_v1 + base_v2
        total_after = v1_actual + v2_adj

        pre_payroll.append({
            "emp_code": ec,
            "full_name": emp.full_name,
            "department": emp.department,
            "title": emp.title,
            "labor_type": emp.labor_type,
            "base_v1": base_v1,
            "base_v2": base_v2,
            "total_before": total_before,
            "tcv": tcv,
            "rating": tier.code,
            "work_score": work_score,
            "kpi_score": kpi_score,
            "cm_score": cm_score,
            "actual_workdays": actual_wd,
            "standard_workdays": std_days,
            "workday_ratio": round(wd_ratio, 6),
            "v1_actual": v1_actual,
            "v2_adj": v2_adj,
            "total_after": total_after,
        })

    # Tính Quỹ V2 & Quỹ Năng suất QNS
    sum_base_v1 = sum(r["base_v1"] for r in pre_payroll)
    sum_base_v2 = sum(r["base_v2"] for r in pre_payroll)
    sum_total_before = sum(r["total_before"] for r in pre_payroll)
    sum_v1_actual = sum(r["v1_actual"] for r in pre_payroll)
    sum_v2_adj = sum(r["v2_adj"] for r in pre_payroll)
    sum_total_after = sum(r["total_after"] for r in pre_payroll)

    eff_v2_fund = sum_base_v2 if cfg["v2_fund_mode"] == "AUTO_SUM_BASE_V2" else float(cfg["v2_monthly_fund"])
    if cfg["qns_mode"] == "AUTO_SUM_BEFORE_ADJ":
        qns_fund = sum_total_before if sum_total_before > 0 else float(cfg["qns_manual_amount"])
    elif cfg["qns_mode"] == "MONTHS_MULTIPLIER":
        qns_fund = excel_round(sum_total_before * float(cfg["qns_months"]), 0)
    else:
        qns_fund = float(cfg["qns_manual_amount"])

    # Basis cho NSi
    if cfg["nsi_basis"] == "V2_AFTER_ADJ":
        basis_vals = [r["v2_adj"] for r in pre_payroll]
    elif cfg["nsi_basis"] == "KPI_SCORE":
        basis_vals = [r["work_score"] for r in pre_payroll]
    else:
        basis_vals = [r["total_after"] for r in pre_payroll]

    sum_basis = sum(basis_vals)
    payroll_rows = []
    for idx, r in enumerate(pre_payroll):
        bval = basis_vals[idx]
        nsi = excel_round(qns_fund * bval / sum_basis, 0) if sum_basis > 0 else 0.0
        r["nsi"] = nsi
        payroll_rows.append(r)

    # Nếu bật bù sai số làm tròn vào người cuối cùng (tùy chọn)
    if cfg["rounding_residual_to_last"] and payroll_rows and sum_basis > 0 and cfg["qns_mode"] != "AUTO_SUM_BEFORE_ADJ":
        # Mặc định giữ chuẩn Excel cho AUTO_SUM_BEFORE_ADJ nếu muốn khớp từng dòng, nhưng vẫn có diff chính xác
        pass

    for r in payroll_rows:
        diff_ns = r["nsi"] - r["total_before"]
        if cfg["monthly_takehome_mode"] == "INCLUDE_NSI":
            takehome = r["nsi"]
        elif cfg["monthly_takehome_mode"] == "V1_V2_PLUS_DIFF":
            takehome = r["total_after"] + diff_ns
        else:
            takehome = r["total_after"]

        r["diff_ns"] = diff_ns
        r["takehome"] = takehome
        r["remark"] = "Thưởng thêm (+)" if diff_ns > 0 else ("Giảm trừ (-)" if diff_ns < 0 else "Cân bằng")

    sum_nsi = sum(r["nsi"] for r in payroll_rows)
    sum_diff_ns = sum(r["diff_ns"] for r in payroll_rows)
    sum_takehome = sum(r["takehome"] for r in payroll_rows)
    sum_workdays = sum(r["actual_workdays"] for r in payroll_rows)

    # Dashboard metrics
    n_staff = len(kpi_rows)
    avg_tcv = round(sum(r["tcv"] for r in kpi_rows) / n_staff, 4) if n_staff else 0.0
    avg_score = round(sum(r["work_score"] for r in kpi_rows) / n_staff, 2) if n_staff else 0.0
    tier_counts = {t.code: 0 for t in tiers}
    for r in kpi_rows:
        tier_counts[r["rating"]] = tier_counts.get(r["rating"], 0) + 1
    a_plus_a_rate = round(((tier_counts.get("A+", 0) + tier_counts.get("A", 0)) / n_staff), 4) if n_staff else 0.0

    v2_surplus = eff_v2_fund - sum_v2_adj

    return {
        "period_code": period_code,
        "period_name": period_name,
        "standard_workdays": std_days,
        "config_effective": cfg,
        "kpi_rows": kpi_rows,
        "payroll_rows": payroll_rows,
        "execution_details": exec_details,
        "totals": {
            "staff_count": n_staff,
            "base_v1": sum_base_v1,
            "base_v2": sum_base_v2,
            "total_before": sum_total_before,
            "v1_actual": sum_v1_actual,
            "v2_adj": sum_v2_adj,
            "total_after": sum_total_after,
            "nsi": sum_nsi,
            "diff_ns": sum_diff_ns,
            "takehome": sum_takehome,
            "workdays": sum_workdays,
            "v2_monthly_fund": eff_v2_fund,
            "v2_surplus": v2_surplus,
            "qns_fund": qns_fund,
            "takehome_in_words": doc_so_thanh_chu(sum_takehome),
            "v2_adj_in_words": doc_so_thanh_chu(sum_v2_adj),
        },
        "dashboard": {
            "staff_count": n_staff,
            "avg_tcv": avg_tcv,
            "avg_work_score": avg_score,
            "total_income_3p": sum_takehome,
            "a_plus_a_rate": a_plus_a_rate,
            "v2_monthly_fund": eff_v2_fund,
            "qns_fund": qns_fund,
            "sum_nsi": sum_nsi,
            "v2_surplus": v2_surplus,
            "tier_distribution": [
                {
                    "code": t.code,
                    "description": t.description,
                    "count": tier_counts.get(t.code, 0),
                    "ratio": round(tier_counts.get(t.code, 0) / n_staff, 4) if n_staff else 0.0,
                }
                for t in tiers
            ],
            "salary_structure": [
                {"label": "Tổng Lương V1 thực lĩnh", "amount": sum_v1_actual, "ratio": round(sum_v1_actual / (sum_v1_actual + sum_v2_adj), 4) if (sum_v1_actual + sum_v2_adj) else 0.0},
                {"label": "Tổng Lương V2 thực chi tháng", "amount": sum_v2_adj, "ratio": round(sum_v2_adj / (sum_v1_actual + sum_v2_adj), 4) if (sum_v1_actual + sum_v2_adj) else 0.0},
                {"label": "Quỹ V2 dôi dư tích lũy (Quý/Năm)", "amount": v2_surplus, "ratio": round(v2_surplus / eff_v2_fund, 4) if eff_v2_fund else 0.0},
                {"label": "Tổng Quỹ Lương V2 tháng quy định", "amount": eff_v2_fund, "ratio": 1.0},
                {"label": "TỔNG THỰC CHI LƯƠNG 3P (V1 + V2)", "amount": sum_v1_actual + sum_v2_adj, "ratio": 1.0},
                {"label": "Quỹ Lương Năng suất đơn vị (QNS)", "amount": qns_fund, "ratio": 1.0},
                {"label": "Tổng Lương Năng suất phân phối (∑NSi)", "amount": sum_nsi, "ratio": round(sum_nsi / qns_fund, 6) if qns_fund else 1.0},
            ],
        },
    }


def compute_accumulation_v3(
    db: Session,
    year_num: int = 2026,
    include_open_period: bool = False,
    config_override: Optional[Dict[str, Any]] = None,
    tiers_override: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Tính toàn bộ bảng TichLuy_V3: Lịch sử 12 tháng, Quyết toán 4 Quý, Quyết toán Cả năm & Quỹ Thù lao V3.
    Mặc định lấy số liệu đã đóng băng (ĐÃ KHÓA). Nếu include_open_period=True sẽ ghép thêm kết quả kỳ ĐANG MỞ để dự tính.
    """
    cfg_row = db.query(SystemConfig).first()
    if not cfg_row:
        raise ValueError("Chưa khởi tạo SystemConfig")

    v2_monthly_fund = float(config_override.get("v2_monthly_fund", cfg_row.v2_monthly_fund)) if config_override else float(cfg_row.v2_monthly_fund)
    v2_fund_mode = config_override.get("v2_fund_mode", cfg_row.v2_fund_mode) if config_override else cfg_row.v2_fund_mode
    v3_allocation_method = config_override.get("v3_allocation_method", cfg_row.v3_allocation_method) if config_override else cfg_row.v3_allocation_method
    sync_v3_with_qns = config_override.get("sync_v3_with_qns", cfg_row.sync_v3_with_qns) if config_override else cfg_row.sync_v3_with_qns
    v3_fund_manual = float(config_override.get("v3_fund_amount", cfg_row.v3_fund_amount)) if config_override else float(cfg_row.v3_fund_amount)
    rounding_residual = config_override.get("rounding_residual_to_last", cfg_row.rounding_residual_to_last) if config_override else cfg_row.rounding_residual_to_last

    if tiers_override:
        tiers = [
            RatingTier(
                code=t["code"],
                sort_order=t.get("sort_order", i + 1),
                min_score=float(t["min_score"]),
                max_score=float(t.get("max_score", 120)),
                ki_month=float(t["ki_month"]),
                kq_settlement=float(t["kq_settlement"]),
                h3_v3=float(t["h3_v3"]),
                description=t.get("description", ""),
            )
            for i, t in enumerate(tiers_override)
        ]
    else:
        tiers = db.query(RatingTier).order_by(RatingTier.sort_order.asc()).all()

    periods = db.query(Period).filter(Period.year_num == year_num).order_by(Period.month_num.asc()).all()
    std_by_month = {p.month_num: float(p.standard_days) for p in periods}
    std_year = sum(std_by_month.get(m, 22.0) for m in range(1, 13))

    employees = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc(), Employee.id.asc()).all()
    if v2_fund_mode == "AUTO_SUM_BASE_V2":
        v2_monthly_fund = sum(float(e.base_v2) for e in employees)

    # Lấy QNS từ kỳ hiện hành nếu sync_v3_with_qns = True
    cur_calc = compute_period_kpi_and_payroll(db, cfg_row.current_period_code, config_override, tiers_override)
    v3_fund = cur_calc["totals"]["qns_fund"] if sync_v3_with_qns else v3_fund_manual

    snaps = db.query(MonthlyHistorySnapshot).filter(MonthlyHistorySnapshot.year_num == year_num).all()
    snap_map: Dict[tuple, MonthlyHistorySnapshot] = {(s.emp_code, s.month_num): s for s in snaps}

    # Nếu dự tính kèm kỳ ĐANG MỞ
    open_proj_by_month: Dict[int, Dict[str, Dict[str, Any]]] = {}
    if include_open_period:
        for p in periods:
            if p.status == "ĐANG MỞ":
                p_calc = cur_calc if p.period_code == cfg_row.current_period_code else compute_period_kpi_and_payroll(db, p.period_code, config_override, tiers_override)
                p_kpi = {r["emp_code"]: r for r in p_calc["kpi_rows"]}
                p_pay = {r["emp_code"]: r for r in p_calc["payroll_rows"]}
                open_proj_by_month[p.month_num] = {
                    ec: {
                        "kpi_score": p_kpi[ec]["work_score"],
                        "workdays": p_pay[ec]["actual_workdays"],
                        "v2_paid": p_pay[ec]["v2_adj"],
                        "v1_paid": p_pay[ec]["v1_actual"],
                    }
                    for ec in p_kpi
                }

    rows = []
    for emp in employees:
        ec = emp.emp_code
        months_data = {}
        for m in range(1, 13):
            s = snap_map.get((ec, m))
            if s and (s.kpi_score is not None or s.workdays is not None or s.v2_paid is not None or s.v1_paid is not None):
                months_data[m] = {
                    "kpi_score": s.kpi_score,
                    "workdays": s.workdays,
                    "v2_paid": s.v2_paid,
                    "v1_paid": s.v1_paid,
                    "is_frozen": bool(s.is_frozen),
                }
            elif include_open_period and m in open_proj_by_month and ec in open_proj_by_month[m]:
                proj = open_proj_by_month[m][ec]
                months_data[m] = {
                    "kpi_score": proj["kpi_score"],
                    "workdays": proj["workdays"],
                    "v2_paid": proj["v2_paid"],
                    "v1_paid": proj["v1_paid"],
                    "is_frozen": False,
                }
            else:
                months_data[m] = {
                    "kpi_score": None,
                    "workdays": None,
                    "v2_paid": None,
                    "v1_paid": None,
                    "is_frozen": False,
                }

        # Tính sơ bộ 4 quý (chưa nhân hệ số cân đối quỹ chung)
        quarters = {}
        for q_idx, m_range in enumerate([(1, 2, 3), (4, 5, 6), (7, 8, 9), (10, 11, 12)], 1):
            kpis = [months_data[m]["kpi_score"] for m in m_range if months_data[m]["kpi_score"] is not None]
            wds = [months_data[m]["workdays"] for m in m_range if months_data[m]["workdays"] is not None]
            v2s = [months_data[m]["v2_paid"] for m in m_range if months_data[m]["v2_paid"] is not None]

            kpi_bq = (sum(kpis) / len(kpis)) if kpis else 0.0
            tier_q = determine_tier(kpi_bq, tiers)
            kq_q = float(tier_q.kq_settlement)
            nc_q = sum(wds)
            k_chuan_q = sum(std_by_month.get(m, 22.0) for m in m_range)
            v2_qt_q = (
                excel_round(
                    Decimal(str(emp.base_v2)) * Decimal(str(kq_q)) * (Decimal(str(nc_q)) / Decimal(str(k_chuan_q))) * Decimal("3"),
                    0,
                )
                if k_chuan_q > 0 else 0.0
            )
            v2_paid_q = sum(v2s)
            quarters[f"Q{q_idx}"] = {
                "kpi_bq": round(kpi_bq, 2),
                "rating": tier_q.code,
                "kq": kq_q,
                "workdays": nc_q,
                "std_days": k_chuan_q,
                "v2_qt": v2_qt_q,
                "v2_paid": v2_paid_q,
                "v2_bonus": 0.0,
            }

        rows.append({
            "emp_code": ec,
            "full_name": emp.full_name,
            "title": emp.title,
            "department": emp.department,
            "hsl_v1": float(emp.hsl_v1),
            "base_v1": float(emp.base_v1),
            "base_v2": float(emp.base_v2),
            "months": months_data,
            "quarters": quarters,
        })

    # Áp dụng cân đối Quỹ V2 cho từng Quý (BJ, BQ, BX, CE)
    for q_key in ("Q1", "Q2", "Q3", "Q4"):
        sum_paid_q = sum(Decimal(str(r["quarters"][q_key]["v2_paid"])) for r in rows)
        diffs_d = [max(Decimal("0"), Decimal(str(r["quarters"][q_key]["v2_qt"])) - Decimal(str(r["quarters"][q_key]["v2_paid"]))) for r in rows]
        sum_diffs_d = sum(diffs_d)
        avail_q = max(Decimal("0"), Decimal("3") * Decimal(str(v2_monthly_fund)) - sum_paid_q)
        factor_d = Decimal("0") if sum_diffs_d == 0 else min(Decimal("1"), avail_q / sum_diffs_d)
        for idx, r in enumerate(rows):
            r["quarters"][q_key]["v2_bonus"] = excel_round(diffs_d[idx] * factor_d, 0)

    # Tổng hợp Cả năm & Quỹ Thù lao V3
    for r in rows:
        md = r["months"]
        qs = r["quarters"]
        total_bs_q = sum(qs[q]["v2_bonus"] for q in ("Q1", "Q2", "Q3", "Q4"))
        all_kpis = [md[m]["kpi_score"] for m in range(1, 13) if md[m]["kpi_score"] is not None]
        all_wds = [md[m]["workdays"] for m in range(1, 13) if md[m]["workdays"] is not None]
        all_v2s = [md[m]["v2_paid"] for m in range(1, 13) if md[m]["v2_paid"] is not None]
        all_v1s = [md[m]["v1_paid"] for m in range(1, 13) if md[m]["v1_paid"] is not None]

        kpi_bq_yr = (sum(all_kpis) / len(all_kpis)) if all_kpis else 0.0
        tier_yr = determine_tier(kpi_bq_yr, tiers)
        kq_yr = float(tier_yr.kq_settlement)
        h3_yr = float(tier_yr.h3_v3)
        nc_yr = sum(all_wds)
        months_active = sum(1 for m in range(1, 13) if (md[m]["workdays"] or 0) > 0)

        v2_qt_yr = (
            excel_round(
                Decimal(str(r["base_v2"])) * Decimal(str(kq_yr)) * (Decimal(str(nc_yr)) / Decimal(str(std_year))) * Decimal("12"),
                0,
            )
            if std_year > 0 else 0.0
        )
        v2_received_yr = sum(all_v2s) + total_bs_q
        v1_total_yr = sum(all_v1s)

        r["year"] = {
            "total_bs_quarters": total_bs_q,
            "kpi_bq": round(kpi_bq_yr, 2),
            "rating": tier_yr.code,
            "kq": kq_yr,
            "h3": h3_yr,
            "workdays": nc_yr,
            "months_active": months_active,
            "std_days": std_year,
            "v2_qt": v2_qt_yr,
            "v2_received": v2_received_yr,
            "v2_bonus_final": 0.0,
            "v1_total": v1_total_yr,
            "v3_basis": 0.0,
            "v3_ratio": 0.0,
            "v3_amount": 0.0,
            "status_note": "",
            "fund_control": "",
        }

    # Cân đối bổ sung cuối năm (CN)
    sum_received_yr = sum(Decimal(str(r["year"]["v2_received"])) for r in rows)
    diffs_yr_d = [max(Decimal("0"), Decimal(str(r["year"]["v2_qt"])) - Decimal(str(r["year"]["v2_received"]))) for r in rows]
    sum_diffs_yr_d = sum(diffs_yr_d)
    avail_yr = max(Decimal("0"), Decimal("12") * Decimal(str(v2_monthly_fund)) - sum_received_yr)
    factor_yr_d = Decimal("0") if sum_diffs_yr_d == 0 else min(Decimal("1"), avail_yr / sum_diffs_yr_d)

    for idx, r in enumerate(rows):
        yr = r["year"]
        yr["v2_bonus_final"] = excel_round(diffs_yr_d[idx] * factor_yr_d, 0)
        if yr["v2_received"] > yr["v2_qt"] + 10:
            yr["status_note"] = f"Chi vượt: {int(yr['v2_received'] - yr['v2_qt']):,} đ (Cần cân đối)"
            yr["fund_control"] = "Cảnh báo vượt quyền hưởng"
        elif yr["v2_received"] + yr["v2_bonus_final"] >= yr["v2_qt"] - 10:
            yr["status_note"] = "Đã quyết toán đủ (Khớp quỹ)"
            yr["fund_control"] = "Bảo toàn quỹ (100%)"
        else:
            yr["status_note"] = "Cần bổ sung"
            yr["fund_control"] = "Bảo toàn quỹ (100%)"

        if v3_allocation_method == "H3_TIME_WEIGHTED":
            time_ratio = (yr["workdays"] / std_year) if std_year > 0 else 0.0
            yr["v3_basis"] = round(yr["h3"] * time_ratio * (r["base_v1"] + r["base_v2"]) * 12.0, 2)
        elif v3_allocation_method == "V2QT_ONLY":
            yr["v3_basis"] = yr["v2_qt"]
        else:
            # V1_PLUS_V2QT (Chuẩn Excel Điều 12.2)
            yr["v3_basis"] = yr["v1_total"] + yr["v2_qt"]

    sum_v3_basis = sum(r["year"]["v3_basis"] for r in rows)
    active_v3_indices = []
    for idx, r in enumerate(rows):
        yr = r["year"]
        yr["v3_ratio"] = (yr["v3_basis"] / sum_v3_basis) if sum_v3_basis > 0 else 0.0
        yr["v3_amount"] = excel_round(v3_fund * yr["v3_ratio"], 0) if v3_fund > 0 else 0.0
        if yr["v3_basis"] > 0:
            active_v3_indices.append(idx)

    # Fix triệt để hardcode dòng 13 CW18 của Excel: bù phần dư làm tròn vào nhân sự cuối cùng có hệ số > 0
    if rounding_residual and v3_fund > 0 and active_v3_indices:
        last_idx = active_v3_indices[-1]
        sum_except_last = sum(rows[i]["year"]["v3_amount"] for i in active_v3_indices if i != last_idx)
        rows[last_idx]["year"]["v3_amount"] = max(0.0, v3_fund - sum_except_last)

    # Totals
    totals = {
        "staff_count": len(rows),
        "base_v2": sum(r["base_v2"] for r in rows),
        "v1_total": sum(r["year"]["v1_total"] for r in rows),
        "v2_qt": sum(r["year"]["v2_qt"] for r in rows),
        "v2_received": sum(r["year"]["v2_received"] for r in rows),
        "v2_bonus_final": sum(r["year"]["v2_bonus_final"] for r in rows),
        "total_bs_quarters": sum(r["year"]["total_bs_quarters"] for r in rows),
        "workdays": sum(r["year"]["workdays"] for r in rows),
        "v3_basis": sum_v3_basis,
        "v3_fund": v3_fund,
        "v3_amount": sum(r["year"]["v3_amount"] for r in rows),
        "v3_in_words": doc_so_thanh_chu(sum(r["year"]["v3_amount"] for r in rows)),
        "quarters": {
            f"Q{q}": {
                "workdays": sum(r["quarters"][f"Q{q}"]["workdays"] for r in rows),
                "v2_qt": sum(r["quarters"][f"Q{q}"]["v2_qt"] for r in rows),
                "v2_paid": sum(r["quarters"][f"Q{q}"]["v2_paid"] for r in rows),
                "v2_bonus": sum(r["quarters"][f"Q{q}"]["v2_bonus"] for r in rows),
            }
            for q in range(1, 5)
        },
    }

    return {
        "year_num": year_num,
        "include_open_period": include_open_period,
        "v3_allocation_method": v3_allocation_method,
        "v3_fund": v3_fund,
        "v2_monthly_fund": v2_monthly_fund,
        "standard_days_year": std_year,
        "rows": rows,
        "totals": totals,
    }


def sync_period_snapshot(db: Session, period_code: str, frozen: bool = True) -> int:
    """Tính lại KPI & Lương 3P từ dữ liệu chi tiết của kỳ và đồng bộ vào MonthlyHistorySnapshot (TichLuy_V3)."""
    p = db.query(Period).filter(Period.period_code == period_code).first()
    if not p:
        return 0
    calc = compute_period_kpi_and_payroll(db, p.period_code)
    kpi_map = {r["emp_code"]: r for r in calc["kpi_rows"]}
    pay_map = {r["emp_code"]: r for r in calc["payroll_rows"]}
    for ec, p_row in pay_map.items():
        k_row = kpi_map.get(ec, {})
        snap = db.query(MonthlyHistorySnapshot).filter(
            MonthlyHistorySnapshot.year_num == p.year_num,
            MonthlyHistorySnapshot.month_num == p.month_num,
            MonthlyHistorySnapshot.emp_code == ec,
        ).first()
        if snap:
            snap.kpi_score = k_row.get("work_score", 0.0)
            snap.workdays = p_row["actual_workdays"]
            snap.v2_paid = p_row["v2_adj"]
            snap.v1_paid = p_row["v1_actual"]
            snap.is_frozen = frozen
        else:
            db.add(MonthlyHistorySnapshot(
                year_num=p.year_num,
                month_num=p.month_num,
                emp_code=ec,
                kpi_score=k_row.get("work_score", 0.0),
                workdays=p_row["actual_workdays"],
                v2_paid=p_row["v2_adj"],
                v1_paid=p_row["v1_actual"],
                is_frozen=frozen,
            ))
    return len(pay_map)
