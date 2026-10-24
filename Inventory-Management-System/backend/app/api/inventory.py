from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
import io
import csv
import math
from datetime import datetime
from app.core.database import get_db
from app.core.permissions import get_current_user, require_roles, verify_lab_access
from app.models.models import (
    Asset, BulkInventory, InventoryHistory, Laboratory, User, UserRole, AssetStatus, FaultReport, FaultStatus, TransferRequest
)
from app.schemas.schemas import (
    AssetCreate, AssetUpdate, AssetStatusUpdate, AssetResponse, AssetDetailResponse,
    PaginatedAssetResponse, InventorySummaryResponse,
    BulkInventoryCreate, BulkInventoryAdjust, BulkInventoryResponse,
    InventoryHistoryResponse
)
from app.services.qr_service import generate_qr_base64
from app.services.audit_service import log_audit
from app.services.notification_service import create_notification

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])

# Validated status transition rules matrix
VALID_TRANSITIONS = {
    AssetStatus.WORKING: [AssetStatus.FAULT_REPORTED, AssetStatus.DAMAGED, AssetStatus.MISSING, AssetStatus.RETIRED],
    AssetStatus.FAULT_REPORTED: [AssetStatus.UNDER_REPAIR, AssetStatus.WORKING, AssetStatus.DAMAGED, AssetStatus.REPLACEMENT_REQUESTED, AssetStatus.RETIRED],
    AssetStatus.UNDER_REPAIR: [AssetStatus.WORKING, AssetStatus.DAMAGED, AssetStatus.REPLACEMENT_REQUESTED, AssetStatus.RETIRED],
    AssetStatus.DAMAGED: [AssetStatus.UNDER_REPAIR, AssetStatus.REPLACEMENT_REQUESTED, AssetStatus.WORKING, AssetStatus.RETIRED],
    AssetStatus.MISSING: [AssetStatus.WORKING, AssetStatus.RETIRED],
    AssetStatus.REPLACEMENT_REQUESTED: [AssetStatus.WORKING, AssetStatus.RETIRED],
    AssetStatus.RETIRED: [] # Immutable by default
}

def _asset_to_response_dict(asset: Asset) -> dict:
    return {
        "id": asset.id,
        "asset_id": asset.asset_id,
        "name": asset.name,
        "category": asset.category,
        "serial_number": asset.serial_number,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "department_id": asset.department_id,
        "lab_id": asset.lab_id,
        "lab_name": asset.laboratory.name if asset.laboratory else f"Lab {asset.lab_id}",
        "location_in_lab": asset.location_in_lab,
        "purchase_date": asset.purchase_date,
        "purchase_cost": asset.purchase_cost,
        "warranty_expiry": asset.warranty_expiry,
        "status": asset.status,
        "qr_code": asset.qr_code,
        "is_active": asset.is_active,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at
    }

def _bulk_to_response_dict(b: BulkInventory) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "category": b.category,
        "department_id": b.department_id,
        "lab_id": b.lab_id,
        "lab_name": b.laboratory.name if b.laboratory else f"Lab {b.lab_id}",
        "total_quantity": b.total_quantity,
        "working_quantity": b.working_quantity,
        "damaged_quantity": b.damaged_quantity,
        "missing_quantity": b.missing_quantity,
        "under_repair_quantity": b.under_repair_quantity,
        "min_threshold": b.min_threshold,
        "is_low_stock": b.working_quantity < b.min_threshold,
        "qr_code": b.qr_code,
        "created_at": b.created_at,
        "updated_at": b.updated_at
    }

# --- Summary Metrics ---
@router.get("/summary", response_model=InventorySummaryResponse)
def get_inventory_summary(
    lab_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Asset)
    bulk_query = db.query(BulkInventory)

    if lab_id:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized to access this laboratory")
        query = query.filter(Asset.lab_id == lab_id)
        bulk_query = bulk_query.filter(BulkInventory.lab_id == lab_id)
    elif current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(Asset.lab_id.in_(assigned_ids))
        bulk_query = bulk_query.filter(BulkInventory.lab_id.in_(assigned_ids))

    total_active = query.filter(Asset.is_active == True, Asset.status != AssetStatus.RETIRED).count()
    working = query.filter(Asset.status == AssetStatus.WORKING).count()
    damaged = query.filter(Asset.status == AssetStatus.DAMAGED).count()
    missing = query.filter(Asset.status == AssetStatus.MISSING).count()
    under_repair = query.filter(Asset.status == AssetStatus.UNDER_REPAIR).count()
    fault_reported = query.filter(Asset.status == AssetStatus.FAULT_REPORTED).count()
    retired = query.filter(Asset.status == AssetStatus.RETIRED).count()

    all_bulk = bulk_query.all()
    low_stock = sum(1 for b in all_bulk if b.working_quantity < b.min_threshold)

    return {
        "total_active_assets": total_active,
        "working_assets": working,
        "damaged_assets": damaged,
        "missing_assets": missing,
        "under_repair_assets": under_repair,
        "fault_reported_assets": fault_reported,
        "retired_assets": retired,
        "low_stock_bulk_items": low_stock
    }

# --- Tracked Assets (Paginated & Filtered) ---
@router.get("/assets", response_model=PaginatedAssetResponse)
def get_assets(
    lab_id: Optional[int] = Query(None),
    status: Optional[AssetStatus] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_retired: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Asset)
    
    if not include_retired and status != AssetStatus.RETIRED:
        query = query.filter(Asset.status != AssetStatus.RETIRED, Asset.is_active == True)

    if lab_id:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized to access this laboratory")
        query = query.filter(Asset.lab_id == lab_id)
    elif current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(Asset.lab_id.in_(assigned_ids))

    if status:
        query = query.filter(Asset.status == status)
    if category:
        query = query.filter(Asset.category.ilike(f"%{category}%"))
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (Asset.name.ilike(search_term)) |
            (Asset.asset_id.ilike(search_term)) |
            (Asset.serial_number.ilike(search_term)) |
            (Asset.location_in_lab.ilike(search_term))
        )

    total = query.count()

    # Sorting
    sort_column = getattr(Asset, sort_by, Asset.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    total_pages = max(1, math.ceil(total / page_size))
    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()

    items = [_asset_to_response_dict(a) for a in records]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/assets/{asset_id}", response_model=AssetResponse)
def get_asset_by_id(asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not verify_lab_access(current_user, asset.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized to access this laboratory")
    return _asset_to_response_dict(asset)

@router.get("/assets/{asset_id}/details", response_model=AssetDetailResponse)
def get_asset_details(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not verify_lab_access(current_user, asset.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized to access this laboratory")

    histories = db.query(InventoryHistory).filter(InventoryHistory.asset_id == asset.id).order_by(desc(InventoryHistory.timestamp)).all()
    history_list = []
    for h in histories:
        history_list.append({
            "id": h.id,
            "asset_id": h.asset_id,
            "bulk_id": h.bulk_id,
            "user_id": h.user_id,
            "user_name": h.user.full_name if h.user else "System",
            "action": h.action,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "quantity_changed": h.quantity_changed,
            "reason": h.reason,
            "timestamp": h.timestamp
        })

    active_fault = db.query(FaultReport).filter(
        FaultReport.asset_id == asset.id,
        FaultReport.status.notin_([FaultStatus.RESOLVED, FaultStatus.CLOSED])
    ).first()

    base_dict = _asset_to_response_dict(asset)
    base_dict.update({
        "laboratory_name": asset.laboratory.name if asset.laboratory else f"Lab {asset.lab_id}",
        "department_name": asset.laboratory.department.name if (asset.laboratory and asset.laboratory.department) else "AI & DS",
        "history": history_list,
        "active_fault": active_fault
    })
    return base_dict

@router.post("/assets", response_model=AssetResponse)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    if not verify_lab_access(current_user, payload.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    clean_asset_id = payload.asset_id.strip()
    existing = db.query(Asset).filter(Asset.asset_id == clean_asset_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Asset ID '{clean_asset_id}' is already registered")

    if payload.serial_number and payload.serial_number.strip():
        clean_sn = payload.serial_number.strip()
        existing_sn = db.query(Asset).filter(Asset.serial_number == clean_sn).first()
        if existing_sn:
            raise HTTPException(status_code=400, detail=f"Serial Number '{clean_sn}' is already registered to another asset ({existing_sn.asset_id})")

    qr_token = f"ASSET:{clean_asset_id}"
    new_asset = Asset(
        asset_id=clean_asset_id,
        name=payload.name.strip(),
        category=payload.category.strip(),
        serial_number=payload.serial_number.strip() if payload.serial_number else None,
        manufacturer=payload.manufacturer.strip() if payload.manufacturer else None,
        model=payload.model.strip() if payload.model else None,
        department_id=payload.department_id,
        lab_id=payload.lab_id,
        location_in_lab=payload.location_in_lab.strip() if payload.location_in_lab else None,
        purchase_date=payload.purchase_date,
        purchase_cost=payload.purchase_cost,
        warranty_expiry=payload.warranty_expiry,
        status=payload.status or AssetStatus.WORKING,
        qr_code=qr_token,
        is_active=True
    )
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)

    # Initial history log
    history = InventoryHistory(
        asset_id=new_asset.id,
        user_id=current_user.id,
        action="Registration",
        new_status=new_asset.status.value,
        reason="Initial asset registration"
    )
    db.add(history)
    db.commit()

    log_audit(db, "CREATE_ASSET", "Asset", str(new_asset.id), current_user, f"Registered asset {new_asset.asset_id}")
    return _asset_to_response_dict(new_asset)

@router.put("/assets/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not verify_lab_access(current_user, asset.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    if payload.lab_id and payload.lab_id != asset.lab_id:
        if not verify_lab_access(current_user, payload.lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized for destination laboratory")
        asset.lab_id = payload.lab_id

    if payload.serial_number is not None and payload.serial_number.strip():
        clean_sn = payload.serial_number.strip()
        existing_sn = db.query(Asset).filter(Asset.serial_number == clean_sn, Asset.id != asset.id).first()
        if existing_sn:
            raise HTTPException(status_code=400, detail=f"Serial Number '{clean_sn}' is already registered to {existing_sn.asset_id}")
        asset.serial_number = clean_sn
    elif payload.serial_number == "":
        asset.serial_number = None

    if payload.name:
        asset.name = payload.name.strip()
    if payload.category:
        asset.category = payload.category.strip()
    if payload.manufacturer is not None:
        asset.manufacturer = payload.manufacturer.strip() if payload.manufacturer else None
    if payload.model is not None:
        asset.model = payload.model.strip() if payload.model else None
    if payload.location_in_lab is not None:
        asset.location_in_lab = payload.location_in_lab.strip() if payload.location_in_lab else None
    if payload.purchase_date is not None:
        asset.purchase_date = payload.purchase_date
    if payload.purchase_cost is not None:
        asset.purchase_cost = payload.purchase_cost
    if payload.warranty_expiry is not None:
        asset.warranty_expiry = payload.warranty_expiry

    db.commit()
    db.refresh(asset)

    history = InventoryHistory(
        asset_id=asset.id,
        user_id=current_user.id,
        action="Metadata Edit",
        reason=payload.reason or "Asset details updated"
    )
    db.add(history)
    db.commit()

    log_audit(db, "UPDATE_ASSET", "Asset", str(asset.id), current_user, f"Updated asset {asset.asset_id}")
    return _asset_to_response_dict(asset)

@router.put("/assets/{asset_id}/status", response_model=AssetResponse)
def update_asset_status(
    asset_id: int,
    payload: AssetStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.TECHNICIAN, UserRole.ADMIN]))
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not verify_lab_access(current_user, asset.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    if not payload.reason or len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A descriptive reason (at least 3 characters) is required for status transitions.")

    prev_status = asset.status
    if prev_status == payload.status:
        return _asset_to_response_dict(asset)

    # Validated transition matrix check
    allowed_next = VALID_TRANSITIONS.get(prev_status, [])
    # Only Admin can reactivate retired assets
    if prev_status == AssetStatus.RETIRED and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=400,
            detail=f"Asset {asset.asset_id} is retired. Only an Administrator can reactivate retired equipment."
        )
    elif prev_status != AssetStatus.RETIRED and payload.status not in allowed_next and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from '{prev_status.value}' to '{payload.status.value}'. Allowed transitions: {[s.value for s in allowed_next]}"
        )

    asset.status = payload.status
    
    # Retirement preserves history and keeps record intact
    if payload.status == AssetStatus.RETIRED:
        asset.is_active = False
    else:
        asset.is_active = True

    history = InventoryHistory(
        asset_id=asset.id,
        user_id=current_user.id,
        action="Status Update",
        previous_status=prev_status.value,
        new_status=payload.status.value,
        reason=payload.reason.strip()
    )
    db.add(history)
    db.commit()
    db.refresh(asset)

    log_audit(db, "UPDATE_ASSET_STATUS", "Asset", str(asset.id), current_user, f"Status changed from {prev_status.value} to {payload.status.value}. Reason: {payload.reason}")
    return _asset_to_response_dict(asset)

# --- Bulk Inventory ---
@router.get("/bulk", response_model=List[BulkInventoryResponse])
def get_bulk_inventory(
    lab_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(BulkInventory)
    if lab_id:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized for this laboratory")
        query = query.filter(BulkInventory.lab_id == lab_id)
    elif current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(BulkInventory.lab_id.in_(assigned_ids))

    items = query.all()
    return [_bulk_to_response_dict(b) for b in items]

@router.post("/bulk", response_model=BulkInventoryResponse)
def create_bulk_inventory(
    payload: BulkInventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    if not verify_lab_access(current_user, payload.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    calculated_total = (payload.working_quantity + payload.damaged_quantity +
                        payload.missing_quantity + payload.under_repair_quantity)
    if calculated_total != payload.total_quantity:
        raise HTTPException(status_code=400, detail="Quantities do not sum to total quantity")

    qr_token = f"BULK:{payload.lab_id}:{payload.name.replace(' ', '_').upper()}"
    new_bulk = BulkInventory(
        name=payload.name.strip(),
        category=payload.category.strip(),
        department_id=payload.department_id,
        lab_id=payload.lab_id,
        total_quantity=payload.total_quantity,
        working_quantity=payload.working_quantity,
        damaged_quantity=payload.damaged_quantity,
        missing_quantity=payload.missing_quantity,
        under_repair_quantity=payload.under_repair_quantity,
        min_threshold=payload.min_threshold,
        qr_code=qr_token
    )
    db.add(new_bulk)
    db.commit()
    db.refresh(new_bulk)

    history = InventoryHistory(
        bulk_id=new_bulk.id,
        user_id=current_user.id,
        action="Registration",
        quantity_changed=new_bulk.total_quantity,
        reason="Initial bulk inventory setup"
    )
    db.add(history)
    db.commit()

    log_audit(db, "CREATE_BULK", "BulkInventory", str(new_bulk.id), current_user, f"Created bulk {new_bulk.name} (Total: {new_bulk.total_quantity})")
    return _bulk_to_response_dict(new_bulk)

@router.put("/bulk/{bulk_id}/adjust", response_model=BulkInventoryResponse)
def adjust_bulk_inventory(
    bulk_id: int,
    payload: BulkInventoryAdjust,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.LAB_INSTRUCTOR, UserRole.ADMIN]))
):
    item = db.query(BulkInventory).filter(BulkInventory.id == bulk_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Bulk item not found")
    if not verify_lab_access(current_user, item.lab_id, db):
        raise HTTPException(status_code=403, detail="Not authorized for this laboratory")

    if not payload.reason or len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A descriptive reason is required for inventory adjustments.")

    new_total = (payload.working_quantity + payload.damaged_quantity +
                 payload.missing_quantity + payload.under_repair_quantity)
    if new_total < 0:
        raise HTTPException(status_code=400, detail="Invalid negative quantities")

    prev_working = item.working_quantity
    item.total_quantity = new_total
    item.working_quantity = payload.working_quantity
    item.damaged_quantity = payload.damaged_quantity
    item.missing_quantity = payload.missing_quantity
    item.under_repair_quantity = payload.under_repair_quantity

    history = InventoryHistory(
        bulk_id=item.id,
        user_id=current_user.id,
        action="Bulk Adjustment",
        quantity_changed=payload.working_quantity - prev_working,
        reason=payload.reason.strip()
    )
    db.add(history)
    db.commit()
    db.refresh(item)

    # Check for low-stock threshold alert
    if item.working_quantity < item.min_threshold:
        create_notification(
            db,
            title="Low-Stock Alert",
            message=f"Working quantity of {item.name} in Lab {item.lab_id} is {item.working_quantity}, below minimum threshold of {item.min_threshold}.",
            role=UserRole.LAB_INSTRUCTOR,
            link=f"/inventory?lab={item.lab_id}"
        )

    log_audit(db, "ADJUST_BULK", "BulkInventory", str(item.id), current_user, f"Adjusted {item.name}. Reason: {payload.reason}")
    return _bulk_to_response_dict(item)

@router.get("/history/{asset_id}", response_model=List[InventoryHistoryResponse])
def get_asset_history(asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    histories = db.query(InventoryHistory).filter(InventoryHistory.asset_id == asset_id).order_by(desc(InventoryHistory.timestamp)).all()
    return [
        {
            "id": h.id,
            "asset_id": h.asset_id,
            "bulk_id": h.bulk_id,
            "user_id": h.user_id,
            "user_name": h.user.full_name if h.user else "System",
            "action": h.action,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "quantity_changed": h.quantity_changed,
            "reason": h.reason,
            "timestamp": h.timestamp
        }
        for h in histories
    ]

# --- Delete / Remove Equipment ---
@router.delete("/assets/{asset_id}")
def remove_asset(
    asset_id: int,
    reason: Optional[str] = Query(None),
    permanent: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.LAB_INSTRUCTOR]))
):
    """
    Removes or decommissions equipment from active laboratory inventory.
    Instructors can remove equipment from their assigned labs. Admins can remove any asset.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if current_user.role == UserRole.LAB_INSTRUCTOR:
        if not verify_lab_access(current_user, asset.lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized to remove equipment from this laboratory")

    removal_reason = (reason or "").strip() or "Equipment decommissioned and removed by faculty/administrator"
    prev_status = asset.status.value if asset.status else "WORKING"

    # Optional permanent deletion for Admin if no linked records exist
    if permanent and current_user.role == UserRole.ADMIN:
        has_faults = db.query(FaultReport).filter(FaultReport.asset_id == asset.id).first()
        has_transfers = db.query(TransferRequest).filter(TransferRequest.asset_id == asset.id).first()
        if not has_faults and not has_transfers:
            db.query(InventoryHistory).filter(InventoryHistory.asset_id == asset.id).delete()
            asset_tag = asset.asset_id
            asset_name = asset.name
            db.delete(asset)
            db.commit()
            log_audit(db, "PURGE_ASSET", "Asset", str(asset_id), current_user, f"Permanently purged asset {asset_tag} ({asset_name})")
            return {
                "message": f"Asset {asset_tag} permanently deleted from database.",
                "asset_id": asset_id,
                "mode": "permanent"
            }

    # Standard safe removal (soft-archive & decommission, preserving audit compliance)
    asset.is_active = False
    asset.status = AssetStatus.RETIRED

    history = InventoryHistory(
        asset_id=asset.id,
        user_id=current_user.id,
        action="REMOVED / DECOMMISSIONED",
        previous_status=prev_status,
        new_status=AssetStatus.RETIRED.value,
        reason=removal_reason
    )
    db.add(history)
    db.commit()

    lab_name = asset.laboratory.name if asset.laboratory else f"Lab {asset.lab_id}"
    log_audit(
        db,
        "REMOVE_ASSET",
        "Asset",
        str(asset.id),
        current_user,
        f"Removed equipment {asset.asset_id} ({asset.name}) from {lab_name}: {removal_reason}"
    )

    return {
        "message": f"Equipment {asset.asset_id} successfully removed from active inventory.",
        "asset_id": asset.id,
        "status": AssetStatus.RETIRED.value,
        "mode": "archived"
    }

# --- Delete / Remove Bulk Inventory Category ---
@router.delete("/bulk/{bulk_id}")
def remove_bulk_item(
    bulk_id: int,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.LAB_INSTRUCTOR]))
):
    """Removes a bulk inventory category from active laboratory stock."""
    bulk = db.query(BulkInventory).filter(BulkInventory.id == bulk_id).first()
    if not bulk:
        raise HTTPException(status_code=404, detail="Bulk item not found")

    if current_user.role == UserRole.LAB_INSTRUCTOR:
        if not verify_lab_access(current_user, bulk.lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized to remove bulk stock from this laboratory")

    removal_reason = (reason or "").strip() or "Removed by authorized faculty"
    name = bulk.name
    category = bulk.category

    db.delete(bulk)
    db.commit()

    log_audit(
        db,
        "REMOVE_BULK",
        "BulkInventory",
        str(bulk_id),
        current_user,
        f"Removed bulk stock category '{name}' ({category}): {removal_reason}"
    )

    return {
        "message": f"Bulk category '{name}' removed from inventory.",
        "bulk_id": bulk_id
    }

# --- CSV Export ---
@router.get("/export-csv")
def export_inventory_csv(
    lab_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Asset)
    if lab_id:
        if not verify_lab_access(current_user, lab_id, db):
            raise HTTPException(status_code=403, detail="Not authorized")
        query = query.filter(Asset.lab_id == lab_id)
    elif current_user.role == UserRole.LAB_INSTRUCTOR:
        assigned_ids = [l.id for l in current_user.assigned_labs]
        query = query.filter(Asset.lab_id.in_(assigned_ids))

    assets = query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Asset ID", "Name", "Category", "Lab", "Location", "Status", "Serial Number", "Manufacturer", "Model", "Purchase Cost (INR)", "Purchase Date"])

    for a in assets:
        writer.writerow([
            a.asset_id,
            a.name,
            a.category,
            a.laboratory.name if a.laboratory else f"Lab {a.lab_id}",
            a.location_in_lab or "",
            a.status.value,
            a.serial_number or "",
            a.manufacturer or "",
            a.model or "",
            f"{a.purchase_cost:.2f}" if a.purchase_cost is not None else "",
            a.purchase_date.strftime("%Y-%m-%d") if a.purchase_date else ""
        ])

    output.seek(0)
    filename = f"SMVITM_Inventory_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
