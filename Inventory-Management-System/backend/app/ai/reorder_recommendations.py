"""
Explainable Reorder Recommendation Engine for SMVITM Inventory Management System
Analyzes current stock levels, safety thresholds, and outstanding approved purchase orders.
Includes strict deduplication against existing Purchase Orders.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import BulkInventory, PurchaseRequest, PurchaseStatus, Laboratory

SAFETY_POLICY_NOTICE = (
    "MANDATORY HUMAN-IN-THE-LOOP SAFETY DIRECTIVE: "
    "The AI recommendation engine is an advisory decision-support tool only. "
    "It must NEVER automatically submit, approve, or place a purchase order. "
    "All requisitions require review and formal sanction by authorized college personnel (HOD and Principal)."
)

def generate_reorder_recommendations(db: Session, lab_id: int = None) -> List[Dict[str, Any]]:
    """
    Generates explainable replenishment recommendations for inventory items.
    Deduplicates against outstanding approved purchase orders.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    
    query = db.query(BulkInventory)
    if lab_id is not None:
        query = query.filter(BulkInventory.lab_id == lab_id)
    
    items = query.all()
    recommendations = []

    for item in items:
        lab = db.query(Laboratory).filter(Laboratory.id == item.lab_id).first()
        lab_name = lab.name if lab else f"Laboratory {item.lab_id}"
        
        current_stock = item.working_quantity
        threshold = item.min_threshold
        shortfall = max(0, threshold - current_stock)

        # Query outstanding approved or in-procurement purchase orders for this item
        # Matching by item name (case-insensitive substring) and lab
        active_pos = db.query(PurchaseRequest).filter(
            PurchaseRequest.lab_id == item.lab_id,
            PurchaseRequest.item_name.ilike(f"%{item.name[:15]}%"),
            PurchaseRequest.status.in_([
                PurchaseStatus.APPROVED,
                PurchaseStatus.ORDERED,
                PurchaseStatus.PARTIALLY_RECEIVED,
                PurchaseStatus.AWAITING_PROCUREMENT
            ])
        ).all()

        outstanding_po_qty = sum((p.quantity_outstanding or p.quantity) for p in active_pos)
        po_refs = [p.po_number or p.request_number for p in active_pos]
        po_ref_str = ", ".join(po_refs) if po_refs else None

        # Recommendation logic with deduplication
        if shortfall == 0:
            suggested_action = "STOCK_HEALTHY"
            rec_type = "RULE_BASED"
            explanation = (
                f"Current stock of {current_stock} units is at or above the safety threshold of {threshold} units. "
                f"No replenishment action is required at this time."
            )
        elif outstanding_po_qty >= shortfall:
            suggested_action = "ORDER_ALREADY_PLACED"
            rec_type = "RULE_BASED"
            explanation = (
                f"Item is currently {shortfall} units below the safety threshold ({current_stock}/{threshold} units). "
                f"However, an outstanding Purchase Order ({po_ref_str}) with {outstanding_po_qty} unit(s) is already approved and in transit. "
                f"No duplicate procurement order should be submitted."
            )
        elif outstanding_po_qty > 0 and outstanding_po_qty < shortfall:
            suggested_action = "REORDER_RECOMMENDED"
            rec_type = "RULE_BASED"
            net_shortfall = shortfall - outstanding_po_qty
            explanation = (
                f"Item is {shortfall} units below threshold ({current_stock}/{threshold} units). "
                f"Existing order ({po_ref_str}) covers {outstanding_po_qty} unit(s). "
                f"A net deficit of {net_shortfall} unit(s) remains unfulfilled. Supplemental requisition recommended."
            )
        else:
            # shortfall > 0 and outstanding_po_qty == 0
            suggested_action = "REORDER_URGENT"
            rec_type = "RULE_BASED"
            explanation = (
                f"Critical Stock Deficit: Working inventory ({current_stock} units) has dropped below safety threshold ({threshold} units). "
                f"Shortfall of {shortfall} units detected with ZERO active purchase orders in progress. "
                f"Immediate purchase requisition is recommended to ensure lab session continuity."
            )

        recommendations.append({
            "item_id": item.id,
            "item_name": item.name,
            "category": item.category,
            "lab_id": item.lab_id,
            "lab_name": lab_name,
            "current_stock": current_stock,
            "min_threshold": threshold,
            "shortfall": shortfall,
            "outstanding_po_quantity": outstanding_po_qty,
            "outstanding_po_ref": po_ref_str,
            "suggested_action": suggested_action,
            "recommendation_type": rec_type,
            "explanation": explanation,
            "safety_notice": SAFETY_POLICY_NOTICE,
            "last_evaluated_at": now_str
        })

    return recommendations
