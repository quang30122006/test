import json
import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, AuditLog
from app.audit import log_audit, log_action, client_ip_ctx, user_agent_ctx, set_audit_context


class TestInfraAndAuditTrail(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()
        # Reset contextvars
        client_ip_ctx.set(None)
        user_agent_ctx.set(None)

    def tearDown(self):
        self.db.close()

    def test_vercel_functions_configuration(self):
        """Kiểm tra vercel.json có memory=1024 và maxDuration=60 cho api/index.py."""
        repo_root = Path(__file__).resolve().parent.parent.parent
        vercel_json_path = repo_root / "vercel.json"
        self.assertTrue(vercel_json_path.exists(), "vercel.json must exist")

        cfg = json.loads(vercel_json_path.read_text(encoding="utf-8"))
        self.assertIn("functions", cfg)
        self.assertIn("api/index.py", cfg["functions"])
        fn_cfg = cfg["functions"]["api/index.py"]

        self.assertEqual(fn_cfg.get("memory"), 1024, "Memory must be 1024MB")
        self.assertEqual(fn_cfg.get("maxDuration"), 60, "maxDuration must be 60 seconds")

    def test_audit_log_model_columns(self):
        """Kiểm tra bảng AuditLog có các trường ip_address và user_agent chuẩn TT 09/2020."""
        self.assertTrue(hasattr(AuditLog, "ip_address"))
        self.assertTrue(hasattr(AuditLog, "user_agent"))

        col_ip = AuditLog.__table__.columns["ip_address"]
        col_ua = AuditLog.__table__.columns["user_agent"]

        self.assertEqual(col_ip.type.length, 45, "ip_address length must be 45 for IPv6/IPv4")
        self.assertEqual(col_ua.type.length, 255, "user_agent length must be 255")
        self.assertTrue(col_ip.nullable)
        self.assertTrue(col_ua.nullable)

    def test_log_action_explicit_arguments(self):
        """Kiểm tra log_action và log_audit nhận trực tiếp ip_address và user_agent."""
        log_action(
            self.db,
            actor="Admin_Test",
            action="TEST_EXPLICIT",
            target_data="Chỉ tiêu GK",
            details="Thử nghiệm truyền IP rõ ràng",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        )
        self.db.commit()

        rec = self.db.query(AuditLog).filter(AuditLog.action == "TEST_EXPLICIT").first()
        self.assertIsNotNone(rec)
        self.assertEqual(rec.actor, "Admin_Test")
        self.assertEqual(rec.ip_address, "192.168.1.100")
        self.assertEqual(rec.user_agent, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")

    def test_log_audit_contextvars_fallback(self):
        """Kiểm tra cơ chế ContextVars tự động ghi nhận IP & UA khi không truyền tham số."""
        set_audit_context(ip_address="10.20.30.40", user_agent="AgribankInternal/2.0")

        log_audit(
            self.db,
            actor="Auto_User",
            action="TEST_CONTEXTVARS",
            target_data="BangLuong_3P",
            details="Tự động bắt IP từ Middleware ContextVars",
        )
        self.db.commit()

        rec = self.db.query(AuditLog).filter(AuditLog.action == "TEST_CONTEXTVARS").first()
        self.assertIsNotNone(rec)
        self.assertEqual(rec.ip_address, "10.20.30.40")
        self.assertEqual(rec.user_agent, "AgribankInternal/2.0")

    def test_api_index_entrypoint_import(self):
        """Kiểm tra entrypoint api/index.py import trơn tru và trả về app hợp lệ."""
        repo_root = BACKEND_ROOT.parent
        sys.path.insert(0, str(repo_root))
        try:
            import api.index as vercel_entry
            self.assertTrue(hasattr(vercel_entry, "app"))
            self.assertIsNotNone(vercel_entry.app)
        finally:
            if str(repo_root) in sys.path:
                sys.path.remove(str(repo_root))


if __name__ == "__main__":
    unittest.main()
