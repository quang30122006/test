from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, UniqueConstraint
)
from .database import Base


class SystemConfig(Base):
    """Bảng tham số, trọng số, công thức & cấu hình bảo mật hệ thống (nâng cấp từ Admin_ThamSo)."""
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, default=1)
    org_name = Column(String, default="NGÂN HÀNG NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN VIỆT NAM - CHI NHÁNH QUẢNG BÌNH")
    unit_name = Column(String, default="PHÒNG KTNQ - HỘI ĐỒNG LƯƠNG")
    current_period_code = Column(String, default="2026-10")  # Mã kỳ hiện hành, vd 2026-10
    current_period_name = Column(String, default="Tháng 10/2026")

    # Trọng số 3 trụ cột công việc (Admin_ThamSo!B5:B7)
    w_cm = Column(Float, default=0.75)         # Nhiệm vụ Chuyên môn (75%)
    w_kpi = Column(Float, default=0.25)        # Chỉ tiêu KPI Kinh doanh (25%)
    w_reserve = Column(Float, default=0.0)     # Dự phòng điều hành (0%)

    # Trọng số con trong KPI Kinh doanh (Admin_ThamSo!B8:B10)
    w_kpi_dv = Column(Float, default=0.50)     # Sản phẩm Dịch vụ (VB 469)
    w_kpi_hdv = Column(Float, default=0.50)    # Huy động vốn (VB 111)
    w_kpi_dn = Column(Float, default=0.0)      # Dư nợ tín dụng

    # Tỷ lệ giao khoán & Thang điểm Chuyên môn (Admin_ThamSo!B11:B15, I14:I15)
    indirect_target_ratio = Column(Float, default=0.50)  # Khối Gián tiếp = 50% Khối Trực tiếp
    cm_base_score = Column(Float, default=100.0)         # Điểm gốc Chuyên môn
    cm_max_score = Column(Float, default=100.0)          # Trần điểm P3
    cm_min_score = Column(Float, default=70.0)           # Sàn điểm P3 (Admin_ThamSo!B14)
    cm_floor_enabled = Column(Boolean, default=False)    # Bật/tắt chặn sàn CM ở cm_min_score (Excel mặc định tắt -> MAX(0,...))
    max_total_deduction = Column(Float, default=0.0)     # 0 = KGH (Không giới hạn), >0 = chặn trần trừ trực tiếp+liên đới (vd 30)

    ksv_deduction_ratio = Column(Float, default=0.50)    # Trừ liên đới KSV = 50% lỗi CB
    ksv_monthly_cap = Column(Float, default=10.0)        # Trần trừ KSV/tháng = 10đ
    approver_deduction_ratio = Column(Float, default=0.25)  # Trừ liên đới Người phê duyệt = 25%
    approver_monthly_cap = Column(Float, default=5.0)    # Trần trừ Người PD/tháng = 5đ

    # Ngày công & Tiền lương 3P (Admin_ThamSo!B16:B23, B30)
    standard_workdays = Column(Float, default=22.0)      # Kchuẩn mặc định (hoặc lấy theo kỳ)
    use_period_standard_days = Column(Boolean, default=True)  # Lấy Kchuẩn từ TrangThai_Ky theo kỳ
    v2_monthly_fund = Column(Float, default=101160000.0) # Quỹ tiền lương V2 tháng
    v2_fund_mode = Column(String, default="MANUAL")      # MANUAL | AUTO_SUM_BASE_V2
    base_salary_agribank = Column(Float, default=4730000.0)  # Mức lương cơ sở Agribank
    kv2_general = Column(Float, default=1.0)             # Hệ số điều chỉnh V2 chung (Kv2)
    tcv_max_cap = Column(Float, default=1.0)             # Trần Tcv tối đa (Điều 8)
    tcv_min_floor = Column(Float, default=0.0)           # Sàn Tcv tối thiểu

    # Quỹ Năng suất QNS & Quỹ V3 (Admin_ThamSo!B20, B30)
    qns_mode = Column(String, default="AUTO_SUM_BEFORE_ADJ")  # AUTO_SUM_BEFORE_ADJ | MONTHS_MULTIPLIER | MANUAL
    qns_months = Column(Float, default=1.0)              # Số tháng NS nếu qns_mode = MONTHS_MULTIPLIER
    qns_manual_amount = Column(Float, default=1031000000.0)
    v3_fund_amount = Column(Float, default=222011500.0)  # Quỹ V3 (nếu tách riêng hoặc đồng bộ QNS)
    sync_v3_with_qns = Column(Boolean, default=True)     # True: Quỹ V3 = QNS như Excel B20

    # Tùy chọn công thức nâng cao (cho phép Admin tinh chỉnh toàn bộ công thức!)
    dv_agg_mode = Column(String, default="SIMPLE_AVG")   # SIMPLE_AVG (như Excel) | WEIGHTED_INDICATORS (theo trọng số CT01..CT06)
    kpi_cap_mode = Column(String, default="GROUP_CAP")   # GROUP_CAP (MIN(nhóm,1) như Excel) | INDICATOR_CAP (MIN(từng CT,1)) | UNCAPPED
    missing_kpi_policy = Column(String, default="ZERO")  # ZERO (0% - fix lỗi dòng 20..160 Excel) | FULL_100 (100% miễn trừ)
    tcv_mode = Column(String, default="LINEAR")          # LINEAR (Điểm CV/100 + Ưu tiên) | TIER_MATRIX (theo ki Ma trận)
    workday_ratio_cap = Column(Boolean, default=False)   # True = chặn tỷ lệ NC <= 1.0, False = theo thực tế Ki/Kchuẩn
    nsi_basis = Column(String, default="TOTAL_AFTER_ADJ") # TOTAL_AFTER_ADJ (M = V1_tl + V2_sdc) | V2_AFTER_ADJ | KPI_SCORE
    monthly_takehome_mode = Column(String, default="V1_V2_ONLY")  # V1_V2_ONLY (P=M như Excel) | INCLUDE_NSI (P=NSi) | V1_V2_PLUS_DIFF
    v3_allocation_method = Column(String, default="V1_PLUS_V2QT") # V1_PLUS_V2QT (Excel chuẩn) | H3_TIME_WEIGHTED (h3 * NC_năm/Kchuẩn * (V1+V2)) | V2QT_ONLY
    rounding_residual_to_last = Column(Boolean, default=True)     # Bù chênh lệch làm tròn vào người cuối (fix lỗi thiếu/thừa 2đ và fix hardcode dòng 13)

    # Bảo mật Admin
    admin_password_hash = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RatingTier(Base):
    """Ma trận thang điểm xếp loại KPI & khung hệ số lương (Admin_ThamSo!F24:L29)."""
    __tablename__ = "rating_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, nullable=False)  # A+, A, B, C, D
    sort_order = Column(Integer, nullable=False)
    min_score = Column(Float, nullable=False)           # Điểm sàn
    max_score = Column(Float, nullable=False)           # Điểm trần (tham khảo)
    ki_month = Column(Float, nullable=False)            # Hệ số V2 Tháng (ki)
    kq_settlement = Column(Float, nullable=False)       # Hệ số V2 Quý/Năm (kq)
    h3_v3 = Column(Float, nullable=False)               # Hệ số Thù lao V3 (h3)
    description = Column(String, nullable=False)


class Period(Base):
    """12 kỳ tính lương (TrangThai_Ky)."""
    __tablename__ = "periods"

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_code = Column(String, unique=True, nullable=False)  # 2026-01 .. 2026-12
    month_num = Column(Integer, nullable=False)                # 1..12
    year_num = Column(Integer, default=2026, nullable=False)
    period_name = Column(String, nullable=False)               # Tháng 01/2026 ..
    status = Column(String, nullable=False, default="CHƯA MỞ") # ĐÃ KHÓA | ĐANG MỞ | CHƯA MỞ
    closed_date = Column(String, default="")
    note = Column(String, default="")
    standard_days = Column(Float, default=22.0)


class Employee(Base):
    """Danh mục cán bộ & định mức lương theo vị trí (1.DM_CanBo)."""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emp_code = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    title = Column(String, default="")
    department = Column(String, default="")
    group_id = Column(Integer, default=1)       # 1..6
    group_name = Column(String, default="")
    labor_type = Column(String, default="Trực tiếp")  # Trực tiếp | Gián tiếp
    hsl_v1 = Column(Float, default=1.0)
    pccv = Column(Float, default=0.0)
    base_v1 = Column(Float, default=0.0)
    base_v2 = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    is_ksv = Column(Boolean, default=False)
    password_hash = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)


class Indicator(Base):
    """Danh mục chỉ tiêu giao khoán kinh doanh (2.DM_ChiTieu_GK)."""
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, nullable=False)  # CT01..CT08
    category = Column(String, nullable=False)           # 3.3.1 Dịch vụ | 3.3.2 Huy động vốn | 3.3.3 Dư nợ
    kpi_branch = Column(String, default="DV")           # DV | HDV | DN
    name = Column(String, nullable=False)
    unit = Column(String, default="")
    weight = Column(Float, default=0.0)                 # Tỷ trọng (Admin_ThamSo!I5:I12)
    target_direct = Column(Float, default=0.0)          # Mức giao Trực tiếp (Năm)
    target_indirect = Column(Float, default=0.0)        # Mức giao Gián tiếp (Năm)
    sort_order = Column(Integer, default=0)


class InternalRule(Base):
    """Danh mục nội quy, kỷ luật lao động & văn hóa Agribank (DM_NOI_QUY - Trụ cột P1)."""
    __tablename__ = "internal_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, nullable=False)  # I.01 .. NQ05
    group_name = Column(String, default="")
    description = Column(Text, nullable=False)
    points = Column(Float, nullable=False)              # âm, vd -1, -5, -10
    criteria = Column(String, default="3.1 Nội quy")
    note = Column(String, default="")


class KpiErrorCode(Base):
    """Bộ mã KPI nghiệp vụ (CAY_KPI_NGHIEP_VU: 290 mã Phụ lục 3 + 828 mã gợi ý mở rộng)."""
    __tablename__ = "kpi_error_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, nullable=False, index=True)  # L1.01.., HS01.., GD0101..
    source_type = Column(String, default="PHU_LUC_3")  # PHU_LUC_3 | GOI_Y_MO_RONG
    stt_origin = Column(String, default="")
    level_name = Column(String, default="")            # Mức I..V hoặc nhóm tên
    points = Column(Float, nullable=False)             # âm, vd -1..-10
    description = Column(Text, nullable=False)
    scope = Column(String, default="")
    applicable_groups = Column(String, default="1,2,3,4,5,6")


class SalaryImportRow(Base):
    """Dữ liệu lương & ngày công thực tế theo kỳ (IMPORT_LUONG + BANG_CHAM_CONG)."""
    __tablename__ = "salary_import_rows"
    __table_args__ = (UniqueConstraint("period_code", "emp_code", name="uq_salary_period_emp"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_code = Column(String, nullable=False, index=True)
    emp_code = Column(String, nullable=False, index=True)
    full_name = Column(String, default="")
    title = Column(String, default="")
    department = Column(String, default="")
    group_name = Column(String, default="")
    labor_type = Column(String, default="Trực tiếp")
    hsl_v1 = Column(Float, default=1.0)
    base_v1 = Column(Float, default=0.0)
    base_v2 = Column(Float, default=0.0)
    actual_workdays = Column(Float, default=22.0)
    status = Column(String, default="Hợp lệ")
    note = Column(String, default="")


class TargetExecutionRow(Base):
    """Dữ liệu thực hiện chỉ tiêu kinh doanh theo kỳ (IMPORT_CHI_TIEU + Nhap_ThucHien)."""
    __tablename__ = "target_execution_rows"
    __table_args__ = (UniqueConstraint("period_code", "emp_code", "indicator_code", name="uq_target_period_emp_ind"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_code = Column(String, nullable=False, index=True)
    emp_code = Column(String, nullable=False, index=True)
    indicator_code = Column(String, nullable=False, index=True)
    actual_value = Column(Float, default=0.0)   # Ai
    target_value = Column(Float, default=0.0)   # Ti
    status = Column(String, default="Hợp lệ")


class ViolationRecord(Base):
    """Nhật ký ghi nhận vi phạm & Hàng chờ KSV thẩm duyệt (NHAT_KY_LOI + HANG_CHO_KSV)."""
    __tablename__ = "violation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_code = Column(String, unique=True, nullable=False)  # BB001..
    created_date = Column(String, nullable=False)              # dd/mm/yyyy
    period_code = Column(String, nullable=False, index=True)   # 2026-10
    period_name = Column(String, nullable=False)               # Tháng 10/2026
    emp_code = Column(String, nullable=False, index=True)
    emp_name = Column(String, default="")
    pillar_type = Column(String, nullable=False)               # 3.1 (P1) | 3.3 (P3)
    error_code = Column(String, nullable=False)
    error_detail = Column(Text, default="")
    emp_deduction = Column(Float, default=0.0)                 # dương = số điểm trừ (D)

    has_ksv_resp = Column(Boolean, default=False)
    ksv_emp_code = Column(String, default="")
    ksv_emp_name = Column(String, default="")
    ksv_proposed_points = Column(Float, default=0.0)
    ksv_status = Column(String, default="NONE")                # NONE | PENDING | APPROVED | REJECTED
    ksv_applied_points = Column(Float, default=0.0)
    ksv_note = Column(Text, default="")
    ksv_reviewed_at = Column(String, default="")

    has_approver_resp = Column(Boolean, default=False)
    approver_emp_code = Column(String, default="")
    approver_emp_name = Column(String, default="")
    approver_points = Column(Float, default=0.0)
    approver_status = Column(String, default="NONE")           # NONE | RECORDED


class KpiMonthlyOverride(Base):
    """Điểm cộng ưu tiên trên KPI_Thang!L theo từng cán bộ và kỳ."""
    __tablename__ = "kpi_monthly_overrides"
    __table_args__ = (UniqueConstraint("period_code", "emp_code", name="uq_kpi_ovr_period_emp"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_code = Column(String, nullable=False, index=True)
    emp_code = Column(String, nullable=False, index=True)
    priority_points = Column(Float, default=0.0)  # Điểm cộng ưu tiên vào Tcv (vd 0.05)
    note = Column(String, default="")


class MonthlyHistorySnapshot(Base):
    """Kho tích lũy 12 tháng V2 & V1 thực chi (TichLuy_V3)."""
    __tablename__ = "monthly_history_snapshots"
    __table_args__ = (UniqueConstraint("year_num", "month_num", "emp_code", name="uq_snap_ym_emp"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    year_num = Column(Integer, default=2026, nullable=False)
    month_num = Column(Integer, nullable=False)  # 1..12
    emp_code = Column(String, nullable=False, index=True)
    kpi_score = Column(Float, nullable=True)     # Điểm CV tháng (0..120)
    workdays = Column(Float, nullable=True)      # Ngày công thực tế
    v2_paid = Column(Float, nullable=True)       # V2 vòng 1 tạm lĩnh
    v1_paid = Column(Float, nullable=True)       # V1 thực lĩnh (fix lỗi Excel lưu nhầm cột NC!)
    is_frozen = Column(Boolean, default=False)   # True khi kỳ đã ĐÃ KHÓA


class AuditLog(Base):
    """Nhật ký kiểm toán thao tác hệ thống (AUDIT_LOG)."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    log_code = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target_data = Column(String, default="")
    details = Column(Text, default="")

