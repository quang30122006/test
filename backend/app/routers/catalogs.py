from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Employee, Indicator, InternalRule, KpiErrorCode, SystemConfig
from ..auth import get_current_user, require_admin, hash_password
from ..audit import log_audit

router = APIRouter(prefix="/api/catalogs", tags=["Catalogs"])

GROUP_NAMES = {
    1: "Nhóm 1 - Giao dịch viên trực tiếp khách hàng",
    2: "Nhóm 2 - Kế toán & Giao dịch viên nội bộ",
    3: "Nhóm 3 - Cán bộ hậu kiểm",
    4: "Nhóm 4 - Thủ quỹ & Ngân quỹ kho quỹ",
    5: "Nhóm 5 - Kiểm soát viên & Lãnh đạo phòng",
    6: "Nhóm 6 - Cán bộ Tín dụng & QLKH",
}


class EmployeeReq(BaseModel):
    emp_code: str
    full_name: str
    title: str = ""
    department: str = ""
    group_id: int = 1
    group_name: Optional[str] = None
    labor_type: str = "Trực tiếp"
    hsl_v1: float = 1.0
    pccv: float = 0.0
    base_v1: float = 0.0
    base_v2: float = 0.0
    is_ksv: Optional[bool] = None
    is_active: bool = True


class IndicatorReq(BaseModel):
    code: str
    category: str
    kpi_branch: str = "DV"
    name: str
    unit: str = ""
    weight: float = 0.0
    target_direct: float = 0.0
    target_indirect: Optional[float] = None


class InternalRuleReq(BaseModel):
    code: str
    group_name: str = ""
    description: str
    points: float
    criteria: str = "3.1 Nội quy"
    note: str = ""


class KpiErrorCodeReq(BaseModel):
    code: str
    source_type: str = "PHU_LUC_3"
    level_name: str = "Mức I"
    points: float = -1.0
    description: str
    scope: str = ""
    applicable_groups: str = "1,2,3,4,5,6"


# ---- 1. DANH MỤC CÁN BỘ ----
@router.get("/employees")
def list_employees(include_inactive: bool = False, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(Employee)
    if not include_inactive:
        q = q.filter(Employee.is_active == True)
    emps = q.order_by(Employee.sort_order.asc(), Employee.id.asc()).all()
    return [
        {
            "id": e.id,
            "emp_code": e.emp_code,
            "full_name": e.full_name,
            "title": e.title,
            "department": e.department,
            "group_id": e.group_id,
            "group_name": e.group_name,
            "labor_type": e.labor_type,
            "hsl_v1": e.hsl_v1,
            "pccv": e.pccv,
            "base_v1": e.base_v1,
            "base_v2": e.base_v2,
            "is_ksv": e.is_ksv,
            "is_active": e.is_active,
            "display_label": f"{e.emp_code} - {e.full_name} - {e.department}",
        }
        for e in emps
    ]


@router.get("/ksv-candidates")
def list_ksv_candidates(user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    emps = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.is_ksv.desc(), Employee.sort_order.asc()).all()
    return [
        {"emp_code": e.emp_code, "full_name": e.full_name, "title": e.title, "department": e.department, "is_ksv": e.is_ksv}
        for e in emps
    ]


@router.post("/employees")
def create_employee(req: EmployeeReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(Employee).filter(Employee.emp_code == req.emp_code.strip()).first():
        raise HTTPException(status_code=400, detail=f"Mã cán bộ {req.emp_code} đã tồn tại")
    cfg = db.query(SystemConfig).first()
    base_v1 = req.base_v1 if req.base_v1 > 0 else round(req.hsl_v1 * (cfg.base_salary_agribank if cfg else 4730000.0), 0)
    max_sort = db.query(Employee).count() + 1
    emp = Employee(
        emp_code=req.emp_code.strip(),
        full_name=req.full_name.strip(),
        title=req.title.strip(),
        department=req.department.strip(),
        group_id=req.group_id,
        group_name=req.group_name or GROUP_NAMES.get(req.group_id, f"Nhóm {req.group_id}"),
        labor_type=req.labor_type,
        hsl_v1=req.hsl_v1,
        pccv=req.pccv,
        base_v1=base_v1,
        base_v2=req.base_v2,
        is_ksv=req.is_ksv if req.is_ksv is not None else (req.group_id in (3, 5)),
        is_active=req.is_active,
        password_hash=hash_password("123456"),
        sort_order=max_sort,
    )
    db.add(emp)
    db.commit()
    log_audit(db, "Admin_QuanLy", "THEM_CAN_BO", emp.emp_code, f"Thêm cán bộ {emp.full_name} ({emp.title})")
    return {"message": "Đã thêm cán bộ thành công", "emp_code": emp.emp_code}


@router.put("/employees/{emp_code}")
def update_employee(emp_code: str, req: EmployeeReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy cán bộ")
    emp.full_name = req.full_name.strip()
    emp.title = req.title.strip()
    emp.department = req.department.strip()
    emp.group_id = req.group_id
    emp.group_name = req.group_name or GROUP_NAMES.get(req.group_id, f"Nhóm {req.group_id}")
    emp.labor_type = req.labor_type
    emp.hsl_v1 = req.hsl_v1
    emp.pccv = req.pccv
    emp.base_v1 = req.base_v1
    emp.base_v2 = req.base_v2
    if req.is_ksv is not None:
        emp.is_ksv = req.is_ksv
    emp.is_active = req.is_active
    db.commit()
    log_audit(db, "Admin_QuanLy", "CAP_NHAT_CAN_BO", emp.emp_code, f"Cập nhật thông tin & định mức {emp.full_name}")
    return {"message": "Đã cập nhật cán bộ thành công"}


@router.post("/employees/{emp_code}/reset-password")
def reset_employee_password(emp_code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy cán bộ")
    emp.password_hash = hash_password("123456")
    db.commit()
    log_audit(db, "Admin_QuanLy", "RESET_MAT_KHAU_CB", emp_code, f"Đặt lại mật khẩu mặc định (123456) cho {emp.full_name}")
    return {"message": f"Đã đặt lại mật khẩu cho {emp.full_name} về 123456"}


@router.delete("/employees/{emp_code}")
def delete_employee(emp_code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.emp_code == emp_code).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy cán bộ")
    emp.is_active = False
    db.commit()
    log_audit(db, "Admin_QuanLy", "NGUNG_HOAT_DONG_CB", emp_code, f"Đã chuyển trạng thái ngừng hoạt động cho {emp.full_name}")
    return {"message": "Đã ngừng kích hoạt cán bộ"}


# ---- 2. DANH MỤC CHỈ TIÊU GIAO KHOÁN ----
@router.get("/indicators")
def list_indicators(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    inds = db.query(Indicator).order_by(Indicator.sort_order.asc(), Indicator.id.asc()).all()
    return [
        {
            "id": i.id,
            "code": i.code,
            "category": i.category,
            "kpi_branch": i.kpi_branch,
            "name": i.name,
            "unit": i.unit,
            "weight": i.weight,
            "target_direct": i.target_direct,
            "target_indirect": i.target_indirect,
        }
        for i in inds
    ]


@router.post("/indicators")
def create_indicator(req: IndicatorReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(Indicator).filter(Indicator.code == req.code.strip()).first():
        raise HTTPException(status_code=400, detail=f"Mã chỉ tiêu {req.code} đã tồn tại")
    cfg = db.query(SystemConfig).first()
    ratio = cfg.indirect_target_ratio if cfg else 0.5
    t_ind = req.target_indirect if req.target_indirect is not None else round(req.target_direct * ratio, 4)
    ind = Indicator(
        code=req.code.strip().upper(),
        category=req.category.strip(),
        kpi_branch=req.kpi_branch,
        name=req.name.strip(),
        unit=req.unit.strip(),
        weight=req.weight,
        target_direct=req.target_direct,
        target_indirect=t_ind,
        sort_order=db.query(Indicator).count() + 1,
    )
    db.add(ind)
    db.commit()
    log_audit(db, "Admin_QuanLy", "THEM_CHI_TIEU_GK", ind.code, f"Thêm chỉ tiêu {ind.code}: {ind.name}")
    return {"message": "Đã thêm chỉ tiêu giao khoán"}


@router.put("/indicators/{code}")
def update_indicator(code: str, req: IndicatorReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    ind = db.query(Indicator).filter(Indicator.code == code).first()
    if not ind:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỉ tiêu")
    cfg = db.query(SystemConfig).first()
    ratio = cfg.indirect_target_ratio if cfg else 0.5
    ind.category = req.category.strip()
    ind.kpi_branch = req.kpi_branch
    ind.name = req.name.strip()
    ind.unit = req.unit.strip()
    ind.weight = req.weight
    ind.target_direct = req.target_direct
    ind.target_indirect = req.target_indirect if req.target_indirect is not None else round(req.target_direct * ratio, 4)
    db.commit()
    log_audit(db, "Admin_QuanLy", "CAP_NHAT_CHI_TIEU_GK", ind.code, f"Cập nhật chỉ tiêu {ind.code} (Tỷ trọng={ind.weight}, Direct={ind.target_direct})")
    return {"message": "Đã cập nhật chỉ tiêu"}


@router.delete("/indicators/{code}")
def delete_indicator(code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    ind = db.query(Indicator).filter(Indicator.code == code).first()
    if not ind:
        raise HTTPException(status_code=404, detail="Không tìm thấy chỉ tiêu")
    db.delete(ind)
    db.commit()
    log_audit(db, "Admin_QuanLy", "XOA_CHI_TIEU_GK", code, f"Đã xóa chỉ tiêu {code}")
    return {"message": "Đã xóa chỉ tiêu"}


# ---- 3. DANH MỤC NỘI QUY (P1) ----
@router.get("/internal-rules")
def list_internal_rules(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rules = db.query(InternalRule).order_by(InternalRule.id.asc()).all()
    return [
        {
            "id": r.id,
            "code": r.code,
            "group_name": r.group_name,
            "description": r.description,
            "points": r.points,
            "criteria": r.criteria,
            "note": r.note,
        }
        for r in rules
    ]


@router.post("/internal-rules")
def create_internal_rule(req: InternalRuleReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(InternalRule).filter(InternalRule.code == req.code.strip()).first():
        raise HTTPException(status_code=400, detail=f"Mã nội quy {req.code} đã tồn tại")
    r = InternalRule(
        code=req.code.strip(),
        group_name=req.group_name.strip(),
        description=req.description.strip(),
        points=-abs(float(req.points)),
        criteria=req.criteria.strip(),
        note=req.note.strip(),
    )
    db.add(r)
    db.commit()
    log_audit(db, "Admin_QuanLy", "THEM_NOI_QUY", r.code, f"Thêm quy định {r.code} ({r.points}đ)")
    return {"message": "Đã thêm mã nội quy"}


@router.put("/internal-rules/{code}")
def update_internal_rule(code: str, req: InternalRuleReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    r = db.query(InternalRule).filter(InternalRule.code == code).first()
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy mã nội quy")
    r.group_name = req.group_name.strip()
    r.description = req.description.strip()
    r.points = -abs(float(req.points))
    r.criteria = req.criteria.strip()
    r.note = req.note.strip()
    db.commit()
    return {"message": "Đã cập nhật mã nội quy"}


@router.delete("/internal-rules/{code}")
def delete_internal_rule(code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    r = db.query(InternalRule).filter(InternalRule.code == code).first()
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy mã nội quy")
    db.delete(r)
    db.commit()
    return {"message": "Đã xóa mã nội quy"}


# ---- 4. CÂY KPI NGHIỆP VỤ (P3: 290 mã + 828 mã gợi ý) ----
@router.get("/kpi-error-codes")
def list_kpi_error_codes(
    source_type: str = Query("ALL"),
    level_name: str = Query("ALL"),
    group_id: Optional[int] = None,
    q: str = Query(""),
    limit: int = Query(300, le=1500),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(KpiErrorCode)
    if source_type != "ALL":
        query = query.filter(KpiErrorCode.source_type == source_type)
    if level_name != "ALL":
        query = query.filter(KpiErrorCode.level_name == level_name)
    rows = query.order_by(KpiErrorCode.id.asc()).all()

    ql = q.strip().lower()
    filtered = []
    for r in rows:
        if group_id is not None and r.applicable_groups:
            allowed = [x.strip() for x in r.applicable_groups.split(",")]
            if str(group_id) not in allowed:
                continue
        if ql and ql not in r.code.lower() and ql not in r.description.lower() and ql not in r.scope.lower():
            continue
        filtered.append({
            "id": r.id,
            "code": r.code,
            "source_type": r.source_type,
            "stt_origin": r.stt_origin,
            "level_name": r.level_name,
            "points": r.points,
            "description": r.description,
            "scope": r.scope,
            "applicable_groups": r.applicable_groups,
        })
        if len(filtered) >= limit:
            break
    return {"total_matched": len(filtered), "items": filtered}


@router.post("/kpi-error-codes")
def create_kpi_error_code(req: KpiErrorCodeReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(KpiErrorCode).filter(KpiErrorCode.code == req.code.strip()).first():
        raise HTTPException(status_code=400, detail=f"Mã lỗi {req.code} đã tồn tại")
    item = KpiErrorCode(
        code=req.code.strip(),
        source_type=req.source_type,
        level_name=req.level_name,
        points=-abs(float(req.points)),
        description=req.description.strip(),
        scope=req.scope.strip(),
        applicable_groups=req.applicable_groups.strip(),
    )
    db.add(item)
    db.commit()
    log_audit(db, "Admin_QuanLy", "THEM_MA_KPI_P3", item.code, f"Thêm mã lỗi {item.code} ({item.points}đ)")
    return {"message": "Đã thêm mã lỗi nghiệp vụ"}


@router.put("/kpi-error-codes/{code}")
def update_kpi_error_code(code: str, req: KpiErrorCodeReq, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(KpiErrorCode).filter(KpiErrorCode.code == code).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mã lỗi")
    item.source_type = req.source_type
    item.level_name = req.level_name
    item.points = -abs(float(req.points))
    item.description = req.description.strip()
    item.scope = req.scope.strip()
    item.applicable_groups = req.applicable_groups.strip()
    db.commit()
    return {"message": "Đã cập nhật mã lỗi"}


@router.delete("/kpi-error-codes/{code}")
def delete_kpi_error_code(code: str, user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(KpiErrorCode).filter(KpiErrorCode.code == code).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mã lỗi")
    db.delete(item)
    db.commit()
    return {"message": "Đã xóa mã lỗi"}

