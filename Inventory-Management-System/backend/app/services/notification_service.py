import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models.models import Notification, UserRole
from app.core.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def create_notification(
    db: Session,
    title: str,
    message: str,
    user_id: Optional[int] = None,
    role: Optional[UserRole] = None,
    link: Optional[str] = None,
    send_email: bool = True,
    recipient_email: Optional[str] = None
) -> Notification:
    """Creates an in-app notification and optionally attempts SMTP delivery if configured."""
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

    if send_email and settings.SMTP_ENABLED and settings.SMTP_HOST and recipient_email:
        try:
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = recipient_email
            msg['Subject'] = f"[SMVITM Inventory Alert] {title}"
            msg.attach(MIMEText(f"{message}\n\nLink: {link or 'http://localhost:5173'}", 'plain'))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Email sent successfully to {recipient_email}")
        except Exception as e:
            logger.warning(f"SMTP dispatch skipped/failed for {recipient_email}: {e}")
    else:
        # Honest delivery report: logged internally without misleading the user
        logger.info(f"Notification stored internally. SMTP delivery inactive (SMTP_ENABLED={settings.SMTP_ENABLED}).")

    return notification
