"""
Comprehensive Test Suite for Phase 5 AI Features
Covers Fault Classification, Grounded Assistant, Demand Forecasting, Reorder Deduplication, and RBAC Isolation.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.models import (
    User, UserRole, Laboratory, Asset, BulkInventory, FaultReport, RepairJob,
    PurchaseRequest, PurchaseStatus, AssetStatus, FaultStatus, FaultPriority
)
from app.core.security import create_access_token
from app.core.database import SessionLocal

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
def instructor_lab1_token(db_session):
    # Lab instructor assigned only to Lab 1
    instructor = db_session.query(User).filter(
        User.role == UserRole.LAB_INSTRUCTOR,
        User.email == "instructor1@smvitm.edu"
    ).first()
    if not instructor:
        instructor = db_session.query(User).filter(User.role == UserRole.LAB_INSTRUCTOR).first()
    return create_access_token(data={"sub": instructor.email, "role": instructor.role.value, "user_id": instructor.id})

@pytest.fixture(scope="module")
def hod_token(db_session):
    hod = db_session.query(User).filter(User.role == UserRole.HOD).first()
    return create_access_token(data={"sub": hod.email, "role": hod.role.value, "user_id": hod.id})

# =============================================================================
# 1. FAULT CLASSIFIER TESTS
# =============================================================================

def test_fault_classifier_valid_hardware_description(admin_token):
    response = client.post(
        "/api/ai/classify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "Workstation tower 04 does not power on when pressing the front chassis power button"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category"] in ["Computer or CPU", "Electrical fault"]
    assert data["confidence"] > 0.35
    assert "model_version" in data
    assert data["needs_manual_review"] is False
    assert data["is_synthetic_demonstration"] is True
    assert "CRITICAL SAFETY NOTICE" in data["safety_disclaimer"]

def test_fault_classifier_empty_and_short_inputs(admin_token):
    # Empty description
    res_empty = client.post(
        "/api/ai/classify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "   "}
    )
    assert res_empty.status_code == 200
    data = res_empty.json()
    assert data["category"] == "Needs Manual Review"
    assert data["needs_manual_review"] is True
    assert data["confidence"] == 0.0

    # Very short text
    res_short = client.post(
        "/api/ai/classify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "bad"}
    )
    assert res_short.status_code == 200
    data_short = res_short.json()
    assert data_short["category"] == "Needs Manual Review"
    assert data_short["needs_manual_review"] is True

def test_fault_classifier_out_of_distribution_query(admin_token):
    # Irrelevant or ambiguous query
    res = client.post(
        "/api/ai/classify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"description": "The cafeteria is serving delicious masala dosa today"}
    )
    assert res.status_code == 200
    data = res.json()
    # Out of distribution should yield low confidence or manual review
    assert data["needs_manual_review"] is True or data["confidence"] < 0.40

# =============================================================================
# 2. SMART INVENTORY ASSISTANT TESTS
# =============================================================================

def test_assistant_working_computers_query(admin_token):
    response = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "How many working computers are in Laboratory 1?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sql_intent"] == "COUNT_WORKING_COMPUTERS"
    assert "Found" in data["answer"] or "computer(s)" in data["answer"]
    assert isinstance(data["record_count"], int)
    assert isinstance(data["results"], list)

def test_assistant_anti_prompt_injection(admin_token):
    response = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "DROP TABLE assets; SELECT * FROM users WHERE role='ADMIN'"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sql_intent"] == "SECURITY_VIOLATION_BLOCKED"
    assert "Security Alert" in data["answer"]
    assert len(data["results"]) == 0

def test_assistant_unauthorized_lab_isolation(db_session, instructor_lab1_token):
    # Instructor 1 is assigned only to Lab 1. Asking for Lab 2 must be blocked!
    instructor1 = db_session.query(User).filter(User.email == "instructor1@smvitm.edu").first()
    if instructor1 and len(instructor1.assigned_labs) == 1 and instructor1.assigned_labs[0].id == 1:
        response = client.post(
            "/api/ai/assistant",
            headers={"Authorization": f"Bearer {instructor_lab1_token}"},
            json={"query": "How many computers are in Laboratory 2?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sql_intent"] == "UNAUTHORIZED_LAB_QUERY"
        assert "Access Denied" in data["answer"]
        assert len(data["results"]) == 0

def test_assistant_purchase_approval_role_restriction(instructor_lab1_token, hod_token):
    # Lab instructor has no approval authority
    res_inst = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {instructor_lab1_token}"},
        json={"query": "Which purchase requests are awaiting my approval?"}
    )
    assert res_inst.status_code == 200
    data_inst = res_inst.json()
    assert data_inst["sql_intent"] == "PURCHASE_APPROVALS_RESTRICTED"
    assert "Notice" in data_inst["answer"]

    # HOD has approval authority
    res_hod = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {hod_token}"},
        json={"query": "Which purchase requests are awaiting my approval?"}
    )
    assert res_hod.status_code == 200
    data_hod = res_hod.json()
    assert data_hod["sql_intent"] == "PURCHASE_REQUESTS_AWAITING_APPROVAL"
    assert isinstance(data_hod["results"], list)

def test_assistant_unsupported_clarification_prompt(admin_token):
    response = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "What is the capital of Karnataka?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sql_intent"] == "UNSUPPORTED_OR_AMBIGUOUS_QUERY"
    assert "Please try asking one of the following" in data["answer"]

# =============================================================================
# 3. DEMAND FORECASTING TESTS
# =============================================================================

def test_demand_forecast_endpoint_and_data_sufficiency(admin_token):
    response = client.get(
        "/api/ai/forecast?lab_id=1",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    item = data[0]
    assert "data_sufficiency" in item
    assert item["data_sufficiency"] in ["INSUFFICIENT", "PARTIAL", "SUFFICIENT"]
    assert "limitations_notice" in item
    assert "assumptions" in item

def test_demand_forecast_unauthorized_lab(db_session, instructor_lab1_token):
    # Instructor 1 is not assigned to Lab 2
    instructor1 = db_session.query(User).filter(User.email == "instructor1@smvitm.edu").first()
    if instructor1 and len(instructor1.assigned_labs) == 1 and instructor1.assigned_labs[0].id == 1:
        response = client.get(
            "/api/ai/forecast?lab_id=2",
            headers={"Authorization": f"Bearer {instructor_lab1_token}"}
        )
        assert response.status_code == 403

# =============================================================================
# 4. REORDER RECOMMENDATIONS & PO DEDUPLICATION TESTS
# =============================================================================

def test_reorder_recommendation_and_po_deduplication(db_session, admin_token):
    # Set up test condition:
    # Set min_threshold above working_quantity to create a deficit of 10 without violating quantity sum constraint
    bulk = db_session.query(BulkInventory).filter(BulkInventory.lab_id == 1).first()
    orig_threshold = bulk.min_threshold
    
    try:
        bulk.min_threshold = bulk.working_quantity + 10
        db_session.commit()

        # Without PO: Suggested action should be REORDER_URGENT
        res_no_po = client.get("/api/ai/recommendations?lab_id=1", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_no_po.status_code == 200
        recs = res_no_po.json()
        target_rec = next(r for r in recs if r["item_id"] == bulk.id)
        assert target_rec["suggested_action"] in ["REORDER_URGENT", "REORDER_RECOMMENDED"]
        assert "MANDATORY HUMAN-IN-THE-LOOP SAFETY DIRECTIVE" in target_rec["safety_notice"]

        # Now simulate an approved PO covering 10 units for this item
        test_po = PurchaseRequest(
            request_number=f"PR-TEST-PO-{bulk.id}",
            item_name=bulk.name,
            category=bulk.category,
            quantity=10,
            quantity_received=0,
            quantity_outstanding=10,
            status=PurchaseStatus.ORDERED,
            po_number="PO-SMVITM-TEST-001",
            lab_id=1,
            requested_by_id=1,
            justification="Test deduplication"
        )
        db_session.add(test_po)
        db_session.commit()

        # Re-query recommendations: action must now be ORDER_ALREADY_PLACED because PO covers the deficit!
        res_with_po = client.get("/api/ai/recommendations?lab_id=1", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_with_po.status_code == 200
        recs_with_po = res_with_po.json()
        target_rec_with_po = next(r for r in recs_with_po if r["item_id"] == bulk.id)
        
        assert target_rec_with_po["suggested_action"] == "ORDER_ALREADY_PLACED"
        assert "already approved and in transit" in target_rec_with_po["explanation"]
        assert "No duplicate" in target_rec_with_po["explanation"]

        # Cleanup test PO
        db_session.delete(test_po)
        db_session.commit()
    finally:
        bulk.min_threshold = orig_threshold
        db_session.commit()

# =============================================================================
# 5. MODEL REGISTRY AND READINESS STATUS
# =============================================================================

def test_model_status_endpoint(admin_token):
    response = client.get(
        "/api/ai/status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "fault_classifier" in data
    assert "assistant" in data
    assert "demand_forecasting" in data
    assert "reorder_engine" in data
    assert data["fault_classifier"]["status"] == "AVAILABLE"
    assert data["assistant"]["status"] == "AVAILABLE"
    assert data["demand_forecasting"]["status"] == "NEEDS_MORE_DATA"
    assert data["reorder_engine"]["status"] == "AVAILABLE"

# =============================================================================
# 6. ENHANCED ASSISTANT NATURAL LANGUAGE INTENTS
# =============================================================================

def test_assistant_asset_locate_query(admin_token):
    res = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "Where is asset SMVITM-AI-PC-001?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sql_intent"] == "LOCATE_ASSET"
    assert data["record_count"] == 1
    assert "SMVITM-AI-PC-001" in data["answer"]
    assert len(data["results"]) == 1
    assert data["results"][0]["asset_id"] == "SMVITM-AI-PC-001"

def test_assistant_damaged_and_missing_queries(admin_token):
    # Damaged
    res_dam = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "Which equipment is damaged?"}
    )
    assert res_dam.status_code == 200
    data_dam = res_dam.json()
    assert data_dam["sql_intent"] == "DAMAGED_EQUIPMENT"
    assert isinstance(data_dam["record_count"], int)

    # Missing
    res_mis = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "Show missing equipment"}
    )
    assert res_mis.status_code == 200
    data_mis = res_mis.json()
    assert data_mis["sql_intent"] == "MISSING_EQUIPMENT"
    assert isinstance(data_mis["record_count"], int)

def test_assistant_guidance_query(admin_token):
    res = client.post(
        "/api/ai/assistant",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "How do I report a damaged item?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sql_intent"] == "GUIDANCE_REPORT_FAULT"
    assert "Report Fault" in data["answer"]
    assert len(data["results"]) >= 1
    assert data["results"][0]["navigate_to"] == "faults"
