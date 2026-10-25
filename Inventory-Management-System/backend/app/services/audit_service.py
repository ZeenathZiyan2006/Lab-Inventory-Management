from sqlalchemy.orm import Session
from app.models.models import AuditLog, User
from typing import Optional

def log_audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user: Optional[User] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    audit = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else "SYSTEM",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        details=details,
        ip_address=ip_address
    )
    db.add(audit)
    db.commit()
