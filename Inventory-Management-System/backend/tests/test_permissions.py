import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.seed.demo_data import seed_database
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.models import User, UserRole

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database(reset=True)

@pytest.fixture
def client():
    return TestClient(app)

def get_token(client, email, password):
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    return res.json()["access_token"]

def test_technician_cannot_modify_inventory_assets(client):
    token = get_token(client, "technician@sode-edu.in", "Tech@123")
    res = client.post(
        "/api/inventory/assets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "asset_id": "UNAUTHORIZED-ASSET-01",
            "name": "Should Fail",
            "category": "Computing",
            "department_id": 1,
            "lab_id": 1
        }
    )
    assert res.status_code == 403
    assert "not permitted" in res.json()["detail"].lower()

def test_hod_cannot_create_assets_directly(client):
    token = get_token(client, "hod.aids@sode-edu.in", "Hod@123")
    res = client.post(
        "/api/inventory/assets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "asset_id": "HOD-DIRECT-ASSET",
            "name": "Should Fail",
            "category": "Computing",
            "department_id": 1,
            "lab_id": 1
        }
    )
    assert res.status_code == 403

def test_instructor_cross_lab_unauthorized_access(client):
    """If an instructor accesses an unauthorized lab scope, return 403."""
    token = get_token(client, "instructor@sode-edu.in", "Instructor@123")
    res = client.get(
        "/api/inventory/assets?lab_id=99",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403

def test_bulk_inventory_sum_constraint_validation(client):
    """Enforce valid sum: total_quantity must equal sum of sub-quantities."""
    token = get_token(client, "instructor@sode-edu.in", "Instructor@123")
    res = client.post(
        "/api/inventory/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Invalid Sum Test Cables",
            "category": "Networking",
            "department_id": 1,
            "lab_id": 1,
            "total_quantity": 20,
            "working_quantity": 10,
            "damaged_quantity": 2,
            "missing_quantity": 0,
            "under_repair_quantity": 0, # sum is 12, not 20!
            "min_threshold": 5
        }
    )
    assert res.status_code == 400
    assert "sum" in res.json()["detail"].lower()

def test_transfer_pending_does_not_move_stock(client):
    """Verify that submitting a transfer request does NOT move inventory."""
    token = get_token(client, "instructor@sode-edu.in", "Instructor@123")
    
    # Check current quantity of keyboards in Lab 1
    bulk_res_before = client.get("/api/inventory/bulk?lab_id=1", headers={"Authorization": f"Bearer {token}"})
    keyboards_before = next(item for item in bulk_res_before.json() if "keyboard" in item["name"].lower())
    working_before = keyboards_before["working_quantity"]

    # Submit transfer request
    trf_res = client.post(
        "/api/transfers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "source_lab_id": 1,
            "destination_lab_id": 2,
            "bulk_id": keyboards_before["id"],
            "quantity": 3,
            "reason": "Test stock reservation safety"
        }
    )
    assert trf_res.status_code == 200
    assert trf_res.json()["status"] == "Pending Approval"

    # Verify stock in Lab 1 is UNCHANGED
    bulk_res_after = client.get("/api/inventory/bulk?lab_id=1", headers={"Authorization": f"Bearer {token}"})
    keyboards_after = next(item for item in bulk_res_after.json() if item["id"] == keyboards_before["id"])
    assert keyboards_after["working_quantity"] == working_before

def test_admin_provisioning_and_login(client):
    """Verify provisioned administrator account can authenticate successfully."""
    db = SessionLocal()
    try:
        new_admin = User(
            email="custom.admin@sode-edu.in",
            full_name="Custom Provisioned Admin",
            hashed_password=get_password_hash("AdminMaster@2026"),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(new_admin)
        db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/auth/login",
        data={"username": "custom.admin@sode-edu.in", "password": "AdminMaster@2026"}
    )
    assert res.status_code == 200
    assert res.json()["role"] == "ADMIN"
