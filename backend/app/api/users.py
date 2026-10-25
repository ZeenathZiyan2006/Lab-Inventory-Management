from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.permissions import require_roles, get_current_user
from app.models.models import User, UserRole, Laboratory
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate
from app.services.audit_service import log_audit

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HOD]))
):
    users = db.query(User).all()
    results = []
    for u in users:
        results.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "department_id": u.department_id,
            "phone_number": u.phone_number,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "assigned_labs": [lab.id for lab in u.assigned_labs]
        })
    return results

@router.post("", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    existing = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed_pw = get_password_hash(payload.password)
    new_user = User(
        email=payload.email.strip().lower(),
        full_name=payload.full_name,
        hashed_password=hashed_pw,
        role=payload.role,
        department_id=payload.department_id,
        phone_number=payload.phone_number,
        is_active=True
    )

    if payload.assigned_lab_ids:
        labs = db.query(Laboratory).filter(Laboratory.id.in_(payload.assigned_lab_ids)).all()
        new_user.assigned_labs = labs

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(db, "CREATE_USER", "User", str(new_user.id), current_user, f"Created {new_user.email} with role {new_user.role.value}")

    return {
        "id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": new_user.role,
        "department_id": new_user.department_id,
        "phone_number": new_user.phone_number,
        "is_active": new_user.is_active,
        "created_at": new_user.created_at,
        "assigned_labs": [lab.id for lab in new_user.assigned_labs]
    }

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None and payload.full_name.strip():
        target_user.full_name = payload.full_name.strip()
    if payload.role is not None:
        target_user.role = payload.role
    if payload.phone_number is not None:
        target_user.phone_number = payload.phone_number.strip()
    if payload.is_active is not None:
        target_user.is_active = payload.is_active
    if payload.assigned_lab_ids is not None:
        labs = db.query(Laboratory).filter(Laboratory.id.in_(payload.assigned_lab_ids)).all()
        target_user.assigned_labs = labs

    db.commit()
    db.refresh(target_user)

    log_audit(db, "UPDATE_USER", "User", str(target_user.id), current_user, f"Updated user profile for {target_user.email}")

    return {
        "id": target_user.id,
        "email": target_user.email,
        "full_name": target_user.full_name,
        "role": target_user.role,
        "department_id": target_user.department_id,
        "phone_number": target_user.phone_number,
        "is_active": target_user.is_active,
        "created_at": target_user.created_at,
        "assigned_labs": [lab.id for lab in target_user.assigned_labs]
    }
