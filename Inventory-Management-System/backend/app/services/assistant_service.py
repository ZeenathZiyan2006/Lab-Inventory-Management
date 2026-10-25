from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import (
    User, UserRole, Laboratory, Asset, BulkInventory, FaultReport, RepairJob,
    TransferRequest, PurchaseRequest, AssetStatus, FaultStatus, TransferStatus, PurchaseStatus
)
from typing import Dict, Any, List

def process_assistant_query(query: str, user: User, db: Session) -> Dict[str, Any]:
    """Processes natural language questions grounded in authentic database records with strict RBAC."""
    q = query.lower().strip()
    
    # Identify authorized laboratory IDs for the current user
    if user.role in [UserRole.ADMIN, UserRole.HOD, UserRole.PRINCIPAL, UserRole.TECHNICIAN]:
        authorized_labs = db.query(Laboratory).all()
    else:
        authorized_labs = user.assigned_labs
    
    auth_lab_ids = [l.id for l in authorized_labs]
    auth_lab_names = [l.name for l in authorized_labs]

    if not auth_lab_ids:
        return {
            "query": query,
            "answer": "You do not have access to any laboratory inventory. Please contact your college administrator.",
            "sql_intent": "NO_LAB_ACCESS",
            "results": [],
            "authorized_labs": []
        }

    # Intent 1: "How many computers are not working in Lab 1 / Lab 2 / all labs?"
    if any(k in q for k in ["computer", "pc", "monitor"]) and any(k in q for k in ["not working", "broken", "fault", "damaged", "repair"]):
        # Determine target lab if mentioned
        target_lab_id = None
        for lab in authorized_labs:
            if lab.name.lower() in q or lab.code.lower() in q or f"lab {lab.id}" in q or f"lab{lab.id}" in q:
                target_lab_id = lab.id
                break
        
        query_filter = [
            Asset.lab_id.in_(auth_lab_ids),
            Asset.category.ilike("%computing%"),
            Asset.status.in_([AssetStatus.FAULT_REPORTED, AssetStatus.DAMAGED, AssetStatus.UNDER_REPAIR])
        ]
        if target_lab_id:
            query_filter.append(Asset.lab_id == target_lab_id)

        assets = db.query(Asset).filter(*query_filter).all()
        count = len(assets)
        target_name = f"in {db.query(Laboratory).filter(Laboratory.id == target_lab_id).first().name}" if target_lab_id else "across your authorized laboratories"
        
        items_summary = [f"{a.asset_id} ({a.name} - Status: {a.status.value})" for a in assets[:5]]
        preview = f" (Examples: {', '.join(items_summary)})" if items_summary else ""

        return {
            "query": query,
            "answer": f"There are currently **{count}** non-working computing asset(s) {target_name}{preview}.",
            "sql_intent": "COUNT_NON_WORKING_COMPUTERS",
            "results": [{"asset_id": a.asset_id, "name": a.name, "status": a.status.value, "lab_id": a.lab_id} for a in assets],
            "authorized_labs": auth_lab_names
        }

    # Intent 2: "Which repair jobs are overdue / open / pending?"
    if any(k in q for k in ["repair", "technician", "job"]) and any(k in q for k in ["overdue", "pending", "open", "assigned", "progress"]):
        repairs = db.query(RepairJob).join(FaultReport).filter(
            FaultReport.lab_id.in_(auth_lab_ids),
            RepairJob.status.in_([FaultStatus.ASSIGNED, FaultStatus.IN_PROGRESS, FaultStatus.WAITING_FOR_PARTS])
        ).all()

        count = len(repairs)
        repair_list = []
        for r in repairs:
            tech_name = r.technician.full_name if r.technician else "Unassigned"
            repair_list.append(f"• Fault #{r.fault_report.report_number}: {r.fault_report.description[:40]}... (Assigned to: {tech_name}, Status: {r.status.value})")

        listing = "\n".join(repair_list) if repair_list else "No active or overdue repair jobs found."
        return {
            "query": query,
            "answer": f"Found **{count}** active repair job(s) in your authorized scope:\n\n{listing}",
            "sql_intent": "ACTIVE_REPAIR_JOBS",
            "results": [{"repair_id": r.id, "fault_id": r.fault_id, "status": r.status.value} for r in repairs],
            "authorized_labs": auth_lab_names
        }

    # Intent 3: "Which transfer requests await approval?"
    if any(k in q for k in ["transfer", "move", "relocation"]) and any(k in q for k in ["approval", "pending", "await"]):
        # Restrict transfer inspection if user lacks authority
        transfers = db.query(TransferRequest).filter(
            TransferRequest.status == TransferStatus.PENDING_APPROVAL,
            TransferRequest.source_lab_id.in_(auth_lab_ids)
        ).all()

        count = len(transfers)
        t_list = []
        for t in transfers:
            item_desc = t.asset.name if t.asset else (t.bulk_item.name if t.bulk_item else "Unknown Item")
            t_list.append(f"• Request #{t.request_number}: {item_desc} (Qty: {t.quantity}) from Lab {t.source_lab_id} to Lab {t.destination_lab_id}. Reason: {t.reason}")

        listing = "\n".join(t_list) if t_list else "No transfer requests currently awaiting approval."
        return {
            "query": query,
            "answer": f"There are **{count}** transfer request(s) awaiting approval:\n\n{listing}",
            "sql_intent": "PENDING_TRANSFERS",
            "results": [{"request_number": t.request_number, "quantity": t.quantity, "reason": t.reason} for t in transfers],
            "authorized_labs": auth_lab_names
        }

    # Intent 4: "Which items need replacement?"
    if any(k in q for k in ["replacement", "replace", "damaged", "irreparable"]):
        assets_needing_rep = db.query(Asset).filter(
            Asset.lab_id.in_(auth_lab_ids),
            Asset.status.in_([AssetStatus.REPLACEMENT_REQUESTED, AssetStatus.DAMAGED])
        ).all()
        
        purchases = db.query(PurchaseRequest).filter(
            PurchaseRequest.lab_id.in_(auth_lab_ids),
            PurchaseRequest.status.in_([PurchaseStatus.PENDING_APPROVAL, PurchaseStatus.AWAITING_PROCUREMENT])
        ).all()

        ans_parts = [f"Found **{len(assets_needing_rep)}** asset(s) marked for replacement or damaged:"]
        for a in assets_needing_rep:
            ans_parts.append(f"• {a.asset_id}: {a.name} ({a.category}) - Status: {a.status.value}")
        
        if purchases:
            ans_parts.append(f"\nThere are also **{len(purchases)}** pending purchase/replacement order(s) under review.")
        
        return {
            "query": query,
            "answer": "\n".join(ans_parts),
            "sql_intent": "ITEMS_NEEDING_REPLACEMENT",
            "results": [{"asset_id": a.asset_id, "name": a.name, "status": a.status.value} for a in assets_needing_rep],
            "authorized_labs": auth_lab_names
        }

    # Intent 5: "Which lab has the most unresolved faults?"
    if any(k in q for k in ["most", "highest", "unresolved", "open"]) and any(k in q for k in ["fault", "issue", "problem"]):
        fault_counts = db.query(
            Laboratory.name,
            func.count(FaultReport.id).label("fault_count")
        ).join(FaultReport, FaultReport.lab_id == Laboratory.id).filter(
            Laboratory.id.in_(auth_lab_ids),
            FaultReport.status.notin_([FaultStatus.CLOSED, FaultStatus.RESOLVED])
        ).group_by(Laboratory.name).order_by(func.count(FaultReport.id).desc()).all()

        if not fault_counts:
            return {
                "query": query,
                "answer": "All laboratories currently have 0 unresolved faults. All equipment is operational!",
                "sql_intent": "LAB_FAULT_SUMMARY",
                "results": [],
                "authorized_labs": auth_lab_names
            }
        
        top_lab, max_faults = fault_counts[0]
        details = ", ".join([f"{name}: {cnt}" for name, cnt in fault_counts])
        return {
            "query": query,
            "answer": f"**{top_lab}** currently has the most unresolved faults (**{max_faults}** open issue(s)).\n\nBreakdown: {details}.",
            "sql_intent": "LAB_FAULT_SUMMARY",
            "results": [{"lab_name": name, "open_faults": cnt} for name, cnt in fault_counts],
            "authorized_labs": auth_lab_names
        }

    # General Fallback with honest clarification
    return {
        "query": query,
        "answer": "I can assist you with database-grounded queries such as:\n"
                  "1. *'How many computers are not working in Lab 1?'*\n"
                  "2. *'Which repair jobs are overdue or open?'*\n"
                  "3. *'Which transfer requests await approval?'*\n"
                  "4. *'Which items need replacement?'*\n"
                  "5. *'Which lab has the most unresolved faults?'*\n\n"
                  "Please phrase your question aligned with these authorized metrics.",
        "sql_intent": "UNKNOWN_OR_UNSUPPORTED",
        "results": [],
        "authorized_labs": auth_lab_names
    }
