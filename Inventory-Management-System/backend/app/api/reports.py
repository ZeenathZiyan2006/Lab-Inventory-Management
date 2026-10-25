from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from app.core.database import get_db
from app.core.permissions import get_current_user, require_roles
from app.models.models import (
    Asset, BulkInventory, FaultReport, RepairJob, TransferRequest, PurchaseRequest,
    Laboratory, User, UserRole, AssetStatus, FaultStatus, TransferStatus, PurchaseStatus, AuditLog
)

router = APIRouter(prefix="/reports", tags=["Reports and Dashboards"])

@router.get("/dashboard-stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Provides role-customized, real database-backed aggregate metrics."""
    # Scope check
    if current_user.role in [UserRole.ADMIN, UserRole.HOD, UserRole.PRINCIPAL, UserRole.TECHNICIAN]:
        authorized_labs = db.query(Laboratory).all()
    else:
        authorized_labs = current_user.assigned_labs
    
    auth_lab_ids = [l.id for l in authorized_labs]

    # Universal stock aggregations
    assets_working = db.query(Asset).filter(Asset.lab_id.in_(auth_lab_ids), Asset.status == AssetStatus.WORKING, Asset.is_active == True).count()
    assets_fault = db.query(Asset).filter(Asset.lab_id.in_(auth_lab_ids), Asset.status == AssetStatus.FAULT_REPORTED, Asset.is_active == True).count()
    assets_repair = db.query(Asset).filter(Asset.lab_id.in_(auth_lab_ids), Asset.status == AssetStatus.UNDER_REPAIR, Asset.is_active == True).count()
    assets_damaged = db.query(Asset).filter(Asset.lab_id.in_(auth_lab_ids), Asset.status == AssetStatus.DAMAGED, Asset.is_active == True).count()
    assets_missing = db.query(Asset).filter(Asset.lab_id.in_(auth_lab_ids), Asset.status == AssetStatus.MISSING, Asset.is_active == True).count()
    total_assets = assets_working + assets_fault + assets_repair + assets_damaged + assets_missing

    # Bulk quantities
    bulk_working = db.query(func.coalesce(func.sum(BulkInventory.working_quantity), 0)).filter(BulkInventory.lab_id.in_(auth_lab_ids)).scalar()
    bulk_damaged = db.query(func.coalesce(func.sum(BulkInventory.damaged_quantity), 0)).filter(BulkInventory.lab_id.in_(auth_lab_ids)).scalar()
    bulk_missing = db.query(func.coalesce(func.sum(BulkInventory.missing_quantity), 0)).filter(BulkInventory.lab_id.in_(auth_lab_ids)).scalar()
    bulk_repair = db.query(func.coalesce(func.sum(BulkInventory.under_repair_quantity), 0)).filter(BulkInventory.lab_id.in_(auth_lab_ids)).scalar()

    # Faults
    open_faults = db.query(FaultReport).filter(
        FaultReport.lab_id.in_(auth_lab_ids),
        FaultReport.status.notin_([FaultStatus.CLOSED, FaultStatus.RESOLVED])
    ).count()

    # Pending approvals
    pending_transfers = db.query(TransferRequest).filter(TransferRequest.status == TransferStatus.PENDING_APPROVAL).count()
    pending_purchases = db.query(PurchaseRequest).filter(PurchaseRequest.status == PurchaseStatus.PENDING_APPROVAL).count()

    # Low stock bulk items count
    low_stock_items = db.query(BulkInventory).filter(
        BulkInventory.lab_id.in_(auth_lab_ids),
        BulkInventory.working_quantity < BulkInventory.min_threshold
    ).count()

    # Technician specific stats
    tech_assigned = 0
    tech_in_progress = 0
    if current_user.role == UserRole.TECHNICIAN:
        tech_assigned = db.query(RepairJob).filter(RepairJob.technician_id == current_user.id, RepairJob.status == FaultStatus.ASSIGNED).count()
        tech_in_progress = db.query(RepairJob).filter(RepairJob.technician_id == current_user.id, RepairJob.status == FaultStatus.IN_PROGRESS).count()

    # Category breakdown for charts
    category_counts = db.query(
        Asset.category,
        func.count(Asset.id)
    ).filter(Asset.lab_id.in_(auth_lab_ids), Asset.is_active == True).group_by(Asset.category).all()

    category_data = [{"category": c[0], "count": c[1]} for c in category_counts]

    # Lab breakdown
    lab_breakdown = []
    for lab in authorized_labs:
        lab_assets = db.query(Asset).filter(Asset.lab_id == lab.id, Asset.is_active == True).count()
        lab_faults = db.query(FaultReport).filter(FaultReport.lab_id == lab.id, FaultReport.status.notin_([FaultStatus.CLOSED])).count()
        lab_breakdown.append({
            "lab_id": lab.id,
            "name": lab.name,
            "code": lab.code,
            "total_assets": lab_assets,
            "open_faults": lab_faults
        })

    return {
        "role": current_user.role.value,
        "total_assets": total_assets,
        "assets_working": assets_working,
        "assets_fault": assets_fault,
        "assets_repair": assets_repair,
        "assets_damaged": assets_damaged,
        "assets_missing": assets_missing,
        "bulk_working": bulk_working,
        "bulk_damaged": bulk_damaged,
        "bulk_missing": bulk_missing,
        "bulk_repair": bulk_repair,
        "open_faults": open_faults,
        "low_stock_items": low_stock_items,
        "pending_transfers": pending_transfers,
        "pending_purchases": pending_purchases,
        "tech_assigned": tech_assigned,
        "tech_in_progress": tech_in_progress,
        "category_data": category_data,
        "lab_breakdown": lab_breakdown
    }
