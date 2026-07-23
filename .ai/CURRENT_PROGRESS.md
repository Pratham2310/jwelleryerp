# CURRENT_PROGRESS.md

_Last updated: Detailed Frontend Gap Analysis & PRD/Handbook Comparison Pass._

## 1. Executive Snapshot Summary

- **Documentation (Business/Domain Design):** PRD complete (v1.0, 19 sections). Developer Handbook fully drafted for Phase 1 (Business Primer), Phase 2 (8 Master Data modules), and Phase 3 (Inventory & Tagging). Phases 4–14 exist as TOC placeholders.
- **Backend / Database:** Not started (no server, no PostgreSQL database, no API endpoints). All persistent data relies on `localStorage`.
- **Frontend Prototype ("Stitch UI"):** High-fidelity React 19 + Vite 6 + TypeScript prototype containing 8 primary screens and authentication pages. Built as an interactive UI/UX reference implementation.
- **Gap Analysis Result:** While the current Stitch UI presents a polished visual foundation, **none** of the 16 PRD modules are 100% production-ready on the frontend. The prototype conflates core domain entities (e.g. Item Design vs Physical Tag), lacks key statutory compliance flows (PAN verification modal, split GST/HSN calculation, separate Old Gold purchase vouchers, e-Invoice/IRN, e-Way Bill), misses multi-branch/multi-location capability, and relies on unlinked, isolated UI state across several screens.

---

## 2. Screen-by-Screen Detailed Audit & Missing Frontend Features

### 2.1 Dashboard (`/dashboard`, `Dashboard.tsx`)
- **What Exists:**
  - Executive KPI cards: Total Sales Revenue, In-Stock Item Count, Active Karigar Work Orders Count, Total Artisan Gold Outstanding.
  - Live Metal Rate Ticker: Editable 24K Gold, 22K Gold, 18K Gold, Silver rates with 24h percentage change and inline SVG sparklines.
  - Quick-action buttons (New Sale, Issue Job-Work, Add Item, Add Customer).
  - Recent transactions preview and Karigar balance summary.
- **Missing Frontend Features:**
  - No Branch selector / multi-branch filter dropdown.
  - Rate ticker edits mutate local state directly with no append-only rate history modal, no audit log, and no fat-finger rate change warning alert (>2% change guard).
  - Does not reflect Loose Stone vault balances (`StoneManager.tsx`) or Job Bag stages (`JobBagManager.tsx`) due to un-lifted state.
  - Missing real-time rate feed toggle (e.g. IBJA / Bullion market live ticker API).

### 2.2 Catalog & Showcase (`/catalog`, `CatalogManager.tsx`)
- **What Exists:**
  - Grid & List view of inventory items with category and status filters.
  - Search by SKU or item name.
  - Item detail drawer/modal with weight, purity, making charges, and visual barcode mock.
  - Add-Item Modal form.
- **Missing Frontend Features:**
  - **Structural Domain Gap:** Conflates `ItemDesign` (template) and `Tag` (physical inventory unit). No UI separation to manage Design master templates vs printing individual tags.
  - No Thermal Barcode / QR Code Tag Printing interface (customizable 2-line/3-line jewellery tag sticker generator).
  - No Digital Scale integration button to fetch live weight via serial/USB.
  - No Stock Ownership selection (`OWNED`, `GML_FINANCED`, `CONSIGNMENT` / Vendor stock).
  - No Multi-branch location indicator (Branch, Safe, Counter, Vault).
  - No Bulk Stock Audit / Counting UI (scanning multiple barcodes to verify physical vs system count).
  - Cosmetic HUID/Certificate field — no validation against BIS guidelines and no AHC batch dispatch workflow.

### 2.3 Stones & Diamonds (`/stones`, `StoneManager.tsx`)
- **What Exists:**
  - Loose stone/diamond inventory table (Cut, Color, Clarity, Carats, Certifications).
  - Add Stone modal and Issue-to-Karigar modal.
- **Missing Frontend Features:**
  - **Isolated State:** State is local to `StoneManager.tsx` and not available to Billing or Dashboard.
  - No 4Cs Diamond Rate Matrix pricing interface (Cut/Color/Clarity/Slab pricing).
  - No Stone Certificate PDF viewer / attachment uploader (GIA, IGI, HRD certificate verification).
  - No loose stone return / un-used stone return workflow from Karigars.

### 2.4 Billing Estimator & POS (`/billing`, `BillingEstimator.tsx`)
- **What Exists:**
  - Multi-item sale invoice creation, pulling stock from catalog or manual entry.
  - Customer selection dropdown & guest customer fields.
  - Old Gold trade-in input fields (weight, purity, rate).
  - Discount input and single payment method selector (Cash, Card, UPI, Scheme Redemption).
  - Printable receipt modal and searchable Invoice Registry tab.
- **Missing Frontend Features & Compliance Fixes:**
  - **Compliance Bug:** Deducts Old Gold trade-in value from taxable subtotal before GST calculation (violates PRD §8.3 / GST law). Needs separate Old Gold Purchase Voucher flow.
  - **Compliance Bug:** Flat 3% GST rate with no HSN split (HSN 7113 @ 3%, HSN 7102 @ 1.5%), no CGST + SGST vs IGST branching based on customer address vs branch state.
  - **Missing Mandatory PAN Verification Modal:** PRD §7.2 / PMLA requires mandatory PAN entry and verification when invoice total >= ₹2,00,000. No modal or validation currently exists.
  - **Missing Multi-Payment Split UI:** Cannot split payment across multiple modes simultaneously (e.g. Cash + Card + Scheme Redemption + Old Gold Voucher).
  - **Missing Line Item Calculations:** Does not display Making Charge breakdown per gram vs % vs flat, nor per-item wastage weight and value separately.
  - **Missing Estimation Mode:** No toggle between Proforma Quotation / Estimate and Official GST Tax Invoice.
  - **Missing Sales Return / Credit Note UI:** No UI to process item returns or issue credit notes.

### 2.5 Karigar & Job-Work (`/karigar`, `KarigarManager.tsx`)
- **What Exists:**
  - Karigar directory with running metal balance and labor charges owed.
  - Issue-metal modal and work order table (`Assigned` -> `In Progress` -> `Completed` -> `Returned`).
  - Actual wastage calculation on work order completion.
- **Missing Frontend Features:**
  - **No Audit Trail / Ledger:** Mutates total running `metalBalance` and `laborChargesOwed` directly in memory without recording individual transaction ledger entries.
  - **No Fine Gold (24K Equivalent) Accounting:** Does not calculate or display pure gold weight equivalents when issuing 22K/18K gold.
  - No Wastage Cap Warning Alert when Karigar actual wastage exceeds maximum allowed cap.
  - No Scrap Return & Unused Metal Receipt modal.
  - No Disconnection from Job Bags (`JobBagManager.tsx`).

### 2.6 Job Bags Tracker (`/jobbags`, `JobBagManager.tsx`)
- **What Exists:**
  - Kanban board with production stages (`Casting` -> `Filing` -> `Setting` -> `Polishing` -> `Hallmark` -> `Completed`).
  - Job bag creation modal, priority flags, metal loss input, advance payment modal.
- **Missing Frontend Features:**
  - **Isolated State & Data Model:** Completely disconnected from `WorkOrder` and `Karigar` records in `KarigarManager.tsx`.
  - No Barcode/QR scanning handler to move job bags between stages via scanner.
  - No stone issue tracking linked to Loose Stone vault (`StoneManager.tsx`).

### 2.7 Customers & Schemes (`/customers`, `CustomerManager.tsx`)
- **What Exists:**
  - Customer directory with tier badges (Bronze, Silver, Gold, Platinum), lifetime spend, and loyalty points.
  - "Swarna Nidhi" Gold Savings Scheme balance display with "Add Installment" button.
- **Missing Frontend Features:**
  - **Legal Compliance Block Missing:** No warning/guard blocking cash refunds on Gold Savings Scheme balances (Banning of Unregulated Deposit Schemes Act compliance).
  - No Scheme Plan Enrollment Modal (11+1 month cash bonus plan vs monthly gold weight accumulation plan).
  - No Printable Scheme Passbook / Receipt Statement.
  - Missing KYC fields (PAN, Aadhaar, GSTIN, Address, Anniversary / Birthday dates).
  - No Rate Alert or WhatsApp / SMS reminder setup UI.

### 2.8 Auth & Role-Based Access Control (`/login`, `/register`, `LoginPage.tsx`, `RegisterPage.tsx`)
- **What Exists:**
  - Mock login/registration screen with role selection dropdown and guest login.
- **Missing Frontend Features:**
  - No actual RBAC route or UI component protection.
  - No Admin Role & Permission Management screen.
  - No Supervisor PIN / Authorization modal for sensitive actions (rate overrides, large discounts, invoice cancellations).

---

## 3. Overall Frontend Feature Gap Matrix

| PRD Module | Missing Frontend Screens / Components / Features | Impact |
|---|---|---|
| **1. Domain & Glossary** | 14K Gold, Sterling Silver 925, Fine Gold equivalent calculation displays | High |
| **2. Multi-Branch** | Branch Switcher, Inter-branch Stock Transfer (IBST) UI, Branch Stock Filter | Critical |
| **3. Personas & RBAC** | Role Management UI, Permission Matrix, Supervisor PIN Approval Modal | High |
| **4. Master Data** | Item Design vs Tag Master UI, 4Cs Diamond Rate Card UI, Tax Master UI, Party KYC fields | High |
| **5. Inventory & Tagging** | Thermal Tag Printer Preview, Barcode/RFID Audit Scanner UI, Digital Scale Fetch Button | Critical |
| **6. Karigar & Jobwork** | Unified Job Bag + Work Order UI, Fine Gold Ledger view, Scrap Return Modal | Critical |
| **7. Billing & POS** | Split GST/HSN line breakdown, Mandatory PAN Modal (>=₹2L), Multi-Payment Split UI | Critical |
| **8. Old Gold Buyback** | Separate Old Gold Purchase Voucher UI, Melting/Touch Purity Calculator | Critical |
| **9. GST Compliance** | e-Invoice (IRN) & QR Code UI, e-Way Bill Generator, GSTR-1/3B Report Tables | High |
| **10. Accounting** | Chart of Accounts, General Ledger Statement, Day Book, Tally XML Export UI | High |
| **11. BIS Hallmarking** | AHC Batch Dispatch/Receipt UI, 6-digit HUID input handler, Non-hallmarked Sale Block | High |
| **12. Gold Savings Scheme**| Scheme Plan Enrollment, Passbook Print, Legal Cash-Refund Block Warning UI | High |
| **13. CRM & Alerts** | Customer 360 View, Birthday/Anniversary Tracker, WhatsApp Rate Alert Preview | Medium |
| **14. Reports & Dashboards**| Comprehensive Reports Hub (Sales, Ageing, Karigar Reconciliation, Margins) | High |
| **15. Security & Statutory**| Statutory Parameters Master UI (PAN/TCS thresholds), Detailed Audit Trail Viewer | High |
| **16. Hardware & Offline** | Digital Scale USB/Serial status, Thermal Printer Layout Designer, Offline Queue Sync UI | High |
