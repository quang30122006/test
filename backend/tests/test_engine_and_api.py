import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.seed_from_excel import seed_database_if_empty
from app.engine import compute_period_kpi_and_payroll, compute_accumulation_v3
from app.excel_io import build_template_salary_excel, build_template_targets_excel
from app.models import (
    Employee, Indicator, KpiErrorCode, Period, SystemConfig,
    SalaryImportRow, TargetExecutionRow, MonthlyHistorySnapshot, ViolationRecord
)


class TestAgribankKpi3P(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.TemporaryDirectory()
        db_file = Path(cls.tmp_dir.name) / "test.db"
        cls.engine = create_engine(f"sqlite:///{db_file.as_posix()}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=cls.engine)
        cls.SessionTest = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)

        db = cls.SessionTest()
        try:
            seed_database_if_empty(db)
        finally:
            db.close()

        def override_get_db():
            s = cls.SessionTest()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.engine.dispose()
        cls.tmp_dir.cleanup()

    def _login_admin(self) -> str:
        r = self.client.post("/api/auth/login-admin", json={"password": "123456"})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["access_token"]

    def _login_staff(self, emp_code: str = "3800207001465") -> str:
        r = self.client.post("/api/auth/login-staff", json={"emp_code": emp_code, "password": "123456"})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["access_token"]

    def test_01_seed_and_exact_excel_parity(self):
        db = self.SessionTest()
        try:
            calc = compute_period_kpi_and_payroll(db, "2026-10")
            t = calc["totals"]
            self.assertEqual(t["staff_count"], 13)
            self.assertEqual(t["base_v1"], 120851500)
            self.assertEqual(t["base_v2"], 101160000)
            self.assertEqual(t["total_before"], 222011500)
            self.assertEqual(t["v1_actual"], 115111000)
            self.assertEqual(t["v2_adj"], 96714182)
            self.assertEqual(t["total_after"], 211825182)
            self.assertEqual(t["v2_surplus"], 4445818)

            # Spot-check Lê Thị Hồng Phương (18/22 workdays)
            phuong = next(r for r in calc["payroll_rows"] if r["emp_code"] == "3800207001465")
            self.assertEqual(phuong["v1_actual"], 8049600)
            self.assertEqual(phuong["v2_adj"], 10538182)
            self.assertEqual(phuong["takehome"], 18587782)

            # Verify TichLuy_V3 exact match on T1..T9 frozen snapshots
            v3 = compute_accumulation_v3(db, 2026, include_open_period=False)
            vt = v3["totals"]
            self.assertEqual(vt["v2_qt"], 958839104)
            self.assertEqual(vt["v2_received"], 899227853)
            self.assertEqual(vt["v2_bonus_final"], 59611251)
            self.assertEqual(vt["v3_basis"], 2038659404)
            self.assertEqual(vt["v3_amount"], 222011500)
            giang_v3 = next(r for r in v3["rows"] if r["emp_code"] == "3800207001232")
            self.assertEqual(giang_v3["year"]["v3_amount"], 26154733)
        finally:
            db.close()

    def test_02_role_separation_and_staff_portal(self):
        staff_token = self._login_staff("3800207001465")
        headers = {"Authorization": f"Bearer {staff_token}"}

        # Staff MUST be blocked from Admin endpoints
        for url in [
            "/api/payroll/bang-luong-3p",
            "/api/payroll/tich-luy-v3",
            "/api/catalogs/employees",
            "/api/operations/salary-import",
        ]:
            resp = self.client.get(url, headers=headers)
            self.assertEqual(resp.status_code, 403, f"Expected 403 for {url}, got {resp.status_code}")

        # Staff CAN view own payslip, accumulation, and reference catalogs
        r_pay = self.client.get("/api/staff/my-payslip", headers=headers)
        self.assertEqual(r_pay.status_code, 200)
        self.assertEqual(r_pay.json()["employee"]["emp_code"], "3800207001465")
        self.assertEqual(r_pay.json()["payroll"]["takehome"], 18587782)

        r_cat = self.client.get("/api/catalogs/kpi-error-codes?limit=1500", headers=headers)
        self.assertEqual(r_cat.status_code, 200)
        self.assertGreaterEqual(r_cat.json()["total_matched"], 1100)  # 290 Phụ lục 3 + 828 mở rộng

    def test_03_violation_ksv_workflow_and_simulation(self):
        admin_token = self._login_admin()
        adm_hdr = {"Authorization": f"Bearer {admin_token}"}

        # Create a violation with KSV joint liability
        r_create = self.client.post("/api/operations/violations", headers=adm_hdr, json={
            "period_code": "2026-10",
            "emp_code": "3800207001465",
            "pillar_type": "3.3",
            "error_code": "L3.01",
            "error_detail": "Test vi phạm nghiệp vụ",
            "emp_deduction": 10,
            "has_ksv_resp": True,
            "ksv_emp_code": "3800207001232",
            "has_approver_resp": True,
            "approver_emp_code": "3800207001340",
        })
        self.assertEqual(r_create.status_code, 200, r_create.text)
        bb_code = r_create.json()["record_code"]

        # While PENDING, KSV deduction is 0, CB deduction is 10
        kpi1 = self.client.get("/api/payroll/kpi-month", headers=adm_hdr).json()["rows"]
        phuong1 = next(x for x in kpi1 if x["emp_code"] == "3800207001465")
        giang1 = next(x for x in kpi1 if x["emp_code"] == "3800207001232")
        self.assertEqual(phuong1["cm_score"], 90.0)
        self.assertEqual(giang1["joint_deduction"], 0.0)

        # KSV (Giang) logs in to Staff Portal & approves her assigned review
        ksv_token = self._login_staff("3800207001232")
        r_rev = self.client.post(f"/api/staff/ksv-review/{bb_code}", headers={"Authorization": f"Bearer {ksv_token}"}, json={
            "decision": "APPROVED",
            "ksv_note": "Xác nhận trách nhiệm liên đới KSV",
        })
        self.assertEqual(r_rev.status_code, 200, r_rev.text)

        kpi2 = self.client.get("/api/payroll/kpi-month", headers=adm_hdr).json()["rows"]
        giang2 = next(x for x in kpi2 if x["emp_code"] == "3800207001232")
        ly2 = next(x for x in kpi2 if x["emp_code"] == "3800207001340")
        self.assertEqual(giang2["joint_deduction"], 5.0)  # 50% of 10
        self.assertEqual(ly2["joint_deduction"], 2.5)     # 25% of 10

        # Simulation endpoint does not mutate DB
        r_sim = self.client.post("/api/admin/config/simulate", headers=adm_hdr, json={
            "period_code": "2026-10",
            "config": {"w_cm": 0.6, "w_kpi": 0.4, "tcv_max_cap": 1.15, "v3_allocation_method": "H3_TIME_WEIGHTED"},
        })
        self.assertEqual(r_sim.status_code, 200, r_sim.text)
        sim_data = r_sim.json()
        self.assertNotEqual(sim_data["baseline_totals"]["v2_adj"], sim_data["simulated_totals"]["v2_adj"])

        # Clean up test violation
        r_del = self.client.delete(f"/api/operations/violations/{bb_code}", headers=adm_hdr)
        self.assertEqual(r_del.status_code, 200)

    def test_04_excel_export_and_template_upload(self):
        admin_token = self._login_admin()
        adm_hdr = {"Authorization": f"Bearer {admin_token}"}

        r_exp = self.client.get("/api/payroll/export-excel", headers=adm_hdr)
        self.assertEqual(r_exp.status_code, 200)
        self.assertGreater(len(r_exp.content), 4000)

        r_tpl1 = self.client.get("/api/payroll/template/salary", headers=adm_hdr)
        self.assertEqual(r_tpl1.status_code, 200)
        r_tpl2 = self.client.get("/api/payroll/template/targets", headers=adm_hdr)
        self.assertEqual(r_tpl2.status_code, 200)

    def test_05_twelve_month_dataset_import_and_validation(self):
        from pathlib import Path
        import io
        import openpyxl

        admin_token = self.client.post("/api/auth/login-admin", json={"password": "123456"}).json()["access_token"]
        adm_hdr = {"Authorization": f"Bearer {admin_token}"}

        root_dir = Path(r"c:\code\app chính của mẹ")
        sal_bytes = (root_dir / "FILE_MAU_CHUAN_IMPORT_LUONG_12_THANG.xlsx").read_bytes()
        tgt_bytes = (root_dir / "FILE_MAU_CHUAN_IMPORT_CHI_TIEU_12_THANG.xlsx").read_bytes()

        # 1. Preview 12 tháng Bảng lương
        p_sal = self.client.post(
            "/api/operations/dataset/preview-salary?scope=ALL_MONTHS",
            files={"file": ("FILE_MAU_CHUAN_IMPORT_LUONG_12_THANG.xlsx", sal_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=adm_hdr,
        )
        self.assertEqual(p_sal.status_code, 200)
        js_s = p_sal.json()
        self.assertEqual(js_s["detected_format"], "WORKBOOK_12_THANG")
        self.assertEqual(js_s["total_rows"], 156)
        self.assertEqual(len(js_s["months_summary"]), 12)
        self.assertEqual(len(js_s["issues"]), 0)

        # 2. Preview 12 tháng Chỉ tiêu
        p_tgt = self.client.post(
            "/api/operations/dataset/preview-targets?scope=ALL_MONTHS",
            files={"file": ("FILE_MAU_CHUAN_IMPORT_CHI_TIEU_12_THANG.xlsx", tgt_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=adm_hdr,
        )
        self.assertEqual(p_tgt.status_code, 200)
        js_t = p_tgt.json()
        self.assertEqual(js_t["detected_format"], "WORKBOOK_12_THANG")
        self.assertEqual(js_t["total_rows"], 1248)
        self.assertEqual(len(js_t["months_summary"]), 12)
        self.assertEqual(len(js_t["issues"]), 0)

        # 3. Commit an toàn (overwrite_locked=false): chỉ nạp T10..T12, bảo vệ T1..T9 đã khóa
        c_sal = self.client.post(
            "/api/operations/dataset/commit-salary?scope=ALL_MONTHS&overwrite_locked=false&sync_history=false",
            files={"file": ("sal.xlsx", sal_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=adm_hdr,
        )
        self.assertEqual(c_sal.status_code, 200)
        self.assertEqual(len(c_sal.json()["applied_periods"]), 3)
        self.assertEqual(len(c_sal.json()["skipped_locked"]), 9)

        # 4. Commit bổ sung cả 12 tháng chi tiết (sync_history=false giữ nguyên snapshot TichLuy_V3 đã chốt!)
        c_tgt = self.client.post(
            "/api/operations/dataset/commit-targets?scope=ALL_MONTHS&overwrite_locked=true&sync_history=false",
            files={"file": ("tgt.xlsx", tgt_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=adm_hdr,
        )
        self.assertEqual(c_tgt.status_code, 200)
        self.assertEqual(c_tgt.json()["count"], 1248)

        # Kiểm tra snapshot V3 vẫn giữ nguyên 899,227,853
        v3_check = self.client.get("/api/payroll/tich-luy-v3?include_open=false", headers=adm_hdr).json()
        self.assertEqual(round(v3_check["totals"]["v2_received"]), 899227853)

        # 5. Kiểm tra ma trận hiện trạng & xuất 12 tháng
        st = self.client.get("/api/operations/dataset/status", headers=adm_hdr).json()
        self.assertEqual(len(st["months"]), 12)
        self.assertEqual(st["months"][9]["salary_count"], 13)
        self.assertEqual(st["months"][9]["target_count"], 104)

        exp12 = self.client.get("/api/operations/dataset/export-12-months?kind=salary", headers=adm_hdr)
        self.assertEqual(exp12.status_code, 200)
        wb_out = openpyxl.load_workbook(io.BytesIO(exp12.content))
        self.assertEqual(len(wb_out.sheetnames), 13)

        # 6. Regression guard: cán bộ họ tên chứa chữ "Công" không bị lọc nhầm như dòng "Tổng cộng"
        wb_cong = openpyxl.Workbook()
        ws_cong = wb_cong.active
        ws_cong.title = "LUONG"
        headers = ["STT", "Mã CB", "Họ và tên", "Chức danh", "Phòng ban", "Lương V1", "Mức V2", "Ngày công", "Tháng"]
        for i, h in enumerate(headers, 1):
            ws_cong.cell(1, i, h)
        row_c = [1, "CB_CONG_99", "Nguyễn Thành Công", "Giao dịch viên", "Phòng KTNQ", 9000000, 6000000, 22, 11]
        for i, v in enumerate(row_c, 1):
            ws_cong.cell(2, i, v)
        buf_c = io.BytesIO()
        wb_cong.save(buf_c)
        prev_c = self.client.post(
            "/api/operations/dataset/preview-salary?scope=SINGLE&period_code=2026-11",
            files={"file": ("cong.xlsx", buf_c.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=adm_hdr,
        )
        self.assertEqual(prev_c.status_code, 200)
        self.assertEqual(prev_c.json()["total_rows"], 1)
        self.assertEqual(prev_c.json()["sample_by_month"]["11"][0]["full_name"], "Nguyễn Thành Công")

        # 7. Kiểm tra CSDL Web Overview + Table Explorer (không lộ password hash) & Hồ sơ cán bộ đầy đủ
        db_ov = self.client.get("/api/admin/database-overview", headers=adm_hdr)
        self.assertEqual(db_ov.status_code, 200)
        self.assertEqual(db_ov.json()["table_count"], 13)
        db_tbl = self.client.get("/api/admin/database-table/employees?q=Giang", headers=adm_hdr)
        self.assertEqual(db_tbl.status_code, 200)
        self.assertGreaterEqual(db_tbl.json()["total_matched"], 1)
        self.assertNotIn("password_hash", db_tbl.json()["columns"])

        prof = self.client.get("/api/payroll/payslip/3800207001232", headers=adm_hdr).json()
        self.assertIn("accumulation", prof)
        self.assertIn("violations_all", prof)
        self.assertGreater(prof["employee"]["base_v1"], 0)

        # 8. Mở khóa lại kỳ ĐÃ KHÓA (2026-09) để chỉnh sửa rồi Khóa lại, đảm bảo không mất Snapshot V3 gốc
        r_att_locked = self.client.put(
            "/api/operations/attendance?period_code=2026-09",
            json=[{"emp_code": "3800207001232", "actual_workdays": 21}],
            headers=adm_hdr,
        )
        self.assertEqual(r_att_locked.status_code, 400)

        r_reopen = self.client.post("/api/admin/periods/2026-09/reopen?switch_to_current=false", headers=adm_hdr)
        self.assertEqual(r_reopen.status_code, 200)
        self.assertEqual(r_reopen.json()["status"], "ĐANG MỞ")

        r_lock_back = self.client.post("/api/admin/periods/2026-09/lock?sync_snapshot=false", headers=adm_hdr)
        self.assertEqual(r_lock_back.status_code, 200)
        self.assertEqual(r_lock_back.json()["status"], "ĐÃ KHÓA")

        r_att_relocked = self.client.put(
            "/api/operations/attendance?period_code=2026-09",
            json=[{"emp_code": "3800207001232", "actual_workdays": 21}],
            headers=adm_hdr,
        )
        self.assertEqual(r_att_relocked.status_code, 400)

        # 9. Kiểm tra API Thống kê & Xóa dữ liệu theo tháng (chặn kỳ ĐÃ KHÓA, xóa chọn lọc phạm vi trên kỳ mở)
        r_sum = self.client.get("/api/admin/periods/data-summary", headers=adm_hdr)
        self.assertEqual(r_sum.status_code, 200)
        by_code = {item["period_code"]: item for item in r_sum.json()["periods"]}
        self.assertIn("2026-11", by_code)
        self.assertGreater(by_code["2026-11"]["salary_count"], 0)
        self.assertGreater(by_code["2026-11"]["target_count"], 0)

        # Chặn xóa kỳ ĐÃ KHÓA (2026-09)
        r_clr_locked = self.client.post(
            "/api/admin/periods/clear-by-months",
            json={"period_codes": ["2026-09"], "scopes": ["salary", "targets"]},
            headers=adm_hdr,
        )
        self.assertEqual(r_clr_locked.status_code, 400)

        # Xóa chọn lọc chỉ tiêu (targets) của 2026-11 -> salary vẫn giữ nguyên
        r_clr_tgt = self.client.post(
            "/api/admin/periods/clear-by-months",
            json={"period_codes": ["2026-11"], "scopes": ["targets"]},
            headers=adm_hdr,
        )
        self.assertEqual(r_clr_tgt.status_code, 200)
        self.assertGreater(r_clr_tgt.json()["details"]["2026-11"]["targets"], 0)

        by_code_after = {
            item["period_code"]: item
            for item in self.client.get("/api/admin/periods/data-summary", headers=adm_hdr).json()["periods"]
        }
        self.assertEqual(by_code_after["2026-11"]["target_count"], 0)
        self.assertGreater(by_code_after["2026-11"]["salary_count"], 0)

        # Xóa nốt salary của 2026-11
        r_clr_sal = self.client.post(
            "/api/admin/periods/clear-by-months",
            json={"period_codes": ["2026-11"], "scopes": ["salary"]},
            headers=adm_hdr,
        )
        self.assertEqual(r_clr_sal.status_code, 200)
        self.assertGreater(r_clr_sal.json()["total_deleted"], 0)

    def test_06_put_period_status_syncs_and_protects_snapshots(self):
        adm_hdr = {"Authorization": f"Bearer {self._login_admin()}"}

        # 1. Chặn status hoặc ngày công chuẩn không hợp lệ
        r_bad_status = self.client.put(
            "/api/admin/periods/2026-12",
            json={"status": "TRANG_THAI_SAI"},
            headers=adm_hdr,
        )
        self.assertEqual(r_bad_status.status_code, 400)

        r_bad_days = self.client.put(
            "/api/admin/periods/2026-12",
            json={"standard_days": 0},
            headers=adm_hdr,
        )
        self.assertEqual(r_bad_days.status_code, 400)

        # 2. Khóa 2026-12 qua PUT /periods/{code} -> bắt buộc đồng bộ & đóng băng Snapshot V3
        r_lock_put = self.client.put(
            "/api/admin/periods/2026-12",
            json={"status": "ĐÃ KHÓA", "standard_days": 22},
            headers=adm_hdr,
        )
        self.assertEqual(r_lock_put.status_code, 200)
        self.assertEqual(r_lock_put.json()["status"], "ĐÃ KHÓA")
        self.assertTrue(r_lock_put.json()["snapshot_synced"])

        v3_locked = self.client.get("/api/payroll/tich-luy-v3?include_open=false", headers=adm_hdr).json()
        m12_locked = v3_locked["rows"][0]["months"]["12"]
        self.assertTrue(m12_locked["is_frozen"])
        self.assertIsNotNone(m12_locked["v2_paid"])
        self.assertGreater(m12_locked["workdays"], 0)

        # 3. Không cho đổi standard_days khi kỳ đang ĐÃ KHÓA mà không mở khóa sửa
        r_days_locked = self.client.put(
            "/api/admin/periods/2026-12",
            json={"standard_days": 24},
            headers=adm_hdr,
        )
        self.assertEqual(r_days_locked.status_code, 400)

        # 4. Mở khóa qua PUT /periods/{code} -> gỡ đóng băng Snapshot V3 đồng bộ với /reopen
        r_unlock_put = self.client.put(
            "/api/admin/periods/2026-12",
            json={"status": "ĐANG MỞ"},
            headers=adm_hdr,
        )
        self.assertEqual(r_unlock_put.status_code, 200)
        self.assertEqual(r_unlock_put.json()["status"], "ĐANG MỞ")
        v3_unlocked = self.client.get("/api/payroll/tich-luy-v3?include_open=false", headers=adm_hdr).json()
        self.assertFalse(v3_unlocked["rows"][0]["months"]["12"]["is_frozen"])

    def test_07_vercel_deployment_readiness(self):
        import json
        import subprocess
        from unittest.mock import patch
        from app.config import _normalize_database_url

        repo_root = BACKEND_ROOT.parent
        # 1. File cấu hình Vercel JSON hợp lệ & entry api/index.py import được
        vercel_cfg = json.loads((repo_root / "vercel.json").read_text(encoding="utf-8"))
        self.assertEqual(vercel_cfg["regions"], ["sin1"])
        self.assertEqual(vercel_cfg["outputDirectory"], "frontend/dist")
        self.assertTrue((repo_root / "requirements.txt").exists())
        self.assertTrue((repo_root / "api" / "index.py").exists())

        sys.path.insert(0, str(repo_root))
        try:
            from api.index import app as vercel_app
            self.assertIs(vercel_app, app)
        finally:
            if str(repo_root) in sys.path:
                sys.path.remove(str(repo_root))

        r_health = self.client.get("/api/health")
        self.assertEqual(r_health.status_code, 200)
        self.assertEqual(r_health.json()["status"], "ok")

        # 2. Chuẩn hóa URL postgres:// / postgresql:// -> postgresql+psycopg:// (hỗ trợ channel_binding=require của Neon)
        self.assertEqual(
            _normalize_database_url("postgres://u:p@host/db?sslmode=require&channel_binding=require"),
            "postgresql+psycopg://u:p@host/db?sslmode=require&channel_binding=require",
        )
        self.assertEqual(
            _normalize_database_url("postgresql://u:p@host/db?sslmode=require&channel_binding=require"),
            "postgresql+psycopg://u:p@host/db?sslmode=require&channel_binding=require",
        )

        # 3. Ẩn danh sách cán bộ khi tắt PUBLIC_STAFF_DIRECTORY (mặc định an toàn)
        r_dir_default = self.client.get("/api/auth/staff-directory")
        self.assertEqual(r_dir_default.status_code, 200)
        self.assertEqual(r_dir_default.json(), [])
        with patch("app.routers.auth.PUBLIC_STAFF_DIRECTORY", True):
            r_dir_on = self.client.get("/api/auth/staff-directory")
            self.assertEqual(r_dir_on.status_code, 200)
            self.assertGreater(len(r_dir_on.json()), 0)

        # 4. Fail-closed trên Vercel khi thiếu DATABASE_URL hoặc AGRIBANK_KPI_JWT_SECRET
        base_env = {k: v for k, v in os.environ.items() if k not in ("DATABASE_URL", "POSTGRES_URL", "AGRIBANK_KPI_JWT_SECRET", "JWT_SECRET", "VERCEL")}
        base_env["PYTHONPATH"] = str(BACKEND_ROOT)

        p_no_db = subprocess.run(
            [sys.executable, "-c", "import app.config"],
            env={**base_env, "VERCEL": "1"},
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(p_no_db.returncode, 0)
        self.assertIn("DATABASE_URL", p_no_db.stderr)

        p_no_jwt = subprocess.run(
            [sys.executable, "-c", "import app.config"],
            env={**base_env, "VERCEL": "1", "DATABASE_URL": "postgresql://u:p@host/db"},
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(p_no_jwt.returncode, 0)
        self.assertIn("AGRIBANK_KPI_JWT_SECRET", p_no_jwt.stderr)

        p_ok = subprocess.run(
            [sys.executable, "-c", "import app.config as c; print(c.IS_VERCEL, c.IS_SQLITE, c.PUBLIC_STAFF_DIRECTORY, c.CORS_ORIGINS)"],
            env={
                **base_env,
                "VERCEL": "1",
                "VERCEL_URL": "demo.vercel.app",
                "DATABASE_URL": "postgres://u:p@host/db?sslmode=require",
                "AGRIBANK_KPI_JWT_SECRET": "test-strong-secret-key-for-vercel-deploy",
            },
            capture_output=True,
            text=True,
        )
        self.assertEqual(p_ok.returncode, 0, p_ok.stderr)
        self.assertIn("True False False ['https://demo.vercel.app']", p_ok.stdout)

    def test_08_demo_only_seed_anonymized(self):
        from app.models import Employee, Indicator, KpiErrorCode, SalaryImportRow, TargetExecutionRow, MonthlyHistorySnapshot

        with tempfile.TemporaryDirectory() as td:
            db_f = Path(td) / "demo.db"
            eng = create_engine(f"sqlite:///{db_f.as_posix()}", connect_args={"check_same_thread": False})
            Base.metadata.create_all(bind=eng)
            Sess = sessionmaker(autocommit=False, autoflush=False, bind=eng)
            s = Sess()
            try:
                self.assertTrue(seed_database_if_empty(s, demo_only=True))
                emps = s.query(Employee).order_by(Employee.sort_order.asc()).all()
                self.assertEqual(len(emps), 5)
                self.assertEqual([e.emp_code for e in emps], ["DEMO001", "DEMO002", "DEMO003", "DEMO004", "DEMO005"])
                self.assertEqual(emps[0].emp_code, "DEMO001")
                self.assertEqual(emps[0].full_name, "Nguyễn Văn An")
                self.assertEqual(emps[0].base_v1, 14000000.0)
                self.assertEqual(emps[0].base_v2, 15000000.0)
                self.assertEqual(emps[1].emp_code, "DEMO002")
                self.assertEqual(emps[1].full_name, "Trần Thị Bình")
                self.assertEqual(emps[2].emp_code, "DEMO003")
                self.assertEqual(emps[2].full_name, "Lê Văn Cường")
                self.assertEqual(emps[3].emp_code, "DEMO004")
                self.assertEqual(emps[3].full_name, "Phạm Thị Dung")
                self.assertEqual(emps[4].emp_code, "DEMO005")
                self.assertEqual(emps[4].full_name, "Hoàng Văn Em")
                self.assertGreaterEqual(s.query(Indicator).count(), 8)
                self.assertGreater(s.query(KpiErrorCode).count(), 1000)
                self.assertEqual(s.query(SalaryImportRow).count(), 60)
                self.assertEqual(s.query(TargetExecutionRow).count(), 60 * s.query(Indicator).count())
                self.assertEqual(s.query(MonthlyHistorySnapshot).count(), 45)
                for m in range(1, 13):
                    calc = compute_period_kpi_and_payroll(s, f"2026-{m:02d}")
                    self.assertEqual(calc["totals"]["staff_count"], 5)
                    ranks = [r["rating"] for r in calc["payroll_rows"]]
                    self.assertEqual(ranks, ["A+", "A", "A", "B", "C"])
                    self.assertEqual(calc["totals"]["diff_ns"], 0)
                    self.assertGreater(calc["payroll_rows"][0]["diff_ns"], 0)
                    self.assertLess(calc["payroll_rows"][4]["diff_ns"], 0)
                    self.assertGreater(calc["totals"]["v2_surplus"], 0)
                v3_demo = compute_accumulation_v3(s, 2026, include_open_period=True)
                self.assertEqual(v3_demo["totals"]["staff_count"], 5)
                self.assertGreater(v3_demo["totals"]["v2_qt"], 0)
            finally:
                s.close()
                eng.dispose()

    def test_09_backend_verified_audit_fixes(self):
        from app.auth import verify_password, hash_password

        # 1. Unknown /api/* route returns 404, not 200
        r_404 = self.client.get("/api/non-existent-endpoint-audit-test")
        self.assertEqual(r_404.status_code, 404)
        self.assertIn("API endpoint not found", r_404.json().get("detail", ""))

        # 2. Plaintext password rejected; PBKDF2 hash accepted
        self.assertFalse(verify_password("123456", "123456"))
        hashed = hash_password("123456")
        self.assertTrue(verify_password("123456", hashed))

        # 3. Formula checks: TIER_MATRIX tier bonus retention & dynamic surplus label
        db = self.SessionTest()
        try:
            # Test TIER_MATRIX preserves ki > 1.0
            calc_matrix = compute_period_kpi_and_payroll(
                db,
                "2026-10",
                config_override={"tcv_mode": "TIER_MATRIX", "tcv_max_cap": 1.0},
                tiers_override=[
                    {"code": "A+", "min_score": 90, "max_score": 120, "ki_month": 1.05, "kq_settlement": 1.1, "h3_v3": 1.1},
                    {"code": "A", "min_score": 80, "max_score": 90, "ki_month": 1.0, "kq_settlement": 1.0, "h3_v3": 1.0},
                    {"code": "B", "min_score": 70, "max_score": 80, "ki_month": 0.9, "kq_settlement": 0.9, "h3_v3": 0.9},
                    {"code": "C", "min_score": 60, "max_score": 70, "ki_month": 0.8, "kq_settlement": 0.8, "h3_v3": 0.8},
                    {"code": "D", "min_score": 0, "max_score": 60, "ki_month": 0.7, "kq_settlement": 0.7, "h3_v3": 0.7},
                ],
            )
            a_plus_row = next(r for r in calc_matrix["kpi_rows"] if r["rating"] == "A+")
            self.assertGreater(a_plus_row["tcv"], 1.0)

            # Test dynamic V2 deficit label
            calc_deficit = compute_period_kpi_and_payroll(
                db,
                "2026-10",
                config_override={"v2_monthly_fund": 50000000.0, "v2_fund_mode": "MANUAL"},
            )
            v2_item = next(x for x in calc_deficit["dashboard"]["salary_structure"] if "dôi dư" in x["label"] or "thâm hụt" in x["label"])
            self.assertIn("thâm hụt", v2_item["label"])

            # Test V1_V2_PLUS_DIFF non-negative takehome clamp
            calc_clamp = compute_period_kpi_and_payroll(
                db,
                "2026-10",
                config_override={"monthly_takehome_mode": "V1_V2_PLUS_DIFF"},
            )
            for r in calc_clamp["payroll_rows"]:
                self.assertGreaterEqual(r["takehome"], 0.0)

            # Test rounding residual compensation equals total qns_fund
            calc_res = compute_period_kpi_and_payroll(
                db,
                "2026-10",
                config_override={"rounding_residual_to_last": True, "qns_mode": "MANUAL", "qns_manual_amount": 100000000.0},
            )
            self.assertEqual(sum(r["nsi"] for r in calc_res["payroll_rows"]), 100000000.0)
        finally:
            db.close()

    def test_10_data_audit_verified_fixes(self):
        from app.excel_io import sanitize_excel_cell
        admin_token = self._login_admin()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. sanitize_excel_cell prepends single quote on formula characters
        self.assertEqual(sanitize_excel_cell("=1+1"), "'=1+1")
        self.assertEqual(sanitize_excel_cell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0")
        self.assertEqual(sanitize_excel_cell("@SUM(A1:A10)"), "'@SUM(A1:A10)")
        self.assertEqual(sanitize_excel_cell("-100"), "'-100")
        self.assertEqual(sanitize_excel_cell("Nguyen Van A"), "Nguyen Van A")
        self.assertEqual(sanitize_excel_cell(12345), 12345)

        # 2. update_tich_luy_cell rejects mutation on locked month (T01 is locked)
        r_locked = self.client.put(
            "/api/payroll/tich-luy-v3/cell",
            json={"year_num": 2026, "month_num": 1, "emp_code": "3800207001465", "kpi_score": 99.0},
            headers=headers,
        )
        self.assertEqual(r_locked.status_code, 400)
        self.assertIn("Không thể chỉnh sửa dữ liệu kỳ đã khóa", r_locked.json().get("detail", ""))

        # 3. recalculate_history_from_dataset rejects when period lacks detailed salary/target rows
        r_recalc = self.client.post(
            "/api/operations/dataset/recalculate-history?period_code=2026-01",
            headers=headers,
        )
        self.assertEqual(r_recalc.status_code, 400)
        self.assertIn("Thiếu dữ liệu chi tiết của kỳ để tính lại", r_recalc.json().get("detail", ""))

    def test_11_turnover_inactive_employee_preservation_in_v3(self):
        """Kiểm tra cán bộ thôi việc/luân chuyển giữa năm (is_active=False) vẫn được bảo toàn trong quyết toán V3."""
        db = self.SessionTest()
        try:
            # 1. Đặt 1 nhân viên sang is_active = False (ví dụ cán bộ 3800207001465 đã có snapshot T1..T9)
            emp = db.query(Employee).filter(Employee.emp_code == "3800207001465").first()
            self.assertIsNotNone(emp)
            emp.is_active = False
            db.commit()

            # 2. Tính tích lũy V3
            v3 = compute_accumulation_v3(db, 2026, include_open_period=False)

            # 3. Xác thực nhân viên vẫn có trong kết quả
            emp_v3 = next((r for r in v3["rows"] if r["emp_code"] == "3800207001465"), None)
            self.assertIsNotNone(emp_v3, "Cán bộ thôi việc bị loại khỏi danh sách quyết toán V3!")
            self.assertGreaterEqual(emp_v3["months_active"], 9)
            self.assertGreater(emp_v3["v2_received"], 0)
            self.assertGreater(emp_v3["v3_amount"], 0)
        finally:
            emp = db.query(Employee).filter(Employee.emp_code == "3800207001465").first()
            if emp:
                emp.is_active = True
                db.commit()
            db.close()

    def test_12_missing_salary_import_record_defaults_to_zero_workdays(self):
        """Kiểm tra nhân sự thiếu bản ghi import lương nhận công = 0 và gắn cảnh báo."""
        db = self.SessionTest()
        try:
            # Xóa tạm bản ghi lương của 1 cán bộ trong kỳ 2026-10
            row = db.query(SalaryImportRow).filter(
                SalaryImportRow.period_code == "2026-10",
                SalaryImportRow.emp_code == "3800207001465"
            ).first()
            saved_data = None
            if row:
                saved_data = {
                    "period_code": row.period_code,
                    "emp_code": row.emp_code,
                    "full_name": row.full_name,
                    "title": row.title,
                    "department": row.department,
                    "group_name": row.group_name,
                    "labor_type": row.labor_type,
                    "hsl_v1": row.hsl_v1,
                    "base_v1": row.base_v1,
                    "base_v2": row.base_v2,
                    "actual_workdays": row.actual_workdays,
                    "status": row.status,
                }
                db.delete(row)
                db.commit()

            payroll = compute_period_kpi_and_payroll(db, "2026-10")
            p_row = next(r for r in payroll["payroll_rows"] if r["emp_code"] == "3800207001465")
            self.assertEqual(p_row["actual_workdays"], 0.0)
            self.assertTrue(p_row["missing_attendance"])
            self.assertIn("Thiếu dữ liệu", p_row["warning"])
            self.assertEqual(p_row["v1_actual"], 0.0)
            self.assertTrue(any("3800207001465" in w for w in payroll.get("warnings", [])))
        finally:
            if saved_data:
                db.add(SalaryImportRow(**saved_data))
                db.commit()
            db.close()

    def test_13_negative_values_clamp_and_zero_workdays(self):
        """Kiểm tra hàm chặn sàn max(0.0) chống điểm âm."""
        db = self.SessionTest()
        try:
            # Gán số liệu thực hiện âm cho một chỉ tiêu
            tgt = db.query(TargetExecutionRow).filter(
                TargetExecutionRow.period_code == "2026-10",
                TargetExecutionRow.emp_code == "3800207001465"
            ).first()
            orig_val = tgt.actual_value if tgt else 0.0
            if tgt:
                tgt.actual_value = -500.0
                db.commit()

            payroll = compute_period_kpi_and_payroll(db, "2026-10")
            p_row = next(r for r in payroll["payroll_rows"] if r["emp_code"] == "3800207001465")
            self.assertGreaterEqual(p_row["kpi_score"], 0.0)
            self.assertGreaterEqual(p_row["workday_ratio"], 0.0)

            # Khôi phục
            if tgt:
                tgt.actual_value = orig_val
                db.commit()
        finally:
            db.close()

    def test_14_pydantic_validation_boundaries(self):
        """Kiểm tra chặn HTTP 422 và HTTP 400 khi dữ liệu đầu vào vượt giới hạn."""
        admin_token = self._login_admin()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Thử cập nhật ngày công > 31 (chặn 422)
        res_high_wd = self.client.put(
            "/api/operations/salary-row?period_code=2026-10&emp_code=3800207001465",
            json={"actual_workdays": 35.0},
            headers=headers,
        )
        self.assertEqual(res_high_wd.status_code, 422)

        # 2. Thử cập nhật ngày công < 0 (chặn 422)
        res_neg_wd = self.client.put(
            "/api/operations/salary-row?period_code=2026-10&emp_code=3800207001465",
            json={"actual_workdays": -5.0},
            headers=headers,
        )
        self.assertEqual(res_neg_wd.status_code, 422)

        # 3. Thử cập nhật lương âm (chặn 422)
        res_neg_sal = self.client.put(
            "/api/operations/salary-row?period_code=2026-10&emp_code=3800207001465",
            json={"base_v1": -1000000.0},
            headers=headers,
        )
        self.assertEqual(res_neg_sal.status_code, 422)

        # 4. Thử cập nhật trọng số âm (chặn 400)
        res_cfg = self.client.put(
            "/api/admin/config",
            json={"w_cm": -0.2, "w_kpi": 0.8, "w_reserve": 0.4},
            headers=headers,
        )
        self.assertEqual(res_cfg.status_code, 400)
        self.assertIn("Trọng số w_cm phải nằm trong khoảng", res_cfg.json().get("detail", ""))

    def test_15_n_plus_one_dataset_commit_efficiency(self):
        """Kiểm tra tính chính xác và thời gian thực thi của bulk pre-fetch I/O."""
        import time
        from app.excel_io import commit_salary_dataset, commit_targets_dataset
        with open("FILE_MAU_CHUAN_IMPORT_LUONG_12_THANG.xlsx", "rb") as f:
            sal_bytes = f.read()
        with open("FILE_MAU_CHUAN_IMPORT_CHI_TIEU_12_THANG.xlsx", "rb") as f:
            tgt_bytes = f.read()

        db = self.SessionTest()
        try:
            t0 = time.time()
            res_sal = commit_salary_dataset(db, sal_bytes, scope="ALL", replace_existing=True)
            res_tgt = commit_targets_dataset(db, tgt_bytes, scope="ALL", replace_existing=True)
            elapsed = time.time() - t0
            self.assertGreater(res_sal["count"], 0)
            self.assertGreater(res_tgt["count"], 0)
            self.assertLess(elapsed, 3.0, f"Commit dataset quá chậm ({elapsed:.2f}s)!")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)

