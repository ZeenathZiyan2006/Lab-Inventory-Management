from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.permissions import get_current_user, require_roles
from app.models.models import Laboratory, Department, User, UserRole, Asset, BulkInventory, FaultReport, FaultStatus, AssetStatus
from app.schemas.schemas import LaboratoryCreate, LaboratoryUpdate, LaboratoryResponse, DepartmentResponse
from app.services.qr_service import generate_qr_base64
from app.services.audit_service import log_audit
from app.api.qr import get_frontend_base_url

router = APIRouter(prefix="/labs", tags=["Laboratories"])

def _format_lab_response(lab: Laboratory, db: Session) -> dict:
    active_equipment_count = db.query(Asset).filter(
        Asset.lab_id == lab.id,
        Asset.is_active == True,
        Asset.status != AssetStatus.RETIRED
    ).count()

    open_fault_count = db.query(FaultReport).filter(
        FaultReport.lab_id == lab.id,
        FaultReport.status.notin_([FaultStatus.RESOLVED, FaultStatus.CLOSED])
    ).count()

    bulk_count = db.query(BulkInventory).filter(BulkInventory.lab_id == lab.id).count()

    instructors = [u for u in lab.assigned_users if u.is_active]

    return {
        "id": lab.id,
        "name": lab.name,
        "code": lab.code,
        "department_id": lab.department_id,
        "department_name": lab.department.name if lab.department else "Artificial Intelligence and Data Science",
        "room_number": lab.room_number,
        "description": lab.description,
        "qr_code": lab.qr_code,
        "is_active": lab.is_active,
        "created_at": lab.created_at,
        "assigned_instructor_names": [u.full_name for u in instructors],
        "assigned_instructor_ids": [u.id for u in instructors],
        "active_equipment_count": active_equipment_count,
        "open_fault_count": open_fault_count,
        "bulk_items_count": bulk_count
    }

@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.get("", response_model=List[LaboratoryResponse])
def get_laboratories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role in [UserRole.ADMIN, UserRole.HOD, UserRole.PRINCIPAL, UserRole.TECHNICIAN]:
        labs = db.query(Laboratory).filter(Laboratory.is_active == True).all()
    else:
        labs = [l for l in current_user.assigned_labs if l.is_active]

    return [_format_lab_response(lab, db) for lab in labs]

@router.get("/{lab_id}", response_model=LaboratoryResponse)
def get_laboratory(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id, Laboratory.is_active == True).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")

    if current_user.role == UserRole.LAB_INSTRUCTOR and lab not in current_user.assigned_labs:
        raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this laboratory")

    return _format_lab_response(lab, db)

@router.post("", response_model=LaboratoryResponse)
def create_laboratory(
    payload: LaboratoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    existing = db.query(Laboratory).filter(Laboratory.code == payload.code.upper().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Laboratory code already registered")

    qr_token = f"LAB-{payload.code.upper().strip()}"
    new_lab = Laboratory(
        name=payload.name,
        code=payload.code.upper().strip(),
        department_id=payload.department_id,
        room_number=payload.room_number,
        description=payload.description,
        qr_code=qr_token,
        is_active=True
    )

    if payload.assigned_instructor_ids:
        instructors = db.query(User).filter(User.id.in_(payload.assigned_instructor_ids)).all()
        new_lab.assigned_users = instructors

    db.add(new_lab)
    db.commit()
    db.refresh(new_lab)

    log_audit(db, "CREATE_LAB", "Laboratory", str(new_lab.id), current_user, f"Created {new_lab.name} ({new_lab.code})")
    return _format_lab_response(new_lab, db)

@router.put("/{lab_id}", response_model=LaboratoryResponse)
def update_laboratory(
    lab_id: int,
    payload: LaboratoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")

    if payload.name is not None:
        lab.name = payload.name
    if payload.code is not None:
        clean_code = payload.code.upper().strip()
        if clean_code != lab.code:
            existing = db.query(Laboratory).filter(Laboratory.code == clean_code, Laboratory.id != lab_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Laboratory code already registered")
            lab.code = clean_code
            lab.qr_code = f"LAB-{clean_code}"
    if payload.room_number is not None:
        lab.room_number = payload.room_number
    if payload.description is not None:
        lab.description = payload.description

    if payload.assigned_instructor_ids is not None:
        instructors = db.query(User).filter(User.id.in_(payload.assigned_instructor_ids)).all()
        lab.assigned_users = instructors

    db.commit()
    db.refresh(lab)

    log_audit(db, "UPDATE_LAB", "Laboratory", str(lab.id), current_user, f"Updated {lab.name} ({lab.code})")
    return _format_lab_response(lab, db)

@router.get("/{lab_id}/qr")
def get_lab_qr(
    lab_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")
    
    web_url = f"{get_frontend_base_url(request)}/?scan={lab.code}"
    qr_image = generate_qr_base64(web_url)
    return {
        "lab_id": lab.id,
        "name": lab.name,
        "code": lab.code,
        "qr_code_token": lab.qr_code,
        "web_url": web_url,
        "qr_image_base64": qr_image
    }

@router.get("/{lab_id}/label")
def get_lab_door_label(
    lab_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates printable door placard metadata and QR token encoding a direct browser URL."""
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")

    web_url = f"{get_frontend_base_url(request)}/?scan={lab.code}"
    qr_image = generate_qr_base64(web_url)
    return {
        "institution": "Shri Madhwa Vadiraja Institute of Technology & Management (SMVITM)",
        "department": lab.department.name if lab.department else "Department of Artificial Intelligence & Data Science",
        "lab_name": lab.name,
        "room_number": lab.room_number,
        "code": lab.code,
        "qr_code_token": f"SMVITM_LAB:{lab.qr_code}",
        "web_url": web_url,
        "qr_image_base64": qr_image,
        "instructors": [u.full_name for u in lab.assigned_users if u.is_active]
    }
