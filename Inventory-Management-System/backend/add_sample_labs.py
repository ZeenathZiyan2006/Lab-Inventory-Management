import os
import sys

# Ensure backend path is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Laboratory, Department, User, UserRole

db_path = os.path.join(backend_dir, "inventory_smvitm.db")
engine = create_engine(f"sqlite:///{db_path}")
Session = sessionmaker(bind=engine)

def add_additional_labs():
    db = Session()
    try:
        dept_aids = db.query(Department).filter(Department.code == "AI_DS").first()
        dept_cse = db.query(Department).filter(Department.code == "CSE").first()
        
        instructors = db.query(User).filter(User.role == UserRole.LAB_INSTRUCTOR).all()

        new_labs_data = [
            {
                "name": "Machine Learning & Robotics Laboratory",
                "code": "AIDS-LAB-03",
                "department_id": dept_aids.id if dept_aids else 1,
                "room_number": "Lab 206 (Second Floor, Academic Block II)",
                "description": "High-performance GPU computing clusters and robotic testbenches.",
                "qr_code": "LAB-AIDS-LAB-03"
            },
            {
                "name": "IoT & Embedded Systems Laboratory",
                "code": "AIDS-LAB-04",
                "department_id": dept_aids.id if dept_aids else 1,
                "room_number": "Lab 207 (Second Floor, Academic Block II)",
                "description": "Microcontroller kits, sensors, wireless gateways, and FPGA boards.",
                "qr_code": "LAB-AIDS-LAB-04"
            },
            {
                "name": "Network Simulation & Cyber Security Lab",
                "code": "AIDS-LAB-05",
                "department_id": dept_aids.id if dept_aids else 1,
                "room_number": "Lab 301 (Third Floor, Academic Block II)",
                "description": "Managed Cisco L3 switches, firewall appliances, and virtualized network sandboxes.",
                "qr_code": "LAB-AIDS-LAB-05"
            }
        ]

        added = []
        for lab_info in new_labs_data:
            existing = db.query(Laboratory).filter(Laboratory.code == lab_info["code"]).first()
            if not existing:
                lab = Laboratory(
                    name=lab_info["name"],
                    code=lab_info["code"],
                    department_id=lab_info["department_id"],
                    room_number=lab_info["room_number"],
                    description=lab_info["description"],
                    qr_code=lab_info["qr_code"],
                    is_active=True
                )
                if instructors:
                    lab.assigned_users = instructors
                db.add(lab)
                added.append(lab_info["name"])

        db.commit()
        if added:
            print(f"Successfully added {len(added)} new laboratories:")
            for a in added:
                print(f"  + {a}")
        else:
            print("Laboratories already exist in the database.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    add_additional_labs()

