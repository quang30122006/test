from contextvars import ContextVar
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from .models import AuditLog

client_ip_ctx: ContextVar[Optional[str]] = ContextVar("client_ip_ctx", default=None)
user_agent_ctx: ContextVar[Optional[str]] = ContextVar("user_agent_ctx", default=None)


def set_audit_context(ip_address: Optional[str] = None, user_agent: Optional[str] = None):
    """Thiết lập thông tin client context cho request hiện hành."""
    if ip_address is not None:
        client_ip_ctx.set(ip_address)
    if user_agent is not None:
        user_agent_ctx.set(user_agent)


def log_audit(
    db: Session,
    actor: str,
    action: str,
    target_data: str = "",
    details: str = "",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Ghi nhận nhật ký kiểm toán (Audit Trail) hệ thống kèm IP và User-Agent."""
    ip = ip_address if ip_address is not None else client_ip_ctx.get()
    ua = user_agent if user_agent is not None else user_agent_ctx.get()

    if ip and len(ip) > 45:
        ip = ip[:45]
    if ua and len(ua) > 255:
        ua = ua[:252] + "..."

    count = db.query(AuditLog).count()
    log_code = f"LOG{count + 1:03d}"
    ts = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    db.add(
        AuditLog(
            log_code=log_code,
            timestamp=ts,
            actor=actor,
            action=action,
            target_data=target_data or "",
            details=details or "",
            ip_address=ip,
            user_agent=ua,
        )
    )
    db.flush()


# Alias log_action to log_audit for compatibility
log_action = log_audit
