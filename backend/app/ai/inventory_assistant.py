"""
Smart Inventory Assistant Service for SMVITM
Answers natural-language inventory inquiries strictly grounded in authentic database records.
Enforces strict server-side Role-Based Access Control (RBAC) and laboratory isolation.
"""
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.models import (
    User, UserRole, Laboratory, Asset, BulkInventory, FaultReport, RepairJob,
    TransferRequest, PurchaseRequest, AssetStatus, FaultStatus, TransferStatus, PurchaseStatus,
    StockMovementLedger
)

# Common prompt injection and SQL injection patterns to safely reject
INJECTION_PATTERNS = [
    r"(\bdrop\s+table\b)",
    r"(\bunion\s+select\b)",
    r"(\binsert\s+into\b)",
    r"(\bdelete\s+from\b)",
    r"(\bupdate\s+\w+\s+set\b)",
    r"(ignore\s+(all\s+)?(previous|prior)\s+instructions)",
    r"(reveal\s+(system\s+)?(prompt|credentials|passwords|tokens))",
    r"(--|;|\/\*|\*\/)"
]

def check_prompt_injection(query: str) -> bool:
    """Returns True if input contains malicious SQL or prompt injection attempts."""
    q_lower = query.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, q_lower):
            return True
    return False

def get_user_authorized_labs(user: User, db: Session) -> List[Laboratory]:
    """Retrieves laboratories the user is authorized to access."""
    if user.role in [UserRole.ADMIN, UserRole.HOD, UserRole.PRINCIPAL, UserRole.TECHNICIAN]:
        return db.query(Laboratory).all()
    # For Lab Instructor, return assigned labs
    return list(user.assigned_labs)

def parse_target_lab(query_lower: str, all_labs: List[Laboratory]) -> Any:
    """Extracts target laboratory if specifically mentioned in the query."""
    best_lab = None
    best_len = 0

    for lab in all_labs:
        raw_name = lab.name.lower()
        code_lower = lab.code.lower()
        patterns = [
            raw_name,
            raw_name.replace("laboratory", "lab").strip(),
            raw_name.replace("&", "and").strip(),
            raw_name.replace("laboratory", "lab").replace("&", "and").strip(),
            code_lower,
            code_lower.replace("-", " "),
            code_lower.replace("-", ""),
            f"lab {lab.id}",
            f"lab{lab.id}",
            f"laboratory {lab.id}",
            f"laboratory{lab.id}"
        ]
        # Specific domain aliases
        if "deep learning" in raw_name or "ai &" in raw_name or lab.id == 1:
            patterns.extend([
                "ai & deep learning lab", "ai and deep learning lab", "ai lab", "ai laboratory",
                "deep learning lab", "deep learning laboratory", "aids-lab-01", "aids lab 1", "aids lab-1"
            ])
        if "data science" in raw_name or "cloud" in raw_name or lab.id == 2:
            patterns.extend([
                "data science & cloud lab", "data science and cloud lab", "data science lab", "data science laboratory",
                "cloud lab", "cloud computing lab", "cloud computing laboratory", "aids-lab-02", "aids lab 2", "aids lab-2"
            ])

        for p in patterns:
            if p in query_lower:
                if len(p) > best_len:
                    best_len = len(p)
                    best_lab = lab

    return best_lab

def is_computing_asset_clause():
    """SQLAlchemy OR clause matching genuine computing systems across case variations and names."""
    return or_(
        Asset.category.ilike("%computing%"),
        Asset.category.ilike("%workstation%"),
        Asset.category.ilike("%desktop%"),
        Asset.category.ilike("%laptop%"),
        Asset.category.ilike("%server%"),
        Asset.name.ilike("%desktop%"),
        Asset.name.ilike("%workstation%"),
        Asset.name.ilike("%computer%"),
        Asset.name.ilike("%laptop%"),
        Asset.name.ilike("%elitedesk%"),
        Asset.name.ilike("%z4%")
    )

def generate_spoken_text(answer: str) -> str:
    """Formats raw markdown assistant answers into clean, natural spoken speech for TTS."""
    if not answer:
        return ""
    # Strip markdown headers, bold, italics, bullets, links
    cleaned = re.sub(r"#{1,6}\s*", "", answer)
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"•\s*", "", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    # Convert currency symbols
    cleaned = cleaned.replace("₹", " rupees ")
    # Phonetic formatting for asset tags: SMVITM-AI-PC-001 -> SMVITM AI PC 001
    cleaned = re.sub(r"\b(SMVITM)-([A-Za-z0-9]+)-([A-Za-z0-9]+)-([A-Za-z0-9]+)\b", r"\1 \2 \3 \4", cleaned)
    cleaned = re.sub(r"\b(AIDS)-([A-Za-z0-9]+)-([A-Za-z0-9]+)\b", r"\1 \2 \3", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Speak first 2-3 complete sentences up to ~280 characters to keep voice answers crisp
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    spoken = ""
    for s in sentences:
        if len(spoken) + len(s) < 280:
            spoken += (" " if spoken else "") + s
        else:
            if not spoken:
                spoken = s[:270] + "..."
            break
    return spoken.strip()

def _process_assistant_query_internal(query: str, user: User, db: Session) -> Dict[str, Any]:
    """
    Interprets natural language inquiries, enforces RBAC, queries authorized records,
    and returns a structured grounded response.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    clean_q = query.strip()
    q_lower = clean_q.lower()

    # 1. Anti-Injection Guard
    if check_prompt_injection(clean_q):
        return {
            "query": clean_q,
            "answer": "Security Alert: Your query contains restricted tokens or prompt-injection patterns. Arbitrary SQL execution is strictly disabled. Only validated database views can be queried.",
            "sql_intent": "SECURITY_VIOLATION_BLOCKED",
            "lab_context": "None",
            "record_count": 0,
            "results": [],
            "authorized_labs": [],
            "timestamp": now_str,
            "disclaimer": "Security barrier enforced. All inquiries are logged and audited."
        }

    # 2. Scope Determination & Permissions
    all_labs = db.query(Laboratory).all()
    auth_labs = get_user_authorized_labs(user, db)
    auth_lab_ids = [l.id for l in auth_labs]
    auth_lab_names = [l.name for l in auth_labs]

    if not auth_lab_ids:
        return {
            "query": clean_q,
            "answer": "Access Restricted: You are not assigned to any college laboratories. Please contact the administrator.",
            "sql_intent": "NO_LAB_ACCESS",
            "lab_context": "None",
            "record_count": 0,
            "results": [],
            "authorized_labs": [],
            "timestamp": now_str,
            "disclaimer": "Server-side authorization enforced."
        }

    # Check if user explicitly asked for an unauthorized lab
    target_lab = parse_target_lab(q_lower, all_labs)
    if target_lab and target_lab.id not in auth_lab_ids:
        return {
            "query": clean_q,
            "answer": f"Access Denied: You are not authorized to view inventory or records for **{target_lab.name}**. Your authorized laboratory scope is limited to: {', '.join(auth_lab_names)}.",
            "sql_intent": "UNAUTHORIZED_LAB_QUERY",
            "lab_context": target_lab.name,
            "record_count": 0,
            "results": [],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Cross-laboratory query blocked by server-side authorization filter."
        }

    scoped_lab_ids = [target_lab.id] if target_lab else auth_lab_ids
    lab_context_name = target_lab.name if target_lab else (
        "All Authorized Laboratories" if len(auth_labs) > 1 else auth_labs[0].name
    )

    # -------------------------------------------------------------------------
    # Intent 0A: Specific Asset Lookup ("Where is asset X?", "Find asset SMVITM-AI-PC-001")
    # -------------------------------------------------------------------------
    asset_match_term = None
    if any(k in q_lower for k in ["where is", "find asset", "locate asset", "search asset", "lookup asset", "track asset", "specs of", "details of"]):
        for word in clean_q.replace("?", "").split():
            clean_word = word.strip(" ,:;'\"")
            if "-" in clean_word or len(clean_word) >= 4:
                if clean_word.lower() not in ["where", "asset", "equipment", "device", "locate", "search", "lookup", "track", "specs", "details", "find", "is", "the"]:
                    asset_match_term = clean_word
                    break

    if not asset_match_term:
        tag_match = re.search(r"\b(SMVITM-[A-Za-z0-9-]+|LAB[0-9]+-[A-Za-z0-9-]+|PC-[0-9]+|WS-[0-9]+)\b", clean_q, re.IGNORECASE)
        if tag_match:
            asset_match_term = tag_match.group(1)

    if asset_match_term:
        found_asset = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            (Asset.asset_id.ilike(f"%{asset_match_term}%")) |
            (Asset.serial_number.ilike(f"%{asset_match_term}%")) |
            (Asset.name.ilike(f"%{asset_match_term}%"))
        ).first()

        if found_asset:
            lab_name = found_asset.laboratory.name if found_asset.laboratory else f"Lab {found_asset.lab_id}"
            loc = found_asset.location_in_lab or "General area"
            answer = (
                f"Asset **{found_asset.asset_id}** ({found_asset.name}) is located in **{lab_name}** ({loc}).\n\n"
                f"• **Status:** {found_asset.status.value}\n"
                f"• **Category:** {found_asset.category}\n"
                f"• **Manufacturer / Model:** {found_asset.manufacturer or 'N/A'} {found_asset.model or ''}\n"
                f"• **Serial Number:** {found_asset.serial_number or 'N/A'}"
            )
            return {
                "query": clean_q,
                "answer": answer,
                "sql_intent": "LOCATE_ASSET",
                "lab_context": lab_name,
                "record_count": 1,
                "results": [{
                    "id": found_asset.id,
                    "asset_id": found_asset.asset_id,
                    "name": found_asset.name,
                    "category": found_asset.category,
                    "lab_id": found_asset.lab_id,
                    "lab_name": lab_name,
                    "location_in_lab": loc,
                    "status": found_asset.status.value,
                    "serial_number": found_asset.serial_number,
                    "navigate_to": "inventory"
                }],
                "authorized_labs": auth_lab_names,
                "timestamp": now_str,
                "disclaimer": "Grounded in verified Asset record."
            }
        else:
            return {
                "query": clean_q,
                "answer": f"Asset identifier '{asset_match_term}' was not found in your authorized laboratories ({', '.join(auth_lab_names)}). Please verify the asset tag or serial number.",
                "spoken_text": f"Asset identifier {asset_match_term} was not found in your authorized laboratories.",
                "sql_intent": "ASSET_NOT_FOUND",
                "lab_context": lab_context_name,
                "record_count": 0,
                "results": [],
                "authorized_labs": auth_lab_names,
                "timestamp": now_str,
                "disclaimer": "Search performed across authorized Asset records."
            }

    # -------------------------------------------------------------------------
    # Intent 0-CompoundStatus: "Which equipment is working, damaged, missing, or under repair?"
    # -------------------------------------------------------------------------
    compound_status_terms = ["working", "damaged", "missing", "repair"]
    matching_compound = [t for t in compound_status_terms if t in q_lower]
    if len(matching_compound) >= 3 or "working, damaged" in q_lower or "equipment status" in q_lower or "asset status" in q_lower or "health of equipment" in q_lower:
        working_assets = db.query(Asset).filter(Asset.lab_id.in_(scoped_lab_ids), Asset.status == AssetStatus.WORKING).all()
        repair_assets = db.query(Asset).filter(Asset.lab_id.in_(scoped_lab_ids), Asset.status == AssetStatus.UNDER_REPAIR).all()
        fault_assets = db.query(Asset).filter(Asset.lab_id.in_(scoped_lab_ids), Asset.status.in_([AssetStatus.FAULT_REPORTED, AssetStatus.DAMAGED])).all()
        missing_assets = db.query(Asset).filter(Asset.lab_id.in_(scoped_lab_ids), Asset.status == AssetStatus.MISSING).all()
        
        total_count = len(working_assets) + len(repair_assets) + len(fault_assets) + len(missing_assets)
        results = []
        for a in working_assets:
            results.append({"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": "Working"})
        for a in repair_assets:
            results.append({"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": "Under Repair"})
        for a in fault_assets:
            results.append({"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": a.status.value})
        for a in missing_assets:
            results.append({"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": "Missing"})

        summary_parts = [
            f"### Comprehensive Equipment Status for {lab_context_name}:",
            f"• **Working Operational:** {len(working_assets)} asset(s)",
            f"• **Under Active Repair:** {len(repair_assets)} asset(s)",
            f"• **Damaged / Fault Reported:** {len(fault_assets)} asset(s)",
            f"• **Flagged Missing:** {len(missing_assets)} asset(s)"
        ]
        if repair_assets:
            summary_parts.append("\n**Under Active Repair:**\n" + "\n".join([f"• `{a.asset_id}`: {a.name} ({a.category})" for a in repair_assets[:4]]))
        if fault_assets:
            summary_parts.append("\n**Damaged / Faults Logged:**\n" + "\n".join([f"• `{a.asset_id}`: {a.name} ({a.category})" for a in fault_assets[:4]]))
        if missing_assets:
            summary_parts.append("\n**Flagged Missing:**\n" + "\n".join([f"• `{a.asset_id}`: {a.name} ({a.category})" for a in missing_assets[:4]]))

        answer = "\n".join(summary_parts)
        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "EQUIPMENT_STATUS_BREAKDOWN",
            "lab_context": lab_context_name,
            "record_count": total_count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Aggregated live asset status breakdown across authorized laboratories."
        }

    # -------------------------------------------------------------------------
    # Intent 0-RepairReplace: "Which equipment needs repair or replacement?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["need repair", "needs repair", "need replacement", "needs replacement", "repair or replacement", "require repair", "require replacement"]):
        need_assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status.in_([AssetStatus.FAULT_REPORTED, AssetStatus.DAMAGED, AssetStatus.UNDER_REPAIR, AssetStatus.REPLACEMENT_REQUESTED])
        ).all()
        count = len(need_assets)
        results = [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": a.status.value, "location": a.location_in_lab or "General"} for a in need_assets]
        if count > 0:
            bullets = "\n".join([f"• **{a.asset_id}**: {a.name} ({a.category}) — Current Status: **{a.status.value}** in Lab {a.lab_id}" for a in need_assets[:10]])
            answer = f"Found **{count}** equipment item(s) currently requiring repair or replacement in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"All equipment in {lab_context_name} is in good operational standing. No items currently require repair or replacement."
        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "EQUIPMENT_NEEDING_REPAIR_OR_REPLACEMENT",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in Asset records where status indicates fault, damage, active repair, or replacement request."
        }

    # -------------------------------------------------------------------------
    # Intent 0-PendingRequests: "What are the pending repair and replacement requests?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in [
        "pending repair", "pending replacement", "pending repair and replacement", "pending repair or replacement",
        "repair and replacement requests", "pending repair requests", "active repair requests", "open repair requests",
        "repair requests", "pending repairs", "repair tickets"
    ]) or (any(k in q_lower for k in ["pending repair", "active repair", "open repair"]) and any(k in q_lower for k in ["replacement", "replace"])):
        open_faults = db.query(FaultReport).filter(
            FaultReport.lab_id.in_(scoped_lab_ids),
            FaultReport.status.in_([FaultStatus.REPORTED, FaultStatus.ASSIGNED, FaultStatus.IN_PROGRESS])
        ).all()
        rep_purchases = db.query(PurchaseRequest).filter(
            PurchaseRequest.lab_id.in_(scoped_lab_ids),
            PurchaseRequest.status.in_([PurchaseStatus.SUBMITTED, PurchaseStatus.UNDER_REVIEW, PurchaseStatus.PENDING_APPROVAL])
        ).all()
        total_requests = len(open_faults) + len(rep_purchases)
        results = [
            {"id": f.id, "asset_id": f.report_number, "name": f.title, "category": "Repair Ticket", "status": f.status.value, "lab_id": f.lab_id, "navigate_to": "faults"}
            for f in open_faults
        ] + [
            {"id": p.id, "asset_id": p.request_number, "name": p.item_name, "category": "Replacement Requisition", "status": p.status.value, "lab_id": p.lab_id, "navigate_to": "requests"}
            for p in rep_purchases
        ]
        bullets = [f"• **Repair Ticket {f.report_number}**: {f.title} ({f.priority.value} Priority — {f.status.value})" for f in open_faults[:5]]
        bullets += [f"• **Replacement PO {p.request_number}**: {p.item_name} (Qty: {p.quantity} — {p.status.value})" for p in rep_purchases[:5]]
        if total_requests > 0:
            answer = f"Found **{total_requests}** pending repair and replacement request(s) in {lab_context_name} (**{len(open_faults)}** repair tickets, **{len(rep_purchases)}** procurement requests):\n\n" + "\n".join(bullets)
        else:
            answer = f"There are currently zero pending repair tickets or replacement procurement requests in {lab_context_name}."
        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "PENDING_REPAIR_AND_REPLACEMENT_REQUESTS",
            "lab_context": lab_context_name,
            "record_count": total_requests,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in active FaultReport and pending PurchaseRequest records."
        }

    # -------------------------------------------------------------------------
    # Intent 0B: Damaged or Faulty Equipment
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["damaged", "broken", "defective", "fault reported"]) and not any(k in q_lower for k in ["how to report", "how do i report"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status.in_([AssetStatus.DAMAGED, AssetStatus.FAULT_REPORTED])
        ).all()
        bulk_items = db.query(BulkInventory).filter(
            BulkInventory.lab_id.in_(scoped_lab_ids),
            BulkInventory.damaged_quantity > 0
        ).all()

        total_damaged = len(assets) + sum(b.damaged_quantity for b in bulk_items)
        results = [
            {"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": a.status.value, "location": a.location_in_lab or "General"}
            for a in assets
        ]
        for b in bulk_items:
            results.append({
                "id": b.id, "asset_id": f"BULK-{b.id:04d}", "name": b.name, "category": b.category, "lab_id": b.lab_id, "status": f"{b.damaged_quantity} units damaged", "location": "Storage Bin"
            })

        if total_damaged > 0:
            asset_bullets = "\n".join([f"• **{a.asset_id}**: {a.name} in Lab {a.lab_id} ({a.status.value})" for a in assets[:8]])
            if bulk_items:
                asset_bullets += "\n" + "\n".join([f"• **{b.name}** (Lab {b.lab_id}): {b.damaged_quantity} damaged units" for b in bulk_items[:4]])
            answer = f"Found **{total_damaged}** damaged or fault-reported item(s) in {lab_context_name}:\n\n{asset_bullets}"
        else:
            answer = f"Excellent! There are no damaged or fault-reported equipment records in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "DAMAGED_EQUIPMENT",
            "lab_context": lab_context_name,
            "record_count": total_damaged,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in Asset records (status = Damaged or Fault reported) and Bulk damaged quantities."
        }

    # -------------------------------------------------------------------------
    # Intent 0C: Missing Equipment
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["missing", "lost", "unaccounted", "stolen"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status == AssetStatus.MISSING
        ).all()
        bulk_items = db.query(BulkInventory).filter(
            BulkInventory.lab_id.in_(scoped_lab_ids),
            BulkInventory.missing_quantity > 0
        ).all()

        total_missing = len(assets) + sum(b.missing_quantity for b in bulk_items)
        results = [
            {"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": a.status.value}
            for a in assets
        ]
        for b in bulk_items:
            results.append({
                "id": b.id, "asset_id": f"BULK-{b.id:04d}", "name": b.name, "category": b.category, "lab_id": b.lab_id, "status": f"{b.missing_quantity} units missing"
            })

        if total_missing > 0:
            bullets = "\n".join([f"• **{a.asset_id}**: {a.name} (Lab {a.lab_id})" for a in assets])
            if bulk_items:
                bullets += "\n" + "\n".join([f"• **{b.name}** (Lab {b.lab_id}): {b.missing_quantity} missing units" for b in bulk_items])
            answer = f"Notice: Found **{total_missing}** item(s) flagged as missing in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"No equipment or bulk items are currently flagged as missing in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "MISSING_EQUIPMENT",
            "lab_context": lab_context_name,
            "record_count": total_missing,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in Asset status = Missing and Bulk missing_quantity."
        }

    # -------------------------------------------------------------------------
    # Intent 0D: All Working Equipment (General)
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["which equipment is working", "what equipment is working", "show working equipment", "list working equipment", "all working assets", "operational equipment"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status == AssetStatus.WORKING
        ).all()
        count = len(assets)
        results = [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": a.status.value} for a in assets]

        if count > 0:
            bullets = "\n".join([f"• **{a.asset_id}**: {a.name} ({a.category}) in Lab {a.lab_id}" for a in assets[:10]])
            answer = f"There are **{count}** operational asset(s) verified in working status in {lab_context_name}:\n\n{bullets}"
            if count > 10:
                answer += f"\n\n*...and {count - 10} more operational items.*"
        else:
            answer = f"No equipment is currently marked as working in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "WORKING_EQUIPMENT",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in Asset records where status = Working."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-1: Website & Dashboard Walkthrough (Beginner Guide)
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in [
        "how do i use this website", "guide me through the dashboard", "how to use this website",
        "how does this website work", "beginner", "explain everything step by step",
        "dashboard tour", "website walkthrough", "system guide", "getting started"
    ]):
        return {
            "query": clean_q,
            "answer": (
                "### Welcome to SMVITM Smart Inventory System — Step-by-Step Guide:\n\n"
                "1. **Dashboard Overview:** View high-level live metrics: Total Serialized Assets, Operational Working Ratio, Open Breakdown Tickets, and Active Stock Alerts.\n"
                "2. **Lab Inventory (`inventory`):** Browse assets under two views:\n"
                "   • **'Individually Tracked Assets'** for computers, projectors, ACs with serial numbers.\n"
                "   • **'Bulk Equipment Stocks'** for cables, mice, keyboards with threshold tracking.\n"
                "   • Click **'Register Asset'** to add new items into the system.\n"
                "3. **Faults & Repairs (`faults`):** Click **'Report Equipment Fault'** to log issues. Our built-in AI automatically predicts fault categories, priority, and recommends technicians!\n"
                "4. **Operations & Governance:** Use **'Inter-Lab Transfers'** (`transfers`) to relocate gear, **'Purchase Requests'** (`requests`) to order replacements, and **'Reports & Export'** (`reports`) to download printable Audit PDFs with SMVITM letterhead.\n"
                "5. **Instant QR Scanner:** Click **'QR Scanner'** in the top navigation bar to scan physical door or equipment QR stickers with your camera."
            ),
            "spoken_text": (
                "Welcome to SMVITM Smart Inventory System. Use the sidebar to access your Dashboard, Lab Inventory, "
                "Faults and Repairs, and Inter-Lab Transfers. You can scan equipment QR stickers from the top navigation bar "
                "or ask me any inventory question right here."
            ),
            "sql_intent": "GUIDANCE_DASHBOARD_AND_WEBSITE",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [
                {"name": "System Dashboard", "navigate_to": "dashboard", "action_label": "Open Dashboard"},
                {"name": "Laboratory Inventory", "navigate_to": "inventory", "action_label": "Open Inventory"}
            ],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Verified institutional website walkthrough."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-2: Adding / Registering Equipment
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in [
        "how do i add", "how to add", "add equipment", "add asset", "register asset", "register equipment",
        "register new equipment", "how to register", "how do i register", "how to add item", "add a new inventory item",
        "how do i add a new inventory item", "new asset", "add new item"
    ]):
        return {
            "query": clean_q,
            "answer": (
                "### How to Register New Equipment in the System:\n\n"
                "1. Click **'Lab Inventory'** in the left sidebar menu.\n"
                "2. In the top-right header, click the dark blue **'Register Asset'** button.\n"
                "3. In the modal dialog, fill in:\n"
                "   • **Laboratory:** Choose the target lab (e.g., *AI & Deep Learning Laboratory*).\n"
                "   • **Category:** Select *Computing*, *Workstation*, *Peripherals*, *Networking*, or *Electrical*.\n"
                "   • **Equipment Details:** Enter Name, Manufacturer, Model, Serial Number, and Purchase Date.\n"
                "   • **Physical Location:** Specify exact bench/rack placement (e.g., *Row 1, Bench 02*).\n"
                "4. Click **'Save Asset'**.\n\n"
                "*Result:* The server assigns an official Asset Tag (e.g., `SMVITM-AIDS-LAB1-WS-05`) and instantly generates a scannable QR Code sticker ready for printing!"
            ),
            "spoken_text": (
                "To add new equipment, go to Lab Inventory in the sidebar and click the Register Asset button. "
                "Select your laboratory and category, fill in the model and serial number, then click Save Asset. "
                "The system automatically creates a unique asset tag and QR sticker."
            ),
            "sql_intent": "GUIDANCE_REGISTER_ASSET",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [{"name": "Laboratory Inventory", "navigate_to": "inventory", "action_label": "Open Lab Inventory"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Step-by-step verified asset registration workflow."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-3: Finding / Locating Assets by ID or Specs
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in [
        "find an asset", "locate an asset", "search an asset", "how can i find an asset", "how do i find an asset",
        "find asset using its id", "locate equipment by id", "search asset by id", "find equipment using id",
        "how to find an asset", "how to locate equipment", "find asset using id"
    ]) and not any(p in q_lower for p in ["smvitm-", "hp ", "dell ", "where is "]):
        return {
            "query": clean_q,
            "answer": (
                "### Three Ways to Find an Asset by ID:\n\n"
                "1. **Ask Me Directly (Fastest):** Type or speak: *'Where is asset SMVITM-AI-PC-001?'* I will immediately return its room, bench position, status, and technical specs!\n"
                "2. **Search Bar in Inventory:** Go to **'Lab Inventory'** from the sidebar and type the tag (e.g. `SMVITM-AI-PC-002`) into the search box. The table filters in real time.\n"
                "3. **Physical QR Scan:** Click **'QR Scanner'** in the top navigation bar and aim your mobile camera or webcam at the equipment sticker to open its digital dossier."
            ),
            "spoken_text": (
                "You can find an asset in three ways. Ask me directly with the asset tag, type the identifier into the "
                "search bar inside Lab Inventory, or click QR Scanner in the top navbar to scan the physical sticker."
            ),
            "sql_intent": "GUIDANCE_FIND_ASSET",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [
                {"name": "Laboratory Inventory", "navigate_to": "inventory", "action_label": "Search Inventory"},
                {"name": "QR Scanner", "action": "OPEN_QR_SCANNER", "action_label": "Open QR Scanner"}
            ],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Asset identification and tracking guide."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-4: QR Code Scanning and Generation
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in [
        "qr", "scan qr", "how to scan", "how do i scan", "scan a qr", "scan equipment", "scan code", "scanner",
        "generate qr", "qr code", "qr code guide", "how do i generate or scan", "generate or scan an asset"
    ]):
        return {
            "query": clean_q,
            "answer": (
                "### QR Code Features — Scanning & Generating:\n\n"
                "• **Scanning an Asset / Door Code:**\n"
                "  1. Click the **'QR Scanner'** button in the top navbar or on the Dashboard.\n"
                "  2. Grant camera access when prompted.\n"
                "  3. Align the printed QR sticker within the viewframe. The system instantly loads asset maintenance history and operational condition.\n\n"
                "• **Viewing / Generating Asset QR Codes:**\n"
                "  1. Navigate to **'Lab Inventory'**.\n"
                "  2. Click **'History' / 'Details'** on any item to view or print its high-resolution institutional QR code."
            ),
            "spoken_text": (
                "To scan a QR code, click QR Scanner in the top navigation bar and hold your camera over the sticker. "
                "To view or print an asset's QR code, go to Lab Inventory and click Details on that item."
            ),
            "sql_intent": "GUIDANCE_QR_CODE",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [{"name": "Institutional QR Scanner", "action": "OPEN_QR_SCANNER", "action_label": "Open QR Scanner"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "QR code scanner and generator guide."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-5: Fault Reporting & Maintenance Requests
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in [
        "report faulty", "report damage", "report a damaged", "report broken", "report fault",
        "how can i report faulty equipment", "how do i report", "how to report", "help me report",
        "how do i submit a maintenance request", "submit a maintenance request", "submit maintenance",
        "log a complaint", "log fault"
    ]):
        return {
            "query": clean_q,
            "answer": (
                "### How to Report Faulty Equipment & Submit Maintenance Requests:\n\n"
                "1. Click **'Faults & Repairs'** in the left sidebar menu.\n"
                "2. Click the red **'Report Equipment Fault'** button in the top right.\n"
                "3. In the form:\n"
                "   • Select your **Laboratory**.\n"
                "   • Choose the **Asset Tag** from the dropdown list.\n"
                "   • Enter a detailed description of the problem (e.g., *'GPU fan failure and system overheating'*).\n"
                "4. **AI-Assisted Triage:** The built-in Scikit-Learn TF-IDF classifier analyzes your text to automatically suggest the fault category, urgency priority (Low/Medium/High/Critical), and appropriate technician.\n"
                "5. Click **'Submit Fault Report'**. A unique ticket (e.g., `FLT-20261019-A101`) is issued and assigned immediately."
            ),
            "spoken_text": (
                "To report faulty equipment, open Faults and Repairs from the sidebar and click the Report Equipment Fault button. "
                "Select your laboratory and equipment, describe the breakdown, and our built-in AI will automatically suggest the category and technician."
            ),
            "sql_intent": "GUIDANCE_REPORT_FAULT",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [{"name": "Faults & Repairs Portal", "navigate_to": "faults", "action_label": "Open Faults Portal"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Verified fault reporting and maintenance workflow."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-6: Checking Repair Status & Items Under Repair
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["how do i check which items are under repair", "how can i check the status of a repair", "check repair status", "track repair", "status of a repair"]):
        return {
            "query": clean_q,
            "answer": (
                "### Checking Repair Jobs & Maintenance Status:\n\n"
                "1. Go to **'Faults & Repairs'** in the sidebar.\n"
                "2. The table shows active breakdown tickets with status tags:\n"
                "   • **Reported:** Logged and awaiting technician assignment.\n"
                "   • **Assigned / In Progress:** Technician actively servicing the hardware.\n"
                "   • **Pending Verification:** Repair completed by technician; awaiting Lab Instructor sign-off.\n"
                "   • **Resolved / Closed:** Equipment restored to working status.\n"
                "3. Click **'Details'** on any ticket to view assigned technician names, work notes, and timestamps.\n\n"
                "*Tip:* You can also ask me: *'Which assets are currently under repair?'* to see an instant summary!"
            ),
            "spoken_text": (
                "To check repair status, go to Faults and Repairs in the sidebar. You can view all active tickets, "
                "see whether a technician is working on the hardware, or click Details to read technician notes. "
                "You can also ask me directly which assets are under repair."
            ),
            "sql_intent": "GUIDANCE_CHECK_REPAIRS",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [{"name": "Faults & Repairs Portal", "navigate_to": "faults", "action_label": "View Faults & Repairs"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Repair lifecycle and tracking guide."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-7: Low-Stock Alerts
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["how do i view low-stock alerts", "view low stock", "low-stock alerts", "check stock alerts", "reorder alerts"]):
        return {
            "query": clean_q,
            "answer": (
                "### How to View Low-Stock Alerts:\n\n"
                "1. **Dashboard Widgets:** The main **Dashboard** displays yellow warning cards for any consumable or bulk inventory item whose quantity has dropped below its configured threshold.\n"
                "2. **Lab Inventory Tab:** Go to **'Lab Inventory'** in the sidebar and switch to the **'Bulk Equipment Stocks'** tab. Items with stock deficits are highlighted with deficit badges.\n"
                "3. **Ask the AI:** Speak or type: *'Which items are below their configured reorder levels?'* for an immediate itemized breakdown with recommended order quantities."
            ),
            "spoken_text": (
                "Low stock alerts appear on your main Dashboard and inside Lab Inventory under the Bulk Equipment Stocks tab. "
                "Items below threshold show deficit quantities so you can replenish them in time."
            ),
            "sql_intent": "GUIDANCE_LOW_STOCK",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [
                {"name": "System Dashboard", "navigate_to": "dashboard", "action_label": "View Dashboard"},
                {"name": "Bulk Inventory", "navigate_to": "inventory", "action_label": "Open Lab Inventory"}
            ],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Inventory threshold alert guide."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-8: Suppliers & Department Management (Honest Architectural Answer)
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["how do i manage suppliers", "manage suppliers or departments", "add supplier", "vendor management", "where are suppliers", "manage departments"]):
        return {
            "query": clean_q,
            "answer": (
                "### Institutional Structure: Suppliers & Departments\n\n"
                "• **Suppliers / Vendors:**\n"
                "  *Notice:* There is **no standalone 'Suppliers' menu** in the application. Instead, supplier names, quotations, and purchase pricing are managed directly inside the **'Purchase Requests'** portal (`requests`) when initiating a requisition, uploading vendor quotation PDFs, or placing a Purchase Order (`Place PO`).\n\n"
                "• **Academic Departments:**\n"
                "  Laboratories and assets are grouped under departmental affiliations (such as *AI & Data Science*). Departmental structures are viewed under **'Laboratories'** (`labs`) and administered by users with the **Administrator** role under **'User Management'** (`users`)."
            ),
            "spoken_text": (
                "There is no standalone Suppliers menu in this system. Supplier details and quotations are managed directly "
                "inside Purchase Requests. Academic departments are organized under the Laboratories and User Management pages."
            ),
            "sql_intent": "GUIDANCE_SUPPLIERS_AND_DEPARTMENTS",
            "lab_context": "Institutional Architecture",
            "record_count": 1,
            "results": [
                {"name": "Purchase Requests", "navigate_to": "requests", "action_label": "Open Purchase Requests"},
                {"name": "Laboratories", "navigate_to": "labs", "action_label": "View Laboratories"}
            ],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Honest architectural mapping of institutional features."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-9: Generating Reports & Official Export
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["how do i generate inventory reports", "generate inventory reports", "download pdf", "generate report", "inventory report", "reports page", "export csv", "audit report"]):
        return {
            "query": clean_q,
            "answer": (
                "### How to Generate Official Inventory Reports:\n\n"
                "1. Click **'Reports & Export'** in the left sidebar.\n"
                "2. **Official Institutional Audit PDF:** Click to generate a formatted printable document featuring the SMVITM header, department category distributions, asset breakdown, and official signature verification blocks.\n"
                "3. **Complete Inventory CSV:** Click **'Export Complete Inventory CSV'** to download a spreadsheet with all serialized hardware, locations, purchase costs, and statuses.\n"
                "4. **Per-Lab CSVs:** Individual laboratory tables have dedicated **'CSV'** buttons for lab-specific audits."
            ),
            "spoken_text": (
                "To generate reports, click Reports and Export in the sidebar. You can generate an official printable Audit PDF "
                "with college letterhead, or download complete CSV spreadsheets for offline auditing."
            ),
            "sql_intent": "GUIDANCE_REPORTS",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [{"name": "Reports & Export Portal", "navigate_to": "reports", "action_label": "Open Reports Portal"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Institutional report generation workflow."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-10: Why can't I see a particular option? (RBAC Explanation)
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["why can't i see", "why cant i see", "why is an option missing", "missing option", "why dont i see", "permission denied", "access restricted", "cant see particular option"]):
        return {
            "query": clean_q,
            "answer": (
                "### Role-Based Access Control (RBAC) Explanation:\n\n"
                "The SMVITM Inventory System enforces strict server-side permissions based on five institutional roles:\n\n"
                "• **Administrator:** Full visibility across all 11 system pages, including **User Management** (`users`) and **Audit Trail** (`audit`).\n"
                "• **HOD & Principal:** Executive oversight, financial sanctioning in **Purchase Requests**, and institutional PDF audit reports.\n"
                "• **Lab Instructor:** Scoped to assigned laboratories; can register assets, report faults, request transfers, and book timetables.\n"
                "• **Technician:** Focused exclusively on **Dashboard**, **Faults & Repairs** (`My Assigned Repairs`), and AI fault triage. *Technicians do not see general inventory or procurement sanctioning.*\n\n"
                "*Notice:* If a button or menu is missing from your screen, your current account does not have authorization for that specific administrative operation."
            ),
            "spoken_text": (
                "If you cannot see a particular option, it is restricted by your user role. The system uses role-based access control. "
                "For example, User Management is reserved for Administrators, and financial approvals are reserved for the Head of Department and Principal."
            ),
            "sql_intent": "GUIDANCE_PERMISSIONS_RBAC",
            "lab_context": "Role-Based Access Control",
            "record_count": 1,
            "results": [{"name": "Dashboard", "navigate_to": "dashboard", "action_label": "Return to Dashboard"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Server-side role permission governance."
        }

    # -------------------------------------------------------------------------
    # Intent 0E-11: Inter-Lab Equipment Transfers
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["how to transfer", "what is transfer", "transfers page", "transfer page", "inter-lab transfer", "relocate equipment", "about transfer"]) or ("transfer" in q_lower and not any(k in q_lower for k in ["month", "recent", "this month"])):
        return {
            "query": clean_q,
            "answer": (
                "### Inter-Lab Equipment Transfer Workflow:\n\n"
                "1. Click **'Inter-Lab Transfers'** in the sidebar.\n"
                "2. Click the dark blue **'Request Transfer'** button.\n"
                "3. Select the **Source Lab**, **Destination Lab**, and choose either serialized equipment or bulk stock quantity.\n"
                "4. **Lifecycle:** Once approved, the sending lab clicks **'Dispatch'**, and upon physical arrival the receiving lab inspects the hardware and marks it as **'Receive'**.\n"
                "5. **Audit Trail:** Every movement is permanently logged in the **Stock Movement Ledger** (`Stock Ledger`)."
            ),
            "spoken_text": (
                "To transfer equipment between labs, go to Inter-Lab Transfers and click Request Transfer. "
                "Select the source and destination laboratories, submit the request, and track dispatch and receipt in the Stock Ledger."
            ),
            "sql_intent": "GUIDANCE_TRANSFERS",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [{"name": "Inter-Lab Transfers Portal", "navigate_to": "transfers", "action_label": "Open Transfers"}],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Website-aware institutional transfer workflow."
        }

    # -------------------------------------------------------------------------
    # Website-Aware Help: What can the assistant do?
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["what can you do", "help me", "commands", "what are your features", "who are you"]):
        return {
            "query": clean_q,
            "answer": (
                "### SMVITM AI Inventory Intelligence Capabilities:\n\n"
                "• **Real-Time Asset Queries:** Ask about working, damaged, missing, or under-repair equipment across college labs.\n"
                "• **Computer Availability:** Count operational PCs or locate any asset by ID or serial number.\n"
                "• **AI Fault Triage:** Describe an equipment breakdown to receive automated category, priority, and technician suggestions.\n"
                "• **Voice Interaction:** Speak your questions and listen to natural spoken responses in either **Arya (Male)** or **Ananya (Female)** persona.\n"
                "• **Portal Navigation:** Get instant shortcuts to inventory, QR scanning, repair tickets, and audit reports."
            ),
            "sql_intent": "ASSISTANT_CAPABILITIES",
            "lab_context": lab_context_name,
            "record_count": 1,
            "results": [
                {"name": "Laboratory Inventory", "navigate_to": "inventory", "action_label": "View Inventory"},
                {"name": "QR Scanner", "action": "OPEN_QR_SCANNER", "action_label": "Open Scanner"}
            ],
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded AI Inventory Intelligence."
        }

    # -------------------------------------------------------------------------
    # Intent 0F: Pending Fault Reports (All open breakdown tickets)
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["pending fault", "open fault", "reported fault", "active fault", "fault reports", "fault tickets", "breakdown ticket"]):
        faults = db.query(FaultReport).filter(
            FaultReport.lab_id.in_(scoped_lab_ids),
            FaultReport.status.in_([FaultStatus.REPORTED, FaultStatus.ASSIGNED, FaultStatus.IN_PROGRESS])
        ).order_by(FaultReport.created_at.desc()).all()

        count = len(faults)
        results = [{
            "id": f.id,
            "report_number": f.report_number,
            "title": f.title,
            "priority": f.priority.value,
            "status": f.status.value,
            "lab_id": f.lab_id,
            "technician": f.repair_job.technician.full_name if (f.repair_job and f.repair_job.technician) else "Pending assignment",
            "navigate_to": "faults"
        } for f in faults]

        if count > 0:
            bullets = "\n".join([f"• **{f.report_number}** [{f.priority.value}]: {f.title} (Status: {f.status.value})" for f in faults[:10]])
            answer = f"Found **{count}** open breakdown ticket(s) in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"All clear! There are no open or pending fault reports in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "OPEN_FAULT_REPORTS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in FaultReport records with status != RESOLVED/CLOSED."
        }

    # -------------------------------------------------------------------------
    # Intent 0G: Replacement Requests Pending Approval
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["replacement", "replace", "replacements"]) and any(k in q_lower for k in ["require approval", "pending", "approval", "request", "need", "sanction"]):
        rep_assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status == AssetStatus.REPLACEMENT_REQUESTED
        ).all()
        rep_purchases = db.query(PurchaseRequest).filter(
            PurchaseRequest.lab_id.in_(scoped_lab_ids),
            PurchaseRequest.status.in_([PurchaseStatus.SUBMITTED, PurchaseStatus.UNDER_REVIEW, PurchaseStatus.PENDING_APPROVAL])
        ).all()

        count = len(rep_assets) + len(rep_purchases)
        results = [
            {"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": "Replacement Requested", "navigate_to": "inventory"}
            for a in rep_assets
        ]
        for p in rep_purchases:
            results.append({
                "id": p.id, "asset_id": p.request_number, "name": p.item_name, "category": "Procurement Requisition", "lab_id": p.lab_id, "status": p.status.value, "navigate_to": "requests"
            })

        if count > 0:
            bullets = [f"• Asset **{a.asset_id}**: {a.name} (Lab {a.lab_id})" for a in rep_assets]
            bullets += [f"• Requisition **{p.request_number}**: {p.item_name} (Qty: {p.quantity}, Status: {p.status.value})" for p in rep_purchases]
            answer = f"Found **{count}** pending replacement requirement(s) in {lab_context_name}:\n\n" + "\n".join(bullets[:10])
        else:
            answer = f"No pending replacement requests found in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "REPLACEMENT_REQUESTS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in Asset records where status = REPLACEMENT_REQUESTED and PurchaseRequest records."
        }

    # -------------------------------------------------------------------------
    # Intent 1A: Non-working / faulty / broken computers ("How many computers are not working in Lab 1?")
    # -------------------------------------------------------------------------
    is_computer_query = any(k in q_lower for k in ["computer", "pc", "workstation", "desktop", "laptop", "elitedesk"])
    is_not_working_query = any(k in q_lower for k in ["not working", "broken", "damaged", "faulty", "fault reported", "defective", "down", "out of order", "inoperative", "non-functional", "repair"])

    if is_computer_query and is_not_working_query and not any(k in q_lower for k in ["how to report", "help me report"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status.in_([AssetStatus.FAULT_REPORTED, AssetStatus.UNDER_REPAIR, AssetStatus.DAMAGED]),
            is_computing_asset_clause()
        ).all()
        count = len(assets)
        results = [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "lab_id": a.lab_id, "status": a.status.value, "category": a.category, "location": a.location_in_lab or "General"} for a in assets]
        
        if count > 0:
            bullets = "\n".join([f"• **{a.asset_id}**: {a.name} ({a.category}) — Status: **{a.status.value}** ({a.location_in_lab or 'Lab area'})" for a in assets])
            answer = f"Found **{count}** non-working computer(s) requiring attention in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"All clear! There are zero non-working computers in {lab_context_name}. All operational computing units are functioning normally."

        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "COUNT_NON_WORKING_COMPUTERS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in verified Asset records with non-working status."
        }

    # -------------------------------------------------------------------------
    # Intent 1B: Working computers ("How many working computers are in the AI & Deep Learning Laboratory?")
    # -------------------------------------------------------------------------
    if is_computer_query and any(k in q_lower for k in ["working", "functional", "operational", "active", "available"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status == AssetStatus.WORKING,
            is_computing_asset_clause()
        ).all()
        count = len(assets)
        results = [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "lab_id": a.lab_id, "status": a.status.value, "category": a.category, "location": a.location_in_lab or "Operational"} for a in assets]
        
        if count > 0:
            bullets = "\n".join([f"• **{a.asset_id}**: {a.name} ({a.category}) — {a.location_in_lab or 'Bench area'}" for a in assets])
            answer = f"Found **{count}** verified working computer(s) in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"No active computing systems found in working status in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "COUNT_WORKING_COMPUTERS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in verified Asset records with WORKING status."
        }

    # -------------------------------------------------------------------------
    # Intent 1C: Total / General computer count ("How many computers are in the AI & Deep Learning Laboratory?")
    # -------------------------------------------------------------------------
    if is_computer_query and any(k in q_lower for k in ["how many", "count", "list", "show", "total", "number of", "are in"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            is_computing_asset_clause()
        ).all()
        count = len(assets)
        working_count = sum(1 for a in assets if a.status == AssetStatus.WORKING)
        faulty_count = count - working_count
        results = [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "lab_id": a.lab_id, "status": a.status.value, "category": a.category, "location": a.location_in_lab or "General"} for a in assets]

        if count > 0:
            bullets = "\n".join([f"• **{a.asset_id}**: {a.name} ({a.category}) — Status: **{a.status.value}** ({a.location_in_lab or 'Lab area'})" for a in assets])
            answer = f"Found **{count}** registered computer(s) in {lab_context_name} (**{working_count}** Working, **{faulty_count}** Faulty/Repair):\n\n{bullets}"
        else:
            answer = f"No computers or workstations found registered in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "COUNT_TOTAL_COMPUTERS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in live Asset records matching computing categories."
        }

    # -------------------------------------------------------------------------
    # Intent 1D: Pending Repair and Replacement Requests
    # -------------------------------------------------------------------------
    if (any(k in q_lower for k in ["pending repair", "active repair", "open repair"]) and any(k in q_lower for k in ["replacement", "replace"])) or "repair and replacement requests" in q_lower or "pending repair and replacement" in q_lower:
        open_faults = db.query(FaultReport).filter(
            FaultReport.lab_id.in_(scoped_lab_ids),
            FaultReport.status.in_([FaultStatus.REPORTED, FaultStatus.ASSIGNED, FaultStatus.IN_PROGRESS])
        ).all()
        rep_purchases = db.query(PurchaseRequest).filter(
            PurchaseRequest.lab_id.in_(scoped_lab_ids),
            PurchaseRequest.status.in_([PurchaseStatus.SUBMITTED, PurchaseStatus.UNDER_REVIEW, PurchaseStatus.PENDING_APPROVAL])
        ).all()
        total_requests = len(open_faults) + len(rep_purchases)
        results = [
            {"id": f.id, "asset_id": f.report_number, "name": f.title, "category": "Repair Ticket", "status": f.status.value, "lab_id": f.lab_id, "navigate_to": "faults"}
            for f in open_faults
        ] + [
            {"id": p.id, "asset_id": p.request_number, "name": p.item_name, "category": "Replacement Requisition", "status": p.status.value, "lab_id": p.lab_id, "navigate_to": "requests"}
            for p in rep_purchases
        ]
        bullets = [f"• **Repair Ticket {f.report_number}**: {f.title} ({f.priority.value} Priority — {f.status.value})" for f in open_faults[:5]]
        bullets += [f"• **Replacement PO {p.request_number}**: {p.item_name} (Qty: {p.quantity} — {p.status.value})" for p in rep_purchases[:5]]
        if total_requests > 0:
            answer = f"Found **{total_requests}** pending repair and replacement request(s) in {lab_context_name} (**{len(open_faults)}** repair tickets, **{len(rep_purchases)}** procurement requests):\n\n" + "\n".join(bullets)
        else:
            answer = f"There are currently zero pending repair tickets or replacement procurement requests in {lab_context_name}."
        return {
            "query": clean_q,
            "answer": answer,
            "spoken_text": generate_spoken_text(answer),
            "sql_intent": "PENDING_REPAIR_AND_REPLACEMENT_REQUESTS",
            "lab_context": lab_context_name,
            "record_count": total_requests,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in active FaultReport and pending PurchaseRequest records."
        }

    # -------------------------------------------------------------------------
    # Intent 2: "Which assets are currently under repair?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["under repair", "in repair", "being repaired", "technician repairing"]):
        assets = db.query(Asset).filter(
            Asset.lab_id.in_(scoped_lab_ids),
            Asset.status == AssetStatus.UNDER_REPAIR
        ).all()
        count = len(assets)
        results = [{"id": a.id, "asset_id": a.asset_id, "name": a.name, "category": a.category, "lab_id": a.lab_id, "status": a.status.value} for a in assets]
        
        if count > 0:
            asset_bullets = "\n".join([f"• **{a.asset_id}**: {a.name} ({a.category}) in Lab {a.lab_id}" for a in assets[:10]])
            answer = f"There are **{count}** asset(s) currently under repair in {lab_context_name}:\n\n{asset_bullets}"
        else:
            answer = f"No assets are currently under repair in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "ASSETS_UNDER_REPAIR",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in Asset records where status = UNDER_REPAIR."
        }

    # -------------------------------------------------------------------------
    # Intent 3: "Show all high-priority open faults."
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["high-priority", "high priority", "critical", "urgent"]) and any(k in q_lower for k in ["fault", "ticket", "issue", "breakdown"]):
        faults = db.query(FaultReport).filter(
            FaultReport.lab_id.in_(scoped_lab_ids),
            FaultReport.status.in_([FaultStatus.REPORTED, FaultStatus.ASSIGNED, FaultStatus.IN_PROGRESS]),
            FaultReport.priority.in_(["High", "Critical"])
        ).order_by(FaultReport.created_at.desc()).all()
        
        count = len(faults)
        results = [{
            "id": f.id,
            "report_number": f.report_number,
            "title": f.title,
            "priority": f.priority.value,
            "status": f.status.value,
            "lab_id": f.lab_id,
            "is_safety_hazard": f.is_safety_hazard
        } for f in faults]

        if count > 0:
            bullets = "\n".join([f"• **{f.report_number}** [{f.priority.value}]: {f.title} (Status: {f.status.value})" for f in faults[:10]])
            answer = f"Found **{count}** high-priority or critical open fault ticket(s) in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"Great news! There are no high-priority or critical open faults in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "HIGH_PRIORITY_FAULTS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in active FaultReport records with priority High/Critical."
        }

    # -------------------------------------------------------------------------
    # Intent 4: "Which items are below their configured reorder levels?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["reorder", "low stock", "below threshold", "threshold", "depleted"]):
        bulk_items = db.query(BulkInventory).filter(
            BulkInventory.lab_id.in_(scoped_lab_ids),
            BulkInventory.working_quantity < BulkInventory.min_threshold
        ).all()

        count = len(bulk_items)
        results = [{
            "id": b.id,
            "name": b.name,
            "category": b.category,
            "working_quantity": b.working_quantity,
            "min_threshold": b.min_threshold,
            "deficit": b.min_threshold - b.working_quantity,
            "lab_id": b.lab_id
        } for b in bulk_items]

        if count > 0:
            bullets = "\n".join([f"• **{b.name}** (Lab {b.lab_id}): Current stock {b.working_quantity} units vs Reorder Threshold {b.min_threshold} units (Shortfall: {b.min_threshold - b.working_quantity})" for b in bulk_items])
            answer = f"Attention: Found **{count}** inventory item(s) below configured reorder threshold in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"All consumable and bulk inventory items in {lab_context_name} are currently at or above configured reorder thresholds."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "ITEMS_BELOW_REORDER_LEVEL",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Calculated by comparing BulkInventory.working_quantity with min_threshold."
        }

    # -------------------------------------------------------------------------
    # Intent 5: "What repairs are waiting for instructor verification?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["instructor verification", "waiting for verification", "pending verification", "verify repair"]):
        repairs = db.query(RepairJob).join(FaultReport).filter(
            FaultReport.lab_id.in_(scoped_lab_ids),
            RepairJob.status == FaultStatus.PENDING_VERIFICATION
        ).all()

        count = len(repairs)
        results = [{
            "repair_id": r.id,
            "fault_report_number": r.fault_report.report_number,
            "fault_title": r.fault_report.title,
            "technician": r.technician.full_name if r.technician else "Unassigned",
            "repaired_at": r.repaired_at.isoformat() if r.repaired_at else None,
            "lab_id": r.fault_report.lab_id
        } for r in repairs]

        if count > 0:
            bullets = "\n".join([f"• Fault **{r.fault_report.report_number}**: {r.fault_report.title} (Completed by: {r.technician.full_name if r.technician else 'Tech'})" for r in repairs])
            answer = f"Found **{count}** repair job(s) completed by technicians and awaiting Lab Instructor verification in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"No repair jobs are currently awaiting instructor verification in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "REPAIRS_AWAITING_VERIFICATION",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in RepairJob records where status = PENDING_VERIFICATION."
        }

    # -------------------------------------------------------------------------
    # Intent 6: "Which purchase requests are awaiting my approval?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["awaiting my approval", "my approval", "pending my review", "sanction requests"]):
        # Restrict by user role to avoid leaking approval queues
        if user.role == UserRole.HOD:
            purchases = db.query(PurchaseRequest).filter(
                PurchaseRequest.status.in_([PurchaseStatus.SUBMITTED, PurchaseStatus.UNDER_REVIEW, PurchaseStatus.PENDING_APPROVAL]),
                PurchaseRequest.hod_approval_status == "PENDING"
            ).all()
        elif user.role == UserRole.PRINCIPAL:
            purchases = db.query(PurchaseRequest).filter(
                PurchaseRequest.status.in_([PurchaseStatus.UNDER_REVIEW, PurchaseStatus.PENDING_APPROVAL]),
                PurchaseRequest.hod_approval_status == "APPROVED",
                PurchaseRequest.principal_approval_status == "PENDING"
            ).all()
        elif user.role == UserRole.ADMIN:
            purchases = db.query(PurchaseRequest).filter(
                PurchaseRequest.status.in_([PurchaseStatus.SUBMITTED, PurchaseStatus.UNDER_REVIEW, PurchaseStatus.PENDING_APPROVAL])
            ).all()
        else:
            return {
                "query": clean_q,
                "answer": "Notice: Your role does not possess financial approval or executive sanction authority for purchase requisitions. Approvals are reserved for Head of Department (HOD) and Principal.",
                "sql_intent": "PURCHASE_APPROVALS_RESTRICTED",
                "lab_context": "N/A",
                "record_count": 0,
                "results": [],
                "authorized_labs": auth_lab_names,
                "timestamp": now_str,
                "disclaimer": "Role-specific authorization filter applied."
            }

        count = len(purchases)
        results = [{
            "id": p.id,
            "request_number": p.request_number,
            "item_name": p.item_name,
            "quantity": p.quantity,
            "estimated_cost": p.estimated_total_cost or (p.quantity * (p.estimated_unit_cost or 0)),
            "status": p.status.value,
            "lab_id": p.lab_id
        } for p in purchases]

        if count > 0:
            bullets = "\n".join([f"• **{p.request_number}**: {p.item_name} (Qty: {p.quantity}, Est. Total: ₹{p.estimated_total_cost:,.2f}) for Lab {p.lab_id}" for p in purchases])
            answer = f"Found **{count}** purchase requisition(s) currently awaiting your executive approval:\n\n{bullets}"
        else:
            answer = "There are currently no purchase requisitions awaiting your approval."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "PURCHASE_REQUESTS_AWAITING_APPROVAL",
            "lab_context": "Department Sanctioning Queue",
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Filtered strictly by current user sanctioning authority."
        }

    # -------------------------------------------------------------------------
    # Intent 7: "What equipment was transferred between laboratories this month?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["transfer", "transferred", "relocated", "moved"]) and any(k in q_lower for k in ["month", "recent", "this month"]):
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        transfers = db.query(TransferRequest).filter(
            (TransferRequest.source_lab_id.in_(scoped_lab_ids)) | (TransferRequest.destination_lab_id.in_(scoped_lab_ids)),
            TransferRequest.created_at >= thirty_days_ago
        ).order_by(TransferRequest.created_at.desc()).all()

        count = len(transfers)
        results = [{
            "id": t.id,
            "request_number": t.request_number,
            "source_lab_id": t.source_lab_id,
            "destination_lab_id": t.destination_lab_id,
            "quantity": t.quantity,
            "status": t.status.value,
            "created_at": t.created_at.isoformat()
        } for t in transfers]

        if count > 0:
            bullets = "\n".join([f"• **{t.request_number}**: Lab {t.source_lab_id} → Lab {t.destination_lab_id} (Status: {t.status.value}, Qty: {t.quantity})" for t in transfers[:10]])
            answer = f"Found **{count}** inter-lab transfer record(s) logged in the last 30 days within your authorized scope:\n\n{bullets}"
        else:
            answer = f"No equipment or stock transfers were initiated or completed in the last 30 days for {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "RECENT_TRANSFERS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in TransferRequest records from the last 30 days."
        }

    # -------------------------------------------------------------------------
    # Intent 8: "Which assets have repeated fault reports?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["repeated", "multiple faults", "chronic", "frequent", "recurring", "repeat"]):
        fault_counts = db.query(
            FaultReport.asset_id,
            func.count(FaultReport.id).label("fault_count")
        ).filter(
            FaultReport.lab_id.in_(scoped_lab_ids),
            FaultReport.asset_id.isnot(None)
        ).group_by(FaultReport.asset_id).having(func.count(FaultReport.id) >= 2).all()

        count = len(fault_counts)
        results = []
        bullets = []
        for asset_id, f_count in fault_counts:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                results.append({"asset_id": asset.asset_id, "name": asset.name, "lab_id": asset.lab_id, "fault_count": f_count})
                bullets.append(f"• **{asset.asset_id}** ({asset.name}) in Lab {asset.lab_id}: **{f_count}** reported fault incidents")

        if count > 0:
            answer = f"Found **{count}** asset(s) with repeated (2 or more) fault incidents in {lab_context_name}:\n\n" + "\n".join(bullets)
        else:
            answer = f"No chronic assets with repeated (2+) fault incidents detected in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "REPEATED_FAULT_ASSETS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Aggregated by Asset.id with HAVING COUNT(FaultReport.id) >= 2."
        }

    # -------------------------------------------------------------------------
    # Intent 9: "Summarize the current inventory of each laboratory."
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["summarize", "summary", "overview", "current inventory of each lab", "lab summary"]):
        summary_results = []
        bullets = []
        for lab in auth_labs:
            total_assets = db.query(Asset).filter(Asset.lab_id == lab.id).count()
            working_assets = db.query(Asset).filter(Asset.lab_id == lab.id, Asset.status == AssetStatus.WORKING).count()
            faulty_assets = db.query(Asset).filter(Asset.lab_id == lab.id, Asset.status.in_([AssetStatus.FAULT_REPORTED, AssetStatus.UNDER_REPAIR])).count()
            bulk_count = db.query(BulkInventory).filter(BulkInventory.lab_id == lab.id).count()
            
            summary_results.append({
                "lab_id": lab.id,
                "lab_name": lab.name,
                "code": lab.code,
                "total_assets": total_assets,
                "working_assets": working_assets,
                "faulty_assets": faulty_assets,
                "bulk_items": bulk_count
            })
            bullets.append(f"• **{lab.name} ({lab.code})**: {total_assets} Serialized Assets ({working_assets} Working, {faulty_assets} Faulty/Repair) | {bulk_count} Bulk Categories")

        answer = f"### Laboratory Inventory Summary:\n\n" + "\n".join(bullets)
        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "LAB_INVENTORY_SUMMARY",
            "lab_context": "Authorized Laboratories",
            "record_count": len(summary_results),
            "results": summary_results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Aggregated live asset and bulk inventory records per authorized laboratory."
        }

    # -------------------------------------------------------------------------
    # Intent 10: "Which approved purchase requests have not been fully received?"
    # -------------------------------------------------------------------------
    if any(k in q_lower for k in ["approved", "purchase"]) and any(k in q_lower for k in ["not been fully received", "partially received", "not received", "outstanding", "pending receipt"]):
        purchases = db.query(PurchaseRequest).filter(
            PurchaseRequest.lab_id.in_(scoped_lab_ids),
            PurchaseRequest.status.in_([PurchaseStatus.ORDERED, PurchaseStatus.PARTIALLY_RECEIVED, PurchaseStatus.APPROVED])
        ).all()

        count = len(purchases)
        results = [{
            "id": p.id,
            "request_number": p.request_number,
            "po_number": p.po_number,
            "item_name": p.item_name,
            "ordered_quantity": p.quantity,
            "quantity_received": p.quantity_received or 0,
            "quantity_outstanding": p.quantity_outstanding or p.quantity,
            "status": p.status.value,
            "lab_id": p.lab_id
        } for p in purchases]

        if count > 0:
            bullets = "\n".join([f"• **{p.request_number}** (PO: {p.po_number or 'In Procurement'}): {p.item_name} — Ordered: {p.quantity}, Received: {p.quantity_received or 0}, Outstanding: {p.quantity_outstanding or p.quantity} (Status: {p.status.value})" for p in purchases])
            answer = f"Found **{count}** approved purchase order(s) awaiting delivery or commissioning in {lab_context_name}:\n\n{bullets}"
        else:
            answer = f"No approved purchase orders are currently outstanding or pending delivery in {lab_context_name}."

        return {
            "query": clean_q,
            "answer": answer,
            "sql_intent": "OUTSTANDING_PURCHASE_RECEIPTS",
            "lab_context": lab_context_name,
            "record_count": count,
            "results": results,
            "authorized_labs": auth_lab_names,
            "timestamp": now_str,
            "disclaimer": "Grounded in PurchaseRequest records where status is ORDERED or PARTIALLY_RECEIVED."
        }

    # -------------------------------------------------------------------------
    # Fallback / Clarification Prompt
    # -------------------------------------------------------------------------
    return {
        "query": clean_q,
        "answer": (
            "I could not safely match your question to a supported database query pattern without risk of ambiguity. "
            "Please try asking one of the following grounded inquiries:\n\n"
            "• *How many working computers are in Laboratory 1?*\n"
            "• *Which assets are currently under repair?*\n"
            "• *Show all high-priority open faults.*\n"
            "• *Which items are below their configured reorder levels?*\n"
            "• *What repairs are waiting for instructor verification?*\n"
            "• *Which purchase requests are awaiting my approval?*\n"
            "• *What equipment was transferred between laboratories this month?*\n"
            "• *Which assets have repeated fault reports?*\n"
            "• *Summarize the current inventory of each laboratory.*\n"
            "• *Which approved purchase requests have not been fully received?*"
        ),
        "sql_intent": "UNSUPPORTED_OR_AMBIGUOUS_QUERY",
        "lab_context": lab_context_name,
        "record_count": 0,
        "results": [],
        "authorized_labs": auth_lab_names,
        "timestamp": now_str,
        "disclaimer": "Grounded AI safeguards prevent speculative answers when intent is ambiguous."
    }

def process_assistant_query(query: str, user: User, db: Session) -> Dict[str, Any]:
    """Public entry point: enforces authentication, runs query, and ensures natural spoken_text for TTS."""
    res = _process_assistant_query_internal(query, user, db)
    if not res.get("spoken_text"):
        res["spoken_text"] = generate_spoken_text(res.get("answer", ""))
    return res
