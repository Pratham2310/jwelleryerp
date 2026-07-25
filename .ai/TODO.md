# TODO.md — Development Roadmap & Milestone Backlog

_Last updated: 2026-07-25 — **Milestones 1–10 complete** (see `CHANGELOG.md`); Milestone 11 (Estimate/Quotation Mode Toggle) is next up. Restructured into single-feature, independently-testable milestones (34 milestones, M3–M36), ordered strictly by dependency. Milestones 1 & 2 are unchanged and already complete (see `CHANGELOG.md`). Every milestone below traces back to a specific gap identified in `CURRENT_PROGRESS.md` §3 / `MODULE_STATUS.md`._

**Restructuring rule applied:** the previous version of this roadmap grouped multiple unrelated features into single "session-sized" milestones (e.g. one milestone mixed PAN verification + multi-payment split + Estimate mode + Sales Return; another mixed BIS Hallmarking with Gold Savings Schemes; another mixed Admin RBAC with hardware peripheral UI). Each milestone below is now **one feature, buildable and testable on its own**, with explicit dependencies and a "Testable via" line. Related small milestones are still grouped under a shared Phase heading for readability, but the Phase grouping is not itself a dependency — read each milestone's own **Dependencies** line as the source of truth.

**Reference before designing any new screen:** `docs/stitch_jewelry_management_suite/stitch_jewelry_management_suite/` contains 22 pre-made AI-Studio screen designs (`code.html` + `screen.png`) for many of the modules below — check here first to stay visually consistent with what's already been envisioned, before designing from scratch.

**Cross-cutting, not tied to one milestone:** the `ui/` component library (`Button`/`Input`/`Card`/`Badge`) is missing a `Modal`, `DataTable`, `StatCard`, `ConfirmDialog`, `Select`, `Toast`, and a shared status-badge-color utility — every screen currently hand-rolls these independently (see `CURRENT_PROGRESS.md` §3.6). Extract these opportunistically as each milestone below touches a screen that needs one, rather than as a dedicated milestone.

---

## 🗺️ Roadmap Overview

```
Phase 1: Foundation & Calculations                        [DONE]
  ├── M1  State Unification & Design System Cleanup
  └── M2  Critical Financial & Billing Calculation Fixes

Phase 2: Tagging & Inventory Foundation                   [DONE]
  ├── M3  Item Design vs. Tag Data Model & Catalog UI Split      [DONE]
  ├── M4  Tag Lifecycle State Machine                            [DONE]
  ├── M5  Barcode/QR Tag Generation & Thermal Print Layout       [DONE]
  └── M6  Physical Stock Audit / Reconciliation UI               [DONE]

Phase 3: Billing Compliance & Correctness (each independent of the others; all depend only on M2)
  ├── M7  Discount-Before-GST Calculation Fix                    [DONE]
  ├── M8  Mandatory PAN Verification Modal                       [DONE]
  ├── M9  Multi-Payment Split UI                                 [DONE]
  ├── M10 Manager Override + Reason-Log Workflow                 [DONE]
  ├── M11 Estimate / Quotation Mode Toggle                       <- next up
  ├── M12 Sales Return & Credit Note
  └── M13 Dashboard Real-Data Accuracy Fix

Phase 4: Old Gold Buyback
  ├── M14 Old Gold Purchase Voucher & Melt/Touch Valuation Engine
  └── M15 Old Gold Vault Tracking

Phase 5: Karigar & Production
  ├── M16 Karigar Append-Only Ledger & Fine Gold Equivalent Engine
  ├── M17 WorkOrder ↔ Job Bag Unification
  └── M18 Karigar Wastage Cap Alerts & Scrap/Stone Return

Phase 6: Multi-Branch
  ├── M19 Branch Master & Branch Switcher
  └── M20 Inter-Branch Stock Transfer (IBST)

Phase 7: GST Compliance
  ├── M21 Tax Master & HSN / CGST-SGST-IGST Split
  ├── M22 e-Invoice & e-Way Bill Simulation
  └── M23 GSTR-1 / GSTR-3B Report Export

Phase 8: Hallmarking & Gold Savings Schemes
  ├── M24 AHC Dispatch & HUID Assignment
  ├── M25 Non-Hallmarked Sale Prevention Guard
  ├── M26 Gold Savings Scheme Master & Enrollment
  └── M27 Scheme Passbook & Cash-Refund Block Warning

Phase 9: Accounting
  ├── M28 Accounting Ledgers & Auto-Journal Posting
  └── M29 Tally Prime Export

Phase 10: Reports & Customer Insight
  ├── M30 Reports Hub
  └── M31 Customer 360 View

Phase 11: Admin, Security & Hardware
  ├── M32 Admin Role & Permission Management
  ├── M33 Supervisor PIN Approval Modal
  ├── M34 Statutory Parameters Configuration Screen
  ├── M35 Digital Scale & Hardware Connection UI (Simulated)
  └── M36 Offline POS Queue Sync UI (Simulated)
```

---

## 🏁 Phase 1: Foundation & Calculations (Milestones 1 – 2) — ✅ DONE

### 📍 Milestone 1: State Unification & Design System Cleanup — ✅ DONE (2026-07-25)
- **Goal:** Unify scattered component state, remove theme duplication, and set up testing infrastructure.
- **Dependencies:** None.
- **Tasks:**
  1. ✅ Extract a shared `ThemeContext` / `useTheme()` hook and migrate all 6+ components off duplicated theme-detection boilerplate (`KNOWN_ISSUES.md` #14).
  2. ✅ Lift `LooseStone[]` (`StoneManager.tsx`) and `JobBag[]` (`JobBagManager.tsx`) state to `App.tsx` so all screens share unified reactive state (`KNOWN_ISSUES.md` #8).
  3. ✅ Wire live `items`/`customers`/`karigars` state into `Header.tsx` global search instead of static mock data import (`KNOWN_ISSUES.md` #9).
  4. ✅ Configure Vitest test environment for domain and calculation unit tests.

### 📍 Milestone 2: Critical Financial & Billing Calculation Fixes — ✅ DONE (2026-07-25)
- **Goal:** Fix GST-compliance-breaking calculation bugs in the Billing Estimator and implement unit tests.
- **Dependencies:** Milestone 1.
- **Tasks:**
  1. ✅ 🚨 **Fix Old Gold Tax Deduction (`KNOWN_ISSUES.md` #1):** Compute 3% GST on total new sale subtotal first; apply Old Gold trade-in value as a payment settlement credit (PRD §8.3 compliance).
  2. ✅ 🚨 **Item-Specific Wastage (`KNOWN_ISSUES.md` #3):** Replace hardcoded `wastagePercent = 3.5` with `item.wastagePercent` from each item record.
  3. ✅ 🚨 **Making Charge Branching (`KNOWN_ISSUES.md` #4):** Branch on `makingChargeType` (`per-gram`, `flat`) and compute Wastage Value and Making Charge as separate figures per PRD §7.2.
  4. ✅ 🚨 **Wire Scheme Redemption Payment (`KNOWN_ISSUES.md` #5):** Validate customer's `savingsSchemeBalance` and deduct redeemed amount upon invoice completion.
  5. ✅ **Sequential Invoice Numbering (`KNOWN_ISSUES.md` #11):** Gap-free, `localStorage`-persisted per-financial-year counter.
  6. ✅ **PRD §17 Worked Example Test Suite:** `src/lib/billingCalculations.test.ts` — 10 Vitest tests.

---

## 🏁 Phase 2: Tagging & Inventory Foundation (Milestones 3 – 6)

### 📍 Milestone 3: Item Design vs. Tag Data Model & Catalog UI Split — ✅ DONE (2026-07-25)
- **Goal:** Structurally split `JewelleryItem` into `ItemDesign` (template) and `Tag` (individually-weighed physical piece, with `huid` and `stockOwnershipType` fields), and rebuild `CatalogManager.tsx` around the split.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. ✅ Split `types.ts`: `ItemDesign` (category, defaults, images) + `Tag` (gross/net wt, purity, `huid?: string`, `stockOwnershipType: 'OWNED'|'GML_FINANCED'|'CONSIGNMENT'`).
  2. ✅ Rebuilt `CatalogManager.tsx` with a tabbed interface: **Tag Inventory** vs **Item Design Templates** (add-only for designs; full add/detail/delete for tags, matching the existing UI patterns).
  3. ✅ Added Stock Ownership badge/filter (`OWNED`/`GML_FINANCED`/`CONSIGNMENT`) to the Tag Inventory tab.
- **Testable via:** ✅ Catalog shows two working tabs over real, separately-typed data; `App.tsx`/`BillingEstimator.tsx`/`Header.tsx`/`Dashboard.tsx` all compile and function against the new `Tag` type (`tsc --noEmit` clean, Playwright smoke test passing with zero console errors); a new Tag created against a selected `ItemDesign` correctly inherits its defaults and shows the right ownership badge.

### 📍 Milestone 4: Tag Lifecycle State Machine — ✅ DONE (2026-07-25)
- **Goal:** Enforce the full Tag status lifecycle instead of a free-text status field.
- **Dependencies:** Milestone 3.
- **Tasks:**
  1. ✅ `src/lib/tagStateMachine.ts` — pure `canTransition(from, to)` over the full 12-state lifecycle, with `Sold`/`DamagedOrMelted` terminal. 31 unit tests.
  2. ✅ `Tag.status` is now this enum; Catalog's detail modal offers only legal next states and rejects illegal ones with a visible error. Billing/Dashboard read status via `isSellable()`/`canTransition()`.
- **Testable via:** ✅ Vitest coverage of legal/illegal transition pairs; Playwright-verified that the UI only offers legal targets and blocks the rest.

### 📍 Milestone 5: Barcode/QR Tag Generation & Thermal Print Layout — ✅ DONE (2026-07-25)
- **Goal:** Replace the decorative barcode icon with a real, scannable barcode/QR generator and a printable thermal-label layout.
- **Dependencies:** Milestone 3.
- **Tasks:**
  1. ✅ Integrated `qrcode.react` + `jsbarcode` behind a shared `src/components/ui/TagCode.tsx` (`TagQRCode`, `TagBarcode`).
  2. ✅ Catalog's Tag Preview and JobBagManager's print tag now render real codes (QR = Tag/JobBag id, CODE128 barcode = SKU). Fixed the sticker not being wrapped in the `#print-area` convention, which had made "Print Tag" print the whole page.
- **Testable via:** ✅ Playwright confirmed real SVG barcode geometry (44 bars) rather than an icon glyph.

### 📍 Milestone 6: Physical Stock Audit / Reconciliation UI — ✅ DONE (2026-07-25)
- **Goal:** Let staff scan/enter a tray of tags and reconcile against the expected system list.
- **Dependencies:** Milestone 4, Milestone 5.
- **Tasks:**
  1. ✅ New Stock Audit tab in Catalog (`StockAuditPanel.tsx`) with scan-or-type input, backed by `src/lib/stockAudit.ts`'s pure `reconcileStockAudit()`. Flags missing tags and extra scans (unknown codes *and* real tags not expected in this tray). 7 unit tests.
  2. ✅ Count-and-weight discrepancy summary + generated report for owner sign-off.
- **Testable via:** ✅ Playwright-verified missing/extra flagging and report generation.
- **Note:** the panel is explicitly theme-aware (`useTheme()`) rather than relying on `index.css`'s global dark-mode repaint — see `KNOWN_ISSUES.md` #12.

---

## 🏁 Phase 3: Billing Compliance & Correctness (Milestones 7 – 13)

_Each milestone in this phase depends only on Milestone 2 and is independent of every other milestone in this phase — they can be built and tested in any order._

### 📍 Milestone 7: Discount-Before-GST Calculation Fix — ✅ DONE (2026-07-25)
- **Goal:** Correct `calculateInvoiceTotals()` so bill-level discount reduces the taxable value *before* GST is computed (PRD §7.4).
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. ✅ `calculateInvoiceTotals()` gained an explicit `taxableValue` (`subtotal − discount`, clamped at 0) and computes GST from it. New Vitest cases prove GST changes with the discount.
  2. ✅ POS summary panel and both invoice-display surfaces reordered to Subtotal → Discount → GST → Invoice Total. The affected mock invoice's stored figures were corrected.
- **Testable via:** ✅ Unit tests + Playwright-confirmed on-screen arithmetic.

### 📍 Milestone 8: Mandatory PAN Verification Modal — ✅ DONE (2026-07-25)
- **Goal:** Block checkout ≥₹2,00,000 without a captured PAN (or Form 60), per PRD §4.4/§15.3.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. ✅ `src/lib/statutoryChecks.ts` (threshold + structural PAN format check, 9 unit tests) and a PAN/Form 60 modal in `BillingEstimator.tsx`, plus a live requirement banner in the summary panel.
- **Testable via:** ✅ Playwright-verified: blocked without PAN, malformed PAN rejected, valid PAN or Form 60 allows checkout.
- **Note:** the threshold tests the **tax invoice total**, not the post-old-gold cash collected. Threshold becomes data-driven in Milestone 34.

### 📍 Milestone 9: Multi-Payment Split UI — ✅ DONE (2026-07-25)
- **Goal:** Allow one bill to be settled across multiple payment modes simultaneously (PRD §7.5).
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. ✅ Opt-in split mode with a `{mode, amount}[]` list; the single-mode quick-select remains the default fast path. Invoices persist their `paymentSplit`, shown as "Settled Via" on both display surfaces.
  2. ✅ `validatePaymentSplit()` in `billingCalculations.ts`, 6 unit tests. Scheme Redemption is now portion-aware — only the amount tendered against the scheme is validated/debited.
- **Testable via:** ✅ Playwright-verified under- and overpayment both block checkout; an exact split settles.

### 📍 Milestone 10: Manager Override + Reason-Log Workflow — ✅ DONE (2026-07-25)
- **Goal:** Require a logged reason (and, later, a Supervisor PIN — see Milestone 33) when staff overrides wastage %, making charge, or rate at the counter (PRD §7.1 step 4, §15.1).
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. ✅ `src/lib/priceOverrides.ts` detects lines edited away from their Tag's master values and blocks checkout until a ≥5-char reason is logged per field. 11 unit tests.
  2. ✅ Reasons persist onto the saved `SaleInvoice` line and render as an "Approved Price Overrides" audit block on the receipt.
- **Testable via:** ✅ Playwright-verified: no false positives before editing, gate blocks on edit, short reasons rejected, audit trail persisted.
- **Note:** bill-level *discount* is deliberately not gated here — it's a separate, already-visible field rather than a deviation from an item master. Gate it in Milestone 33 alongside the Supervisor PIN if the business wants that.

### 📍 Milestone 11: Estimate / Quotation Mode Toggle
- **Goal:** Let staff generate a non-fiscal Estimate (same calculation engine, no invoice number consumed, no stock deduction) before committing to a Tax Invoice (PRD §7.8).
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Add an `invoiceType: 'ESTIMATE' | 'TAX_INVOICE'` toggle; Estimate mode skips PAN/GST-compliance gates and prints "ESTIMATE — NOT A TAX INVOICE."
  2. Add a one-click "Convert to Tax Invoice" action that re-pulls the current rate (or honors the estimate's original rate, staff's explicit choice).
- **Testable via:** Generating an Estimate does not increment the invoice sequence or reduce stock; converting it produces a real, sequential invoice.

### 📍 Milestone 12: Sales Return & Credit Note
- **Goal:** Process item returns and issue credit notes against a prior invoice.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Add a Sales Return tab to the Billing Registry, referencing an original `invoiceId` and generating a negative-value linked record.
- **Testable via:** Returning an item against a real invoice produces a correctly-signed credit note referencing the original.

### 📍 Milestone 13: Dashboard Real-Data Accuracy Fix
- **Goal:** Remove the two decorative/fake Dashboard widgets and wire in already-available real state.
- **Dependencies:** Milestone 2 (for `invoices`); Milestone 1 (for lifted `stones`/`jobBags` state).
- **Tasks:**
  1. Replace `Dashboard.tsx`'s hardcoded "Monthly Sales Revenue Trend" SVG data with a real trend derived from `invoices`, grouped by month.
  2. Replace the static hardcoded "ERP Action Log" list with a real recent-events feed (or remove it if no real event source exists yet).
  3. Wire Dashboard KPI cards to the `stones`/`jobBags` state that has been available in `App.tsx` since Milestone 1 but has never been consumed there.
- **Testable via:** Adding a new invoice/stone/job-bag updates the relevant Dashboard card without a page reload; the trend chart changes when invoice data changes.

---

## 🏁 Phase 4: Old Gold Buyback (Milestones 14 – 15)

### 📍 Milestone 14: Old Gold Purchase Voucher & Melt/Touch Valuation Engine
- **Goal:** A dedicated, standalone Old Gold purchase flow (buy outright, no linked sale required), with the real PRD §8.2 valuation formula.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Implement `src/lib/oldGoldValuation.ts` (unit-tested): `Net Payable Weight = grossWeight × testedPurity% × (1 − meltingLoss%)`, `buybackValue = netPayableWeight × buybackRate`.
  2. Build a dedicated Old Gold Purchase Voucher modal (separate from Billing's inline trade-in quick-fields, which remain for the "adjust against a sale" path) capturing customer KYC, description/photo, and the valuation inputs above.
- **Testable via:** Unit tests against the PRD §17 worked example's old-gold figures (12.740g net weight, ₹77,077 buyback value); creating a standalone voucher with no linked invoice succeeds.

### 📍 Milestone 15: Old Gold Vault Tracking
- **Goal:** Track old gold inventory from intake through melting.
- **Dependencies:** Milestone 14.
- **Tasks:**
  1. Add `OldGoldLot[]` state (lifted to `App.tsx`, same pattern as other entities): `In Safe → Melted → Fine Gold Stock`.
- **Testable via:** A voucher from Milestone 14 creates a lot in "In Safe"; advancing its status is reflected in a vault summary view.

---

## 🏁 Phase 5: Karigar & Production (Milestones 16 – 18)

### 📍 Milestone 16: Karigar Append-Only Ledger & Fine Gold Equivalent Engine
- **Goal:** Replace the two mutable running totals (`metalBalance`/`laborChargesOwed`) with a real, append-only ledger, and implement the PRD §6.2 Fine Gold Equivalent formula.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Add an append-only Karigar ledger entry model (grams-payable and money-payable entries, never netted together), matching the Weight/Money dual-ledger principle already established for billing. Closes `KNOWN_ISSUES.md` #10.
  2. Implement `src/lib/fineGoldLedger.ts` (unit-tested): `fineEquiv = grossWeight × purityFraction`, used for issue/receipt reconciliation instead of comparing raw grams regardless of purity.
- **Testable via:** Unit tests on fine-gold-equivalent math across mixed purities; a karigar's displayed balance is now derivable by summing their ledger entries, not read from a single mutable field.

### 📍 Milestone 17: WorkOrder ↔ Job Bag Unification
- **Goal:** Merge `WorkOrder` (`KarigarManager.tsx`) and `JobBag` (`JobBagManager.tsx`) — currently two disconnected models describing the same real-world karigar job — into one shared data model.
- **Dependencies:** Milestone 16, Milestone 3 (a completed job-work order should produce a real `Tag`, not a free-floating record).
- **Tasks:**
  1. Unify the two data models and the two screens' workflows into a single Karigar Job-Work aggregate.
- **Testable via:** Creating a job in either screen is visible and consistent in the other; completing a job produces one real `Tag` record.

### 📍 Milestone 18: Karigar Wastage Cap Alerts & Scrap/Stone Return
- **Goal:** Flag (not silently absorb) excess wastage, and support returning unused stones/scrap metal.
- **Dependencies:** Milestone 16.
- **Tasks:**
  1. Replace the current silent-cap behavior in "Receive Finished" with an explicit flag-for-owner-review when actual wastage exceeds the agreed cap.
  2. Build a Scrap & Unused Loose Stone Return receipt modal, linked to `StoneManager`'s existing Issue/Return flow.
- **Testable via:** Receiving a job with wastage above the cap surfaces a visible review flag instead of silently capping the deduction.

---

## 🏁 Phase 6: Multi-Branch (Milestones 19 – 20)

### 📍 Milestone 19: Branch Master & Branch Switcher
- **Goal:** Introduce a real `Branch` entity and let the active branch be switched from the header.
- **Dependencies:** None beyond Milestone 1 (state-lifting pattern).
- **Tasks:**
  1. Add a `Branch` entity (`branchCode`, `gstin`, `stateCode`, `invoiceSeriesPrefix`, `defaultStockOwnershipType`), lifted state, seeded with 1–2 mock branches.
  2. Replace `Sidebar`/`Header`'s hardcoded "Mumbai BST"/"MUM-01" text with a real Branch Switcher dropdown.
  3. Filter Catalog/Stones/Job Bags by active branch; add branch-specific metal rate override.
- **Testable via:** Switching branches in the header changes which stock/rates are shown across Catalog/Stones/Job Bags.

### 📍 Milestone 20: Inter-Branch Stock Transfer (IBST)
- **Goal:** Dispatch and receive Tag inventory between branches.
- **Dependencies:** Milestone 19, Milestone 3 (transfers move real `Tag` records).
- **Tasks:**
  1. Build an IBST screen: create transfer request → dispatch (Tag status → `TransferInTransit`) → receive & accept/reject at destination.
- **Testable via:** A dispatched tag disappears from the source branch's sellable stock and appears as "in transit" until received at the destination.

---

## 🏁 Phase 7: GST Compliance (Milestones 21 – 23)

### 📍 Milestone 21: Tax Master & HSN / CGST-SGST-IGST Split
- **Goal:** Replace the hardcoded flat 3% GST constant with a data-driven Tax Master and automatic intra-/inter-state split.
- **Dependencies:** Milestone 19 (needs `Branch.stateCode` to compare against customer state).
- **Tasks:**
  1. Add a `TaxRate[]` master (HSN 7113/7102/9988 rows with CGST/SGST/IGST) and a lookup replacing the hardcoded `0.03` in `billingCalculations.ts`. Keep the single composite-rate default behavior (per `HANDOFF.md` item 1, still unresolved pending CA sign-off) unless/until that question is explicitly resolved.
  2. Auto-determine CGST+SGST vs. IGST by comparing branch state to customer state.
- **Testable via:** Billing a customer in the branch's own state produces CGST+SGST; a different-state customer produces IGST; unit tests cover both.

### 📍 Milestone 22: e-Invoice & e-Way Bill Simulation
- **Goal:** Model the e-Invoice/e-Way Bill data shape and UI states without a real government API integration (per the simulation-only ground rule in `.ai/IMPLEMENTATION_WORKFLOW.md`).
- **Dependencies:** Milestone 21.
- **Tasks:**
  1. Add an e-Invoice status badge on invoices (`PENDING`/`GENERATED`/`FAILED`, mock `irn` string) with a "Simulate Submission" action.
  2. Add an e-Way Bill auto-trigger UI stub for goods movement > ₹50,000.
- **Testable via:** Simulating submission flips the badge state and shows a mock IRN/QR placeholder.

### 📍 Milestone 23: GSTR-1 / GSTR-3B Report Export
- **Goal:** Read-only preview tables for periodic GST returns.
- **Dependencies:** Milestone 21.
- **Tasks:**
  1. Build GSTR-1 & GSTR-3B preview tables computed from `invoices`, exportable as CSV client-side.
- **Testable via:** Exported CSV totals reconcile against the sum of the underlying invoices for the selected period.

---

## 🏁 Phase 8: Hallmarking & Gold Savings Schemes (Milestones 24 – 27)

### 📍 Milestone 24: AHC Dispatch & HUID Assignment
- **Goal:** Real hallmarking dispatch/receive workflow assigning a genuine, unique HUID per tag.
- **Dependencies:** Milestone 4 (needs the `PendingHallmark`/`Hallmarked` states from the Tag state machine).
- **Tasks:**
  1. Build an AHC dispatch/receive batch UI: select `Tag[]` in `PendingHallmark`, dispatch, then receive assigns a 6-char `huid` (validated globally unique against all existing tags) and transitions to `Hallmarked`.
- **Testable via:** Assigning a HUID that collides with an existing one is rejected; a successfully hallmarked tag shows its real HUID (replacing the current hardcoded mock string) in Catalog.

### 📍 Milestone 25: Non-Hallmarked Sale Prevention Guard
- **Goal:** Block billing of un-hallmarked gold items above the exemption threshold (PRD §11.4).
- **Dependencies:** Milestone 24.
- **Tasks:**
  1. `BillingEstimator.tsx` blocks adding a Tag to a bill if it requires hallmarking and has no `huid` (with a configurable exemption, e.g. sub-2g items).
- **Testable via:** Attempting to bill a non-exempt, non-hallmarked tag is blocked with a clear message; an exempt or already-hallmarked tag bills normally.

### 📍 Milestone 26: Gold Savings Scheme Master & Enrollment
- **Goal:** Support multiple configurable schemes instead of one hardcoded "Swarna Nidhi."
- **Dependencies:** Milestone 2 (Scheme Redemption already wired into billing).
- **Tasks:**
  1. Build a Scheme Master (tenure, bonus type, redemption rules) and an Enrollment modal in `CustomerManager.tsx`.
- **Testable via:** Creating a second, differently-configured scheme and enrolling a customer in it produces correct balance accrual independent of the original hardcoded scheme.

### 📍 Milestone 27: Scheme Passbook & Cash-Refund Block Warning
- **Goal:** Printable passbook statement and an explicit legal compliance guard.
- **Dependencies:** Milestone 26.
- **Tasks:**
  1. Build a printable Passbook/statement view per enrollment.
  2. Add an explicit, visible cash-refund-block warning (citing the Banning of Unregulated Deposit Schemes Act, 2019) anywhere scheme balance handling is discussed in the UI — no cash-refund path exists today, but there's currently no visible compliance messaging explaining why (Handbook §1.6.1/D-11).
- **Testable via:** Printing a passbook produces a correct running balance; the warning text is visible on the scheme balance card.

---

## 🏁 Phase 9: Accounting (Milestones 28 – 29)

### 📍 Milestone 28: Accounting Ledgers & Auto-Journal Posting
- **Goal:** Auto-post double-entry journal entries behind every transaction.
- **Dependencies:** Milestone 2 (invoices), Milestone 16 (karigar labor payable), Milestone 14 (old gold purchase entries).
- **Tasks:**
  1. Implement `src/lib/journalPosting.ts` (unit-tested): every invoice/old-gold/karigar-receipt event posts a balanced `{debit, credit}` journal-entry pair.
  2. Build Chart of Accounts, Ledger Statement, and Day Book viewer screens.
- **Testable via:** Every posted journal entry balances (`Σdebit = Σcredit`); a Day Book total reconciles against the sum of the day's invoices.

### 📍 Milestone 29: Tally Prime Export
- **Goal:** One-click accounting sync export.
- **Dependencies:** Milestone 28.
- **Tasks:**
  1. Build a client-side Tally-compatible XML export button (no real Tally integration — a downloaded file, per the simulation-only ground rule).
- **Testable via:** Exported XML validates against Tally's expected schema shape for a sample period.

---

## 🏁 Phase 10: Reports & Customer Insight (Milestones 30 – 31)

### 📍 Milestone 30: Reports Hub
- **Goal:** Central `/reports` route covering the PRD §14.2–14.9 catalog.
- **Dependencies:** Milestone 28 (accounting-derived margin reports), Milestone 16 (Karigar Reconciliation), Milestone 3 (Inventory Ageing needs `Tag.createdAt`).
- **Tasks:**
  1. Build the Reports Hub: Daily Sales Summary, Inventory Ageing (>90/180 days), Karigar Reconciliation, Gross Margin Realization, Audit Log Viewer.
- **Testable via:** Each report's totals reconcile against the underlying transactional state it's derived from.

### 📍 Milestone 31: Customer 360 View
- **Goal:** A single consolidated customer profile view.
- **Dependencies:** Milestone 2 (purchase history from `invoices`).
- **Tasks:**
  1. Build a Customer 360 drawer in `CustomerManager.tsx`: purchase-history timeline, scheme status, loyalty tier.
- **Testable via:** Opening the drawer for a customer with existing invoices shows an accurate, chronologically-ordered history.

---

## 🏁 Phase 11: Admin, Security & Hardware (Milestones 32 – 36)

### 📍 Milestone 32: Admin Role & Permission Management
- **Goal:** A real (if cosmetic, per the frontend-only scope) role/permission matrix.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Build a Role & Permission Management screen; gate UI affordances (not real security, since there's no backend) based on the logged-in mock user's role.
- **Testable via:** Logging in as a role with a permission removed no longer shows the corresponding UI control.

### 📍 Milestone 33: Supervisor PIN Approval Modal
- **Goal:** Require supervisor authorization for high-value overrides.
- **Dependencies:** Milestone 32, Milestone 10 (the override workflow it gates).
- **Tasks:**
  1. Build a Supervisor PIN modal, triggered by Milestone 10's override workflow for rate overrides/large discounts/invoice cancellations above a configurable threshold.
- **Testable via:** Attempting a large discount without the correct PIN is blocked; the correct PIN allows it through and logs who approved it.

### 📍 Milestone 34: Statutory Parameters Configuration Screen
- **Goal:** Make the PAN/TCS/PMLA thresholds data-driven instead of hardcoded.
- **Dependencies:** Milestone 8 (refactors the hardcoded ₹2,00,000 constant introduced there).
- **Tasks:**
  1. Build a single editable Statutory Parameters screen (PAN threshold, TCS threshold, PMLA CTR threshold); have Milestone 8's PAN modal read from it instead of a literal constant.
- **Testable via:** Changing the configured PAN threshold changes when the PAN modal triggers, without a code change.

### 📍 Milestone 35: Digital Scale & Hardware Connection UI (Simulated)
- **Goal:** Cosmetic hardware-connection indicators, extending the existing Simulation Desk pattern.
- **Dependencies:** Milestone 1 (Simulation Desk).
- **Tasks:**
  1. Add Digital Scale / Thermal Printer "connection status" indicators + a mock "Fetch Weight" button to the Simulation Desk panel in `App.tsx`.
- **Testable via:** Toggling the simulated connection state updates the indicator; "Fetch Weight" populates a mock value into the active form field.

### 📍 Milestone 36: Offline POS Queue Sync UI (Simulated)
- **Goal:** Visualize an offline invoice queue and reconnect/sync behavior (still no real offline persistence layer — this is a frontend-only prototype).
- **Dependencies:** Milestone 1 (Simulation Desk's `forceOffline` toggle).
- **Tasks:**
  1. Add an Offline Queue Sync indicator + conflict-resolution drawer, driven by the existing `forceOffline` simulation toggle.
- **Testable via:** Enabling Force Offline and completing a "sale" queues it visibly; disabling offline mode shows it "syncing" and clearing from the queue.
