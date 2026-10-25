"""
Phase 6 Security Audit and End-to-End Integration Tests
Validates Brute-Force Rate Limiting, Security Headers, File Upload Path Traversal Guards,
RBAC Enforcement Matrix, Anti-Self-Approval, and Admin Provisioning.
"""
import pytest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.models.models import (
    User, UserRole, Laboratory, Asset, BulkInventory,
    TransferRequest, PurchaseRequest, PurchaseStatus, TransferStatus
)
from app.core.security import create_access_token, verify_password
from app.core.database import SessionLocal
from app.api.auth import FAILED_LOGIN_ATTEMPTS
from scripts.create_admin import provision_admin, validate_password_strength

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture(scope="module")
def admin_token(db_session):
    admin = db_session.query(User).filter(User.role == UserRole.ADMIN).first()
    return create_access_token(data={"sub": admin.email, "role": admin.role.value, "user_id": admin.id})

@pytest.fixture(scope="module")
def instructor_token(db_session):
    instructor = db_session.query(User).filter(User.role == UserRole.LAB_INSTRUCTOR).first()
    return create_access_token(data={"sub": instructor.email, "role": instructor.role.value, "user_id": instructor.id})

@pytest.fixture(scope="module")
def technician_token(db_session):
    tech = db_session.query(User).filter(User.role == UserRole.TECHNICIAN).first()
    return create_access_token(data={"sub": tech.email, "role": tech.role.value, "user_id": tech.id})

# =============================================================================
# 1. AUTHENTICATION & RATE LIMITING
# =============================================================================

def test_login_brute_force_rate_limiting():
    # Clear any previous failures for clean test
    FAILED_LOGIN_ATTEMPTS.clear()

    # Perform 5 failed login attempts
    for _ in range(5):
        res = client.post(
            "/api/auth/login",
            data={"username": "attacker@example.com", "password": "WrongPassword123"}
        )
        assert res.status_code == 401
        assert "Incorrect email or password" in res.json()["detail"]

    # 6th attempt must be blocked by rate limiter with 429
    res_blocked = client.post(
        "/api/auth/login",
        data={"username": "attacker@example.com", "password": "WrongPassword123"}
    )
    assert res_blocked.status_code == 429
    assert "Too many failed login attempts" in res_blocked.json()["detail"]

    # Cleanup after test
    FAILED_LOGIN_ATTEMPTS.clear()

# =============================================================================
# 2. SECURITY HEADERS
# =============================================================================

def test_security_headers_present():
    response = client.get("/api/health")
    assert response.status_code == 200
    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"

# =============================================================================
# 3. FILE UPLOAD SECURITY RESTRICTIONS
# =============================================================================

def test_fault_attachment_extension_whitelist(instructor_token):
    # Attempt to upload malicious .exe executable
    malicious_file = io.BytesIO(b"MZ executable header dummy")
    response = client.post(
        "/api/faults/upload-attachment",
        headers={"Authorization": f"Bearer {instructor_token}"},
        files={"file": ("exploit.exe", malicious_file, "application/x-msdownload")}
    )
    assert response.status_code == 400
    assert "Unsupported file type '.exe'" in response.json()["detail"]

def test_fault_attachment_size_limit(instructor_token):
    # Attempt to upload 6MB file (limit is 5MB)
    large_payload = io.BytesIO(b"0" * (6 * 1024 * 1024))
    response = client.post(
        "/api/faults/upload-attachment",
        headers={"Authorization": f"Bearer {instructor_token}"},
        files={"file": ("huge_photo.jpg", large_payload, "image/jpeg")}
    )
    assert response.status_code == 400
    assert "exceeds maximum allowed size" in response.json()["detail"]

def test_quotation_upload_and_path_traversal_guard(instructor_token):
    # Valid PDF quotation upload
    valid_pdf = io.BytesIO(b"%PDF-1.4 test quotation dummy content")
    response = client.post(
        "/api/requests/upload-quotation",
        headers={"Authorization": f"Bearer {instructor_token}"},
        files={"file": ("vendor_quotation.pdf", valid_pdf, "application/pdf")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "attachment_url" in data
    assert "quotation_" in data["filename"]

    # Verify path traversal in file download is safely rejected
    res_traversal = client.get(
        "/api/requests/quotations/../../etc/passwd",
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    # Either 400 (path traversal guard) or 404 (not found)
    assert res_traversal.status_code in [400, 404]

# =============================================================================
# 4. ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT MATRIX
# =============================================================================

def test_technician_rbac_restrictions(technician_token):
    # Technician cannot list user admin accounts
    res_users = client.get("/api/users", headers={"Authorization": f"Bearer {technician_token}"})
    assert res_users.status_code == 403

    # Technician cannot approve purchase requests
    res_po = client.post(
        "/api/requests/1/approve",
        headers={"Authorization": f"Bearer {technician_token}"},
        json={"action": "APPROVED", "comments": "Unauthorized"}
    )
    assert res_po.status_code == 403

    # Technician cannot initiate transfer requests
    res_transfer = client.post(
        "/api/transfers",
        headers={"Authorization": f"Bearer {technician_token}"},
        json={
            "source_lab_id": 1,
            "destination_lab_id": 2,
            "item_type": "Asset",
            "asset_id": 1,
            "quantity": 1,
            "reason": "Unauthorized"
        }
    )
    assert res_transfer.status_code == 403

def test_instructor_rbac_restrictions(instructor_token):
    # Instructor cannot access user admin management
    res = client.get("/api/users", headers={"Authorization": f"Bearer {instructor_token}"})
    assert res.status_code == 403

    # Instructor cannot create laboratories
    res_lab = client.post(
        "/api/labs",
        headers={"Authorization": f"Bearer {instructor_token}"},
        json={"name": "Illegal Lab", "code": "ILLEGAL-01", "room_number": "101"}
    )
    assert res_lab.status_code == 403

# =============================================================================
# 5. ADMIN PROVISIONING SCRIPT INTEGRITY
# =============================================================================

def test_admin_provisioning_script_logic(db_session):
    # Test password strength validator
    assert validate_password_strength("weak") is False
    assert validate_password_strength("12345678") is False
    assert validate_password_strength("NoDigitsHere") is False
    assert validate_password_strength("ValidPassword123!") is True

    # Test programmatic admin provisioning
    test_admin_email = "test.provisioned.admin@smvitm.edu"
    success = provision_admin(test_admin_email, "Test Provisioned Admin", "SuperSecurePassword99!", force_update=True)
    assert success is True

    # Verify user was created in DB with ADMIN role and hashed password
    user = db_session.query(User).filter(User.email == test_admin_email).first()
    assert user is not None
    assert user.role == UserRole.ADMIN
    assert verify_password("SuperSecurePassword99!", user.hashed_password) is True

    # Clean up test user
    db_session.delete(user)
    db_session.commit()

# =============================================================================
# 6. COLLEGE-BRANDED LOGIN EMAIL NOTIFICATION TESTS
# =============================================================================

from unittest.mock import patch
from app.services.email_service import (
    build_login_email_html,
    build_login_email_text,
    get_ist_time_str,
    get_logo_bytes,
    send_login_notification_email
)

def test_login_email_template_rendering():
    full_name = "Dr. Radhakrishna Rao"
    email = "hod.aids@sode-edu.in"
    role = "Department Head"
    login_time = get_ist_time_str()
    ip_address = "192.168.1.100"

    html = build_login_email_html(full_name, email, role, login_time, ip_address)
    text = build_login_email_text(full_name, email, role, login_time, ip_address)

    # Validate institutional branding in HTML
    assert "Shri Madhwa Vadiraja Institute of Technology and Management" in html
    assert "Department of Artificial Intelligence and Data Science" in html
    assert "Inventory Management System" in html
    assert "cid:smvitm_logo" in html
    assert full_name in html
    assert email in html
    assert role in html
    assert ip_address in html
    assert "IST" in html or "UTC+05:30" in html
    assert "Security Notice" in html

    # Validate institutional branding in plain-text fallback
    assert "Shri Madhwa Vadiraja Institute of Technology and Management" in text
    assert "Department of Artificial Intelligence and Data Science" in text
    assert full_name in text
    assert email in text
    assert "Security notice" in text

def test_logo_asset_readable():
    # Verify that the local SMVITM logo exists and can be loaded
    logo = get_logo_bytes()
    assert logo is not None
    assert len(logo) > 1000

def test_login_notification_email_skipped_when_smtp_disabled():
    # By default in test/dev, SMTP_ENABLED is False or unconfigured
    # Function should safely return False without raising any exception
    with patch("app.services.email_service.settings.SMTP_ENABLED", False):
        result = send_login_notification_email(
            full_name="Lab Instructor",
            email="instructor@sode-edu.in",
            role="LAB_INSTRUCTOR",
            ip_address="127.0.0.1"
        )
        assert result is False

def test_successful_login_enqueues_email_notification():
    with patch("app.api.auth.send_login_notification_email") as mock_email:
        # Perform valid login with admin credentials
        response = client.post(
            "/api/auth/login",
            data={"username": "admin@sode-edu.in", "password": "Admin@123"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

        # Because TestClient runs background tasks before returning,
        # mock_email should have been called once
        mock_email.assert_called_once()
        args, kwargs = mock_email.call_args
        # kwargs or positional args should match user details
        assert "admin@sode-edu.in" in args or kwargs.get("email") == "admin@sode-edu.in"

def test_failed_login_never_dispatches_email():
    with patch("app.api.auth.send_login_notification_email") as mock_email:
        response = client.post(
            "/api/auth/login",
            data={"username": "admin@sode-edu.in", "password": "DefinitelyWrongPassword"}
        )
        assert response.status_code == 401
        # Email notification must never be dispatched on failed attempt
        mock_email.assert_not_called()
