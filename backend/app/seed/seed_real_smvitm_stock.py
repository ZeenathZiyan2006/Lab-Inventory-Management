import os
import sys
from datetime import datetime
from sqlalchemy.orm import Session

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.models import (
    Department, Laboratory, User, UserRole, Asset, BulkInventory,
    FaultReport, RepairJob, TransferRequest, PurchaseRequest, TimetableSlot,
    Notification, InventoryHistory, FaultStatusHistory, RepairPartItem,
    AssetStatus, FaultPriority, FaultStatus, TransferStatus, PurchaseStatus
)

def populate_real_stock():
    print("Resetting all database tables with genuine SMVITM AI & DS Stock Data...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        # =========================================================================
        # 1. DEPARTMENTS
        # =========================================================================
        dept_aids = Department(
            name="Department of Artificial Intelligence and Data Science",
            code="AI_DS"
        )
        dept_cse = Department(
            name="Department of Computer Science and Engineering",
            code="CSE"
        )
        dept_mech = Department(
            name="Department of Mechanical Engineering",
            code="MECH"
        )
        db.add_all([dept_aids, dept_cse, dept_mech])
        db.flush()

        # =========================================================================
        # 2. LABORATORIES & CAMPUS LOCATIONS
        # =========================================================================
        lab1 = Laboratory(
            name="Core Computing Lab",
            code="AIDS-LAB-01",
            department_id=dept_aids.id,
            room_number="F106 (First Floor, Academic Block)",
            description="Lab Area: 634 sq.ft. Core computational infrastructure for AI, programming, and algorithms.",
            qr_code="LAB-AIDS-LAB-01",
            is_active=True
        )
        lab2 = Laboratory(
            name="Networks & Cloud Lab",
            code="AIDS-LAB-02",
            department_id=dept_aids.id,
            room_number="F107, F108 (First Floor, Academic Block)",
            description="Lab Area: 1482 sq.ft. Advanced laboratory equipped for Cloud Computing, Distributed Systems, and Network Simulation.",
            qr_code="LAB-AIDS-LAB-02",
            is_active=True
        )
        lab3 = Laboratory(
            name="Applied AI and Deep Learning Lab",
            code="AIDS-LAB-03",
            department_id=dept_aids.id,
            room_number="F109 (First Floor, Academic Block)",
            description="Lab Area: 773 sq.ft. Specialized environment for Deep Neural Networks, Computer Vision, and Generative AI.",
            qr_code="LAB-AIDS-LAB-03",
            is_active=True
        )
        lab4 = Laboratory(
            name="Placement Lab (Computer Lab-8)",
            code="AIDS-LAB-04",
            department_id=dept_aids.id,
            room_number="F110 (First Floor, Academic Block)",
            description="Lab Area: 835 sq.ft. Dedicated computing center for campus placement assessments and coding practice.",
            qr_code="LAB-AIDS-LAB-04",
            is_active=True
        )
        fac1 = Laboratory(
            name="Department Cabins & Facilities",
            code="AIDS-FAC-01",
            department_id=dept_aids.id,
            room_number="HOD Cabin, Office Cabin, Staff Room, Library",
            description="Faculty administration, HOD cabin, departmental staff room, and AI & DS departmental library.",
            qr_code="LAB-AIDS-FAC-01",
            is_active=True
        )
        cls1 = Laboratory(
            name="Smart Classrooms & Complex",
            code="AIDS-CLS-01",
            department_id=dept_aids.id,
            room_number="A303, A304, A306, AB02, AB03",
            description="Department smart classrooms, interactive display presentation rooms, and corridor infrastructure.",
            qr_code="LAB-AIDS-CLS-01",
            is_active=True
        )
        db.add_all([lab1, lab2, lab3, lab4, fac1, cls1])
        db.flush()

        # =========================================================================
        # 3. REAL INSTITUTIONAL USERS (Universal Password: Demo@123)
        # =========================================================================
        demo_pwd_hash = get_password_hash("Demo@123")

        u_admin = User(
            email="admin@sode-edu.in",
            full_name="Thrisha",
            hashed_password=demo_pwd_hash,
            role=UserRole.ADMIN,
            department_id=dept_aids.id,
            phone_number="+91 98450 11223"
        )
        u_instructor = User(
            email="instructor@sode-edu.in",
            full_name="Chitrakala",
            hashed_password=demo_pwd_hash,
            role=UserRole.LAB_INSTRUCTOR,
            department_id=dept_aids.id,
            phone_number="+91 98450 22334"
        )
        u_technician = User(
            email="technician@sode-edu.in",
            full_name="Technician",
            hashed_password=demo_pwd_hash,
            role=UserRole.TECHNICIAN,
            department_id=dept_aids.id,
            phone_number="+91 98450 33445"
        )
        u_hod = User(
            email="hod.aids@sode-edu.in",
            full_name="Tejaswini H",
            hashed_password=demo_pwd_hash,
            role=UserRole.HOD,
            department_id=dept_aids.id,
            phone_number="+91 98450 44556"
        )
        u_principal = User(
            email="principal@sode-edu.in",
            full_name="Dr. Nagaraj Bhat",
            hashed_password=demo_pwd_hash,
            role=UserRole.PRINCIPAL,
            department_id=dept_aids.id,
            phone_number="+91 98450 55667"
        )

        db.add_all([u_admin, u_instructor, u_technician, u_hod, u_principal])
        db.flush()

        # Assign all labs to Lab Instructor Chitrakala
        u_instructor.assigned_labs = [lab1, lab2, lab3, lab4, fac1, cls1]
        db.flush()

        # =========================================================================
        # 4. CAPITAL ASSETS (INDIVIDUALLY TRACKED HIGH-VALUE EQUIPMENT)
        # =========================================================================
        assets = []
        histories = []

        # --- LAB 1: Core Computing Lab (F106) ---
        # 35 PCs: Acer Core i5 12th Gen, 16GB DDR4, 512GB NVMe SSD, Win11 Pro (SYS Comp, 06-08-2024, Total 2,013,165 => 57,519/pc)
        for i in range(1, 36):
            tag = f"SMVITM-AIDS-F106-PC-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Veriton Core i5 12th Gen Workstation #{i:02d}",
                category="Computing",
                serial_number=f"ACR12G{i:04d}",
                manufacturer="Acer",
                model="Veriton (Intel i5 12th Gen, 16GB DDR4, 512GB NVMe, Win 11 Pro)",
                department_id=dept_aids.id,
                lab_id=lab1.id,
                location_in_lab=f"Bench {(i-1)//4 + 1}, Terminal {(i-1)%4 + 1}",
                purchase_date=datetime(2024, 8, 6),
                purchase_cost=57519.0,
                warranty_expiry=datetime(2027, 8, 5),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 1 Projector: Epson Full HD (SHRI MAHALASA AGENCIES, 19-06-2024, 34,560)
        p1 = Asset(
            asset_id="SMVITM-AIDS-F106-PRJ-01",
            name="Epson Full HD Ceiling Digital Projector",
            category="Peripherals",
            serial_number="EPSON-PJ-F106-01",
            manufacturer="Epson",
            model="EB-E01 3300 Lumens XGA",
            department_id=dept_aids.id,
            lab_id=lab1.id,
            location_in_lab="Ceiling Center Mount",
            purchase_date=datetime(2024, 6, 19),
            purchase_cost=34560.0,
            warranty_expiry=datetime(2026, 6, 18),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-F106-PRJ-01"
        )
        assets.append(p1)

        # --- LAB 2: Networks & Cloud Lab (F107, F108) ---
        # 36 PCs: Acer M200 Core i5 12th Gen (SYS Comp, 08-07-2025, Total 2,039,040 => 56,640/pc)
        for i in range(1, 37):
            tag = f"SMVITM-AIDS-F107-M200-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer M200 Core i5 12th Gen PC #{i:02d}",
                category="Computing",
                serial_number=f"M200-25-{i:04d}",
                manufacturer="Acer",
                model="M200 (Core i5 12th Gen, 16GB DDR4, 512GB SSD, Win 11 Pro)",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                location_in_lab=f"Row {(i-1)//6 + 1}, Terminal {(i-1)%6 + 1}",
                purchase_date=datetime(2025, 7, 8),
                purchase_cost=56640.0,
                warranty_expiry=datetime(2028, 7, 7),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 30 PCs: Acer Core i5 11th Gen (Shifted from CSE F102 on 09-07-2025, 2022-08-20, Total 1,812,480 => 60,416/pc)
        # Note from stock verification: 2 PCs in server room repair work!
        for i in range(1, 31):
            tag = f"SMVITM-AIDS-F107-I5-F102-{i:02d}"
            is_repair = (i in [29, 30])  # 2 PCs under server room repair
            status = AssetStatus.UNDER_REPAIR if is_repair else AssetStatus.WORKING
            loc = "Server Room (Diagnostic Bench)" if is_repair else f"F102 Cluster, Station {i}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core i5 11th Gen Workstation #{i:02d} (ex-F102)",
                category="Computing",
                serial_number=f"ACR11-F102-{i:04d}",
                manufacturer="Acer",
                model="Core i5 11th Gen, 16GB DDR4, 500GB SSD, Win 11 Pro",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                location_in_lab=loc,
                purchase_date=datetime(2022, 8, 20),
                purchase_cost=60416.0,
                warranty_expiry=datetime(2025, 8, 19),
                status=status,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 5 PCs: Acer Core i5 11th Gen (Shifted from CSE F101/A309 on 09-07-2025, 2022-03-03, Total 262,255 => 52,451/pc)
        for i in range(1, 6):
            tag = f"SMVITM-AIDS-F107-I5-F101-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core i5 11th Gen Workstation #{i:02d} (ex-F101)",
                category="Computing",
                serial_number=f"ACR11-F101-{i:04d}",
                manufacturer="Acer",
                model="Core i5 11th Gen, 16GB DDR4, 500GB SSD, Win 11 Pro",
                department_id=dept_aids.id,
                lab_id=lab2.id,
                location_in_lab=f"Auxiliary Row, Station {i}",
                purchase_date=datetime(2022, 3, 3),
                purchase_cost=52451.0,
                warranty_expiry=datetime(2025, 3, 2),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 1 Interactive Display 75" (SYS Comp, 30-07-2025, Cost: 166,400)
        disp1 = Asset(
            asset_id="SMVITM-AIDS-F107-DISP-01",
            name="Interactive Touch Smart Display 75-inch",
            category="Peripherals",
            serial_number="IDISP-75-F107-01",
            manufacturer="Maxhub",
            model="75-inch 4K UHD Anti-Glare Interactive Touch Display",
            department_id=dept_aids.id,
            lab_id=lab2.id,
            location_in_lab="Front Presentation Stage",
            purchase_date=datetime(2025, 7, 30),
            purchase_cost=166400.0,
            warranty_expiry=datetime(2028, 7, 29),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-F107-DISP-01"
        )
        assets.append(disp1)

        # --- LAB 3: Applied AI and Deep Learning Lab (F109) ---
        # 24 PCs: Acer Core i5 11th Gen (SYS Comp, 2022-08-29, Total 1,449,984 => 60,416/pc)
        # Note from stock verification: 3 PCs in server room repair work!
        for i in range(1, 25):
            tag = f"SMVITM-AIDS-F109-I5-{i:02d}"
            is_repair = (i in [22, 23, 24])  # 3 PCs in server room repair
            status = AssetStatus.UNDER_REPAIR if is_repair else AssetStatus.WORKING
            loc = "Server Room (Diagnostic Bay)" if is_repair else f"Bay {(i-1)//4 + 1}, Terminal {(i-1)%4 + 1}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core i5 11th Gen Deep Learning PC #{i:02d}",
                category="Computing",
                serial_number=f"DL-F109-{i:04d}",
                manufacturer="Acer",
                model="Core i5 11th Gen, 16GB DDR4, 500GB SSD, Win 11 Pro",
                department_id=dept_aids.id,
                lab_id=lab3.id,
                location_in_lab=loc,
                purchase_date=datetime(2022, 8, 29),
                purchase_cost=60416.0,
                warranty_expiry=datetime(2025, 8, 28),
                status=status,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 6 PCs: Acer Core i5 11th Gen (SYS Comp, 2022-09-01, Total 362,496 => 60,416/pc)
        for i in range(1, 7):
            tag = f"SMVITM-AIDS-F109-B2-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core i5 11th Gen Deep Learning PC (Batch 2) #{i:02d}",
                category="Computing",
                serial_number=f"DL-B2-F109-{i:04d}",
                manufacturer="Acer",
                model="Core i5 11th Gen, 16GB DDR4, 500GB SSD, Win 11 Pro",
                department_id=dept_aids.id,
                lab_id=lab3.id,
                location_in_lab=f"Bay 7, Terminal {i}",
                purchase_date=datetime(2022, 9, 1),
                purchase_cost=60416.0,
                warranty_expiry=datetime(2025, 8, 31),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 6 PCs: Acer Core i5 11th Gen (Shifted from CSE A307 on 09-07-2025, 2022-08-20, Total 314,706 => 52,451/pc)
        for i in range(1, 7):
            tag = f"SMVITM-AIDS-F109-CSE-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core i5 11th Gen PC (ex-CSE A307) #{i:02d}",
                category="Computing",
                serial_number=f"DL-CSE-A307-{i:04d}",
                manufacturer="Acer",
                model="Core i5 11th Gen, 16GB DDR4, 500GB SSD, Win 11 Pro",
                department_id=dept_aids.id,
                lab_id=lab3.id,
                location_in_lab=f"Bay 8, Terminal {i}",
                purchase_date=datetime(2022, 8, 20),
                purchase_cost=52451.0,
                warranty_expiry=datetime(2025, 8, 19),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 1 Projector: Full HD (SHRI MAHALASA AGENCIES, 19-06-2024, 34,560)
        p2 = Asset(
            asset_id="SMVITM-AIDS-F109-PRJ-01",
            name="Ceiling Mounted Digital Projector",
            category="Peripherals",
            serial_number="PRJ-F109-01",
            manufacturer="Epson",
            model="EB-E01 3300 Lumens XGA",
            department_id=dept_aids.id,
            lab_id=lab3.id,
            location_in_lab="Ceiling Center Mount",
            purchase_date=datetime(2024, 6, 19),
            purchase_cost=34560.0,
            warranty_expiry=datetime(2026, 6, 18),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-F109-PRJ-01"
        )
        assets.append(p2)

        # --- LAB 4: Placement Lab Computer Lab-8 (F110) ---
        # 16 PCs: Acer Core i3 10th Gen (Shifted from AIDS F107, F108 on 09-07-2025, 2022-09-27, Total 671,745 => 41,984/pc)
        # Note: 1 PC shifted to AIML HOD on 20-03-2026
        for i in range(1, 17):
            tag = f"SMVITM-AIDS-F110-I3-{i:02d}"
            is_transferred = (i == 16)
            loc = "AIML HOD Cabin" if is_transferred else f"Row {(i-1)//4 + 1}, Terminal {(i-1)%4 + 1}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core i3 10th Gen PC #{i:02d}" + (" (Shifted to AIML HOD)" if is_transferred else ""),
                category="Computing",
                serial_number=f"I3-F110-{i:04d}",
                manufacturer="Acer",
                model="Core i3 10th Gen, 8GB DDR4, 500GB SSD, Win 11 Pro",
                department_id=dept_aids.id,
                lab_id=lab4.id,
                location_in_lab=loc,
                purchase_date=datetime(2022, 9, 27),
                purchase_cost=41984.0,
                warranty_expiry=datetime(2025, 9, 26),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 5 PCs: Acer Core 2 Duo (Shifted from CSE F110 on 09-07-2025)
        for i in range(1, 6):
            tag = f"SMVITM-AIDS-F110-C2D-CSE-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core 2 Duo Legacy PC (ex-CSE) #{i:02d}",
                category="Computing",
                serial_number=f"C2D-CSE-{i:04d}",
                manufacturer="Acer",
                model="Core 2 Duo, 2GB RAM, 500GB HDD",
                department_id=dept_aids.id,
                lab_id=lab4.id,
                location_in_lab=f"Row 5, Station {i}",
                purchase_date=datetime(2019, 1, 15),
                purchase_cost=18000.0,
                warranty_expiry=datetime(2022, 1, 14),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 3 PCs: Acer Core 2 Duo (Shifted from AIML F109 on 09-07-2025)
        for i in range(1, 4):
            tag = f"SMVITM-AIDS-F110-C2D-AIML-{i:02d}"
            a = Asset(
                asset_id=tag,
                name=f"Acer Core 2 Duo Legacy PC (ex-AIML) #{i:02d}",
                category="Computing",
                serial_number=f"C2D-AIML-{i:04d}",
                manufacturer="Acer",
                model="Core 2 Duo, 2GB RAM, 500GB HDD",
                department_id=dept_aids.id,
                lab_id=lab4.id,
                location_in_lab=f"Row 6, Station {i}",
                purchase_date=datetime(2019, 1, 15),
                purchase_cost=18000.0,
                warranty_expiry=datetime(2022, 1, 14),
                status=AssetStatus.WORKING,
                qr_code=f"ASSET:{tag}"
            )
            assets.append(a)

        # 1 Projector: Placement Lab (SHRI MAHALASA AGENCIES, 19-06-2024, 34,560)
        p3 = Asset(
            asset_id="SMVITM-AIDS-F110-PRJ-01",
            name="Placement Lab Ceiling Projector",
            category="Peripherals",
            serial_number="PRJ-F110-01",
            manufacturer="Epson",
            model="EB-E01 3300 Lumens XGA",
            department_id=dept_aids.id,
            lab_id=lab4.id,
            location_in_lab="Ceiling Center Mount",
            purchase_date=datetime(2024, 6, 19),
            purchase_cost=34560.0,
            warranty_expiry=datetime(2026, 6, 18),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-F110-PRJ-01"
        )
        assets.append(p3)

        # 1 Printer: Laser Printer (SYS COMP, 2023-04-14, 17,346)
        prn1 = Asset(
            asset_id="SMVITM-AIDS-F110-PRN-01",
            name="HP LaserJet Network Printer",
            category="Peripherals",
            serial_number="PRN-F110-01",
            manufacturer="HP",
            model="LaserJet Pro M404dn",
            department_id=dept_aids.id,
            lab_id=lab4.id,
            location_in_lab="Instructor Master Desk",
            purchase_date=datetime(2023, 4, 14),
            purchase_cost=17346.0,
            warranty_expiry=datetime(2025, 4, 13),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-F110-PRN-01"
        )
        assets.append(prn1)

        # --- DEPARTMENTAL CABINS & SMART CLASSROOMS ---
        # HOD PC
        hod_pc = Asset(
            asset_id="SMVITM-AIDS-HOD-PC-01",
            name="HOD Executive Workstation (Shifted from F110)",
            category="Computing",
            serial_number="ACR11-HOD-01",
            manufacturer="Acer",
            model="Core i5 11th Gen, 16GB DDR4, 500GB SSD, Win 11 Pro",
            department_id=dept_aids.id,
            lab_id=fac1.id,
            location_in_lab="HOD Cabin - Executive Desk",
            purchase_date=datetime(2022, 3, 3),
            purchase_cost=52451.0,
            warranty_expiry=datetime(2025, 3, 2),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-HOD-PC-01"
        )
        assets.append(hod_pc)

        # Office Cabin PC
        off_pc = Asset(
            asset_id="SMVITM-AIDS-OFF-PC-01",
            name="Office Administration Desktop PC",
            category="Computing",
            serial_number="DELL-OFF-PC-01",
            manufacturer="Dell",
            model="OptiPlex 3080 Core i5 10th Gen",
            department_id=dept_aids.id,
            lab_id=fac1.id,
            location_in_lab="Office Cabin - Staff Desk",
            purchase_date=datetime(2021, 10, 10),
            purchase_cost=48000.0,
            warranty_expiry=datetime(2024, 10, 9),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-OFF-PC-01"
        )
        assets.append(off_pc)

        # Classrooms Displays & Projectors
        disp_a304 = Asset(
            asset_id="SMVITM-AIDS-A304-DISP-01",
            name="Interactive Touch Smart Display 75-inch (A304)",
            category="Peripherals",
            serial_number="DISP-A304-01",
            manufacturer="Maxhub",
            model="75-inch Interactive Smart Board",
            department_id=dept_aids.id,
            lab_id=cls1.id,
            location_in_lab="Class Room A304 - Front Wall",
            purchase_date=datetime(2024, 8, 1),
            purchase_cost=166400.0,
            warranty_expiry=datetime(2027, 7, 31),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-A304-DISP-01"
        )
        assets.append(disp_a304)

        disp_a306 = Asset(
            asset_id="SMVITM-AIDS-A306-DISP-01",
            name="Interactive Touch Smart Display 75-inch (A306)",
            category="Peripherals",
            serial_number="DISP-A306-01",
            manufacturer="Maxhub",
            model="75-inch Interactive Smart Board",
            department_id=dept_aids.id,
            lab_id=cls1.id,
            location_in_lab="Class Room A306 - Front Wall",
            purchase_date=datetime(2024, 8, 1),
            purchase_cost=166400.0,
            warranty_expiry=datetime(2027, 7, 31),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-A306-DISP-01"
        )
        assets.append(disp_a306)

        prj_a303 = Asset(
            asset_id="SMVITM-AIDS-A303-PRJ-01",
            name="Ceiling Mounted Digital Projector (A303)",
            category="Peripherals",
            serial_number="PRJ-A303-01",
            manufacturer="Epson",
            model="EB-E01 3300 Lumens",
            department_id=dept_aids.id,
            lab_id=cls1.id,
            location_in_lab="Class Room A303 - Ceiling Center",
            purchase_date=datetime(2024, 6, 19),
            purchase_cost=34560.0,
            warranty_expiry=datetime(2026, 6, 18),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-A303-PRJ-01"
        )
        assets.append(prj_a303)

        prj_ab02 = Asset(
            asset_id="SMVITM-AIDS-AB02-PRJ-01",
            name="Ceiling Mounted Digital Projector (AB02)",
            category="Peripherals",
            serial_number="PRJ-AB02-01",
            manufacturer="Epson",
            model="EB-E01 3300 Lumens",
            department_id=dept_aids.id,
            lab_id=cls1.id,
            location_in_lab="Class Room AB02 - Ceiling Center",
            purchase_date=datetime(2024, 6, 19),
            purchase_cost=34560.0,
            warranty_expiry=datetime(2026, 6, 18),
            status=AssetStatus.WORKING,
            qr_code="ASSET:SMVITM-AIDS-AB02-PRJ-01"
        )
        assets.append(prj_ab02)

        db.add_all(assets)
        db.flush()

        # =========================================================================
        # 5. BULK INVENTORY (FURNITURE, FIXTURES, NETWORK, ELECTRICAL)
        # =========================================================================
        bulk_data = [
            # --- LAB 1: Core Computing Lab (F106) ---
            ("Chairs", "Furniture", lab1.id, 38, 38, 0, 0, 0, 5, "BULK-F106-CHR"),
            ("Working Tables", "Furniture", lab1.id, 11, 11, 0, 0, 0, 2, "BULK-F106-WTB"),
            ("Faculty Table & Chairs", "Furniture", lab1.id, 3, 3, 0, 0, 0, 1, "BULK-F106-FTB"),
            ("Air Conditioners (AC)", "Electrical", lab1.id, 2, 2, 0, 0, 0, 1, "BULK-F106-AC"),
            ("D-Link Network Switch Rack", "Networking", lab1.id, 1, 1, 0, 0, 0, 1, "BULK-F106-DLINK"),
            ("CCTV Surveillance Camera", "Security", lab1.id, 1, 1, 0, 0, 0, 1, "BULK-F106-CCTV"),
            ("Ceiling Fans", "Electrical", lab1.id, 8, 8, 0, 0, 0, 2, "BULK-F106-FAN"),
            ("LED Tube Lights", "Electrical", lab1.id, 6, 6, 0, 0, 0, 2, "BULK-F106-LIGHT"),
            ("Notice & White Boards", "Fixtures", lab1.id, 3, 3, 0, 0, 0, 1, "BULK-F106-BRD"),
            ("Shoe Racks & Bag Racks", "Furniture", lab1.id, 3, 3, 0, 0, 0, 1, "BULK-F106-RCK"),
            ("Small Wooden Cupboard", "Furniture", lab1.id, 1, 1, 0, 0, 0, 1, "BULK-F106-CPB"),

            # --- LAB 2: Networks & Cloud Lab (F107, F108) ---
            ("Lab Chairs", "Furniture", lab2.id, 71, 71, 0, 0, 0, 10, "BULK-F107-CHR"),
            ("Working Tables", "Furniture", lab2.id, 18, 18, 0, 0, 0, 2, "BULK-F107-WTB"),
            ("Faculty Table & Chairs", "Furniture", lab2.id, 4, 4, 0, 0, 0, 1, "BULK-F107-FTB"),
            ("Air Conditioners (AC)", "Electrical", lab2.id, 2, 2, 0, 0, 0, 1, "BULK-F107-AC"),
            ("D-Link Box (Gigabit Switch)", "Networking", lab2.id, 2, 2, 0, 0, 0, 1, "BULK-F107-DLINK"),
            ("CCTV Security Cameras", "Security", lab2.id, 2, 2, 0, 0, 0, 1, "BULK-F107-CCTV"),
            ("Ceiling Fans", "Electrical", lab2.id, 9, 9, 0, 0, 0, 2, "BULK-F107-FAN"),
            ("LED Tube Lights", "Electrical", lab2.id, 17, 17, 0, 0, 0, 3, "BULK-F107-LIGHT"),
            ("Shoe Racks & Bag Racks", "Furniture", lab2.id, 6, 6, 0, 0, 0, 2, "BULK-F107-RCK"),
            ("Notice & White Boards", "Fixtures", lab2.id, 3, 3, 0, 0, 0, 1, "BULK-F107-BRD"),
            ("Small Wooden Cupboards", "Furniture", lab2.id, 3, 3, 0, 0, 0, 1, "BULK-F107-CPB"),

            # --- LAB 3: Applied AI and Deep Learning Lab (F109) ---
            ("Lab Chairs", "Furniture", lab3.id, 35, 35, 0, 0, 0, 5, "BULK-F109-CHR"),
            ("Working Tables", "Furniture", lab3.id, 10, 10, 0, 0, 0, 2, "BULK-F109-WTB"),
            ("Faculty Table & Chairs", "Furniture", lab3.id, 3, 3, 0, 0, 0, 1, "BULK-F109-FTB"),
            ("Air Conditioners (AC)", "Electrical", lab3.id, 2, 2, 0, 0, 0, 1, "BULK-F109-AC"),
            ("D-Link Network Box", "Networking", lab3.id, 1, 1, 0, 0, 0, 1, "BULK-F109-DLINK"),
            ("CCTV Security Camera", "Security", lab3.id, 1, 1, 0, 0, 0, 1, "BULK-F109-CCTV"),
            ("Ceiling Fans", "Electrical", lab3.id, 7, 7, 0, 0, 0, 2, "BULK-F109-FAN"),
            ("LED Tube Lights", "Electrical", lab3.id, 10, 10, 0, 0, 0, 2, "BULK-F109-LIGHT"),
            ("White & Notice Boards", "Fixtures", lab3.id, 2, 2, 0, 0, 0, 1, "BULK-F109-BRD"),
            ("Shoe Rack & Cupboard", "Furniture", lab3.id, 2, 2, 0, 0, 0, 1, "BULK-F109-FURN"),

            # --- LAB 4: Placement Lab (Computer Lab-8, F110) ---
            ("Lab Chairs", "Furniture", lab4.id, 33, 33, 0, 0, 0, 5, "BULK-F110-CHR"),
            ("Working Tables (Shifted from Mech)", "Furniture", lab4.id, 13, 13, 0, 0, 0, 2, "BULK-F110-WTB"),
            ("Faculty Table & Chairs", "Furniture", lab4.id, 3, 3, 0, 0, 0, 1, "BULK-F110-FTB"),
            ("Air Conditioners (AC)", "Electrical", lab4.id, 2, 2, 0, 0, 0, 1, "BULK-F110-AC"),
            ("D-Link Network Box", "Networking", lab4.id, 1, 1, 0, 0, 0, 1, "BULK-F110-DLINK"),
            ("CCTV Surveillance Camera", "Security", lab4.id, 1, 1, 0, 0, 0, 1, "BULK-F110-CCTV"),
            ("Ceiling Fans", "Electrical", lab4.id, 7, 7, 0, 0, 0, 2, "BULK-F110-FAN"),
            ("LED Tube Lights", "Electrical", lab4.id, 10, 10, 0, 0, 0, 2, "BULK-F110-LIGHT"),
            ("Shoe & Bag Racks", "Furniture", lab4.id, 3, 3, 0, 0, 0, 1, "BULK-F110-RCK"),
            ("Wooden Cupboards & Boards", "Furniture", lab4.id, 3, 3, 0, 0, 0, 1, "BULK-F110-CPB"),

            # --- DEPARTMENT CABINS & LIBRARY (FAC-01) ---
            ("Department Reference Books", "Books", fac1.id, 56, 56, 0, 0, 0, 10, "BULK-FAC-BOOKS"),
            ("Staff & Office Faculty Tables", "Furniture", fac1.id, 19, 19, 0, 0, 0, 3, "BULK-FAC-FTB"),
            ("Executive Cushion & Plastic Chairs", "Furniture", fac1.id, 38, 38, 0, 0, 0, 5, "BULK-FAC-CHR"),
            ("Metal & Wooden Almirahs/Cupboards", "Furniture", fac1.id, 19, 19, 0, 0, 0, 2, "BULK-FAC-CPB"),
            ("Office Side Racks", "Furniture", fac1.id, 18, 18, 0, 0, 0, 2, "BULK-FAC-RCK"),
            ("Intercom Telephones", "Peripherals", fac1.id, 4, 4, 0, 0, 0, 1, "BULK-FAC-TEL"),

            # --- CLASSROOMS & CORRIDORS (CLS-01) ---
            ("Dual & Triple Seater Student Benches", "Furniture", cls1.id, 128, 128, 0, 0, 0, 10, "BULK-CLS-BNCH"),
            ("Student Study Desks", "Furniture", cls1.id, 125, 125, 0, 0, 0, 10, "BULK-CLS-DSK"),
            ("Corridor & Classroom CCTV Cameras", "Security", cls1.id, 10, 10, 0, 0, 0, 2, "BULK-CLS-CCTV"),
            ("Classroom Ceiling Fans", "Electrical", cls1.id, 67, 67, 0, 0, 0, 5, "BULK-CLS-FAN"),
            ("Classroom LED Tube Lights", "Electrical", cls1.id, 65, 65, 0, 0, 0, 5, "BULK-CLS-LIGHT"),
            ("Central Fire Extinguishers", "Safety", cls1.id, 3, 3, 0, 0, 0, 1, "BULK-CLS-FIRE")
        ]

        bulk_objs = []
        for name, cat, lid, tot, wrk, dmg, mis, rep, thres, qrc in bulk_data:
            b = BulkInventory(
                name=name,
                category=cat,
                department_id=dept_aids.id,
                lab_id=lid,
                total_quantity=tot,
                working_quantity=wrk,
                damaged_quantity=dmg,
                missing_quantity=mis,
                under_repair_quantity=rep,
                min_threshold=thres,
                qr_code=qrc
            )
            bulk_objs.append(b)

        db.add_all(bulk_objs)
        db.flush()

        # =========================================================================
        # 6. REAL FAULTS & REPAIR JOBS (Server Room Repair PCs from Stock Register)
        # =========================================================================
        # Find the 5 repair PCs:
        # F107: 2 PCs (i=29, 30)
        # F109: 3 PCs (i=22, 23, 24)
        rep_f107_1 = next(a for a in assets if a.asset_id == "SMVITM-AIDS-F107-I5-F102-29")
        rep_f107_2 = next(a for a in assets if a.asset_id == "SMVITM-AIDS-F107-I5-F102-30")
        rep_f109_1 = next(a for a in assets if a.asset_id == "SMVITM-AIDS-F109-I5-22")
        rep_f109_2 = next(a for a in assets if a.asset_id == "SMVITM-AIDS-F109-I5-23")
        rep_f109_3 = next(a for a in assets if a.asset_id == "SMVITM-AIDS-F109-I5-24")

        faults_spec = [
            (rep_f107_1, lab2.id, "SMVITM-FLT-2026-F107-01", "Power Supply Unit (PSU) Failure", "System shutting down unexpectedly under GPU load during Cloud Simulation. Shifted to Server Room for diagnostic testing.", FaultPriority.HIGH),
            (rep_f107_2, lab2.id, "SMVITM-FLT-2026-F107-02", "RAM Memory Socket Intermittent Contact", "Continuous BIOS error beep codes on boot. Shifted to Server Room bench for memory channel diagnosis.", FaultPriority.MEDIUM),
            (rep_f109_1, lab3.id, "SMVITM-FLT-2026-F109-01", "NVMe SSD Read/Write Degradation", "OS fails to mount root partition during Deep Learning training session. Shifted to Server Room for sector recovery.", FaultPriority.HIGH),
            (rep_f109_2, lab3.id, "SMVITM-FLT-2026-F109-02", "CPU Cooler Fan Bearing Wear", "Excessive acoustic noise and thermal throttling during AI model compilation. Awaiting replacement cooler fan.", FaultPriority.MEDIUM),
            (rep_f109_3, lab3.id, "SMVITM-FLT-2026-F109-03", "Motherboard CMOS & Display Output Issue", "No HDMI video output signal detected on dual monitors. Transferred to Server Room repair workstation.", FaultPriority.HIGH)
        ]

        for asset_obj, lab_id, flt_num, title, desc, prio in faults_spec:
            f = FaultReport(
                report_number=flt_num,
                title=title,
                fault_category="Hardware",
                asset_id=asset_obj.id,
                lab_id=lab_id,
                reported_by_id=u_instructor.id,
                priority=prio,
                description=desc,
                status=FaultStatus.IN_PROGRESS,
                is_safety_hazard=False,
                created_at=datetime(2026, 3, 15, 10, 30)
            )
            db.add(f)
            db.flush()

            # Create corresponding Repair Job
            rj = RepairJob(
                fault_id=f.id,
                technician_id=u_technician.id,
                status=FaultStatus.IN_PROGRESS,
                diagnosis="Hardware diagnostic confirmed server room inspection required. Parts tested with multimeter and diagnostic boot disk.",
                work_performed="Unit isolated in Central Server Room repair bay. Diagnostic benchmarks conducted.",
                created_at=datetime(2026, 3, 16, 9, 0)
            )
            db.add(rj)
            db.flush()

            # Add History
            h1 = FaultStatusHistory(
                fault_id=f.id,
                user_id=u_instructor.id,
                previous_status=None,
                new_status="Reported",
                action="Reported",
                reason=f"Logged during annual stock verification: {title}"
            )
            h2 = FaultStatusHistory(
                fault_id=f.id,
                user_id=u_technician.id,
                previous_status="Reported",
                new_status="In Progress",
                action="Assigned and Started",
                reason="Workstation moved to Server Room diagnostic bench"
            )
            db.add_all([h1, h2])

        db.flush()

        # =========================================================================
        # 7. REAL COMPLETED & PENDING TRANSFER REQUESTS
        # =========================================================================
        # 1) Shifted 30 PCs from CSE (F102) to Networks & Cloud Lab (F107, F108) on 09-07-2025
        tr1 = TransferRequest(
            request_number="TRF-20250709-001",
            source_lab_id=lab2.id,
            destination_lab_id=lab2.id,
            reason="Official inter-departmental relocation: 30 PCs shifted from CSE Dept (F102) to AIDS Dept (F107, F108) on 09-07-2025.",
            status=TransferStatus.COMPLETED,
            requires_hod_approval=True,
            requested_by_id=u_instructor.id,
            hod_approved_by_id=u_hod.id,
            hod_approval_status="Approved",
            quantity=30,
            created_at=datetime(2025, 7, 9, 10, 0),
            updated_at=datetime(2025, 7, 9, 15, 0)
        )
        # 2) Shifted 5 PCs from CSE (F101/A309) to AIDS on 09-07-2025
        tr2 = TransferRequest(
            request_number="TRF-20250709-002",
            source_lab_id=lab2.id,
            destination_lab_id=lab2.id,
            reason="Relocation of 5 PCs from CSE Dept (F101 - 4 PCs, A309 - 1 PC) to Networks & Cloud Lab on 09-07-2025.",
            status=TransferStatus.COMPLETED,
            requires_hod_approval=True,
            requested_by_id=u_instructor.id,
            hod_approved_by_id=u_hod.id,
            hod_approval_status="Approved",
            quantity=5,
            created_at=datetime(2025, 7, 9, 11, 0),
            updated_at=datetime(2025, 7, 9, 16, 0)
        )
        # 3) Shifted 16 PCs from AIDS to Placement Lab F110 on 09-07-2025
        tr3 = TransferRequest(
            request_number="TRF-20250709-003",
            source_lab_id=lab2.id,
            destination_lab_id=lab4.id,
            reason="Shifted 16 Acer Core i3 PCs from F107, F108 AIDS Dept to Placement Lab F110 for campus drive prep on 09-07-2025.",
            status=TransferStatus.COMPLETED,
            requires_hod_approval=True,
            requested_by_id=u_instructor.id,
            hod_approved_by_id=u_hod.id,
            hod_approval_status="Approved",
            quantity=16,
            created_at=datetime(2025, 7, 9, 12, 0),
            updated_at=datetime(2025, 7, 9, 17, 0)
        )
        # 4) Shifted 1 PC to AIDS HOD on 11-03-2026
        tr4 = TransferRequest(
            request_number="TRF-20260311-001",
            source_lab_id=lab4.id,
            destination_lab_id=fac1.id,
            reason="Shifted 1 Acer Core i5 PC (ex-CSE A307) from Placement Lab F110 to AIDS HOD Cabin on 11-03-2026.",
            status=TransferStatus.COMPLETED,
            requires_hod_approval=True,
            requested_by_id=u_instructor.id,
            hod_approved_by_id=u_hod.id,
            hod_approval_status="Approved",
            quantity=1,
            created_at=datetime(2026, 3, 11, 14, 0),
            updated_at=datetime(2026, 3, 11, 16, 30)
        )
        # 5) Pending Relocation: 1 PC shifted from F110 to AIML HOD on 20-03-2026
        tr5 = TransferRequest(
            request_number="TRF-20260320-001",
            source_lab_id=lab4.id,
            destination_lab_id=fac1.id,
            reason="Inter-cabin allocation: 1 PC Core 2 Duo shifted from F110 to AIML HOD on 20-03-2026 awaiting final HOD sign-off.",
            status=TransferStatus.PENDING_APPROVAL,
            requires_hod_approval=True,
            requested_by_id=u_instructor.id,
            quantity=1,
            created_at=datetime(2026, 3, 20, 11, 0)
        )
        db.add_all([tr1, tr2, tr3, tr4, tr5])
        db.flush()

        # =========================================================================
        # 8. TIMETABLE SCHEDULE
        # =========================================================================
        slots = [
            TimetableSlot(
                lab_id=lab1.id,
                day_of_week="Monday",
                start_time="09:00",
                end_time="11:00",
                subject="Core Programming & DSA Lab",
                batch_or_class="AIDS 3rd Sem - Batch A",
                instructor_name="Chitrakala",
                is_maintenance=False
            ),
            TimetableSlot(
                lab_id=lab2.id,
                day_of_week="Monday",
                start_time="11:15",
                end_time="13:15",
                subject="Cloud Virtualization & Networks Lab",
                batch_or_class="AIDS 5th Sem - Batch B",
                instructor_name="Chitrakala",
                is_maintenance=False
            ),
            TimetableSlot(
                lab_id=lab3.id,
                day_of_week="Tuesday",
                start_time="09:00",
                end_time="12:00",
                subject="Deep Learning & Computer Vision Lab",
                batch_or_class="AIDS 7th Sem - Batch A",
                instructor_name="Chitrakala",
                is_maintenance=False
            ),
            TimetableSlot(
                lab_id=lab2.id,
                day_of_week="Wednesday",
                start_time="14:00",
                end_time="16:00",
                subject="Server Room Preventive Diagnostic Maintenance",
                batch_or_class="Technician Team",
                instructor_name="Technician",
                is_maintenance=True,
                notes="Diagnostic check on PSU and RAM modules in server room."
            ),
            TimetableSlot(
                lab_id=lab4.id,
                day_of_week="Thursday",
                start_time="10:00",
                end_time="13:00",
                subject="Placement Aptitude & Coding Assessment",
                batch_or_class="Final Year AI & DS",
                instructor_name="Chitrakala",
                is_maintenance=False
            )
        ]
        db.add_all(slots)
        db.flush()

        # =========================================================================
        # 9. NOTIFICATIONS
        # =========================================================================
        notifs = [
            Notification(
                user_id=u_technician.id,
                role=UserRole.TECHNICIAN,
                title="5 Workstations In Server Room Under Repair",
                message="Stock Verification Alert: 2 PCs from F107 and 3 PCs from F109 are currently undergoing repair in the server room.",
                link="/faults"
            ),
            Notification(
                user_id=u_hod.id,
                role=UserRole.HOD,
                title="Stock Verification Sign-off & Transfer Request",
                message="Transfer request TRF-20260320-001 (F110 to AIML HOD) is awaiting your institutional review.",
                link="/transfers"
            ),
            Notification(
                user_id=u_instructor.id,
                role=UserRole.LAB_INSTRUCTOR,
                title="Annual Stock Verification Records Loaded",
                message="Official stock register for F106, F107, F108, F109, and F110 successfully synchronized with the central database.",
                link="/inventory"
            )
        ]
        db.add_all(notifs)
        db.commit()

        print("\n=======================================================")
        print("GENUINE SMVITM AI & DS STOCK DATA IMPORTED SUCCESSFULLY!")
        print("=======================================================")
        print(f"Total Laboratories & Facilities: {db.query(Laboratory).count()}")
        print(f"Total Capital Assets: {db.query(Asset).count()}")
        print(f"Total Bulk Inventory Items: {db.query(BulkInventory).count()}")
        print(f"Faults Under Repair: {db.query(FaultReport).filter_by(status=FaultStatus.IN_PROGRESS).count()}")
        print(f"Completed Transfers: {db.query(TransferRequest).filter_by(status=TransferStatus.COMPLETED).count()}")
        print(f"Pending Transfers: {db.query(TransferRequest).filter_by(status=TransferStatus.PENDING_APPROVAL).count()}")
        print("=======================================================\n")

    except Exception as e:
        db.rollback()
        print(f"ERROR POPULATING STOCK DATA: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    populate_real_stock()
