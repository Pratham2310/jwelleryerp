# CURRENT_PROGRESS.md

_Last updated: 2026-08-08 (Phase 16 complete — all 61 milestones delivered) — Full project audit (codebase vs. `docs/Jewellery_Retail_Software_PRD.md`, `docs/Jewellery_ERP_Developer_Handbook (1).md`, and the `.ai/` knowledge base), refreshed after the Procurement chain (M37–M41). **Milestones 1–28, 37–41 plus 48 are implemented (Phases 1–8 and 12 complete, Phase 9 started)** — see `CHANGELOG.md` for the per-milestone detail. This audit is code-verified (every claim below was checked against the actual source in `src/`), not carried forward from prior narrative._

⚠️ **Doc-sync note:** `.ai/ARCHITECTURE.md`, `.ai/DATABASE.md`, `.ai/FRONTEND_ARCHITECTURE.md`, `.ai/COMPONENT_LIBRARY.md`, `.ai/ROUTING.md`, `.ai/API_REFERENCE.md`, `.ai/CODING_RULES.md`, and `.ai/DECISIONS.md` were **not** part of this audit's requested update scope, but this audit discovered they still describe the **pre-Milestone-1/2 codebase** (e.g. they say Stone/JobBag state isn't lifted, theme detection is duplicated six times, and GST is computed on the wrong base — all fixed on 2026-07-25). They should be refreshed in a follow-up pass; treat their current content as stale where it conflicts with this file.

---

## 1. Executive Snapshot Summary

- **Documentation (Business/Domain Design):** PRD complete (v1.0, 19 sections). Developer Handbook fully drafted, all 14 phases.
- **Backend / Database:** Not started (no server, no PostgreSQL database, no API endpoints) — this is a deliberate scope decision (see `.ai/PROJECT_OVERVIEW.md`), not a gap to close inside this repo. All persistent data relies on `localStorage`.
- **Roadmap scope (revised 2026-07-26):** extended from 36 to **53 milestones** after a client module list was audited against the PRD — the original roadmap had omitted Procurement (PRD §6.1), the statutory financial statements, accounting vouchers, Stock Adjustment, Melting, Rate Master, User Management, Notification Center, System Health and the ITC/HSN reports. See `TODO.md`'s Coverage Audit table and Sequencing Note.
- **Frontend Prototype ("Stitch UI"):** React 19 + Vite 6 + TypeScript SPA, 7 business screens + auth. **All 61 milestones are complete — every phase closed:** state unification/theme (M1), billing/GST calculation correctness (M2), Item Design vs. Tag split (M3), enforced Tag lifecycle state machine (M4), real scannable barcode/QR (M5), Stock Audit/reconciliation (M6), discount-before-GST fix (M7), PAN/Form 60 gate (M8), multi-tender payment split (M9), manager-override reason logging (M10), Estimate/Quotation mode (M11), Sales Return & Credit Note (M12), the Dashboard real-data fix (M13), the Old Gold melt/touch valuation engine and purchase voucher (M14), Old Gold vault tracking (M15), the Karigar append-only ledger and Fine Gold Equivalent engine (M16), WorkOrder/JobBag unification (M17), excess-wastage review with scrap returns (M18), the Branch Master and branch switcher (M19), Inter-Branch Stock Transfer (M20), the Tax Master with HSN and the CGST/SGST vs IGST split (M21), e-Invoice and e-Way Bill simulation (M22), the GSTR-1/GSTR-3B preview and CSV export (M23), and — pulled forward out of Phase 15 — the append-only Metal Rate Master with its fat-finger guard (M48), the AHC dispatch register with real HUID assignment (M24), the non-hallmarked sale guard (M25), the Gold Savings Scheme master, enrolment and passbook (M26–M27), double-entry accounting with auto-posted journal vouchers (M28), and the whole Procurement chain — Supplier Master, Purchase Order, Goods Receipt, Purchase Invoice with ITC, and Purchase Return (M37–M41), the Tally Prime XML export (M29), manual vouchers with the Cash Book, P&L and Balance Sheet (M45–M47), roles & permissions with navigation and route gating (M32), the Reports Hub with Customer 360 (M30–M31), the supervisor PIN approval gate with configurable statutory thresholds (M33–M34), the simulated digital scale and offline POS queue that close Phase 11 (M35–M36), Inventory Operations — stock write-offs with ITC reversal, the melting workflow and the Inventory Dashboard (M42–M44), and Phase 15's admin depth — user management, the notification centre and event store, system health, the ITC/HSN registers and the buyback dashboard (M49–M53). Test suite: **1531 passing across 51 suites** (`billingCalculations`, `tagStateMachine`, `stockAudit`, `statutoryChecks`, `priceOverrides`, `salesReturn`, `dashboardAnalytics`, `oldGoldValuation`, `oldGoldVault`, `fineGoldLedger`, `jobWork`, `wastageReview`, `branch`, `stockTransfer`, `taxMaster`, `eInvoice`, `gstReturns`, `rateMaster`, `hallmarking`, `hallmarkGuard`, `savingsScheme`, `money`, `journalPosting`, `supplier`, `purchaseOrder`, `goodsReceipt`, `purchaseInvoice`, `purchaseReturn`, `tallyExport`, `financialStatements`, `permissions`, `reports`, `statutoryParameters`, `hardware`, `offlineQueue`, `stockAdjustment`, `melting`, `inventoryDashboard`, `users`, `notifications`, `systemHealth`, `gstRegisters`, `buybackDashboard`). `repairJob`, `customerOrder`, `memoOut`, `receivables`, `salesAttribution`, `loyalty`, `eInvoiceGsp`, `messaging`). **Nothing on the roadmap remains unbuilt** — Phase 16 (M54–M61) closed the eight full-product gaps found when planning the SaaS. The money/weight arithmetic foundation (`src/lib/money.ts`) landed 2026-07-30 as a Phase 9 prerequisite.
- **Reference material discovered this audit:** `docs/stitch_jewelry_management_suite/stitch_jewelry_management_suite/` contains 22 AI-Studio-generated screen designs (`code.html` + `screen.png` each) for modules that do **not** exist in `src/` yet — e.g. `old_gold_purchase_voucher/`, `karigar_outstanding_ledger/`, `gst_compliance_dashboard/`, `scheme_management_dashboard/`, `branch_gstin_configuration/`, `daily_rate_master_hq/`, `tagging_inventory_entry/`, `stock_ageing_velocity_analysis/`, `owner_s_executive_dashboard/`. These are pre-made visual references for ~20 of the missing screens identified below — check here before designing a missing screen from scratch.
- **Gap Analysis Result:** The billing calculation engine is correct and unit-tested (PRD §17 worked example passes, plus the Milestone 7 discount-before-GST correction), the Item Design vs. Tag split (the PRD's single most load-bearing structural requirement, per Handbook D-6) is done, and the Tag lifecycle is now genuinely *enforced* rather than advisory. Billing compliance has real teeth: PAN/Form 60 gate, multi-tender split validation, and a persisted override audit trail. The Tax, Branch and Rate masters are built, GST compliance is real (HSN split, e-Invoice simulation, GSTR exports), hallmarking has both the HUID assignment workflow (M24) and the non-hallmarked sale block (M25), and double-entry accounting posts automatically behind every document (M28). **Procurement (M37–M41) is now built**, so stock has a real inbound path and GST has an input side as well as an output one. What remains unbuilt: only the Stone Rate master, which was never scoped as a milestone. Every one of the 53 roadmap milestones is delivered. The natural next work is no longer feature-building but the backend the whole prototype defers to — every permission check, statutory gate and approval in this app gates the interface, not the data, and each has to be re-asserted server-side when a server exists.

---

## 2. Screen-by-Screen Detailed Audit

### 2.1 Dashboard (`/dashboard`, `Dashboard.tsx`)
- **What Exists:** KPI cards (Today's Sales Revenue, Showcase Inventory count, Active Artisan Jobwork, Karigar Outstanding Gold — all computed from real lifted state). Live metal-rate grid with inline edit and an 8-point sparkline. A category-weight doughnut chart computed from real `items` data. A recent-invoices table (real data).
- **Missing / Fake:**
  - ~~"Monthly Sales Revenue Trend" hardcoded SVG data~~ — ✅ Fixed, Milestone 13 (real 6-month trend, net of returns, estimates excluded, axis scaled to actual data).
  - ~~"ERP Action Log" static hardcoded list~~ — ✅ Fixed, Milestone 13 (real activity feed with an honest empty state). Caveat: it reconstructs events from current records rather than logging them as they occur, so it can't show anything the state no longer contains — a real event store lands in Milestone 50.
  - ~~Stone vault / Job Bag state lifted since M1 but never displayed~~ — ✅ Fixed, Milestone 13 (two new KPI cards).
  - ~~No Branch selector (single implicit branch)~~ — ✅ Fixed, Milestone 19 (real `Branch` entity, header switcher, per-GSTIN invoice series).
  - ~~Rate edits mutate `metalRates` directly in place — no append-only rate history, no audit log, no fat-finger change guard~~ — ✅ Fixed, Milestone 48 (pulled forward): append-only `MetalRateVersion[]`, timestamped history modal per metal, 5% fat-finger guard with mandatory reason, 24K purity derivation offered as a suggestion. Still open: no maker-checker second-person *approval* on a rate change, which depends on RBAC (M32/M45).

### 2.2 Catalog & Showcase (`/catalog`, `CatalogManager.tsx`)
- **What Exists:** **(2026-07-25, Milestone 3)** Rebuilt with a two-tab interface — **Tag Inventory** (grid view, category/status/stock-ownership filters, search by SKU/name/certificate/HUID; detail modal with a "Tag Preview" printable label showing the piece's *real* `huid` field, or "Not Yet Hallmarked" if unset) and **Item Design Templates** (a grid of design cards showing category/metal/default wastage/making-charge/HSN and a live tagged-stock count per design, with its own Add Design modal). `ItemDesign`/`Tag` are now genuinely separate types (`types.ts`), resolving PRD §5.1/Handbook D-6. Adding a new Tag requires selecting its parent Item Design, which pre-fills defaults (still editable). Each Tag shows a Stock Ownership badge (`OWNED`/`GML_FINANCED`/`CONSIGNMENT`).
- **Added since (Milestones 4–6):** a third **Stock Audit** tab (scan/type a tray, flags missing tags and extra/unexpected scans, weight-wise discrepancy report for owner sign-off). `Tag.status` is now the full **enforced** 12-state lifecycle via `src/lib/tagStateMachine.ts` — the detail modal offers only legal next states and rejects illegal ones with a visible error. The Tag Preview renders a **real scannable QR (Tag id) + CODE128 barcode (SKU)** and is correctly wrapped in the `#print-area` convention so "Print Tag" prints only the label.
- **Missing:**
  - No Digital Scale "fetch weight" button (Milestone 35).
  - ~~No AHC hallmarking dispatch/receipt flow to actually *assign* a HUID~~ — ✅ Fixed, Milestone 24 (dispatch register, per-piece pass/fail, globally-unique HUID enforcement, certified-purity variance). ✅ The sale guard also landed in Milestone 25 — a non-exempt, un-hallmarked piece can no longer be billed, including manually-typed custom lines, which record their own HUID. Still open: no antique/export exemption flag, and no AHC certificate file upload.
  - No three-tier Making-Charge/Wastage override hierarchy (Category Slab → Design → Transaction) — only the Design-default tier exists; no category-level slab master.

### 2.3 Stones & Diamonds (`/stones`, `StoneManager.tsx`)
- **What Exists:** Loose stone/diamond inventory table, Add Stone modal, Issue-to-Karigar / Return-to-Vault flow. **(2026-07-25)** State lifted to `App.tsx` — no longer isolated (Milestone 1).
- **Missing:** No 4Cs Diamond Rate Matrix/slab master (PRD §4.6) — `valuePerCarat` is typed in ad hoc per lot, with no lookup table by cut/color/clarity/carat-range. No stone certificate PDF viewer/upload. No loose-stone return-from-karigar workflow distinct from the vault return already present. Not yet wired into Billing (a billed item's `stoneCharge` is a free-typed number, never sourced from a real `LooseStone` record).

### 2.4 Billing Estimator & POS (`/billing`, `BillingEstimator.tsx`)
- **What Exists (substantially corrected 2026-07-25, Milestone 2):** Multi-item invoicing with a real, unit-tested calculation engine (`src/lib/billingCalculations.ts`) — metal value, wastage value (per-item %), making charge (branches on `per-gram`/`flat`), stone charge, GST correctly computed on the full taxable subtotal. Old Gold trade-in is correctly netted only at the final settlement stage, never against the taxable base. Scheme Redemption validates against and debits the real customer balance. Invoice numbers are a gap-free per-year sequence. Printable receipt + searchable registry.
- **Added since (Milestones 7–10):** discount now correctly reduces the taxable value **before** GST (PRD §7.4); **PAN/Form 60 gate** blocks checkout at ≥₹2,00,000 with a live requirement banner; **multi-tender payment split** validates that tendered amounts sum exactly to the amount due (Scheme Redemption is portion-aware — only the scheme-tendered amount is validated and debited); **manager-override reason log** blocks checkout when a line is edited away from its Tag's master values and persists the reasons onto the invoice as an audit trail.
- **Added since (Milestones 11–12):** **Estimate/Quotation mode** (PRD §7.8) with its own non-fiscal `EST-` series, skipping the PAN gate, stock deduction and payment entirely, plus a rate-choice "Convert to Tax Invoice" that re-applies the PAN gate and prevents double-billing; **Sales Return & Credit Note** (CGST §34) with its own `CRN-` series, partial-return support, pro-rata discount reversal, and a `Sold → Returned → InStock` stock path. `SaleInvoice.panDeclaration` now records *which* PAN was captured (M8 gated on it but stored nothing).
- **Missing:**
  - **Advance/Booking (token advance)** module (PRD §7.6) — entirely absent.
  - **Repair/Alteration billing sub-module** (PRD §7.9) — entirely absent.
  - **HUID printing per invoice line** (PRD §9.3) — no `huid` field exists on `InvoiceItem`.
  - **TCS/PMLA threshold logic** — no computation or flag anywhere (only the PAN threshold is implemented; TCS/PMLA arrive with Milestone 34's Statutory Parameters screen).
  - No barcode-scan-to-bill — item selection is a dropdown ("Pull Stock"), not a scanner input.
  - No GST/HSN split (single flat 3%, deliberately, pending the CA sign-off tracked in `HANDOFF.md` item 1).

### 2.5 Karigar & Job-Work (`/karigar`, `KarigarManager.tsx`)
- **What Exists:** Karigar directory with running `metalBalance` (grams) and `laborChargesOwed` (₹). Issue-job modal, "Receive Finished" reconciliation modal that computes actual wastage against a per-transaction wastage cap, and a labor-payout confirmation flow.
- **Missing:**
  - **No ledger/transaction history** — `metalBalance`/`laborChargesOwed` are two mutable running totals with no append-only entry log (`KNOWN_ISSUES.md` #10, still open); "how did we arrive at this balance" is unanswerable without replaying every state mutation.
  - **No Fine Gold (24K) Equivalent calculation** (PRD §6.2's core formula) — gold issued/received is compared as raw grams regardless of purity; a karigar working in 18K vs 22K is reconciled incorrectly relative to the PRD's formula.
  - **No excess-wastage flag-for-review workflow** — the "Receive Finished" form silently caps the metal deduction at the allowed wastage; the PRD requires the *excess* to be flagged for owner review, not silently absorbed.
  - **No separation from `JobBag`** — `WorkOrder` (this screen) and `JobBag` (§2.6) are still two disconnected data models describing the same real-world karigar job (`.ai/DATABASE.md` §1.1); no shared identity or FK.
  - No Scrap & Unused Stone return receipt modal.
  - No outside-job-work GST/reverse-charge recording.

### 2.6 Job Bags Tracker (`/jobbags`, `JobBagManager.tsx`)
- **What Exists:** Kanban board (`Casting → Filing → Setting → Polishing → Hallmark → Completed`), creation modal, priority flags, metal-loss-per-stage input, a mock printable tag preview. **(2026-07-25)** State lifted to `App.tsx` (Milestone 1).
- **Missing:** Still disconnected from `WorkOrder`/`KarigarManager` as a data model (see §2.5). No barcode/QR scan handler to advance stages. No stone-issue tracking linked to `StoneManager`. The printed "tag" here has the same decorative-QR-icon limitation as Catalog's tag preview.

### 2.7 Customers & Schemes (`/customers`, `CustomerManager.tsx`)
- **What Exists:** Customer directory with tier badges, lifetime spend, loyalty points. A single hardcoded "Swarna Nidhi" 11-month scheme per customer with an "Add Installment" button and a visual milestone tracker. **(2026-07-25)** Scheme Redemption in Billing now correctly debits this balance (Milestone 2).
- **Missing:**
  - **No Scheme Master** — only one scheme ("Swarna Nidhi," 11 months, ₹5,000/installment, hardcoded) can exist; PRD §12.2 requires a configurable multi-scheme catalog (tenure, bonus type, redemption rules).
  - No installment-due reminder scheduling/missed-installment tracking.
  - No premature-closure penalty logic.
  - No Passbook print/statement view.
  - **No explicit cash-refund block warning UI** — the app never offers a cash-refund path today (so it's not *broken*), but there's also no visible compliance guardrail communicating this is a legal requirement (Handbook §1.6.1/D-11), which matters once a redemption-editing UI is ever added.
  - No PAN/Aadhaar/GSTIN/KYC fields on `Customer` at all (see §4 below).
  - No birthday/anniversary reminder fields or WhatsApp/SMS rate-alert subscription UI.
  - No Customer 360 view (purchase-history timeline, preferences).

### 2.8 Old Gold Buyback (`/oldgold`, `OldGoldManager.tsx`) — **new, Milestone 14/15**
- **What Exists:** Standalone old-gold purchase flow, independent of any sale. Melt/touch valuation engine (`src/lib/oldGoldValuation.ts`) implementing PRD §8.2 step 4, with purity presets for the common Indian touch standards and a guard against typing a millesimal (875) into the percentage field. Purchase voucher captures everything §8.4 requires and shows a live customer-facing valuation breakdown before confirmation (§8.2 step 5). Own `OGV-` number series (a purchase, never the sales series — §8.3/D-10). PAN threshold enforced on buybacks. Enforced vault lifecycle (`src/lib/oldGoldVault.ts`): `InSafe → SentForMelting → Melted → FineGoldStock`, plus `InSafe → ResaleAsIs`; recovered fine weight captured on the melt transition, with refining-variance and capital-deployed reporting. Printable voucher with a purchase declaration.
- **Missing:** No item photo capture (§8.4 lists it). No Margin Scheme (Rule 32(5)) transaction mode — deliberately off, per the PRD's own guidance that it should be enabled only on CA advice. One voucher currently equals one lot; multi-item vouchers are a future refinement. Not yet wired to the accounting engine (M28) or to a Buyback Dashboard (M53).
- **⚠️ Open:** PRD §17's worked old-gold figures don't reconcile with §8.2's formula — see `HANDOFF.md` §1a.

### 2.9 Auth & RBAC (`/login`, `/register`, `LoginPage.tsx`, `RegisterPage.tsx`)
- **What Exists:** Mock login/registration (any input accepted), role-selection dropdown (cosmetic), Guest login button.
- **Missing:** No real RBAC route/component protection anywhere — once `user` is truthy, every route is accessible regardless of `user.role`. No Admin Role/Permission Management screen. No Supervisor PIN/Authorization modal for sensitive actions. No PAN/Aadhaar encryption (no such fields exist to encrypt). No audit logging of logins/sensitive actions.

---

## 3. Cross-Cutting Gap Inventory (per this audit's requested categories)

### 3.1 Missing Modules (entire PRD/Handbook modules with ~zero implementation)
- **Tax Master** (PRD §4.7) — no HSN table, no CGST/SGST/IGST, no versioned rates.
- **Branch/Location Master** (PRD §4.8) — no `Branch` entity at all; single implicit branch hardcoded in `Sidebar.tsx`/`Header.tsx` UI text.
- **Making-Charge/Wastage Scheme Master** (PRD §4.5) as a *category-level slab table* — per-item defaults exist (and are correctly used since Milestone 2), but there is no shop-wide slab master and no three-tier override hierarchy (Handbook D-8).
- **Stone/Diamond Rate Master** (PRD §4.6) as a *slab/4Cs pricing table* — `StoneManager` only tracks vault inventory at ad hoc per-lot prices.
- **Procurement / Goods Receipt** (PRD §6.1) — buying raw metal/finished goods from suppliers has no screen or entity.
- **Melting** (PRD §6.3) — old jewellery/damaged tags → raw metal has no workflow.
- **GST Compliance Engine** (PRD §9) — e-Invoice/IRN, e-Way Bill, GSTR-1/3B exports, RCM: none exist.
- **Accounting Engine** (PRD §10) — Chart of Accounts, journal entries, ledgers, Trial Balance, P&L, Balance Sheet, Tally export: none exist.
- **BIS Hallmarking Workflow** (PRD §11) — AHC dispatch/receipt batching and real HUID *uniqueness enforcement* still don't exist; **(2026-07-25, Milestone 3)** `Tag.huid` is now a real, per-tag field (manually enterable, displayed correctly), no longer a hardcoded cosmetic string — only the assignment *workflow* (batch dispatch, uniqueness check) remains missing (Milestone 24).
- **Reports Hub** (PRD §14.2–14.9) — no `/reports` route; the entire Sales/Inventory/Purchase-Karigar/GST/Accounting/Hallmarking/Scheme report catalog is absent.
- **Statutory Parameters** (PRD §15.3) — PAN (₹2L)/TCS/PMLA (₹10L) thresholds are not represented anywhere, hardcoded or otherwise — the checks themselves don't exist yet to even hardcode.

### 3.2 Missing Screens (no route/page exists)
1. ~~Item Design Template management (split from Tag Inventory)~~ — ✅ Done, Milestone 3 (2026-07-25).
2. ~~Tag/Physical Stock Audit & Reconciliation screen.~~ — ✅ Done, Milestone 6 (Catalog → Stock Audit tab).
3. Procurement / Goods Receipt entry screen.
4. Melting workflow screen.
5. ~~Standalone Old Gold Purchase Voucher screen (buy outright, no linked sale).~~ — ✅ Done, Milestone 14 (`/oldgold`).
6. AHC Hallmarking dispatch/receipt batch screen.
7. Branch Management + Branch Switcher + Inter-Branch Stock Transfer screen — reference design: `.../branch_gstin_configuration/`.
8. Tax Master (HSN/GST rate management) screen — reference design: `.../gst_compliance_dashboard/`.
9. Rate Master history/audit screen (separate from the Dashboard's inline-edit ticker) — reference design: `.../daily_rate_master_hq/`, `.../rate_policy_regional_hierarchy/`.
10. Making Charge/Wastage category-slab editor screen.
11. Stone/Diamond Rate Master (4Cs slab pricing) screen.
12. Scheme Master (multi-scheme definition) + Enrollment screen — reference designs: `.../scheme_management_dashboard/`, `.../new_scheme_enrollment/`, `.../daily_scheme_collections/`, `.../scheme_redemption_settlement/`.
13. Reports Hub (`/reports`) — reference designs: `.../inventory_valuation_summary/`, `.../stock_ageing_velocity_analysis/`, `.../karigar_outstanding_ledger/`, `.../karigar_receipt_reconciliation/`, `.../gstr_1_sales_ledger_prep/`, `.../itc_reconciliation_gstr_3b/`.
14. Accounting screens (Chart of Accounts, Ledger Statements, Trial Balance, P&L, Balance Sheet, Day Book).
15. Admin/RBAC — Role & Permission management screen.
16. Statutory Parameters configuration screen.
17. Audit Trail viewer.
18. Customer 360 view.
19. GST Compliance Dashboard (e-Invoice/e-Way Bill status, GSTR previews) — reference design: `.../gst_compliance_dashboard/`, `.../e_way_bill_karigar_itc_04/`.
20. Repair/Alteration job screen.
21. Owner's Executive Dashboard (a more analytics-dense variant of `/dashboard`) — reference design: `.../owner_s_executive_dashboard/`, `.../enterprise_hq_dashboard/`.
22. Karigar Metal Issue Vouching screen (a dedicated voucher document, distinct from the current inline issue modal) — reference design: `.../karigar_metal_issue_vouching/`.

### 3.3 Missing Dialogs
1. ~~PAN Verification modal (Billing, ≥₹2L).~~ — ✅ Done, Milestone 8.
2. ~~Multi-payment split panel (Billing).~~ — ✅ Done, Milestone 9.
3. Manager/Supervisor approval modal — **reason-log ✅ done (Milestone 10)**; the Supervisor PIN gate layered on top is Milestone 33, and invoice cancellation is still unhandled.
4. ~~Sales Return / Credit Note modal.~~ — ✅ Done, Milestone 12.
5. Advance/Booking (token advance) modal.
6. ~~Old Gold standalone purchase-voucher modal.~~ — ✅ Done, Milestone 14.
7. Rate history/audit-trail modal.
8. Fat-finger rate-change confirmation (Dashboard rate edit has zero deviation validation today).
9. ~~Karigar excess-wastage review/flag modal.~~ — ✅ Done, Milestone 18.
10. HUID assignment / AHC dispatch modal.
11. Non-hallmarked-item sale-block warning modal.
12. Scheme cash-refund block warning (explicit UI guard).
13. Duplicate-customer merge dialog.
14. Stock write-off / damaged-item modal.
15. Branch/GSTIN configuration modal.

### 3.4 Missing Workflows
1. ~~Full Tag lifecycle state machine~~ — ✅ Done, Milestone 4 (`src/lib/tagStateMachine.ts`, 12 states, enforced at every UI call site).
2. ~~Karigar ledger as an append-only transaction history.~~ — ✅ Done, Milestone 16.
3. ~~`WorkOrder` ↔ `JobBag` unification.~~ — ✅ Done, Milestone 17 (one `JobWork` aggregate).
4. Barcode-scan-to-bill — real scannable codes now exist (Milestone 5), but Billing still selects stock via a dropdown rather than a scanner-input listener.
5. Estimate → Sale conversion.
6. Memo-out (approval/trial) → return-or-sale.
7. Melting (old gold/damaged tags → raw metal).
8. Inter-branch stock transfer (dispatch → in-transit → receive).
9. Scheme installment reminders / missed-installment tracking.
10. GST e-Invoice/e-Way Bill submission (even a simulated version, per `IMPLEMENTATION_WORKFLOW.md` ground rules).
11. Double-entry journal-entry auto-posting behind every transaction.
12. Audit-trail logging of every override/change (user, timestamp, old/new value, reason) — `KNOWN_ISSUES.md` scope, still fully open.

### 3.5 Missing Navigation
1. No Branch switcher — `Sidebar.tsx`/`Header.tsx` hardcode "Mumbai BST"/"MUM-01" as static text, not a real selector.
2. No `/reports` nav item.
3. No `/accounting` nav item.
4. No `/admin` or `/settings` nav item (would host RBAC, Statutory Parameters, Tax Master, Rate history).
5. `Breadcrumbs.tsx` (51 lines) only reflects the current top-level route — no drill-down hierarchy for a future Design→Tag or Reports→Sub-report navigation depth.
6. `Sidebar.tsx`'s `menuItems` array is the sole source of truth for nav (per `.ai/ROUTING.md` §4) — every new screen above requires a manual, easy-to-forget addition here with no shared route-config safety net.

### 3.6 Missing Reusable Components
`.ai/COMPONENT_LIBRARY.md` already flags that only 3 of 15 screens use the `ui/` primitives at all. This audit adds the specific missing *primitives themselves* (not yet built even for screens that would want them):
1. A shared `Modal`/`Dialog` wrapper — every screen hand-rolls its own `fixed inset-0 backdrop-blur ...` markup independently (at least 9 near-identical copies found across `StoneManager`, `JobBagManager`, `KarigarManager`, `CustomerManager`, `CatalogManager`, `BillingEstimator`).
2. A shared `DataTable` component — every list screen hand-rolls its own `<table>` markup with repeated header/row styling.
3. A shared `StatCard`/KPI-card component — `Dashboard`, `KarigarManager`-adjacent screens, `StoneManager`, `JobBagManager` each independently reimplement near-identical KPI-card markup.
4. A shared `ConfirmDialog` component — confirmation UX is inconsistent: `CatalogManager` uses the native `confirm()`, `KarigarManager` uses inline state-driven confirm buttons, `StoneManager`/`JobBagManager` have no confirmation step at all before destructive-ish actions.
5. A `Select`/dropdown primitive in `ui/` — `Button`/`Input`/`Card`/`Badge` exist, but every `<select>` in the app is raw/unstyled-by-the-library.
6. A `Toast`/notification primitive — `Header.tsx`'s notification dropdown is a hardcoded static array, not a real event-driven toast system any screen could push into.
7. A shared, data-driven status-badge mapping — `getStatusColor`/`getPriorityColor`/`getTierColor`/`getStageHeaderColor` are independently reimplemented switch statements in `CatalogManager`, `JobBagManager`, `CustomerManager` instead of one shared semantic-color utility.
8. ~~A shared barcode/QR rendering component.~~ — ✅ Done, Milestone 5 (`src/components/ui/TagCode.tsx`, consumed by both `CatalogManager` and `JobBagManager`).

### 3.7 Missing Business Logic
1. ~~Fine Gold Equivalent (purity-adjusted gram) calculation.~~ — ✅ Done, Milestone 16 (`src/lib/fineGoldLedger.ts`).
2. Three-tier Making-Charge/Wastage override resolution (Category Slab → Item Design default → Transaction-time override) — only two of the three tiers exist today, and there's no shared resolution function.
3. PAN/Form-60 threshold check — ✅ Done, Milestone 8 (`src/lib/statutoryChecks.ts`). TCS/PMLA thresholds are still absent.
4. CGST/SGST vs. IGST auto-determination by comparing branch state to customer state.
5. HSN-based tax lookup (vs. the current hardcoded flat 3%).
6. FIFO/weighted-average stock costing (at-cost vs. at-market dual valuation).
7. Fixed-point/decimal arithmetic — the app still uses plain JS floating-point + `Math.round`, not a decimal library (PRD §16.2 explicitly warns against float arithmetic for money).
8. ~~Tag state-machine transition validation.~~ — ✅ Done, Milestone 4 (`canTransition()`).
9. HUID uniqueness enforcement (no `huid` field exists to enforce uniqueness on).
10. ~~Old Gold melt/touch valuation as a reusable function.~~ — ✅ Done, Milestone 14 (`src/lib/oldGoldValuation.ts`). Billing's inline trade-in quick-fields still take a flat rate/weight for the adjust-against-a-sale path; the full purity-test/melting-loss workflow lives on `/oldgold`.
11. Double-entry journal posting.
12. ~~Discount-before-GST calculation (PRD §7.4).~~ — ✅ Done, Milestone 7 (`calculateInvoiceTotals()` now exposes an explicit `taxableValue` and computes GST from it).
13. Dashboard's "ERP Action Log" and "Monthly Sales Revenue Trend" are not wired to real state (see §2.1) — the underlying business logic to derive a real trend line from `invoices` (grouped by month) doesn't exist yet.
14. Stone/Job-Bag state, though lifted to `App.tsx` since Milestone 1, is still not consumed by `Dashboard.tsx` for any KPI — the wiring exists at the state layer but no Dashboard card reads it yet.

### 3.8 Missing Responsive States
This is a code-level read of Tailwind breakpoint usage, **not** a verified visual/viewport-by-viewport QA pass — flagging these as things to visually verify, not confirmed bugs:
1. Data tables (`KarigarManager`'s jobwork list, `CustomerManager`'s directory, `BillingEstimator`'s registry/line-items) rely on `overflow-x-auto` with no dedicated mobile card-view fallback — likely cramped/scrolly on phone widths.
2. `JobBagManager`'s Kanban board has inconsistent height rules between themes at the same breakpoint (`light`: `h-auto max-h-[650px] min-h-[180px]`; `dark`: fixed `h-[650px]`) — worth visually verifying this doesn't cause layout jumps when toggling theme on a short viewport.
3. `BillingEstimator`'s `sticky top-6` checkout summary panel, combined with the `lg:grid-cols-3` → 1-column collapse on mobile, has no explicit mobile-specific treatment (e.g. a collapsible/bottom-sheet summary) — worth checking for awkward scroll behavior on phones.
4. `Header.tsx`'s search modal (`max-w-2xl`) and notification/profile dropdowns (`w-80`/`w-64`) have fixed pixel-ish widths with no explicit narrow-viewport (<380px) adjustment — potential overflow/clipping risk, unverified.
5. No intermediate "tablet" (768–1024px) verification pass exists between the mobile-drawer `Sidebar` behavior and the always-visible-desktop-sidebar behavior — a common gap where a tier gets silently skipped.
6. The printable receipt/tag layouts (`#print-area` convention) are only verified against the standard screen breakpoints, not against actual print-media paper-size constraints.

---

## 4. Overall Frontend Feature Gap Matrix

| PRD Module | Status | Highest-Priority Missing Piece |
|---|---|---|
| **1. Domain & Glossary** | UI Mockup Only | Fine Gold equivalent display, purity master screen |
| **2. Multi-Branch** | Not Started | Branch entity, switcher, IBST |
| **3. Personas & RBAC** | UI Mockup Only | Any real route/action permission enforcement |
| **4. Master Data** | Partial (Party, MC/Wastage, Item Design) / Not Started (Tax, Branch, Stone-rate) | Tax Master, Branch Master, category-level MC/Wastage slabs |
| **5. Inventory & Tagging** | Partial (Design/Tag split, enforced lifecycle, real barcode/QR, Stock Audit all done — M3–M6) | Memo-Out workflow screen; at-cost/at-market dual valuation |
| **6. Karigar & Jobwork** | Partial (ledger, Fine Gold Equivalent, unification and wastage review all done — M16–M18) | Procurement/GRN (M38–M41), Melting (M43), auto-`Tag` on job completion |
| **7. Billing & POS** | Partial (engine correct since M2; discount/GST order, PAN gate, split payment, override log, Estimate mode and Sales Return/Credit Note all done — M7–M12) | Advance/Booking (PRD §7.6), Repair/Alteration billing (§7.9), barcode-scan-to-bill |
| **8. Old Gold Buyback** | Partial (valuation engine, purchase voucher and vault lifecycle all done — M14/M15) | Item photo capture, Margin Scheme mode, damaged-tag melting loop (M43) |
| **9. GST Compliance** | Not Started | Tax Master, HSN split, e-Invoice/e-Way Bill |
| **10. Accounting** | Not Started | Everything — no entity exists yet |
| **11. BIS Hallmarking** | UI Mockup Only | Real HUID field/uniqueness, AHC workflow |
| **12. Gold Savings Scheme** | Partial (redemption correct since M2) | Multi-scheme master, reminders, passbook |
| **13. CRM & Alerts** | Partial | Reminders, preferences, rate alerts |
| **14. Reports & Dashboards** | Partial (every Dashboard widget now real since M13) | Entire `/reports` hub (M30), Inventory Dashboard (M44), Buyback Dashboard (M53) |
| **15. Security & Statutory** | Partial (PAN threshold enforced + override audit trail, M8/M10) | Statutory Parameters config screen (M34), RBAC enforcement, Supervisor PIN (M33) |
| **16. Hardware & Offline** | UI Mockup Only (Simulation Desk) | Real peripheral integration (not expected in this frontend-only scope) |
