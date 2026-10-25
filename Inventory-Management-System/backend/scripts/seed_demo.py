"""
Demonstration Data Seeder CLI
Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM)
"""
import os
import sys
import argparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.seed.demo_data import seed_database

def main():
    parser = argparse.ArgumentParser(description="Seed demonstration records for SMVITM Inventory Management System.")
    parser.add_argument("--reset", action="store_true", help="Reset all tables before seeding (WARNING: deletes existing records)")
    args = parser.parse_args()

    if args.reset:
        confirm = input("CAUTION: This will delete all existing database records and reinitialize demo data.\nType 'YES_CONFIRM_RESET' to proceed: ").strip()
        if confirm != "YES_CONFIRM_RESET":
            print("Operation aborted by user. No data was modified.")
            sys.exit(0)
        print("Resetting database and seeding demonstration data...")
        seed_database(reset=True)
    else:
        print("Running idempotent demonstration data seeding...")
        seed_database(reset=False)

    print("Seeding routine completed successfully.")

if __name__ == "__main__":
    main()
