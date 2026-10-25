import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Table, CheckConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    LAB_INSTRUCTOR = "LAB_INSTRUCTOR"
    TECHNICIAN = "TECHNICIAN"
    HOD = "HOD"
    PRINCIPAL = "PRINCIPAL"

class AssetStatus(str, enum.Enum):
    WORKING = "Working"
    FAULT_REPORTED = "Fault reported"
    DAMAGED = "Damaged"
    UNDER_REPAIR = "Under repair"
    MISSING = "Missing"
    REPLACEMENT_REQUESTED = "Replacement requested"
    RETIRED = "Retired"

class FaultPriority(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class FaultStatus(str, enum.Enum):
    REPORTED = "Reported"
    REVIEWED = "Reviewed"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    WAITING_FOR_PARTS = "Waiting for Parts"
    AWAITING_VERIFICATION = "Repair Completed — Awaiting Verification"
    RESOLVED = "Resolved"
    CLOSED = "Verified and Closed"
    REJECTED = "Rejected"
    UNABLE_TO_REPAIR = "Unable to Repair"
    REPLACEMENT_RECOMMENDED = "Replacement Recommended"
    REOPENED = "Reopened"

class TransferStatus(str, enum.Enum):
    PENDING_APPROVAL = "Pending Approval"
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    AWAITING_APPROVAL = "Awaiting Approval"
    APPROVED = "Approved"
    AWAITING_DISPATCH = "Awaiting Dispatch"
    DISPATCHED = "Dispatched"
    RECEIVED_AND_CONFIRMED = "Received and Confirmed"
    COMPLETED = "Completed"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"
    DISPUTED = "Disputed"

class PurchaseRequestType(str, enum.Enum):
    NEW_PURCHASE = "New Purchase"
    REPLENISHMENT = "Replenishment"
    REPLACEMENT = "Replacement"

class PurchaseStatus(str, enum.Enum):
    PENDING_APPROVAL = "Pending Approval"
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    ORDERED = "Ordered"
    PARTIALLY_RECEIVED = "Partially Received"
    RECEIVED = "Received"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"
    MORE_INFO_REQUESTED = "More Info Requested"
    AWAITING_PROCUREMENT = "Awaiting Procurement"
    PROCURED = "Procured"

# Many-to-many link between user (lab instructors) and laboratories
user_lab_access = Table(
    'user_lab_access',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True),
    Column('lab_id', Integer, ForeignKey('laboratories.id', ondelete="CASCADE"), primary_key=True)
)

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, unique=True)
    code = Column(String(20), nullable=False, unique=True)
    
    users = relationship("User", back_populates="department")
    laboratories = relationship("Laboratory", back_populates="department")

class Laboratory(Base):
    __tablename__ = "laboratories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False, unique=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    room_number = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    qr_code = Column(String(255), unique=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="laboratories")
    assigned_users = relationship("User", secondary=user_lab_access, back_populates="assigned_labs")
    assets = relationship("Asset", back_populates="laboratory")
    bulk_items = relationship("BulkInventory", back_populates="laboratory")
    timetable_slots = relationship("TimetableSlot", back_populates="laboratory")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, index=True, nullable=False)
    full_name = Column(String(120), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    phone_number = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="users")
    assigned_labs = relationship("Laboratory", secondary=user_lab_access, back_populates="assigned_users")
    reported_faults = relationship("FaultReport", foreign_keys="FaultReport.reported_by_id", back_populates="reported_by")
    assigned_repairs = relationship("RepairJob", foreign_keys="RepairJob.technician_id", back_populates="technician")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String(80), unique=True, index=True, nullable=False)  # e.g., SMVITM-AIDS-LAB1-PC-01
    name = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False)  # Computing, Electrical, Network, Furniture, etc.
    serial_number = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    location_in_lab = Column(String(100), nullable=True)  # Row 2, Desk 4
    purchase_date = Column(DateTime, nullable=True)
    purchase_cost = Column(Float, nullable=True)
    warranty_expiry = Column(DateTime, nullable=True)
    status = Column(Enum(AssetStatus), default=AssetStatus.WORKING, nullable=False)
    qr_code = Column(String(255), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    laboratory = relationship("Laboratory", back_populates="assets")
    history = relationship("InventoryHistory", back_populates="asset", cascade="all, delete-orphan")
    fault_reports = relationship("FaultReport", back_populates="asset")

class BulkInventory(Base):
    __tablename__ = "bulk_inventory"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    total_quantity = Column(Integer, nullable=False, default=0)
    working_quantity = Column(Integer, nullable=False, default=0)
    damaged_quantity = Column(Integer, nullable=False, default=0)
    missing_quantity = Column(Integer, nullable=False, default=0)
    under_repair_quantity = Column(Integer, nullable=False, default=0)
    min_threshold = Column(Integer, nullable=False, default=5)
    qr_code = Column(String(255), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint('total_quantity >= 0', name='check_total_non_negative'),
        CheckConstraint('working_quantity >= 0', name='check_working_non_negative'),
        CheckConstraint('damaged_quantity >= 0', name='check_damaged_non_negative'),
        CheckConstraint('missing_quantity >= 0', name='check_missing_non_negative'),
        CheckConstraint('under_repair_quantity >= 0', name='check_repair_non_negative'),
        CheckConstraint('working_quantity + damaged_quantity + missing_quantity + under_repair_quantity = total_quantity', name='check_quantities_sum_equal_total'),
    )

    laboratory = relationship("Laboratory", back_populates="bulk_items")
    history = relationship("InventoryHistory", back_populates="bulk_item", cascade="all, delete-orphan")
    fault_reports = relationship("FaultReport", back_populates="bulk_item")

class InventoryHistory(Base):
    __tablename__ = "inventory_history"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True)
    bulk_id = Column(Integer, ForeignKey("bulk_inventory.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(80), nullable=False)  # Status Change, Edit, Retirement, Relocation
    previous_status = Column(String(80), nullable=True)
    new_status = Column(String(80), nullable=True)
    quantity_changed = Column(Integer, nullable=True)
    reason = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="history")
    bulk_item = relationship("BulkInventory", back_populates="history")
    user = relationship("User")

class FaultReport(Base):
    __tablename__ = "fault_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(150), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    bulk_id = Column(Integer, ForeignKey("bulk_inventory.id"), nullable=True)
    lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    reported_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    fault_category = Column(String(80), nullable=False)
    priority = Column(Enum(FaultPriority), default=FaultPriority.MEDIUM, nullable=False)
    description = Column(Text, nullable=False)
    photo_url = Column(String(255), nullable=True)
    is_safety_hazard = Column(Boolean, default=False, nullable=False)
    safety_warning = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # AI Assistance attributes
    ai_suggested_category = Column(String(80), nullable=True)
    ai_suggested_priority = Column(String(50), nullable=True)
    ai_confidence = Column(Float, nullable=True)

    status = Column(Enum(FaultStatus), default=FaultStatus.REPORTED, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    asset = relationship("Asset", back_populates="fault_reports")
    bulk_item = relationship("BulkInventory", back_populates="fault_reports")
    laboratory = relationship("Laboratory")
    reported_by = relationship("User", foreign_keys=[reported_by_id], back_populates="reported_faults")
    repair_job = relationship("RepairJob", back_populates="fault_report", uselist=False, cascade="all, delete-orphan")
    status_history = relationship("FaultStatusHistory", back_populates="fault_report", cascade="all, delete-orphan")

class RepairJob(Base):
    __tablename__ = "repair_jobs"

    id = Column(Integer, primary_key=True, index=True)
    fault_id = Column(Integer, ForeignKey("fault_reports.id"), unique=True, nullable=False)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(FaultStatus), default=FaultStatus.ASSIGNED, nullable=False)
    due_date = Column(DateTime, nullable=True)
    assignment_notes = Column(Text, nullable=True)
    
    diagnosis = Column(Text, nullable=True)
    troubleshooting_steps = Column(Text, nullable=True)
    work_performed = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    parts_requested = Column(Text, nullable=True)
    repair_cost = Column(Float, default=0.0)
    completion_time = Column(DateTime, nullable=True)
    replacement_recommended = Column(Boolean, default=False)
    unable_to_repair_reason = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    is_verified = Column(Boolean, default=False)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    fault_report = relationship("FaultReport", back_populates="repair_job")
    technician = relationship("User", foreign_keys=[technician_id], back_populates="assigned_repairs")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    parts_used = relationship("RepairPartItem", back_populates="repair_job", cascade="all, delete-orphan")

class FaultStatusHistory(Base):
    __tablename__ = "fault_status_history"

    id = Column(Integer, primary_key=True, index=True)
    fault_id = Column(Integer, ForeignKey("fault_reports.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    previous_status = Column(String(80), nullable=True)
    new_status = Column(String(80), nullable=False)
    action = Column(String(80), nullable=True)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    fault_report = relationship("FaultReport", back_populates="status_history")
    user = relationship("User")

class RepairPartItem(Base):
    __tablename__ = "repair_parts_used"

    id = Column(Integer, primary_key=True, index=True)
    repair_id = Column(Integer, ForeignKey("repair_jobs.id", ondelete="CASCADE"), nullable=False)
    part_name = Column(String(150), nullable=False)
    part_number = Column(String(100), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    repair_job = relationship("RepairJob", back_populates="parts_used")

class TransferRequest(Base):
    __tablename__ = "transfer_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, index=True, nullable=False)
    source_lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    destination_lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    bulk_id = Column(Integer, ForeignKey("bulk_inventory.id"), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    priority = Column(String(50), default="Normal", nullable=False)
    notes = Column(Text, nullable=True)
    
    status = Column(Enum(TransferStatus), default=TransferStatus.PENDING_APPROVAL, nullable=False)
    
    requires_hod_approval = Column(Boolean, default=True)
    hod_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    hod_approval_status = Column(String(50), default="Pending")  # Pending, Approved, Rejected
    hod_remarks = Column(Text, nullable=True)
    
    requires_principal_approval = Column(Boolean, default=False)
    principal_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    principal_approval_status = Column(String(50), default="Pending")
    principal_remarks = Column(Text, nullable=True)
    
    dispatched_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    dispatch_notes = Column(Text, nullable=True)

    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_at = Column(DateTime, nullable=True)
    receipt_condition = Column(String(80), nullable=True) # Good, Damaged, Discrepancy
    receipt_discrepancy_notes = Column(Text, nullable=True)
    
    rejection_reason = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_lab = relationship("Laboratory", foreign_keys=[source_lab_id])
    destination_lab = relationship("Laboratory", foreign_keys=[destination_lab_id])
    asset = relationship("Asset")
    bulk_item = relationship("BulkInventory")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    hod_approver = relationship("User", foreign_keys=[hod_approved_by_id])
    principal_approver = relationship("User", foreign_keys=[principal_approved_by_id])
    dispatched_by = relationship("User", foreign_keys=[dispatched_by_id])
    received_by = relationship("User", foreign_keys=[received_by_id])

    approval_decisions = relationship("TransferApprovalDecision", back_populates="transfer", cascade="all, delete-orphan")
    status_history = relationship("TransferStatusHistory", back_populates="transfer", cascade="all, delete-orphan")

class TransferApprovalDecision(Base):
    __tablename__ = "transfer_approval_decisions"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("transfer_requests.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_at_approval = Column(String(50), nullable=False)
    stage = Column(String(80), nullable=False)
    decision = Column(String(50), nullable=False) # Approved, Rejected, More Info Requested
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    transfer = relationship("TransferRequest", back_populates="approval_decisions")
    approver = relationship("User")

class TransferStatusHistory(Base):
    __tablename__ = "transfer_status_history"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("transfer_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    previous_status = Column(String(80), nullable=True)
    new_status = Column(String(80), nullable=False)
    action = Column(String(80), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    transfer = relationship("TransferRequest", back_populates="status_history")
    user = relationship("User")

class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, index=True, nullable=False)
    request_type = Column(Enum(PurchaseRequestType), default=PurchaseRequestType.NEW_PURCHASE, nullable=False)
    item_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(80), nullable=False)
    lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit = Column(String(50), default="Units", nullable=False)
    estimated_unit_cost = Column(Float, nullable=True)
    estimated_total_cost = Column(Float, nullable=True)
    estimated_cost = Column(Float, nullable=True)  # Backward compatibility
    justification = Column(Text, nullable=False)
    
    linked_fault_id = Column(Integer, ForeignKey("fault_reports.id"), nullable=True)
    linked_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    supplier_name = Column(String(150), nullable=True)
    supplier_contact = Column(String(150), nullable=True)
    quotation_ref = Column(String(100), nullable=True)
    attachment_url = Column(String(255), nullable=True)

    status = Column(Enum(PurchaseStatus), default=PurchaseStatus.PENDING_APPROVAL, nullable=False)
    
    hod_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    hod_approval_status = Column(String(50), default="Pending")
    hod_remarks = Column(Text, nullable=True)
    
    principal_approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    principal_approval_status = Column(String(50), default="Pending")
    principal_remarks = Column(Text, nullable=True)

    rejection_reason = Column(Text, nullable=True)
    more_info_notes = Column(Text, nullable=True)

    # Order Details
    po_number = Column(String(100), nullable=True)
    ordered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ordered_at = Column(DateTime, nullable=True)
    ordered_cost = Column(Float, nullable=True)
    expected_delivery_date = Column(DateTime, nullable=True)
    order_notes = Column(Text, nullable=True)

    # Receiving stats
    quantity_received = Column(Integer, default=0, nullable=False)
    quantity_outstanding = Column(Integer, default=1, nullable=False)

    # Backward compatibility
    procured_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    procured_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    laboratory = relationship("Laboratory")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    hod_approver = relationship("User", foreign_keys=[hod_approved_by_id])
    principal_approver = relationship("User", foreign_keys=[principal_approved_by_id])
    ordered_by = relationship("User", foreign_keys=[ordered_by_id])
    linked_fault = relationship("FaultReport", foreign_keys=[linked_fault_id])
    linked_asset = relationship("Asset", foreign_keys=[linked_asset_id])

    approval_decisions = relationship("PurchaseApprovalDecision", back_populates="purchase", cascade="all, delete-orphan")
    goods_receipts = relationship("GoodsReceiptRecord", back_populates="purchase", cascade="all, delete-orphan")
    status_history = relationship("PurchaseStatusHistory", back_populates="purchase", cascade="all, delete-orphan")

class PurchaseApprovalDecision(Base):
    __tablename__ = "purchase_approval_decisions"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_at_approval = Column(String(50), nullable=False)
    stage = Column(String(80), nullable=False)
    decision = Column(String(50), nullable=False) # Approved, Rejected, More Info Requested
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    purchase = relationship("PurchaseRequest", back_populates="approval_decisions")
    approver = relationship("User")

class GoodsReceiptRecord(Base):
    __tablename__ = "goods_receipt_records"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quantity_received = Column(Integer, default=1, nullable=False)
    condition_received = Column(String(80), default="Satisfactory / Working", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    purchase = relationship("PurchaseRequest", back_populates="goods_receipts")
    received_by = relationship("User")

class PurchaseStatusHistory(Base):
    __tablename__ = "purchase_status_history"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    previous_status = Column(String(80), nullable=True)
    new_status = Column(String(80), nullable=False)
    action = Column(String(80), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    purchase = relationship("PurchaseRequest", back_populates="status_history")
    user = relationship("User")

class StockMovementLedger(Base):
    __tablename__ = "stock_movement_ledger"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String(50), nullable=False)  # "Asset" or "Bulk"
    item_id = Column(Integer, nullable=False)
    item_name = Column(String(150), nullable=False)
    from_lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=True)
    to_lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    reference_type = Column(String(80), nullable=False)  # "Transfer", "Procurement", "Adjustment", "Fault"
    reference_id = Column(String(80), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    from_lab = relationship("Laboratory", foreign_keys=[from_lab_id])
    to_lab = relationship("Laboratory", foreign_keys=[to_lab_id])
    user = relationship("User")

class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    lab_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    day_of_week = Column(String(20), nullable=False)  # Monday, Tuesday, etc.
    start_time = Column(String(10), nullable=False)    # "09:00"
    end_time = Column(String(10), nullable=False)      # "11:00"
    subject = Column(String(150), nullable=False)
    batch_or_class = Column(String(100), nullable=False) # "AIDS 3rd Year - Batch A"
    instructor_name = Column(String(100), nullable=False)
    is_maintenance = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    laboratory = relationship("Laboratory", back_populates="timetable_slots")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Specific user or role-wide
    role = Column(Enum(UserRole), nullable=True)                     # If role-wide broadcast
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String(120), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(80), nullable=False)
    entity_id = Column(String(80), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
