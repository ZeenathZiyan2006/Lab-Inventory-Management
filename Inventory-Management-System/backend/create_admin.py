"""
Secure Administrator Provisioning Script
Institution: Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM)
Department: Artificial Intelligence and Data Science

Usage:
    python create_admin.py --email admin@sode-edu.in --name "Prof. Administrator" --password "SecurePass@123"
Or run without flags for interactive prompts.
"""

import argparse
import getpass
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.models import User, UserRole, Department, Laboratory
from app.services.audit_service import log_audit

def main():
    parser = argparse.ArgumentParser(description="Create or reset an institutional Administrator account.")
    parser.add_argument("--email", type=str, help="Administrator email address")
    parser.add_argument("--name", type=str, help="Full name of administrator")
    parser.add_argument("--password", type=str, help="Administrator password")

    args = parser.parse_args()

    email = args.email or input("Enter Administrator Email: ").strip()
    if not email or "@" not in email:
        print("Error: A valid email address is required.")
        sys.exit(1)

    name = args.name or input("Enter Administrator Full Name: ").strip()
    if not name:
        name = "System Administrator"

    password = args.password
    if not password:
        password = getpass.getpass("Enter Administrator Password: ")
        confirm_password = getpass.getpass("Confirm Administrator Password: ")
        if password != confirm_password:
            print("Error: Passwords do not match.")
            sys.exit(1)

    if len(password) < 8:
        print("Error: Password must be at least 8 characters long for university compliance.")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        hashed_pw = get_password_hash(password)

        if user:
            print(f"Updating existing user account for {email} to ADMIN role...")
            user.full_name = name
            user.hashed_password = hashed_pw
            user.role = UserRole.ADMIN
            user.is_active = True
        else:
            dept = db.query(Department).first()
            user = User(
                email=email.strip().lower(),
                full_name=name,
                hashed_password=hashed_pw,
                role=UserRole.ADMIN,
                department_id=dept.id if dept else None,
                is_active=True
            )
            db.add(user)

        db.commit()
        db.refresh(user)
        log_audit(db, "ADMIN_PROVISIONED", "User", str(user.id), details=f"Administrator {email} provisioned securely.")
        print(f"\n[SUCCESS] Administrator account provisioned successfully!")
        print(f"  Institution: Shri Madhwa Vadiraja Institute of Technology & Management")
        print(f"  Email: {user.email}")
        print(f"  Name:  {user.full_name}")
        print(f"  Role:  {user.role.value}\n")

    except Exception as e:
        db.rollback()
        print(f"Error provisioning administrator: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
