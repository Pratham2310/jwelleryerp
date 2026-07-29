# TODO.md — Development Roadmap & Milestone Backlog

_Last updated: 2026-07-29 — **Milestones 1–25 and 48 complete; Phases 1–7 all done, Phase 8 in progress** (see `CHANGELOG.md`). M48 (Rate Master) was pulled forward out of Phase 15, closing the last standing decision **D-4** violation — both the Tax Master (M21) and the Metal Rate Master are now append-only. Milestone 26 (Gold Savings Scheme master) is next. The BIS hallmarking pair (M24 + M25) is complete: HUIDs are assigned through a real AHC register and a non-compliant piece can no longer be billed. **Roadmap extended to 53 milestones** after a client-supplied module list was audited against the PRD — see the Coverage Audit table below; Phases 12–15 (M37–M53) are new. Restructured into single-feature, independently-testable milestones (34 milestones, M3–M36), ordered strictly by dependency. Milestones 1 & 2 are unchanged and already complete (see `CHANGELOG.md`). Every milestone below traces back to a specific gap identified in `CURRENT_PROGRESS.md` §3 / `MODULE_STATUS.md`._

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
  ├── M32 Admin Role & Permission Management
  ├── M33 Supervisor PIN Approval Modal
  ├── M34 Statutory Parameters Configuration Screen
  ├── M35 Digital Scale & Hardware Connection UI (Simulated)
  └── M36 Offline POS Queue Sync UI (Simulated)

Phase 12: Procurement & Supplier            [ADDED 2026-07-26 — gap found in coverage audit]
  ├── M37 Supplier Master (Party Master extension)
  ├── M38 Purchase Order
  ├── M39 Goods Receipt (GRN)
  ├── M40 Purchase Invoice & ITC Booking
  └── M41 Purchase Return / Debit Note

Phase 13: Inventory Operations              [ADDED 2026-07-26]
  ├── M42 Stock Adjustment & Write-Off Voucher
  ├── M43 Melting Workflow
  └── M44 Inventory Dashboard

Phase 14: Accounting Depth                  [ADDED 2026-07-26 — extends Phase 9]
  ├── M45 Payment / Receipt / Contra Vouchers
  ├── M46 Cash Book & Day Book
  └── M47 Trial Balance, P&L & Balance Sheet

Phase 15: Masters & Admin Depth             [ADDED 2026-07-26]
  ├── M48 Rate Master Screen & Append-Only Rate History
  ├── M49 User Management
  ├── M50 Notification Center & Activity Feed
  ├── M51 System Health & Diagnostics Panel
  ├── M52 ITC Register & HSN Summary Reports
  └── M53 Old Gold Buyback Dashboard
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
- **Known gap:** manually-typed billing lines carry no tag and therefore no HUID to check, so ad-hoc billing remains a compliance risk until custom lines are modelled.

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
- **Note:** GST reports live separately — GSTR-1/3B in Milestone 23, ITC Register & HSN Summary in Milestone 52.

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

---

## 🏁 Phase 12: Procurement & Supplier (Milestones 37 – 41)

_Added 2026-07-26. PRD §6.1 defines the full chain (Purchase Order → Goods Receipt → Purchase
Invoice → stock update) and §9.6 requires a Purchase Register for ITC reconciliation, but the
original roadmap never scheduled any of it. This was the largest coverage gap found._

### 📍 Milestone 37: Supplier Master (Party Master extension)
- **Goal:** Introduce Supplier as a real party type so purchases have someone to be booked against.
- **Dependencies:** None beyond Milestone 1 (state-lifting pattern).
- **Tasks:**
  1. Extend the party model with `Supplier` (name, GSTIN, PAN, state code, opening balance, credit terms). Per Handbook D-5, Party Master is tenant-wide and must **never** carry a `branch_id`.
  2. Add PAN/GSTIN/Aadhaar/KYC fields to `Customer` at the same time — PRD §4.3 requires them and they are currently absent from the type entirely.
- **Testable via:** A supplier can be created and selected on a purchase document; a customer record round-trips its GSTIN/PAN.

### 📍 Milestone 38: Purchase Order
- **Goal:** Raise and track POs to bullion dealers / finished-goods suppliers.
- **Dependencies:** Milestone 37.
- **Tasks:**
  1. PO entry (supplier, expected metal/purity/weight or design lines, rate basis, delivery date) with its own `PO-<FY>` sequence and a `Draft → Sent → PartiallyReceived → Closed → Cancelled` status.
- **Testable via:** A PO can be raised, then referenced when receiving goods; receiving part of it moves it to PartiallyReceived rather than Closed.

### 📍 Milestone 39: Goods Receipt (GRN)
- **Goal:** Receive physical metal/goods against a PO (or without one), capturing real weight and tested purity.
- **Dependencies:** Milestone 38; Milestone 3 (a finished-goods receipt must create real `Tag` records).
- **Tasks:**
  1. GRN entry capturing gross/net weight and **tested** purity per line, with a variance flag when received weight/purity differs from the PO.
  2. On save: raw metal increments the metal register; finished goods create `Tag` records entering the lifecycle at the appropriate state via the Milestone 4 state machine.
- **Testable via:** Receiving finished goods against a PO produces the right number of real Tags; a purity variance is surfaced, not silently accepted.

### 📍 Milestone 40: Purchase Invoice & ITC Booking
- **Goal:** Book the supplier's tax invoice and record claimable Input Tax Credit.
- **Dependencies:** Milestone 39; Milestone 21 (needs the Tax Master for correct input-tax rates).
- **Tasks:**
  1. Purchase Invoice entry linked to a GRN, splitting taxable value and input CGST/SGST/IGST, stored as ITC receivable.
  2. Add an **RCM (Reverse Charge)** flag for notified services from unregistered suppliers — PRD §9.7 requires this recorded separately, since the shop pays the GST itself and then claims it.
- **Testable via:** A booked purchase invoice appears in the Purchase Register with its ITC split; an RCM-flagged invoice is distinguishable from a normal one.

### 📍 Milestone 41: Purchase Return / Debit Note
- **Goal:** Return goods to a supplier and issue a debit note reversing the purchase and its ITC.
- **Dependencies:** Milestone 40; Milestone 12 (mirrors the credit-note reversal already built for sales).
- **Tasks:**
  1. Purchase Return against a booked purchase invoice, with its own `DBN-<FY>` sequence, reversing stock and ITC proportionally — reuse `salesReturn.ts`'s pro-rata approach rather than re-deriving it.
- **Testable via:** A full purchase return nets the purchase and its ITC to zero; a partial return reverses proportionally.

---

## 🏁 Phase 13: Inventory Operations (Milestones 42 – 44)

### 📍 Milestone 42: Stock Adjustment & Write-Off Voucher
- **Goal:** A controlled, reason-logged way to correct stock or write off damaged/lost pieces.
- **Dependencies:** Milestone 4 (drives the `DamagedOrMelted` transition), Milestone 10 (reuses the reason-log pattern).
- **Tasks:**
  1. Stock Adjustment voucher: select Tags, choose a reason (damaged / lost / shrinkage / correction), require a logged reason, and transition through the state machine — never by direct status assignment.
- **Testable via:** Writing off a Tag requires a reason and moves it to `DamagedOrMelted`; it leaves sellable stock and stock valuation.

### 📍 Milestone 43: Melting Workflow
- **Goal:** Convert old gold and damaged/unsold tags back into raw metal stock (PRD §6.3).
- **Dependencies:** Milestone 15 (old-gold lots), Milestone 42 (damaged tags).
- **Tasks:**
  1. Melting batch: select old-gold lots and/or damaged Tags, record input gross weight, expected vs. actual recovered fine weight, and melting loss; output increments raw metal stock.
- **Testable via:** A melt batch's recovered fine weight plus recorded loss reconciles against the input weight; melted Tags leave sellable inventory permanently.

### 📍 Milestone 44: Inventory Dashboard
- **Goal:** A dedicated inventory-analytics landing screen, distinct from the main sales dashboard.
- **Dependencies:** Milestone 4, Milestone 6, Milestone 13.
- **Tasks:**
  1. Stock-by-purity/category weight & value tiles, lifecycle-state distribution, ageing buckets (>90/180 days), GML/consignment exposure, and the last audit's discrepancy summary.
- **Reference design:** `docs/stitch_jewelry_management_suite/.../inventory_valuation_summary/`, `.../stock_ageing_velocity_analysis/`.
- **Testable via:** Every tile reconciles against the underlying `Tag[]` state; selling a piece updates it without a reload.

---

## 🏁 Phase 14: Accounting Depth (Milestones 45 – 47)

_Added 2026-07-26. Milestone 28 covers auto-posted journals, the Chart of Accounts, the Ledger
Statement and the Day Book — but PRD §10.5 and §14.7 also require manual voucher entry and the
three statutory financial statements, which were never scheduled._

### 📍 Milestone 45: Payment / Receipt / Contra Vouchers
- **Goal:** Manual voucher entry for money movements that aren't a sale or a purchase.
- **Dependencies:** Milestone 28 (posts through the same journal engine).
- **Tasks:**
  1. Payment (money out), Receipt (money in) and Contra (cash↔bank transfer) voucher screens, each posting a balanced double-entry pair via `journalPosting.ts`.
  2. Support the contra-style "Stock with Karigar" sub-ledger treatment noted in PRD §10.3.
- **Testable via:** Every voucher posts `Σdebit = Σcredit`; a contra entry moves value between cash and bank without touching P&L.

### 📍 Milestone 46: Cash Book & Day Book
- **Goal:** Chronological cash/bank movement views for daily closing.
- **Dependencies:** Milestone 45.
- **Tasks:**
  1. Cash Book (cash/bank running balance) and Day Book (all vouchers for a date), both with opening/closing balance reconciliation.
- **Testable via:** The Cash Book's closing balance equals opening plus the day's receipts minus payments; the Day Book total reconciles against the day's invoices.

### 📍 Milestone 47: Trial Balance, P&L & Balance Sheet
- **Goal:** The three statutory financial statements (PRD §10.5, §14.7).
- **Dependencies:** Milestone 28, Milestone 45.
- **Tasks:**
  1. Trial Balance (all ledger balances, must tie), Profit & Loss, and Balance Sheet, all derived from posted journal entries — never hand-computed.
  2. Use PRD §10.4's stock valuation basis (at-cost vs at-market) consistently for the closing-stock figure.
- **Testable via:** The Trial Balance's debit and credit columns are equal; the Balance Sheet balances; P&L closing stock matches the inventory valuation on the same date.

---

## 🏁 Phase 15: Masters & Admin Depth (Milestones 48 – 53)

### ✅ Milestone 48: Rate Master Screen & Append-Only Rate History — done 2026-07-29, pulled forward
- **Goal:** A real Rate Master with versioned history, replacing the Dashboard's in-place inline edit.
- **Dependencies:** None beyond Milestone 1. **The current inline-edit behaviour violates decision D-4, so this is higher priority than its number suggests.**
- **Tasks:**
  1. Append-only `rate_versions` model (`effective_from`, `set_by`, `override_reason`) — no code path may ever mutate a historical rate row (D-4).
  2. Rate Master screen: current rate per metal/purity, full history, and a fat-finger guard requiring confirmation when a new rate deviates >2–5% from the previous one (PRD §4.2).
  3. Auto-derive 22K/18K from the 24K base rate, with a manual per-purity override.
- **Testable via:** Editing a rate creates a new version rather than overwriting; an old invoice still resolves the rate version it was billed at; a 20% rate jump is blocked pending confirmation.
- **Done:** `src/lib/rateMaster.ts` + rate history on the Dashboard rate cards. `effectiveFrom` is a full **timestamp**, not a date, because gold moves intraday and same-day rates must still order deterministically. The fat-finger guard sits at **5%** — the outer bound of PRD §4.2's 2–5% range, deliberately, because gold genuinely moves a few percent daily and a tighter default would train staff to click through the warning. Past it a written reason is mandatory; beyond 50% the message names a misplaced decimal point specifically. It never hard-blocks: a real spike must remain recordable. `MetalRate` is now **projected** from the versions (same pattern as M16's derived karigar balances), so every existing screen consumes it unchanged, and `history24h` — previously a decorative array — is now the real recorded versions. Purity derivation from the 24K base is a **suggestion, never applied**: a shop's counter rate absorbs local premium (seed is 7250/6650 where derivation gives 6648), so overwriting it with arithmetic would change what customers are charged.

### 📍 Milestone 49: User Management
- **Goal:** Create/edit/deactivate operator accounts — distinct from *defining* roles (Milestone 32).
- **Dependencies:** Milestone 32 (roles must exist before users can be assigned to them).
- **Tasks:**
  1. User list plus a create/edit drawer (name, role, branch, PIN, active flag), with deactivate-not-delete so audit history stays intact.
- **Testable via:** A deactivated user can no longer be selected as an operator, but their past transactions still resolve their name.

### 📍 Milestone 50: Notification Center & Activity Feed
- **Goal:** Replace `Header.tsx`'s hardcoded notification dropdown with a real event-driven feed.
- **Dependencies:** Milestone 13 (which establishes a real recent-events source).
- **Tasks:**
  1. An event/notification store any screen can push into, plus the `Toast` primitive flagged as missing in `CURRENT_PROGRESS.md` §3.6.
  2. Notification Center (unread/read, per-category) and an Activity Feed of real state changes.
- **Testable via:** Completing a sale, receiving stock, or writing off a Tag each push a real notification that appears without a reload.

### 📍 Milestone 51: System Health & Diagnostics Panel
- **Goal:** An honest status surface for a frontend-only prototype: storage, sync and peripheral state.
- **Dependencies:** Milestone 35, Milestone 36 (extends the Simulation Desk).
- **Tasks:**
  1. `localStorage` usage/quota, last-backup timestamp, simulated API/offline state, peripheral connection status, and app/build version.
- **Testable via:** Filling storage or toggling Force Offline is reflected accurately; nothing on the panel is a hardcoded placeholder.

### 📍 Milestone 52: ITC Register & HSN Summary Reports
- **Goal:** The two GST reports PRD §9.6 requires beyond GSTR-1/3B.
- **Dependencies:** Milestone 40 (ITC is booked at purchase), Milestone 21 (HSN comes from the Tax Master).
- **Tasks:**
  1. ITC Register (input tax by supplier/invoice, for GSTR-2B reconciliation) and HSN Summary (GSTR-1 Table 12 shape), both CSV-exportable.
- **Testable via:** The ITC Register total equals the sum of input tax on booked purchase invoices; the HSN Summary's taxable values reconcile against the sales register for the period.

### 📍 Milestone 53: Old Gold Buyback Dashboard
- **Goal:** An analytics view over old-gold intake, distinct from the transactional voucher.
- **Dependencies:** Milestone 14, Milestone 15, Milestone 43.
- **Tasks:**
  1. Intake weight/value by period and purity band, average tested vs. claimed purity, melting-loss trend, and current vault holdings by state (`In Safe`/`Melted`/`Fine Gold Stock`).
- **Testable via:** Every figure reconciles against the underlying old-gold lots; raising a new buyback voucher updates it without a reload.
