# CHANGELOG.md

Dated log of changes to the project, covering both documentation and code. Newest entries at the top. This log covers the documentation knowledge base as well as the underlying project — any agent making a non-trivial change to code or domain decisions should add an entry here.

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
