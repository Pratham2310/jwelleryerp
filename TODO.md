# TODO.md — Development Roadmap & Milestone Backlog

_Last updated: Frontend Development Roadmap & Milestone Breakdown Pass._

This document outlines the step-by-step development roadmap for **Stitch Jewellery ERP**. The remaining frontend work is divided into **13 self-contained milestones**, each designed to be completed in approximately **one development session**. 

Milestones are ordered strictly by architectural dependency.

---

## 🗺️ Roadmap Overview

```
Phase 1: Foundation & Calculations
  ├── Milestone 1: State Unification & Design System Cleanup
  └── Milestone 2: Critical Financial & Billing Calculation Fixes

Phase 2: Domain Model & Tagging
  ├── Milestone 3: Item Design Template vs. Atomic Tag UI Split
  └── Milestone 4: Thermal Tag Printing & Tag Audit UI

Phase 3: POS, Old Gold & Compliance
  ├── Milestone 5: Advanced POS Billing & Statutory Compliance UI
  └── Milestone 6: Old Gold Buyback Voucher & Valuation Engine

Phase 4: Production & Karigar Workflows
  └── Milestone 7: Karigar Work Order & Job Bag Integration

Phase 5: Multi-Branch Architecture
  └── Milestone 8: Multi-Branch Navigation & Inter-Branch Stock Transfers (IBST)

Phase 6: Statutory Compliance, Accounting & Hallmarking
  ├── Milestone 9: GST Compliance, e-Invoice & e-Way Bill UI
  ├── Milestone 10: BIS Hallmarking, HUID & Gold Savings Scheme UI
  └── Milestone 11: Financial Ledgers & Tally Integration

Phase 7: Reports, Security & Hardware
  ├── Milestone 12: Comprehensive Reports Hub & Customer 360
  └── Milestone 13: Admin RBAC, Statutory Parameters & Hardware UI
```

---

## 🏁 Phase 1: Foundation & Calculations (Milestones 1 – 2)

### 📍 Milestone 1: State Unification & Design System Cleanup
- **Goal:** Unify scattered component state, remove theme duplication, and set up testing infrastructure.
- **Dependencies:** None.
- **Tasks:**
  1. Extract a shared `ThemeContext` / `useTheme()` hook and migrate all 6+ components off duplicated theme-detection boilerplate (`KNOWN_ISSUES.md` #14).
  2. Lift `LooseStone[]` (`StoneManager.tsx`) and `JobBag[]` (`JobBagManager.tsx`) state to `App.tsx` so all screens share unified reactive state (`KNOWN_ISSUES.md` #8).
  3. Wire live `items`/`customers`/`karigars` state into `Header.tsx` global search instead of static mock data import (`KNOWN_ISSUES.md` #9).
  4. Configure Vitest test environment for domain and calculation unit tests.

### 📍 Milestone 2: Critical Financial & Billing Calculation Fixes
- **Goal:** Fix GST-compliance-breaking calculation bugs in the Billing Estimator and implement unit tests.
- **Dependencies:** Milestone 1.
- **Tasks:**
  1. 🚨 **Fix Old Gold Tax Deduction (`KNOWN_ISSUES.md` #1):** Compute 3% GST on total new sale subtotal first; apply Old Gold trade-in value as a payment settlement credit (PRD §8.3 compliance).
  2. 🚨 **Item-Specific Wastage (`KNOWN_ISSUES.md` #3):** Replace hardcoded `wastagePercent = 3.5` with `item.wastagePercent` from each item record.
  3. 🚨 **Making Charge Branching (`KNOWN_ISSUES.md` #4):** Branch on `makingChargeType` (`per-gram`, `percentage`, `flat`) and compute Wastage Value and Making Charge as separate figures per PRD §7.2.
  4. 🚨 **Wire Scheme Redemption Payment (`KNOWN_ISSUES.md` #5):** Validate customer's `savingsSchemeBalance` and deduct redeemed amount upon invoice completion.
  5. **Sequential Invoice Numbering (`KNOWN_ISSUES.md` #6):** Implement sequential, gap-free invoice numbers per branch instead of array length.
  6. **PRD §17 Worked Example Test Suite:** Write automated Vitest tests replicating the canonical billing example.

---

## 🏁 Phase 2: Domain Model & Tagging Infrastructure (Milestones 3 – 4)

### 📍 Milestone 3: Item Design Template vs. Atomic Physical Tag UI Split
- **Goal:** Structurally split the data model and UI into Design Catalog Templates and Atomic Physical Tags.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Update TypeScript interfaces (`types.ts`) to define `ItemDesign` (master design template) and `Tag` (atomic physical piece with gross wt, net wt, purity, HUID, ownership type).
  2. Redesign `CatalogManager.tsx` with a tabbed interface: **Item Design Templates** vs **Tag Inventory**.
  3. Build Tag Status State Machine UI (`CREATED` -> `IN_STOCK` -> `IN_SHOWCASE` -> `RESERVED` -> `SOLD` -> `OUT_FOR_JOBWORK` -> `MELTED`).
  4. Add Stock Ownership tags (`OWNED`, `GML_FINANCED`, `CONSIGNMENT` / Vendor Stock).

### 📍 Milestone 4: Thermal Tag Printing & Tag Audit UI
- **Goal:** Implement scannable barcode/QR tag generation, printable sticker preview, and stock audit tools.
- **Dependencies:** Milestone 3.
- **Tasks:**
  1. Integrate a real scannable QR Code / Barcode generation library (`qrcode.react` / `bwip-js`).
  2. Build Thermal Tag Sticker Generator & Print Layout Designer preview (2-line and 3-line jewellery tag stickers showing HUID, SKU, Wt, Purity, QR).
  3. Build Physical Stock Audit / Counting UI for scanning tags with a barcode reader and flagging stock count variances.

---

## 🏁 Phase 3: POS, Old Gold & Statutory Compliance UI (Milestones 5 – 6)

### 📍 Milestone 5: Advanced POS Billing & Statutory Compliance UI
- **Goal:** Add statutory threshold enforcement, multi-payment split, and sales return capability to Billing.
- **Dependencies:** Milestone 2, Milestone 3.
- **Tasks:**
  1. 🚨 **Mandatory PAN Verification Modal:** Build modal enforcing PAN collection and verification when invoice total >= ₹2,00,000 (PMLA / Tax compliance).
  2. 🚨 **Multi-Payment Split UI Component:** Build multi-tender payment control (combining Cash + Card + UPI + Scheme Redemption + Old Gold Voucher).
  3. **Proforma Quotation vs Tax Invoice Toggle:** Build toggle between non-tax estimates and official GST Tax Invoices.
  4. **Sales Return & Credit Note Generator:** Build UI for processing item returns and issuing customer credit notes.

### 📍 Milestone 6: Old Gold Buyback Voucher & Purity Valuation Engine
- **Goal:** Implement a dedicated compliance-correct Old Gold Buyback purchase voucher and purity valuation calculator.
- **Dependencies:** Milestone 5.
- **Tasks:**
  1. Build dedicated Old Gold Purchase Voucher creation modal (PRD §8.3 separate purchase transaction).
  2. Build Old Gold Melt & Touch Valuation Calculator: Gross Weight, Melting Loss %, Melted Weight, Purity Touch %, Fine Gold Yield, Purity Rate, Testing Charges, Net Valuation.
  3. Build Old Gold Inventory Vault tracker (In Safe -> Refinery -> Fine Gold Stock).

---

## 🏁 Phase 4: Production & Karigar Workflows (Milestone 7)

### 📍 Milestone 7: Karigar Work Order & Job Bag Integration
- **Goal:** Unify Karigar job-work, Job Bag Kanban stages, fine gold accounting, and scrap return.
- **Dependencies:** Milestone 3.
- **Tasks:**
  1. Unify `KarigarManager.tsx` work orders and `JobBagManager.tsx` Kanban stages into a single shared data model and workflow.
  2. Build Fine Gold (24K Equivalent) Ledger view for Karigars (converting 22K/18K metal issued/returned into 24K pure weight).
  3. Build Scrap & Unused Loose Stone Return receipt modal.
  4. Implement Karigar Wastage Cap breach warning alerts.

---

## 🏁 Phase 5: Multi-Branch Architecture (Milestone 8)

### 📍 Milestone 8: Multi-Branch Navigation & Inter-Branch Stock Transfers (IBST)
- **Goal:** Make the frontend multi-branch aware with active store selection and stock transfer workflows.
- **Dependencies:** Milestone 3, Milestone 5.
- **Tasks:**
  1. Add Active Branch Switcher dropdown to Header (`STORE: MUM-01`, `STORE: DEL-01`, `CENTRAL_VAULT`).
  2. Build Multi-Branch inventory filter and counter/vault sub-location assignment UI.
  3. Build Inter-Branch Stock Transfer (IBST) UI: Create transfer request, dispatch in-transit stock, receive & accept/reject shipment.
  4. Build branch-specific metal rate override UI.

---

## 🏁 Phase 6: Statutory Compliance, Accounting & Hallmarking (Milestones 9 – 11)

### 📍 Milestone 9: GST Compliance, e-Invoice & e-Way Bill UI
- **Goal:** Build tax master management, split HSN line display, e-Invoice (IRN), and GSTR reporting.
- **Dependencies:** Milestone 5.
- **Tasks:**
  1. Build Tax Master UI & Split Line Tax breakdown (HSN 7113 @ 3%, HSN 7102 @ 1.5%, HSN 9988 @ 5%, CGST/SGST vs IGST).
  2. Build e-Invoice (IRN) generation status & B2C/B2B QR Code render on printed invoices.
  3. Build e-Way Bill auto-trigger form for goods movement > ₹50,000.
  4. Build GSTR-1 & GSTR-3B preview tables with JSON/Excel export.

### 📍 Milestone 10: BIS Hallmarking, HUID & Gold Savings Scheme UI
- **Goal:** Implement AHC hallmarking batch dispatch, 6-digit HUID assignment, and scheme passbooks.
- **Dependencies:** Milestone 3, Milestone 5.
- **Tasks:**
  1. Build AHC (Assaying & Hallmarking Centre) Dispatch & Receipt Batch UI.
  2. Build 6-digit alphanumeric HUID tag assignment interface.
  3. 🚨 **Non-Hallmarked Sale Prevention Guard:** Alert and block billing of un-hallmarked gold items (PRD §11.4).
  4. Build Gold Savings Scheme Plan Enrollment modal and printable Passbook statement.
  5. 🚨 **Scheme Cash Refund Block Warning UI:** Legal guard preventing cash refunds on scheme balances (BUIDS Act compliance).

### 📍 Milestone 11: Financial Ledgers & Tally Integration
- **Goal:** Build double-entry general ledger views, day book registers, and Tally Prime export.
- **Dependencies:** Milestone 5, Milestone 6.
- **Tasks:**
  1. Build Chart of Accounts UI and General Ledger statement viewer for Customers, Karigars, and Suppliers.
  2. Build Day Book & Cash/Bank Book UI with daily closing balance summary.
  3. Build Tally Prime XML Export Interface for one-click accounting sync.

---

## 🏁 Phase 7: Reports, Security & Hardware (Milestones 12 – 13)

### 📍 Milestone 12: Comprehensive Reports Hub & Customer 360
- **Goal:** Build a centralized analytics reports center and 360-degree customer profile view.
- **Dependencies:** Milestones 5 – 11.
- **Tasks:**
  1. Build central Reports Hub (`/reports`): Daily Sales Summary by Category & Payment Mode, Inventory Ageing Report (>90/180 days), Karigar Reconciliation Report, Gross Margin Realization Report, Audit Log Viewer.
  2. Build Customer 360 View: Purchase history timeline, family birthdays/anniversaries, ring sizes, WhatsApp rate alert configuration.

### 📍 Milestone 13: Admin RBAC, Statutory Parameters & Hardware UI
- **Goal:** Build admin role/permissions management, supervisor approval modals, and hardware peripheral controls.
- **Dependencies:** Milestones 1 – 12.
- **Tasks:**
  1. Build Admin User & Role Management screen with per-role permission matrix.
  2. Build Supervisor Approval PIN Modal for high-value rate overrides, large discounts, and invoice cancellations.
  3. Build Digital Scale Live Connection UI (USB/Serial status indicator + Fetch Weight button).
  4. Build Offline POS Queue Sync UI indicator & conflict resolution drawer.
