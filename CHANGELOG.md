# CHANGELOG.md

Dated log of changes to the project, covering both documentation and code. Newest entries at the top. This log covers the documentation knowledge base as well as the underlying project — any agent making a non-trivial change to code or domain decisions should add an entry here.

---

## 2026-07-26 — Phase 3 Complete: Milestones 11–13, plus a Roadmap Coverage Audit

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`), roadmap, and tracking documentation. Completes Phase 3 (Billing Compliance & Correctness). No visual redesign — all new UI reuses the app's established patterns and colour tokens.

**Milestone 11 — Estimate / Quotation Mode:** a non-fiscal Estimate document type (PRD §7.8) alongside the Tax Invoice. Estimates draw from their own `EST-<year>` sequence so they never consume a GST tax-invoice number (Rule 46 requires that series to contain only real supplies), deduct no stock, collect no payment, touch no scheme balance, and skip the PAN gate. "Convert to Tax Invoice" makes staff explicitly choose between honouring the quoted rate and re-pricing at today's rate — gold moves daily, so silently picking either would be wrong — and re-applies the PAN gate at conversion, stamping the source estimate so it can't be billed twice.

**Milestone 12 — Sales Return & Credit Note:** GST credit notes against a prior invoice (CGST Act §34) with partial-return support and their own `CRN-<year>` series. `src/lib/salesReturn.ts` reverses a bill-level discount *proportionally* on a partial return — reversing the full discount would refund more than was ever collected, reversing none would refund less. Tests assert a full return nets exactly to zero against `calculateInvoiceTotals`, so the forward and reverse directions can't drift apart. Refunds against a Scheme Redemption sale credit the balance back; old gold is deliberately not unwound (separate purchase transaction, PRD §8.3/D-10).

**Milestone 13 — Dashboard Real-Data Fix:** the Monthly Sales Revenue Trend was hardcoded SVG coordinates with invented values, and the ERP Action Log was four fabricated entries. Both now derive from real state via a new, unit-tested `dashboardAnalytics.ts`. Added the Stone Vault and Metal-On-Factory-Floor KPI cards for state that had been lifted to `App.tsx` since Milestone 1 but never displayed.

**Design decision forced by Milestone 12 — `Sold` is no longer terminal.** Milestone 4 made `Sold` a terminal state, which would have meant a returned ornament could never be resold. Rather than opening `Sold` up, it now has exactly one outgoing edge to a new `Returned` state, reachable only via a credit note — so stock can never be un-sold without a fiscal document. `Returned` quarantines the piece for QC; only `Returned → InStock` makes it sellable again. `DamagedOrMelted` is now the only fully terminal state.

**Correctness issues found and fixed beyond the milestone scope:**
- Estimates and credit notes would both have corrupted revenue reporting. Every revenue figure (Dashboard "Today's Sales Revenue", "Completed Bills", the recent-invoices table, and all registry KPIs) now excludes estimates and nets credit notes.
- The estimate receipt read "Invoice Total (**Tax Invoice**)" on a document stamped "NOT A TAX INVOICE", and carried the BIS Hallmark **certification** — a false declaration on a quotation. Both fixed; the certification block is now tax-invoice-only.
- Milestone 8 gated on PAN but never recorded *which* PAN was collected, leaving no audit trail for the thing the law required. `SaleInvoice.panDeclaration` now stores it.
- Negating zero produced `-0`, which would have rendered as "-₹0" on a zero-value credit line.
- A second instance of `KNOWN_ISSUES.md` #12: SVG `fill-*` utilities aren't covered by `index.css`'s dark-mode repaint (which only remaps `text-*`), so the chart's current-month label rendered dark-on-dark.

**Roadmap coverage audit (2026-07-26):** a client-supplied module list was checked line-by-line against this roadmap and the PRD. The PRD covers every item; the roadmap did not. The original 36 milestones omitted the entire Procurement chain (PRD §6.1), the three statutory financial statements (§10.5/§14.7), manual accounting vouchers, Stock Adjustment, the Melting workflow, the Rate Master screen, User Management, Notification Center, System Health, and the ITC/HSN reports. **Roadmap extended to 53 milestones** (new Phases 12–15, M37–M53), with a Coverage Audit table in `TODO.md` recording the full mapping. Note that the Rate Master gap (M48) means rates are currently edited in place on the Dashboard, which violates decision D-4 outright.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **114 tests passing across 7 suites** (up from 76); `npm run build` clean. Each milestone individually Playwright-verified against the running app. Full regression sweep across all 7 screens, both themes, and a 390×844 mobile viewport: **zero console errors**.

---

## 2026-07-25 — Milestones 4–10 Implemented (Tagging Foundation + Billing Compliance)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. Implements `TODO.md` Milestones 4 through 10, each built, tested, and committed independently. No visual redesign — all new UI reuses the app's established card/modal/filter-chip patterns and color tokens.

**Milestone 4 — Tag Lifecycle State Machine:** `src/lib/tagStateMachine.ts` implements a pure `canTransition(from, to)` over the full 12-state lifecycle (`RawMetal → IssuedToKarigar → ReceivedFromKarigar → PendingHallmark → Hallmarked → InStock → {InShowcase, OutForJobwork, MemoOut, TransferInTransit, Sold, DamagedOrMelted}`), with `Sold`/`DamagedOrMelted` terminal. `Tag.status` is now this enum instead of a free-text 4-value union. Catalog's Tag detail modal gained a guarded "move to next status" control that only offers legal targets and rejects illegal ones with a visible error. Billing's `availableStock`/checkout and Dashboard's in-stock KPI now use `isSellable()`/`canTransition()` (Handbook D-6/D-7). 31 unit tests.

**Milestone 5 — Barcode/QR Generation:** `src/components/ui/TagCode.tsx` wraps `qrcode.react` (QR encoding the Tag/JobBag id) and `jsbarcode` (CODE128 encoding the SKU), replacing the decorative `lucide-react` icons in both Catalog's Tag Preview and JobBagManager's print tag. Also fixed a real bug found while wiring this: Catalog's "Print Tag" called `window.print()` but the sticker was never wrapped in the app's `#print-area` convention, so it printed the whole page.

**Milestone 6 — Physical Stock Audit:** new third Catalog tab. `src/lib/stockAudit.ts`'s `reconcileStockAudit()` compares a scanned tray sequence against the tags the system expects on-premises, flagging missing tags and extra/unexpected scans (unknown codes *and* real tags that shouldn't be in this tray), with a count-and-weight discrepancy report for owner sign-off. 7 unit tests.

**Milestone 7 — 🚨 Discount-Before-GST Fix:** a bill-level discount now reduces the taxable value *before* GST is computed (PRD §7.4). The previous order applied the discount post-GST against the invoice total, overstating GST on every discounted sale. `calculateInvoiceTotals()` gained an explicit `taxableValue` field, clamped at zero. Both invoice display surfaces and the POS summary panel reordered to Subtotal → Discount → GST → Invoice Total. The affected mock invoice's stored figures were corrected (tax 3191 → 3146, grandTotal 108057 → 108012).

**Milestone 8 — Mandatory PAN Verification:** `src/lib/statutoryChecks.ts` blocks checkout at/above ₹2,00,000 without a captured PAN (structural format validation only) or a Form 60 declaration (PRD §4.4/§15.3, Rule 114B). The threshold tests the tax invoice total, not the post-old-gold cash collected. A live banner in the summary panel surfaces the requirement before staff reach checkout. 9 unit tests.

**Milestone 9 — Multi-Payment Split:** `validatePaymentSplit()` allows one bill to be settled across several modes, requiring the tendered amounts to sum exactly to the amount due (PRD §7.5). Split mode is opt-in; the single-mode quick-select remains the default fast path. Scheme Redemption validation is now portion-aware — only the amount actually tendered against the scheme is validated and debited. Invoices record their full `paymentSplit`, shown as "Settled Via" on both display surfaces. 6 new unit tests.

**Milestone 10 — Manager Override + Reason Log:** `src/lib/priceOverrides.ts` detects billing lines edited away from their Tag's master values and blocks checkout until a manager reason (min. 5 chars) is logged per changed field (PRD §7.1 step 4, §15.1). Reasons persist onto the saved invoice line and render as an "Approved Price Overrides" audit block on the receipt. Custom rows with no linked Tag correctly aren't treated as overrides. 11 unit tests.

**Bug found and fixed during this work (beyond the milestone scope):** the "Goddess Lakshmi Gold Coin" design/tag pointed at a dead Unsplash URL, producing an `ERR_BLOCKED_BY_ORB` console error and a broken-image card on Catalog — replaced with a working URL. Separately, my own new Stock Audit panel initially reproduced `KNOWN_ISSUES.md` #12 exactly (unreadable gray-on-gray rows and an invisible white-on-white button in dark mode, because `index.css`'s blanket dark-mode overrides don't cover every ad hoc class combo); fixed by making that panel explicitly theme-aware via `useTheme()` rather than relying on the global override.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **76 tests passing across 5 suites** (up from 10); `npm run build` clean. Each milestone was individually Playwright-verified against the running app (state transitions rejected/accepted correctly, real QR/barcode SVG geometry rendered, audit discrepancies flagged, discount-before-GST arithmetic confirmed on screen, PAN gate blocking then allowing checkout, split payment under/overpayment blocked then settled, override gate blocking then logging). A final full-app regression pass across all 7 screens, both themes, and a 390×844 mobile viewport reported **zero console errors**.

---

## 2026-07-25 — Live Deployment QA Pass (jwelleryerp.vercel.app) & Mobile Sidebar Fix

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Manual/automated QA against the production Vercel deployment, one bug fix.

**What was done:**
- Full Playwright walkthrough of the live deployment as a user: guest login, theme toggle, Catalog (both tabs), Add Tag/Add Design modals, Stones & Diamonds, Billing (line-item pull, old-gold trade-in, invoice generation, registry), Karigar & Jobwork, Job Bags, Customers & Schemes, global header search, and every "Add"/"Register"/"Issue" modal — confirmed the deployment is live and current (matches the Milestone 1-3 codebase; e.g. real `huid`/Stock Ownership fields render correctly in the Tag detail and print-preview modals).
- Specifically re-verified the two Milestone 2 GST/compliance fixes against production data: an invoice with an old-gold trade-in correctly shows GST computed on the full taxable subtotal with the old-gold value netted only against Net Amount Due; Scheme Redemption correctly blocks checkout with a visible error for a customer without an active scheme.
- 🐛 **Found and fixed:** on mobile viewports, opening the sidebar (hamburger toggle) rendered the drawer at `z-50`, fully covering the same hamburger button underneath it (`z-40`) — there was no way to close the drawer except tapping a narrow, unlabeled backdrop strip. Fixed by adding a visible `X` close button inside the mobile sidebar's header row (`src/components/Sidebar.tsx`), matching the close-button pattern already used in every modal elsewhere in the app.
- No other bugs, console errors, or broken flows found in this pass.

**Verification:** `npx tsc --noEmit` clean; `npm test` (10/10 passing); `npm run build` clean; local Playwright test at a 390×844 mobile viewport confirming the new close button dismisses the drawer, the hamburger button still reopens it, and in-app navigation still auto-closes it — zero console errors throughout.

---

## 2026-07-25 — Milestone 3 Implemented (Item Design vs. Tag Data Model & Catalog UI Split)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. Implements `TODO.md` Milestone 3, following the PRD (§5.1-5.2), the Developer Handbook (Phase 2 §2.5, Phase 3, decision D-6), and the existing Stitch UI design system (no visual redesign — new UI reuses the app's established card/modal/filter-chip patterns and color tokens).

**What was done:**
- Split `src/types.ts`'s `JewelleryItem` into two interfaces: `ItemDesign` (the design *template* — category, metal, default wastage %/making-charge/stone-type, HSN, image, active flag; never carries weight or stock status) and `Tag` (the atomic, individually-weighed, sellable physical piece — gross/net weight, stone details, `huid?: string`, `stockOwnershipType: 'OWNED' | 'GML_FINANCED' | 'CONSIGNMENT'`, status). This resolves Handbook decision D-6, previously flagged in `DECISIONS.md` and `DATABASE.md` §1.1 as not yet implemented.
- `src/data/mockData.ts`: `initialJewelleryItems` replaced with `initialItemDesigns` (8 design templates) + `initialTags` (8 physical pieces, IDs kept identical to the old `item-N` records so existing mock `SaleInvoice.items[].itemId` references still resolve).
- `App.tsx`: lifted `itemDesigns`/`setItemDesigns` and `tags`/`setTags` state (replacing `items`/`setItems`), each with its own `localStorage` key (`stitch_item_designs`, `stitch_tags`); updated every route's props accordingly.
- `CatalogManager.tsx` rebuilt with a two-tab interface — **Tag Inventory** (the existing grid/detail/tag-preview UI, now showing a Stock Ownership badge and the real `huid` field instead of a hardcoded mock string) and **Item Design Templates** (a new grid of design cards showing defaults and tagged-stock count, with its own Add Design modal). The "Add Tag" modal now requires selecting a parent Item Design, which pre-fills category/metal/wastage/making-charge/stone-type defaults onto the new tag (still fully editable). Clicking a design card jumps to the Tag Inventory tab pre-filtered to that design's tags.
- Added a Stock Ownership filter row (Owned / GML Financed / Consignment) to the Tag Inventory tab, per Handbook §1.6/D-3.
- `BillingEstimator.tsx`, `Header.tsx`, `Dashboard.tsx` updated to consume `Tag[]` (renamed from `items`/`JewelleryItem[]`) — no behavioral changes to billing math, search, or KPI calculations, since `Tag` retains every field these screens previously read.

**Explicitly not done in this milestone** (scoped to later milestones per `TODO.md`): the full Tag lifecycle state machine (`RawMetal → ... → Sold`, Milestone 4) — `Tag.status` remains the same 4-value union as before; real barcode/QR generation (Milestone 5) — the tag preview modal still shows a decorative icon, now alongside the real HUID; the three-tier Making-Charge/Wastage override hierarchy (Category Slab → Design → Transaction) is not built, only the Design-default tier exists.

**Verification:** `npx tsc --noEmit` clean; `npm test` (10/10 passing, unaffected); `npm run build` clean; Playwright smoke test (guest login → Catalog Tag Inventory tab → Item Design Templates tab → clicking a design filters Tag Inventory → adding a new Tag against a selected Design correctly auto-fills and saves → adding a new Design Template → global header search still finds live tags → Billing still pulls stock and generates a correct invoice → Dashboard KPIs still render) with zero browser console errors.

---

## 2026-07-25 — Milestone 1 & Milestone 2 Implemented (State Unification + Critical Billing Fixes)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. First code milestones executed against the `TODO.md` roadmap.

**What was done — Milestone 1 (State Unification & Design System Cleanup):**
- Extracted `src/contexts/ThemeContext.tsx` (`ThemeProvider` + `useTheme()`), removing the duplicated `useState` + `MutationObserver` theme-detection block from `StoneManager.tsx`, `JobBagManager.tsx`, `BillingEstimator.tsx`, `CatalogManager.tsx`, `Sidebar.tsx`, and `Header.tsx` (`KNOWN_ISSUES.md` #14).
- Lifted `LooseStone[]` and `JobBag[]` state (with their `localStorage` sync) out of `StoneManager.tsx`/`JobBagManager.tsx` and into `App.tsx`, mirroring the existing pattern for `items`/`customers`/`karigars` (`KNOWN_ISSUES.md` #8).
- Wired live `items`/`customers`/`karigars` state into `Header.tsx`'s global search instead of static `mockData` imports (`KNOWN_ISSUES.md` #9).
- Added Vitest (`vitest.config.ts`, `npm test`).

**What was done — Milestone 2 (Critical Financial & Billing Calculation Fixes):**
- Extracted a pure, unit-tested calculation engine at `src/lib/billingCalculations.ts` (`calculateLineItem`, `calculateInvoiceTotals`, `settleOldGold`), implementing PRD §7.2/§7.3 literally.
- 🚨 Fixed Old Gold Tax Deduction (`KNOWN_ISSUES.md` #1): GST is now computed on the full taxable subtotal; old gold is applied only as a settlement credit against the final `netAmountDue`, never against the taxable base.
- 🚨 Fixed hardcoded wastage (`KNOWN_ISSUES.md` #3): each billing line now uses its own `wastagePercent` (from the item master, or a new manual input for custom rows) instead of a fixed 3.5%.
- 🚨 Fixed making-charge type handling (`KNOWN_ISSUES.md` #4): `per-gram` vs `flat` now branches correctly, and Wastage Value is computed and displayed as its own line, separate from Making Charge.
- Wired Scheme Redemption to the customer's actual `savingsSchemeBalance` (`KNOWN_ISSUES.md` #5): validates sufficient balance before checkout and deducts on success.
- Replaced array-length-derived invoice numbers with a gap-free, `localStorage`-persisted per-financial-year sequence (`KNOWN_ISSUES.md` #11).
- Added `wastagePercent`, `makingChargeType`, `makingChargeValue`, `wastageValue` to `InvoiceItem` and `netAmountDue` to `SaleInvoice` (`types.ts`); updated `mockData.ts`'s two sample invoices to the corrected math.
- Added `src/lib/billingCalculations.test.ts`, replicating the PRD §17 worked example (Metal ₹1,48,800 / Wastage ₹7,440 / Making ₹13,200 / Stone ₹1,20,000 / Taxable ₹2,89,440 / GST ₹8,683 / Invoice Total ₹2,98,123 / Net Cash Due after old-gold settlement ₹2,21,046) plus the flat-making-charge, zero-wastage, and zero-old-gold edge cases.
- Reordered both invoice display surfaces (post-checkout receipt, registry "View Bill" modal) to: Taxable Subtotal → GST → Discount → **Invoice Total (Tax Invoice)** → Old Gold Buyback (settlement only) → **Net Amount Due**.

**Explicitly not touched:** the diamond/stone HSN-split question (`HANDOFF.md` item 1) — still unresolved, still requires CA sign-off; GST remains a single flat 3% rate on the composite taxable value, matching the PRD §17 worked example.

**Verification:** `npx tsc --noEmit` clean; `npm test` (10/10 passing); `npm run build` clean; manual Playwright smoke test against the dev server (guest login → theme toggle → Stones/Job Bags pages with lifted state → global search on live data → full billing flow pulling a flat-making-charge item, old-gold trade-in, invoice generation) with zero browser console errors.

---

## 2026-07-22 — Full 14-Phase Developer Handbook Analyzed & Integrated

**Author:** AI agent (Antigravity), pair programming with USER.
**Scope:** Documentation & Project Memory.

**What was done:**
- Located and thoroughly read the complete 14-phase **Developer Implementation Handbook** in `docs/Jewellery_ERP_Developer_Handbook (1).md` (2,077 lines, 144 KB).
- Verified that all 14 phases (Phases 1 through 14) are fully drafted in detail, complete with PostgreSQL DDL schemas, domain rules, calculation formulas, async queue architectures, and QA test strategies.
- Updated `HANDOFF.md`, `CHANGELOG.md`, and project memory files across `.ai/`, `.ai_backup/`, and root directories.

---

## 2026-07-22 — Frontend Gap Analysis & 13-Milestone Development Roadmap Created

**Author:** AI agent (Antigravity), pair programming with USER.
**Scope:** Documentation & Roadmap. No application code written.

**What was done:**
- Conducted an in-depth, feature-by-feature comparison of the current React 19/TypeScript frontend prototype against the PRD (v1.0, 19 sections), Developer Handbook, and Stitch UI.
- Identified and cataloged missing frontend features across all 16 PRD modules.
- Created a 13-milestone development roadmap ordered strictly by architectural dependency.
- Populated `.ai/` and synchronized root and `.ai_backup/` documentation sets (`CURRENT_PROGRESS.md`, `MODULE_STATUS.md`, `TODO.md`, `HANDOFF.md`, `CHANGELOG.md`).

---

## 2026-07-22 — AI Development Knowledge Base Created (Initial Pass)

**Author:** AI agent (Claude), acting as Lead Software Architect.
**Scope:** Documentation initial setup.

**What was done:**
- Created initial `.ai_backup/` documentation set.
