from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.permissions import get_current_user
from app.models.models import User, UserRole, Laboratory
from app.schemas.schemas import Token, UserResponse, UserProfileUpdate, UserRegister
from app.services.audit_service import log_audit
from app.services.email_service import send_login_notification_email

from collections import defaultdict
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])

FAILED_LOGIN_ATTEMPTS = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 60

@router.post("/login", response_model=Token)
def login(
    request: Request,
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = datetime.utcnow()
    
    # Filter attempts within lockout window
    recent_failures = [t for t in FAILED_LOGIN_ATTEMPTS[client_ip] if now - t < timedelta(seconds=LOCKOUT_WINDOW_SECONDS)]
    FAILED_LOGIN_ATTEMPTS[client_ip] = recent_failures

    if len(recent_failures) >= MAX_LOGIN_ATTEMPTS:
        log_audit(db, "LOGIN_RATE_LIMITED", "User", details=f"Rate limit exceeded for IP {client_ip}", ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 60 seconds before trying again."
        )

    user = db.query(User).filter(User.email == form_data.username.strip().lower()).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        FAILED_LOGIN_ATTEMPTS[client_ip].append(now)
        log_audit(db, "LOGIN_FAILED", "User", details=f"Failed attempt for email {form_data.username}", ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")

    # Clear failed attempts on successful login
    FAILED_LOGIN_ATTEMPTS.pop(client_ip, None)

    access_token = create_access_token(data={"sub": user.email, "role": user.role.value})
    assigned_lab_ids = [lab.id for lab in user.assigned_labs]

    log_audit(db, "LOGIN_SUCCESS", "User", str(user.id), user, details="Signed in successfully", ip_address=client_ip)

    # Enqueue college-branded successful-login notification email in the background
    background_tasks.add_task(
        send_login_notification_email,
        full_name=user.full_name,
        email=user.email,
        role=user.role.value,
        ip_address=client_ip
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": user.id,
        "role": user.role,
        "email": user.email,
        "full_name": user.full_name,
        "department_id": user.department_id,
        "assigned_labs": assigned_lab_ids
    }

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    request: Request,
    payload: UserRegister,
    db: Session = Depends(get_db)
):
    """
    Public Registration Endpoint:
    - Allows users to enter their genuine Full Name, institutional email, and password.
    - Validates confirm_password match.
    - Enforces uniqueness on email.
    - Assigns safe default role (LAB_INSTRUCTOR or TECHNICIAN if explicitly chosen, never ADMIN/PRINCIPAL/HOD).
    - Returns authentication token with the newly created user's actual database record.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )

    clean_email = payload.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this institutional email already exists."
        )

    # Safe role assignment: default to LAB_INSTRUCTOR. If user picks TECHNICIAN, allow it.
    # Privileged roles (ADMIN, HOD, PRINCIPAL) can only be granted by an existing administrator.
    assigned_role = UserRole.LAB_INSTRUCTOR
    if payload.role in [UserRole.LAB_INSTRUCTOR, UserRole.TECHNICIAN]:
        assigned_role = payload.role

    hashed_pw = get_password_hash(payload.password)
    new_user = User(
        email=clean_email,
        full_name=payload.full_name.strip(),
        hashed_password=hashed_pw,
        role=assigned_role,
        department_id=1,
        is_active=True
    )

    # Automatically grant default academic laboratory assignments to newly registered Lab Instructors
    # so they can immediately manage laboratory inventory without empty dropdown blockers
    if assigned_role == UserRole.LAB_INSTRUCTOR:
        default_labs = db.query(Laboratory).filter(Laboratory.is_active == True).all()
        new_user.assigned_labs = default_labs

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(
        db,
        "USER_REGISTERED",
        "User",
        str(new_user.id),
        new_user,
        details=f"User {new_user.full_name} ({new_user.email}) registered with role {new_user.role.value}",
        ip_address=client_ip
    )

    access_token = create_access_token(data={"sub": new_user.email, "role": new_user.role.value})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": new_user.id,
        "role": new_user.role,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "department_id": new_user.department_id,
        "assigned_labs": [lab.id for lab in new_user.assigned_labs]
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "department_id": current_user.department_id,
        "phone_number": current_user.phone_number,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "assigned_labs": [lab.id for lab in current_user.assigned_labs]
    }

@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allows an authenticated user to update their genuine full name or phone number in database."""
    if payload.full_name and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number.strip()
    
    db.commit()
    db.refresh(current_user)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "department_id": current_user.department_id,
        "phone_number": current_user.phone_number,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "assigned_labs": [lab.id for lab in current_user.assigned_labs]
    }
