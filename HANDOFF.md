# HANDOFF.md

**Read this file before doing substantive work on this project.** It captures context that isn't obvious from the code or source documents, including critical open items, document sync rules, and the current roadmap status.

> 🚨 **MANDATORY POST-TASK PROTOCOL:**
> After EVERY completed task, the active agent MUST update all 5 tracking files:
> 1. `CHANGELOG.md`
> 2. `CURRENT_PROGRESS.md`
> 3. `MODULE_STATUS.md`
> 4. `HANDOFF.md`
> 5. `TODO.md`
> 
> Both the root copies and the `.ai/` copies must be kept synchronized (`.ai_backup/` was consolidated into `.ai/` on 2026-07-25 and no longer exists as a separate folder). Never complete a task without updating them.

---

## 1. 🚨 Open Item: Diamond HSN Classification Ambiguity — Needs CA Sign-Off

**The problem:** The PRD is internally inconsistent about how diamond-studded gold jewellery should be taxed under GST.
- PRD §17 (the worked billing example, canonical QA reference) bills diamond value as part of **one composite taxable value**, taxed entirely at the ~3% jewellery GST rate.
- PRD §9.2 (the HSN/GST rate table) lists diamonds **separately** under HSN 7102 at ~1.5% (0.75% CGST + 0.75% SGST).

**Status:** Still unresolved. Requires client CA confirmation. Handbook Phase 7 / §2.8 notes this must be signed off by a Chartered Accountant before the GST Engine goes live.

**Resolution:** Get explicit confirmation from the client's Chartered Accountant. Record in `DECISIONS.md`, then drive Tax Master and Billing Engine logic accordingly.

---

## 2. 🚨 Open Item: RBAC / Statutory Parameters Sequencing

**The problem:** RBAC and a data-driven "Statutory Parameters" table (PAN threshold ₹2L, TCS threshold ₹5L) need to be built alongside Master Data (Phase 2), earlier than the Handbook TOC schedules them (Phase 12).

**Reasoning:** Master Data modules already depend on permission/threshold concepts (Party Master's PAN >= ₹2,00,000 block; Rate Master fat-finger approval).

---

## 3. Handbook Completeness Status: ✅ All 14 Phases Complete

The full 14-phase **Developer Implementation Handbook** (`docs/Jewellery_ERP_Developer_Handbook (1).md`, 2,077 lines) has been read and analyzed in full. It covers:
- **Phase 1:** Business Primer, Weight/Money Dual Ledgers, GML/Consignment Stock, BUIDS Act compliance.
- **Phase 2:** Master Data Architecture (Metal Master, Rate Master append-only DDL, Item/Design Master, Party Master tenant-wide, MC/Wastage 3-tier hierarchy, Stone Rate Master, Tax Master, Branch Master).
- **Phase 3:** Inventory & Tagging (Atomic Tag Model DDL, State Machine transitions, HUID Laser-engraving, At-cost vs At-market valuation).
- **Phase 4:** Procurement & Karigar Management (Procurement DDL, GML drawdown ledger, Karigar Fine Gold Equivalent dual-ledger, Scrap return, Melting loop).
- **Phase 5:** Billing / POS Calculation Engine (Pure stateless calculation function DDL & logic, PRD §17 worked example, line item breakdown, multi-tender split).
- **Phase 6:** Old Gold Exchange Buyback (Old Gold DDL, Purity touch testing, melting deduction %, payment-stage netting, separate purchase voucher).
- **Phase 7:** GST Compliance Engine (e-Invoice IRN/QR code DDL & async queue, e-Way Bill auto-trigger, GSTR-1/3B summary tables, Reverse Charge).
- **Phase 8:** Accounting Engine (Auto-posted double-entry journal vouchers behind every event DDL, Chart of Accounts, Tally Prime XML export).
- **Phase 9:** BIS Hallmarking & HUID Compliance (AHC batch dispatch/receipt DDL, 6-digit HUID tag assignment, non-hallmarked sale block).
- **Phase 10:** Gold Savings Schemes (Swarna Nidhi) (Scheme DDL, monthly installments, bonus calculation, BUIDS Act legal cash refund hard block).
- **Phase 11:** CRM, Loyalty, Reports & Dashboards (Customer 360, WhatsApp rate alerts, real-time Owner Dashboard, Stock Ageing, Karigar Reconciliation).
- **Phase 12:** Security, RBAC & Statutory Hooks (Admin roles DDL, permission matrices, Statutory Parameters table for PAN/TCS/PMLA thresholds, Audit Trail).
- **Phase 13:** System Architecture & Multi-Tenant SaaS Design (Layered SaaS architecture, Postgres schema, Redis caching, offline sync).
- **Phase 14:** QA / Test Strategy & Canonical Worked Example (PRD §17 worked example test suite + 11 edge case test variants, Top-10 developer mistakes).

---

## 4. Development Roadmap & Execution Status

- **Completed so far:** Full codebase analysis, full PRD & complete 14-phase Developer Handbook reading, gap analysis, and a 34-milestone development roadmap in `TODO.md` (restructured 2026-07-25 from the original 13 into single-feature, independently-testable milestones — see `TODO.md`'s header note).
- **✅ Done (2026-07-25): Milestone 1 — State Unification & Design System Cleanup.** `ThemeContext`/`useTheme()` extracted; `LooseStone[]`/`JobBag[]` lifted to `App.tsx`; `Header.tsx` search wired to live state; Vitest configured. See `CHANGELOG.md` and `KNOWN_ISSUES.md` #8, #9, #14.
- **✅ Done (2026-07-25): Milestone 2 — Critical Financial & Billing Calculation Fixes.** Old-gold/GST base bug, hardcoded wastage, making-charge type branching, Scheme Redemption wiring, and invoice numbering all fixed in a new `src/lib/billingCalculations.ts` engine, unit-tested against the PRD §17 worked example. See `CHANGELOG.md` and `KNOWN_ISSUES.md` #1, #3, #4, #5, #11.
- **✅ Done (2026-07-25): Milestone 3 — Item Design vs. Tag Data Model & Catalog UI Split.** `JewelleryItem` split into `ItemDesign` (template) + `Tag` (physical piece, with real `huid` and `stockOwnershipType` fields); `CatalogManager.tsx` rebuilt with Tag Inventory / Item Design Templates tabs. Resolves Handbook decision D-6. See `CHANGELOG.md`.
- **✅ Done (2026-07-25): Milestones 4–10.** Phase 2 (Tagging Foundation) and Phase 3's first four billing-compliance milestones are complete — Tag lifecycle state machine, real barcode/QR generation, Stock Audit UI, discount-before-GST fix, PAN verification gate, multi-payment split, and the manager override reason log. Test suite grew from 10 to **76 passing tests across 5 suites**. See `CHANGELOG.md` for the full per-milestone detail.
- **Next Up:** **Milestone 11 — Estimate / Quotation Mode Toggle** (`TODO.md`), dependent only on Milestone 2 (done).
  - Task 1: Add an `invoiceType: 'ESTIMATE' | 'TAX_INVOICE'` toggle; Estimate mode must skip the PAN gate (Milestone 8) and the invoice-number sequence, and must not deduct stock or transition any Tag to `Sold`.
  - Task 2: Add a "Convert to Tax Invoice" action that re-pulls the current rate or honors the estimate's original rate (staff's explicit choice).
  - **Watch out:** `handleCheckout()` in `BillingEstimator.tsx` now has four sequential validation gates (items present → override reasons → PAN → payment split) before it builds the invoice. Estimate mode needs to bypass the PAN gate specifically, not all four.

### Notes for whoever picks this up

- **Every status change to a `Tag` must go through `canTransition()`** (`src/lib/tagStateMachine.ts`). Do not assign `tag.status` directly anywhere — the whole point of Milestone 4 is that the lifecycle is enforced rather than advisory (Handbook D-6/D-7).
- **New UI must be explicitly theme-aware** via `useTheme()`. `index.css`'s global dark-mode overrides only repaint a fixed list of Tailwind class names; any new combination silently renders wrong in dark mode (`KNOWN_ISSUES.md` #12). This bit the Stock Audit panel during Milestone 6 and was fixed there — don't reintroduce it.
- **The billing calculation engine is the single source of truth** (`src/lib/billingCalculations.ts`, Handbook D-9). Estimate mode, Sales Return (M12), and Old Gold (M14) must all call it rather than re-deriving any formula.

---

## 5. General Handoff Notes

- The frontend prototype (`stitch-jewellery-erp`) and domain design documents (PRD / 14-Phase Handbook) are aligned across the 13 milestones in `TODO.md`.
- Always check `KNOWN_ISSUES.md` and `CODING_RULES.md` before touching calculation logic in `BillingEstimator.tsx`.
