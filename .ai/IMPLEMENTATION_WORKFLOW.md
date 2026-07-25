# IMPLEMENTATION_WORKFLOW.md

**Read this file in full before starting any task below, and update its checkboxes immediately after finishing one — before moving to the next.** This is the live execution checklist for translating the 14-phase `Jewellery_ERP_Developer_Handbook (1).md` into this codebase. It is a working document, not a snapshot — keep it current.

---

## 0. Ground Rules (apply to every task below, no exceptions)

1. **No backend, no real database.** This repo is, and stays, a React 19 + Vite + TypeScript frontend with `localStorage` persistence (see `PROJECT_OVERVIEW.md`). Every "table" in the handbook becomes a TypeScript interface in `src/types.ts` plus `useState` + `localStorage` sync in `App.tsx`, exactly like `items`/`customers`/`karigars` today. Every "service" becomes a pure function (ideally in `src/lib/`, unit-tested) or a component-local handler. There is no PostgreSQL, no Redis, no pub/sub, no microservices — translate the *business rule*, not the *infrastructure*.
2. **No visual/UI redesign.** Reuse the existing design system as-is: same color tokens (`#C5A059` gold accent, `#141416`/`#0A0A0B` dark surfaces, existing `ui/` primitives where already used), same layout shell (`Sidebar`, `Header`, route structure), same modal/card/table patterns already established in each screen. New functionality is added *inside* existing screens (new tabs, new fields, new modals following the current modal pattern) — never a new visual language, never a page redesign, never a new nav item beyond a few well-justified additions this file explicitly calls out.
3. **Government/external API integrations are simulated, not real.** e-Invoice IRN, e-Way Bill, GSP submission, WhatsApp Business API, payment gateways: model only the *data shape and UI state* (a `status` field showing `PENDING`/`GENERATED`/`FAILED`, a mock QR placeholder, a "Simulate Retry" button) — never an actual network call to a government or third-party system. This is consistent with the existing `App.tsx` "Simulation Desk" pattern already in the codebase.
4. **RBAC is cosmetic/functional gating, not real security.** Since there's no backend, "permission checks" mean: hide/disable UI affordances based on the logged-in mock user's role, and gate certain actions behind a "Supervisor PIN" modal that checks a hardcoded/localStorage-stored PIN. This mirrors the existing mock-auth approach (`LoginPage.tsx`) — do not imply real security guarantees anywhere in UI copy.
5. **Follow the existing doc-sync protocol.** After completing each milestone (not each tiny task), update the 5 mandatory tracking files per `HANDOFF.md`'s protocol (`CHANGELOG.md`, `CURRENT_PROGRESS.md`, `MODULE_STATUS.md`, `HANDOFF.md`, `TODO.md`, root + `.ai/` copies) and this file's checkboxes.
6. **Extract shared calculation/domain logic into `src/lib/`, unit-tested.** Following the precedent set by `src/lib/billingCalculations.ts` (Milestone 2) — Fine Gold Equivalent math, wastage-cap checks, GML gram-ledger math, etc. all belong in pure, tested functions, not inlined in components.
7. **Reference material:** `docs/Jewellery_ERP_Developer_Handbook (1).md` (full 14-phase handbook, the source for this checklist), `docs/Jewellery_Retail_Software_PRD.md` (original PRD), `docs/stitch_jewelry_management_suite/stitch_jewelry_management_suite/` (22 AI-Studio-generated screen designs — `code.html` + `screen.png` per module, e.g. `old_gold_purchase_voucher/`, `karigar_outstanding_ledger/`, `scheme_management_dashboard/`, `gst_compliance_dashboard/` — check here first before designing a new screen from scratch, to stay visually consistent with what's already been envisioned for this app).

---

## 1. Status Summary

| Milestone (per `TODO.md`) | Status | Notes |
|---|---|---|
| M1 — State Unification & Design System Cleanup | ✅ Done (2026-07-25) | ThemeContext, lifted Stone/JobBag state, live Header search, Vitest |
| M2 — Critical Financial & Billing Calculation Fixes | ✅ Done (2026-07-25) | `src/lib/billingCalculations.ts`, old-gold/GST fix, wastage, making-charge type, scheme redemption, invoice numbering |
| M3 — Item Design Template vs. Atomic Tag UI Split | ⬜ Not started | This file's §2 below |
| M4 — Thermal Tag Printing & Tag Audit UI | ⬜ Not started | §3 |
| M5 — Advanced POS Billing & Statutory Compliance UI | ⬜ Not started | §4 |
| M6 — Old Gold Buyback Voucher & Valuation Engine | ⬜ Not started | §5 |
| M7 — Karigar Work Order & Job Bag Integration | ⬜ Not started | §6 |
| M8 — Multi-Branch Navigation & IBST | ⬜ Not started | §7 |
| M9 — GST Compliance, e-Invoice & e-Way Bill UI (simulated) | ⬜ Not started | §8 |
| M10 — BIS Hallmarking, HUID & Gold Savings Scheme UI | ⬜ Not started | §9 |
| M11 — Financial Ledgers & Tally Export (simulated) | ⬜ Not started | §10 |
| M12 — Reports Hub & Customer 360 | ⬜ Not started | §11 |
| M13 — Admin RBAC, Statutory Parameters & Hardware UI (simulated) | ⬜ Not started | §12 |

Work top to bottom — each milestone's `TODO.md` dependency chain is real (e.g. M5/M6 depend on M3; M7 depends on M3; M10 depends on M3+M5).

---

## 2. Milestone 3 — Item Design vs. Tag Split (Handbook Phase 2 §2.5, Phase 3)

- [ ] **Types (`src/types.ts`):** Split `JewelleryItem` into `ItemDesign` (template: category, sub-category, metal/purity, default MC type/value, default wastage %, HSN, images, `is_active`) and `Tag` (physical instance: `itemDesignId` FK, `grossWeight`, `stoneWeight`, `netWeight` derived, `huid`, `stockOwnershipType: 'OWNED' | 'GML_FINANCED' | 'CONSIGNMENT'` per Handbook §1.6, `status` state machine per Phase 3 §3, `barcodeValue`).
- [ ] **State (`App.tsx`):** Replace `items`/`setItems` with `itemDesigns`/`setItemDesigns` and `tags`/`setTags`, same lift-to-App-and-localStorage-sync pattern as every other entity. Update every consumer (`CatalogManager`, `BillingEstimator`, `Header` search, `Dashboard`).
- [ ] **`CatalogManager.tsx` (existing screen, add tabs — no redesign):** Add a two-tab structure inside the existing card shell: "Design Templates" and "Tag Inventory," reusing the existing table/grid/filter components already in this file.
- [ ] **Tag status state machine** (`src/lib/tagStateMachine.ts`, unit-tested): enforce the transitions from Handbook Phase 3 §3 (`RawMetal → IssuedToKarigar → ReceivedFromKarigar → PendingHallmark → Hallmarked → InStock → {MemoOut, Sold, TransferInTransit, DamagedOrMelted}`) as a pure function `canTransition(from, to)`, reject illegal transitions in the UI with a validation error (mirroring the existing `validationError` pattern in `BillingEstimator.tsx`).
- [ ] Stock ownership tag displayed as a small badge on Tag rows (`OWNED`/`GML_FINANCED`/`CONSIGNMENT`) — new field, existing badge component style.
- [ ] Three-tier MC/Wastage override groundwork: confirm `calculateLineItem()` (Milestone 2) can accept an already-resolved `wastagePercent`/`makingChargeType`/`makingChargeValue` regardless of which tier resolved it — no calc-engine change needed, just make sure `ItemDesign` carries the "tier 2" default correctly.

## 3. Milestone 4 — Thermal Tag Printing & Audit UI (Handbook Phase 3 §6)

- [ ] Barcode/QR generation library (`qrcode.react` — small, no visual-system impact) for a printable tag sticker preview modal, styled like the existing `JobBagManager.tsx` "Tag Preview" modal (reuse that exact pattern/markup, don't invent a new one).
- [ ] Stock Audit screen: scan-or-manually-enter-barcode input that reconciles against the expected Tag list, flags discrepancies — new modal on the existing Catalog "Tag Inventory" tab.

## 4. Milestone 5 — Advanced POS & Statutory Compliance UI (Handbook Phase 5, Phase 2 §2.6)

- [ ] PAN Verification modal in `BillingEstimator.tsx`, triggered when `finalGrandTotal >= 200000` (mirror the existing modal pattern in `StoneManager.tsx`/`JobBagManager.tsx`) — collects PAN, does format validation only (no real verification API).
- [ ] Multi-payment split UI: replace the single `paymentMethod` selector with a list of `{mode, amount}` rows summing to `finalGrandTotal`, validated exactly like the handbook's "sum of payments must equal Net Payable" rule (Phase 5 §8) — implement as a pure `validatePaymentSplit()` in `billingCalculations.ts`, unit-tested.
- [ ] Proforma Estimate vs. Tax Invoice toggle: a UI-only flag on the invoice (`invoiceType: 'ESTIMATE' | 'TAX_INVOICE'`), estimate mode skips the PAN/GST-compliance gates and prints "ESTIMATE — NOT A TAX INVOICE" instead of "TAX INVOICE."
- [ ] Sales Return / Credit Note: a new tab in the existing Billing Registry, referencing an original `invoiceId`, generating a negative-value linked record — reuse the existing invoice table/detail-modal component patterns.

## 5. Milestone 6 — Old Gold Buyback Voucher & Valuation Engine (Handbook Phase 6)

- [ ] `src/lib/oldGoldValuation.ts` (unit-tested): `Net Payable Weight = grossWeight × testedPurity% × (1 − meltingLoss%)`, `buybackValue = netPayableWeight × buybackRate` — per PRD §17/Handbook Phase 6 §4.
- [ ] Dedicated Old Gold Purchase Voucher modal (separate from the Billing "trade-in" quick fields already in `BillingEstimator.tsx` — that quick path stays for adjust-against-a-sale; this is the standalone "buy old gold, no linked sale" flow), reusing existing modal styling.
- [ ] Old Gold inventory vault state (`OldGoldLot[]`, lifted to `App.tsx` like Stones/JobBags): `In Safe → Melted → Fine Gold Stock`.

## 6. Milestone 7 — Karigar Work Order & Job Bag Integration (Handbook Phase 4 §4.B)

- [ ] Unify `WorkOrder` (KarigarManager) and `JobBag` (JobBagManager) into one shared shape, or add an explicit FK linking them — resolve the KNOWN_ISSUES.md #8 "still open" item.
- [ ] Fine Gold Equivalent ledger (`src/lib/fineGoldLedger.ts`, unit-tested): `fineEquiv = grossWeight × purityFraction`; two independent running balances per karigar — `gramsPayable` and `moneyPayable`, **never netted** (Handbook Phase 4 §4.B critical rule) — replaces the current single mutable `metalBalance`/`laborChargesOwed` fields with an append-only transaction ledger.
- [ ] Wastage-cap breach alert: compare `wastagePctActual` against `karigar.agreedWastagePct`, flag (not auto-bill) when exceeded, per Handbook's "flagged for owner review, not auto-billed" rule.
- [ ] Scrap & unused loose-stone return modal, linked to `StoneManager`'s existing Issue/Return flow.

## 7. Milestone 8 — Multi-Branch Navigation & IBST (Handbook Phase 2 §2.10, Phase 1 §1.9)

- [ ] `Branch` entity (`src/types.ts` + lifted state): `branchCode`, `gstin`, `stateCode`, `invoiceSeriesPrefix`, `defaultStockOwnershipType`. Seed 1-2 mock branches.
- [ ] Branch switcher dropdown in `Header.tsx` (small addition to the existing header bar, same visual style as the existing "Mumbai BST Showroom" static text it replaces).
- [ ] Filter every list screen (Catalog, Stones, Job Bags) by active branch — add a `branchId` field to each entity, default all existing mock data to branch 1.
- [ ] Inter-Branch Stock Transfer: `dispatched → in_transit → received` state on Tags, a new small screen/tab.
- [ ] **Invoice numbering becomes GSTIN-scoped** (Handbook Phase 2 §2.10 critical rule) — extend Milestone 2's `nextInvoiceNumber()` to key off `branch.gstin` instead of just year, closing out `KNOWN_ISSUES.md` #11's "still open (b)" item.

## 8. Milestone 9 — GST Compliance UI, e-Invoice/e-Way Bill (SIMULATED — Handbook Phase 7)

- [ ] Tax Master as data (`TaxRate[]`, lifted state): HSN 7113/7102/9988 rows with CGST/SGST/IGST — replace the hardcoded `0.03` in `billingCalculations.ts` with a lookup, but keep the **single composite-rate behavior** as the default resolution (per `HANDOFF.md` item 1, still unresolved pending CA sign-off) unless/until that's explicitly resolved.
- [ ] CGST+SGST vs. IGST auto-determined by comparing branch state to customer state (needs Milestone 8's `Branch.stateCode` and a `Customer.stateCode` field).
- [ ] e-Invoice status badge on invoices (`PENDING`/`GENERATED`/`FAILED`, `irn` mock string) with a "Simulate Submission" button — no real GSP call, per Ground Rule 3.
- [ ] GSTR-1/3B preview tables: read-only computed views over existing `invoices` state, exportable as CSV (client-side only, no backend export service).

## 9. Milestone 10 — BIS Hallmarking, HUID & Gold Savings Scheme UI (Handbook Phase 9, Phase 10)

- [ ] AHC dispatch/receive batch UI: select `Tag[]` in `PendingHallmark` status, "dispatch," then "receive" assigns `huid` (6-char, globally unique — validate uniqueness against all existing tags before saving) and transitions to `Hallmarked`.
- [ ] Non-hallmarked sale block: `BillingEstimator.tsx` blocks adding a Tag to a bill if it requires hallmarking and has no `huid` (configurable exemption for sub-2g, matching Handbook Phase 9 §9).
- [ ] Scheme Plan Enrollment modal + Passbook print view in `CustomerManager.tsx`.
- [ ] **Scheme cash-refund hard block** (Handbook §1.6.1 / Phase 10 critical rule): redemption UI only ever offers "against jewellery purchase" (already true today, since Milestone 2 wired Scheme Redemption into billing) — explicitly block/hide any hypothetical cash-payout path, with an inline note citing the Banning of Unregulated Deposit Schemes Act, 2019.

## 10. Milestone 11 — Financial Ledgers & Tally Export (SIMULATED — Handbook Phase 8)

- [ ] Chart of Accounts + auto-posted journal entries as client-side derived state (`src/lib/journalPosting.ts`, unit-tested): every invoice/old-gold/karigar-receipt event pushes a balanced `{debit, credit}` pair into a `JournalEntry[]` log, mirroring Handbook Phase 8's event-sourced philosophy — but entirely in `localStorage`, no real ledger DB.
- [ ] Ledger statement viewer, Day Book, Trial Balance — read-only report screens over the journal log.
- [ ] Tally XML export button — generates and downloads a client-side XML blob (no real Tally integration, per Ground Rule 3).

## 11. Milestone 12 — Reports Hub & Customer 360 (Handbook Phase 11)

- [ ] Central `/reports` route: Daily Sales Summary, Inventory Ageing (>90/180 days, using `Tag.createdAt`), Karigar Reconciliation, Gross Margin Realization — all computed client-side from existing state, no new persistence.
- [ ] Customer 360 view in `CustomerManager.tsx`: purchase history timeline (from `invoices`), scheme status, loyalty tier — a detail-drawer reusing the existing modal/drawer pattern.

## 12. Milestone 13 — Admin RBAC, Statutory Parameters & Hardware UI (SIMULATED — Handbook Phase 12)

- [ ] `StatutoryParameters` as a single editable settings object (PAN threshold ₹2L, TCS threshold, PMLA CTR threshold) — lifted state, read by Milestone 5's PAN modal instead of the hardcoded `200000` constant.
- [ ] Role/permission matrix screen (cosmetic gating only, per Ground Rule 4) + Supervisor PIN modal for rate overrides/large discounts/cancellations.
- [ ] Digital Scale / Thermal Printer "connection status" indicators in the existing Simulation Desk panel (`App.tsx`) — extends the pattern already there (Force Offline toggle etc.), no new visual language.

---

## 13. After Every Milestone

1. Run `npx tsc --noEmit`, `npm test`, `npm run build`.
2. Manual smoke test (Playwright, per the pattern used for M1/M2) covering the new screens/flows, screenshot-verified, checked for zero console errors.
3. Update the 5 mandatory tracking docs (`CHANGELOG.md`, `CURRENT_PROGRESS.md`, `MODULE_STATUS.md`, `HANDOFF.md`, `TODO.md`) in root + `.ai/`.
4. Tick the milestone's row in §1's Status Summary table above, and check off its individual bullets in the section above.
5. Re-read this file's Ground Rules (§0) before starting the next milestone — they don't change, but it's easy to drift from them over a long multi-session effort.
