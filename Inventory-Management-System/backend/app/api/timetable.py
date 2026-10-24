from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.permissions import get_current_user, require_roles
from app.models.models import TimetableSlot, Laboratory, User, UserRole
from app.schemas.schemas import TimetableSlotCreate, TimetableSlotResponse
from app.services.audit_service import log_audit

router = APIRouter(prefix="/timetable", tags=["Laboratory Timetable"])

@router.get("", response_model=List[TimetableSlotResponse])
def get_timetable(
    lab_id: Optional[int] = Query(None),
    day: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TimetableSlot)
    if lab_id:
        query = query.filter(TimetableSlot.lab_id == lab_id)
    if day:
        query = query.filter(TimetableSlot.day_of_week.ilike(day))
    return query.order_by(TimetableSlot.day_of_week, TimetableSlot.start_time).all()

@router.post("", response_model=TimetableSlotResponse)
def create_slot(
    payload: TimetableSlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    # Check for slot collisions
    overlapping = db.query(TimetableSlot).filter(
        TimetableSlot.lab_id == payload.lab_id,
        TimetableSlot.day_of_week == payload.day_of_week,
        TimetableSlot.start_time < payload.end_time,
        TimetableSlot.end_time > payload.start_time
    ).first()

    if overlapping:
        # Suggest alternative laboratory that is free at this slot
        all_labs = db.query(Laboratory).filter(Laboratory.is_active == True, Laboratory.id != payload.lab_id).all()
        free_alt_labs = []
        for alt_lab in all_labs:
            alt_conflict = db.query(TimetableSlot).filter(
                TimetableSlot.lab_id == alt_lab.id,
                TimetableSlot.day_of_week == payload.day_of_week,
                TimetableSlot.start_time < payload.end_time,
                TimetableSlot.end_time > payload.start_time
            ).first()
            if not alt_conflict:
                free_alt_labs.append(alt_lab.name)

        suggestion = f" Alternative free lab(s): {', '.join(free_alt_labs)}" if free_alt_labs else " No other labs free at this time."
        raise HTTPException(
            status_code=400,
            detail=f"Time slot collision with '{overlapping.subject}' ({overlapping.start_time}-{overlapping.end_time}).{suggestion}"
        )

    slot = TimetableSlot(
        lab_id=payload.lab_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        subject=payload.subject,
        batch_or_class=payload.batch_or_class,
        instructor_name=payload.instructor_name,
        is_maintenance=payload.is_maintenance,
        notes=payload.notes
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    log_audit(db, "CREATE_TIMETABLE_SLOT", "TimetableSlot", str(slot.id), current_user, f"Scheduled {slot.subject} in Lab {slot.lab_id}")
    return slot
