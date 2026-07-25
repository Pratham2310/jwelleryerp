# CURRENT_PROGRESS.md

_Last updated: 2026-07-25 — Full project audit (codebase vs. `docs/Jewellery_Retail_Software_PRD.md`, `docs/Jewellery_ERP_Developer_Handbook (1).md`, and the `.ai/` knowledge base), refreshed after Milestone 3. Milestones 1, 2 & 3 (state unification, critical billing/GST fixes, Item Design vs. Tag data model split) are implemented and reflected below — see `CHANGELOG.md`. This audit is code-verified (every claim below was checked against the actual source in `src/`), not carried forward from prior narrative._

⚠️ **Doc-sync note:** `.ai/ARCHITECTURE.md`, `.ai/DATABASE.md`, `.ai/FRONTEND_ARCHITECTURE.md`, `.ai/COMPONENT_LIBRARY.md`, `.ai/ROUTING.md`, `.ai/API_REFERENCE.md`, `.ai/CODING_RULES.md`, and `.ai/DECISIONS.md` were **not** part of this audit's requested update scope, but this audit discovered they still describe the **pre-Milestone-1/2 codebase** (e.g. they say Stone/JobBag state isn't lifted, theme detection is duplicated six times, and GST is computed on the wrong base — all fixed on 2026-07-25). They should be refreshed in a follow-up pass; treat their current content as stale where it conflicts with this file.

---

## 1. Executive Snapshot Summary

- **Documentation (Business/Domain Design):** PRD complete (v1.0, 19 sections). Developer Handbook fully drafted, all 14 phases.
- **Backend / Database:** Not started (no server, no PostgreSQL database, no API endpoints) — this is a deliberate scope decision (see `.ai/PROJECT_OVERVIEW.md`), not a gap to close inside this repo. All persistent data relies on `localStorage`.
- **Frontend Prototype ("Stitch UI"):** React 19 + Vite 6 + TypeScript SPA, 7 business screens + auth. Milestone 1 (state unification/theme), Milestone 2 (billing/GST calculation correctness), and Milestone 3 (Item Design vs. Tag data model split) are complete. Milestones 4–36 (the remaining PRD/Handbook functional depth, per the restructured `TODO.md` roadmap) are **not started**.
- **Reference material discovered this audit:** `docs/stitch_jewelry_management_suite/stitch_jewelry_management_suite/` contains 22 AI-Studio-generated screen designs (`code.html` + `screen.png` each) for modules that do **not** exist in `src/` yet — e.g. `old_gold_purchase_voucher/`, `karigar_outstanding_ledger/`, `gst_compliance_dashboard/`, `scheme_management_dashboard/`, `branch_gstin_configuration/`, `daily_rate_master_hq/`, `tagging_inventory_entry/`, `stock_ageing_velocity_analysis/`, `owner_s_executive_dashboard/`. These are pre-made visual references for ~20 of the missing screens identified below — check here before designing a missing screen from scratch.
- **Gap Analysis Result:** The billing calculation engine is correct and unit-tested (PRD §17 worked example passes), and the Item Design vs. Tag split (the PRD's single most load-bearing structural requirement, per Handbook D-6) is now done. Every other module remains at "UI mockup" or "partial" depth relative to the PRD's 16 modules — there is still no Tax/Branch/Rate-history/Stone-rate master, no Tag lifecycle state machine, no real barcode/QR generation, no accounting engine, no real GST compliance, and no real hallmarking/HUID assignment workflow (though the `huid` field itself now exists on `Tag`).

---

## 2. Screen-by-Screen Detailed Audit

### 2.1 Dashboard (`/dashboard`, `Dashboard.tsx`)
- **What Exists:** KPI cards (Today's Sales Revenue, Showcase Inventory count, Active Artisan Jobwork, Karigar Outstanding Gold — all computed from real lifted state). Live metal-rate grid with inline edit and an 8-point sparkline. A category-weight doughnut chart computed from real `items` data. A recent-invoices table (real data).
- **Missing / Fake:**
  - The "Monthly Sales Revenue Trend" line chart is **entirely hardcoded SVG data** (`Feb 120k, Mar 180k...`), not derived from `invoices` — this reads as real but is decorative.
  - The "ERP Action Log" panel is a **static hardcoded list** (4 fixed entries), not a real event/audit feed.
  - No Branch selector (single implicit branch).
  - Rate edits mutate `metalRates` directly in place — no append-only rate history, no audit log, no fat-finger (>2–5%) change guard/approval, matching PRD §4.2's explicit requirement.
  - Does not reflect Stone vault balances or Job Bag stage counts (that state exists in `App.tsx` since Milestone 1, but Dashboard was never wired to consume it — see §4 "Missing Business Logic" wiring note below).

### 2.2 Catalog & Showcase (`/catalog`, `CatalogManager.tsx`)
- **What Exists:** **(2026-07-25, Milestone 3)** Rebuilt with a two-tab interface — **Tag Inventory** (grid view, category/status/stock-ownership filters, search by SKU/name/certificate/HUID; detail modal with a "Tag Preview" printable label showing the piece's *real* `huid` field, or "Not Yet Hallmarked" if unset) and **Item Design Templates** (a grid of design cards showing category/metal/default wastage/making-charge/HSN and a live tagged-stock count per design, with its own Add Design modal). `ItemDesign`/`Tag` are now genuinely separate types (`types.ts`), resolving PRD §5.1/Handbook D-6. Adding a new Tag requires selecting its parent Item Design, which pre-fills defaults (still editable). Each Tag shows a Stock Ownership badge (`OWNED`/`GML_FINANCED`/`CONSIGNMENT`).
- **Missing:**
  - The barcode in the "Tag Preview" modal is still a decorative `lucide-react` `Barcode` icon, not a real generated/scannable barcode or QR code (Milestone 5).
  - `Tag.status` is still the same 4-value union as before (`In Stock`/`In Showcase`/`Sold`/`Out for Jobwork`) — no enforced state machine yet, and no `PendingHallmark`/`Hallmarked` states (Milestone 4).
  - No Digital Scale "fetch weight" button, no Bulk Stock Audit/scan-and-reconcile UI (Milestone 6).
  - No AHC hallmarking dispatch/receipt flow to actually *assign* a HUID — the field exists and displays correctly, but nothing populates it except manual entry in the Add Tag form (Milestone 24).
  - No three-tier Making-Charge/Wastage override hierarchy (Category Slab → Design → Transaction) — only the Design-default tier exists; no category-level slab master.

### 2.3 Stones & Diamonds (`/stones`, `StoneManager.tsx`)
- **What Exists:** Loose stone/diamond inventory table, Add Stone modal, Issue-to-Karigar / Return-to-Vault flow. **(2026-07-25)** State lifted to `App.tsx` — no longer isolated (Milestone 1).
- **Missing:** No 4Cs Diamond Rate Matrix/slab master (PRD §4.6) — `valuePerCarat` is typed in ad hoc per lot, with no lookup table by cut/color/clarity/carat-range. No stone certificate PDF viewer/upload. No loose-stone return-from-karigar workflow distinct from the vault return already present. Not yet wired into Billing (a billed item's `stoneCharge` is a free-typed number, never sourced from a real `LooseStone` record).

### 2.4 Billing Estimator & POS (`/billing`, `BillingEstimator.tsx`)
- **What Exists (substantially corrected 2026-07-25, Milestone 2):** Multi-item invoicing with a real, unit-tested calculation engine (`src/lib/billingCalculations.ts`) — metal value, wastage value (per-item %), making charge (branches on `per-gram`/`flat`), stone charge, GST correctly computed on the full taxable subtotal. Old Gold trade-in is correctly netted only at the final settlement stage, never against the taxable base. Scheme Redemption validates against and debits the real customer balance. Invoice numbers are a gap-free per-year sequence. Printable receipt + searchable registry.
- **Missing:**
  - **Mandatory PAN Verification Modal** at ≥₹2,00,000 (PRD §4.4/§15.3) — no such dialog exists.
  - **Multi-Payment Split UI** — only a single payment-mode selector exists; PRD §7.5 requires splitting one bill across Cash+Card+UPI+Scheme+Old-Gold simultaneously.
  - **Manager-approval-with-logged-reason** workflow for overriding rate/wastage/making-charge/discount at the counter (PRD §7.1 step 4, §15.1) — every field is freely editable with no approval gate.
  - **Estimate/Quotation mode** (PRD §7.8) — no non-fiscal toggle exists; every generated document is treated as a final tax invoice.
  - **Advance/Booking (token advance)** module (PRD §7.6) — entirely absent.
  - **Repair/Alteration billing sub-module** (PRD §7.9) — entirely absent.
  - **Sales Return / Credit Note** flow — entirely absent.
  - **HUID printing per invoice line** (PRD §9.3) — no `huid` field exists on `InvoiceItem`.
  - **TCS/PMLA threshold logic** — no computation or flag anywhere.
  - Discount is applied **after** GST (against the invoice total), not before GST against the taxable value as PRD §7.4 specifies — a known, deliberately-preserved simplification from Milestone 2 (not yet fixed).
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

### 2.8 Auth & RBAC (`/login`, `/register`, `LoginPage.tsx`, `RegisterPage.tsx`)
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
2. Tag/Physical Stock Audit & Reconciliation screen.
3. Procurement / Goods Receipt entry screen.
4. Melting workflow screen.
5. Standalone Old Gold Purchase Voucher screen (buy outright, no linked sale) — reference design exists: `docs/stitch_jewelry_management_suite/.../old_gold_purchase_voucher/`.
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
1. PAN Verification modal (Billing, ≥₹2L).
2. Multi-payment split panel (Billing).
3. Manager/Supervisor approval + reason-log modal (rate/wastage/discount override, invoice cancellation).
4. Sales Return / Credit Note modal.
5. Advance/Booking (token advance) modal.
6. Old Gold standalone purchase-voucher modal (distinct from Billing's inline trade-in fields).
7. Rate history/audit-trail modal.
8. Fat-finger rate-change confirmation (Dashboard rate edit has zero deviation validation today).
9. Karigar excess-wastage review/flag modal (currently silently capped, never surfaced).
10. HUID assignment / AHC dispatch modal.
11. Non-hallmarked-item sale-block warning modal.
12. Scheme cash-refund block warning (explicit UI guard).
13. Duplicate-customer merge dialog.
14. Stock write-off / damaged-item modal.
15. Branch/GSTIN configuration modal.

### 3.4 Missing Workflows
1. Full Tag lifecycle state machine (`RawMetal → IssuedToKarigar → ReceivedFromKarigar → PendingHallmark → Hallmarked → InStock → {MemoOut, TransferInTransit, Sold, DamagedOrMelted}`) — today `JewelleryItem.status` is a flat 4-value union with no enforced transitions.
2. Karigar ledger as an append-only transaction history (vs. two mutable running totals).
3. `WorkOrder` ↔ `JobBag` unification into one Karigar Job-Work aggregate.
4. Barcode-scan-to-bill.
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
8. A shared barcode/QR rendering component — currently two different screens (`CatalogManager`, `JobBagManager`) each render a decorative, non-functional `lucide-react` icon standing in for a real barcode/QR.

### 3.7 Missing Business Logic
1. Fine Gold Equivalent (purity-adjusted gram) calculation in the Karigar module.
2. Three-tier Making-Charge/Wastage override resolution (Category Slab → Item Design default → Transaction-time override) — only two of the three tiers exist today, and there's no shared resolution function.
3. PAN/Form-60/TCS/PMLA threshold checks — entirely absent.
4. CGST/SGST vs. IGST auto-determination by comparing branch state to customer state.
5. HSN-based tax lookup (vs. the current hardcoded flat 3%).
6. FIFO/weighted-average stock costing (at-cost vs. at-market dual valuation).
7. Fixed-point/decimal arithmetic — the app still uses plain JS floating-point + `Math.round`, not a decimal library (PRD §16.2 explicitly warns against float arithmetic for money).
8. Tag state-machine transition validation (no `canTransition()` function exists yet).
9. HUID uniqueness enforcement (no `huid` field exists to enforce uniqueness on).
10. Old Gold melt/touch valuation as a reusable function (`Net Payable Weight = grossWeight × testedPurity% × (1 − meltingLoss%)`) — the PRD §8.2 formula exists nowhere in code; Billing's inline trade-in fields take a flat rate/weight input with no purity-test/melting-loss step.
11. Double-entry journal posting.
12. Discount-before-GST calculation (PRD §7.4) — current app applies discount after GST, against the invoice total, not against the pre-GST taxable value.
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
| **5. Inventory & Tagging** | Partial (Design/Tag split done since M3) | Tag state machine (Milestone 4), real barcode/QR (Milestone 5) |
| **6. Karigar & Jobwork** | Partial | Ledger history, Fine Gold Equivalent, WorkOrder/JobBag unification |
| **7. Billing & POS** | Partial (core engine correct since M2) | PAN modal, multi-payment split, Estimate mode |
| **8. Old Gold Buyback** | Partial (settlement math correct since M2) | Standalone purchase voucher, melt/touch valuation |
| **9. GST Compliance** | Not Started | Tax Master, HSN split, e-Invoice/e-Way Bill |
| **10. Accounting** | Not Started | Everything — no entity exists yet |
| **11. BIS Hallmarking** | UI Mockup Only | Real HUID field/uniqueness, AHC workflow |
| **12. Gold Savings Scheme** | Partial (redemption correct since M2) | Multi-scheme master, reminders, passbook |
| **13. CRM & Alerts** | Partial | Reminders, preferences, rate alerts |
| **14. Reports & Dashboards** | Partial (KPIs real, 2 widgets fake) | Entire `/reports` hub |
| **15. Security & Statutory** | Not Started | Statutory Parameters table, any enforcement |
| **16. Hardware & Offline** | UI Mockup Only (Simulation Desk) | Real peripheral integration (not expected in this frontend-only scope) |
