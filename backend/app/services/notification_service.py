import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models.models import Notification, UserRole
from app.core.config import settings
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Institutional Email Dispatch Registry (Queryable for real-time inbox & verification)
DISPATCHED_EMAILS_LOG: List[Dict[str, Any]] = []

def create_notification(
    db: Session,
    title: str,
    message: str,
    user_id: Optional[int] = None,
    role: Optional[UserRole] = None,
    link: Optional[str] = None,
    send_email: bool = True,
    recipient_email: Optional[str] = None,
    recipient_name: Optional[str] = None
) -> Notification:
    """Creates an in-app notification and dispatches to institutional email box and SMTP."""
    from app.models.models import User
    
    notification = Notification(
        user_id=user_id,
        role=role,
        title=title,
        message=message,
        link=link,
        is_read=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Resolve recipient targets if not explicitly given
    targets: List[tuple] = []
    if recipient_email:
        targets.append((recipient_email, recipient_name or recipient_email.split('@')[0].capitalize()))
    elif user_id:
        target_user = db.query(User).filter(User.id == user_id).first()
        if target_user and target_user.email:
            targets.append((target_user.email, target_user.full_name))
    elif role:
        role_users = db.query(User).filter(User.role == role, User.is_active == True).all()
        for u in role_users:
            if u.email:
                targets.append((u.email, u.full_name))

    # 1. Institutional Email Dispatch Recording
    if send_email:
        for r_email, r_name in targets:
            status_text = "Dispatched to Institutional Mailbox"
            if settings.SMTP_ENABLED and settings.SMTP_HOST:
                try:
                    msg = MIMEMultipart()
                    msg['From'] = settings.SMTP_FROM_EMAIL
                    msg['To'] = r_email
                    msg['Subject'] = f"[SMVITM Institutional Alert] {title}"
                    msg.attach(MIMEText(f"{message}\n\nDirect Link: {link or 'http://localhost:5173'}", 'plain'))

                    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.send_message(msg)
                    logger.info(f"Live SMTP Email sent successfully to {r_email}")
                    status_text = "Delivered via Institutional SMTP Server"
                except Exception as e:
                    logger.warning(f"SMTP dispatch skipped/failed for {r_email}: {e}")
                    status_text = f"Queued in Mailbox (SMTP: {e})"
            
            email_record = {
                "id": len(DISPATCHED_EMAILS_LOG) + 1,
                "to_email": r_email,
                "to_name": r_name,
                "from_email": settings.SMTP_FROM_EMAIL if hasattr(settings, "SMTP_FROM_EMAIL") else "inventory-system@sode-edu.in",
                "subject": f"[SMVITM Institutional Alert] {title}",
                "body": message,
                "link": link or "/transfers",
                "sent_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "status": status_text,
                "notification_id": notification.id
            }
            DISPATCHED_EMAILS_LOG.insert(0, email_record)
            if len(DISPATCHED_EMAILS_LOG) > 100:
                DISPATCHED_EMAILS_LOG.pop()

    return notification

def get_dispatched_emails(recipient_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns dispatched institutional emails, optionally filtered by recipient."""
    if not recipient_email:
        return DISPATCHED_EMAILS_LOG
    return [e for e in DISPATCHED_EMAILS_LOG if e["to_email"].lower() == recipient_email.lower()]
