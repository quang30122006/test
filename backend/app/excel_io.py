import io
import re
from typing import Dict, Any, List, Optional, Tuple
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from sqlalchemy.orm import Session

from .models import (
    Employee, Indicator, SalaryImportRow, TargetExecutionRow,
    SystemConfig, Period, MonthlyHistorySnapshot
)
from .auth import hash_password
from .utils_vi import clean_ascii, parse_month_number
from .engine import compute_period_kpi_and_payroll, compute_accumulation_v3, sync_period_snapshot


def _is_month_matched(row_val, target_month: int) -> bool:
    if target_month <= 0 or row_val is None or str(row_val).strip() == "":
        return True
    parsed = parse_month_number(row_val)
    if parsed > 0:
        return parsed == target_month
    return True


def _is_total_or_header_label(clean_text: str) -> bool:
    """Chỉ loại bỏ dòng tiêu đề lặp hoặc dòng tổng cộng, KHÔNG loại nhầm tên người như 'Nguyễn Văn Công'."""
    if not clean_text:
        return False
    exact = {"TONG", "TONG CONG", "CONG", "TOTAL", "SUBTOTAL", "TT", "STT", "HO VA TEN", "HO TEN", "MA CAN BO"}
    if clean_text in exact:
        return True
    return clean_text.startswith(("TONG CONG", "TONG SO", "CONG SO"))


def _extract_sheet_month(sheet_name: str) -> int:
    u = clean_ascii(sheet_name)
    m = re.match(r"^(?:THANG|T)[\s_-]*0?(\d{1,2})\b", u)
    if m:
        val = int(m.group(1))
        if 1 <= val <= 12:
            return val
    return 0


def _detect_header_row(ws, keywords: Tuple[str, ...]) -> int:
    max_scan_c = min(ws.max_column, 35)
    for r in range(1, min(16, ws.max_row + 1)):
        for c in range(1, max_scan_c + 1):
            vc = clean_ascii(ws.cell(r, c).value or "")
            if any(k in vc for k in keywords) and len(vc) <= 35:
                return r
    return 4


def _num_val(ws, r: int, col_idx: int, default: Optional[float] = 0.0) -> Optional[float]:
    if not col_idx:
        return default
    v = ws.cell(r, col_idx).value
    if v is None or str(v).strip() == "":
        return default
    try:
        return float(v)
    except Exception:
        return default


def _auto_classify_employee(title: str, dept: str, raw_group: str = "", raw_labor: str = ""):
    group_names = {
        1: "Nhóm 1 - Giao dịch viên trực tiếp khách hàng",
        2: "Nhóm 2 - Kế toán & Giao dịch viên nội bộ",
        3: "Nhóm 3 - Cán bộ hậu kiểm",
        4: "Nhóm 4 - Thủ quỹ & Ngân quỹ kho quỹ",
        5: "Nhóm 5 - Kiểm soát viên & Lãnh đạo phòng",
        6: "Nhóm 6 - Cán bộ Tín dụng & QLKH",
    }
    group_id = 1
    m = re.search(r"(\d)", raw_group or "")
    if m and int(m.group(1)) in group_names:
        group_id = int(m.group(1))

    labor = ""
    raw_pl = clean_ascii(raw_labor)
    if "TRUC TIEP" in raw_pl:
        labor = "Trực tiếp"
    elif "GIAN TIEP" in raw_pl:
        labor = "Gián tiếp"

    if not raw_group or not labor:
        c_chuc = clean_ascii(title)
        c_dept = clean_ascii(dept)
        if "GIAM DOC" in c_chuc or "BAN GIAM" in c_dept:
            group_id, labor = 5, "Gián tiếp"
        elif "TRUONG PHONG" in c_chuc or "PHO PHONG" in c_chuc:
            if any(k in c_dept for k in ("KHDN", "KHCN", "TIN DUNG")):
                group_id, labor = 6, "Trực tiếp"
            elif any(k in c_dept for k in ("KTGSNB", "KTKTNB", "HAU KIEM")):
                group_id, labor = 3, "Gián tiếp"
            else:
                group_id, labor = 5, "Gián tiếp"
        elif "TIN DUNG" in c_chuc or any(k in c_dept for k in ("KHDN", "KHCN")):
            group_id, labor = 6, "Trực tiếp"
        elif "THU QUY" in c_chuc or "NGAN QUY" in c_chuc or "KHO QUY" in c_chuc:
            group_id, labor = 4, "Trực tiếp"
        elif "KIEM SOAT" in c_chuc or "HAU KIEM" in c_chuc or "KTKTNB" in c_dept:
            group_id, labor = 3, "Gián tiếp"
        elif "GIAO DICH" in c_chuc or "GDV" in c_chuc:
            group_id, labor = 1, "Trực tiếp"
        else:
            group_id, labor = 2, "Gián tiếp"

    if not labor:
        labor = "Trực tiếp" if group_id in (1, 4, 6) else "Gián tiếp"
    group_name = raw_group.strip() if raw_group.strip() else group_names.get(group_id, f"Nhóm {group_id}")
    return group_id, group_name, labor


def _map_salary_columns(ws, r_hdr: int) -> Dict[str, int]:
    cols = {
        "ten": 0, "ma": 0, "chuc": 0, "dept": 0, "nhom": 0,
        "pl": 0, "hsl": 0, "pccv": 0, "v1": 0, "v2": 0, "nc": 0, "thang": 0,
    }
    max_scan_c = min(ws.max_column, 35)
    for c in range(1, max_scan_c + 1):
        vc = clean_ascii(ws.cell(r_hdr, c).value or "")
        if len(vc) > 40:
            continue
        if not cols["ten"] and any(k in vc for k in ("HO VA TEN", "HO TEN", "TEN CAN BO", "TEN NV")):
            cols["ten"] = c
        elif not cols["ma"] and any(k in vc for k in ("MA CAN BO", "MA CB", "MA NV", "SO TAI KHOAN", "SO TK", "STK")):
            cols["ma"] = c
        elif not cols["chuc"] and any(k in vc for k in ("CHUC DANH", "CHUC VU", "VI TRI")):
            cols["chuc"] = c
        elif not cols["dept"] and any(k in vc for k in ("PHONG BAN", "PHONG")):
            cols["dept"] = c
        elif not cols["nhom"] and "NHOM" in vc:
            cols["nhom"] = c
        elif not cols["pl"] and "PHAN LOAI" in vc:
            cols["pl"] = c
        elif not cols["hsl"] and any(k in vc for k in ("HE SO V1", "HSL CB", "HSL V1", "HE SO")):
            cols["hsl"] = c
        elif not cols["pccv"] and any(k in vc for k in ("PHU CAP", "PCCV")):
            cols["pccv"] = c
        elif not cols["v1"] and any(k in vc for k in ("LUONG V1", "TONG V1", "LUONG CO BAN")):
            cols["v1"] = c
        elif not cols["v2"] and any(k in vc for k in ("MUC V2", "THU LAO V2", "MUC THU LAO", "LUONG V2")):
            cols["v2"] = c
        elif not cols["nc"] and any(k in vc for k in ("NGAY CONG", "CONG THUC TE")):
            cols["nc"] = c
        elif not cols["thang"] and (vc == "THANG" or vc.startswith("THANG")) and "MUC TIEU" not in vc:
            cols["thang"] = c

    if not cols["ten"]:
        cols["ten"] = 3
    if not cols["ma"]:
        cols["ma"] = 2
    if not cols["chuc"]:
        cols["chuc"] = 4
    if not cols["dept"]:
        cols["dept"] = 5
    return cols


def _map_target_columns(ws, r_hdr: int) -> Dict[str, int]:
    cols = {"ten": 0, "ma": 0, "mact": 0, "ti": 0, "ai": 0, "thang": 0}
    max_scan_c = min(ws.max_column, 35)
    for c in range(1, max_scan_c + 1):
        vc = clean_ascii(ws.cell(r_hdr, c).value or "")
        if len(vc) > 40:
            continue
        if not cols["ten"] and any(k in vc for k in ("HO VA TEN", "HO TEN", "TEN CAN BO")):
            cols["ten"] = c
        elif not cols["ma"] and any(k in vc for k in ("MA CAN BO", "MA CB", "MA NV")):
            cols["ma"] = c
        elif not cols["mact"] and any(k in vc for k in ("MA CHI TIEU", "MA CT")):
            cols["mact"] = c
        elif not cols["ti"] and any(k in vc for k in ("MUC TIEU", "KE HOACH", "GIAO KHOAN")):
            cols["ti"] = c
        elif not cols["ai"] and any(k in vc for k in ("THUC HIEN", "SO LIEU", "KET QUA")):
            cols["ai"] = c
        elif not cols["thang"] and (vc == "THANG" or vc.startswith("THANG")) and "MUC TIEU" not in vc:
            cols["thang"] = c

    if not cols["ma"]:
        cols["ma"] = 1
    if not cols["ten"]:
        cols["ten"] = 2
    if not cols["mact"]:
        cols["mact"] = 3
    if not cols["ti"]:
        cols["ti"] = 7
    if not cols["ai"]:
        cols["ai"] = 4
    return cols


def _plan_sheets_to_parse(wb, summary_keywords: Tuple[str, ...], scope: str, target_month: int):
    """Chọn sheet thông minh: ưu tiên sheet tổng hợp, kết hợp các sheet 'Thang 01..12' nếu thiếu."""
    summary_sheets = []
    month_sheets = {}
    other_sheets = []

    for name in wb.sheetnames:
        m_num = _extract_sheet_month(name)
        u = clean_ascii(name)
        if m_num > 0:
            month_sheets[m_num] = wb[name]
        elif any(k in u for k in summary_keywords):
            summary_sheets.append(wb[name])
        else:
            other_sheets.append(wb[name])

    if scope == "SINGLE":
        # Nếu có sheet tổng hợp (chứa cột Tháng), ưu tiên sheet tổng hợp; nếu chỉ có sheet riêng tháng đó thì đọc sheet tháng
        if summary_sheets:
            return summary_sheets, ("MULTI_MONTH_WORKBOOK" if month_sheets else "SUMMARY_SHEET")
        if target_month in month_sheets:
            return [month_sheets[target_month]], "MULTI_SHEET_THANG"
        return [other_sheets[0] if other_sheets else wb.active], "SINGLE_SHEET"

    # scope == "ALL_MONTHS":
    if summary_sheets:
        # Đọc từ sheet tổng hợp trước (tránh đọc trùng 2 lần cùng file 13 sheet), và chỉ bổ sung month_sheets nếu chưa xuất hiện
        return summary_sheets + [month_sheets[m] for m in sorted(month_sheets)], (
            "WORKBOOK_12_THANG" if month_sheets else "SUMMARY_WORKBOOK"
        )
    if month_sheets:
        return [month_sheets[m] for m in sorted(month_sheets)], "MULTI_SHEET_THANG"
    return [other_sheets[0] if other_sheets else wb.active], "SINGLE_SHEET"


def _parse_salary_workbook(
    db: Session,
    file_bytes: bytes,
    scope: str = "SINGLE",
    period_code: Optional[str] = None,
) -> Dict[str, Any]:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    cfg = db.query(SystemConfig).first()
    pcode_default = period_code or (cfg.current_period_code if cfg else "2026-10")
    periods = db.query(Period).order_by(Period.month_num.asc()).all()
    period_by_month = {p.month_num: p for p in periods}
    period_obj = next((p for p in periods if p.period_code == pcode_default), None)
    target_month = period_obj.month_num if period_obj else parse_month_number(pcode_default)
    base_salary = float(cfg.base_salary_agribank if cfg else 4730000.0)

    existing_emps = {e.emp_code: e for e in db.query(Employee).all()}
    sheets, detected_format = _plan_sheets_to_parse(wb, ("LUONG", "12_THANG", "V1", "V2", "IMPORT_LUONG"), scope, target_month)

    seen_keys = set()
    summary_months_present = set()
    rows_by_month: Dict[int, List[Dict[str, Any]]] = {}
    issues: List[Dict[str, Any]] = []
    source_sheets: List[str] = []

    is_summary_first = detected_format in ("WORKBOOK_12_THANG", "SUMMARY_WORKBOOK", "MULTI_MONTH_WORKBOOK")

    for ws in sheets:
        sheet_month = _extract_sheet_month(ws.title)
        # Tránh đọc trùng dữ liệu khi sheet tổng hợp đã phủ tháng này rồi
        if scope == "ALL_MONTHS" and is_summary_first and sheet_month > 0 and sheet_month in summary_months_present:
            continue

        r_hdr = _detect_header_row(ws, ("HO VA TEN", "HO TEN", "TEN CAN BO", "TEN NV"))
        cols = _map_salary_columns(ws, r_hdr)
        sheet_rows_added = 0

        for r in range(r_hdr + 1, ws.max_row + 1):
            name_val = str(ws.cell(r, cols["ten"]).value or "").strip()
            ma_val = str(ws.cell(r, cols["ma"]).value or "").strip() if cols["ma"] else ""
            c_clean = clean_ascii(name_val)
            if _is_total_or_header_label(c_clean):
                continue
            if not name_val and not ma_val:
                continue

            raw_m = ws.cell(r, cols["thang"]).value if cols["thang"] else None
            m_parsed = parse_month_number(raw_m) if raw_m is not None and str(raw_m).strip() != "" else 0
            eff_month = m_parsed if m_parsed > 0 else (sheet_month if sheet_month > 0 else target_month)

            if scope == "SINGLE" and eff_month != target_month:
                continue
            if eff_month < 1 or eff_month > 12:
                issues.append({
                    "severity": "error", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma_val, "message": f"Cột Tháng không hợp lệ ({raw_m})",
                })
                continue

            if is_summary_first and sheet_month == 0:
                summary_months_present.add(eff_month)

            p_info = period_by_month.get(eff_month)
            default_wd = float(p_info.standard_days) if p_info else float(cfg.standard_workdays if cfg else 22.0)

            key = (eff_month, ma_val)
            if ma_val and key in seen_keys:
                issues.append({
                    "severity": "warning", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma_val, "message": f"Trùng Mã CB {ma_val} trong Tháng {eff_month} (giữ bản ghi sau)",
                })
                rows_by_month[eff_month] = [x for x in rows_by_month.get(eff_month, []) if x["emp_code"] != ma_val]

            if not ma_val:
                ma_val = f"CB_{eff_month}_{r}"
                issues.append({
                    "severity": "warning", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma_val, "message": f"Thiếu Mã CB cho '{name_val}', tự gán tạm {ma_val}",
                })

            seen_keys.add((eff_month, ma_val))
            title = str(ws.cell(r, cols["chuc"]).value or "").strip() if cols["chuc"] else ""
            dept = str(ws.cell(r, cols["dept"]).value or "").strip() if cols["dept"] else ""
            raw_nhom = str(ws.cell(r, cols["nhom"]).value or "").strip() if cols["nhom"] else ""
            raw_pl = str(ws.cell(r, cols["pl"]).value or "").strip() if cols["pl"] else ""
            gid, gname, labor = _auto_classify_employee(title, dept, raw_nhom, raw_pl)

            hsl = _num_val(ws, r, cols["hsl"], 1.0) or 1.0
            pccv = _num_val(ws, r, cols["pccv"], 0.0) or 0.0
            v1 = _num_val(ws, r, cols["v1"], 0.0) or 0.0
            if v1 == 0.0 and hsl > 0:
                v1 = round(hsl * base_salary, 0)
            v2 = _num_val(ws, r, cols["v2"], 0.0) or 0.0
            nc = _num_val(ws, r, cols["nc"], default_wd)
            if nc is None or nc <= 0:
                nc = default_wd

            if v1 < 0 or v2 < 0 or nc > 31:
                issues.append({
                    "severity": "error", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma_val, "message": f"Giá trị lương/ngày công bất thường (V1={v1}, V2={v2}, NC={nc})",
                })

            is_new_emp = ma_val not in existing_emps
            if is_new_emp:
                issues.append({
                    "severity": "info", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma_val, "message": f"Cán bộ mới '{name_val}' sẽ được bổ sung vào 1.DM_CanBo",
                })

            rows_by_month.setdefault(eff_month, []).append({
                "month_num": eff_month,
                "emp_code": ma_val,
                "full_name": name_val,
                "title": title,
                "department": dept,
                "group_id": gid,
                "group_name": gname,
                "labor_type": labor,
                "hsl_v1": hsl,
                "pccv": pccv,
                "base_v1": v1,
                "base_v2": v2,
                "actual_workdays": nc,
                "is_new_emp": is_new_emp,
                "sheet_name": ws.title,
                "row_num": r,
            })
            sheet_rows_added += 1

        if sheet_rows_added > 0:
            source_sheets.append(ws.title)

    if not rows_by_month:
        raise ValueError(f"Không tìm thấy dữ liệu lương hợp lệ trong file Excel ({', '.join(wb.sheetnames[:3])})")

    months_summary = []
    for m in sorted(rows_by_month.keys()):
        m_rows = rows_by_month[m]
        p_info = period_by_month.get(m)
        m_issues = [x for x in issues if x["month_num"] == m and x["severity"] in ("error", "warning")]
        months_summary.append({
            "month_num": m,
            "period_code": p_info.period_code if p_info else f"2026-{m:02d}",
            "period_name": p_info.period_name if p_info else f"Tháng {m:02d}/2026",
            "period_status": p_info.status if p_info else "CHƯA MỞ",
            "row_count": len(m_rows),
            "sum_v1": sum(x["base_v1"] for x in m_rows),
            "sum_v2": sum(x["base_v2"] for x in m_rows),
            "sum_workdays": sum(x["actual_workdays"] for x in m_rows),
            "new_employees": sum(1 for x in m_rows if x["is_new_emp"]),
            "issue_count": len(m_issues),
        })

    return {
        "kind": "salary",
        "scope": scope,
        "detected_format": detected_format,
        "source_sheets": source_sheets,
        "months_summary": months_summary,
        "rows_by_month": rows_by_month,
        "issues": issues[:200],
        "total_rows": sum(len(v) for v in rows_by_month.values()),
    }


def _parse_targets_workbook(
    db: Session,
    file_bytes: bytes,
    scope: str = "SINGLE",
    period_code: Optional[str] = None,
) -> Dict[str, Any]:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    cfg = db.query(SystemConfig).first()
    pcode_default = period_code or (cfg.current_period_code if cfg else "2026-10")
    periods = db.query(Period).order_by(Period.month_num.asc()).all()
    period_by_month = {p.month_num: p for p in periods}
    period_obj = next((p for p in periods if p.period_code == pcode_default), None)
    target_month = period_obj.month_num if period_obj else parse_month_number(pcode_default)

    emps = db.query(Employee).all()
    by_code = {e.emp_code: e for e in emps}
    by_name = {clean_ascii(e.full_name): e for e in emps}
    valid_indicators = {i.code: i for i in db.query(Indicator).all()}

    sheets, detected_format = _plan_sheets_to_parse(wb, ("CHI_TIEU", "CHITIEU", "KET_QUA", "GIAO_KHOAN", "12_THANG"), scope, target_month)

    seen_keys = {}
    summary_months_present = set()
    rows_by_month: Dict[int, List[Dict[str, Any]]] = {}
    issues: List[Dict[str, Any]] = []
    source_sheets: List[str] = []

    is_summary_first = detected_format in ("WORKBOOK_12_THANG", "SUMMARY_WORKBOOK", "MULTI_MONTH_WORKBOOK")

    for ws in sheets:
        sheet_month = _extract_sheet_month(ws.title)
        if scope == "ALL_MONTHS" and is_summary_first and sheet_month > 0 and sheet_month in summary_months_present:
            continue

        r_hdr = _detect_header_row(ws, ("HO VA TEN", "HO TEN", "TEN CAN BO", "TEN NV", "MA CHI TIEU"))
        cols = _map_target_columns(ws, r_hdr)
        sheet_rows_added = 0

        for r in range(r_hdr + 1, ws.max_row + 1):
            ma = str(ws.cell(r, cols["ma"]).value or "").strip() if cols["ma"] else ""
            ten = str(ws.cell(r, cols["ten"]).value or "").strip() if cols["ten"] else ""
            mact = str(ws.cell(r, cols["mact"]).value or "").strip() if cols["mact"] else ""
            c_clean = clean_ascii(ten)
            if _is_total_or_header_label(c_clean) or c_clean == "HO VA TEN CAN BO":
                continue
            if not mact or (not ma and not ten):
                continue

            raw_m = ws.cell(r, cols["thang"]).value if cols["thang"] else None
            m_parsed = parse_month_number(raw_m) if raw_m is not None and str(raw_m).strip() != "" else 0
            eff_month = m_parsed if m_parsed > 0 else (sheet_month if sheet_month > 0 else target_month)

            if scope == "SINGLE" and eff_month != target_month:
                continue
            if eff_month < 1 or eff_month > 12:
                issues.append({
                    "severity": "error", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma, "message": f"Cột Tháng không hợp lệ ({raw_m})",
                })
                continue

            if is_summary_first and sheet_month == 0:
                summary_months_present.add(eff_month)

            resolved_name = ten
            if ma not in by_code and clean_ascii(ten) in by_name:
                emp_obj = by_name[clean_ascii(ten)]
                ma = emp_obj.emp_code
                resolved_name = emp_obj.full_name
            elif ma in by_code:
                resolved_name = by_code[ma].full_name
            else:
                issues.append({
                    "severity": "warning", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma or ten, "message": f"Mã CB '{ma}' ({ten}) chưa có trong 1.DM_CanBo",
                })

            if mact not in valid_indicators:
                issues.append({
                    "severity": "error", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma, "message": f"Mã chỉ tiêu '{mact}' chưa được khai báo trong Danh mục GK",
                })

            ti = _num_val(ws, r, cols["ti"], 0.0) or 0.0
            ai = _num_val(ws, r, cols["ai"], 0.0) or 0.0
            if ti < 0 or ai < 0:
                issues.append({
                    "severity": "error", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma, "message": f"Số liệu âm cho chỉ tiêu {mact} (Ti={ti}, Ai={ai})",
                })

            key = (eff_month, ma, mact)
            if key in seen_keys:
                issues.append({
                    "severity": "warning", "month_num": eff_month, "sheet_name": ws.title, "row_num": r,
                    "emp_code": ma, "message": f"Trùng chỉ tiêu {mact} của {ma} ở Tháng {eff_month}",
                })
                rows_by_month[eff_month] = [
                    x for x in rows_by_month.get(eff_month, [])
                    if not (x["emp_code"] == ma and x["indicator_code"] == mact)
                ]
            seen_keys[key] = True

            rows_by_month.setdefault(eff_month, []).append({
                "month_num": eff_month,
                "emp_code": ma,
                "full_name": resolved_name,
                "indicator_code": mact,
                "indicator_name": valid_indicators[mact].name if mact in valid_indicators else mact,
                "target_value": ti,
                "actual_value": ai,
                "sheet_name": ws.title,
                "row_num": r,
            })
            sheet_rows_added += 1

        if sheet_rows_added > 0:
            source_sheets.append(ws.title)

    if not rows_by_month:
        raise ValueError(f"Không tìm thấy dữ liệu chỉ tiêu hợp lệ trong file Excel ({', '.join(wb.sheetnames[:3])})")

    months_summary = []
    for m in sorted(rows_by_month.keys()):
        m_rows = rows_by_month[m]
        p_info = period_by_month.get(m)
        m_issues = [x for x in issues if x["month_num"] == m and x["severity"] in ("error", "warning")]
        months_summary.append({
            "month_num": m,
            "period_code": p_info.period_code if p_info else f"2026-{m:02d}",
            "period_name": p_info.period_name if p_info else f"Tháng {m:02d}/2026",
            "period_status": p_info.status if p_info else "CHƯA MỞ",
            "row_count": len(m_rows),
            "employee_count": len({x["emp_code"] for x in m_rows}),
            "indicator_count": len({x["indicator_code"] for x in m_rows}),
            "sum_ti": round(sum(x["target_value"] for x in m_rows), 3),
            "sum_ai": round(sum(x["actual_value"] for x in m_rows), 3),
            "issue_count": len(m_issues),
        })

    return {
        "kind": "targets",
        "scope": scope,
        "detected_format": detected_format,
        "source_sheets": source_sheets,
        "months_summary": months_summary,
        "rows_by_month": rows_by_month,
        "issues": issues[:200],
        "total_rows": sum(len(v) for v in rows_by_month.values()),
    }


def _strip_rows_for_preview(parsed: Dict[str, Any], limit_per_month: int = 120) -> Dict[str, Any]:
    sample_by_month = {
        str(m): rows[:limit_per_month]
        for m, rows in parsed["rows_by_month"].items()
    }
    return {
        "kind": parsed["kind"],
        "scope": parsed["scope"],
        "detected_format": parsed["detected_format"],
        "source_sheets": parsed["source_sheets"],
        "months_summary": parsed["months_summary"],
        "sample_by_month": sample_by_month,
        "issues": parsed["issues"],
        "total_rows": parsed["total_rows"],
    }


def preview_salary_excel(db: Session, file_bytes: bytes, scope: str = "SINGLE", period_code: Optional[str] = None) -> Dict[str, Any]:
    parsed = _parse_salary_workbook(db, file_bytes, scope=scope, period_code=period_code)
    return _strip_rows_for_preview(parsed)


def preview_targets_excel(db: Session, file_bytes: bytes, scope: str = "SINGLE", period_code: Optional[str] = None) -> Dict[str, Any]:
    parsed = _parse_targets_workbook(db, file_bytes, scope=scope, period_code=period_code)
    return _strip_rows_for_preview(parsed)


def commit_salary_dataset(
    db: Session,
    file_bytes: bytes,
    scope: str = "SINGLE",
    period_code: Optional[str] = None,
    selected_months: Optional[List[int]] = None,
    replace_existing: bool = True,
    overwrite_locked: bool = False,
    sync_history: bool = False,
) -> Dict[str, Any]:
    parsed = _parse_salary_workbook(db, file_bytes, scope=scope, period_code=period_code)
    periods = {p.month_num: p for p in db.query(Period).all()}
    default_staff_pw = hash_password("123456")

    applied_periods = []
    skipped_locked = []
    total_saved = 0

    for m, m_rows in sorted(parsed["rows_by_month"].items()):
        if selected_months is not None and m not in selected_months:
            continue
        p = periods.get(m)
        pcode = p.period_code if p else f"2026-{m:02d}"
        if p and p.status == "ĐÃ KHÓA" and not overwrite_locked:
            skipped_locked.append(p.period_name)
            continue

        if replace_existing:
            db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode).delete()

        # Chỉ cập nhật master 1.DM_CanBo đối với kỳ mới nhất trong batch hoặc khi bổ sung CB mới
        is_latest_month = (m == max(parsed["rows_by_month"].keys()))
        for idx, item in enumerate(m_rows, 1):
            emp = db.query(Employee).filter(Employee.emp_code == item["emp_code"]).first()
            if emp:
                if is_latest_month or not emp.full_name:
                    emp.full_name = item["full_name"]
                    emp.title = item["title"] or emp.title
                    emp.department = item["department"] or emp.department
                    emp.group_id = item["group_id"]
                    emp.group_name = item["group_name"]
                    emp.labor_type = item["labor_type"]
                    emp.hsl_v1 = item["hsl_v1"]
                    emp.pccv = item["pccv"]
                    emp.base_v1 = item["base_v1"]
                    emp.base_v2 = item["base_v2"]
                    emp.is_active = True
                    emp.is_ksv = item["group_id"] in (3, 5)
                    emp.sort_order = idx
            else:
                db.add(Employee(
                    emp_code=item["emp_code"],
                    full_name=item["full_name"],
                    title=item["title"],
                    department=item["department"],
                    group_id=item["group_id"],
                    group_name=item["group_name"],
                    labor_type=item["labor_type"],
                    hsl_v1=item["hsl_v1"],
                    pccv=item["pccv"],
                    base_v1=item["base_v1"],
                    base_v2=item["base_v2"],
                    is_active=True,
                    is_ksv=item["group_id"] in (3, 5),
                    password_hash=default_staff_pw,
                    sort_order=idx,
                ))
                db.flush()

            existing_sal = db.query(SalaryImportRow).filter(
                SalaryImportRow.period_code == pcode,
                SalaryImportRow.emp_code == item["emp_code"],
            ).first()
            if existing_sal:
                existing_sal.full_name = item["full_name"]
                existing_sal.title = item["title"]
                existing_sal.department = item["department"]
                existing_sal.group_name = item["group_name"]
                existing_sal.labor_type = item["labor_type"]
                existing_sal.hsl_v1 = item["hsl_v1"]
                existing_sal.base_v1 = item["base_v1"]
                existing_sal.base_v2 = item["base_v2"]
                existing_sal.actual_workdays = item["actual_workdays"]
                existing_sal.status = "Hợp lệ"
            else:
                db.add(SalaryImportRow(
                    period_code=pcode,
                    emp_code=item["emp_code"],
                    full_name=item["full_name"],
                    title=item["title"],
                    department=item["department"],
                    group_name=item["group_name"],
                    labor_type=item["labor_type"],
                    hsl_v1=item["hsl_v1"],
                    base_v1=item["base_v1"],
                    base_v2=item["base_v2"],
                    actual_workdays=item["actual_workdays"],
                    status="Hợp lệ",
                ))
        db.flush()

        # Nếu kỳ đã khóa có đủ chỉ tiêu và bật sync_history -> đồng bộ lại snapshot V3
        if sync_history and p and p.status == "ĐÃ KHÓA":
            has_tgt = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == pcode).count() > 0
            if has_tgt:
                sync_period_snapshot(db, pcode, frozen=True)

        applied_periods.append({"period_code": pcode, "month_num": m, "count": len(m_rows)})
        total_saved += len(m_rows)

    db.commit()
    return {
        "sheet_name": ", ".join(parsed["source_sheets"]),
        "count": total_saved,
        "applied_periods": applied_periods,
        "skipped_locked": skipped_locked,
    }


def commit_targets_dataset(
    db: Session,
    file_bytes: bytes,
    scope: str = "SINGLE",
    period_code: Optional[str] = None,
    selected_months: Optional[List[int]] = None,
    replace_existing: bool = True,
    overwrite_locked: bool = False,
    sync_history: bool = False,
) -> Dict[str, Any]:
    parsed = _parse_targets_workbook(db, file_bytes, scope=scope, period_code=period_code)
    periods = {p.month_num: p for p in db.query(Period).all()}

    applied_periods = []
    skipped_locked = []
    total_saved = 0

    for m, m_rows in sorted(parsed["rows_by_month"].items()):
        if selected_months is not None and m not in selected_months:
            continue
        p = periods.get(m)
        pcode = p.period_code if p else f"2026-{m:02d}"
        if p and p.status == "ĐÃ KHÓA" and not overwrite_locked:
            skipped_locked.append(p.period_name)
            continue

        if replace_existing:
            db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == pcode).delete()

        for item in m_rows:
            existing = db.query(TargetExecutionRow).filter(
                TargetExecutionRow.period_code == pcode,
                TargetExecutionRow.emp_code == item["emp_code"],
                TargetExecutionRow.indicator_code == item["indicator_code"],
            ).first()
            if existing:
                existing.target_value = item["target_value"]
                existing.actual_value = item["actual_value"]
            else:
                db.add(TargetExecutionRow(
                    period_code=pcode,
                    emp_code=item["emp_code"],
                    indicator_code=item["indicator_code"],
                    target_value=item["target_value"],
                    actual_value=item["actual_value"],
                    status="Hợp lệ",
                ))
        db.flush()

        if sync_history and p and p.status == "ĐÃ KHÓA":
            has_sal = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == pcode).count() > 0
            if has_sal:
                sync_period_snapshot(db, pcode, frozen=True)

        applied_periods.append({"period_code": pcode, "month_num": m, "count": len(m_rows)})
        total_saved += len(m_rows)

    db.commit()
    return {
        "sheet_name": ", ".join(parsed["source_sheets"]),
        "count": total_saved,
        "applied_periods": applied_periods,
        "skipped_locked": skipped_locked,
    }


def import_salary_excel(
    db: Session,
    file_bytes: bytes,
    period_code: str,
    replace_existing: bool = True,
) -> Dict[str, Any]:
    """Wrapper tương thích cho endpoint import 1 kỳ."""
    res = commit_salary_dataset(
        db, file_bytes, scope="SINGLE", period_code=period_code,
        replace_existing=replace_existing, overwrite_locked=True, sync_history=False,
    )
    return {"sheet_name": res["sheet_name"], "count": res["count"]}


def import_targets_excel(
    db: Session,
    file_bytes: bytes,
    period_code: str,
    replace_existing: bool = True,
) -> Dict[str, Any]:
    """Wrapper tương thích cho endpoint import 1 kỳ."""
    res = commit_targets_dataset(
        db, file_bytes, scope="SINGLE", period_code=period_code,
        replace_existing=replace_existing, overwrite_locked=True, sync_history=False,
    )
    return {"sheet_name": res["sheet_name"], "count": res["count"]}


def export_dataset_12_months_excel(db: Session, kind: str = "salary", year_num: int = 2026) -> bytes:
    """Xuất toàn bộ Dataset 12 tháng chuẩn 13 sheet (tổng hợp + Thang 01..12) đúng chuẩn 2 file mẫu."""
    wb = openpyxl.Workbook()
    thin = Side(border_style="thin", color="CBD5E1")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    hdr_fill = PatternFill("solid", fgColor="9E1B32")
    hdr_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=13, bold=True, color="9E1B32")

    periods = db.query(Period).filter(Period.year_num == year_num).order_by(Period.month_num.asc()).all()
    emps = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc()).all()
    emp_map = {e.emp_code: e for e in emps}
    inds = db.query(Indicator).order_by(Indicator.sort_order.asc()).all()
    ind_map = {i.code: i for i in inds}

    ws_all = wb.active
    if kind == "salary":
        ws_all.title = "BANG_LUONG_12_THANG"
        headers = ["STT", "Mã Cán bộ", "Họ và tên", "Chức danh", "Phòng ban", "Nhóm Cán bộ", "Phân loại", "Hệ số V1", "Phụ cấp CV", "Lương V1 cơ bản", "Mức V2 gốc (Fi)", "Ngày công thực tế", "Tháng"]

        def build_month_rows(p: Period):
            sal_rows = db.query(SalaryImportRow).filter(SalaryImportRow.period_code == p.period_code).order_by(SalaryImportRow.id.asc()).all()
            if sal_rows:
                return [
                    [
                        r.emp_code, r.full_name, r.title, r.department, r.group_name, r.labor_type,
                        r.hsl_v1, emp_map[r.emp_code].pccv if r.emp_code in emp_map else 0.0,
                        r.base_v1, r.base_v2, r.actual_workdays, p.month_num,
                    ]
                    for r in sal_rows
                ]
            return [
                [
                    e.emp_code, e.full_name, e.title, e.department, e.group_name, e.labor_type,
                    e.hsl_v1, e.pccv, e.base_v1, e.base_v2, p.standard_days, p.month_num,
                ]
                for e in emps
            ]

        ws_all["A1"] = f"BẢNG QUY CHUẨN DỮ LIỆU TIỀN LƯƠNG 3P (12 THÁNG NĂM {year_num})"
        ws_all["A1"].font = title_font
        for ci, h in enumerate(headers, 1):
            c = ws_all.cell(4, ci, h)
            c.fill = hdr_fill
            c.font = hdr_font
            c.border = border

        all_idx = 0
        for p in periods:
            m_items = build_month_rows(p)
            ws_m = wb.create_sheet(f"Thang {p.month_num:02d}")
            ws_m["A1"] = f"BẢNG LƯƠNG V1 + V2 GỐC VÀ NGÀY CÔNG (THÁNG {p.month_num:02d}/{year_num})"
            ws_m["A1"].font = title_font
            for ci, h in enumerate(headers, 1):
                c = ws_m.cell(4, ci, h)
                c.fill = hdr_fill
                c.font = hdr_font
                c.border = border
            for m_idx, vals in enumerate(m_items, 1):
                all_idx += 1
                for ws_t, r_pos, stt_v in ((ws_all, 4 + all_idx, all_idx), (ws_m, 4 + m_idx, m_idx)):
                    row_full = [stt_v] + vals
                    for ci, v in enumerate(row_full, 1):
                        cell = ws_t.cell(r_pos, ci, v)
                        cell.border = border
                        if ci in (10, 11):
                            cell.number_format = "#,##0"
    else:
        ws_all.title = "CHI_TIEU_12_THANG"
        headers = ["Mã Cán bộ", "Họ và tên Cán bộ", "Mã Chỉ tiêu", "Tên chỉ tiêu kinh doanh", "Đơn vị tính", "Mục tiêu tháng (Ti)", "Số liệu thực hiện (Ai)", "Tháng"]

        def build_target_rows(p: Period):
            t_rows = db.query(TargetExecutionRow).filter(TargetExecutionRow.period_code == p.period_code).order_by(TargetExecutionRow.id.asc()).all()
            if t_rows:
                out = []
                for tr in t_rows:
                    emp = emp_map.get(tr.emp_code)
                    ind = ind_map.get(tr.indicator_code)
                    out.append([
                        tr.emp_code,
                        emp.full_name if emp else tr.emp_code,
                        tr.indicator_code,
                        ind.name if ind else tr.indicator_code,
                        ind.unit if ind else "",
                        tr.target_value,
                        tr.actual_value,
                        p.month_num,
                    ])
                return out
            out = []
            for e in emps:
                for ind in inds:
                    ti = round((ind.target_direct if e.labor_type == "Trực tiếp" else ind.target_indirect) / 12.0, 3)
                    out.append([e.emp_code, e.full_name, ind.code, ind.name, ind.unit, ti, ti, p.month_num])
            return out

        ws_all["A1"] = f"BẢNG KẾT QUẢ THỰC HIỆN CHỈ TIÊU KINH DOANH GIAO KHOÁN (12 THÁNG NĂM {year_num})"
        ws_all["A1"].font = title_font
        for ci, h in enumerate(headers, 1):
            c = ws_all.cell(4, ci, h)
            c.fill = hdr_fill
            c.font = hdr_font
            c.border = border

        all_r = 4
        for p in periods:
            m_items = build_target_rows(p)
            ws_m = wb.create_sheet(f"Thang {p.month_num:02d}")
            ws_m["A1"] = f"BẢNG KẾT QUẢ THỰC HIỆN CHỈ TIÊU KINH DOANH (THÁNG {p.month_num:02d}/{year_num})"
            ws_m["A1"].font = title_font
            for ci, h in enumerate(headers, 1):
                c = ws_m.cell(4, ci, h)
                c.fill = hdr_fill
                c.font = hdr_font
                c.border = border
            for m_idx, vals in enumerate(m_items, 1):
                all_r += 1
                for ws_t, r_pos in ((ws_all, all_r), (ws_m, 4 + m_idx)):
                    for ci, v in enumerate(vals, 1):
                        cell = ws_t.cell(r_pos, ci, v)
                        cell.border = border

    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = max((len(str(cell.value or "")) for cell in col), default=10)
            sheet.column_dimensions[col[0].column_letter].width = min(max(max_len + 3, 12), 42)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_payroll_workbook(db: Session, period_code: str, include_open_in_v3: bool = False) -> bytes:
    """Xuất file Excel tổng hợp chuẩn ngân hàng (KPI_Thang, BangLuong_3P, In_BangLuong_V2, In_BangLuong_V3, TichLuy_V3)."""
    calc = compute_period_kpi_and_payroll(db, period_code)
    v3 = compute_accumulation_v3(db, include_open_period=include_open_in_v3)

    wb = openpyxl.Workbook()
    thin = Side(border_style="thin", color="CBD5E1")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    hdr_fill = PatternFill("solid", fgColor="9E1B32")
    hdr_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="9E1B32")

    # 1. Sheet BangLuong_3P
    ws1 = wb.active
    ws1.title = "BangLuong_3P"
    ws1["A1"] = f"BẢNG THANH TOÁN TIỀN LƯƠNG 3P - {calc['period_name'].upper()}"
    ws1["A1"].font = title_font
    headers1 = [
        "STT", "Mã CB", "Họ và tên", "Phòng ban", "Chức danh",
        "Lương V1 CB", "Lương V2 gốc", "Tổng trước ĐC", "Tcv", "Xếp loại",
        "Ngày công", "Tỷ lệ NC", "Lương V1 thực lĩnh", "Lương V2 sau ĐC",
        "Tổng lương sau ĐC", "Lương NS (NSi)", "Chênh lệch", "Tổng thực lĩnh", "Ghi chú"
    ]
    for ci, h in enumerate(headers1, 1):
        cell = ws1.cell(3, ci, h)
        cell.fill = hdr_fill
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border

    for idx, r in enumerate(calc["payroll_rows"], 1):
        row_idx = 3 + idx
        vals = [
            idx, r["emp_code"], r["full_name"], r["department"], r["title"],
            r["base_v1"], r["base_v2"], r["total_before"], r["tcv"], r["rating"],
            r["actual_workdays"], r["workday_ratio"], r["v1_actual"], r["v2_adj"],
            r["total_after"], r["nsi"], r["diff_ns"], r["takehome"], r["remark"]
        ]
        for ci, val in enumerate(vals, 1):
            c = ws1.cell(row_idx, ci, val)
            c.border = border
            if ci in (6, 7, 8, 13, 14, 15, 16, 17, 18):
                c.number_format = "#,##0"
            elif ci == 12:
                c.number_format = "0.0%"

    # 2. Sheet In_BangLuong_V2
    ws2 = wb.create_sheet("In_BangLuong_V2")
    ws2["A1"] = f"BẢNG THANH TOÁN LƯƠNG KINH DOANH (V2) - {calc['period_name'].upper()}"
    ws2["A1"].font = title_font
    headers2 = ["STT", "Mã CB", "Họ và tên", "Chức danh", "Phòng ban", "Lương V2 định mức", "Hệ số Tcv", "Ngày công", "Lương V2 thực lĩnh", "Ký nhận"]
    for ci, h in enumerate(headers2, 1):
        c = ws2.cell(3, ci, h)
        c.fill = hdr_fill
        c.font = hdr_font
        c.border = border
    for idx, r in enumerate(calc["payroll_rows"], 1):
        vals = [idx, r["emp_code"], r["full_name"], r["title"], r["department"], r["base_v2"], r["tcv"], r["actual_workdays"], r["v2_adj"], ""]
        for ci, val in enumerate(vals, 1):
            c = ws2.cell(3 + idx, ci, val)
            c.border = border
            if ci in (6, 9):
                c.number_format = "#,##0"
    tot_r2 = 4 + len(calc["payroll_rows"])
    ws2.cell(tot_r2, 1, "TỔNG CỘNG").font = Font(bold=True)
    ws2.cell(tot_r2, 6, calc["totals"]["base_v2"]).number_format = "#,##0"
    ws2.cell(tot_r2, 9, calc["totals"]["v2_adj"]).number_format = "#,##0"
    ws2.cell(tot_r2 + 2, 1, f"Bằng chữ: {calc['totals']['v2_adj_in_words']}")

    # 3. Sheet In_BangLuong_V3
    ws3 = wb.create_sheet("In_BangLuong_V3")
    ws3["A1"] = f"BẢNG QUYẾT TOÁN & THANH TOÁN THÙ LAO NĂNG SUẤT V3 NĂM {v3['year_num']}"
    ws3["A1"].font = title_font
    headers3 = ["STT", "Mã CB", "Họ và tên", "Chức danh", "Hệ số kq", "Tổng V1 năm", "V2 sau ĐC QT", "Căn cứ PB (V1+V2)", "Tỷ trọng PB", "Thù lao V3 thực lĩnh", "Ký nhận"]
    for ci, h in enumerate(headers3, 1):
        c = ws3.cell(3, ci, h)
        c.fill = hdr_fill
        c.font = hdr_font
        c.border = border
    for idx, r in enumerate(v3["rows"], 1):
        yr = r["year"]
        vals = [idx, r["emp_code"], r["full_name"], r["title"], yr["kq"], yr["v1_total"], yr["v2_qt"], yr["v3_basis"], yr["v3_ratio"], yr["v3_amount"], ""]
        for ci, val in enumerate(vals, 1):
            c = ws3.cell(3 + idx, ci, val)
            c.border = border
            if ci in (6, 7, 8, 10):
                c.number_format = "#,##0"
            elif ci == 9:
                c.number_format = "0.00%"
    tot_r3 = 4 + len(v3["rows"])
    ws3.cell(tot_r3, 1, "TỔNG CỘNG").font = Font(bold=True)
    ws3.cell(tot_r3, 6, v3["totals"]["v1_total"]).number_format = "#,##0"
    ws3.cell(tot_r3, 7, v3["totals"]["v2_qt"]).number_format = "#,##0"
    ws3.cell(tot_r3, 10, v3["totals"]["v3_amount"]).number_format = "#,##0"
    ws3.cell(tot_r3 + 2, 1, f"Bằng chữ: {v3['totals']['v3_in_words']}")

    for ws in (ws1, ws2, ws3):
        for col in ws.columns:
            max_len = max((len(str(cell.value or "")) for cell in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max(max_len + 4, 12), 36)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_template_salary_excel(db: Session) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "IMPORT_LUONG"
    headers = ["STT", "Mã Cán bộ", "Họ và tên", "Chức danh", "Phòng ban", "Nhóm Cán bộ", "Phân loại", "Hệ số V1", "Phụ cấp CV", "Lương V1 cơ bản", "Mức V2 gốc (Fi)", "Ngày công thực tế", "Tháng"]
    for ci, h in enumerate(headers, 1):
        ws.cell(4, ci, h).font = Font(bold=True)
    cfg = db.query(SystemConfig).first()
    p = db.query(Period).filter(Period.period_code == (cfg.current_period_code if cfg else "2026-10")).first()
    m_num = p.month_num if p else 10
    std_d = p.standard_days if p else 22
    for idx, e in enumerate(db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc()).all(), 1):
        vals = [idx, e.emp_code, e.full_name, e.title, e.department, e.group_name, e.labor_type, e.hsl_v1, e.pccv, e.base_v1, e.base_v2, std_d, m_num]
        for ci, v in enumerate(vals, 1):
            ws.cell(4 + idx, ci, v)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_template_targets_excel(db: Session) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "IMPORT_CHI_TIEU"
    headers = ["Mã Cán bộ", "Họ và tên Cán bộ", "Mã Chỉ tiêu", "Tên chỉ tiêu kinh doanh", "Đơn vị tính", "Mục tiêu tháng (Ti)", "Số liệu thực hiện (Ai)", "Tháng"]
    for ci, h in enumerate(headers, 1):
        ws.cell(4, ci, h).font = Font(bold=True)
    cfg = db.query(SystemConfig).first()
    p = db.query(Period).filter(Period.period_code == (cfg.current_period_code if cfg else "2026-10")).first()
    m_num = p.month_num if p else 10
    inds = db.query(Indicator).order_by(Indicator.sort_order.asc()).all()
    emps = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.sort_order.asc()).all()
    r = 5
    for e in emps:
        for ind in inds:
            ti = round((ind.target_direct if e.labor_type == "Trực tiếp" else ind.target_indirect) / 12.0, 3)
            ws.cell(r, 1, e.emp_code)
            ws.cell(r, 2, e.full_name)
            ws.cell(r, 3, ind.code)
            ws.cell(r, 4, ind.name)
            ws.cell(r, 5, ind.unit)
            ws.cell(r, 6, ti)
            ws.cell(r, 7, ti)
            ws.cell(r, 8, m_num)
            r += 1
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
