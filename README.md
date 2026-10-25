# Inventory Management System
## AI-Powered Smart Inventory Management System for College Laboratories

**Institution:** Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM), Bantakal, Udupi, Karnataka, India  
**Department:** Department of Artificial Intelligence and Data Science  
**Mandatory Project Root:** `C:\Users\User\Documents\thisha_mydetails\miniproject work\Inventory-Management-System`

---

## 🏛️ 1. Project Overview & Institutional Branding

The **Inventory Management System** is a complete, production-grade full-stack web application developed for the Department of Artificial Intelligence and Data Science at Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM). Engineered specifically for academic and technical institutions, it automates asset lifecycle tracking, equipment health monitoring, technician repair management, multi-tier inter-laboratory transfers, purchase ordering with partial goods receipt, and machine-learning diagnostics.

### Key Institutional Highlights:
- **Official SMVITM Visual Identity:** Features official institutional branding (`smvitm-logo.jfif` and `smvitm-campus.jfif`) in deep navy (`#0B192C`), white, and academic maroon/teal accents.
- **Demonstration Laboratories Configured:**
  1. **Computer Laboratory 1:** AI & Deep Learning Laboratory (Room 204, Academic Block II)
  2. **Computer Laboratory 2:** Data Science & Cloud Computing Laboratory (Room 205, Academic Block II)
- **Zero-Friction Dual Database Architecture:** Configured for PostgreSQL (`postgresql+psycopg2://...`) with automated fallback to persistent SQLite (`inventory_smvitm.db`) for instant local testing without Docker dependencies.

---

## 💻 2. Technology Stack

- **Frontend:** React 18, Vite 5, TypeScript 5.5, Tailwind CSS 3.4, Lucide React Icons, HTML5-QRCode Scanner.
- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2.0 ORM, Alembic Migrations, Pydantic v2, Argon2id (`argon2-cffi`), PyJWT.
- **AI & Machine Learning:** Scikit-Learn 1.9 (`Pipeline`, `TfidfVectorizer`, `LogisticRegression`), Joblib model serialization, Rule-Grounded Smart Database Assistant, Chronological Demand Forecasting.
- **Security:** In-memory sliding-window brute-force rate limiting, HTTP security headers (`nosniff`, `DENY`, `strict-origin`), file upload MIME validation, path traversal guards, strict server-side RBAC.
- **Auditing & Export:** Streaming CSV exports, printable 3"x2" QR code sticker generation, immutable audit trail.

---

## 👥 3. Demonstration Credentials & RBAC Roles

| Role | Institutional Email | Password | Scope & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Lab Instructor** | `instructor@sode-edu.in` | `Instructor@123` | Assigned to Labs 1 & 2. Asset management, fault reporting, transfer requests, repair verification, and purchase requisitions. |
| **Technician** | `technician@sode-edu.in` | `Tech@123` | Technician repair workbench, diagnostic logging, spare parts allocation, and repair completion submission. |
| **Head of Department (HOD)** | `hod.aids@sode-edu.in` | `Hod@123` | Departmental approvals for inter-lab transfers and equipment purchase requisitions. |
| **Principal** | `principal@sode-edu.in` | `Principal@123` | Executive sanctioning, campus capital expenditure oversight, and final budget approval. |
| **Administrator** | `admin@sode-edu.in` | `Admin@123` | System settings, user provisioning, laboratory assignment, and full security audit logging. |

> *Quick Login:* The login page contains one-click demo selector buttons to log into any role instantly during project evaluation.

---

## 📋 4. Complete Feature Catalog by Phase

### Phase 1 — Foundation & Authentication
- Secure Argon2id password hashing and generic login error handling.
- Role-based authorization and laboratory-level access boundaries.
- Session handling with JWT tokens and automatic logout.
- Responsive institutional layout with mobile drawer and role-specific dashboards.

### Phase 2 — Inventory Management & QR Code System
- Serialized asset tracking (desktops, monitors, GPUs, switches, UPS units, ACs, furniture).
- Bulk inventory management with strict quantity sum constraints (`total = working + damaged + missing + in_repair`).
- Printable 3"x2" college QR asset stickers and in-browser camera QR code scanner.
- Paginated inventory tables with live text search, category filtering, and status badges.

### Phase 3 — Fault Reporting & Technician Repair Management
- Complete fault reporting workflow with priority levels (`Low`, `Medium`, `High`, `Critical`).
- Prominent electrical hazard warnings and safety alerts.
- Dedicated Technician Repair Workbench for recording diagnosis, troubleshooting steps, and parts used.
- Formal two-step repair verification (Technician completes $\rightarrow$ Lab Instructor verifies or reopens).
- Anti-self-verification guard: technicians cannot verify their own repairs.

### Phase 4 — Inter-Lab Transfers, Purchase Orders & Approval Workflows
- Multi-tier inter-lab transfer workflow (`Draft` $\rightarrow$ `Submitted` $\rightarrow$ `Approved` $\rightarrow$ `Dispatched` $\rightarrow$ `Received & Confirmed`).
- **Safe Stock Movement Guarantee:** Approval alone does not move stock; physical relocation occurs atomically upon destination laboratory receipt confirmation.
- Anti-self-approval enforcement on transfers and purchase orders (`403 Forbidden`).
- Purchase requisitions with backend-validated cost calculations and vendor quotation upload.
- Official Purchase Order (PO) issuance (`PO-SMVITM-YYYY-...`) and partial goods receipt with auto-generation of serialized assets.
- Linked equipment replacement and formal asset retirement workflow.

### Phase 5 — AI-Powered Inventory Intelligence
- **Scikit-Learn Fault Classifier:** Predicts fault category, suggested priority, and technician dispatch with confidence score and manual-review fallback.
- **Smart Inventory Assistant:** Answers natural language questions grounded strictly in authorized database records with zero hallucinations.
- **Demand Forecasting Engine:** Analyzes chronological stock movements with explicit data sufficiency indicators (`INSUFFICIENT` for demonstration data).
- **Explainable Reorder Recommendations:** Recommends replenishment with **Active Purchase Order Deduplication** to prevent duplicate college expenditures.
- **Mandatory Safety Directive:** AI never automatically places orders, closes tickets, or certifies electrical safety.

### Phase 6 — Security Hardening, Audit & Integration
- Brute-force rate limiting on `/api/auth/login` (lockout after 5 failed attempts in 60s).
- HTTP security headers middleware (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, etc.).
- File upload path traversal protection and strict MIME/extension whitelisting.
- CLI script for secure initial administrator creation (`scripts/create_admin.py`).
- Comprehensive 58-test automated verification suite with 100% pass rate.

---

## 🚀 5. Installation & Startup Instructions

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ and npm

### Step 1: Backend Setup
Open a PowerShell terminal in the backend directory:
```powershell
cd "C:\Users\User\Documents\thisha_mydetails\miniproject work\Inventory-Management-System\backend"

# Install backend dependencies
python -m pip install -r requirements.txt

# Seed demonstration database (idempotent, safe to run anytime)
python scripts/seed_demo.py

# Train / verify the Scikit-learn fault classification model
python scripts/train_fault_classifier.py

# Start the FastAPI backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Server: `http://127.0.0.1:8000`
- Interactive OpenAPI / Swagger Docs: `http://127.0.0.1:8000/docs`

### Step 2: Frontend Setup
Open a second PowerShell terminal in the frontend directory:
```powershell
cd "C:\Users\User\Documents\thisha_mydetails\miniproject work\Inventory-Management-System\frontend"

# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```
- Frontend Application: `http://localhost:5173`

---

## 🔑 6. Secure Initial Administrator Provisioning

To create a new administrator account securely without hardcoded credentials:
```powershell
cd "C:\Users\User\Documents\thisha_mydetails\miniproject work\Inventory-Management-System\backend"
python scripts/create_admin.py --email "admin.new@sode-edu.in" --name "Principal Administrator"
```
The script prompts securely for a strong password (minimum 8 characters, letters and numbers required), hashes it with Argon2id, and records an audit log.

---

## 🧪 7. Automated Testing & Verification

Run the full backend test suite across all 7 test files:
```powershell
cd "C:\Users\User\Documents\thisha_mydetails\miniproject work\Inventory-Management-System\backend"
python -m pytest tests/ -W ignore -v
```

### Verification Results Summary:
```text
tests/test_ai_features.py (12 tests) ................................... PASSED
tests/test_backend.py (9 tests) ........................................ PASSED
tests/test_permissions.py (6 tests) .................................... PASSED
tests/test_phase2_inventory.py (7 tests) ................................ PASSED
tests/test_phase3_faults_and_repairs.py (9 tests) ....................... PASSED
tests/test_phase4_transfers_and_purchases.py (7 tests) .................. PASSED
tests/test_phase6_security_and_integration.py (8 tests) ................. PASSED

============================= 58 passed in 11.17s =============================
```

To verify the frontend TypeScript types and production build:
```powershell
cd "C:\Users\User\Documents\thisha_mydetails\miniproject work\Inventory-Management-System\frontend"
npm run build
```
Output: `✓ built in 4.48s` with 0 errors.

---

## 🎯 8. 5–10 Minute Demonstration Guide for Evaluation

When presenting the project to examiners or faculty:

1. **Login & Role-Based Access Control (1 min):**
   - Open `http://localhost:5173`. Point out the official SMVITM campus photo and logo.
   - Click the "Lab Instructor" demo chip to log in. Point out the assigned laboratory scope (Labs 1 & 2).

2. **Inventory & QR Code System (2 min):**
   - Navigate to **Lab Inventory**. Show serialized assets (workstations, monitors, GPUs).
   - Click "Print QR Code" for an asset to display the formatted 3"x2" printable asset sticker.
   - Click "Scan QR" in the top navbar and demonstrate the camera/lookup interface.

3. **Fault Reporting & AI Classification (2 min):**
   - Click **Faults & Repairs** $\rightarrow$ **Report New Fault**.
   - Type description: *"Sparks observed from switchboard near row 2 computer workbench."*
   - Click **AI Auto-Suggest Category & Priority**. The model predicts `Electrical fault`, sets `Critical` priority, and displays the safety hazard banner.
   - Submit the fault. Show the new ticket in the active queue.

4. **Technician Repair Workbench & Verification (1 min):**
   - Log out and log in as **Technician**.
   - Open the ticket in the **Technician Workbench**, record diagnostic findings, add spare parts used, and click "Submit for Verification".
   - Log back in as **Lab Instructor** and formally verify and close the repair, showing automatic restoration of asset status to `Working`.

5. **Inter-Lab Transfers with Safe Movement (1.5 min):**
   - Navigate to **Inter-Lab Transfers**. Create a transfer request from Lab 1 to Lab 2.
   - Point out that stock does **not** move upon approval alone.
   - Log in as **HOD** to approve, dispatch as Instructor, and confirm receipt in Lab 2. Show the atomic asset location update in the **Stock Movement Ledger**.

6. **Purchase Ordering & Partial Goods Receipt (1.5 min):**
   - Navigate to **Purchase Requests**. Submit a requisition for replacement keyboards.
   - Sanction as HOD and Principal, issue PO (`PO-SMVITM-2026-...`), and record partial delivery of 5 units.
   - Show automatic generation of serialized asset records with institutional tags.

7. **AI Insights & Smart Assistant Hub (1 min):**
   - Navigate to **AI Insights & Assistant**.
   - In the **Smart Assistant**, click suggested queries (e.g. *"How many working computers are in Laboratory 1?"*). Point out the grounded tabular database results and zero hallucination.
   - Switch to **Reorder Recommendations** and highlight the **PO Deduplication Badge** (`ORDER ALREADY PLACED`), explaining how it protects the college budget.

---

## ⚠️ 9. Ethical AI, Limitations & Safety Directives

1. **Safety Boundary:** AI classification is an advisory diagnostic triage assistant. It never replaces certified electrical inspections or decides hardware safety.
2. **Anti-Speculation Policy:** When historical data is insufficient ($<12$ observations), demand forecasting explicitly declares `INSUFFICIENT` data and presents baseline safety buffer projections rather than speculative time-series curves.
3. **Financial Protection:** The reorder engine enforces a strict human-in-the-loop policy. Requisitions require explicit HOD and Principal approval before purchase orders are issued.

---

**Department of Artificial Intelligence and Data Science**  
*Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM), Bantakal, Karnataka, India*
