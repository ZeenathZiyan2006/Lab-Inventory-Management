from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.models import (
    Department, Laboratory, User, UserRole, Asset, BulkInventory,
    FaultReport, RepairJob, TransferRequest, PurchaseRequest, TimetableSlot,
    Notification, InventoryHistory, FaultStatusHistory, RepairPartItem,
    AssetStatus, FaultPriority, FaultStatus, TransferStatus, PurchaseStatus
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

def seed_database(reset: bool = False):
    if reset:
        logger.info("Resetting all database tables...")
        Base.metadata.drop_all(bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        if db.query(Department).first():
            logger.info("Database already seeded. Skipping initial seed.")
            return

        logger.info("Seeding SMVITM Demonstration Database...")

        # 1. Departments
        dept_aids = Department(
            name="Department of Artificial Intelligence and Data Science",
            code="AI_DS"
        )
        dept_cse = Department(
            name="Department of Computer Science and Engineering",
            code="CSE"
        )
        db.add_all([dept_aids, dept_cse])
        db.flush()

        # 2. Laboratories
        lab1 = Laboratory(
            name="AI & Deep Learning Laboratory",
            code="AIDS-LAB-01",
            department_id=dept_aids.id,
            room_number="Lab 204 (First Floor, Academic Block II)",
            description="High-performance laboratory equipped for Deep Learning, Neural Network Training, and Computer Vision.",
            qr_code="LAB-AIDS-LAB-01",
            is_active=True
        )
        lab2 = Laboratory(
            name="Data Science & Cloud Computing Laboratory",
            code="AIDS-LAB-02",
            department_id=dept_aids.id,
            room_number="Lab 205 (First Floor, Academic Block II)",
            description="Laboratory equipped for Big Data processing, Cloud simulation, and Predictive Analytics.",
            qr_code="LAB-AIDS-LAB-02",
            is_active=True
        )
        db.add_all([lab1, lab2])
        db.flush()

        # 3. Users for each role
        u_admin = User(
            email="admin@sode-edu.in",
            full_name="Prof. Rajesh K",
            hashed_password=get_password_hash("Admin@123"),
            role=UserRole.ADMIN,
            department_id=dept_aids.id,
            phone_number="+91 98450 11223"
        )
        u_instructor = User(
            email="instructor@sode-edu.in",
            full_name="Dr. Smitha Rao",
            hashed_password=get_password_hash("Instructor@123"),
            role=UserRole.LAB_INSTRUCTOR,
            department_id=dept_aids.id,
            phone_number="+91 98450 22334"
        )
        u_technician = User(
            email="technician@sode-edu.in",
            full_name="Mr. Suresh Poojary",
            hashed_password=get_password_hash("Tech@123"),
            role=UserRole.TECHNICIAN,
            department_id=dept_aids.id,
            phone_number="+91 98450 33445"
        )
        u_hod = User(
            email="hod.aids@sode-edu.in",
            full_name="Dr. Vasudeva",
            hashed_password=get_password_hash("Hod@123"),
            role=UserRole.HOD,
            department_id=dept_aids.id,
            phone_number="+91 98450 44556"
        )
        u_principal = User(
            email="principal@sode-edu.in",
            full_name="Dr. Thirumaleshwara Bhat",
            hashed_password=get_password_hash("Principal@123"),
            role=UserRole.PRINCIPAL,
            department_id=dept_aids.id,
            phone_number="+91 98450 55667"
        )

        db.add_all([u_admin, u_instructor, u_technician, u_hod, u_principal])
        db.flush()

        # Assign labs to Instructor
        u_instructor.assigned_labs = [lab1, lab2]
        db.flush()

        # 4. Individually Tracked Assets in Lab 1
        assets = [
            Asset(
                asset_id="SMVITM-AIDS-LAB1-WS-01",
                name="HP Z4 G4 AI Workstation",
                category="Computing",
                serial_number="CZC9421L8B",
                manufacturer="HP",
                model="Z4 G4 (Intel Xeon, 64GB RAM, RTX 4090)",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="Row 1, Bench A",
                purchase_date=datetime(2024, 7, 15),
                purchase_cost=185000.0,
                warranty_expiry=datetime(2027, 7, 14),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AIDS-LAB1-WS-01"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB1-WS-02",
                name="HP Z4 G4 AI Workstation",
                category="Computing",
                serial_number="CZC9421L9C",
                manufacturer="HP",
                model="Z4 G4 (Intel Xeon, 64GB RAM, RTX 4090)",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="Row 1, Bench B",
                purchase_date=datetime(2024, 7, 15),
                purchase_cost=185000.0,
                warranty_expiry=datetime(2027, 7, 14),
                status=AssetStatus.FAULT_REPORTED,
                qr_code="ASSET:SMVITM-AIDS-LAB1-WS-02"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB1-PROJ-01",
                name="Epson 4K Laser Projector",
                category="Peripherals",
                serial_number="EP88320491",
                manufacturer="Epson",
                model="EB-L530U",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="Ceiling Center",
                purchase_date=datetime(2023, 11, 20),
                purchase_cost=110000.0,
                warranty_expiry=datetime(2026, 11, 19),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AIDS-LAB1-PROJ-01"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB1-SW-01",
                name="Cisco Catalyst 48-Port Switch",
                category="Networking",
                serial_number="FOC2214309X",
                manufacturer="Cisco",
                model="C9200L-48P-4G",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="Network Rack 1",
                purchase_date=datetime(2023, 8, 10),
                purchase_cost=95000.0,
                warranty_expiry=datetime(2028, 8, 9),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AIDS-LAB1-SW-01"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB1-AC-01",
                name="Voltas 2-Ton Inverter AC",
                category="Electrical",
                serial_number="VOLT2023-AC01",
                manufacturer="Voltas",
                model="Vectra 243V",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="North Wall Top",
                purchase_date=datetime(2023, 6, 1),
                purchase_cost=52000.0,
                warranty_expiry=datetime(2025, 5, 31),
                status=AssetStatus.UNDER_REPAIR,
                qr_code="ASSET:SMVITM-AIDS-LAB1-AC-01"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB1-UPS-01",
                name="APC 10kVA Online UPS",
                category="Electrical",
                serial_number="APC99482103",
                manufacturer="Schneider Electric",
                model="Smart-UPS RT 10000VA",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="UPS Room Corner",
                purchase_date=datetime(2022, 10, 10),
                purchase_cost=165000.0,
                warranty_expiry=datetime(2025, 10, 9),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AIDS-LAB1-UPS-01"
            ),
            # Lab 2 Assets
            Asset(
                asset_id="SMVITM-AIDS-LAB2-PC-01",
                name="Dell OptiPlex 7000 Desktop",
                category="Computing",
                serial_number="DL7000-00129",
                manufacturer="Dell",
                model="OptiPlex 7000 Tower (i7, 32GB RAM)",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                location_in_lab="Row 1, Seat 1",
                purchase_date=datetime(2024, 1, 10),
                purchase_cost=82000.0,
                warranty_expiry=datetime(2027, 1, 9),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AIDS-LAB2-PC-01"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB2-PC-02",
                name="Dell OptiPlex 7000 Desktop",
                category="Computing",
                serial_number="DL7000-00130",
                manufacturer="Dell",
                model="OptiPlex 7000 Tower (i7, 32GB RAM)",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                location_in_lab="Row 1, Seat 2",
                purchase_date=datetime(2024, 1, 10),
                purchase_cost=82000.0,
                warranty_expiry=datetime(2027, 1, 9),
                status=AssetStatus.DAMAGED,
                qr_code="ASSET:SMVITM-AIDS-LAB2-PC-02"
            ),
            Asset(
                asset_id="SMVITM-AIDS-LAB2-PRN-01",
                name="HP LaserJet Pro Network Printer",
                category="Peripherals",
                serial_number="CNB8839103",
                manufacturer="HP",
                model="LaserJet M404dn",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                location_in_lab="Instructor Podium",
                purchase_date=datetime(2023, 3, 12),
                purchase_cost=28000.0,
                warranty_expiry=datetime(2025, 3, 11),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AIDS-LAB2-PRN-01"
            ),
            Asset(
                asset_id="SMVITM-AI-PC-001",
                name="HP EliteDesk 800 G6 AI Desktop",
                category="Workstation",
                serial_number="HP-ED800-001",
                manufacturer="HP",
                model="EliteDesk 800 G6 (Core i7, 16GB RAM, RTX 3060)",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="Row 1, Bench 01",
                purchase_date=datetime(2024, 8, 1),
                purchase_cost=85000.0,
                warranty_expiry=datetime(2027, 7, 31),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AI-PC-001"
            ),
            Asset(
                asset_id="SMVITM-AI-PC-002",
                name="HP EliteDesk 800 G6 AI Desktop",
                category="Workstation",
                serial_number="HP-ED800-002",
                manufacturer="HP",
                model="EliteDesk 800 G6 (Core i7, 16GB RAM, RTX 3060)",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab="Row 1, Bench 02",
                purchase_date=datetime(2024, 8, 1),
                purchase_cost=85000.0,
                warranty_expiry=datetime(2027, 7, 31),
                status=AssetStatus.WORKING,
                qr_code="ASSET:SMVITM-AI-PC-002"
            )
        ]
        db.add_all(assets)
        db.flush()

        # Seed initial lifecycle history for demonstration assets
        for a in assets:
            db.add(InventoryHistory(
                asset_id=a.id,
                user_id=u_admin.id,
                action="Registration",
                new_status=a.status.value,
                reason="Initial department asset provisioning"
            ))
        db.flush()

        # 5. Bulk Inventory Records
        bulk_items = [
            BulkInventory(
                name="Dell Multimedia USB Keyboard",
                category="Peripherals",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                total_quantity=45,
                working_quantity=40,
                damaged_quantity=3,
                missing_quantity=2,
                under_repair_quantity=0,
                min_threshold=35,
                qr_code="BULK:1:KEYBOARDS"
            ),
            BulkInventory(
                name="Logitech Optical Mouse B100",
                category="Peripherals",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                total_quantity=45,
                working_quantity=41,
                damaged_quantity=2,
                missing_quantity=2,
                under_repair_quantity=0,
                min_threshold=35,
                qr_code="BULK:1:MICE"
            ),
            BulkInventory(
                name="Ergonomic Revolving Lab Chairs",
                category="Furniture",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                total_quantity=50,
                working_quantity=47,
                damaged_quantity=3,
                missing_quantity=0,
                under_repair_quantity=0,
                min_threshold=40,
                qr_code="BULK:1:CHAIRS"
            ),
            BulkInventory(
                name="Dell Multimedia USB Keyboard",
                category="Peripherals",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                total_quantity=40,
                working_quantity=32,
                damaged_quantity=5,
                missing_quantity=3,
                under_repair_quantity=0,
                min_threshold=30,
                qr_code="BULK:2:KEYBOARDS"
            ),
            BulkInventory(
                name="Modular Switchboards & Sockets",
                category="Electrical",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                total_quantity=24,
                working_quantity=22,
                damaged_quantity=1,
                missing_quantity=0,
                under_repair_quantity=1,
                min_threshold=20,
                qr_code="BULK:1:SWITCHBOARDS"
            )
        ]
        db.add_all(bulk_items)
        db.flush()

        # 6. Fault Reports & Repair Jobs
        fault1 = FaultReport(
            report_number="FLT-20261019-A101",
            title="HP Workstation GPU Fan Failure & Blank Display",
            asset_id=assets[1].id,  # WS-02
            lab_id=lab1.id,
            reported_by_id=u_instructor.id,
            fault_category="Computer or CPU problem",
            priority=FaultPriority.HIGH,
            description="HP Z4 G4 Workstation monitor display goes black intermittently; GPU fan not spinning on boot.",
            is_safety_hazard=False,
            ai_suggested_category="Hardware",
            ai_suggested_priority="High",
            ai_confidence=0.92,
            status=FaultStatus.ASSIGNED
        )
        fault2 = FaultReport(
            report_number="FLT-20261019-B202",
            title="AC Isolator Switch Short Circuit Sparks & Odour",
            asset_id=assets[4].id,  # AC-01
            lab_id=lab1.id,
            reported_by_id=u_instructor.id,
            fault_category="Electrical fault",
            priority=FaultPriority.CRITICAL,
            description="Sparks and loud humming heard from Voltas AC power isolator; tripped Lab 1 circuit breaker.",
            is_safety_hazard=True,
            safety_warning="DANGEROUS ELECTRICAL HAZARD — Lab 1 North Wall Isolator Breaker isolated. Do not operate until certified by electrician.",
            ai_suggested_category="Electrical",
            ai_suggested_priority="Critical",
            ai_confidence=0.96,
            status=FaultStatus.IN_PROGRESS
        )
        db.add_all([fault1, fault2])
        db.flush()

        repair1 = RepairJob(
            fault_id=fault1.id,
            technician_id=u_technician.id,
            assigned_by_id=u_admin.id,
            status=FaultStatus.ASSIGNED,
            diagnosis="Inspected PCIe power connection; suspect auxiliary 8-pin power cable or PCIe slot dust.",
            assignment_notes="Priority inspection before next batch of lab practicals.",
            notes="Scheduled cleaning and diagnostic bench testing."
        )
        repair2 = RepairJob(
            fault_id=fault2.id,
            technician_id=u_technician.id,
            assigned_by_id=u_admin.id,
            status=FaultStatus.IN_PROGRESS,
            diagnosis="Isolator switch contact burned out due to load surge. Replacement 32A MCB required.",
            work_performed="Replaced burned terminal wiring, tested ground loop resistance.",
            assignment_notes="Immediate safety response; turn off main isolator before testing.",
            notes="Power to North AC isolated for safety.",
            parts_requested="32A Single Pole MCB (Legrand / Havells)",
            repair_cost=1450.0
        )
        db.add_all([repair1, repair2])
        db.flush()

        # Seed initial status history and repair parts used
        hist1 = FaultStatusHistory(
            fault_id=fault1.id,
            user_id=u_instructor.id,
            previous_status=None,
            new_status="Reported",
            action="Reported",
            reason="Initial fault report created"
        )
        hist2 = FaultStatusHistory(
            fault_id=fault1.id,
            user_id=u_admin.id,
            previous_status="Reported",
            new_status="Assigned",
            action="Assigned",
            reason=f"Assigned to technician {u_technician.full_name}"
        )
        hist3 = FaultStatusHistory(
            fault_id=fault2.id,
            user_id=u_instructor.id,
            previous_status=None,
            new_status="Reported",
            action="Reported",
            reason="Reported critical electrical short circuit hazard"
        )
        hist4 = FaultStatusHistory(
            fault_id=fault2.id,
            user_id=u_technician.id,
            previous_status="Assigned",
            new_status="In Progress",
            action="Start Work",
            reason="Diagnosing burned isolator contact with multimeter"
        )
        part1 = RepairPartItem(
            repair_id=repair2.id,
            part_name="32A Industrial MCB Switch (Havells)",
            part_number="HVL-MCB-32-1P",
            quantity=1,
            unit_cost=850.0
        )
        db.add_all([hist1, hist2, hist3, hist4, part1])
        db.flush()

        # 7. Transfer Request
        transfer1 = TransferRequest(
            request_number="TRF-20261019-001",
            source_lab_id=lab1.id,
            destination_lab_id=lab2.id,
            bulk_id=bulk_items[0].id,  # Keyboards
            quantity=5,
            requested_by_id=u_instructor.id,
            reason="Temporary allocation of 5 keyboards for VTU Semester Lab Examination in Lab 2.",
            status=TransferStatus.PENDING_APPROVAL,
            requires_hod_approval=True
        )
        db.add(transfer1)
        db.flush()

        # 8. Purchase Request
        purchase1 = PurchaseRequest(
            request_number="REQ-20261019-001",
            item_name="Nvidia GeForce RTX 4090 24GB Graphics Card",
            category="Computing",
            lab_id=lab1.id,
            quantity=2,
            estimated_cost=340000.0,
            justification="Required for Final Year B.E. AI & DS students Generative AI and Large Language Model training lab.",
            requested_by_id=u_instructor.id,
            status=PurchaseStatus.PENDING_APPROVAL
        )
        db.add(purchase1)
        db.flush()

        # 9. Timetable Slots
        slots = [
            TimetableSlot(
                lab_id=lab1.id,
                day_of_week="Monday",
                start_time="09:00",
                end_time="11:00",
                subject="Deep Learning Lab (BAI501L)",
                batch_or_class="AIDS 5th Sem - Batch A",
                instructor_name="Dr. Smitha Rao",
                is_maintenance=False
            ),
            TimetableSlot(
                lab_id=lab1.id,
                day_of_week="Monday",
                start_time="11:15",
                end_time="13:15",
                subject="Computer Vision & OpenCV (BAI502L)",
                batch_or_class="AIDS 5th Sem - Batch B",
                instructor_name="Prof. Sandesh Kumar",
                is_maintenance=False
            ),
            TimetableSlot(
                lab_id=lab1.id,
                day_of_week="Tuesday",
                start_time="14:00",
                end_time="16:00",
                subject="Scheduled Preventive Maintenance & OS Updates",
                batch_or_class="All Systems",
                instructor_name="Mr. Suresh Poojary",
                is_maintenance=True,
                notes="Network rack maintenance and antivirus definition distribution."
            ),
            TimetableSlot(
                lab_id=lab2.id,
                day_of_week="Monday",
                start_time="09:00",
                end_time="11:00",
                subject="Cloud Computing Lab (BAI503L)",
                batch_or_class="AIDS 5th Sem - Batch B",
                instructor_name="Prof. Divya K",
                is_maintenance=False
            )
        ]
        db.add_all(slots)
        db.flush()

        # 10. Initial Notifications
        notifs = [
            Notification(
                user_id=u_technician.id,
                role=UserRole.TECHNICIAN,
                title="Critical Safety Fault Assigned",
                message="Critical electrical fault FLT-20261019-B202 assigned for inspection in Lab 1.",
                link="/faults"
            ),
            Notification(
                user_id=u_hod.id,
                role=UserRole.HOD,
                title="Pending Approvals Awaiting Review",
                message="Transfer request TRF-20261019-001 and Purchase request REQ-20261019-001 require your review.",
                link="/requests"
            )
        ]
        db.add_all(notifs)
        db.commit()

        logger.info("Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        logger.error(f"Seeding failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database(reset=True)
