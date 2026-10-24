from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import csv
import io
from datetime import datetime
from app.core.database import get_db
from app.core.permissions import get_current_user, require_roles, verify_lab_access
from app.models.models import (
    TransferRequest, TransferApprovalDecision, TransferStatusHistory,
    StockMovementLedger, Asset, BulkInventory, Laboratory, User, UserRole,
    TransferStatus, AssetStatus, FaultReport, FaultStatus, InventoryHistory
)
from app.schemas.schemas import (
    TransferRequestCreate, TransferApproval, TransferApprovalRequest,
    TransferDispatchConfirm, TransferReceiptConfirm, TransferDisputeRequest,
    TransferCancelRequest, TransferResponse, TransferApprovalDecisionResponse,
    TransferStatusHistoryResponse, StockMovementResponse
)
from app.services.audit_service import log_audit
from app.services.notification_service import create_notification

router = APIRouter(prefix="/transfers", tags=["Inter-Lab Equipment Transfers"])

def _log_transfer_history(
    db: Session,
    transfer: TransferRequest,
    user: Optional[User],
    action: str,
    prev_status: Optional[str],
    new_status: str,
    reason: Optional[str] = None
):
    history_entry = TransferStatusHistory(
        transfer_id=transfer.id,
        user_id=user.id if user else None,
        previous_status=prev_status,
        new_status=new_status,
        action=action,
        reason=reason,
        created_at=datetime.utcnow()
    )
    db.add(history_entry)

def _format_transfer_response(transfer: TransferRequest) -> TransferResponse:
    decisions = [
        TransferApprovalDecisionResponse(
            id=d.id,
            transfer_id=d.transfer_id,
            approver_id=d.approver_id,
            approver_name=d.approver.full_name if d.approver else None,
            role_at_approval=d.role_at_approval,
            stage=d.stage,
            decision=d.decision,
            comments=d.comments,
            created_at=d.created_at
        ) for d in transfer.approval_decisions
    ]

    history = [
        TransferStatusHistoryResponse(
            id=h.id,
            transfer_id=h.transfer_id,
            user_id=h.user_id,
            user_name=h.user.full_name if h.user else None,
            previous_status=h.previous_status,
            new_status=h.new_status,
            action=h.action,
            reason=h.reason,
            created_at=h.created_at
        ) for h in sorted(transfer.status_history, key=lambda x: x.created_at)
    ]

    return TransferResponse(
        id=transfer.id,
        request_number=transfer.request_number,
        source_lab_id=transfer.source_lab_id,
        source_lab_name=transfer.source_lab.name if transfer.source_lab else None,
        destination_lab_id=transfer.destination_lab_id,
        destination_lab_name=transfer.destination_lab.name if transfer.destination_lab else None,
        asset_id=transfer.asset_id,
        asset_custom_id=transfer.asset.asset_id if transfer.asset else None,
        asset_name=transfer.asset.name if transfer.asset else None,
        bulk_id=transfer.bulk_id,
        bulk_item_name=transfer.bulk_item.name if transfer.bulk_item else None,
        quantity=transfer.quantity,
        requested_by_id=transfer.requested_by_id,
        requested_by_name=transfer.requested_by.full_name if transfer.requested_by else None,
        reason=transfer.reason,
        priority=transfer.priority or "Normal",
        notes=transfer.notes,
        status=transfer.status,
        requires_hod_approval=transfer.requires_hod_approval,
        hod_approved_by_id=transfer.hod_approved_by_id,
        hod_approved_by_name=transfer.hod_approver.full_name if transfer.hod_approver else None,
        hod_approval_status=transfer.hod_approval_status,
        hod_remarks=transfer.hod_remarks,
        requires_principal_approval=transfer.requires_principal_approval,
        principal_approved_by_id=transfer.principal_approved_by_id,
        principal_approved_by_name=transfer.principal_approver.full_name if transfer.principal_approver else None,
        principal_approval_status=transfer.principal_approval_status,
        principal_remarks=transfer.principal_remarks,
        dispatched_by_id=transfer.dispatched_by_id,
        dispatched_by_name=transfer.dispatched_by.full_name if transfer.dispatched_by else None,
        dispatched_at=transfer.dispatched_at,
        dispatch_notes=transfer.dispatch_notes,
        received_by_id=transfer.received_by_id,
        received_by_name=transfer.received_by.full_name if transfer.received_by else None,
        received_at=transfer.received_at,
        receipt_condition=transfer.receipt_condition,
        receipt_discrepancy_notes=transfer.receipt_discrepancy_notes,
        rejection_reason=transfer.rejection_reason,
        cancellation_reason=transfer.cancellation_reason,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
        approval_decisions=decisions,
        status_history=history
    )

@router.get("", response_model=List[TransferResponse])
def get_transfers(
    status: Optional[str] = Query(None),
    lab_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TransferRequest)
    
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(
            (TransferRequest.source_lab_id.in_(assigned_ids)) |
            (TransferRequest.destination_lab_id.in_(assigned_ids))
        )
    
    if lab_id:
        query = query.filter(
            (TransferRequest.source_lab_id == lab_id) | (TransferRequest.destination_lab_id == lab_id)
        )
    
    if status:
        query = query.filter(TransferRequest.status == status)

    transfers = query.order_by(TransferRequest.created_at.desc()).all()
    
    if search and search.strip():
        q = search.strip().lower()
        transfers = [
            t for t in transfers if
            q in t.request_number.lower() or
            q in t.reason.lower() or
            (t.asset and (q in t.asset.asset_id.lower() or q in t.asset.name.lower())) or
            (t.bulk_item and q in t.bulk_item.name.lower())
        ]
        
    return [_format_transfer_response(t) for t in transfers]

@router.get("/pending-approvals", response_model=List[TransferResponse])
def get_pending_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HOD, UserRole.PRINCIPAL, UserRole.ADMIN]))
):
    query = db.query(TransferRequest).filter(
        TransferRequest.status.in_([TransferStatus.PENDING_APPROVAL, TransferStatus.AWAITING_APPROVAL])
    )
    if current_user.role == UserRole.HOD:
        query = query.filter(TransferRequest.requires_hod_approval == True, TransferRequest.hod_approval_status == "Pending")
    elif current_user.role == UserRole.PRINCIPAL:
        query = query.filter(TransferRequest.requires_principal_approval == True, TransferRequest.principal_approval_status == "Pending")
    
    return [_format_transfer_response(t) for t in query.order_by(TransferRequest.created_at.desc()).all()]

@router.get("/stock-movements", response_model=List[StockMovementResponse])
def get_stock_movements(
    lab_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(StockMovementLedger)
    if lab_id:
        query = query.filter((StockMovementLedger.from_lab_id == lab_id) | (StockMovementLedger.to_lab_id == lab_id))
    
    movements = query.order_by(StockMovementLedger.timestamp.desc()).limit(100).all()
    return [
        StockMovementResponse(
            id=m.id,
            item_type=m.item_type,
            item_id=m.item_id,
            item_name=m.item_name,
            from_lab_id=m.from_lab_id,
            from_lab_name=m.from_lab.name if m.from_lab else None,
            to_lab_id=m.to_lab_id,
            to_lab_name=m.to_lab.name if m.to_lab else None,
            quantity=m.quantity,
            reference_type=m.reference_type,
            reference_id=m.reference_id,
            user_id=m.user_id,
            user_name=m.user.full_name if m.user else None,
            notes=m.notes,
            timestamp=m.timestamp
        ) for m in movements
    ]

@router.get("/export-csv")
def export_transfers_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TransferRequest)
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(
            (TransferRequest.source_lab_id.in_(assigned_ids)) |
            (TransferRequest.destination_lab_id.in_(assigned_ids))
        )
    transfers = query.order_by(TransferRequest.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transfer Request #", "Date", "Priority", "Status",
        "Source Lab", "Destination Lab", "Item Type", "Item Name / Asset ID",
        "Quantity", "Requester", "Reason", "HOD Status", "Principal Status",
        "Dispatched At", "Received At", "Condition / Notes"
    ])

    for t in transfers:
        item_desc = t.asset.asset_id if t.asset else (t.bulk_item.name if t.bulk_item else "N/A")
        item_type = "Serialized Asset" if t.asset else "Bulk Stock"
        writer.writerow([
            t.request_number,
            t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else "",
            t.priority,
            t.status.value if hasattr(t.status, 'value') else str(t.status),
            t.source_lab.name if t.source_lab else f"Lab {t.source_lab_id}",
            t.destination_lab.name if t.destination_lab else f"Lab {t.destination_lab_id}",
            item_type,
            item_desc,
            t.quantity,
            t.requested_by.full_name if t.requested_by else f"User {t.requested_by_id}",
            t.reason,
            t.hod_approval_status,
            t.principal_approval_status,
            t.dispatched_at.strftime("%Y-%m-%d %H:%M:%S") if t.dispatched_at else "",
            t.received_at.strftime("%Y-%m-%d %H:%M:%S") if t.received_at else "",
            t.receipt_condition or t.dispatch_notes or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=SMVITM_Transfer_Report_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )

@router.get("/{transfer_id}", response_model=TransferResponse)
def get_transfer_by_id(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer request not found")
    if current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        if transfer.source_lab_id not in assigned_ids and transfer.destination_lab_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view transfer for this laboratory")
    return _format_transfer_response(transfer)

@router.post("", response_model=TransferResponse)
def request_transfer(
    payload: TransferRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    if not verify_lab_access(current_user, payload.source_lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for source laboratory")
    if payload.source_lab_id == payload.destination_lab_id:
        raise HTTPException(status_code=400, detail="Source and destination laboratories cannot be identical")

    # Validate stock existence and safety constraints
    if payload.asset_id:
        asset = db.query(Asset).filter(Asset.id == payload.asset_id, Asset.lab_id == payload.source_lab_id).first()
        if not asset or not asset.is_active:
            raise HTTPException(status_code=400, detail="Asset not found or inactive in source laboratory")

        if asset.status in [AssetStatus.RETIRED, AssetStatus.MISSING, AssetStatus.DAMAGED]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transfer equipment in '{asset.status.value}' state. Resolve asset condition first."
            )

        # Check for open fault reports
        open_faults = db.query(FaultReport).filter(
            FaultReport.asset_id == asset.id,
            FaultReport.status.notin_([FaultStatus.CLOSED, FaultStatus.REJECTED])
        ).count()
        if open_faults > 0 and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=400,
                detail=f"Equipment {asset.asset_id} has {open_faults} open fault ticket(s). Cannot transfer faulty equipment without administrative exception."
            )

        # Check if asset is already in an active transfer
        active_trf = db.query(TransferRequest).filter(
            TransferRequest.asset_id == asset.id,
            TransferRequest.status.in_([
                TransferStatus.PENDING_APPROVAL,
                TransferStatus.AWAITING_APPROVAL,
                TransferStatus.APPROVED,
                TransferStatus.AWAITING_DISPATCH,
                TransferStatus.DISPATCHED
            ])
        ).first()
        if active_trf:
            raise HTTPException(
                status_code=400,
                detail=f"Asset {asset.asset_id} is already in active transfer workflow ({active_trf.request_number})."
            )

    elif payload.bulk_id:
        bulk = db.query(BulkInventory).filter(BulkInventory.id == payload.bulk_id, BulkInventory.lab_id == payload.source_lab_id).first()
        if not bulk:
            raise HTTPException(status_code=400, detail="Bulk inventory item not found in source laboratory")
        if bulk.working_quantity < payload.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient working quantity in source lab. Requested: {payload.quantity}, Available: {bulk.working_quantity}"
            )
    else:
        raise HTTPException(status_code=400, detail="Must specify either an asset_id or bulk_id for transfer")

    initial_status = TransferStatus.DRAFT if payload.is_draft else TransferStatus.PENDING_APPROVAL
    req_number = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    transfer = TransferRequest(
        request_number=req_number,
        source_lab_id=payload.source_lab_id,
        destination_lab_id=payload.destination_lab_id,
        asset_id=payload.asset_id,
        bulk_id=payload.bulk_id,
        quantity=payload.quantity,
        requested_by_id=current_user.id,
        reason=payload.reason.strip(),
        priority=payload.priority or "Normal",
        notes=payload.notes.strip() if payload.notes else None,
        status=initial_status,
        requires_hod_approval=True,
        requires_principal_approval=False
    )
    db.add(transfer)
    db.flush()

    _log_transfer_history(
        db, transfer, current_user,
        action="Created Transfer Request" if not payload.is_draft else "Saved Transfer Draft",
        prev_status=None,
        new_status=initial_status.value,
        reason=transfer.reason
    )

    if not payload.is_draft:
        create_notification(
            db,
            title="Inter-Lab Transfer Awaiting Approval",
            message=f"Transfer request {transfer.request_number} submitted by {current_user.full_name} for review.",
            role=UserRole.HOD,
            link="/transfers"
        )

    db.commit()
    db.refresh(transfer)
    log_audit(db, "REQUEST_TRANSFER", "TransferRequest", str(transfer.id), current_user, f"Created transfer {transfer.request_number}")
    return _format_transfer_response(transfer)

@router.post("/{transfer_id}/submit", response_model=TransferResponse)
def submit_draft_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer request not found")
    if transfer.status != TransferStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft transfers can be submitted")
    if transfer.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only the author can submit this draft")

    prev_status = transfer.status.value
    transfer.status = TransferStatus.PENDING_APPROVAL
    
    _log_transfer_history(
        db, transfer, current_user,
        action="Submitted Transfer Request",
        prev_status=prev_status,
        new_status=TransferStatus.PENDING_APPROVAL.value,
        reason="Submitted for departmental review"
    )

    create_notification(
        db,
        title="Inter-Lab Transfer Awaiting Approval",
        message=f"Transfer request {transfer.request_number} submitted by {current_user.full_name} for review.",
        role=UserRole.HOD,
        link="/transfers"
    )

    db.commit()
    db.refresh(transfer)
    log_audit(db, "SUBMIT_TRANSFER", "TransferRequest", str(transfer.id), current_user, f"Submitted transfer {transfer.request_number}")
    return _format_transfer_response(transfer)

@router.post("/{transfer_id}/approve", response_model=TransferResponse)
def approve_or_reject_transfer(
    transfer_id: int,
    payload: TransferApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HOD, UserRole.PRINCIPAL, UserRole.ADMIN]))
):
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer request not found")

    if transfer.status not in [TransferStatus.PENDING_APPROVAL, TransferStatus.AWAITING_APPROVAL]:
        raise HTTPException(status_code=400, detail=f"Transfer request is in '{transfer.status.value}' and cannot be reviewed")

    # Anti-Self-Approval Guard: Requester cannot approve their own transfer unless Administrator
    if current_user.id == transfer.requested_by_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Conflict of Interest: You cannot approve your own transfer request. Approval must be conducted by Department HOD or Principal."
        )

    prev_status = transfer.status.value
    decision_stage = payload.stage or ("HOD Approval" if current_user.role == UserRole.HOD else "Institutional Approval")

    # Record Approval Decision in audit table
    approval_decision = TransferApprovalDecision(
        transfer_id=transfer.id,
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
            transfer.hod_approval_status = "Approved"
            transfer.hod_approved_by_id = current_user.id
            transfer.hod_remarks = payload.comments

        transfer.status = TransferStatus.APPROVED
        _log_transfer_history(
            db, transfer, current_user,
            action=f"Approved by {current_user.role.value}",
            prev_status=prev_status,
            new_status=TransferStatus.APPROVED.value,
            reason=payload.comments
        )

        create_notification(
            db,
            title="Transfer Request Approved",
            message=f"Transfer {transfer.request_number} was approved by {current_user.full_name}. Equipment is ready for dispatch.",
            user_id=transfer.requested_by_id,
            link="/transfers"
        )
        # Also notify source lab instructors to dispatch
        create_notification(
            db,
            title="Action Required: Dispatch Transfer Equipment",
            message=f"Transfer {transfer.request_number} approved. Please dispatch from Lab {transfer.source_lab_id}.",
            role=UserRole.LAB_INSTRUCTOR,
            link="/transfers"
        )

    elif payload.decision.lower() == "rejected":
        if not payload.rejection_reason or len(payload.rejection_reason.strip()) < 5:
            raise HTTPException(status_code=400, detail="A mandatory rejection reason (minimum 5 characters) is required.")

        transfer.rejection_reason = payload.rejection_reason.strip()
        transfer.status = TransferStatus.REJECTED

        if current_user.role == UserRole.HOD:
            transfer.hod_approval_status = "Rejected"
            transfer.hod_approved_by_id = current_user.id
            transfer.hod_remarks = payload.rejection_reason

        _log_transfer_history(
            db, transfer, current_user,
            action=f"Rejected by {current_user.role.value}",
            prev_status=prev_status,
            new_status=TransferStatus.REJECTED.value,
            reason=payload.rejection_reason
        )

        create_notification(
            db,
            title="Transfer Request Rejected",
            message=f"Transfer {transfer.request_number} was rejected by {current_user.full_name}. Reason: {payload.rejection_reason}",
            user_id=transfer.requested_by_id,
            link="/transfers"
        )
    else:
        # More Info Requested
        transfer.notes = f"More info requested by {current_user.full_name}: {payload.comments}"
        _log_transfer_history(
            db, transfer, current_user,
            action="Information Requested",
            prev_status=prev_status,
            new_status=transfer.status.value,
            reason=payload.comments
        )
        create_notification(
            db,
            title="More Information Needed for Transfer",
            message=f"Clarification requested for transfer {transfer.request_number}: {payload.comments}",
            user_id=transfer.requested_by_id,
            link="/transfers"
        )

    db.commit()
    db.refresh(transfer)
    log_audit(db, "TRANSFER_APPROVAL_DECISION", "TransferRequest", str(transfer.id), current_user, f"Decision: {payload.decision}")
    return _format_transfer_response(transfer)

# Backward compatibility endpoint
@router.put("/{transfer_id}/hod-approve", response_model=TransferResponse)
def hod_approve_transfer(
    transfer_id: int,
    payload: TransferApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HOD, UserRole.ADMIN]))
):
    approval_req = TransferApprovalRequest(
        decision=payload.status,
        stage="HOD Approval",
        comments=payload.remarks,
        rejection_reason=payload.remarks if payload.status.lower() == "rejected" else None
    )
    return approve_or_reject_transfer(transfer_id, approval_req, db, current_user)

@router.post("/{transfer_id}/dispatch", response_model=TransferResponse)
def dispatch_transfer(
    transfer_id: int,
    payload: Optional[TransferDispatchConfirm] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != TransferStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Transfer must be approved before dispatch")

    if not verify_lab_access(current_user, transfer.source_lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized to dispatch from source laboratory")

    prev_status = transfer.status.value
    transfer.status = TransferStatus.DISPATCHED
    transfer.dispatched_by_id = current_user.id
    transfer.dispatched_at = datetime.utcnow()
    transfer.dispatch_notes = payload.dispatch_notes if payload else None

    _log_transfer_history(
        db, transfer, current_user,
        action="Dispatched Equipment",
        prev_status=prev_status,
        new_status=TransferStatus.DISPATCHED.value,
        reason=transfer.dispatch_notes
    )

    # Notify destination lab instructor
    create_notification(
        db,
        title="Equipment Dispatched — Awaiting Receipt",
        message=f"Transfer {transfer.request_number} has been dispatched from Lab {transfer.source_lab_id}. Please confirm receipt upon arrival in Lab {transfer.destination_lab_id}.",
        role=UserRole.LAB_INSTRUCTOR,
        link="/transfers"
    )

    db.commit()
    db.refresh(transfer)
    log_audit(db, "DISPATCH_TRANSFER", "TransferRequest", str(transfer.id), current_user, f"Dispatched {transfer.request_number}")
    return _format_transfer_response(transfer)

@router.post("/{transfer_id}/receive", response_model=TransferResponse)
def receive_transfer(
    transfer_id: int,
    payload: Optional[TransferReceiptConfirm] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    # Concurrency safe: lock row
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).with_for_update().first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != TransferStatus.DISPATCHED:
        raise HTTPException(status_code=400, detail="Transfer must be dispatched before receiving")
    if not verify_lab_access(current_user, transfer.destination_lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for destination laboratory")

    prev_status = transfer.status.value
    condition = payload.condition if payload else "Good"
    notes = payload.discrepancy_notes if payload else None

    # Perform official stock relocation safely inside transaction
    if transfer.asset_id:
        asset = db.query(Asset).filter(Asset.id == transfer.asset_id).with_for_update().first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset associated with transfer was not found")
        
        old_lab_id = asset.lab_id
        asset.lab_id = transfer.destination_lab_id
        asset.location_in_lab = f"Transferred from Lab {transfer.source_lab_id}"
        
        # Log Inventory History for serialized asset
        db.add(InventoryHistory(
            asset_id=asset.id,
            user_id=current_user.id,
            action="Inter-Lab Relocation",
            previous_status=asset.status.value,
            new_status=asset.status.value,
            reason=f"Transferred from Lab {transfer.source_lab_id} to Lab {transfer.destination_lab_id} via {transfer.request_number}. Condition: {condition}"
        ))

        # Log Stock Movement Ledger
        db.add(StockMovementLedger(
            item_type="Asset",
            item_id=asset.id,
            item_name=asset.name,
            from_lab_id=old_lab_id,
            to_lab_id=transfer.destination_lab_id,
            quantity=1,
            reference_type="Transfer",
            reference_id=transfer.request_number,
            user_id=current_user.id,
            notes=f"Condition: {condition}. {notes or ''}",
            timestamp=datetime.utcnow()
        ))

    elif transfer.bulk_id:
        source_bulk = db.query(BulkInventory).filter(BulkInventory.id == transfer.bulk_id).with_for_update().first()
        if not source_bulk:
            raise HTTPException(status_code=404, detail="Source bulk inventory record not found")
        if source_bulk.working_quantity < transfer.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot complete transfer: source lab stock has changed. Required: {transfer.quantity}, Available: {source_bulk.working_quantity}"
            )

        source_bulk.working_quantity -= transfer.quantity
        source_bulk.total_quantity -= transfer.quantity
        
        # Find or create destination bulk item
        dest_bulk = db.query(BulkInventory).filter(
            BulkInventory.lab_id == transfer.destination_lab_id,
            BulkInventory.name == source_bulk.name
        ).with_for_update().first()

        if dest_bulk:
            dest_bulk.working_quantity += transfer.quantity
            dest_bulk.total_quantity += transfer.quantity
        else:
            dest_bulk = BulkInventory(
                name=source_bulk.name,
                category=source_bulk.category,
                department_id=source_bulk.department_id,
                lab_id=transfer.destination_lab_id,
                total_quantity=transfer.quantity,
                working_quantity=transfer.quantity,
                damaged_quantity=0,
                missing_quantity=0,
                under_repair_quantity=0,
                min_threshold=source_bulk.min_threshold,
                qr_code=f"BULK:{transfer.destination_lab_id}:{source_bulk.name.replace(' ', '_').upper()}"
            )
            db.add(dest_bulk)

        # Log Stock Movement Ledger
        db.add(StockMovementLedger(
            item_type="Bulk",
            item_id=source_bulk.id,
            item_name=source_bulk.name,
            from_lab_id=transfer.source_lab_id,
            to_lab_id=transfer.destination_lab_id,
            quantity=transfer.quantity,
            reference_type="Transfer",
            reference_id=transfer.request_number,
            user_id=current_user.id,
            notes=f"Bulk stock transferred. Condition: {condition}. {notes or ''}",
            timestamp=datetime.utcnow()
        ))

    final_status = TransferStatus.COMPLETED
    if condition in ["Damaged", "Discrepancy"]:
        final_status = TransferStatus.DISPUTED

    transfer.status = final_status
    transfer.received_by_id = current_user.id
    transfer.received_at = datetime.utcnow()
    transfer.receipt_condition = condition
    transfer.receipt_discrepancy_notes = notes

    _log_transfer_history(
        db, transfer, current_user,
        action="Received Equipment",
        prev_status=prev_status,
        new_status=final_status.value,
        reason=f"Condition: {condition}. {notes or ''}"
    )

    create_notification(
        db,
        title="Transfer Completed" if final_status == TransferStatus.COMPLETED else "Transfer Disputed / Damaged",
        message=f"Transfer {transfer.request_number} acknowledged at Lab {transfer.destination_lab_id} (Status: {final_status.value}).",
        user_id=transfer.requested_by_id,
        link="/transfers"
    )

    db.commit()
    db.refresh(transfer)
    log_audit(db, "RECEIVE_TRANSFER", "TransferRequest", str(transfer.id), current_user, f"Received {transfer.request_number} with status {final_status.value}")
    return _format_transfer_response(transfer)

@router.post("/{transfer_id}/cancel", response_model=TransferResponse)
def cancel_transfer(
    transfer_id: int,
    payload: TransferCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = db.query(TransferRequest).filter(TransferRequest.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status in [TransferStatus.DISPATCHED, TransferStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Cannot cancel transfer that has already been dispatched or completed")
    if transfer.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only requester or admin may cancel this request")

    prev_status = transfer.status.value
    transfer.status = TransferStatus.CANCELLED
    transfer.cancellation_reason = payload.cancellation_reason

    _log_transfer_history(
        db, transfer, current_user,
        action="Cancelled Transfer",
        prev_status=prev_status,
        new_status=TransferStatus.CANCELLED.value,
        reason=payload.cancellation_reason
    )

    db.commit()
    db.refresh(transfer)
    log_audit(db, "CANCEL_TRANSFER", "TransferRequest", str(transfer.id), current_user, f"Cancelled {transfer.request_number}")
    return _format_transfer_response(transfer)
