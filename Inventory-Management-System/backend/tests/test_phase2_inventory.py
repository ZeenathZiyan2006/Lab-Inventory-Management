import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.seed.demo_data import seed_database
from app.models.models import AssetStatus

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database(reset=True)

client = TestClient(app)

def get_auth_token(email: str = "admin@sode-edu.in", password: str = "Admin@123") -> str:
    response = client.post("/api/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200, f"Login failed for {email}: {response.text}"
    return response.json()["access_token"]

def test_inventory_summary_metrics():
    token = get_auth_token("admin@sode-edu.in", "Admin@123")
    res = client.get("/api/inventory/summary", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "total_active_assets" in data
    assert "working_assets" in data
    assert "low_stock_bulk_items" in data
    assert data["total_active_assets"] >= 0

def test_laboratory_management_stats_and_updates():
    admin_token = get_auth_token("admin@sode-edu.in", "Admin@123")
    
    # 1. Fetch labs and verify computed stats
    res = client.get("/api/labs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    labs = res.json()
    assert len(labs) >= 2
    lab1 = next(l for l in labs if l["code"] == "AIDS-LAB-01")
    assert lab1["active_equipment_count"] >= 0
    assert "assigned_instructor_names" in lab1
    assert "open_fault_count" in lab1

    # 2. Update Lab details
    update_res = client.put(
        f"/api/labs/{lab1['id']}",
        json={
            "description": "Updated AI & High-Performance Computing Laboratory",
            "room_number": "A301"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert update_res.status_code == 200
    assert update_res.json()["room_number"] == "A301"
    assert "High-Performance" in update_res.json()["description"]

def test_asset_pagination_and_sorting():
    token = get_auth_token("admin@sode-edu.in", "Admin@123")
    res = client.get("/api/inventory/assets?page=1&page_size=5&sort_by=name&sort_order=asc", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "total_pages" in data
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert len(data["items"]) <= 5

def test_prevent_duplicate_asset_and_serial_number():
    token = get_auth_token("admin@sode-edu.in", "Admin@123")
    
    # First creation
    asset_data = {
        "asset_id": "SMVITM-TEST-DUP-01",
        "name": "Unique Test System",
        "category": "Computing",
        "serial_number": "SN-UNIQUE-9999",
        "lab_id": 1,
        "department_id": 1,
        "status": "Working"
    }
    res1 = client.post("/api/inventory/assets", json=asset_data, headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code in [200, 400] # If already created in prior run, 400 is also acceptable

    # Duplicate Asset ID attempt
    dup_id_data = dict(asset_data)
    dup_id_data["serial_number"] = "SN-DIFFERENT-1111"
    res2 = client.post("/api/inventory/assets", json=dup_id_data, headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"].lower()

    # Duplicate Serial Number attempt
    dup_sn_data = dict(asset_data)
    dup_sn_data["asset_id"] = "SMVITM-TEST-DUP-02"
    dup_sn_data["serial_number"] = "SN-UNIQUE-9999"
    res3 = client.post("/api/inventory/assets", json=dup_sn_data, headers={"Authorization": f"Bearer {token}"})
    assert res3.status_code == 400
    assert "already registered" in res3.json()["detail"].lower()

def test_validated_status_transitions_and_reasons():
    token = get_auth_token("admin@sode-edu.in", "Admin@123")

    # Create a fresh asset for transition tests
    asset_res = client.post(
        "/api/inventory/assets",
        json={
            "asset_id": "SMVITM-TRANSITION-TEST-PC",
            "name": "Transition Lifecycle PC",
            "category": "Computing",
            "lab_id": 1,
            "status": "Working"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    if asset_res.status_code == 400:
        # Fetch existing
        lookup = client.get("/api/inventory/assets?search=SMVITM-TRANSITION-TEST-PC", headers={"Authorization": f"Bearer {token}"})
        asset_id = lookup.json()["items"][0]["id"]
    else:
        asset_id = asset_res.json()["id"]

    # Reset to Working first if needed
    client.put(
        f"/api/inventory/assets/{asset_id}/status",
        json={"status": "Working", "reason": "Resetting for lifecycle test run"},
        headers={"Authorization": f"Bearer {token}"}
    )

    # 1. Reject empty reason
    empty_reason = client.put(
        f"/api/inventory/assets/{asset_id}/status",
        json={"status": "Fault Reported", "reason": "  "},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert empty_reason.status_code == 400
    assert "reason" in empty_reason.json()["detail"].lower()

    # 2. Valid transition: Working -> Fault Reported
    valid_step1 = client.put(
        f"/api/inventory/assets/{asset_id}/status",
        json={"status": "Fault Reported", "reason": "Display flickers repeatedly during boot"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert valid_step1.status_code == 200
    assert valid_step1.json()["status"].lower() == "fault reported"

    # 3. Invalid transition test by Lab Instructor:
    # A non-admin instructor trying an invalid leap e.g. Fault Reported -> Missing is invalid
    inst_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")
    invalid_step = client.put(
        f"/api/inventory/assets/{asset_id}/status",
        json={"status": "Missing", "reason": "Incorrectly trying to mark missing without prior stage"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert invalid_step.status_code == 400
    assert "invalid transition" in invalid_step.json()["detail"].lower()

    # 4. Valid transition: Fault Reported -> Under Repair
    valid_step2 = client.put(
        f"/api/inventory/assets/{asset_id}/status",
        json={"status": "Under Repair", "reason": "Assigned to hardware technician for GPU testing"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert valid_step2.status_code == 200
    assert valid_step2.json()["status"].lower() == "under repair"

def test_asset_lifecycle_details_endpoint():
    token = get_auth_token("admin@sode-edu.in", "Admin@123")
    lookup = client.get("/api/inventory/assets?search=SMVITM-AIDS-LAB1-WS-01", headers={"Authorization": f"Bearer {token}"})
    assert lookup.status_code == 200
    items = lookup.json()["items"]
    assert len(items) > 0
    asset_id = items[0]["id"]

    details_res = client.get(f"/api/inventory/assets/{asset_id}/details", headers={"Authorization": f"Bearer {token}"})
    assert details_res.status_code == 200
    details = details_res.json()
    assert "history" in details
    assert "laboratory_name" in details
    assert len(details["history"]) >= 1

def test_qr_scanner_and_manual_lookup():
    token = get_auth_token("admin@sode-edu.in", "Admin@123")

    # 1. Scan asset QR token
    scan_res = client.get("/api/qr/scan/ASSET:SMVITM-AIDS-LAB1-WS-01", headers={"Authorization": f"Bearer {token}"})
    assert scan_res.status_code == 200
    assert scan_res.json()["type"] == "ASSET"
    assert scan_res.json()["asset_id"] == "SMVITM-AIDS-LAB1-WS-01"

    # 2. Manual lookup endpoint with raw asset ID
    manual_res = client.post("/api/qr/lookup", json={"identifier": "SMVITM-AIDS-LAB1-WS-01"}, headers={"Authorization": f"Bearer {token}"})
    assert manual_res.status_code == 200
    assert manual_res.json()["asset_id"] == "SMVITM-AIDS-LAB1-WS-01"

    # 3. Scan Lab QR
    lab_scan = client.get("/api/qr/scan/LAB-AIDS-LAB-01", headers={"Authorization": f"Bearer {token}"})
    assert lab_scan.status_code == 200
    assert lab_scan.json()["type"] == "LABORATORY"

    # 4. Printable Asset Label data with SVG & PNG
    label_res = client.get(f"/api/qr/label/{scan_res.json()['id']}", headers={"Authorization": f"Bearer {token}"})
    assert label_res.status_code == 200
    label_data = label_res.json()
    assert "Shri Madhwa Vadiraja Institute of Technology & Management" in label_data["institution"]
    assert "qr_image_base64" in label_data
    assert "qr_svg" in label_data
    assert "<svg" in label_data["qr_svg"]

    # Verify no sensitive information (passwords, tokens) encoded
    assert "password" not in label_data["qr_code_token"].lower()
    assert "secret" not in label_data["qr_code_token"].lower()

    # 5. Download Standalone PNG & SVG Endpoints
    png_dl = client.get(f"/api/qr/download/{scan_res.json()['id']}/png", headers={"Authorization": f"Bearer {token}"})
    assert png_dl.status_code == 200
    assert png_dl.headers.get("content-type") == "image/png"
    assert len(png_dl.content) > 100

    svg_dl = client.get(f"/api/qr/download/{scan_res.json()['id']}/svg", headers={"Authorization": f"Bearer {token}"})
    assert svg_dl.status_code == 200
    assert "image/svg+xml" in svg_dl.headers.get("content-type", "")
    assert b"<svg" in svg_dl.content

    # 6. Fallback Lookup by Serial Number
    serial_no = scan_res.json().get("serial_number")
    if serial_no:
        serial_lookup = client.post("/api/qr/lookup", headers={"Authorization": f"Bearer {token}"}, json={"identifier": serial_no})
        assert serial_lookup.status_code == 200
        assert serial_lookup.json()["id"] == scan_res.json()["id"]

    # 7. URL Scanning Lookup
    url_scan = client.get(f"/api/qr/scan/http://localhost:5173/inventory?asset={scan_res.json()['asset_id']}", headers={"Authorization": f"Bearer {token}"})
    assert url_scan.status_code == 200
    assert url_scan.json()["id"] == scan_res.json()["id"]

    # 8. Printable Lab Door Placard
    door_label = client.get("/api/labs/1/label", headers={"Authorization": f"Bearer {token}"})
    assert door_label.status_code == 200
    assert "room_number" in door_label.json()
    assert "qr_image_base64" in door_label.json()
