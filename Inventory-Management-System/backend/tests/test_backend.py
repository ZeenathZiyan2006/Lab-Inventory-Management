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

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "SMVITM" in data["institution"]

def test_login_admin_success(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "admin@sode-edu.in", "password": "Admin@123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "ADMIN"

def test_login_invalid_password(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "admin@sode-edu.in", "password": "WrongPassword"}
    )
    assert response.status_code == 401

def test_technician_cannot_access_user_admin(client):
    login_res = client.post(
        "/api/auth/login",
        data={"username": "technician@sode-edu.in", "password": "Tech@123"}
    )
    token = login_res.json()["access_token"]
    
    response = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403

def test_inventory_list_authorized(client):
    login_res = client.post(
        "/api/auth/login",
        data={"username": "instructor@sode-edu.in", "password": "Instructor@123"}
    )
    token = login_res.json()["access_token"]
    
    response = client.get(
        "/api/inventory/assets",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) > 0

def test_qr_scan_asset(client):
    login_res = client.post(
        "/api/auth/login",
        data={"username": "instructor@sode-edu.in", "password": "Instructor@123"}
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/qr/scan/ASSET:SMVITM-AIDS-LAB1-WS-01",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "ASSET"
    assert data["asset_id"] == "SMVITM-AIDS-LAB1-WS-01"

def test_ai_fault_classification():
    from app.services.ai_service import classify_fault
    result = classify_fault("Sparks and burning smell coming from laboratory switchboard")
    assert result["category"] == "Electrical"
    assert result["suggested_priority"] in ["High", "Critical"]
    assert result["is_synthetic_demonstration"] is True

def test_smart_inventory_assistant(client):
    login_res = client.post(
        "/api/auth/login",
        data={"username": "instructor@sode-edu.in", "password": "Instructor@123"}
    )
    token = login_res.json()["access_token"]

    response = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "How many computers are not working in Lab 1?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["authorized_labs"]) > 0

def test_timetable_collision_check(client):
    login_res = client.post(
        "/api/auth/login",
        data={"username": "instructor@sode-edu.in", "password": "Instructor@123"}
    )
    token = login_res.json()["access_token"]

    # Attempt to book an overlapping slot in Lab 1 on Monday 09:30-10:30
    response = client.post(
        "/api/timetable",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lab_id": 1,
            "day_of_week": "Monday",
            "start_time": "09:30",
            "end_time": "10:30",
            "subject": "Conflicting Class",
            "batch_or_class": "AIDS 5th Sem",
            "instructor_name": "Test Instructor",
            "is_maintenance": False
        }
    )
    assert response.status_code == 400
    assert "collision" in response.json()["detail"].lower()
