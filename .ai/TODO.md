# TODO.md — Development Roadmap & Milestone Backlog

_Last updated: 2026-07-30 — **Milestones 1–32, 37–41, 45–48 complete; Phases 1–10, 12 and 14 done, Phase 11 started** (see `CHANGELOG.md`). M48 (Rate Master) was pulled forward out of Phase 15, closing the last standing decision **D-4** violation — both the Tax Master (M21) and the Metal Rate Master are now append-only. Phase 12 (Procurement) is complete — the app can now buy stock, and GST has both an output and an input side. Phases 9 and 14 (Accounting, end to end) are complete. Phase 10 is complete. Next is **M33 (Supervisor PIN)** — the enforcement mechanism the `billing.override` permission implies — with **M34 (Statutory Parameters)** and **M49 (User Management)** also unblocked by M32. The money/weight arithmetic foundation landed first, as planned, and `allocate()` is available for anything that must split and still balance. **Roadmap extended to 53 milestones** after a client-supplied module list was audited against the PRD — see the Coverage Audit table below; Phases 12–15 (M37–M53) are new. Restructured into single-feature, independently-testable milestones (34 milestones, M3–M36), ordered strictly by dependency. Milestones 1 & 2 are unchanged and already complete (see `CHANGELOG.md`). Every milestone below traces back to a specific gap identified in `CURRENT_PROGRESS.md` §3 / `MODULE_STATUS.md`._

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

Phase 3: Billing Compliance & Correctness                 [DONE]
  ├── M7  Discount-Before-GST Calculation Fix                    [DONE]
  ├── M8  Mandatory PAN Verification Modal                       [DONE]
  ├── M9  Multi-Payment Split UI                                 [DONE]
  ├── M10 Manager Override + Reason-Log Workflow                 [DONE]
  ├── M11 Estimate / Quotation Mode Toggle                       [DONE]
  ├── M12 Sales Return & Credit Note                             [DONE]
  └── M13 Dashboard Real-Data Accuracy Fix                       [DONE]

Phase 4: Old Gold Buyback                                 [DONE]
  ├── M14 Old Gold Purchase Voucher & Melt/Touch Valuation Engine [DONE]
  └── M15 Old Gold Vault Tracking                                 [DONE]

Phase 5: Karigar & Production                             [DONE]
  ├── M16 Karigar Append-Only Ledger & Fine Gold Equivalent Engine [DONE]
  ├── M17 WorkOrder ↔ Job Bag Unification                          [DONE]
  └── M18 Karigar Wastage Cap Alerts & Scrap/Stone Return          [DONE]

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
  ├── M32 Admin Role & Permission Management ✅
  ├── M33 Supervisor PIN Approval Modal ✅
  ├── M34 Statutory Parameters Configuration Screen ✅
  ├── M35 Digital Scale & Hardware Connection UI (Simulated) ✅
  └── M36 Offline POS Queue Sync UI (Simulated) ✅

Phase 12: Procurement & Supplier            [ADDED 2026-07-26 — gap found in coverage audit]
  ├── M37 Supplier Master (Party Master extension)
  ├── M38 Purchase Order
  ├── M39 Goods Receipt (GRN)
  ├── M40 Purchase Invoice & ITC Booking
  └── M41 Purchase Return / Debit Note

Phase 13: Inventory Operations              [ADDED 2026-07-26]
  ├── M42 Stock Adjustment & Write-Off Voucher ✅
  ├── M43 Melting Workflow ✅
  └── M44 Inventory Dashboard ✅

Phase 14: Accounting Depth                  [ADDED 2026-07-26 — extends Phase 9]
  ├── M45 Payment / Receipt / Contra Vouchers
  ├── M46 Cash Book & Day Book
  └── M47 Trial Balance, P&L & Balance Sheet

Phase 15: Masters & Admin Depth             [ADDED 2026-07-26]
  ├── M48 Rate Master Screen & Append-Only Rate History ✅
  ├── M49 User Management ✅
  ├── M50 Notification Center & Activity Feed ✅
  ├── M51 System Health & Diagnostics Panel ✅
  ├── M52 ITC Register & HSN Summary Reports ✅
  └── M53 Old Gold Buyback Dashboard ✅

Phase 16: Full-Product Gaps                 [ADDED 2026-08-04]
  ├── M54 Repair & Service Jobs
  ├── M55 Customer Orders & Advances
  ├── M56 Approval / Memo-Out Workflow
  ├── M57 Customer Credit & Receivables Ageing
  ├── M58 Salesperson Attribution & Incentives
  ├── M59 Loyalty Points Engine
  ├── M60 e-Invoice / e-Way Bill Integration-Ready
  └── M61 Outbound Notification Channels
```

---

## ⚠️ Sequencing Note (2026-07-26)

Milestone numbers reflect the order features were *identified*, not the order they should be
*built*. Two milestones warrant pulling forward ahead of their number:

1. **M48 — Rate Master & append-only rate history.** Rates are currently edited in place on the
   Dashboard, which violates decision D-4 (rate history must be append-only, never `UPDATE`d)
   outright. Every invoice's rate provenance depends on this, and the longer it waits the more
   historical data is written without it. This is a live compliance defect, not a missing feature.
2. **M19 — Branch Master.** `DECISIONS.md` D-1 locks the target as a multi-branch chain, and
   M21 (Tax Master) already cannot start without `Branch.stateCode`. Purchase (M38–M41) and the
   Branch report family (M30) also depend on it. Anything built before M19 gets built
   branch-unaware and needs retrofitting.

Separately, **the money-as-float issue** (`CURRENT_PROGRESS.md` §3.7 item 7, PRD §16.2) should be
cleared before the accounting phases (M28, M45–M47). Because all money math funnels through
`billingCalculations.ts`, the migration is contained today; posting double-entry journals on top
of float arithmetic would spread it.

---

## 📋 Coverage Audit (2026-07-26)

A module/screen list supplied by the client was checked line-by-line against this roadmap and
`docs/Jewellery_Retail_Software_PRD.md`. **The PRD covers every item.** This roadmap did not —
the original 36 milestones silently omitted several PRD modules, most significantly the entire
Procurement chain (PRD §6.1) and the financial statements (PRD §10.5/§14.7). Milestones 37–53
above close those gaps. Mapping of the client list:

| Client item | Status |
|---|---|
| Inventory Dashboard | **Added — M44** |
| Tag Master | ✅ Done (M3) |
| Barcode Printing / QR Printing | ✅ Done (M5) |
| HUID | Field done (M3); assignment workflow M24 |
| Stock Adjustment | **Added — M42** |
| Stock Transfer | Planned (M20 — IBST) |
| Stock Audit / Physical Verification | ✅ Done (M6) — these are the same workflow |
| Stock Ageing | Planned (inside M30) |
| Purchase Orders / Receipt / Invoice / Return | **Added — M38, M39, M40, M41** |
| Old Gold Buyback / Purity Testing | Planned (M14) |
| Old Gold Melting | **Split out — M43** (M15 covers only the old-gold vault) |
| Old Gold Exchange | ✅ Done (M2 inline); standalone voucher M14 |
| Buyback Dashboard | **Added — M53** |
| Accounting Ledger / Journal | Planned (M28) |
| Payment / Receipt / Contra | **Added — M45** |
| Cash Book | **Added — M46** |
| Trial Balance / P&L / Balance Sheet | **Added — M47** |
| GSTR1 / GSTR3B | Planned (M23) |
| ITC / HSN Summary | **Added — M52** |
| Gold Scheme Enrollment / Installments / Redemption | Redemption ✅ done (M2); rest M26/M27 |
| Reports: Sales/Purchase/Inventory/Customer/Karigar/Branch/Stock | M30 — **task list expanded** to name all seven families |
| Settings: RBAC / Permissions | Planned (M32) |
| Settings: Rate Master | **Added — M48** (was only an inline Dashboard edit, no history — violates D-4) |
| Settings: Tax Master | Planned (M21) |
| Settings: User Management | **Added — M49** (distinct from role/permission definition) |
| Settings: Branches | Planned (M19) |
| Admin: Audit Logs | Planned (inside M30) |
| Admin: Notification Center / Activity Feed | **Added — M50** |
| Admin: System Health | **Added — M51** |

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

### ✅ Milestone 11: Estimate / Quotation Mode Toggle — DONE (2026-07-26)
- **Goal:** Let staff generate a non-fiscal Estimate (same calculation engine, no invoice number consumed, no stock deduction) before committing to a Tax Invoice (PRD §7.8).
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Add an `invoiceType: 'ESTIMATE' | 'TAX_INVOICE'` toggle; Estimate mode skips PAN/GST-compliance gates and prints "ESTIMATE — NOT A TAX INVOICE."
  2. Add a one-click "Convert to Tax Invoice" action that re-pulls the current rate (or honors the estimate's original rate, staff's explicit choice).
- **Testable via:** Generating an Estimate does not increment the invoice sequence or reduce stock; converting it produces a real, sequential invoice.

### ✅ Milestone 12: Sales Return & Credit Note — DONE (2026-07-26)
- **Goal:** Process item returns and issue credit notes against a prior invoice.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Add a Sales Return tab to the Billing Registry, referencing an original `invoiceId` and generating a negative-value linked record.
- **Testable via:** Returning an item against a real invoice produces a correctly-signed credit note referencing the original.

### ✅ Milestone 13: Dashboard Real-Data Accuracy Fix — DONE (2026-07-26)
- **Goal:** Remove the two decorative/fake Dashboard widgets and wire in already-available real state.
- **Dependencies:** Milestone 2 (for `invoices`); Milestone 1 (for lifted `stones`/`jobBags` state).
- **Tasks:**
  1. Replace `Dashboard.tsx`'s hardcoded "Monthly Sales Revenue Trend" SVG data with a real trend derived from `invoices`, grouped by month.
  2. Replace the static hardcoded "ERP Action Log" list with a real recent-events feed (or remove it if no real event source exists yet).
  3. Wire Dashboard KPI cards to the `stones`/`jobBags` state that has been available in `App.tsx` since Milestone 1 but has never been consumed there.
- **Testable via:** Adding a new invoice/stone/job-bag updates the relevant Dashboard card without a page reload; the trend chart changes when invoice data changes.

---

## 🏁 Phase 4: Old Gold Buyback (Milestones 14 – 15)

### 📍 Milestone 14: Old Gold Purchase Voucher & Melt/Touch Valuation Engine — ✅ DONE (2026-07-26)
- **Goal:** A dedicated, standalone Old Gold purchase flow (buy outright, no linked sale required), with the real PRD §8.2 valuation formula.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Implement `src/lib/oldGoldValuation.ts` (unit-tested): `Net Payable Weight = grossWeight × testedPurity% × (1 − meltingLoss%)`, `buybackValue = netPayableWeight × buybackRate`.
  2. Build a dedicated Old Gold Purchase Voucher modal (separate from Billing's inline trade-in quick-fields, which remain for the "adjust against a sale" path) capturing customer KYC, description/photo, and the valuation inputs above.
- **Testable via:** ✅ 16 unit tests; a standalone voucher with no linked invoice succeeds; Playwright-verified end to end.
- **⚠️ PRD defect found:** §17's printed figures (12.740g / ₹77,077) do **not** follow from §8.2's own formula, which gives 12.731g / ₹77,023. The engine implements the formula and a test asserts it does *not* reproduce §17, so a future "fix" fails loudly. Needs client/CA confirmation — see `HANDOFF.md` §1a.

### 📍 Milestone 15: Old Gold Vault Tracking — ✅ DONE (2026-07-26)
- **Goal:** Track old gold inventory from intake through melting.
- **Dependencies:** Milestone 14.
- **Tasks:**
  1. ✅ Vault lifecycle state machine in `src/lib/oldGoldVault.ts`: `InSafe → SentForMelting → Melted → FineGoldStock`, plus `InSafe → ResaleAsIs`. State lives on the voucher (one voucher = one lot); multi-item vouchers are a future refinement.
  2. ✅ Vault summary with **refining variance** (recovered vs. predicted fine weight) and capital-tied-up reporting.
- **Testable via:** ✅ 25 unit tests; Playwright-verified that only legal transitions are offered, an over-gross recovery is rejected, and a short recovery surfaces as negative variance.
- **Note:** `InSafe → FineGoldStock` is deliberately illegal — a lot must pass through `Melted`, which is where recovered weight is captured.

---

## 🏁 Phase 5: Karigar & Production (Milestones 16 – 18)

### 📍 Milestone 16: Karigar Append-Only Ledger & Fine Gold Equivalent Engine — ✅ DONE (2026-07-27)
- **Goal:** Replace the two mutable running totals (`metalBalance`/`laborChargesOwed`) with a real, append-only ledger, and implement the PRD §6.2 Fine Gold Equivalent formula.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Add an append-only Karigar ledger entry model (grams-payable and money-payable entries, never netted together), matching the Weight/Money dual-ledger principle already established for billing. Closes `KNOWN_ISSUES.md` #10.
  2. Implement `src/lib/fineGoldLedger.ts` (unit-tested): `fineEquiv = grossWeight × purityFraction`, used for issue/receipt reconciliation instead of comparing raw grams regardless of purity.
- **Testable via:** Unit tests on fine-gold-equivalent math across mixed purities; a karigar's displayed balance is now derivable by summing their ledger entries, not read from a single mutable field.

### 📍 Milestone 17: WorkOrder ↔ Job Bag Unification — ✅ DONE (2026-07-27)
- **Goal:** Merge `WorkOrder` (`KarigarManager.tsx`) and `JobBag` (`JobBagManager.tsx`) — currently two disconnected models describing the same real-world karigar job — into one shared data model.
- **Dependencies:** Milestone 16, Milestone 3 (a completed job-work order should produce a real `Tag`, not a free-floating record).
- **Tasks:**
  1. Unify the two data models and the two screens' workflows into a single Karigar Job-Work aggregate.
- **Testable via:** Creating a job in either screen is visible and consistent in the other; completing a job produces one real `Tag` record.

### 📍 Milestone 18: Karigar Wastage Cap Alerts & Scrap/Stone Return — ✅ DONE (2026-07-27)
- **Goal:** Flag (not silently absorb) excess wastage, and support returning unused stones/scrap metal.
- **Dependencies:** Milestone 16.
- **Tasks:**
  1. Replace the current silent-cap behavior in "Receive Finished" with an explicit flag-for-owner-review when actual wastage exceeds the agreed cap.
  2. Build a Scrap & Unused Loose Stone Return receipt modal, linked to `StoneManager`'s existing Issue/Return flow.
- **Testable via:** Receiving a job with wastage above the cap surfaces a visible review flag instead of silently capping the deduction.

---

## 🏁 Phase 6: Multi-Branch (Milestones 19 – 20) — ✅ COMPLETE (2026-07-28)

### ✅ Milestone 19: Branch Master & Branch Switcher
- **Goal:** Introduce a real `Branch` entity and let the active branch be switched from the header.
- **Dependencies:** None beyond Milestone 1 (state-lifting pattern).
- **Tasks:**
  1. Add a `Branch` entity (`branchCode`, `gstin`, `stateCode`, `invoiceSeriesPrefix`, `defaultStockOwnershipType`), lifted state, seeded with 1–2 mock branches.
  2. Replace `Sidebar`/`Header`'s hardcoded "Mumbai BST"/"MUM-01" text with a real Branch Switcher dropdown.
  3. Filter Catalog/Stones/Job Bags by active branch; add branch-specific metal rate override.
- **Testable via:** Switching branches in the header changes which stock/rates are shown across Catalog/Stones/Job Bags.
- **Done:** `src/lib/branch.ts` + branch switcher in `Header.tsx`. Per decision **D-5**, Party (Customer/Karigar) and Metal/Purity masters are deliberately **not** branch-scoped — branch-scoping customers would break chain-wide loyalty and TCS aggregation. Legacy records without a `branchId` are attributed to the primary branch rather than vanishing. Also closes `KNOWN_ISSUES.md` #11(b): invoice numbering is now a per-GSTIN series, as GST Rule 46 requires, instead of one shop-wide sequence.

### ✅ Milestone 20: Inter-Branch Stock Transfer (IBST)
- **Goal:** Dispatch and receive Tag inventory between branches.
- **Dependencies:** Milestone 19, Milestone 3 (transfers move real `Tag` records).
- **Tasks:**
  1. Build an IBST screen: create transfer request → dispatch (Tag status → `TransferInTransit`) → receive & accept/reject at destination.
- **Testable via:** A dispatched tag disappears from the source branch's sellable stock and appears as "in transit" until received at the destination.
- **Done:** `src/lib/stockTransfer.ts` + `StockTransferPanel.tsx` (a fourth Catalog tab). Lifecycle `Draft → InTransit → Received | PartiallyReceived | Rejected`, with **per-piece** accept/reject at the destination and a mandatory refusal reason — partial receipt is the realistic case, since a consignment can arrive with one piece damaged. Decision **D-7** holds structurally: `TransferInTransit` is not a sellable state, so an in-flight piece is invisible to *both* branches and two counters can never sell the same ornament. Consignments are valued at metal + stones only (a branch transfer is a movement of goods, not a sale, so there is no value addition) and flagged for an e-Way Bill above the threshold — actual e-Way Bill generation is M22, per-state thresholds are M34.

---

## 🏁 Phase 7: GST Compliance (Milestones 21 – 23) — ✅ COMPLETE (2026-07-29)

### ✅ Milestone 21: Tax Master & HSN / CGST-SGST-IGST Split
- **Goal:** Replace the hardcoded flat 3% GST constant with a data-driven Tax Master and automatic intra-/inter-state split.
- **Dependencies:** Milestone 19 (needs `Branch.stateCode` to compare against customer state).
- **Tasks:**
  1. Add a `TaxRate[]` master (HSN 7113/7102/9988 rows with CGST/SGST/IGST) and a lookup replacing the hardcoded `0.03` in `billingCalculations.ts`. Keep the single composite-rate default behavior (per `HANDOFF.md` item 1, still unresolved pending CA sign-off) unless/until that question is explicitly resolved.
  2. Auto-determine CGST+SGST vs. IGST by comparing branch state to customer state.
- **Testable via:** Billing a customer in the branch's own state produces CGST+SGST; a different-state customer produces IGST; unit tests cover both.
- **Done:** `src/lib/taxMaster.ts` + a Tax Master tab on Billing. Rates are data with **effective-date versioning** (PRD §9.2 forbids hardcoding them), append-only like D-4 — a change supersedes the old row so a reprinted invoice resolves the rate it was billed at. CGST/SGST halves are derived so they sum to the tax charged exactly, never rounded independently, or GSTR-1 would not reconcile. Also implements PRD §7.3's **Round Off** line, which was in the spec's formula block but tracked in no milestone. The diamond 7102 split is deliberately defined-but-unapplied pending CA sign-off (`HANDOFF.md` §1). Fixed two Rule 46 defects found here: a hardcoded Mumbai GSTIN/address on every branch's invoices, and no HSN per line.

### ✅ Milestone 22: e-Invoice & e-Way Bill Simulation
- **Goal:** Model the e-Invoice/e-Way Bill data shape and UI states without a real government API integration (per the simulation-only ground rule in `.ai/IMPLEMENTATION_WORKFLOW.md`).
- **Dependencies:** Milestone 21.
- **Tasks:**
  1. Add an e-Invoice status badge on invoices (`PENDING`/`GENERATED`/`FAILED`, mock `irn` string) with a "Simulate Submission" action.
  2. Add an e-Way Bill auto-trigger UI stub for goods movement > ₹50,000.
- **Testable via:** Simulating submission flips the badge state and shows a mock IRN/QR placeholder.
- **Done:** `src/lib/eInvoice.ts`. The IRN is deterministic on the real portal's four inputs (GSTIN, doc type, doc number, FY) and 64-hex, so a retry after a timeout cannot double-register — the real IRP is idempotent the same way. Renders a genuine scannable QR of the payload rather than a placeholder box. The 24-hour cancellation window (PRD §9.4) is enforced from acknowledgement, after which the UI points at a credit note. `FAILED → PENDING` is legal, which is the retry queue §9.4 requires; `GENERATED → PENDING` is not. Also generates the actual e-Way Bill for the transfers M20 could only flag.

### ✅ Milestone 23: GSTR-1 / GSTR-3B Report Export
- **Goal:** Read-only preview tables for periodic GST returns.
- **Dependencies:** Milestone 21.
- **Tasks:**
  1. Build GSTR-1 & GSTR-3B preview tables computed from `invoices`, exportable as CSV client-side.
- **Testable via:** Exported CSV totals reconcile against the sum of the underlying invoices for the selected period.
- **Done:** `src/lib/gstReturns.ts` + a GST Returns tab. GSTR-1 tables 4A / 7 / 9B / 12 and GSTR-3B 3.1(a), with a reconciliation banner that states the difference when the return disagrees with the register. Credit notes are stored negative (so 3B nets automatically) but reported positive in GSTR-1's own table, because the portal applies the sign — filing them negative would double-subtract. B2B vs B2C is decided by the buyer's GSTIN, not transaction size; misfiling a registered buyer as B2C denies them input credit.

---

## 🏁 Phase 8: Hallmarking & Gold Savings Schemes (Milestones 24 – 27)

### ✅ Milestone 24: AHC Dispatch & HUID Assignment
- **Goal:** Real hallmarking dispatch/receive workflow assigning a genuine, unique HUID per tag.
- **Dependencies:** Milestone 4 (needs the `PendingHallmark`/`Hallmarked` states from the Tag state machine).
- **Tasks:**
  1. Build an AHC dispatch/receive batch UI: select `Tag[]` in `PendingHallmark`, dispatch, then receive assigns a 6-char `huid` (validated globally unique against all existing tags) and transitions to `Hallmarked`.
- **Testable via:** Assigning a HUID that collides with an existing one is rejected; a successfully hallmarked tag shows its real HUID (replacing the current hardcoded mock string) in Catalog.
- **Done:** `src/lib/hallmarking.ts` + a fifth Catalog tab. Uniqueness is enforced **globally across every tag** and *separately* within the batch being received — two pieces received together are not persisted yet, so a tag-level check alone would miss that collision. The AHC's **certified purity** is captured and compared to the declared fineness: a shortfall beyond measurement tolerance is flagged for karigar accountability (PRD §11.3), while over-delivery is reported but not treated as an integrity question, since conflating the two would bury the one that matters. **Required a state-machine edge**: `PendingHallmark` could only reach `Hallmarked` or `DamagedOrMelted`, so a failed piece had nowhere to go but the melting pot; it now returns to `ReceivedFromKarigar` for rework and can be re-submitted.

### ✅ Milestone 25: Non-Hallmarked Sale Prevention Guard
- **Goal:** Block billing of un-hallmarked gold items above the exemption threshold (PRD §11.4).
- **Dependencies:** Milestone 24.
- **Tasks:**
  1. `BillingEstimator.tsx` blocks adding a Tag to a bill if it requires hallmarking and has no `huid` (with a configurable exemption, e.g. sub-2g items).
- **Testable via:** Attempting to bill a non-exempt, non-hallmarked tag is blocked with a clear message; an exempt or already-hallmarked tag bills normally.
- **Done:** `src/lib/hallmarkGuard.ts`, wired as a checkout gate ahead of the PAN/tender checks (a piece that legally cannot be sold makes collecting a PAN pointless) plus a live banner while the bill is built, and a policy card on the Hallmarking tab. **Configurable, not absolute** — PRD §11.3 requires hard-block vs warn, since mandatory hallmarking is a *gold* regime (silver is voluntary, platinum separate), coins/bullion are not articles of jewellery, sub-threshold pieces are exempt, and a shop below the notified turnover is exempt entirely. **Detection is separate from enforcement**: violations are computed in every mode so a WARN-mode shop still reports its exposure honestly. A zero/missing weight does *not* earn the weight exemption — absent data is not a light piece. An ESTIMATE is never blocked (a quotation is not a supply); the guard re-applies on conversion.
- **Custom-line bypass closed (same day):** manually-typed lines are assessed from their own typed fields and can record their own HUID. "Add Custom Item Row" is one click away and defaults to Gold (22K), so skipping those lines left the whole guard bypassable by typing a piece in rather than scanning it. A catalogue line's HUID is shown **read-only** — it is laser-engraved by the AHC and must never be editable at the till. This also surfaced a Rule 46 gap: the post-checkout receipt (the customer's copy) was missing both the per-line HSN and the HUID, which M21/M25 had only added to the registry modal.

### ✅ Milestone 26: Gold Savings Scheme Master & Enrollment
- **Goal:** Support multiple configurable schemes instead of one hardcoded "Swarna Nidhi."
- **Dependencies:** Milestone 2 (Scheme Redemption already wired into billing).
- **Tasks:**
  1. Build a Scheme Master (tenure, bonus type, redemption rules) and an Enrollment modal in `CustomerManager.tsx`.
- **Testable via:** Creating a second, differently-configured scheme and enrolling a customer in it produces correct balance accrual independent of the original hardcoded scheme.
- **Done:** `src/lib/savingsScheme.ts` + a Gold Savings Schemes tab on Customers. **Balances are derived from append-only instalment receipts, never stored** (same pattern as M16 karigar balances and M48 rates) — a stored balance cannot answer "which instalments make this up", which is what a disputed passbook asks. The **maturity bonus accrues only when matured AND fully paid**; crediting earlier would overstate the shop's liability and let someone collect the contribution after one instalment. Dues count from the start date, so a customer who stopped in month 3 of 11 reads as 8 missed rather than idle.

### ✅ Milestone 27: Scheme Passbook & Cash-Refund Block Warning
- **Goal:** Printable passbook statement and an explicit legal compliance guard.
- **Dependencies:** Milestone 26.
- **Tasks:**
  1. Build a printable Passbook/statement view per enrollment.
  2. Add an explicit, visible cash-refund-block warning (citing the Banning of Unregulated Deposit Schemes Act, 2019) anywhere scheme balance handling is discussed in the UI — no cash-refund path exists today, but there's currently no visible compliance messaging explaining why (Handbook §1.6.1/D-11).
- **Testable via:** Printing a passbook produces a correct running balance; the warning text is visible on the scheme balance card.
- **Done:** Printable passbook with a per-instalment running balance and the shop's bonus as its own final row (folding it into the last instalment would hide the scheme's selling point). The BUIDS Act 2019 notice is a single shared constant (`CASH_REFUND_BLOCK_NOTICE`) so every surface states it identically, and appears on the panel and on each passbook. **There is deliberately no cash-out function anywhere in the module** — premature closure forfeits the bonus, deducts the penalty, and returns the residue as jewellery credit.

---

## 🏁 Phase 9: Accounting (Milestones 28 – 29) — ✅ COMPLETE (2026-08-01)

### ✅ Milestone 28: Accounting Ledgers & Auto-Journal Posting
- **Goal:** Auto-post double-entry journal entries behind every transaction.
- **Dependencies:** Milestone 2 (invoices), Milestone 16 (karigar labor payable), Milestone 14 (old gold purchase entries).
- **Tasks:**
  1. Implement `src/lib/journalPosting.ts` (unit-tested): every invoice/old-gold/karigar-receipt event posts a balanced `{debit, credit}` journal-entry pair.
  2. Build Chart of Accounts, Ledger Statement, and Day Book viewer screens.
- **Testable via:** Every posted journal entry balances (`Σdebit = Σcredit`); a Day Book total reconciles against the sum of the day's invoices.
- **Done:** `src/lib/journalPosting.ts` + an Accounting route with Day Book, Trial Balance, Ledger Statement and Chart of Accounts. Vouchers are **derived** from the documents, never stored, so the books cannot drift from the transactions (PRD §10.1) — re-deriving is idempotent and tested. Three rules are structurally respected: old gold posts its own purchase voucher and never contras Sales (**D-10**); scheme instalments credit a **liability, not income** (PRD §12.3); and a weight-only karigar entry posts **nothing**, keeping metal out of the money books (**D-2**).
- **Note on the reconciliation:** gross postings are *not* the day's sales value — a discounted sale debits Discount Given, so total debits exceed what the customer paid. `reconcileDayBook()` states what genuinely ties (income credited vs gross value of documents raised) and shows the discount that explains the difference, rather than leaving an owner to find two figures that were never meant to match.

### ✅ Milestone 29: Tally Prime Export
- **Goal:** One-click accounting sync export.
- **Dependencies:** Milestone 28.
- **Tasks:**
  1. Build a client-side Tally-compatible XML export button (no real Tally integration — a downloaded file, per the simulation-only ground rule).
- **Testable via:** Exported XML validates against Tally's expected schema shape for a sample period.
- **Done:** `src/lib/tallyExport.ts` + a Tally Export tab on Accounting. Three conventions that produce a plausible-but-wrong file if missed: **Tally's sign convention is inverted** (a DEBIT is a NEGATIVE amount with `ISDEEMEDPOSITIVE=Yes`), **dates are `YYYYMMDD`** with no separators, and **ledger names must be XML-escaped** — not hypothetical, since the seeded supplier is "Zaveri Bullion & Refinery Co." and a raw `&` makes Tally reject the whole import. Unbalanced vouchers are **excluded and reported**, never silently shipped, because Tally rejects an entire file if any voucher fails to balance.

---

## 🏁 Phase 10: Reports & Customer Insight (Milestones 30 – 31) — ✅ COMPLETE (2026-08-01)

### ✅ Milestone 30: Reports Hub
- **Goal:** Central `/reports` route covering the PRD §14.2–14.9 catalog.
- **Dependencies:** Milestone 28 (accounting-derived margin reports), Milestone 16 (Karigar Reconciliation), Milestone 3 (Inventory Ageing needs `Tag.createdAt`).
- **Tasks:**
  1. Build the Reports Hub shell plus all seven report families (PRD §14.2–14.9). **Expanded 2026-07-26** after the coverage audit — the original task list named only five reports and omitted the Purchase, Customer and Branch families entirely:
     - **Sales** — Daily Sales Summary, Gross Margin Realization, Sales Register
     - **Purchase** — Purchase Register, supplier-wise purchases, ITC-eligible summary (depends on Milestone 40)
     - **Inventory** — Stock Summary (item/purity-wise, weight & value), Ageing (>90/180 days), Tag-wise Stock Ledger, Physical Stock Discrepancy (PRD §5.6)
     - **Customer** — purchase history, Debtors Ageing, loyalty/tier distribution, PAN/Form-60 compliance exceptions
     - **Karigar** — Karigar Reconciliation, outstanding metal & labour, wastage performance
     - **Branch** — Branch Stock Comparison, Stock Transfer Register, branch-wise sales (depends on Milestone 19)
     - **Stock** — Memo/Approval Outstanding, stock movement register
     - **Audit** — Audit Log Viewer
  2. Because this is a large surface, deliver it incrementally family-by-family; each family is independently testable and can ship on its own.
- **Testable via:** Each report's totals reconcile against the underlying transactional state it's derived from.
- **Done:** `src/lib/reports.ts` + a `/reports` hub. The acceptance criterion is **executable**, not asserted — `reconcileReports()` runs five checks and the hub shows the result, so a mismatch is visible. Six families ship: Sales, Purchase, Inventory, Customer, Karigar, Branch. **Ageing needed `Tag.taggedOn`, which did not exist** — added as optional, and an undated tag reports as *unknown age, never new*, because defaulting to today would show zero old stock and hide the capital the report exists to find.
- **Not done:** the **Audit Log viewer**, stated on screen rather than faked. It needs the event store from M50 — the app reconstructs activity from current records rather than logging events as they occur, so a trail built on that would silently omit anything since deleted.
- **Note:** GST reports live separately — GSTR-1/3B in Milestone 23, ITC Register & HSN Summary in Milestone 52.

### ✅ Milestone 31: Customer 360 View
- **Goal:** A single consolidated customer profile view.
- **Dependencies:** Milestone 2 (purchase history from `invoices`).
- **Tasks:**
  1. Build a Customer 360 drawer in `CustomerManager.tsx`: purchase-history timeline, scheme status, loyalty tier.
- **Testable via:** Opening the drawer for a customer with existing invoices shows an accurate, chronologically-ordered history.
- **Done:** `Customer360Drawer.tsx`, opened from the customer row. History newest-first; lifetime value **net of returns with estimates excluded** but still listed, since a quotation is part of the story even though it is not revenue. Scheme position and masked Aadhaar included.

---

## 🏁 Phase 11: Admin, Security & Hardware (Milestones 32 – 36)

### ✅ Milestone 32: Admin Role & Permission Management
- **Goal:** A real (if cosmetic, per the frontend-only scope) role/permission matrix.
- **Dependencies:** Milestone 2.
- **Tasks:**
  1. Build a Role & Permission Management screen; gate UI affordances (not real security, since there's no backend) based on the logged-in mock user's role.
- **Testable via:** Logging in as a role with a permission removed no longer shows the corresponding UI control.
- **Done:** `src/lib/permissions.ts` + a Roles & Access screen, with login now offering a role so the matrix is observable. **It gates the interface, not the data** — stated in the code and on screen, because the failure mode is someone later treating a checkbox here as security. Three decisions: an **unknown role gets nothing** (defaulting to full access is how a permission system silently stops working); **at least one role must keep `admin.roles`**, or nobody can grant it back and the shop is locked out permanently; and gated screens are **hidden**, with a route guard so a typed URL bounces to the ungated Dashboard rather than rendering.
- **Note:** `billing.discount` and `billing.override` are separate on purpose — an override changes the calculated rate itself, which is why M10 logs a reason for it.

### ✅ Milestone 33: Supervisor PIN Approval Modal
- **Goal:** Require supervisor authorization for high-value overrides.
- **Dependencies:** Milestone 32, Milestone 10 (the override workflow it gates).
- **Tasks:**
  1. Build a Supervisor PIN modal, triggered by Milestone 10's override workflow for rate overrides/large discounts/invoice cancellations above a configurable threshold.
- **Testable via:** Attempting a large discount without the correct PIN is blocked; the correct PIN allows it through and logs who approved it.
- **Done:** `src/lib/statutoryParameters.ts` + `SupervisorPinModal`, gating checkout in `BillingEstimator`. Four decisions: **approval is not a permission** — M32 answers "may this person do it", this answers "was it authorised *this time*", so a manager who legitimately holds `billing.override` still needs a second pair of eyes on a large discount; **self-approval is refused**, which is the entire point of the mechanism; an approval **covers the amount it was given for and anything smaller**, so raising the discount afterwards re-opens the gate rather than riding on a sign-off for a lesser figure; and **only roles holding `billing.override` can be named as supervisors**, otherwise the sign-off is a signature rather than authority. The approval travels with the invoice (`SaleInvoice.approvals`, optional so older bills still load) as well as into the standing log.
- **Note:** PINs live in `localStorage` like everything else — they establish *who authorised this* for the audit trail, not secrecy. Said in the module header and on screen, for the same reason M32 says it.

### ✅ Milestone 34: Statutory Parameters Configuration Screen
- **Goal:** Make the PAN/TCS/PMLA thresholds data-driven instead of hardcoded.
- **Dependencies:** Milestone 8 (refactors the hardcoded ₹2,00,000 constant introduced there).
- **Tasks:**
  1. Build a single editable Statutory Parameters screen (PAN threshold, TCS threshold, PMLA CTR threshold); have Milestone 8's PAN modal read from it instead of a literal constant.
- **Testable via:** Changing the configured PAN threshold changes when the PAN modal triggers, without a code change.
- **Done:** A Statutory & Approvals tab on the admin screen, with `BillingEstimator`'s PAN gate reading the configured figure. Same argument as the Tax Master (M21) and Rate Master (M48): these are **policy, not arithmetic** — they move by notification, and a shop must be able to comply the same day rather than wait for a release. Verified in the browser by dropping the PAN threshold to ₹50,000 and watching a ₹66,568 invoice start demanding a declaration, with no code change.
- **Decisions:** an unconfigured threshold **falls back to the statutory default, never to zero** — zero would demand a PAN on every sale and stop the shop trading, a worse failure than the one the check guards against; validation refuses a zero PAN threshold outright and flags the likely PAN/TCS transposition; and the PMLA cash-transaction flag applies to the **cash component only**, because a ₹15,00,000 sale settled by bank transfer is not a cash transaction and flagging it would bury the genuine cases in noise.
- **Note:** `statutoryChecks.PAN_THRESHOLD` stays as the shipped default so `reports.ts` and `OldGoldManager` keep working unchanged; a test asserts the two never drift apart.

### ✅ Milestone 35: Digital Scale & Hardware Connection UI (Simulated)
- **Goal:** Cosmetic hardware-connection indicators, extending the existing Simulation Desk pattern.
- **Dependencies:** Milestone 1 (Simulation Desk).
- **Tasks:**
  1. Add Digital Scale / Thermal Printer "connection status" indicators + a mock "Fetch Weight" button to the Simulation Desk panel in `App.tsx`.
- **Testable via:** Toggling the simulated connection state updates the indicator; "Fetch Weight" populates a mock value into the active form field.
- **Done:** `src/lib/hardware.ts` + `HardwareContext` + a Peripherals panel on the Simulation Desk. Built beyond "cosmetic" deliberately: what is worth simulating is the **discipline of weighing**, because the failure modes are real money on gold. **An unsettled reading cannot be captured** — the pan swings and decays, and capture is refused until the last samples agree to within one division, the same reason an assistant waits for the beep. Connection is a **three-state machine** (a device mid-handshake is neither connected nor disconnected, and a capture against it must fail rather than block). A capture carries its **tare** and refuses a negative net, because weighing a piece in a tray and forgetting the tray is the commonest counter error. Readings quantise to 1 mg — finer is false precision.
- **Note:** The settling is deterministic given a seed, so the tests assert that a pan *settles* rather than hoping it does. Weight fields register themselves on focus (billing net weight, old-gold gross weight); the desk names the destination before firing, so nothing lands by surprise.

### ✅ Milestone 36: Offline POS Queue Sync UI (Simulated)
- **Goal:** Visualize an offline invoice queue and reconnect/sync behavior (still no real offline persistence layer — this is a frontend-only prototype).
- **Dependencies:** Milestone 1 (Simulation Desk's `forceOffline` toggle).
- **Tasks:**
  1. Add an Offline Queue Sync indicator + conflict-resolution drawer, driven by the existing `forceOffline` simulation toggle.
- **Testable via:** Enabling Force Offline and completing a "sale" queues it visibly; disabling offline mode shows it "syncing" and clearing from the queue.
- **Done:** `src/lib/offlineQueue.ts` + an Offline Sales Queue drawer, with the queue count on the desk badge. The storage half is free here (everything is already `localStorage`); the half worth building is **the invoice number**. Rule 46 requires a unique consecutive series per GSTIN, and an offline terminal cannot know another counter has taken the number it just used — so two bills come back bearing the same one. Three rules: a queued sale is **never dropped** (the customer already walked out with that bill; discarding it loses a real transaction and understates output GST), a conflict is resolved **only by renumbering**, and the **original number is kept** so the gap in the series explains itself to an auditor. Sync is **partial** — a clean bill lands even when another conflicts, because holding a good sale hostage leaves the books understated for as long as the conflict goes unresolved. Reconnecting drains the queue automatically; a counter that has to remember to press a button is a counter that leaves sales out of the books.
- **Defect found and fixed while building this:** `forceOffline` blanked *every* screen with the API-outage state, including Billing — which defeats the purpose of an offline queue, since a shop cannot tell a customer holding a chain to come back when the server is up. `/billing` is now exempt and shows an offline banner instead; every other screen is a read or a report that genuinely needs the server, so those still show the outage.

---

## 🏁 Phase 12: Procurement & Supplier (Milestones 37 – 41) — ✅ COMPLETE (2026-08-01)

_Added 2026-07-26. PRD §6.1 defines the full chain (Purchase Order → Goods Receipt → Purchase
Invoice → stock update) and §9.6 requires a Purchase Register for ITC reconciliation, but the
original roadmap never scheduled any of it. This was the largest coverage gap found._

### ✅ Milestone 37: Supplier Master (Party Master extension)
- **Goal:** Introduce Supplier as a real party type so purchases have someone to be booked against.
- **Dependencies:** None beyond Milestone 1 (state-lifting pattern).
- **Tasks:**
  1. Extend the party model with `Supplier` (name, GSTIN, PAN, state code, opening balance, credit terms). Per Handbook D-5, Party Master is tenant-wide and must **never** carry a `branch_id`.
  2. Add PAN/GSTIN/Aadhaar/KYC fields to `Customer` at the same time — PRD §4.3 requires them and they are currently absent from the type entirely.
- **Testable via:** A supplier can be created and selected on a purchase document; a customer record round-trips its GSTIN/PAN.
- **Done:** `src/lib/supplier.ts`. A GSTIN **encodes** the state code (chars 1–2) and the PAN (chars 3–12), so those are cross-checked and auto-derived rather than typed twice. A state contradicting the GSTIN is the dangerous case: M21 picks CGST+SGST vs IGST from it, so a mistype misfiles tax on every document for that party and stays invisible until filing. A bullion dealer must be registered, since ITC cannot be claimed without a supplier GSTIN. `Customer` also gained the PAN/Aadhaar/KYC fields PRD §4.4 requires; Aadhaar is masked on display.

### ✅ Milestone 38: Purchase Order
- **Goal:** Raise and track POs to bullion dealers / finished-goods suppliers.
- **Dependencies:** Milestone 37.
- **Tasks:**
  1. PO entry (supplier, expected metal/purity/weight or design lines, rate basis, delivery date) with its own `PO-<FY>` sequence and a `Draft → Sent → PartiallyReceived → Closed → Cancelled` status.
- **Testable via:** A PO can be raised, then referenced when receiving goods; receiving part of it moves it to PartiallyReceived rather than Closed.
- **Done:** `src/lib/purchaseOrder.ts`. **Unfixed-rate orders return `null`, not 0** — bullion is commonly booked now and priced later, so such an order has a weight but no knowable value; zero would understate the commitment and today's rate would be a guess dressed as a fact. A fully-received PO does **not** auto-close (closing is a decision), and over-receipt is flagged rather than clamped because bullion genuinely arrives heavy.

### ✅ Milestone 39: Goods Receipt (GRN)
- **Goal:** Receive physical metal/goods against a PO (or without one), capturing real weight and tested purity.
- **Dependencies:** Milestone 38; Milestone 3 (a finished-goods receipt must create real `Tag` records).
- **Tasks:**
  1. GRN entry capturing gross/net weight and **tested** purity per line, with a variance flag when received weight/purity differs from the PO.
  2. On save: raw metal increments the metal register; finished goods create `Tag` records entering the lifecycle at the appropriate state via the Milestone 4 state machine.
- **Testable via:** Receiving finished goods against a PO produces the right number of real Tags; a purity variance is surfaced, not silently accepted.
- **Done:** `src/lib/goodsReceipt.ts`. **Tested purity vs contracted purity is money**: 100g at 99.9% delivered at 99.5% is 0.4g of fine gold ≈ ₹2,900, surfaced live in grams and rupees. Tolerance is 0.05 points, tighter than hallmarking's 0.2, because bullion is bought *to* a spec. Received goods **enter the lifecycle**: raw metal at `RawMetal` (a state nothing had ever produced), finished goods at `PendingHallmark` unless supplier-hallmarked — entering at `InStock` would bypass the M25 guard. Each piece is weighed individually (D-6).

### ✅ Milestone 40: Purchase Invoice & ITC Booking
- **Goal:** Book the supplier's tax invoice and record claimable Input Tax Credit.
- **Dependencies:** Milestone 39; Milestone 21 (needs the Tax Master for correct input-tax rates).
- **Tasks:**
  1. Purchase Invoice entry linked to a GRN, splitting taxable value and input CGST/SGST/IGST, stored as ITC receivable.
  2. Add an **RCM (Reverse Charge)** flag for notified services from unregistered suppliers — PRD §9.7 requires this recorded separately, since the shop pays the GST itself and then claims it.
- **Testable via:** A booked purchase invoice appears in the Purchase Register with its ITC split; an RCM-flagged invoice is distinguishable from a normal one.
- **Done:** `src/lib/purchaseInvoice.ts`. **Reverse charge posts two legs** — an output liability and an input credit — which net to zero in cash, and that is exactly why booking only the credit is the inviting mistake: the books balance while the shop under-declares tax it owes. Both are shown before committing and reported separately. A supplier's invoice number is *theirs*, so a repeat of (supplier, their number) is refused — booking it twice claims the same credit twice. Supply type compares the **supplier's** state to the branch's, the mirror of M21.

### ✅ Milestone 41: Purchase Return / Debit Note
- **Goal:** Return goods to a supplier and issue a debit note reversing the purchase and its ITC.
- **Dependencies:** Milestone 40; Milestone 12 (mirrors the credit-note reversal already built for sales).
- **Tasks:**
  1. Purchase Return against a booked purchase invoice, with its own `DBN-<FY>` sequence, reversing stock and ITC proportionally — reuse `salesReturn.ts`'s pro-rata approach rather than re-deriving it.
- **Testable via:** A full purchase return nets the purchase and its ITC to zero; a partial return reverses proportionally.
- **Done:** `src/lib/purchaseReturn.ts`. Reuses `salesReturn.ts`'s **cumulative** share derivation, so successive partial returns reverse exactly the credit claimed — 3333+3333+3334 against a ₹10,000 purchase reverses ₹300, not ₹299. Reversal goes back into the **same heads** it was claimed under (an IGST claim cannot be reversed as CGST+SGST). **Required a new terminal Tag state, `ReturnedToSupplier`** — the only terminal state was `DamagedOrMelted`, and recording goods sent back to a dealer as goods destroyed is false in the stock ledger and wrong in the valuation.

---

## 🏁 Phase 13: Inventory Operations (Milestones 42 – 44) — ✅ COMPLETE (2026-08-03)

### ✅ Milestone 42: Stock Adjustment & Write-Off Voucher
- **Goal:** A controlled, reason-logged way to correct stock or write off damaged/lost pieces.
- **Dependencies:** Milestone 4 (drives the `DamagedOrMelted` transition), Milestone 10 (reuses the reason-log pattern).
- **Tasks:**
  1. Stock Adjustment voucher: select Tags, choose a reason (damaged / lost / shrinkage / correction), require a logged reason, and transition through the state machine — never by direct status assignment.
- **Testable via:** Writing off a Tag requires a reason and moves it to `DamagedOrMelted`; it leaves sellable stock and stock valuation.
- **Done:** `src/lib/stockAdjustment.ts` + an Adjustments tab on the new Inventory Ops screen. **Writing off is not deleting** — the tag moves through the state machine to `DamagedOrMelted` and the record stays, because erasing the piece would erase the loss it exists to document. The rule is **ITC reversal**: GST s.17(5)(h) blocks input tax credit on goods lost, stolen or destroyed, so credit claimed on a written-off piece must be reversed — **but a book correction is not a destruction**, and reversing there would hand back money the shop is entitled to keep. `requiresItcReversal` is therefore per reason, not per voucher, and it is tested both ways.
- **Decisions:** only pieces the shop physically holds can be adjusted (a `Sold` piece is not ours, a piece in transit is the other branch's to account for, an already-written-off piece would double-count the loss); the note must be a real sentence, on the same argument as M10's override reason; and valuation **includes making charge**, unlike a branch transfer, because a write-off is a real loss and the making already spent is lost with it.

### ✅ Milestone 43: Melting Workflow
- **Goal:** Convert old gold and damaged/unsold tags back into raw metal stock (PRD §6.3).
- **Dependencies:** Milestone 15 (old-gold lots), Milestone 42 (damaged tags).
- **Tasks:**
  1. Melting batch: select old-gold lots and/or damaged Tags, record input gross weight, expected vs. actual recovered fine weight, and melting loss; output increments raw metal stock.
- **Testable via:** A melt batch's recovered fine weight plus recorded loss reconciles against the input weight; melted Tags leave sellable inventory permanently.
- **Done:** `src/lib/melting.ts` + a Melting tab. Three rules carry it. **You cannot get more gold out than went in** — a recovery above the input is refused outright rather than booked as a gain, because silently accepting it would create metal from nothing and corrupt every valuation downstream. **Loss is derived, never typed** (`input − recovered`), so a batch reconciles by construction rather than by someone entering two numbers that happen to agree. And **melting destroys identity**: the output raw-metal tag is created with no HUID, because that number certified an ornament that no longer exists and carrying it forward would attach a BIS certification to metal never assayed in this form.
- **Decisions:** excess loss beyond 5% is **flagged for review, not blocked** — a genuinely bad melt happens and the shop needs it visible, the same pattern as excess wastage on job work (M18); recovery is split across lots **in proportion to the fine metal each contributed**, since splitting evenly would credit a 60%-purity lot the same as a 92% one; and because a written-off piece and an already-melted one share `DamagedOrMelted`, **batch history rather than status** decides what can still go in the crucible.
- **Bug caught by the typechecker:** `purityOfMetal` read every non-karat mark as 92.5%, which would have understated the fine content of every `Silver (999)` melt. Karats and parts-per-thousand are different notations and are now parsed as such.

### ✅ Milestone 44: Inventory Dashboard
- **Goal:** A dedicated inventory-analytics landing screen, distinct from the main sales dashboard.
- **Dependencies:** Milestone 4, Milestone 6, Milestone 13.
- **Tasks:**
  1. Stock-by-purity/category weight & value tiles, lifecycle-state distribution, ageing buckets (>90/180 days), GML/consignment exposure, and the last audit's discrepancy summary.
- **Reference design:** `docs/stitch_jewelry_management_suite/.../inventory_valuation_summary/`, `.../stock_ageing_velocity_analysis/`.
- **Testable via:** Every tile reconciles against the underlying `Tag[]` state; selling a piece updates it without a reload.
- **Done:** `src/lib/inventoryDashboard.ts` + the Inventory Dashboard tab. **"Stock" is deliberately not one number:** a piece on memo is the shop's asset but unsellable today, a piece in transit is on neither branch's floor, and financed GML/consignment stock sits on the shelf without belonging to the business — rolling those together produces a figure that is wrong for every question anyone actually asks. The tiles separate sellable, held-not-sellable, financed and owned. Ageing covers **everything on hand**, not just the sellable slice `reports.inventoryAgeing` reports, because metal sitting with a karigar for eight months is exactly the capital worth surfacing. Undated pieces stay in their own bucket and are excluded from the slow-moving figure rather than counted as new.
- **`reconcileInventory()`** makes the milestone's criterion executable — five checks shown on screen, so the page proves it ties to `Tag[]` rather than asserting it.

---

## 🏁 Phase 14: Accounting Depth (Milestones 45 – 47) — ✅ COMPLETE (2026-08-01)

_Added 2026-07-26. Milestone 28 covers auto-posted journals, the Chart of Accounts, the Ledger
Statement and the Day Book — but PRD §10.5 and §14.7 also require manual voucher entry and the
three statutory financial statements, which were never scheduled._

### ✅ Milestone 45: Payment / Receipt / Contra Vouchers
- **Goal:** Manual voucher entry for money movements that aren't a sale or a purchase.
- **Dependencies:** Milestone 28 (posts through the same journal engine).
- **Tasks:**
  1. Payment (money out), Receipt (money in) and Contra (cash↔bank transfer) voucher screens, each posting a balanced double-entry pair via `journalPosting.ts`.
  2. Support the contra-style "Stock with Karigar" sub-ledger treatment noted in PRD §10.3.
- **Testable via:** Every voucher posts `Σdebit = Σcredit`; a contra entry moves value between cash and bank without touching P&L.
- **Done:** `src/lib/manualVoucher.ts`. Posts through the **same** journal engine as M28, so the books are one set of records. A Contra is restricted to cash↔bank on **both** legs — allowing an income or expense account there would turn a movement that changed nothing into profit or loss, so "a contra never touches P&L" is structural rather than conventional. The reverse is caught too: a cash↔bank move booked as a Payment is redirected. Narration is mandatory, since a manual voucher has no source document and it is the only audit trail.

### ✅ Milestone 46: Cash Book & Day Book
- **Goal:** Chronological cash/bank movement views for daily closing.
- **Dependencies:** Milestone 45.
- **Tasks:**
  1. Cash Book (cash/bank running balance) and Day Book (all vouchers for a date), both with opening/closing balance reconciliation.
- **Testable via:** The Cash Book's closing balance equals opening plus the day's receipts minus payments; the Day Book total reconciles against the day's invoices.
- **Done:** `buildCashBook()` in `src/lib/financialStatements.ts`. The **opening balance carries everything posted before the window** — a book that restarts at zero each period would show a closing balance with nothing to do with what is in the drawer. The reconciliation is asserted and displayed, not assumed. (The Day Book itself landed in M28.)

### ✅ Milestone 47: Trial Balance, P&L & Balance Sheet
- **Goal:** The three statutory financial statements (PRD §10.5, §14.7).
- **Dependencies:** Milestone 28, Milestone 45.
- **Tasks:**
  1. Trial Balance (all ledger balances, must tie), Profit & Loss, and Balance Sheet, all derived from posted journal entries — never hand-computed.
  2. Use PRD §10.4's stock valuation basis (at-cost vs at-market) consistently for the closing-stock figure.
- **Testable via:** The Trial Balance's debit and credit columns are equal; the Balance Sheet balances; P&L closing stock matches the inventory valuation on the same date.
- **Done:** `buildProfitAndLoss()` and `buildBalanceSheet()`. **The Balance Sheet balances only because the P&L result is carried into it** as retained earnings — since every voucher balances, `Assets − Liabilities = Income − Expenses = Net Profit`. Omitting it leaves the sheet out by exactly the profit, and the instinct is then to plug the gap, burying the cause; `isBalanced` is therefore checked and reported. Two distinctions kept apart: the **P&L is periodic**, the **Balance Sheet cumulative** (so retained earnings carries every prior period), and **GST collected is a liability, never income**.
- **Not done:** the PRD §10.4 at-cost vs at-market closing-stock valuation. Stock movements are not yet costed into the ledger, so the closing-stock figure that task asks for has nothing to draw on — it belongs with the inventory valuation work (M44), not here.

---

## 🏁 Phase 15: Masters & Admin Depth (Milestones 48 – 53) — ✅ COMPLETE (2026-08-03)

### ✅ Milestone 48: Rate Master Screen & Append-Only Rate History — done 2026-07-29, pulled forward
- **Goal:** A real Rate Master with versioned history, replacing the Dashboard's in-place inline edit.
- **Dependencies:** None beyond Milestone 1. **The current inline-edit behaviour violates decision D-4, so this is higher priority than its number suggests.**
- **Tasks:**
  1. Append-only `rate_versions` model (`effective_from`, `set_by`, `override_reason`) — no code path may ever mutate a historical rate row (D-4).
  2. Rate Master screen: current rate per metal/purity, full history, and a fat-finger guard requiring confirmation when a new rate deviates >2–5% from the previous one (PRD §4.2).
  3. Auto-derive 22K/18K from the 24K base rate, with a manual per-purity override.
- **Testable via:** Editing a rate creates a new version rather than overwriting; an old invoice still resolves the rate version it was billed at; a 20% rate jump is blocked pending confirmation.
- **Done:** `src/lib/rateMaster.ts` + rate history on the Dashboard rate cards. `effectiveFrom` is a full **timestamp**, not a date, because gold moves intraday and same-day rates must still order deterministically. The fat-finger guard sits at **5%** — the outer bound of PRD §4.2's 2–5% range, deliberately, because gold genuinely moves a few percent daily and a tighter default would train staff to click through the warning. Past it a written reason is mandatory; beyond 50% the message names a misplaced decimal point specifically. It never hard-blocks: a real spike must remain recordable. `MetalRate` is now **projected** from the versions (same pattern as M16's derived karigar balances), so every existing screen consumes it unchanged, and `history24h` — previously a decorative array — is now the real recorded versions. Purity derivation from the 24K base is a **suggestion, never applied**: a shop's counter rate absorbs local premium (seed is 7250/6650 where derivation gives 6648), so overwriting it with arithmetic would change what customers are charged.

### ✅ Milestone 49: User Management
- **Goal:** Create/edit/deactivate operator accounts — distinct from *defining* roles (Milestone 32).
- **Dependencies:** Milestone 32 (roles must exist before users can be assigned to them).
- **Tasks:**
  1. User list plus a create/edit drawer (name, role, branch, PIN, active flag), with deactivate-not-delete so audit history stays intact.
- **Testable via:** A deactivated user can no longer be selected as an operator, but their past transactions still resolve their name.
- **Done:** `src/lib/users.ts` + an Operators tab on the admin screen. **Deactivate, never delete** — removing a user would orphan every document they touched, so `isActive` gates *selection* while `resolveUserName()` deliberately resolves inactive users too. That asymmetry is the design. Administration can never be orphaned: deactivating the last active administrator is refused, with the message naming what to do instead.
- **Closes the Milestone 33 seam.** M33 shipped its own list of supervisor names and PINs because no user master existed. That list is now **derived** via `supervisorsFromUsers()` — only active users whose role holds `billing.override` — so a person's PIN and their authority to approve cannot drift apart. Verified in the browser: deactivating an operator removed them from the supervisor roster in the same action.

### ✅ Milestone 50: Notification Center & Activity Feed
- **Goal:** Replace `Header.tsx`'s hardcoded notification dropdown with a real event-driven feed.
- **Dependencies:** Milestone 13 (which establishes a real recent-events source).
- **Tasks:**
  1. An event/notification store any screen can push into, plus the `Toast` primitive flagged as missing in `CURRENT_PROGRESS.md` §3.6.
  2. Notification Center (unread/read, per-category) and an Activity Feed of real state changes.
- **Testable via:** Completing a sale, receiving stock, or writing off a Tag each push a real notification that appears without a reload.
- **Done:** `src/lib/notifications.ts` + `NotificationContext` + the `ToastStack` primitive flagged as missing in `CURRENT_PROGRESS.md` §3.6. `Header.tsx`'s hardcoded three-item array is gone; the dropdown now renders real events. Three rules: notifications are **append-only** (reading only flips `read`); the cap **never evicts an unread event to make room** — a busy afternoon of sales must not push out the one notification saying a bill failed to sync, so read events are evicted first; and the panel sorts **unread, then severity, then recency**, because it exists to surface what needs attention rather than to be a chronological log.
- **Wired to real state changes:** a completed sale, a sale queued offline, a sync conflict, a stock write-off, a melt batch, and a supervisor approval. A CRITICAL toast has no auto-dismiss — a failed sync must not scroll past unnoticed.

### ✅ Milestone 51: System Health & Diagnostics Panel
- **Goal:** An honest status surface for a frontend-only prototype: storage, sync and peripheral state.
- **Dependencies:** Milestone 35, Milestone 36 (extends the Simulation Desk).
- **Tasks:**
  1. `localStorage` usage/quota, last-backup timestamp, simulated API/offline state, peripheral connection status, and app/build version.
- **Testable via:** Filling storage or toggling Force Offline is reflected accurately; nothing on the panel is a hardcoded placeholder.
- **Done:** `src/lib/systemHealth.ts` + a System Health tab. The criterion was that **nothing is a hardcoded placeholder**, which is the whole reason it is worth building: a status panel that lies is worse than none, because it is believed. Storage is summed from the actual keys (counting UTF-16 code units *and* the key, since `value.length` alone under-reports by roughly half); the quota comes from `navigator.storage.estimate()` where the browser offers one and is **labelled as assumed** when it does not; the version and build stamp are injected by Vite's `define` rather than typed into a constant.
- **Honest about what it cannot claim:** there is no server, so the API rows describe the simulation and say so. Never having exported a backup is reported as CRITICAL — with no backend, clearing site data destroys everything with no copy — and the panel offers the export that fixes it.

### ✅ Milestone 52: ITC Register & HSN Summary Reports
- **Goal:** The two GST reports PRD §9.6 requires beyond GSTR-1/3B.
- **Dependencies:** Milestone 40 (ITC is booked at purchase), Milestone 21 (HSN comes from the Tax Master).
- **Tasks:**
  1. ITC Register (input tax by supplier/invoice, for GSTR-2B reconciliation) and HSN Summary (GSTR-1 Table 12 shape), both CSV-exportable.
- **Testable via:** The ITC Register total equals the sum of input tax on booked purchase invoices; the HSN Summary's taxable values reconcile against the sales register for the period.
- **Done:** `src/lib/gstRegisters.ts` + a GST Registers tab, both CSV-exportable. **Credit claimed is not credit retained**, and a register showing only the claim side overstates entitlement: blocked credit (s.17(5)) is separated, and **stock written off under Milestone 42 carries its reversal onto this register** — s.17(5)(h) blocks credit on goods destroyed, and leaving it off is how a shop ends up claiming credit it has already forfeited. Reverse-charge rows are flagged because a reader reconciling against GSTR-2B will not find them there.
- **The HSN Summary is Table 12 shape:** credit notes are **netted in rather than listed separately**, since a return reduces the period's outward supply and gross figures would not reconcile against the GSTR-1 actually filed; estimates are excluded entirely. Invoice-level tax is split across lines in proportion to taxable value, because Table 12 reports per HSN while the stored tax sits at invoice level.
- **`reconcileRegisters()`** makes both criteria executable. Running it against the seed data immediately flagged a real Rule 46 gap: a pre-M21 invoice line carries no HSN.

### ✅ Milestone 53: Old Gold Buyback Dashboard
- **Goal:** An analytics view over old-gold intake, distinct from the transactional voucher.
- **Dependencies:** Milestone 14, Milestone 15, Milestone 43.
- **Tasks:**
  1. Intake weight/value by period and purity band, average tested vs. claimed purity, melting-loss trend, and current vault holdings by state (`In Safe`/`Melted`/`Fine Gold Stock`).
- **Testable via:** Every figure reconciles against the underlying old-gold lots; raising a new buyback voucher updates it without a reload.
- **Done:** `src/lib/buybackDashboard.ts` + a Buyback tab. The metric that earns the screen is **claimed versus tested purity** — a customer brings in a chain they believe is 22K and it assays at 78%, which is where disputes happen and where an under-tested lot quietly loses money. Two rules: a lot with **no recorded claim is excluded from the average**, never treated as agreeing with the test (folding them in at parity would drag the gap toward zero and hide exactly what the metric shows), and the gap reads **tested − claimed**, so worse-than-claimed is negative — the direction that costs money.
- **`OldGoldVoucher.claimedPurityPercent`** was added as an optional field to carry this, with a capture input on the buyback form. Optional because vouchers predate it, and absent is reported as "not recorded" rather than assumed.
- **Melting loss is tracked against lots actually melted**, not all intake: a lot still in the safe has no loss yet, and averaging it in as zero would understate real refining loss. `reconcileBuyback()` ties every figure back to the lots, including a check that net payable weight never exceeds gross — paying for more metal than came through the door would mean a valuation bug upstream.

---

## 🏁 Phase 16: Full-Product Gaps (Milestones 54 – 61) [ADDED 2026-08-04]

_Eight gaps identified when planning the SaaS product. The first five are things a real shop hits
weekly and the app currently cannot do at all; the last three are integration and engagement work.
M60 and M61 stay **simulated** until the backend exists — they need credentials and a server, and
saying otherwise would repeat the mistake M22/M35/M36 were careful to avoid._

### ✅ Milestone 54: Repair & Service Jobs
- **Goal:** Take in a customer's own piece for repair, track it, and give it back.
- **Dependencies:** Milestone 16 (karigar ledger), Milestone 4 (state machine pattern).
- **Tasks:**
  1. Repair intake voucher: customer, item description, gross weight in, reported fault, quoted charge, promised date. Lifecycle Received → Assessed → WithKarigar → Ready → Delivered, plus ReturnedUnrepaired.
  2. Weight reconciliation on delivery (weight out vs weight in, metal added or removed).
- **Testable via:** A repair item never appears in stock valuation or sellable stock; delivering without recording weight out is refused.
- **Critical rule:** the item is the **customer's property held in custody**, not shop stock. It must never touch inventory valuation — booking it as an asset overstates the balance sheet and is the mistake generic POS software makes here.
- **Done:** `src/lib/repairJob.ts` + a Repairs & Service screen. **The piece is the customer's property held in custody, never shop stock** — a repair job creates no Tag, so it can never enter inventory valuation, be sold, or distort the daily weight reconciliation (D-2). That is the mistake generic retail POS makes here and it is expensive to unwind. The custody weight is reported as a disclosure, labelled as such on screen.
- **Weight in must reconcile with weight out.** Intake refuses to record a piece without weighing it in front of the customer, because that reading is the only thing a return can be checked against and the shop's only defence in a dispute. Delivery refuses a shortfall beyond 50 mg with the difference named, rather than absorbing it — unexplained metal loss is where disputes and pilferage both live. Metal the shop supplied stays a separate figure from the labour charge, since goods and services are taxed differently.
- **Lifecycle:** Received → Assessed → WithKarigar → Ready → Delivered, with ReturnedUnrepaired reachable from any pre-delivery state, because a shop can always judge a piece not economically repairable.

### ✅ Milestone 55: Customer Orders & Advances
- **Goal:** Take an order for a piece that does not exist yet, against an advance.
- **Dependencies:** Milestone 17 (job work), Milestone 26 (advance-as-liability pattern), Milestone 28 (posting).
- **Tasks:**
  1. Order: customer, design/specs, agreed weight range, **rate basis (fixed at order vs at delivery)**, advance received, expected delivery, status.
  2. Conversion to a tax invoice on delivery, with the advance applied and any rate difference settled.
- **Testable via:** An advance posts as a liability, never as income; converting the order applies it exactly once and the order cannot be converted twice.
- **Critical rule:** **rate basis must be explicit and recorded at order time.** Gold moves daily, and "what rate did we agree" is the single most common customer dispute in Indian jewellery ordering.
- **Done:** `src/lib/customerOrder.ts` + a Customer Orders tab, sharing the Orders & Repairs screen with M54 because both are the same situation from the counter's view — a customer waiting, with the shop holding either their money or their property.
- **The advance is a liability, never income.** Money taken before goods are supplied is the customer's, held by the shop; booking it as revenue recognises a sale that has not happened and creates tax on unearned money. Same treatment as scheme instalments (M26). An advance beyond the order's value is refused outright, because past that point it stops being an advance and becomes a deposit the shop must return — the territory D-11 flags for savings schemes.
- **Rate basis is mandatory and explicit.** `FIXED_AT_ORDER` locks the rate and the shop absorbs any rise; `AT_DELIVERY` prices at the market rate and the customer carries the risk. Neither is more correct — leaving it unrecorded is what causes the argument when gold has moved between order and delivery. An at-delivery order stores `null`, never `0`, since zero would read as "locked at nothing" and price the piece free.
- **Conversion happens exactly once**, guarded by the presence of the invoice number rather than by status alone: without it a double-click at the counter bills the customer twice and applies the advance twice. Cancellation keeps the advances on the record and adds a refund — a refund is a new fact, not the erasure of an old one.

### ✅ Milestone 56: Approval / Memo-Out Workflow
- **Goal:** Let a piece leave the shop on approval and make sure it comes back.
- **Dependencies:** Milestone 4 (the `MemoOut` status already exists but has no workflow), Milestone 8 (KYC).
- **Tasks:**
  1. Memo voucher: pieces, customer, taken-by, due-back date, declared value; return, convert-to-sale, or mark overdue.
  2. Overdue register with value at risk, and a KYC requirement above a configurable value.
- **Testable via:** Issuing a memo moves the tags out of sellable stock without removing them from the shop's assets; an overdue memo is visible with its value at risk.
- **Critical rule:** memo stock is **still the shop's asset** but not sellable to a walk-in — the one case where "in stock" and "sellable" genuinely differ, which `inventoryDashboard.ts` already separates.
- **Done:** `src/lib/memoOut.ts` + a Memo / Approval tab on Inventory Ops. The `MemoOut` status and its `InStock → MemoOut → {InStock, Sold}` transitions already existed from M4; what was missing was the workflow around them — who took it, when it is due, what it is worth, and what happens when it does not come back.
- **Memo stock is still the shop's asset.** This is the one case where "in stock" and "sellable" genuinely differ, and it is why `inventoryDashboard.ts` separated those ideas in M44. The mirror image is a repair (M54): the customer's property held by the shop rather than the shop's property held by the customer — neither belongs in sellable stock, and they sit on opposite sides of the balance sheet.
- **A due-back date is mandatory.** Without one nothing is ever overdue, and a piece that never returns becomes shrinkage rather than an exception. Above ₹1,00,000 an ID reference is required, because handing over lakhs of gold against a phone number is not a controlled risk — a shop-policy control, so the threshold is data rather than a constant.
- **Status is derived from the lines, never stored**, so a partly-returned memo cannot disagree with itself. A piece already out on an open memo cannot go out again. Conversion rate — of everything settled, how much sold — is the number that tells an owner whether letting stock out is earning its risk.

### 📍 Milestone 57: Customer Credit & Receivables Ageing
- **Goal:** Sell on credit safely and know who owes what, for how long.
- **Dependencies:** Milestone 2 (billing), Milestone 33 (approval), Milestone 45 (receipt vouchers).
- **Tasks:**
  1. Enforce `creditLimit` at checkout; a sale that breaches it needs supervisor approval.
  2. Receivables ageing (0–30/31–60/61–90/90+), receipt allocation against invoices, and a collection follow-up list.
- **Testable via:** A credit sale beyond the limit is blocked pending approval; a receipt reduces the oldest invoice first and the ageing buckets move accordingly.
- **Critical rule:** allocation must be **explicit and recorded**, not implied by dates. "Which bill did this payment settle" has to survive an audit.

### 📍 Milestone 58: Salesperson Attribution & Incentives
- **Goal:** Know who sold what, and what they earned for it.
- **Dependencies:** Milestone 2 (invoices), Milestone 49 (operators).
- **Tasks:**
  1. Record `salespersonId` on an invoice, separate from who operated the till.
  2. Configurable incentive basis (percentage of making charges, per gram, or flat per sale) with a per-person statement.
- **Testable via:** Two staff on one terminal produce correctly attributed sales; changing the incentive scheme does not alter what past sales already earned.
- **Critical rule:** incentive earned is **snapshotted at sale time**, never recomputed. A scheme change must not silently rewrite last quarter's payouts.

### 📍 Milestone 59: Loyalty Points Engine
- **Goal:** Make the existing `tier`/`loyaltyPoints` fields mean something.
- **Dependencies:** Milestone 31 (Customer 360), Milestone 28 (posting).
- **Tasks:**
  1. Earning rules, redemption with a per-bill cap, expiry, and tier progression.
  2. Points ledger per customer, append-only.
- **Testable via:** Points earn on a sale, redeem against a later bill, and expire on schedule; the ledger always explains the balance.
- **Critical rule:** **points earn on making charges and stone value, never on metal value.** Metal value moves with the gold rate, so rewarding a percentage of it gives away real gold whenever the rate rises — the shop's margin is in the making, and that is what a loyalty scheme can afford to share.

### 📍 Milestone 60: e-Invoice / e-Way Bill — Integration-Ready
- **Goal:** Take Milestone 22's simulation to the shape a real GSP integration needs.
- **Dependencies:** Milestone 22, Milestone 21 (Tax Master).
- **Tasks:**
  1. Model the real IRN request/response, the signed QR payload, the 24-hour cancellation window, and error/retry handling with idempotency.
- **Testable via:** A cancellation attempted after 24 hours is refused with the statutory reason; a failed submission is retryable without duplicating the IRN.
- **Still simulated:** no GSP credentials and no server exist yet. This milestone makes the *shape* correct so wiring a real GSP later is configuration, not a rewrite.

### 📍 Milestone 61: Outbound Notification Channels (WhatsApp / SMS)
- **Goal:** Reach the customer, not just the operator.
- **Dependencies:** Milestone 50 (the event store already exists).
- **Tasks:**
  1. Channel abstraction over the M50 event store, message templates (order ready, scheme instalment due, rate alert, memo overdue), per-customer consent, and a delivery log.
- **Testable via:** A customer with no recorded consent is never queued for a message; a template renders with the right values and the delivery log records the outcome.
- **Critical rule:** **consent is per channel and must be recorded.** Indian SMS requires DLT-registered templates and WhatsApp requires opt-in; sending without either is a compliance failure, not a delivery failure.
- **Still simulated:** dispatch is logged, not sent, until the backend holds the provider credentials.
