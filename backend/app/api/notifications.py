from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.models import Notification, User, UserRole
from app.schemas.schemas import NotificationResponse
from app.services.notification_service import get_dispatched_emails

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/emails", response_model=List[Dict[str, Any]])
def get_user_emails(
    current_user: User = Depends(get_current_user)
):
    """Retrieves institutional email messages for the currently authenticated user."""
    # Admins can view all emails, other roles view emails sent to their institutional address
    if current_user.role == UserRole.ADMIN:
        return get_dispatched_emails(None)
    return get_dispatched_emails(current_user.email)

@router.get("", response_model=List[NotificationResponse])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(
        (Notification.user_id == current_user.id) |
        (Notification.role == current_user.role) |
        ((Notification.user_id == None) & (Notification.role == None))
    ).order_by(Notification.created_at.desc()).limit(25).all()

    return notifications

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read"}

@router.put("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        ((Notification.user_id == current_user.id) | (Notification.role == current_user.role)),
        Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}
