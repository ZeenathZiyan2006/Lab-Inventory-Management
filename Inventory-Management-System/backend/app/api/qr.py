from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from typing import Optional, Tuple
import os
import socket
from urllib.parse import urlparse, parse_qs
from app.core.database import get_db
from app.core.permissions import get_current_user, get_optional_current_user, verify_lab_access
from app.models.models import Asset, Laboratory, BulkInventory, InventoryHistory, User, UserRole
from app.schemas.schemas import QRLookupRequest
from app.services.qr_service import generate_qr_base64, generate_qr_svg, generate_qr_png_bytes
from app.services.audit_service import log_audit

router = APIRouter(prefix="/qr", tags=["QR Code System"])

def get_frontend_base_url(request: Optional[Request] = None) -> str:
    """
    Returns the reachable base URL for the frontend application.
    Prioritizes:
    1. FRONTEND_URL environment variable
    2. Request Origin / Referer header (if on LAN IP or remote hostname)
    3. Auto-detected LAN IP so smartphone camera scans work across local Wi-Fi
    4. Fallback to http://localhost:5173
    """
    env_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if env_url:
        return env_url

    if request:
        origin = request.headers.get("origin")
        if origin and "localhost" not in origin and "127.0.0.1" not in origin:
            return origin.rstrip("/")
        referer = request.headers.get("referer")
        if referer:
            try:
                parsed = urlparse(referer)
                if parsed.scheme and parsed.netloc and "localhost" not in parsed.netloc and "127.0.0.1" not in parsed.netloc:
                    return f"{parsed.scheme}://{parsed.netloc}"
            except Exception:
                pass

    # Auto-detect local Wi-Fi / LAN IP so smartphones on the same network can open the web link
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
        if lan_ip and not lan_ip.startswith("127."):
            return f"http://{lan_ip}:5173"
    except Exception:
        pass

    if request:
        origin = request.headers.get("origin")
        if origin:
            return origin.rstrip("/")

    return "http://localhost:5173"

def extract_clean_token(raw_token: str, request: Optional[Request] = None) -> Tuple[str, str]:
    """
    Extracts the clean identifier from URLs, query parameters, or token formats.
    Returns (clean_token, stripped_token).
    Handles:
    - Direct tags: 'SMVITM-AI-PC-001'
    - Query strings: '?scan=XYZ', '?asset=XYZ'
    - Full web URLs: 'http://10.61.148.174:5173/?scan=SMVITM-AI-PC-001'
    - Prefixed tokens: 'ASSET:XYZ', 'SMVITM_ASSET:XYZ', 'SMVITM_LAB:XYZ'
    """
    clean = (raw_token or "").strip()

    if request:
        for q in ["scan", "asset", "id", "tag", "token", "code"]:
            val = request.query_params.get(q)
            if val:
                clean = val.strip()
                break

    if "://" in clean or "?" in clean:
        try:
            parsed = urlparse(clean)
            qs = parse_qs(parsed.query)
            found = False
            for key in ["scan", "asset", "id", "tag", "token", "code"]:
                if key in qs and qs[key]:
                    clean = qs[key][0].strip()
                    found = True
                    break
            if not found:
                path_parts = [p for p in parsed.path.split("/") if p]
                if path_parts:
                    clean = path_parts[-1].strip()
        except Exception:
            pass

    for param in ["scan=", "asset=", "tag=", "token=", "id="]:
        if param in clean.lower():
            clean = clean.split(param)[-1].split("&")[0].strip()
            break

    stripped = clean
    for prefix in ["SMVITM_ASSET:", "ASSET:", "SMVITM_LAB:", "LAB-"]:
        if stripped.upper().startswith(prefix):
            stripped = stripped[len(prefix):].strip()

    return clean, stripped

def _resolve_asset_data(asset: Asset, current_user: Optional[User], db: Session):
    is_assigned = verify_lab_access(current_user, asset.lab_id, db) if current_user else False
    history = db.query(InventoryHistory).filter(InventoryHistory.asset_id == asset.id).order_by(InventoryHistory.timestamp.desc()).limit(5).all()

    return {
        "type": "ASSET",
        "id": asset.id,
        "asset_id": asset.asset_id,
        "name": asset.name,
        "category": asset.category,
        "lab_id": asset.lab_id,
        "lab_name": asset.laboratory.name if asset.laboratory else f"Lab {asset.lab_id}",
        "location_in_lab": asset.location_in_lab,
        "status": asset.status.value,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "purchase_date": asset.purchase_date.strftime("%Y-%m-%d") if asset.purchase_date else None,
        "can_report_fault": current_user is not None,
        "can_edit": ((current_user.role == UserRole.ADMIN) if current_user else False) or is_assigned,
        "is_authenticated": current_user is not None,
        "recent_history": [
            {
                "action": h.action,
                "status": h.new_status or h.previous_status or "Updated",
                "reason": h.reason,
                "date": h.timestamp.strftime("%Y-%m-%d %H:%M")
            }
            for h in history
        ]
    }

def _resolve_lab_data(lab: Laboratory):
    return {
        "type": "LABORATORY",
        "id": lab.id,
        "name": lab.name,
        "code": lab.code,
        "room_number": lab.room_number,
        "department": lab.department.name if lab.department else "Artificial Intelligence and Data Science",
        "total_assets": len([a for a in lab.assets if a.is_active]),
        "assigned_instructors": [u.full_name for u in lab.assigned_users if u.is_active]
    }

def _resolve_bulk_data(bulk: BulkInventory, current_user: Optional[User], db: Session):
    is_assigned = verify_lab_access(current_user, bulk.lab_id, db) if current_user else False

    return {
        "type": "BULK",
        "id": bulk.id,
        "name": bulk.name,
        "category": bulk.category,
        "lab_id": bulk.lab_id,
        "lab_name": bulk.laboratory.name if bulk.laboratory else f"Lab {bulk.lab_id}",
        "total_quantity": bulk.total_quantity,
        "working_quantity": bulk.working_quantity,
        "damaged_quantity": bulk.damaged_quantity,
        "missing_quantity": bulk.missing_quantity,
        "under_repair_quantity": bulk.under_repair_quantity,
        "min_threshold": bulk.min_threshold,
        "is_low_stock": bulk.working_quantity < bulk.min_threshold,
        "can_edit": ((current_user.role == UserRole.ADMIN) if current_user else False) or is_assigned,
        "is_authenticated": current_user is not None
    }

@router.get("/scan/{qr_token:path}")
def resolve_qr_scan(
    qr_token: str,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Securely resolves an opaque QR token, asset tag, or direct URL and returns item details."""
    clean_token, stripped_token = extract_clean_token(qr_token, request)

    # Case 1: Direct Asset QR or Tag match
    asset = db.query(Asset).filter(
        (Asset.asset_id.ilike(clean_token)) |
        (Asset.asset_id.ilike(stripped_token)) |
        (Asset.serial_number.ilike(clean_token)) |
        (Asset.serial_number.ilike(stripped_token)) |
        (Asset.qr_code == clean_token) |
        (Asset.qr_code == f"ASSET:{stripped_token}") |
        (Asset.qr_code == f"SMVITM_ASSET:{stripped_token}")
    ).first()
    if asset:
        return _resolve_asset_data(asset, current_user, db)

    # Case 1b: Special QR format QR:tag:serial
    if clean_token.startswith("QR:"):
        parts = clean_token.split(":")
        if len(parts) >= 2:
            tag = parts[1]
            asset = db.query(Asset).filter(
                (Asset.asset_id.ilike(tag)) | (Asset.serial_number.ilike(tag))
            ).first()
            if asset:
                return _resolve_asset_data(asset, current_user, db)

    # Case 2: Bulk Inventory QR
    if clean_token.startswith("BULK:"):
        parts = clean_token.split(":")
        bulk = None
        if len(parts) >= 3:
            try:
                lab_id_int = int(parts[1])
                name_clean = parts[2].replace("_", " ")
                bulk = db.query(BulkInventory).filter(
                    BulkInventory.lab_id == lab_id_int,
                    BulkInventory.name.ilike(name_clean)
                ).first()
            except ValueError:
                pass
        if not bulk:
            bulk = db.query(BulkInventory).filter(BulkInventory.qr_code == clean_token).first()
        if not bulk:
            raise HTTPException(status_code=404, detail="Bulk inventory item not found")
        return _resolve_bulk_data(bulk, current_user, db)

    # Case 3: Laboratory QR or Name
    # Support "Lab 1 Door", "Lab 1", "LAB-AIDS-LAB-01", "AIDS-LAB-01"
    lab_search_term = stripped_token
    if "lab 1" in clean_token.lower():
        lab_search_term = "AIDS-LAB-01"
    elif "lab 2" in clean_token.lower():
        lab_search_term = "AIDS-LAB-02"
    elif "lab 3" in clean_token.lower():
        lab_search_term = "AIDS-LAB-03"

    lab = db.query(Laboratory).filter(
        (Laboratory.code.ilike(lab_search_term)) |
        (Laboratory.code.ilike(clean_token)) |
        (Laboratory.qr_code.ilike(clean_token)) |
        (Laboratory.qr_code.ilike(f"LAB-{lab_search_term}")) |
        (Laboratory.qr_code.ilike(f"SMVITM_LAB:{clean_token}")) |
        (Laboratory.name.ilike(f"%{clean_token}%"))
    ).first()
    if lab:
        return _resolve_lab_data(lab)

    # Case 4: Fuzzy Asset Lookup fallback (contains search)
    fuzzy_asset = db.query(Asset).filter(
        (Asset.asset_id.ilike(f"%{stripped_token}%")) |
        (Asset.name.ilike(f"%{stripped_token}%")) |
        (Asset.serial_number.ilike(f"%{stripped_token}%"))
    ).first()
    if fuzzy_asset:
        return _resolve_asset_data(fuzzy_asset, current_user, db)

    raise HTTPException(
        status_code=404,
        detail=f"No matching asset, laboratory or bulk item found for identifier '{clean_token}'"
    )

@router.post("/lookup")
def manual_qr_lookup(
    payload: QRLookupRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Allows lookup of any QR token, Asset ID, Serial Number, or Web URL with full guest/authenticated support."""
    return resolve_qr_scan(qr_token=payload.identifier, request=None, db=db, current_user=current_user)

@router.get("/label/{asset_id}")
def get_printable_label(
    asset_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates printable college QR label data encoding a direct browser URL for instant smartphone camera scanning."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    base_url = get_frontend_base_url(request)
    web_url = f"{base_url}/?scan={asset.asset_id}"
    qr_image = generate_qr_base64(web_url)
    qr_svg = generate_qr_svg(web_url)
    return {
        "institution": "Shri Madhwa Vadiraja Institute of Technology & Management (SMVITM)",
        "department": "Dept of Artificial Intelligence & Data Science",
        "asset_id": asset.asset_id,
        "name": asset.name,
        "category": asset.category,
        "lab": asset.laboratory.name if asset.laboratory else f"Lab {asset.lab_id}",
        "location": asset.location_in_lab or "General",
        "serial_number": asset.serial_number,
        "status": asset.status.value,
        "qr_code_token": asset.qr_code,
        "web_url": web_url,
        "qr_image_base64": qr_image,
        "qr_svg": qr_svg
    }

@router.get("/download/{asset_id}/png")
def download_asset_qr_png(
    asset_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Downloads standalone PNG QR code encoding the direct clickable web URL."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    web_url = f"{get_frontend_base_url(request)}/?scan={asset.asset_id}"
    png_bytes = generate_qr_png_bytes(web_url)
    clean_id = asset.asset_id.replace(" ", "_")
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="SMVITM-QR-{clean_id}.png"'}
    )

@router.get("/download/{asset_id}/svg")
def download_asset_qr_svg(
    asset_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Downloads standalone SVG vector QR code encoding the direct clickable web URL."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    web_url = f"{get_frontend_base_url(request)}/?scan={asset.asset_id}"
    svg_str = generate_qr_svg(web_url)
    clean_id = asset.asset_id.replace(" ", "_")
    return Response(
        content=svg_str,
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'attachment; filename="SMVITM-QR-{clean_id}.svg"'}
    )

@router.get("/bulk-label/{bulk_id}")
def get_bulk_printable_label(
    bulk_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates printable college QR label data for bulk storage bin / shelf encoding a direct browser URL."""
    bulk = db.query(BulkInventory).filter(BulkInventory.id == bulk_id).first()
    if not bulk:
        raise HTTPException(status_code=404, detail="Bulk item not found")

    web_url = f"{get_frontend_base_url(request)}/?scan=BULK-{bulk.id:04d}"
    qr_image = generate_qr_base64(web_url)
    return {
        "institution": "Shri Madhwa Vadiraja Institute of Technology & Management (SMVITM)",
        "department": "Dept of Artificial Intelligence & Data Science",
        "asset_id": f"BULK-{bulk.id:04d}",
        "name": bulk.name,
        "category": bulk.category,
        "lab": bulk.laboratory.name if bulk.laboratory else f"Lab {bulk.lab_id}",
        "location": f"Storage Bin (Total: {bulk.total_quantity} units)",
        "qr_code_token": bulk.qr_code,
        "web_url": web_url,
        "qr_image_base64": qr_image
    }

@router.get("/lab-label/{lab_id}")
def get_lab_printable_label(
    lab_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates printable laboratory door placard encoding a direct browser URL."""
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")

    web_url = f"{get_frontend_base_url(request)}/?scan={lab.code}"
    qr_image = generate_qr_base64(web_url)
    return {
        "institution": "Shri Madhwa Vadiraja Institute of Technology & Management (SMVITM)",
        "department": lab.department.name if lab.department else "Department of Artificial Intelligence & Data Science",
        "lab_name": lab.name,
        "room_number": lab.room_number,
        "code": lab.code,
        "qr_code_token": f"SMVITM_LAB:{lab.qr_code}",
        "web_url": web_url,
        "qr_image_base64": qr_image,
        "instructors": [u.full_name for u in lab.assigned_users if u.is_active]
    }
