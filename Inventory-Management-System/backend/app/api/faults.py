from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_
from typing import List, Optional
import os
import uuid
import io
import csv
import math
from datetime import datetime
from app.core.database import get_db
from app.core.config import settings
from app.core.permissions import get_current_user, require_roles, verify_lab_access
from app.models.models import (
    FaultReport, RepairJob, FaultStatusHistory, RepairPartItem, Asset, BulkInventory, Laboratory, User, UserRole,
    FaultStatus, FaultPriority, AssetStatus
)
from app.schemas.schemas import (
    FaultReportCreate, FaultReportResponse, RepairJobAssign, RepairJobUpdate,
    RepairJobVerify, RepairJobResponse, FaultRejectRequest, FaultReopenRequest,
    TechnicianSummaryResponse, RepairPartItemResponse, FaultStatusHistoryResponse
)
from app.services.ai_service import classify_fault
from app.services.audit_service import log_audit
from app.services.notification_service import create_notification

router = APIRouter(prefix="/faults", tags=["Fault Reporting & Maintenance"])

ALLOWED_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def _format_parts(parts: List[RepairPartItem]) -> List[dict]:
    return [
        {
            "id": p.id,
            "repair_id": p.repair_id,
            "part_name": p.part_name,
            "part_number": p.part_number,
            "quantity": p.quantity,
            "unit_cost": p.unit_cost,
            "created_at": p.created_at
        }
        for p in parts
    ]

def _format_history(history: List[FaultStatusHistory]) -> List[dict]:
    return [
        {
            "id": h.id,
            "fault_id": h.fault_id,
            "user_id": h.user_id,
            "user_name": h.user.full_name if h.user else "System",
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "action": h.action,
            "reason": h.reason,
            "timestamp": h.timestamp
        }
        for h in history
    ]

def _format_repair_job(repair: Optional[RepairJob]) -> Optional[dict]:
    if not repair:
        return None
    return {
        "id": repair.id,
        "fault_id": repair.fault_id,
        "technician_id": repair.technician_id,
        "technician_name": repair.technician.full_name if repair.technician else "Unassigned",
        "assigned_by_id": repair.assigned_by_id,
        "assigned_by_name": repair.assigned_by.full_name if repair.assigned_by else None,
        "status": repair.status,
        "due_date": repair.due_date,
        "assignment_notes": repair.assignment_notes,
        "diagnosis": repair.diagnosis,
        "troubleshooting_steps": repair.troubleshooting_steps,
        "work_performed": repair.work_performed,
        "notes": repair.notes,
        "parts_requested": repair.parts_requested,
        "repair_cost": repair.repair_cost or 0.0,
        "completion_time": repair.completion_time,
        "replacement_recommended": repair.replacement_recommended or False,
        "unable_to_repair_reason": repair.unable_to_repair_reason,
        "is_verified": repair.is_verified,
        "verified_by_id": repair.verified_by_id,
        "verified_by_name": repair.verified_by.full_name if repair.verified_by else None,
        "verified_at": repair.verified_at,
        "verification_notes": repair.verification_notes,
        "parts_used": _format_parts(repair.parts_used),
        "created_at": repair.created_at,
        "updated_at": repair.updated_at
    }

def _format_fault_response(fault: FaultReport) -> dict:
    return {
        "id": fault.id,
        "report_number": fault.report_number,
        "title": fault.title or f"{fault.fault_category} in Lab {fault.lab_id}",
        "asset_id": fault.asset_id,
        "asset_custom_id": fault.asset.asset_id if fault.asset else None,
        "asset_name": fault.asset.name if fault.asset else None,
        "bulk_id": fault.bulk_id,
        "bulk_name": fault.bulk_item.name if fault.bulk_item else None,
        "lab_id": fault.lab_id,
        "lab_name": fault.laboratory.name if fault.laboratory else f"Lab {fault.lab_id}",
        "reported_by_id": fault.reported_by_id,
        "reported_by_name": fault.reported_by.full_name if fault.reported_by else "Staff",
        "fault_category": fault.fault_category,
        "priority": fault.priority,
        "description": fault.description,
        "photo_url": fault.photo_url,
        "is_safety_hazard": fault.is_safety_hazard,
        "safety_warning": fault.safety_warning,
        "rejection_reason": fault.rejection_reason,
        "ai_suggested_category": fault.ai_suggested_category,
        "ai_suggested_priority": fault.ai_suggested_priority,
        "ai_confidence": fault.ai_confidence,
        "status": fault.status,
        "created_at": fault.created_at,
        "updated_at": fault.updated_at,
        "repair_job": _format_repair_job(fault.repair_job),
        "status_history": _format_history(fault.status_history)
    }

def _log_status_transition(db: Session, fault: FaultReport, user: User, action: str, prev_status: Optional[str], new_status: str, reason: str):
    history = FaultStatusHistory(
        fault_id=fault.id,
        user_id=user.id,
        previous_status=prev_status,
        new_status=new_status,
        action=action,
        reason=reason.strip()
    )
    db.add(history)

# --- Technicians Directory ---
@router.get("/technicians", response_model=List[TechnicianSummaryResponse])
def get_technicians(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns active technicians and their current repair workload."""
    techs = db.query(User).filter(User.role == UserRole.TECHNICIAN, User.is_active == True).all()
    results = []
    for t in techs:
        active_jobs = db.query(RepairJob).filter(
            RepairJob.technician_id == t.id,
            RepairJob.status.notin_([FaultStatus.CLOSED, FaultStatus.REJECTED, FaultStatus.UNABLE_TO_REPAIR])
        ).count()
        completed_jobs = db.query(RepairJob).filter(
            RepairJob.technician_id == t.id,
            RepairJob.status == FaultStatus.CLOSED
        ).count()
        results.append({
            "id": t.id,
            "full_name": t.full_name,
            "email": t.email,
            "phone_number": t.phone_number,
            "active_assigned_jobs": active_jobs,
            "completed_repairs": completed_jobs
        })
    return results

# --- Technician's Personal Assigned Repairs ---
@router.get("/my-repairs", response_model=List[FaultReportResponse])
def get_my_assigned_repairs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.TECHNICIAN, UserRole.ADMIN]))
):
    """Returns only repairs assigned to the authenticated technician."""
    query = db.query(FaultReport).join(RepairJob).filter(RepairJob.technician_id == current_user.id)
    records = query.order_by(desc(FaultReport.created_at)).all()
    return [_format_fault_response(f) for f in records]

# --- List All Fault Reports ---
@router.get("", response_model=List[FaultReportResponse])
def get_fault_reports(
    lab_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[FaultPriority] = Query(None),
    category: Optional[str] = Query(None),
    is_safety_hazard: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FaultReport)

    # Role-based restriction
    if current_user.role == UserRole.TECHNICIAN:
        query = query.outerjoin(RepairJob).filter(
            or_(
                RepairJob.technician_id == current_user.id,
                FaultReport.status == FaultStatus.REPORTED
            )
        )
    elif current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(FaultReport.lab_id.in_(assigned_ids))
    elif lab_id:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized for this laboratory")
        query = query.filter(FaultReport.lab_id == lab_id)

    if status:
        status_clean = status.strip().lower()
        # Handle aliases
        if status_clean in ["closed", "verified and closed"]:
            query = query.filter(FaultReport.status == FaultStatus.CLOSED)
        elif status_clean in ["awaiting verification", "repair completed — awaiting verification"]:
            query = query.filter(FaultReport.status == FaultStatus.AWAITING_VERIFICATION)
        else:
            for s in FaultStatus:
                if s.value.lower() == status_clean:
                    query = query.filter(FaultReport.status == s)
                    break

    if priority:
        query = query.filter(FaultReport.priority == priority)
    if category:
        query = query.filter(FaultReport.fault_category.ilike(f"%{category.strip()}%"))
    if is_safety_hazard is not None:
        query = query.filter(FaultReport.is_safety_hazard == is_safety_hazard)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.outerjoin(Asset).filter(
            or_(
                FaultReport.report_number.ilike(search_term),
                FaultReport.title.ilike(search_term),
                FaultReport.description.ilike(search_term),
                Asset.name.ilike(search_term),
                Asset.asset_id.ilike(search_term)
            )
        )

    records = query.order_by(desc(FaultReport.created_at)).all()
    return [_format_fault_response(f) for f in records]

# --- Single Fault Report Details ---
@router.get("/{fault_id}", response_model=FaultReportResponse)
def get_fault_report(
    fault_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    fault = db.query(FaultReport).filter(FaultReport.id == fault_id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault report not found")

    if current_user.role == UserRole.LAB_INSTRUCTOR and not verify_lab_access(current_user, fault.lab_id, db):
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this laboratory")

    if current_user.role == UserRole.TECHNICIAN:
        if fault.repair_job and fault.repair_job.technician_id != current_user.id and fault.status != FaultStatus.REPORTED:
            raise HTTPException(status_code=403, detail="Access denied: This repair is assigned to another technician")

    return _format_fault_response(fault)

# --- Create Fault Report ---
@router.post("", response_model=FaultReportResponse)
def report_fault(
    payload: FaultReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN, UserRole.HOD, UserRole.PRINCIPAL]))
):
    if not verify_lab_access(current_user, payload.lab_id, db):
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized for this laboratory")

    # Validate asset or bulk item
    if payload.asset_id:
        asset = db.query(Asset).filter(Asset.id == payload.asset_id, Asset.lab_id == payload.lab_id).first()
        if not asset:
            raise HTTPException(status_code=400, detail="Referenced asset was not found in this laboratory")
    elif payload.bulk_id:
        bulk = db.query(BulkInventory).filter(BulkInventory.id == payload.bulk_id, BulkInventory.lab_id == payload.lab_id).first()
        if not bulk:
            raise HTTPException(status_code=400, detail="Referenced bulk item was not found in this laboratory")

    if not payload.description or len(payload.description.strip()) < 5:
        raise HTTPException(status_code=400, detail="Please provide a detailed fault description (minimum 5 characters).")

    # AI diagnosis assistance for category/priority suggestions
    ai_result = classify_fault(payload.description)

    report_num = f"FLT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    title = payload.title.strip() if payload.title else f"{payload.fault_category} Issue"

    safety_warning = None
    if payload.is_safety_hazard:
        safety_warning = payload.safety_warning or "CRITICAL SAFETY CONCERN: Do not operate or touch equipment until certified by qualified technical staff."

    fault = FaultReport(
        report_number=report_num,
        title=title,
        asset_id=payload.asset_id,
        bulk_id=payload.bulk_id,
        lab_id=payload.lab_id,
        reported_by_id=current_user.id,
        fault_category=payload.fault_category,
        priority=payload.priority,
        description=payload.description.strip(),
        photo_url=payload.photo_url,
        is_safety_hazard=payload.is_safety_hazard,
        safety_warning=safety_warning,
        ai_suggested_category=ai_result["category"],
        ai_suggested_priority=ai_result["suggested_priority"].value,
        ai_confidence=ai_result["confidence"],
        status=FaultStatus.REPORTED
    )
    db.add(fault)

    # Sync Asset status
    if payload.asset_id:
        asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
        if asset:
            asset.status = AssetStatus.FAULT_REPORTED

    db.commit()
    db.refresh(fault)

    # Initial history log
    _log_status_transition(
        db, fault, current_user,
        action="Reported",
        prev_status=None,
        new_status=FaultStatus.REPORTED.value,
        reason=payload.description.strip()
    )
    db.commit()

    # Dispatch alerts
    notification_title = f"{'⚠️ CRITICAL SAFETY HAZARD' if fault.is_safety_hazard else 'New Fault Reported'}: {fault.report_number}"
    create_notification(
        db,
        title=notification_title,
        message=f"{fault.title} reported in Lab {fault.lab_id} (Priority: {fault.priority.value}).",
        role=UserRole.TECHNICIAN,
        link="/faults"
    )

    log_audit(db, "REPORT_FAULT", "FaultReport", str(fault.id), current_user, f"Reported fault {fault.report_number}. Safety hazard: {fault.is_safety_hazard}")
    return _format_fault_response(fault)

# --- Review Fault Ticket ---
@router.post("/{fault_id}/review", response_model=FaultReportResponse)
def review_fault_ticket(
    fault_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.LAB_INSTRUCTOR]))
):
    fault = db.query(FaultReport).filter(FaultReport.id == fault_id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault report not found")
    if not verify_lab_access(current_user, fault.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    prev_status = fault.status.value
    fault.status = FaultStatus.REVIEWED
    _log_status_transition(db, fault, current_user, "Review", prev_status, FaultStatus.REVIEWED.value, "Fault reviewed and confirmed for technical repair assignment.")
    db.commit()
    db.refresh(fault)

    log_audit(db, "REVIEW_FAULT", "FaultReport", str(fault.id), current_user, f"Reviewed fault {fault.report_number}")
    return _format_fault_response(fault)

# --- Assign Technician ---
@router.post("/{fault_id}/assign", response_model=FaultReportResponse)
def assign_technician(
    fault_id: int,
    payload: RepairJobAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.LAB_INSTRUCTOR]))
):
    fault = db.query(FaultReport).filter(FaultReport.id == fault_id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault report not found")
    if not verify_lab_access(current_user, fault.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    tech = db.query(User).filter(User.id == payload.technician_id, User.role == UserRole.TECHNICIAN, User.is_active == True).first()
    if not tech:
        raise HTTPException(status_code=400, detail="Invalid technician ID or technician account is inactive")

    repair = db.query(RepairJob).filter(RepairJob.fault_id == fault_id).first()
    if not repair:
        repair = RepairJob(
            fault_id=fault_id,
            technician_id=tech.id,
            assigned_by_id=current_user.id,
            due_date=payload.due_date,
            assignment_notes=payload.assignment_notes,
            status=FaultStatus.ASSIGNED
        )
        db.add(repair)
    else:
        repair.technician_id = tech.id
        repair.assigned_by_id = current_user.id
        repair.due_date = payload.due_date
        repair.assignment_notes = payload.assignment_notes
        repair.status = FaultStatus.ASSIGNED

    prev_status = fault.status.value
    fault.status = FaultStatus.ASSIGNED

    if fault.asset:
        fault.asset.status = AssetStatus.UNDER_REPAIR

    _log_status_transition(
        db, fault, current_user,
        action="Assigned",
        prev_status=prev_status,
        new_status=FaultStatus.ASSIGNED.value,
        reason=f"Assigned to technician {tech.full_name}. Notes: {payload.assignment_notes or 'Standard assignment'}"
    )
    db.commit()
    db.refresh(fault)

    create_notification(
        db,
        title="Repair Job Assigned",
        message=f"You have been assigned to repair {fault.report_number} in Lab {fault.lab_id} (Priority: {fault.priority.value}).",
        user_id=tech.id,
        link="/faults",
        recipient_email=tech.email
    )

    log_audit(db, "ASSIGN_REPAIR", "RepairJob", str(repair.id), current_user, f"Assigned fault {fault.report_number} to {tech.full_name}")
    return _format_fault_response(fault)

# --- Start Repair Work ---
@router.post("/repairs/{repair_id}/start", response_model=FaultReportResponse)
def start_repair_work(
    repair_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.TECHNICIAN, UserRole.ADMIN]))
):
    repair = db.query(RepairJob).filter(RepairJob.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair job not found")

    if current_user.role == UserRole.TECHNICIAN and repair.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only accept and start repairs assigned to you")

    prev_status = repair.status.value
    repair.status = FaultStatus.IN_PROGRESS
    fault = repair.fault_report
    fault.status = FaultStatus.IN_PROGRESS

    _log_status_transition(
        db, fault, current_user,
        action="Work Started",
        prev_status=prev_status,
        new_status=FaultStatus.IN_PROGRESS.value,
        reason=f"Technician {current_user.full_name} accepted job and started diagnostic work."
    )
    db.commit()
    db.refresh(fault)

    log_audit(db, "START_REPAIR", "RepairJob", str(repair.id), current_user, f"Started work on repair {repair.id}")
    return _format_fault_response(fault)

# --- Update Repair Progress & Parts ---
@router.put("/repairs/{repair_id}/update", response_model=FaultReportResponse)
def update_repair_progress(
    repair_id: int,
    payload: RepairJobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.TECHNICIAN, UserRole.ADMIN]))
):
    repair = db.query(RepairJob).filter(RepairJob.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair job not found")

    if current_user.role == UserRole.TECHNICIAN and repair.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update repairs assigned to you")

    fault = repair.fault_report
    prev_status = repair.status.value

    if payload.diagnosis is not None:
        repair.diagnosis = payload.diagnosis.strip()
    if payload.troubleshooting_steps is not None:
        repair.troubleshooting_steps = payload.troubleshooting_steps.strip()
    if payload.work_performed is not None:
        repair.work_performed = payload.work_performed.strip()
    if payload.notes is not None:
        repair.notes = payload.notes.strip()
    if payload.parts_requested is not None:
        repair.parts_requested = payload.parts_requested.strip()
    if payload.repair_cost is not None:
        repair.repair_cost = max(0.0, float(payload.repair_cost))

    # Add parts used
    if payload.parts_used:
        for p in payload.parts_used:
            part_item = RepairPartItem(
                repair_id=repair.id,
                part_name=p.part_name.strip(),
                part_number=p.part_number.strip() if p.part_number else None,
                quantity=max(1, p.quantity),
                unit_cost=max(0.0, p.unit_cost)
            )
            db.add(part_item)

    if payload.status:
        repair.status = payload.status
        fault.status = payload.status
        _log_status_transition(
            db, fault, current_user,
            action="Status Update",
            prev_status=prev_status,
            new_status=payload.status.value,
            reason=payload.notes or "Progress update logged by technician"
        )

    db.commit()
    db.refresh(fault)

    log_audit(db, "UPDATE_REPAIR_PROGRESS", "RepairJob", str(repair.id), current_user, f"Updated repair {repair.id}")
    return _format_fault_response(fault)

# --- Submit Completed Repair for Verification ---
@router.post("/repairs/{repair_id}/complete", response_model=FaultReportResponse)
def submit_repair_completion(
    repair_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.TECHNICIAN, UserRole.ADMIN]))
):
    repair = db.query(RepairJob).filter(RepairJob.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair job not found")

    if current_user.role == UserRole.TECHNICIAN and repair.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only submit your own assigned repairs")

    notes_len = len((repair.work_performed or "").strip()) + len((repair.notes or "").strip())
    if notes_len < 10:
        raise HTTPException(
            status_code=400,
            detail="Meaningful repair documentation is mandatory before completion. Please describe work performed (at least 10 characters)."
        )

    prev_status = repair.status.value
    repair.status = FaultStatus.AWAITING_VERIFICATION
    repair.completion_time = datetime.utcnow()
    fault = repair.fault_report
    fault.status = FaultStatus.AWAITING_VERIFICATION

    _log_status_transition(
        db, fault, current_user,
        action="Submitted for Verification",
        prev_status=prev_status,
        new_status=FaultStatus.AWAITING_VERIFICATION.value,
        reason=f"Work completed: {repair.work_performed or repair.notes}. Ready for instructor verification."
    )
    db.commit()
    db.refresh(fault)

    # Notify Lab Instructor for verification
    create_notification(
        db,
        title="Repair Completed — Verification Required",
        message=f"Repair for fault {fault.report_number} has been completed by {current_user.full_name} and requires instructor verification.",
        user_id=fault.reported_by_id,
        link="/faults"
    )

    log_audit(db, "SUBMIT_REPAIR_COMPLETION", "RepairJob", str(repair.id), current_user, f"Submitted repair {repair.id} for verification")
    return _format_fault_response(fault)

# --- Instructor Verification ---
@router.post("/repairs/{repair_id}/verify", response_model=FaultReportResponse)
def verify_repair_completion(
    repair_id: int,
    payload: RepairJobVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    repair = db.query(RepairJob).filter(RepairJob.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair job not found")

    fault = repair.fault_report
    if not verify_lab_access(current_user, fault.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    # Anti-Self-Verification rule: A technician must not verify their own completed repair
    if current_user.id == repair.technician_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Conflict of Interest: A technician cannot verify their own completed repair. Verification must be performed by the authorized Lab Instructor."
        )

    prev_status = fault.status.value

    if payload.is_verified:
        repair.is_verified = True
        repair.verified_by_id = current_user.id
        repair.verified_at = datetime.utcnow()
        repair.verification_notes = payload.verification_notes or "Repair verified and approved by lab instructor."
        repair.status = FaultStatus.CLOSED
        fault.status = FaultStatus.CLOSED

        # Synchronize asset status: Mark as Working only if no other active open fault exists!
        if fault.asset:
            other_open_faults = db.query(FaultReport).filter(
                FaultReport.asset_id == fault.asset_id,
                FaultReport.id != fault.id,
                FaultReport.status.notin_([FaultStatus.CLOSED, FaultStatus.REJECTED])
            ).count()
            if other_open_faults == 0:
                fault.asset.status = AssetStatus.WORKING

        _log_status_transition(
            db, fault, current_user,
            action="Verified and Closed",
            prev_status=prev_status,
            new_status=FaultStatus.CLOSED.value,
            reason=repair.verification_notes
        )

        create_notification(
            db,
            title="Repair Verified and Closed",
            message=f"Repair for fault {fault.report_number} was successfully verified by {current_user.full_name}.",
            user_id=repair.technician_id,
            link="/faults"
        )
    else:
        # Rejected completion — return ticket to In Progress
        if not payload.rejection_reason or len(payload.rejection_reason.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="A detailed rejection reason (minimum 5 characters) is required when rejecting repair completion."
            )

        repair.is_verified = False
        repair.rejection_reason = payload.rejection_reason.strip()
        repair.status = FaultStatus.IN_PROGRESS
        fault.status = FaultStatus.IN_PROGRESS

        _log_status_transition(
            db, fault, current_user,
            action="Completion Rejected",
            prev_status=prev_status,
            new_status=FaultStatus.IN_PROGRESS.value,
            reason=f"Verification rejected: {payload.rejection_reason.strip()}"
        )

        create_notification(
            db,
            title="Repair Completion Returned",
            message=f"Completion rejected for fault {fault.report_number}. Reason: {payload.rejection_reason.strip()}",
            user_id=repair.technician_id,
            link="/faults"
        )

    db.commit()
    db.refresh(fault)

    log_audit(db, "VERIFY_REPAIR", "RepairJob", str(repair.id), current_user, f"Verification: {payload.is_verified}")
    return _format_fault_response(fault)

# --- Reject Fault Ticket ---
@router.post("/{fault_id}/reject", response_model=FaultReportResponse)
def reject_fault_ticket(
    fault_id: int,
    payload: FaultRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    fault = db.query(FaultReport).filter(FaultReport.id == fault_id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault report not found")
    if not verify_lab_access(current_user, fault.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    if not payload.rejection_reason or len(payload.rejection_reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="A mandatory rejection reason (at least 5 characters) is required.")

    prev_status = fault.status.value
    fault.status = FaultStatus.REJECTED
    fault.rejection_reason = payload.rejection_reason.strip()

    if fault.repair_job:
        fault.repair_job.status = FaultStatus.REJECTED

    # If asset was marked FAULT_REPORTED, reset to Working if no other open faults exist
    if fault.asset:
        other_open = db.query(FaultReport).filter(
            FaultReport.asset_id == fault.asset_id,
            FaultReport.id != fault.id,
            FaultReport.status.notin_([FaultStatus.CLOSED, FaultStatus.REJECTED])
        ).count()
        if other_open == 0:
            fault.asset.status = AssetStatus.WORKING

    _log_status_transition(
        db, fault, current_user,
        action="Rejected",
        prev_status=prev_status,
        new_status=FaultStatus.REJECTED.value,
        reason=payload.rejection_reason.strip()
    )
    db.commit()
    db.refresh(fault)

    log_audit(db, "REJECT_FAULT", "FaultReport", str(fault.id), current_user, f"Rejected fault {fault.report_number}")
    return _format_fault_response(fault)

# --- Reopen Closed Ticket ---
@router.post("/{fault_id}/reopen", response_model=FaultReportResponse)
def reopen_fault_ticket(
    fault_id: int,
    payload: FaultReopenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    fault = db.query(FaultReport).filter(FaultReport.id == fault_id).first()
    if not fault:
        raise HTTPException(status_code=404, detail="Fault report not found")
    if not verify_lab_access(current_user, fault.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    if not payload.reopen_reason or len(payload.reopen_reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="A mandatory reopen reason (at least 5 characters) is required.")

    prev_status = fault.status.value
    fault.status = FaultStatus.REOPENED

    if fault.repair_job:
        fault.repair_job.status = FaultStatus.REOPENED
        fault.repair_job.is_verified = False

    if fault.asset:
        fault.asset.status = AssetStatus.FAULT_REPORTED

    _log_status_transition(
        db, fault, current_user,
        action="Reopened",
        prev_status=prev_status,
        new_status=FaultStatus.REOPENED.value,
        reason=payload.reopen_reason.strip()
    )
    db.commit()
    db.refresh(fault)

    create_notification(
        db,
        title="Fault Ticket Reopened",
        message=f"Ticket {fault.report_number} was reopened by {current_user.full_name}: {payload.reopen_reason.strip()}",
        role=UserRole.TECHNICIAN,
        link="/faults"
    )

    log_audit(db, "REOPEN_FAULT", "FaultReport", str(fault.id), current_user, f"Reopened fault {fault.report_number}")
    return _format_fault_response(fault)

# --- Recommend Replacement ---
@router.post("/repairs/{repair_id}/recommend-replacement", response_model=FaultReportResponse)
def recommend_replacement(
    repair_id: int,
    payload: FaultRejectRequest,  # uses rejection_reason as reason
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.TECHNICIAN, UserRole.ADMIN, UserRole.LAB_INSTRUCTOR]))
):
    repair = db.query(RepairJob).filter(RepairJob.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair job not found")

    fault = repair.fault_report
    prev_status = fault.status.value

    reason = payload.rejection_reason.strip()
    if len(reason) < 5:
        raise HTTPException(status_code=400, detail="A detailed justification is required for replacement recommendation.")

    repair.replacement_recommended = True
    repair.unable_to_repair_reason = reason
    repair.status = FaultStatus.REPLACEMENT_RECOMMENDED
    fault.status = FaultStatus.REPLACEMENT_RECOMMENDED

    if fault.asset:
        fault.asset.status = AssetStatus.REPLACEMENT_REQUESTED

    _log_status_transition(
        db, fault, current_user,
        action="Replacement Recommended",
        prev_status=prev_status,
        new_status=FaultStatus.REPLACEMENT_RECOMMENDED.value,
        reason=reason
    )
    db.commit()
    db.refresh(fault)

    create_notification(
        db,
        title="Equipment Replacement Recommended",
        message=f"Replacement recommended for {fault.asset.name if fault.asset else 'item'} (Ticket {fault.report_number}): {reason}",
        role=UserRole.ADMIN,
        link="/faults"
    )

    log_audit(db, "RECOMMEND_REPLACEMENT", "RepairJob", str(repair.id), current_user, f"Recommended replacement for {fault.report_number}")
    return _format_fault_response(fault)

# --- Secure File Upload for Photos / Attachments ---
@router.post("/upload-attachment")
async def upload_fault_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Safely validates and stores an uploaded fault photo or PDF report."""
    filename = file.filename or "attachment"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}"
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)} MB"
        )

    upload_folder = os.path.join(settings.UPLOAD_DIR, "faults")
    os.makedirs(upload_folder, exist_ok=True)

    safe_filename = f"flt_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(upload_folder, safe_filename)

    # Prevent path traversal
    normalized_dest = os.path.normpath(dest_path)
    if not normalized_dest.startswith(os.path.normpath(upload_folder)):
        raise HTTPException(status_code=400, detail="Invalid destination path")

    with open(dest_path, "wb") as f:
        f.write(contents)

    return {
        "filename": safe_filename,
        "url": f"/api/faults/attachments/{safe_filename}",
        "size": len(contents)
    }

@router.get("/attachments/{filename}")
def get_fault_attachment(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Securely serves uploaded fault attachments."""
    clean_filename = os.path.basename(filename)
    upload_folder = os.path.join(settings.UPLOAD_DIR, "faults")
    file_path = os.path.join(upload_folder, clean_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Attachment file not found")

    return FileResponse(file_path)

# --- CSV Export ---
@router.get("/export-csv")
def export_faults_csv(
    lab_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[FaultPriority] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FaultReport)

    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(FaultReport.lab_id.in_(assigned_ids))
    elif lab_id:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized for this laboratory")
        query = query.filter(FaultReport.lab_id == lab_id)

    if status:
        query = query.filter(FaultReport.status == status)
    if priority:
        query = query.filter(FaultReport.priority == priority)

    reports = query.order_by(desc(FaultReport.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Ticket Number", "Title", "Lab", "Asset ID", "Equipment Name", "Category",
        "Priority", "Status", "Safety Hazard", "Reported By", "Reported Date",
        "Technician", "Repair Cost (INR)", "Verification Status"
    ])

    for r in reports:
        writer.writerow([
            r.report_number,
            r.title or "",
            r.laboratory.name if r.laboratory else f"Lab {r.lab_id}",
            r.asset.asset_id if r.asset else "",
            r.asset.name if r.asset else (r.bulk_item.name if r.bulk_item else "General"),
            r.fault_category,
            r.priority.value,
            r.status.value,
            "YES - DANGER" if r.is_safety_hazard else "No",
            r.reported_by.full_name if r.reported_by else "Staff",
            r.created_at.strftime("%Y-%m-%d %H:%M"),
            r.repair_job.technician.full_name if (r.repair_job and r.repair_job.technician) else "Unassigned",
            f"{r.repair_job.repair_cost:.2f}" if (r.repair_job and r.repair_job.repair_cost) else "0.00",
            "Verified & Closed" if (r.repair_job and r.repair_job.is_verified) else r.status.value
        ])

    output.seek(0)
    filename = f"SMVITM_Fault_Reports_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
