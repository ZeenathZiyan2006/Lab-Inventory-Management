from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os
import shutil
import csv
import io
from datetime import datetime
from app.core.database import get_db
from app.core.permissions import get_current_user, require_roles, verify_lab_access
from app.models.models import (
    PurchaseRequest, PurchaseApprovalDecision, GoodsReceiptRecord, PurchaseStatusHistory,
    StockMovementLedger, Asset, BulkInventory, Laboratory, User, UserRole,
    PurchaseStatus, PurchaseRequestType, AssetStatus, FaultReport, InventoryHistory
)
from app.schemas.schemas import (
    PurchaseRequestCreate, PurchaseApproval, PurchaseApprovalRequest,
    PurchaseOrderCreate, GoodsReceiptCreate, PurchaseResponse,
    PurchaseApprovalDecisionResponse, GoodsReceiptRecordResponse,
    PurchaseStatusHistoryResponse, AssetRetireRequest
)
from app.services.audit_service import log_audit
from app.services.notification_service import create_notification

router = APIRouter(prefix="/requests", tags=["Purchase and Replacement Requests"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "quotations")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _log_purchase_history(
    db: Session,
    purchase: PurchaseRequest,
    user: Optional[User],
    action: str,
    prev_status: Optional[str],
    new_status: str,
    reason: Optional[str] = None
):
    entry = PurchaseStatusHistory(
        purchase_id=purchase.id,
        user_id=user.id if user else None,
        previous_status=prev_status,
        new_status=new_status,
        action=action,
        reason=reason,
        created_at=datetime.utcnow()
    )
    db.add(entry)

def _format_purchase_response(req: PurchaseRequest) -> PurchaseResponse:
    decisions = [
        PurchaseApprovalDecisionResponse(
            id=d.id,
            purchase_id=d.purchase_id,
            approver_id=d.approver_id,
            approver_name=d.approver.full_name if d.approver else None,
            role_at_approval=d.role_at_approval,
            stage=d.stage,
            decision=d.decision,
            comments=d.comments,
            created_at=d.created_at
        ) for d in req.approval_decisions
    ]

    receipts = [
        GoodsReceiptRecordResponse(
            id=g.id,
            purchase_id=g.purchase_id,
            received_by_id=g.received_by_id,
            received_by_name=g.received_by.full_name if g.received_by else None,
            quantity_received=g.quantity_received,
            condition_received=g.condition_received,
            notes=g.notes,
            created_at=g.created_at
        ) for g in req.goods_receipts
    ]

    history = [
        PurchaseStatusHistoryResponse(
            id=h.id,
            purchase_id=h.purchase_id,
            user_id=h.user_id,
            user_name=h.user.full_name if h.user else None,
            previous_status=h.previous_status,
            new_status=h.new_status,
            action=h.action,
            reason=h.reason,
            created_at=h.created_at
        ) for h in sorted(req.status_history, key=lambda x: x.created_at)
    ]

    return PurchaseResponse(
        id=req.id,
        request_number=req.request_number,
        request_type=req.request_type.value if hasattr(req.request_type, 'value') else str(req.request_type),
        item_name=req.item_name,
        description=req.description,
        category=req.category,
        lab_id=req.lab_id,
        lab_name=req.laboratory.name if req.laboratory else None,
        quantity=req.quantity,
        unit=req.unit or "Units",
        estimated_unit_cost=req.estimated_unit_cost,
        estimated_total_cost=req.estimated_total_cost or req.estimated_cost,
        estimated_cost=req.estimated_cost or req.estimated_total_cost,
        justification=req.justification,
        linked_fault_id=req.linked_fault_id,
        linked_asset_id=req.linked_asset_id,
        linked_asset_custom_id=req.linked_asset.asset_id if req.linked_asset else None,
        requested_by_id=req.requested_by_id,
        requested_by_name=req.requested_by.full_name if req.requested_by else None,
        supplier_name=req.supplier_name,
        supplier_contact=req.supplier_contact,
        quotation_ref=req.quotation_ref,
        attachment_url=req.attachment_url,
        status=req.status,
        hod_approved_by_id=req.hod_approved_by_id,
        hod_approved_by_name=req.hod_approver.full_name if req.hod_approver else None,
        hod_approval_status=req.hod_approval_status,
        hod_remarks=req.hod_remarks,
        principal_approved_by_id=req.principal_approved_by_id,
        principal_approved_by_name=req.principal_approver.full_name if req.principal_approver else None,
        principal_approval_status=req.principal_approval_status,
        principal_remarks=req.principal_remarks,
        rejection_reason=req.rejection_reason,
        more_info_notes=req.more_info_notes,
        po_number=req.po_number,
        ordered_by_id=req.ordered_by_id,
        ordered_by_name=req.ordered_by.full_name if req.ordered_by else None,
        ordered_at=req.ordered_at,
        ordered_cost=req.ordered_cost,
        expected_delivery_date=req.expected_delivery_date,
        order_notes=req.order_notes,
        quantity_received=req.quantity_received,
        quantity_outstanding=req.quantity_outstanding,
        procured_by_id=req.procured_by_id,
        procured_at=req.procured_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
        approval_decisions=decisions,
        goods_receipts=receipts,
        status_history=history
    )

@router.get("", response_model=List[PurchaseResponse])
def get_purchase_requests(
    status: Optional[str] = Query(None),
    request_type: Optional[str] = Query(None),
    lab_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PurchaseRequest)
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(PurchaseRequest.lab_id.in_(assigned_ids))

    if lab_id:
        query = query.filter(PurchaseRequest.lab_id == lab_id)
    if status:
        query = query.filter(PurchaseRequest.status == status)
    if request_type:
        query = query.filter(PurchaseRequest.request_type == request_type)

    requests = query.order_by(PurchaseRequest.created_at.desc()).all()

    if search and search.strip():
        q = search.strip().lower()
        requests = [
            r for r in requests if
            q in r.request_number.lower() or
            q in r.item_name.lower() or
            q in r.justification.lower() or
            (r.supplier_name and q in r.supplier_name.lower()) or
            (r.po_number and q in r.po_number.lower())
        ]

    return [_format_purchase_response(r) for r in requests]

@router.get("/pending-approvals", response_model=List[PurchaseResponse])
def get_pending_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HOD, UserRole.PRINCIPAL, UserRole.ADMIN]))
):
    query = db.query(PurchaseRequest).filter(
        PurchaseRequest.status.in_([PurchaseStatus.PENDING_APPROVAL, PurchaseStatus.UNDER_REVIEW])
    )
    if current_user.role == UserRole.HOD:
        query = query.filter(PurchaseRequest.hod_approval_status == "Pending")
    elif current_user.role == UserRole.PRINCIPAL:
        query = query.filter(PurchaseRequest.principal_approval_status == "Pending")

    return [_format_purchase_response(r) for r in query.order_by(PurchaseRequest.created_at.desc()).all()]

@router.get("/export-csv")
def export_purchases_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PurchaseRequest)
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(PurchaseRequest.lab_id.in_(assigned_ids))

    requests = query.order_by(PurchaseRequest.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Request Number", "Date", "Type", "Item Name", "Category",
        "Laboratory", "Quantity", "Est Unit Cost (INR)", "Est Total Cost (INR)",
        "Status", "Requester", "Justification", "Supplier", "PO Number",
        "Ordered Cost (INR)", "Quantity Received", "Quantity Outstanding"
    ])

    for r in requests:
        writer.writerow([
            r.request_number,
            r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            r.request_type.value if hasattr(r.request_type, 'value') else str(r.request_type),
            r.item_name,
            r.category,
            r.laboratory.name if r.laboratory else f"Lab {r.lab_id}",
            r.quantity,
            r.estimated_unit_cost or "",
            r.estimated_total_cost or r.estimated_cost or "",
            r.status.value if hasattr(r.status, 'value') else str(r.status),
            r.requested_by.full_name if r.requested_by else f"User {r.requested_by_id}",
            r.justification,
            r.supplier_name or "",
            r.po_number or "",
            r.ordered_cost or "",
            r.quantity_received,
            r.quantity_outstanding
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=SMVITM_Purchase_Requests_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )

@router.get("/{request_id}", response_model=PurchaseResponse)
def get_purchase_by_id(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        if req.lab_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view requests for this laboratory")
    return _format_purchase_response(req)

@router.post("", response_model=PurchaseResponse)
def create_purchase_request(
    payload: PurchaseRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    if not verify_lab_access(current_user, payload.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    # Backend calculation and validation of totals
    calc_unit_cost = payload.estimated_unit_cost
    if not calc_unit_cost and payload.estimated_cost and payload.quantity > 0:
        calc_unit_cost = payload.estimated_cost / payload.quantity

    calc_total_cost = (calc_unit_cost * payload.quantity) if calc_unit_cost is not None else payload.estimated_cost

    # Validate type
    req_type_enum = PurchaseRequestType.NEW_PURCHASE
    if payload.request_type:
        for t in PurchaseRequestType:
            if t.value.lower() == payload.request_type.lower() or t.name.lower() == payload.request_type.lower():
                req_type_enum = t
                break

    initial_status = PurchaseStatus.DRAFT if payload.is_draft else PurchaseStatus.PENDING_APPROVAL
    req_num = f"REQ-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    request_item = PurchaseRequest(
        request_number=req_num,
        request_type=req_type_enum,
        item_name=payload.item_name.strip(),
        description=payload.description.strip() if payload.description else None,
        category=payload.category,
        lab_id=payload.lab_id,
        quantity=payload.quantity,
        unit=payload.unit or "Units",
        estimated_unit_cost=calc_unit_cost,
        estimated_total_cost=calc_total_cost,
        estimated_cost=calc_total_cost,
        justification=payload.justification.strip(),
        linked_fault_id=payload.linked_fault_id,
        linked_asset_id=payload.linked_asset_id,
        requested_by_id=current_user.id,
        supplier_name=payload.supplier_name.strip() if payload.supplier_name else None,
        supplier_contact=payload.supplier_contact.strip() if payload.supplier_contact else None,
        quotation_ref=payload.quotation_ref.strip() if payload.quotation_ref else None,
        attachment_url=payload.attachment_url,
        status=initial_status,
        quantity_received=0,
        quantity_outstanding=payload.quantity
    )
    db.add(request_item)
    db.flush()

    _log_purchase_history(
        db, request_item, current_user,
        action="Saved Draft" if payload.is_draft else "Submitted Purchase Request",
        prev_status=None,
        new_status=initial_status.value,
        reason=request_item.justification
    )

    if not payload.is_draft:
        create_notification(
            db,
            title="New Purchase Request Submitted",
            message=f"Purchase request {request_item.request_number} for {request_item.item_name} (Qty: {request_item.quantity}) submitted by {current_user.full_name}.",
            role=UserRole.HOD,
            link="/requests"
        )

    db.commit()
    db.refresh(request_item)
    log_audit(db, "CREATE_PURCHASE_REQ", "PurchaseRequest", str(request_item.id), current_user, f"Created {request_item.request_number}")
    return _format_purchase_response(request_item)

ALLOWED_QUOTATION_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"}
MAX_QUOTATION_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/upload-quotation")
async def upload_quotation_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    orig_name = os.path.basename(file.filename or "quotation.pdf")
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in ALLOWED_QUOTATION_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_QUOTATION_EXTS))}"
        )

    contents = await file.read()
    if len(contents) > MAX_QUOTATION_SIZE:
        raise HTTPException(status_code=400, detail="Quotation file exceeds 10MB limit")

    safe_name = f"quotation_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    # Path traversal guard
    if not os.path.normpath(filepath).startswith(os.path.normpath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="Invalid quotation file path")

    with open(filepath, "wb") as buffer:
        buffer.write(contents)

    return {"attachment_url": f"/api/requests/quotations/{safe_name}", "filename": safe_name}

@router.get("/quotations/{filename}")
def get_quotation_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    clean_name = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, clean_name)
    if not os.path.normpath(file_path).startswith(os.path.normpath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Quotation file not found")
    return FileResponse(file_path)

@router.post("/{request_id}/approve", response_model=PurchaseResponse)
def approve_or_reject_purchase(
    request_id: int,
    payload: PurchaseApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HOD, UserRole.PRINCIPAL, UserRole.ADMIN]))
):
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if req.status not in [PurchaseStatus.PENDING_APPROVAL, PurchaseStatus.UNDER_REVIEW, PurchaseStatus.MORE_INFO_REQUESTED]:
        raise HTTPException(status_code=400, detail=f"Request is in '{req.status.value}' state and cannot be reviewed")

    # Anti-Self-Approval Guard: Requester cannot approve their own purchase request unless Administrator
    if current_user.id == req.requested_by_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Conflict of Interest: You cannot approve your own purchase request. Review must be conducted by HOD or Principal."
        )

    prev_status = req.status.value
    decision_stage = payload.stage or ("HOD Review" if current_user.role == UserRole.HOD else "Principal Institutional Approval")

    # Record Approval Decision in audit table
    approval_decision = PurchaseApprovalDecision(
        purchase_id=req.id,
        approver_id=current_user.id,
        role_at_approval=current_user.role.value,
        stage=decision_stage,
        decision=payload.decision,
        comments=payload.comments or payload.rejection_reason,
        created_at=datetime.utcnow()
    )
    db.add(approval_decision)

    if payload.decision.lower() == "approved":
        if current_user.role == UserRole.HOD:
            req.hod_approval_status = "Approved"
            req.hod_approved_by_id = current_user.id
            req.hod_remarks = payload.comments

            # Policy check: High value purchases (e.g. > Rs 25,000) or Institutional items require Principal endorsement
            cost = req.estimated_total_cost or req.estimated_cost or 0.0
            if cost > 25000 and current_user.role != UserRole.ADMIN:
                req.status = PurchaseStatus.UNDER_REVIEW
                create_notification(
                    db,
                    title="Purchase Request Escalated to Principal",
                    message=f"Request {req.request_number} (₹{cost:,.2f}) approved by HOD and requires Principal institutional endorsement.",
                    role=UserRole.PRINCIPAL,
                    link="/requests"
                )
            else:
                req.status = PurchaseStatus.APPROVED
                create_notification(
                    db,
                    title="Purchase Request Approved for Procurement",
                    message=f"Request {req.request_number} was approved. Ready for purchase order generation.",
                    user_id=req.requested_by_id,
                    link="/requests"
                )
        else:
            # Principal or Admin
            req.principal_approval_status = "Approved"
            req.principal_approved_by_id = current_user.id
            req.principal_remarks = payload.comments
            req.status = PurchaseStatus.APPROVED

            create_notification(
                db,
                title="Purchase Request Approved by Principal",
                message=f"Request {req.request_number} has received final Principal institutional sanction.",
                user_id=req.requested_by_id,
                link="/requests"
            )

        _log_purchase_history(
            db, req, current_user,
            action=f"Approved by {current_user.role.value}",
            prev_status=prev_status,
            new_status=req.status.value,
            reason=payload.comments
        )

    elif payload.decision.lower() == "rejected":
        if not payload.rejection_reason or len(payload.rejection_reason.strip()) < 5:
            raise HTTPException(status_code=400, detail="A mandatory rejection explanation (minimum 5 characters) is required.")

        req.status = PurchaseStatus.REJECTED
        req.rejection_reason = payload.rejection_reason.strip()

        if current_user.role == UserRole.HOD:
            req.hod_approval_status = "Rejected"
            req.hod_approved_by_id = current_user.id
            req.hod_remarks = payload.rejection_reason
        else:
            req.principal_approval_status = "Rejected"
            req.principal_approved_by_id = current_user.id
            req.principal_remarks = payload.rejection_reason

        _log_purchase_history(
            db, req, current_user,
            action=f"Rejected by {current_user.role.value}",
            prev_status=prev_status,
            new_status=PurchaseStatus.REJECTED.value,
            reason=payload.rejection_reason
        )

        create_notification(
            db,
            title="Purchase Request Rejected",
            message=f"Purchase request {req.request_number} was rejected by {current_user.full_name}. Reason: {payload.rejection_reason}",
            user_id=req.requested_by_id,
            link="/requests"
        )
    else:
        # More info requested
        req.status = PurchaseStatus.MORE_INFO_REQUESTED
        req.more_info_notes = payload.comments
        _log_purchase_history(
            db, req, current_user,
            action="Additional Info Requested",
            prev_status=prev_status,
            new_status=PurchaseStatus.MORE_INFO_REQUESTED.value,
            reason=payload.comments
        )
        create_notification(
            db,
            title="More Details Requested on Purchase Request",
            message=f"Clarification requested for purchase {req.request_number}: {payload.comments}",
            user_id=req.requested_by_id,
            link="/requests"
        )

    db.commit()
    db.refresh(req)
    log_audit(db, "PURCHASE_APPROVAL_DECISION", "PurchaseRequest", str(req.id), current_user, f"Decision: {payload.decision}")
    return _format_purchase_response(req)

# Backward-compatibility endpoints
@router.put("/{request_id}/hod-approve", response_model=PurchaseResponse)
def hod_approve_request(
    request_id: int,
    payload: PurchaseApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HOD, UserRole.ADMIN]))
):
    approval_req = PurchaseApprovalRequest(
        decision=payload.status,
        stage="HOD Review",
        comments=payload.remarks,
        rejection_reason=payload.remarks if payload.status.lower() == "rejected" else None
    )
    return approve_or_reject_purchase(request_id, approval_req, db, current_user)

@router.put("/{request_id}/principal-approve", response_model=PurchaseResponse)
def principal_approve_request(
    request_id: int,
    payload: PurchaseApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.PRINCIPAL, UserRole.ADMIN]))
):
    approval_req = PurchaseApprovalRequest(
        decision=payload.status,
        stage="Principal Institutional Approval",
        comments=payload.remarks,
        rejection_reason=payload.remarks if payload.status.lower() == "rejected" else None
    )
    return approve_or_reject_purchase(request_id, approval_req, db, current_user)

@router.post("/{request_id}/order", response_model=PurchaseResponse)
def record_purchase_order(
    request_id: int,
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if req.status != PurchaseStatus.APPROVED and req.status != PurchaseStatus.AWAITING_PROCUREMENT:
        raise HTTPException(status_code=400, detail="Purchase request must receive full approval before placing an order")

    prev_status = req.status.value
    req.status = PurchaseStatus.ORDERED
    req.po_number = payload.po_number.strip()
    req.supplier_name = payload.supplier_name.strip()
    req.ordered_cost = payload.ordered_cost
    req.expected_delivery_date = payload.expected_delivery_date
    req.order_notes = payload.order_notes.strip() if payload.order_notes else None
    req.ordered_by_id = current_user.id
    req.ordered_at = datetime.utcnow()

    _log_purchase_history(
        db, req, current_user,
        action="Purchase Order Placed",
        prev_status=prev_status,
        new_status=PurchaseStatus.ORDERED.value,
        reason=f"PO #{payload.po_number} with {payload.supplier_name} for INR {payload.ordered_cost:,.2f}"
    )

    create_notification(
        db,
        title="Purchase Order Dispatched to Vendor",
        message=f"Purchase Order {req.po_number} placed for {req.item_name} with {req.supplier_name}.",
        user_id=req.requested_by_id,
        link="/requests"
    )

    db.commit()
    db.refresh(req)
    log_audit(db, "PLACE_PURCHASE_ORDER", "PurchaseRequest", str(req.id), current_user, f"PO #{payload.po_number}")
    return _format_purchase_response(req)

@router.post("/{request_id}/receive", response_model=PurchaseResponse)
def record_goods_receipt(
    request_id: int,
    payload: GoodsReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).with_for_update().first()
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if req.status not in [PurchaseStatus.ORDERED, PurchaseStatus.PARTIALLY_RECEIVED, PurchaseStatus.AWAITING_PROCUREMENT, PurchaseStatus.APPROVED]:
        raise HTTPException(status_code=400, detail=f"Cannot receive items for request in '{req.status.value}' state")

    if payload.quantity_received > req.quantity_outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Over-receipt prevented: Attempted to receive {payload.quantity_received}, but outstanding approved quantity is {req.quantity_outstanding}."
        )

    prev_status = req.status.value
    qty = payload.quantity_received

    # 1. Update purchase receipt tracking
    req.quantity_received += qty
    req.quantity_outstanding -= qty

    if req.quantity_outstanding == 0:
        req.status = PurchaseStatus.RECEIVED
    else:
        req.status = PurchaseStatus.PARTIALLY_RECEIVED

    req.procured_by_id = current_user.id
    req.procured_at = datetime.utcnow()

    # 2. Record Goods Receipt in audit table
    receipt_record = GoodsReceiptRecord(
        purchase_id=req.id,
        received_by_id=current_user.id,
        quantity_received=qty,
        condition_received=payload.condition_received or "Satisfactory / Working",
        notes=payload.notes,
        created_at=datetime.utcnow()
    )
    db.add(receipt_record)

    # 3. Controlled Inventory Creation / Increment
    is_serialized = payload.serial_numbers is not None and len(payload.serial_numbers) > 0

    if is_serialized:
        # Create individual asset records for each received serial number
        for i in range(qty):
            serial = payload.serial_numbers[i] if i < len(payload.serial_numbers) else f"SN-{uuid.uuid4().hex[:8].upper()}"
            custom_tag = f"SMVITM-AIDS-LAB{req.lab_id}-{req.category[:3].upper()}-{uuid.uuid4().hex[:4].upper()}"

            new_asset = Asset(
                asset_id=custom_tag,
                name=req.item_name,
                category=req.category,
                serial_number=serial,
                manufacturer=payload.manufacturer or req.supplier_name or "OEM",
                model=payload.model or "Standard",
                department_id=1,
                lab_id=req.lab_id,
                location_in_lab="Bench Station",
                purchase_date=datetime.utcnow(),
                purchase_price=req.estimated_unit_cost or (req.ordered_cost / req.quantity if req.ordered_cost else 0.0),
                warranty_expiry=payload.warranty_expiry,
                status=AssetStatus.WORKING,
                qr_code=f"QR:{custom_tag}:{serial}",
                is_active=True
            )
            db.add(new_asset)
            db.flush()

            db.add(InventoryHistory(
                asset_id=new_asset.id,
                user_id=current_user.id,
                action="Goods Receipt & Commissioning",
                previous_status=None,
                new_status=AssetStatus.WORKING.value,
                reason=f"Commissioned into Lab {req.lab_id} via PO {req.po_number or req.request_number}"
            ))

            db.add(StockMovementLedger(
                item_type="Asset",
                item_id=new_asset.id,
                item_name=new_asset.name,
                from_lab_id=None,
                to_lab_id=req.lab_id,
                quantity=1,
                reference_type="Procurement",
                reference_id=req.po_number or req.request_number,
                user_id=current_user.id,
                notes=f"Serial: {serial}. Condition: {payload.condition_received}",
                timestamp=datetime.utcnow()
            ))
    else:
        # Bulk inventory increment or creation
        bulk_match = db.query(BulkInventory).filter(
            BulkInventory.lab_id == req.lab_id,
            BulkInventory.name.ilike(req.item_name)
        ).with_for_update().first()

        if bulk_match:
            bulk_match.working_quantity += qty
            bulk_match.total_quantity += qty
            bulk_id = bulk_match.id
        else:
            new_bulk = BulkInventory(
                name=req.item_name,
                category=req.category,
                department_id=1,
                lab_id=req.lab_id,
                total_quantity=qty,
                working_quantity=qty,
                damaged_quantity=0,
                missing_quantity=0,
                under_repair_quantity=0,
                min_threshold=5,
                qr_code=f"BULK:{req.lab_id}:{req.item_name.replace(' ', '_').upper()}"
            )
            db.add(new_bulk)
            db.flush()
            bulk_id = new_bulk.id

        db.add(StockMovementLedger(
            item_type="Bulk",
            item_id=bulk_id,
            item_name=req.item_name,
            from_lab_id=None,
            to_lab_id=req.lab_id,
            quantity=qty,
            reference_type="Procurement",
            reference_id=req.po_number or req.request_number,
            user_id=current_user.id,
            notes=f"Goods received: {qty} units. Condition: {payload.condition_received}",
            timestamp=datetime.utcnow()
        ))

    _log_purchase_history(
        db, req, current_user,
        action=f"Received Goods (Qty: {qty})",
        prev_status=prev_status,
        new_status=req.status.value,
        reason=f"Condition: {payload.condition_received}. Notes: {payload.notes or 'None'}"
    )

    create_notification(
        db,
        title="Goods Received into Inventory",
        message=f"{qty} unit(s) of {req.item_name} received and commissioned into Lab {req.lab_id}.",
        user_id=req.requested_by_id,
        link="/requests"
    )

    db.commit()
    db.refresh(req)
    log_audit(db, "RECEIVE_GOODS", "PurchaseRequest", str(req.id), current_user, f"Received {qty} of {req.item_name}")
    return _format_purchase_response(req)

# Backward-compatibility procurement endpoint
@router.post("/{request_id}/procure", response_model=PurchaseResponse)
def record_procurement(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    receipt_payload = GoodsReceiptCreate(
        quantity_received=req.quantity_outstanding or req.quantity,
        condition_received="Satisfactory / Working",
        notes="Legacy procurement auto-receipt"
    )
    return record_goods_receipt(request_id, receipt_payload, db, current_user)

@router.post("/assets/{asset_id}/retire")
def retire_asset(
    asset_id: int,
    payload: AssetRetireRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if not verify_lab_access(current_user, asset.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    if not payload.retirement_reason or len(payload.retirement_reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="A detailed retirement justification (minimum 5 characters) is required.")

    prev_status = asset.status.value
    asset.status = AssetStatus.RETIRED
    asset.is_active = False

    db.add(InventoryHistory(
        asset_id=asset.id,
        user_id=current_user.id,
        action="Asset Retirement",
        previous_status=prev_status,
        new_status=AssetStatus.RETIRED.value,
        reason=payload.retirement_reason.strip()
    ))

    create_notification(
        db,
        title="Asset Retired from Active Service",
        message=f"Equipment {asset.asset_id} ({asset.name}) was formally retired by {current_user.full_name}. Reason: {payload.retirement_reason}",
        role=UserRole.HOD,
        link="/inventory"
    )

    db.commit()
    db.refresh(asset)
    log_audit(db, "RETIRE_ASSET", "Asset", str(asset.id), current_user, f"Retired {asset.asset_id}: {payload.retirement_reason}")
    return {"message": f"Asset {asset.asset_id} successfully decommissioned and retired.", "asset_id": asset.id, "status": asset.status.value}
