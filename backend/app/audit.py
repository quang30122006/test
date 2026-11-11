from datetime import datetime
from sqlalchemy.orm import Session
from .models import AuditLog


def log_audit(db: Session, actor: str, action: str, target_data: str, details: str):
    count = db.query(AuditLog).count()
    log_code = f"LOG{count + 1:03d}"
    ts = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    db.add(AuditLog(
        log_code=log_code,
        timestamp=ts,
        actor=actor,
        action=action,
        target_data=target_data,
        details=details,
    ))
    db.commit()

