import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.seed.demo_data import seed_database
from app.models.models import UserRole, FaultStatus, AssetStatus

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database(reset=True)

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    response = client.post("/api/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200, f"Login failed for {email}: {response.text}"
    return response.json()["access_token"]

def test_authorized_fault_reporting_and_asset_sync():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Report fault for Lab 1 Workstation 02 (Asset ID 2)
    report_res = client.post(
        "/api/faults",
        json={
            "title": "CPU Overheating Under AI Model Training",
            "asset_id": 2,
            "lab_id": 1,
            "fault_category": "Computer or CPU problem",
            "priority": "High",
            "description": "System throttling and shutting down after 15 minutes of CUDA matrix computation.",
            "is_safety_hazard": False
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert report_res.status_code == 200
    fault_data = report_res.json()
    assert fault_data["report_number"].startswith("FLT-")
    assert fault_data["status"] == "Reported"

    # 2. Verify Asset status synchronized to Fault Reported
    asset_res = client.get("/api/inventory/assets/2", headers={"Authorization": f"Bearer {instructor_token}"})
    assert asset_res.status_code == 200
    assert asset_res.json()["status"].lower() == "fault reported"

def test_unauthorized_lab_access_rejected():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # Instructor tries to report a fault in a lab they don't have access to (e.g. non-existent lab 999)
    res = client.post(
        "/api/faults",
        json={
            "title": "Unauthorized Lab Fault",
            "lab_id": 999,
            "fault_category": "Other",
            "priority": "Low",
            "description": "Trying to submit for an unauthorized laboratory facility"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert res.status_code == 403
    assert "access denied" in res.json()["detail"].lower() or "not authorized" in res.json()["detail"].lower()

def test_critical_safety_hazard_reporting():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    res = client.post(
        "/api/faults",
        json={
            "title": "Bare Wire Exposed on Master Distribution Board",
            "lab_id": 1,
            "fault_category": "Electrical fault",
            "priority": "Critical",
            "description": "Live 230V conductor insulation frayed near the main student bench terminal.",
            "is_safety_hazard": True,
            "safety_warning": "DANGER: High voltage hazard. Breaker 1B turned off."
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_safety_hazard"] is True
    assert "DANGER" in data["safety_warning"]

def test_technician_assignment_and_workload():
    admin_token = get_auth_token("admin@sode-edu.in", "Admin@123")
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Fetch technicians directory
    techs_res = client.get("/api/faults/technicians", headers={"Authorization": f"Bearer {admin_token}"})
    assert techs_res.status_code == 200
    techs = techs_res.json()
    assert len(techs) >= 1
    tech_id = techs[0]["id"]
    assert "active_assigned_jobs" in techs[0]

    # 2. Assign technician to Fault 1
    assign_res = client.post(
        "/api/faults/1/assign",
        json={
            "technician_id": tech_id,
            "assignment_notes": "Inspect and replace thermal paste on CPU cooler."
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["status"] == "Assigned"
    assert assign_res.json()["repair_job"]["technician_id"] == tech_id

def test_technician_repair_workspace_and_parts_used():
    tech_token = get_auth_token("technician@sode-edu.in", "Tech@123")

    # 1. Fetch technician's assigned repairs
    my_repairs = client.get("/api/faults/my-repairs", headers={"Authorization": f"Bearer {tech_token}"})
    assert my_repairs.status_code == 200
    repairs = my_repairs.json()
    assert len(repairs) >= 1
    fault1 = next(f for f in repairs if f["id"] == 1)
    repair_id = fault1["repair_job"]["id"]

    # 2. Technician starts work
    start_res = client.post(f"/api/faults/repairs/{repair_id}/start", headers={"Authorization": f"Bearer {tech_token}"})
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "In Progress"

    # 3. Technician updates diagnosis and adds parts used
    update_res = client.put(
        f"/api/faults/repairs/{repair_id}/update",
        json={
            "diagnosis": "Dried thermal paste causing thermal throttling at 98°C.",
            "work_performed": "Cleaned heat spreader with isopropyl alcohol, applied Arctic MX-4 thermal compound.",
            "notes": "Stress tested with FurMark for 30 minutes. Stable at 65°C under full load.",
            "repair_cost": 450.0,
            "parts_used": [
                {
                    "part_name": "Arctic MX-4 High Performance Thermal Paste (4g)",
                    "part_number": "ACT-MX4-4G",
                    "quantity": 1,
                    "unit_cost": 450.0
                }
            ]
        },
        headers={"Authorization": f"Bearer {tech_token}"}
    )
    assert update_res.status_code == 200
    updated_job = update_res.json()["repair_job"]
    assert len(updated_job["parts_used"]) >= 1
    assert updated_job["parts_used"][0]["part_name"].startswith("Arctic MX-4")

def test_anti_self_verification_guard():
    tech_token = get_auth_token("technician@sode-edu.in", "Tech@123")

    my_repairs = client.get("/api/faults/my-repairs", headers={"Authorization": f"Bearer {tech_token}"})
    assert my_repairs.status_code == 200
    fault1 = next(f for f in my_repairs.json() if f["id"] == 1)
    repair_id = fault1["repair_job"]["id"]

    # 1. Technician submits repair for verification
    submit_res = client.post(f"/api/faults/repairs/{repair_id}/complete", headers={"Authorization": f"Bearer {tech_token}"})
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "Repair Completed — Awaiting Verification"

    # 2. Technician attempts to verify THEIR OWN repair -> MUST BE REJECTED with 403
    self_verify_res = client.post(
        f"/api/faults/repairs/{repair_id}/verify",
        json={"is_verified": True, "verification_notes": "Self-approving my own repair."},
        headers={"Authorization": f"Bearer {tech_token}"}
    )
    assert self_verify_res.status_code == 403
    detail = self_verify_res.json()["detail"].lower()
    assert "conflict of interest" in detail or "cannot verify" in detail or "operation not permitted" in detail

def test_instructor_verification_and_asset_restoration():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    fault_res = client.get("/api/faults/1", headers={"Authorization": f"Bearer {instructor_token}"})
    assert fault_res.status_code == 200
    repair_id = fault_res.json()["repair_job"]["id"]

    # 1. Lab Instructor verifies the completed repair
    verify_res = client.post(
        f"/api/faults/repairs/{repair_id}/verify",
        json={
            "is_verified": True,
            "verification_notes": "Tested in AI lab during morning batch practicals. Temperatures normal, approved."
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "Verified and Closed"

    # 2. Verify Asset status synchronized back to Working
    asset_res = client.get("/api/inventory/assets/1", headers={"Authorization": f"Bearer {instructor_token}"})
    assert asset_res.status_code == 200
    assert asset_res.json()["status"].lower() == "working"

def test_rejection_and_reopening_workflows():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Create a dummy fault ticket
    report_res = client.post(
        "/api/faults",
        json={
            "title": "Flickering HDMI Cable in Lab 2",
            "lab_id": 2,
            "fault_category": "Network or connectivity problem",
            "priority": "Low",
            "description": "HDMI cable to instructor projector is loose at the wall socket plate."
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert report_res.status_code == 200
    fault_id = report_res.json()["id"]

    # 2. Reject the ticket with mandatory reason
    reject_res = client.post(
        f"/api/faults/{fault_id}/reject",
        json={"rejection_reason": "Cable was simply unplugged. Re-plugged securely by instructor."},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "Rejected"
    assert "re-plugged" in reject_res.json()["rejection_reason"].lower()

    # 3. Test Reopen previously closed ticket (Fault 1)
    reopen_res = client.post(
        "/api/faults/1/reopen",
        json={"reopen_reason": "Thermal paste dried out again, temperature spikes observed."},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert reopen_res.status_code == 200
    assert reopen_res.json()["status"] == "Reopened"

def test_notifications_read_and_mark_all():
    tech_token = get_auth_token("technician@sode-edu.in", "Tech@123")

    # 1. Get notifications
    notifs_res = client.get("/api/notifications", headers={"Authorization": f"Bearer {tech_token}"})
    assert notifs_res.status_code == 200
    notifs = notifs_res.json()
    assert len(notifs) >= 1

    # 2. Mark all as read
    mark_all = client.put("/api/notifications/mark-all-read", headers={"Authorization": f"Bearer {tech_token}"})
    assert mark_all.status_code == 200

    # 3. Verify all read
    updated_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {tech_token}"})
    assert all(n["is_read"] is True for n in updated_notifs.json())
