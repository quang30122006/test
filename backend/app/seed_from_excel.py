import re
import openpyxl
from sqlalchemy.orm import Session

from .config import EXCEL_SOURCE_PATH
from .auth import hash_password
from .models import (
    SystemConfig, RatingTier, Period, Employee, Indicator,
    InternalRule, KpiErrorCode, SalaryImportRow, TargetExecutionRow,
    MonthlyHistorySnapshot, AuditLog
)


def _parse_group_id(val) -> int:
    if val is None:
        return 1
    m = re.search(r"(\d)", str(val))
    return int(m.group(1)) if m else 1


def _parse_extended_kpi_line(text: str):
    """Parse 'HS01 - Hồ sơ, chứng từ: Thiếu thông tin không trọng yếu (-1đ)'."""
    s = str(text).strip()
    if not s or " - " not in s:
        return None
    code, rest = s.split(" - ", 1)
    code = code.strip()
    pts = -1.0
    m = re.search(r"\((-?\d+(?:\.\d+)?)đ\)\s*$", rest)
    if m:
        pts = -abs(float(m.group(1)))
        desc = rest[: m.start()].strip()
    else:
        desc = rest.strip()
    pfx = "".join(ch for ch in code if ch.isalpha())
    groups_map = {
        "GD": "1",
        "HS": "1,2,3,4,5,6",
        "HT": "2,3,5",
        "HD": "2,5",
        "TT": "1,2,5",
        "TU": "2,5",
        "TL": "2,5",
        "CT": "1,2,3,5",
        "MS": "2,5",
        "KS": "3,5",
        "BC": "2,3,5",
        "HK": "3",
        "NV": "1,2,3,4,5,6",
        "KQ": "4",
    }
    level_name = f"Mức {int(abs(pts))}" if abs(pts) in (1, 2, 3, 5, 10) else "Mở rộng"
    return {
        "code": code,
        "description": desc,
        "points": pts,
        "level_name": level_name,
        "scope": f"Nhóm mã {pfx} (Gợi ý mở rộng)",
        "applicable_groups": groups_map.get(pfx, "1,2,3,4,5,6"),
    }


def seed_database_if_empty(db: Session) -> bool:
    """Nạp dữ liệu chuẩn từ file Excel gốc nếu database đang trống. Trả về True nếu có nạp."""
    if db.query(SystemConfig).first() is not None:
        return False

    if not EXCEL_SOURCE_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy file Excel gốc: {EXCEL_SOURCE_PATH}")

    wb = openpyxl.load_workbook(str(EXCEL_SOURCE_PATH), data_only=True, keep_vba=True)

    # 1. SystemConfig từ Admin_ThamSo
    ws_ts = wb["Admin_ThamSo"]
    default_pw_hash = hash_password("123456")

    cfg = SystemConfig(
        id=1,
        org_name="NGÂN HÀNG NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN VIỆT NAM - CHI NHÁNH QUẢNG BÌNH",
        unit_name="PHÒNG KTNQ - HỘI ĐỒNG LƯƠNG",
        current_period_code="2026-10",
        current_period_name=str(ws_ts["B3"].value or "Tháng 10/2026").strip(),
        w_cm=float(ws_ts["B5"].value or 0.75),
        w_kpi=float(ws_ts["B6"].value or 0.25),
        w_reserve=float(ws_ts["B7"].value or 0.0),
        w_kpi_dv=float(ws_ts["B8"].value or 0.50),
        w_kpi_hdv=float(ws_ts["B9"].value or 0.50),
        w_kpi_dn=float(ws_ts["B10"].value or 0.0),
        indirect_target_ratio=float(ws_ts["B11"].value or 0.50),
        cm_base_score=float(ws_ts["B12"].value or 100.0),
        cm_max_score=float(ws_ts["B13"].value or 100.0),
        cm_min_score=float(ws_ts["B14"].value or 70.0),
        cm_floor_enabled=False,
        max_total_deduction=0.0,
        ksv_deduction_ratio=float(ws_ts["I14"].value or 0.50),
        ksv_monthly_cap=10.0,
        approver_deduction_ratio=float(ws_ts["I15"].value or 0.25),
        approver_monthly_cap=5.0,
        standard_workdays=float(ws_ts["B16"].value or 22.0),
        use_period_standard_days=True,
        v2_monthly_fund=float(ws_ts["B17"].value or 101160000.0),
        v2_fund_mode="MANUAL",
        base_salary_agribank=float(ws_ts["B18"].value or 4730000.0),
        kv2_general=float(ws_ts["B22"].value or 1.0),
        tcv_max_cap=float(ws_ts["B23"].value or 1.0),
        tcv_min_floor=0.0,
        qns_mode="AUTO_SUM_BEFORE_ADJ",
        qns_months=1.0,
        qns_manual_amount=1031000000.0,
        v3_fund_amount=float(ws_ts["B20"].value or 222011500.0),
        sync_v3_with_qns=True,
        dv_agg_mode="SIMPLE_AVG",
        kpi_cap_mode="GROUP_CAP",
        missing_kpi_policy="ZERO",
        tcv_mode="LINEAR",
        workday_ratio_cap=False,
        nsi_basis="TOTAL_AFTER_ADJ",
        monthly_takehome_mode="V1_V2_ONLY",
        v3_allocation_method="V1_PLUS_V2QT",
        rounding_residual_to_last=True,
        admin_password_hash=default_pw_hash,
    )
    db.add(cfg)

    # 2. RatingTier từ Admin_ThamSo!F25:L29
    max_map = {"A+": 120.0, "A": 99.99, "B": 89.99, "C": 79.99, "D": 69.99}
    for idx, r in enumerate(range(25, 30), 1):
        code = str(ws_ts.cell(r, 6).value).strip()
        min_s = float(ws_ts.cell(r, 7).value or 0.0)
        ki = float(ws_ts.cell(r, 9).value or 0.5)
        kq = float(ws_ts.cell(r, 10).value or 0.5)
        h3 = float(ws_ts.cell(r, 11).value or 0.5)
        desc = str(ws_ts.cell(r, 12).value or "").strip()
        db.add(RatingTier(
            code=code,
            sort_order=idx,
            min_score=min_s,
            max_score=max_map.get(code, 100.0),
            ki_month=ki,
            kq_settlement=kq,
            h3_v3=h3,
            description=desc,
        ))

    # 3. Period từ TrangThai_Ky!A5:F16
    ws_ky = wb["TrangThai_Ky"]
    for r in range(5, 17):
        pcode = str(ws_ky.cell(r, 1).value or "").strip()
        if not pcode:
            continue
        pname = str(ws_ky.cell(r, 2).value or "").strip()
        pstatus = str(ws_ky.cell(r, 3).value or "CHƯA MỞ").strip()
        cdate_raw = ws_ky.cell(r, 4).value
        if hasattr(cdate_raw, "strftime"):
            cdate = cdate_raw.strftime("%d/%m/%Y")
        else:
            cdate = str(cdate_raw or "").strip()
        note = str(ws_ky.cell(r, 5).value or "").strip()
        std_d = float(ws_ky.cell(r, 6).value or 22.0)
        mnum = int(pcode.split("-")[1]) if "-" in pcode else (r - 4)
        ynum = int(pcode.split("-")[0]) if "-" in pcode else 2026
        db.add(Period(
            period_code=pcode,
            month_num=mnum,
            year_num=ynum,
            period_name=pname,
            status=pstatus,
            closed_date=cdate,
            note=note,
            standard_days=std_d,
        ))
        if pstatus == "ĐANG MỞ":
            cfg.current_period_code = pcode
            cfg.current_period_name = pname

    # 4. Employees từ 1.DM_CanBo!A5:K160
    ws_cb = wb["1.DM_CanBo"]
    staff_pw_hash = hash_password("123456")
    for idx, r in enumerate(range(5, ws_cb.max_row + 1), 1):
        ma = ws_cb.cell(r, 1).value
        if ma is None or str(ma).strip() == "":
            continue
        emp_code = str(ma).strip()
        gid = int(ws_cb.cell(r, 5).value or 1)
        db.add(Employee(
            emp_code=emp_code,
            full_name=str(ws_cb.cell(r, 2).value or "").strip(),
            title=str(ws_cb.cell(r, 3).value or "").strip(),
            department=str(ws_cb.cell(r, 4).value or "").strip(),
            group_id=gid,
            group_name=str(ws_cb.cell(r, 6).value or "").strip(),
            labor_type=str(ws_cb.cell(r, 7).value or "Trực tiếp").strip(),
            hsl_v1=float(ws_cb.cell(r, 8).value or 1.0),
            pccv=float(ws_cb.cell(r, 9).value or 0.0),
            base_v1=float(ws_cb.cell(r, 10).value or 0.0),
            base_v2=float(ws_cb.cell(r, 11).value or 0.0),
            is_active=True,
            is_ksv=(gid in (3, 5)),
            password_hash=staff_pw_hash,
            sort_order=idx,
        ))

    # 5. Indicators từ 2.DM_ChiTieu_GK!A5:G12
    ws_ct = wb["2.DM_ChiTieu_GK"]
    for idx, r in enumerate(range(5, ws_ct.max_row + 1), 1):
        code = str(ws_ct.cell(r, 1).value or "").strip()
        if not code:
            continue
        cat = str(ws_ct.cell(r, 2).value or "").strip()
        branch = "HDV" if code == "CT07" else ("DN" if code == "CT08" else "DV")
        weight_val = float(ws_ts.cell(r, 9).value or 0.0)
        db.add(Indicator(
            code=code,
            category=cat,
            kpi_branch=branch,
            name=str(ws_ct.cell(r, 3).value or "").strip(),
            unit=str(ws_ct.cell(r, 4).value or "").strip(),
            weight=weight_val,
            target_direct=float(ws_ct.cell(r, 6).value or 0.0),
            target_indirect=float(ws_ct.cell(r, 7).value or 0.0),
            sort_order=idx,
        ))

    # 6. InternalRules từ DM_NOI_QUY!A5:F20
    ws_nq = wb["DM_NOI_QUY"]
    for r in range(5, ws_nq.max_row + 1):
        code = str(ws_nq.cell(r, 1).value or "").strip()
        if not code:
            continue
        db.add(InternalRule(
            code=code,
            group_name=str(ws_nq.cell(r, 2).value or "").strip(),
            description=str(ws_nq.cell(r, 3).value or "").strip(),
            points=float(ws_nq.cell(r, 4).value or -1.0),
            criteria=str(ws_nq.cell(r, 5).value or "3.1 Nội quy").strip(),
            note=str(ws_nq.cell(r, 6).value or "").strip(),
        ))

    # 7. KpiErrorCode từ CAY_KPI_NGHIEP_VU (290 mã Phụ lục 3 + 828 mã gợi ý mở rộng)
    ws_kpi_tree = wb["CAY_KPI_NGHIEP_VU"]
    seen_codes = set()
    for r in range(5, ws_kpi_tree.max_row + 1):
        code = str(ws_kpi_tree.cell(r, 1).value or "").strip()
        if code and code not in seen_codes:
            seen_codes.add(code)
            db.add(KpiErrorCode(
                code=code,
                source_type="PHU_LUC_3",
                stt_origin=str(ws_kpi_tree.cell(r, 2).value or ""),
                level_name=str(ws_kpi_tree.cell(r, 3).value or "").strip(),
                points=float(ws_kpi_tree.cell(r, 4).value or -1.0),
                description=str(ws_kpi_tree.cell(r, 5).value or "").strip(),
                scope=str(ws_kpi_tree.cell(r, 6).value or "").strip(),
                applicable_groups="1,2,3,4,5,6",
            ))
        ext_raw = ws_kpi_tree.cell(r, 9).value
        if ext_raw:
            parsed = _parse_extended_kpi_line(str(ext_raw))
            if parsed and parsed["code"] not in seen_codes:
                seen_codes.add(parsed["code"])
                db.add(KpiErrorCode(
                    code=parsed["code"],
                    source_type="GOI_Y_MO_RONG",
                    stt_origin="",
                    level_name=parsed["level_name"],
                    points=parsed["points"],
                    description=parsed["description"],
                    scope=parsed["scope"],
                    applicable_groups=parsed["applicable_groups"],
                ))

    # 8. SalaryImportRow cho kỳ hiện hành từ IMPORT_LUONG!A7:L...
    ws_il = wb["IMPORT_LUONG"]
    cur_pcode = cfg.current_period_code
    for r in range(7, ws_il.max_row + 1):
        ma = ws_il.cell(r, 2).value
        if ma is None or str(ma).strip() == "":
            continue
        db.add(SalaryImportRow(
            period_code=cur_pcode,
            emp_code=str(ma).strip(),
            full_name=str(ws_il.cell(r, 3).value or "").strip(),
            title=str(ws_il.cell(r, 4).value or "").strip(),
            department=str(ws_il.cell(r, 5).value or "").strip(),
            group_name=str(ws_il.cell(r, 6).value or "").strip(),
            labor_type=str(ws_il.cell(r, 7).value or "Trực tiếp").strip(),
            hsl_v1=float(ws_il.cell(r, 8).value or 1.0),
            base_v1=float(ws_il.cell(r, 9).value or 0.0),
            base_v2=float(ws_il.cell(r, 10).value or 0.0),
            actual_workdays=float(ws_il.cell(r, 11).value or 22.0),
            status=str(ws_il.cell(r, 12).value or "Hợp lệ").strip(),
        ))

    # 9. TargetExecutionRow cho kỳ hiện hành từ IMPORT_CHI_TIEU!A7:J...
    ws_ict = wb["IMPORT_CHI_TIEU"]
    for r in range(7, ws_ict.max_row + 1):
        ma = ws_ict.cell(r, 1).value
        mact = ws_ict.cell(r, 3).value
        if not ma or not mact:
            continue
        db.add(TargetExecutionRow(
            period_code=cur_pcode,
            emp_code=str(ma).strip(),
            indicator_code=str(mact).strip(),
            actual_value=float(ws_ict.cell(r, 4).value or 0.0),
            target_value=float(ws_ict.cell(r, 7).value or 0.0),
            status=str(ws_ict.cell(r, 10).value or "Hợp lệ").strip(),
        ))

    # 10. MonthlyHistorySnapshot (T1..T9 đã đóng băng) từ TichLuy_V3!B6:BC18
    ws_v3 = wb["TichLuy_V3"]
    for r in range(6, ws_v3.max_row + 1):
        ma = ws_v3.cell(r, 2).value
        if not ma or str(ma).strip() == "":
            continue
        ec = str(ma).strip()
        for m in range(1, 13):
            kpi_v = ws_v3.cell(r, 7 + m).value     # H..S
            nc_v = ws_v3.cell(r, 19 + m).value     # T..AE
            v2_v = ws_v3.cell(r, 31 + m).value     # AF..AQ
            v1_v = ws_v3.cell(r, 43 + m).value     # AR..BC
            if kpi_v is not None or nc_v is not None or v2_v is not None or v1_v is not None:
                db.add(MonthlyHistorySnapshot(
                    year_num=2026,
                    month_num=m,
                    emp_code=ec,
                    kpi_score=float(kpi_v) if kpi_v is not None else None,
                    workdays=float(nc_v) if nc_v is not None else None,
                    v2_paid=float(v2_v) if v2_v is not None else None,
                    v1_paid=float(v1_v) if v1_v is not None else None,
                    is_frozen=True,
                ))

    # 11. AuditLog từ AUDIT_LOG!A5:F...
    ws_log = wb["AUDIT_LOG"]
    for r in range(5, ws_log.max_row + 1):
        lid = ws_log.cell(r, 1).value
        if lid is None:
            continue
        db.add(AuditLog(
            log_code=str(lid),
            timestamp=str(ws_log.cell(r, 2).value or ""),
            actor=str(ws_log.cell(r, 3).value or ""),
            action=str(ws_log.cell(r, 4).value or ""),
            target_data=str(ws_log.cell(r, 5).value or ""),
            details=str(ws_log.cell(r, 6).value or ""),
        ))

    db.commit()
    return True

