from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from app.models.models import UserRole, AssetStatus, FaultPriority, FaultStatus, TransferStatus, PurchaseStatus, PurchaseRequestType

# --- Authentication & Users ---
class Token(BaseModel):
    access_token: str
    token_type: str
    id: Optional[int] = None
    role: UserRole
    email: str
    full_name: str
    department_id: Optional[int] = None
    assigned_labs: List[int] = []

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str
    role: Optional[UserRole] = None

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError('Full name cannot be empty')
        if len(trimmed) < 2:
            raise ValueError('Full name must be at least 2 characters long')
        return trimmed

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole
    department_id: Optional[int] = None
    phone_number: Optional[str] = None
    assigned_lab_ids: Optional[List[int]] = []

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None
    assigned_lab_ids: Optional[List[int]] = None

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    department_id: Optional[int] = None
    phone_number: Optional[str] = None
    is_active: bool
    created_at: datetime
    assigned_labs: List[int] = []

    class Config:
        from_attributes = True

# --- Laboratories & Departments ---
class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True

class LaboratoryCreate(BaseModel):
    name: str
    code: str
    department_id: int = 1
    room_number: str
    description: Optional[str] = None
    assigned_instructor_ids: Optional[List[int]] = []

class LaboratoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    room_number: Optional[str] = None
    description: Optional[str] = None
    assigned_instructor_ids: Optional[List[int]] = None

class LaboratoryResponse(BaseModel):
    id: int
    name: str
    code: str
    department_id: int
    department_name: Optional[str] = None
    room_number: str
    description: Optional[str] = None
    qr_code: Optional[str] = None
    is_active: bool
    created_at: datetime
    assigned_instructor_names: Optional[List[str]] = []
    assigned_instructor_ids: Optional[List[int]] = []
    active_equipment_count: Optional[int] = 0
    open_fault_count: Optional[int] = 0
    bulk_items_count: Optional[int] = 0

    class Config:
        from_attributes = True

# --- Inventory ---
class AssetCreate(BaseModel):
    asset_id: str
    name: str
    category: str
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    department_id: int = 1
    lab_id: int
    location_in_lab: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: Optional[float] = None
    warranty_expiry: Optional[datetime] = None
    status: Optional[AssetStatus] = AssetStatus.WORKING

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            for member in AssetStatus:
                if member.value.lower() == v.strip().lower():
                    return member
        return v

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    lab_id: Optional[int] = None
    location_in_lab: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: Optional[float] = None
    warranty_expiry: Optional[datetime] = None
    status: Optional[AssetStatus] = None
    reason: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            for member in AssetStatus:
                if member.value.lower() == v.strip().lower():
                    return member
        return v

class AssetStatusUpdate(BaseModel):
    status: AssetStatus
    reason: str

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            for member in AssetStatus:
                if member.value.lower() == v.strip().lower():
                    return member
        return v

class AssetResponse(BaseModel):
    id: int
    asset_id: str
    name: str
    category: str
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    department_id: int
    lab_id: int
    lab_name: Optional[str] = None
    location_in_lab: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: Optional[float] = None
    warranty_expiry: Optional[datetime] = None
    status: AssetStatus
    qr_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PaginatedAssetResponse(BaseModel):
    items: List[AssetResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class InventorySummaryResponse(BaseModel):
    total_active_assets: int
    working_assets: int
    damaged_assets: int
    missing_assets: int
    under_repair_assets: int
    fault_reported_assets: int
    retired_assets: int
    low_stock_bulk_items: int

class InventoryHistoryResponse(BaseModel):
    id: int
    asset_id: Optional[int] = None
    bulk_id: Optional[int] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    quantity_changed: Optional[int] = None
    reason: str
    timestamp: datetime

    class Config:
        from_attributes = True

class AssetDetailResponse(AssetResponse):
    laboratory_name: Optional[str] = None
    department_name: Optional[str] = None
    history: List[InventoryHistoryResponse] = []
    active_fault: Optional[Any] = None

class BulkInventoryCreate(BaseModel):
    name: str
    category: str
    department_id: int = 1
    lab_id: int
    total_quantity: int = Field(ge=0)
    working_quantity: int = Field(ge=0)
    damaged_quantity: int = Field(default=0, ge=0)
    missing_quantity: int = Field(default=0, ge=0)
    under_repair_quantity: int = Field(default=0, ge=0)
    min_threshold: int = Field(default=5, ge=0)

class BulkInventoryUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    min_threshold: Optional[int] = None

class BulkInventoryAdjust(BaseModel):
    working_quantity: int = Field(ge=0)
    damaged_quantity: int = Field(ge=0)
    missing_quantity: int = Field(ge=0)
    under_repair_quantity: int = Field(ge=0)
    reason: str

class BulkInventoryResponse(BaseModel):
    id: int
    name: str
    category: str
    department_id: int
    lab_id: int
    lab_name: Optional[str] = None
    total_quantity: int
    working_quantity: int
    damaged_quantity: int
    missing_quantity: int
    under_repair_quantity: int
    min_threshold: int
    is_low_stock: Optional[bool] = False
    qr_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- QR Code & Scanning ---
class QRLookupRequest(BaseModel):
    identifier: str

# --- Faults & Repairs ---
class RepairPartItemCreate(BaseModel):
    part_name: str
    part_number: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit_cost: float = Field(default=0.0, ge=0.0)

class RepairPartItemResponse(BaseModel):
    id: int
    repair_id: int
    part_name: str
    part_number: Optional[str] = None
    quantity: int
    unit_cost: float
    created_at: datetime

    class Config:
        from_attributes = True

class FaultStatusHistoryResponse(BaseModel):
    id: int
    fault_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: str
    action: Optional[str] = None
    reason: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class FaultReportCreate(BaseModel):
    title: Optional[str] = None
    asset_id: Optional[int] = None
    bulk_id: Optional[int] = None
    lab_id: int
    fault_category: str
    priority: FaultPriority = FaultPriority.MEDIUM
    description: str
    photo_url: Optional[str] = None
    is_safety_hazard: bool = False
    safety_warning: Optional[str] = None

class RepairJobAssign(BaseModel):
    fault_id: Optional[int] = None
    technician_id: int
    due_date: Optional[datetime] = None
    assignment_notes: Optional[str] = None

class RepairJobUpdate(BaseModel):
    status: Optional[FaultStatus] = None
    diagnosis: Optional[str] = None
    troubleshooting_steps: Optional[str] = None
    work_performed: Optional[str] = None
    notes: Optional[str] = None
    parts_requested: Optional[str] = None
    repair_cost: Optional[float] = None
    replacement_recommended: Optional[bool] = False
    unable_to_repair_reason: Optional[str] = None
    parts_used: Optional[List[RepairPartItemCreate]] = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ["awaiting verification", "repair completed — awaiting verification", "repair completed"]:
                return FaultStatus.AWAITING_VERIFICATION
            if v_lower in ["closed", "verified and closed"]:
                return FaultStatus.CLOSED
            for member in FaultStatus:
                if member.value.lower() == v_lower:
                    return member
        return v

class RepairJobVerify(BaseModel):
    is_verified: bool
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class FaultRejectRequest(BaseModel):
    rejection_reason: str

class FaultReopenRequest(BaseModel):
    reopen_reason: str

class RepairJobResponse(BaseModel):
    id: int
    fault_id: int
    technician_id: int
    technician_name: Optional[str] = None
    assigned_by_id: Optional[int] = None
    assigned_by_name: Optional[str] = None
    status: FaultStatus
    due_date: Optional[datetime] = None
    assignment_notes: Optional[str] = None
    diagnosis: Optional[str] = None
    troubleshooting_steps: Optional[str] = None
    work_performed: Optional[str] = None
    notes: Optional[str] = None
    parts_requested: Optional[str] = None
    repair_cost: float = 0.0
    completion_time: Optional[datetime] = None
    replacement_recommended: bool = False
    unable_to_repair_reason: Optional[str] = None
    is_verified: bool = False
    verified_by_id: Optional[int] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    parts_used: List[RepairPartItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FaultReportResponse(BaseModel):
    id: int
    report_number: str
    title: Optional[str] = None
    asset_id: Optional[int] = None
    asset_custom_id: Optional[str] = None
    asset_name: Optional[str] = None
    bulk_id: Optional[int] = None
    bulk_name: Optional[str] = None
    lab_id: int
    lab_name: Optional[str] = None
    reported_by_id: int
    reported_by_name: Optional[str] = None
    fault_category: str
    priority: FaultPriority
    description: str
    photo_url: Optional[str] = None
    is_safety_hazard: bool = False
    safety_warning: Optional[str] = None
    rejection_reason: Optional[str] = None
    ai_suggested_category: Optional[str] = None
    ai_suggested_priority: Optional[str] = None
    ai_confidence: Optional[float] = None
    status: FaultStatus
    created_at: datetime
    updated_at: datetime
    repair_job: Optional[RepairJobResponse] = None
    status_history: List[FaultStatusHistoryResponse] = []

    class Config:
        from_attributes = True

class TechnicianSummaryResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone_number: Optional[str] = None
    active_assigned_jobs: int = 0
    completed_repairs: int = 0

# --- Transfers ---
class TransferApprovalDecisionResponse(BaseModel):
    id: int
    transfer_id: int
    approver_id: int
    approver_name: Optional[str] = None
    role_at_approval: str
    stage: str
    decision: str
    comments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TransferStatusHistoryResponse(BaseModel):
    id: int
    transfer_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: str
    action: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TransferRequestCreate(BaseModel):
    source_lab_id: int
    destination_lab_id: int
    asset_id: Optional[int] = None
    bulk_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)
    reason: str
    priority: Optional[str] = "Normal"
    notes: Optional[str] = None
    is_draft: Optional[bool] = False
    requires_principal_approval: Optional[bool] = True

class TransferApproval(BaseModel):
    status: str  # Approved, Rejected, More Info Requested
    remarks: Optional[str] = None
    stage: Optional[str] = None

class TransferApprovalRequest(BaseModel):
    decision: str  # Approved, Rejected, More Info Requested
    stage: Optional[str] = None
    comments: Optional[str] = None
    rejection_reason: Optional[str] = None

class TransferDispatchConfirm(BaseModel):
    dispatch_notes: Optional[str] = None

class TransferReceiptConfirm(BaseModel):
    condition: str = "Good"  # Good, Damaged, Discrepancy
    discrepancy_notes: Optional[str] = None

class TransferDisputeRequest(BaseModel):
    dispute_reason: str

class TransferCancelRequest(BaseModel):
    cancellation_reason: str

class TransferResponse(BaseModel):
    id: int
    request_number: str
    source_lab_id: int
    source_lab_name: Optional[str] = None
    destination_lab_id: int
    destination_lab_name: Optional[str] = None
    asset_id: Optional[int] = None
    asset_custom_id: Optional[str] = None
    asset_name: Optional[str] = None
    bulk_id: Optional[int] = None
    bulk_item_name: Optional[str] = None
    quantity: int
    requested_by_id: int
    requested_by_name: Optional[str] = None
    reason: str
    priority: str = "Normal"
    notes: Optional[str] = None
    status: TransferStatus
    requires_hod_approval: bool
    hod_approved_by_id: Optional[int] = None
    hod_approved_by_name: Optional[str] = None
    hod_approval_status: str
    hod_remarks: Optional[str] = None
    requires_principal_approval: bool
    principal_approved_by_id: Optional[int] = None
    principal_approved_by_name: Optional[str] = None
    principal_approval_status: str
    principal_remarks: Optional[str] = None
    dispatched_by_id: Optional[int] = None
    dispatched_by_name: Optional[str] = None
    dispatched_at: Optional[datetime] = None
    dispatch_notes: Optional[str] = None
    received_by_id: Optional[int] = None
    received_by_name: Optional[str] = None
    received_at: Optional[datetime] = None
    receipt_condition: Optional[str] = None
    receipt_discrepancy_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    approval_decisions: List[TransferApprovalDecisionResponse] = []
    status_history: List[TransferStatusHistoryResponse] = []

    class Config:
        from_attributes = True

# --- Purchases & Goods Receipt ---
class PurchaseApprovalDecisionResponse(BaseModel):
    id: int
    purchase_id: int
    approver_id: int
    approver_name: Optional[str] = None
    role_at_approval: str
    stage: str
    decision: str
    comments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GoodsReceiptRecordResponse(BaseModel):
    id: int
    purchase_id: int
    received_by_id: int
    received_by_name: Optional[str] = None
    quantity_received: int
    condition_received: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PurchaseStatusHistoryResponse(BaseModel):
    id: int
    purchase_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: str
    action: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PurchaseRequestCreate(BaseModel):
    request_type: Optional[str] = "New Purchase"  # New Purchase, Replenishment, Replacement
    item_name: str
    description: Optional[str] = None
    category: str
    lab_id: int
    quantity: int = Field(default=1, ge=1)
    unit: Optional[str] = "Units"
    estimated_unit_cost: Optional[float] = None
    estimated_cost: Optional[float] = None  # Backward compatibility
    justification: str
    linked_fault_id: Optional[int] = None
    linked_asset_id: Optional[int] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    quotation_ref: Optional[str] = None
    attachment_url: Optional[str] = None
    is_draft: Optional[bool] = False

class PurchaseApproval(BaseModel):
    status: str  # Approved or Rejected
    remarks: Optional[str] = None
    stage: Optional[str] = None

class PurchaseApprovalRequest(BaseModel):
    decision: str  # Approved, Rejected, More Info Requested
    stage: Optional[str] = None
    comments: Optional[str] = None
    rejection_reason: Optional[str] = None

class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_name: str
    ordered_cost: float
    expected_delivery_date: Optional[datetime] = None
    order_notes: Optional[str] = None

class GoodsReceiptCreate(BaseModel):
    quantity_received: int = Field(ge=1)
    condition_received: Optional[str] = "Satisfactory / Working"
    notes: Optional[str] = None
    serial_numbers: Optional[List[str]] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    warranty_expiry: Optional[datetime] = None

class PurchaseResponse(BaseModel):
    id: int
    request_number: str
    request_type: str = "New Purchase"
    item_name: str
    description: Optional[str] = None
    category: str
    lab_id: int
    lab_name: Optional[str] = None
    quantity: int
    unit: str = "Units"
    estimated_unit_cost: Optional[float] = None
    estimated_total_cost: Optional[float] = None
    estimated_cost: Optional[float] = None
    justification: str
    linked_fault_id: Optional[int] = None
    linked_asset_id: Optional[int] = None
    linked_asset_custom_id: Optional[str] = None
    requested_by_id: int
    requested_by_name: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_contact: Optional[str] = None
    quotation_ref: Optional[str] = None
    attachment_url: Optional[str] = None
    status: PurchaseStatus
    hod_approved_by_id: Optional[int] = None
    hod_approved_by_name: Optional[str] = None
    hod_approval_status: str
    hod_remarks: Optional[str] = None
    principal_approved_by_id: Optional[int] = None
    principal_approved_by_name: Optional[str] = None
    principal_approval_status: str
    principal_remarks: Optional[str] = None
    rejection_reason: Optional[str] = None
    more_info_notes: Optional[str] = None
    po_number: Optional[str] = None
    ordered_by_id: Optional[int] = None
    ordered_by_name: Optional[str] = None
    ordered_at: Optional[datetime] = None
    ordered_cost: Optional[float] = None
    expected_delivery_date: Optional[datetime] = None
    order_notes: Optional[str] = None
    quantity_received: int = 0
    quantity_outstanding: int = 1
    procured_by_id: Optional[int] = None
    procured_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    approval_decisions: List[PurchaseApprovalDecisionResponse] = []
    goods_receipts: List[GoodsReceiptRecordResponse] = []
    status_history: List[PurchaseStatusHistoryResponse] = []

    class Config:
        from_attributes = True

# --- Stock Movement Ledger ---
class StockMovementResponse(BaseModel):
    id: int
    item_type: str
    item_id: int
    item_name: str
    from_lab_id: Optional[int] = None
    from_lab_name: Optional[str] = None
    to_lab_id: Optional[int] = None
    to_lab_name: Optional[str] = None
    quantity: int
    reference_type: str
    reference_id: Optional[str] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class AssetRetireRequest(BaseModel):
    retirement_reason: str

# --- Timetable ---
class TimetableSlotCreate(BaseModel):
    lab_id: int
    day_of_week: str
    start_time: str
    end_time: str
    subject: str
    batch_or_class: str
    instructor_name: str
    is_maintenance: bool = False
    notes: Optional[str] = None

class TimetableSlotResponse(BaseModel):
    id: int
    lab_id: int
    day_of_week: str
    start_time: str
    end_time: str
    subject: str
    batch_or_class: str
    instructor_name: str
    is_maintenance: bool
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Notifications ---
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Audit Logs ---
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# --- AI & Assistant ---
class FaultClassifyRequest(BaseModel):
    description: str

class FaultClassifyResponse(BaseModel):
    category: str
    suggested_priority: FaultPriority
    confidence: float
    recommended_technician: str
    is_synthetic_demonstration: bool = True
    notice: str

class AssistantQueryRequest(BaseModel):
    query: str

class AssistantQueryResponse(BaseModel):
    query: str
    answer: str
    sql_intent: Optional[str] = None
    results: Optional[List[dict]] = None
    authorized_labs: List[str] = []

class DemandForecastResponse(BaseModel):
    category: str
    item_name: Optional[str] = None
    current_stock: int
    monthly_consumption_rate: float
    recommended_replenishment: int
    prediction_horizon: str
    confidence_level: str
    limitations_notice: str
