"""
Secure Administrator Provisioning Script
Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM)
Department of Artificial Intelligence and Data Science
"""
import os
import sys
import argparse
import getpass
import re

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.models import User, UserRole, AuditLog

def validate_password_strength(password: str) -> bool:
    if len(password) < 8:
        print("Error: Password must be at least 8 characters long.")
        return False
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        print("Error: Password must contain both letters and numbers.")
        return False
    return True

def provision_admin(email: str, full_name: str, password: str, force_update: bool = False):
    db = SessionLocal()
    try:
        email_clean = email.strip().lower()
        existing_user = db.query(User).filter(User.email == email_clean).first()
        
        if existing_user and not force_update:
            print(f"Error: User with email '{email_clean}' already exists (Role: {existing_user.role.value}).")
            print("Use --force to update this existing user's credentials to Administrator.")
            return False

        hashed = get_password_hash(password)

        if existing_user:
            existing_user.role = UserRole.ADMIN
            existing_user.full_name = full_name
            existing_user.hashed_password = hashed
            existing_user.is_active = True
            action = "UPDATED"
        else:
            new_admin = User(
                email=email_clean,
                full_name=full_name,
                role=UserRole.ADMIN,
                hashed_password=hashed,
                is_active=True
            )
            db.add(new_admin)
            action = "CREATED"

        # Log audit entry
        audit = AuditLog(
            action=f"ADMIN_PROVISION_{action}",
            entity_type="User",
            entity_id=email_clean,
            details=f"Secure administrator account {action.lower()} via CLI provisioning script."
        )
        db.add(audit)
        db.commit()
        print(f"Success: Administrator account '{email_clean}' ({full_name}) successfully {action.lower()}!")
        return True
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="Securely provision an initial administrator for SMVITM Inventory Management System.")
    parser.add_argument("--email", help="Administrator institutional email address")
    parser.add_argument("--name", help="Full name of administrator")
    parser.add_argument("--password", help="Administrator password (optional, prompted securely if omitted)")
    parser.add_argument("--force", action="store_true", help="Force credential update if user already exists")

    args = parser.parse_args()

    email = args.email or input("Enter administrator institutional email: ").strip()
    if not email or "@" not in email:
        print("Error: A valid email address is required.")
        sys.exit(1)

    name = args.name or input("Enter administrator full name: ").strip()
    if not name:
        name = "System Administrator"

    if args.password:
        password = args.password
    else:
        password = getpass.getpass("Enter secure password (min 8 characters): ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: Passwords do not match.")
            sys.exit(1)

    if not validate_password_strength(password):
        sys.exit(1)

    success = provision_admin(email, name, password, force_update=args.force)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
