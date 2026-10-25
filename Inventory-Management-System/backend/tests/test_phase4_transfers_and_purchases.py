import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    response = client.post("/api/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200, f"Login failed for {email}: {response.text}"
    return response.json()["access_token"]

def test_transfer_validation_and_guards():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Reject identical source and destination lab
    res_same = client.post(
        "/api/transfers",
        json={
            "source_lab_id": 1,
            "destination_lab_id": 1,
            "quantity": 1,
            "reason": "Invalid transfer to same laboratory"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert res_same.status_code == 400
    assert "identical" in res_same.json()["detail"].lower()

    # 2. Reject insufficient bulk stock
    res_excess = client.post(
        "/api/transfers",
        json={
            "source_lab_id": 1,
            "destination_lab_id": 2,
            "bulk_id": 1,
            "quantity": 9999,
            "reason": "Exceeding available stock"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert res_excess.status_code == 400
    assert "insufficient" in res_excess.json()["detail"].lower()

def test_anti_self_approval_guard_on_transfers():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Instructor creates transfer request
    create_res = client.post(
        "/api/transfers",
        json={
            "source_lab_id": 1,
            "destination_lab_id": 2,
            "bulk_id": 1,
            "quantity": 2,
            "reason": "Lab 2 practical session requirement"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert create_res.status_code == 200
    transfer_id = create_res.json()["id"]

    # 2. The requester attempts to approve their own request -> 403 Forbidden
    self_approve_res = client.post(
        f"/api/transfers/{transfer_id}/approve",
        json={"decision": "Approved", "comments": "Self-approval attempt"},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert self_approve_res.status_code == 403

def test_safe_stock_transfer_lifecycle():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")
    hod_token = get_auth_token("hod.aids@sode-edu.in", "Hod@123")

    # 1. Check current bulk stock in Lab 1 (source) and Lab 2 (dest)
    bulk1_res = client.get("/api/inventory/bulk?lab_id=1", headers={"Authorization": f"Bearer {instructor_token}"})
    bulk_item = bulk1_res.json()[0]
    bulk_id = bulk_item["id"]
    source_working_before = bulk_item["working_quantity"]

    bulk2_res = client.get("/api/inventory/bulk?lab_id=2", headers={"Authorization": f"Bearer {instructor_token}"})
    dest_match = next((b for b in bulk2_res.json() if b["name"] == bulk_item["name"]), None)
    dest_working_before = dest_match["working_quantity"] if dest_match else 0

    # 2. Create transfer request
    trf_res = client.post(
        "/api/transfers",
        json={
            "source_lab_id": 1,
            "destination_lab_id": 2,
            "bulk_id": bulk_id,
            "quantity": 2,
            "priority": "High",
            "reason": "Transfer 2 units for afternoon lab test"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert trf_res.status_code == 200
    transfer_id = trf_res.json()["id"]

    # 3. HOD Approves transfer
    approve_res = client.post(
        f"/api/transfers/{transfer_id}/approve",
        json={"decision": "Approved", "comments": "Approved for practical examination"},
        headers={"Authorization": f"Bearer {hod_token}"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "Approved"

    # Verify stock has NOT moved yet
    bulk1_check = client.get("/api/inventory/bulk?lab_id=1", headers={"Authorization": f"Bearer {instructor_token}"}).json()
    assert next(b for b in bulk1_check if b["id"] == bulk_id)["working_quantity"] == source_working_before

    # 4. Source lab dispatches transfer
    dispatch_res = client.post(
        f"/api/transfers/{transfer_id}/dispatch",
        json={"dispatch_notes": "Handed to lab assistant for transport"},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert dispatch_res.status_code == 200
    assert dispatch_res.json()["status"] == "Dispatched"

    # 5. Destination lab confirms receipt
    receive_res = client.post(
        f"/api/transfers/{transfer_id}/receive",
        json={"condition": "Good", "discrepancy_notes": "All 2 units intact and tested"},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert receive_res.status_code == 200
    assert receive_res.json()["status"] == "Completed"

    # 6. Verify stock balance updated atomically
    bulk1_after = client.get("/api/inventory/bulk?lab_id=1", headers={"Authorization": f"Bearer {instructor_token}"}).json()
    assert next(b for b in bulk1_after if b["id"] == bulk_id)["working_quantity"] == source_working_before - 2

    bulk2_after = client.get("/api/inventory/bulk?lab_id=2", headers={"Authorization": f"Bearer {instructor_token}"}).json()
    dest_after_match = next(b for b in bulk2_after if b["name"] == bulk_item["name"])
    assert dest_after_match["working_quantity"] == dest_working_before + 2

def test_purchase_request_backend_cost_and_approval():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")
    hod_token = get_auth_token("hod.aids@sode-edu.in", "Hod@123")

    # 1. Create Purchase Request with unit cost
    req_res = client.post(
        "/api/requests",
        json={
            "request_type": "New Purchase",
            "item_name": "NVIDIA Jetson Orin Nano Developer Kit",
            "description": "Embedded AI edge accelerator board for student robotics project",
            "category": "Computing",
            "lab_id": 1,
            "quantity": 3,
            "unit": "Kits",
            "estimated_unit_cost": 45000.0,
            "justification": "Required for autonomous vehicle visual odometry module",
            "supplier_name": "Robu.in Embedded Systems"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert req_res.status_code == 200
    data = req_res.json()
    req_id = data["id"]
    # Backend validates calculation: 3 * 45000 = 135000.0
    assert data["estimated_total_cost"] == 135000.0

    # 2. HOD Approves high value purchase (> 25,000) -> Escalated to Under Review for Principal
    hod_approve = client.post(
        f"/api/requests/{req_id}/approve",
        json={"decision": "Approved", "comments": "Recommended for AIDS Lab 1 edge AI syllabus"},
        headers={"Authorization": f"Bearer {hod_token}"}
    )
    assert hod_approve.status_code == 200
    assert hod_approve.json()["status"] == "Under Review"

    # 3. Principal gives final sanction
    principal_token = get_auth_token("principal@sode-edu.in", "Principal@123")
    principal_approve = client.post(
        f"/api/requests/{req_id}/approve",
        json={"decision": "Approved", "comments": "Sanctioned under TEQIP departmental grant"},
        headers={"Authorization": f"Bearer {principal_token}"}
    )
    assert principal_approve.status_code == 200
    assert principal_approve.json()["status"] == "Approved"

def test_purchase_ordering_and_partial_receipt():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")
    hod_token = get_auth_token("hod.aids@sode-edu.in", "Hod@123")

    # 1. Create and approve a purchase request
    req_res = client.post(
        "/api/requests",
        json={
            "request_type": "Replenishment",
            "item_name": "Cat6 Gigabit RJ45 Patch Cord (3 Meter)",
            "category": "Networking",
            "lab_id": 1,
            "quantity": 10,
            "unit": "Cords",
            "estimated_unit_cost": 150.0,
            "justification": "Replacing worn patch cables in Lab 1"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["id"]

    # HOD approves (< 25,000, so approved directly)
    client.post(
        f"/api/requests/{req_id}/approve",
        json={"decision": "Approved", "comments": "Approved"},
        headers={"Authorization": f"Bearer {hod_token}"}
    )

    # 2. Record Purchase Order
    po_res = client.post(
        f"/api/requests/{req_id}/order",
        json={
            "po_number": "PO-SMVITM-2026-089",
            "supplier_name": "Shri Durga Network Solutions Udupi",
            "ordered_cost": 1400.0,
            "order_notes": "Bulk discount applied"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert po_res.status_code == 200
    assert po_res.json()["status"] == "Ordered"
    assert po_res.json()["quantity_outstanding"] == 10

    # 3. Partial Goods Receipt (receive 4 of 10)
    part_receipt = client.post(
        f"/api/requests/{req_id}/receive",
        json={
            "quantity_received": 4,
            "condition_received": "Satisfactory / Working",
            "notes": "First consignment received"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert part_receipt.status_code == 200
    assert part_receipt.json()["status"] == "Partially Received"
    assert part_receipt.json()["quantity_received"] == 4
    assert part_receipt.json()["quantity_outstanding"] == 6

    # 4. Over-receipt prevented (trying to receive 8 when 6 outstanding)
    over_res = client.post(
        f"/api/requests/{req_id}/receive",
        json={"quantity_received": 8},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert over_res.status_code == 400
    assert "over-receipt" in over_res.json()["detail"].lower()

    # 5. Final Goods Receipt (receive remaining 6)
    final_receipt = client.post(
        f"/api/requests/{req_id}/receive",
        json={
            "quantity_received": 6,
            "condition_received": "Satisfactory / Working",
            "notes": "Final consignment received"
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert final_receipt.status_code == 200
    assert final_receipt.json()["status"] == "Received"
    assert final_receipt.json()["quantity_outstanding"] == 0

def test_replacement_request_linked_to_fault_and_retirement():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Create a replacement purchase request linked to Fault #1 and Asset #1
    req_res = client.post(
        "/api/requests",
        json={
            "request_type": "Replacement",
            "item_name": "Workstation Cooling Block Assembly",
            "category": "Computing",
            "lab_id": 1,
            "quantity": 1,
            "estimated_unit_cost": 6500.0,
            "justification": "Replacement recommended by technician following thermal stress test failure",
            "linked_fault_id": 1,
            "linked_asset_id": 1
        },
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert req_res.status_code == 200
    data = req_res.json()
    assert data["request_type"] == "Replacement"
    assert data["linked_fault_id"] == 1
    assert data["linked_asset_id"] == 1

    # 2. Test Asset Retirement Endpoint
    retire_res = client.post(
        "/api/requests/assets/1/retire",
        json={"retirement_reason": "Damaged beyond economic repair; replaced under purchase request REQ-2026"},
        headers={"Authorization": f"Bearer {instructor_token}"}
    )
    assert retire_res.status_code == 200
    assert retire_res.json()["status"].lower() == "retired"

def test_stock_movement_ledger_and_csv_exports():
    instructor_token = get_auth_token("instructor@sode-edu.in", "Instructor@123")

    # 1. Query stock movement ledger
    ledger_res = client.get("/api/transfers/stock-movements", headers={"Authorization": f"Bearer {instructor_token}"})
    assert ledger_res.status_code == 200
    movements = ledger_res.json()
    assert len(movements) >= 1

    # 2. Test Transfers CSV Export
    trf_csv = client.get("/api/transfers/export-csv", headers={"Authorization": f"Bearer {instructor_token}"})
    assert trf_csv.status_code == 200
    assert "Transfer Request #" in trf_csv.text

    # 3. Test Purchases CSV Export
    pur_csv = client.get("/api/requests/export-csv", headers={"Authorization": f"Bearer {instructor_token}"})
    assert pur_csv.status_code == 200
    assert "Request Number" in pur_csv.text
