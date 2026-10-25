import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.seed.demo_data import seed_database

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database(reset=True)

@pytest.fixture
def client():
    return TestClient(app)

def test_authenticated_user_name_source_of_truth(client):
    """
    Verify that login returns the actual database full_name for different users.
    No fixed or hardcoded name is used across accounts.
    """
    # 1. Login as Instructor
    res_instructor = client.post(
        "/api/auth/login",
        data={"username": "instructor@sode-edu.in", "password": "Instructor@123"}
    )
    assert res_instructor.status_code == 200
    data_instructor = res_instructor.json()
    assert data_instructor["full_name"] == "Dr. Smitha Rao"
    assert data_instructor["role"] == "LAB_INSTRUCTOR"
    assert "id" in data_instructor and data_instructor["id"] > 0

    # 2. Login as Admin
    res_admin = client.post(
        "/api/auth/login",
        data={"username": "admin@sode-edu.in", "password": "Admin@123"}
    )
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["full_name"] == "Prof. Rajesh K"
    assert data_admin["role"] == "ADMIN"
    assert data_admin["id"] != data_instructor["id"]

    # 3. Login as Technician
    res_tech = client.post(
        "/api/auth/login",
        data={"username": "technician@sode-edu.in", "password": "Tech@123"}
    )
    assert res_tech.status_code == 200
    data_tech = res_tech.json()
    assert data_tech["full_name"] == "Mr. Suresh Poojary"
    assert data_tech["role"] == "TECHNICIAN"

    # 4. Login as HOD
    res_hod = client.post(
        "/api/auth/login",
        data={"username": "hod.aids@sode-edu.in", "password": "Hod@123"}
    )
    assert res_hod.status_code == 200
    data_hod = res_hod.json()
    assert data_hod["full_name"] == "Dr. Vasudeva"
    assert data_hod["role"] == "HOD"

    # 5. Login as Principal
    res_principal = client.post(
        "/api/auth/login",
        data={"username": "principal@sode-edu.in", "password": "Principal@123"}
    )
    assert res_principal.status_code == 200
    data_principal = res_principal.json()
    assert data_principal["full_name"] == "Dr. Thirumaleshwara Bhat"
    assert data_principal["role"] == "PRINCIPAL"

def test_create_new_user_and_verify_dynamic_name(client):
    """
    Test creating a brand new user (e.g. Ananya Shetty) and verify
    that upon login and /api/auth/me, the exact name is returned.
    """
    # Login as admin to create a new user
    login_admin = client.post(
        "/api/auth/login",
        data={"username": "admin@sode-edu.in", "password": "Admin@123"}
    )
    admin_token = login_admin.json()["access_token"]

    # Create new user: Ananya Shetty
    new_user_payload = {
        "email": "ananya@college.edu",
        "full_name": "Ananya Shetty",
        "password": "Password@123",
        "role": "LAB_INSTRUCTOR",
        "department_id": 1,
        "phone_number": "+91 9876543210",
        "assigned_lab_ids": [1]
    }
    create_res = client.post(
        "/api/users",
        json=new_user_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_res.status_code in (200, 201)
    created_user = create_res.json()
    assert created_user["full_name"] == "Ananya Shetty"

    # Now login as Ananya Shetty
    login_ananya = client.post(
        "/api/auth/login",
        data={"username": "ananya@college.edu", "password": "Password@123"}
    )
    assert login_ananya.status_code == 200
    ananya_data = login_ananya.json()
    assert ananya_data["full_name"] == "Ananya Shetty"
    assert ananya_data["email"] == "ananya@college.edu"

    # Verify GET /api/auth/me returns Ananya Shetty
    ananya_token = ananya_data["access_token"]
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {ananya_token}"}
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["full_name"] == "Ananya Shetty"
    assert me_data["email"] == "ananya@college.edu"

def test_profile_update_changes_display_name_dynamically(client):
    """
    Test that updating full_name via PUT /api/auth/me persists
    in the database and is immediately reflected in /api/auth/me.
    """
    # Login as Ananya Shetty
    login_res = client.post(
        "/api/auth/login",
        data={"username": "ananya@college.edu", "password": "Password@123"}
    )
    token = login_res.json()["access_token"]

    # Update name to Dr. Ananya Shetty Rao
    update_res = client.put(
        "/api/auth/me",
        json={"full_name": "Dr. Ananya Shetty Rao", "phone_number": "+91 9999988888"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert update_res.status_code == 200
    updated_profile = update_res.json()
    assert updated_profile["full_name"] == "Dr. Ananya Shetty Rao"

    # Re-fetch profile to ensure database persistence
    re_fetch = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert re_fetch.status_code == 200
    assert re_fetch.json()["full_name"] == "Dr. Ananya Shetty Rao"

def test_admin_cannot_be_escalated_by_client_name(client):
    """
    Ensure role cannot be altered by simple profile update.
    Role remains governed strictly by backend authorization.
    """
    login_res = client.post(
        "/api/auth/login",
        data={"username": "ananya@college.edu", "password": "Password@123"}
    )
    token = login_res.json()["access_token"]

    # Even if client sends role in profile update, UserProfileUpdate schema only accepts full_name and phone_number
    client.put(
        "/api/auth/me",
        json={"full_name": "Hacked Admin", "role": "ADMIN"},
        headers={"Authorization": f"Bearer {token}"}
    )

    # Check profile
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.json()["role"] == "LAB_INSTRUCTOR"

def test_name_validation_logic_and_matching(client):
    """
    Test the name matching and validation rules:
    - Empty name / spaces only
    - Valid credentials with exact match
    - Valid credentials with case-insensitive and trimmed match
    - Valid credentials with mismatch
    - Incorrect password
    - Multi-user isolation
    """
    def simulate_login(entered_name: str, email: str, password: str):
        trimmed_name = entered_name.strip()
        if not trimmed_name:
            return {"success": False, "error": "Please enter your full name."}

        # Perform backend authentication
        res = client.post(
            "/api/auth/login",
            data={"username": email, "password": password}
        )
        if res.status_code != 200:
            return {"success": False, "error": "Incorrect email or password"}

        data = res.json()
        registered_name = (data.get("full_name") or "").strip().lower()
        if registered_name and trimmed_name.lower() != registered_name:
            return {"success": False, "error": "The entered full name does not match this account."}

        return {"success": True, "data": data}

    # Case 1: Empty name -> login blocked
    r1 = simulate_login("", "instructor@sode-edu.in", "Instructor@123")
    assert not r1["success"]
    assert r1["error"] == "Please enter your full name."

    # Case 2: Spaces only -> login blocked
    r2 = simulate_login("     ", "instructor@sode-edu.in", "Instructor@123")
    assert not r2["success"]
    assert r2["error"] == "Please enter your full name."

    # Case 3: Correct name & valid credentials -> login succeeds
    r3 = simulate_login("Dr. Smitha Rao", "instructor@sode-edu.in", "Instructor@123")
    assert r3["success"]
    assert r3["data"]["full_name"] == "Dr. Smitha Rao"

    # Case 3b: Case-insensitive & trimmed whitespace -> login succeeds
    r3b = simulate_login("   dr. smitha rao   ", "instructor@sode-edu.in", "Instructor@123")
    assert r3b["success"]
    assert r3b["data"]["full_name"] == "Dr. Smitha Rao"

    # Case 4: Incorrect name & valid credentials -> login denied
    r4 = simulate_login("Dr. Wrong Person", "instructor@sode-edu.in", "Instructor@123")
    assert not r4["success"]
    assert r4["error"] == "The entered full name does not match this account."

    # Case 5: Correct name but incorrect password -> login denied
    r5 = simulate_login("Dr. Smitha Rao", "instructor@sode-edu.in", "WrongPassword@123")
    assert not r5["success"]
    assert r5["error"] == "Incorrect email or password"

    # Case 6: Different registered users see their own database name
    r6_admin = simulate_login("Prof. Rajesh K", "admin@sode-edu.in", "Admin@123")
    assert r6_admin["success"]
    assert r6_admin["data"]["full_name"] == "Prof. Rajesh K"

    r6_tech = simulate_login("Mr. Suresh Poojary", "technician@sode-edu.in", "Tech@123")
    assert r6_tech["success"]
    assert r6_tech["data"]["full_name"] == "Mr. Suresh Poojary"

    # Case 7: Refresh simulation via GET /api/auth/me returns the authoritative database name
    token = r6_admin["data"]["access_token"]
    refresh_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert refresh_res.status_code == 200
    assert refresh_res.json()["full_name"] == "Prof. Rajesh K"

def test_deactivated_account_cannot_login(client):
    """
    Test requirement 5: Inactive accounts cannot log in.
    """
    # Login as admin
    login_admin = client.post(
        "/api/auth/login",
        data={"username": "admin@sode-edu.in", "password": "Admin@123"}
    )
    admin_token = login_admin.json()["access_token"]

    # Create user to deactivate
    create_res = client.post(
        "/api/users",
        json={
            "email": "temp.staff@sode-edu.in",
            "full_name": "Temporary Staff",
            "password": "TempPassword@123",
            "role": "LAB_INSTRUCTOR",
            "department_id": 1,
            "assigned_lab_ids": [1]
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_res.status_code in (200, 201)
    user_id = create_res.json()["id"]

    # Verify user can log in when active
    login_active = client.post(
        "/api/auth/login",
        data={"username": "temp.staff@sode-edu.in", "password": "TempPassword@123"}
    )
    assert login_active.status_code == 200

    # Deactivate the account via PUT /api/users/{id}
    deact_res = client.put(
        f"/api/users/{user_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # Attempt to log in with deactivated account -> Must be rejected (403 Forbidden)
    login_deactivated = client.post(
        "/api/auth/login",
        data={"username": "temp.staff@sode-edu.in", "password": "TempPassword@123"}
    )
    assert login_deactivated.status_code == 403
    assert "deactivated" in login_deactivated.json()["detail"].lower()

def test_admin_updates_staff_name_and_role_and_audit_preserved(client):
    """
    Test requirements 7, 8, 9:
    - Administrator updates staff name and role (e.g. Tejaswini H. promoted to HOD).
    - Unauthorized user cannot promote themselves.
    - Changing personnel retains historical audit records.
    """
    # 1. Login as admin
    login_admin = client.post(
        "/api/auth/login",
        data={"username": "admin@sode-edu.in", "password": "Admin@123"}
    )
    admin_token = login_admin.json()["access_token"]

    # 2. Create staff: Tejaswini H. as LAB_INSTRUCTOR
    create_res = client.post(
        "/api/users",
        json={
            "email": "tejaswini.h@sode-edu.in",
            "full_name": "Tejaswini H.",
            "password": "Password@123",
            "role": "LAB_INSTRUCTOR",
            "department_id": 1,
            "assigned_lab_ids": [1]
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_res.status_code in (200, 201)
    staff_id = create_res.json()["id"]

    # 3. Staff logs in as LAB_INSTRUCTOR
    login_staff = client.post(
        "/api/auth/login",
        data={"username": "tejaswini.h@sode-edu.in", "password": "Password@123"}
    )
    assert login_staff.status_code == 200
    staff_token = login_staff.json()["access_token"]
    assert login_staff.json()["role"] == "LAB_INSTRUCTOR"

    # 4. Unauthorized staff attempts to promote themselves to HOD or ADMIN via PUT /api/users/{id} -> 403 Forbidden
    self_promote_res = client.put(
        f"/api/users/{staff_id}",
        json={"role": "HOD"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert self_promote_res.status_code == 403

    # 5. Authorized Admin updates staff role to HOD and updates name (e.g. Dr. Tejaswini H.)
    admin_update_res = client.put(
        f"/api/users/{staff_id}",
        json={"full_name": "Dr. Tejaswini H.", "role": "HOD"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_update_res.status_code == 200
    assert admin_update_res.json()["full_name"] == "Dr. Tejaswini H."
    assert admin_update_res.json()["role"] == "HOD"

    # 6. Staff logs in again: sees new role HOD and new name Dr. Tejaswini H.
    login_staff_updated = client.post(
        "/api/auth/login",
        data={"username": "tejaswini.h@sode-edu.in", "password": "Password@123"}
    )
    assert login_staff_updated.status_code == 200
    assert login_staff_updated.json()["full_name"] == "Dr. Tejaswini H."
    assert login_staff_updated.json()["role"] == "HOD"

    # 7. Audit records for user creation and update are preserved and not deleted
    audit_res = client.get(
        "/api/audit",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert audit_res.status_code == 200
    audit_logs = audit_res.json()
    # Check that audit log for CREATE_USER and UPDATE_USER exists with target entity User
    entity_user_audits = [log for log in audit_logs if log.get("entity_type") == "User"]
    assert len(entity_user_audits) > 0

def test_public_registration_and_login_flow(client):
    """
    Test Complete Registration and Login Flow:
    1. Reject empty full name or whitespace-only name
    2. Reject password mismatch
    3. Successfully register custom staff member (e.g. Thrisha K. Puthran)
    4. Verify database persistence and session token
    5. Reject duplicate email registration
    6. Verify login with registered credentials returns exact registered name
    7. Verify GET /api/auth/me returns the authoritative registered name across refreshes
    8. Verify second user has distinct isolated identity
    """
    # 1. Reject empty full name
    bad_name_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "   ",
            "email": "thrisha@sode-edu.in",
            "password": "Password@123",
            "confirm_password": "Password@123"
        }
    )
    assert bad_name_res.status_code == 422 or bad_name_res.status_code == 400

    # 2. Reject password mismatch
    mismatch_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Thrisha K. Puthran",
            "email": "thrisha@sode-edu.in",
            "password": "Password@123",
            "confirm_password": "DifferentPassword@123"
        }
    )
    assert mismatch_res.status_code == 400
    assert "match" in mismatch_res.json()["detail"].lower()

    # 3. Successful registration with custom user name
    reg_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Thrisha K. Puthran",
            "email": "thrisha@sode-edu.in",
            "password": "Password@123",
            "confirm_password": "Password@123",
            "role": "LAB_INSTRUCTOR"
        }
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["full_name"] == "Thrisha K. Puthran"
    assert reg_data["email"] == "thrisha@sode-edu.in"
    assert reg_data["role"] == "LAB_INSTRUCTOR"
    assert "access_token" in reg_data

    # 4. Reject duplicate email registration
    dup_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Another Person",
            "email": "thrisha@sode-edu.in",
            "password": "Password@123",
            "confirm_password": "Password@123"
        }
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

    # 5. Login using newly registered credentials
    login_res = client.post(
        "/api/auth/login",
        data={"username": "thrisha@sode-edu.in", "password": "Password@123"}
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["full_name"] == "Thrisha K. Puthran"
    assert login_data["email"] == "thrisha@sode-edu.in"
    thrisha_token = login_data["access_token"]

    # 6. Verify GET /api/auth/me returns the authoritative registered name (page refresh simulation)
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {thrisha_token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Thrisha K. Puthran"
    assert me_res.json()["email"] == "thrisha@sode-edu.in"

    # 7. Register a second distinct user and verify identity isolation
    reg_user2 = client.post(
        "/api/auth/register",
        json={
            "full_name": "Naveen Poojary",
            "email": "naveen@sode-edu.in",
            "password": "Password@123",
            "confirm_password": "Password@123",
            "role": "TECHNICIAN"
        }
    )
    assert reg_user2.status_code == 201
    user2_token = reg_user2.json()["access_token"]

    me_user2 = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {user2_token}"}
    )
    assert me_user2.status_code == 200
    assert me_user2.json()["full_name"] == "Naveen Poojary"
    assert me_user2.json()["full_name"] != "Thrisha K. Puthran"



