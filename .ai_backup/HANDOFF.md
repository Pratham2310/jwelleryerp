# HANDOFF.md

**Read this file before doing substantive work on this project.** It captures context that isn't obvious from the code or the source documents alone, including two specific open items the project owner has flagged as needing resolution, and an important discrepancy discovered while authoring this documentation set.

## 1. 🚨 Open Item: Diamond HSN Classification Ambiguity — Needs CA Sign-Off

**The problem:** The PRD is internally inconsistent about how diamond-studded gold jewellery should be taxed under GST.
- PRD §17 (the worked billing example, meant to be the canonical QA reference) bills the diamond value as part of **one composite taxable value**, taxed entirely at the ~3% jewellery-composite GST rate.
- PRD §9.2 (the HSN/GST rate table) lists diamonds **separately** under HSN 7102 at a materially different rate (~1.5%, i.e. 0.75% CGST + 0.75% SGST).

These two parts of the same source document contradict each other. The Handbook (§2.8) explicitly calls this out as "an unresolved tension worth flagging before Phase 7 is finalized" and states it should be resolved with the client's CA before the GST module is built, because "this is exactly the kind of ambiguity that's cheap to resolve now and expensive to discover after invoices have already been issued incorrectly."

**Status:** Still unresolved as of this documentation pass. No GST engine exists yet in either the Handbook (Phase 7 is not drafted) or the codebase (GST is a flat hardcoded 3%, see `KNOWN_ISSUES.md` #2/#6).

**What "resolving" it looks like:** Get an explicit answer from the client's Chartered Accountant to the specific question: *"For a single physical jewellery piece with both gold and diamond content, does GST law require a split HSN line (jewellery portion at ~3%, diamond portion at ~1.5%), or is the whole piece taxed as one composite supply at the jewellery rate?"* Record the answer as a new entry in `DECISIONS.md`, then use it to drive the Tax Master (`tax_rates`) design and the Billing Calculation Engine's line-item tax logic (Handbook Phase 7 / Track C in `TODO.md`).

**Do not guess at this or implement either option speculatively** — the Handbook is explicit that this should be a data-driven, CA-confirmed decision, not an engineering assumption, since it has real tax-filing consequences.

## 2. 🚨 Open Item: RBAC / Statutory Parameters Sequencing

**The problem, as flagged in prior project context:** RBAC (role-based access control) and a data-driven "Statutory Parameters" table (the home for PAN/TCS/PMLA/Hallmarking thresholds referenced in PRD §15.3, so they're never hardcoded) may need to be built **alongside Phase 2 (Master Data)**, earlier than the Handbook's table of contents currently schedules them (Phase 12, near the very end of the 14-phase plan).

**Why this might matter:** Several Phase 2 modules already depend on permission/threshold concepts that RBAC/Statutory Parameters would formally own — e.g. Party Master's PAN-≥₹2,00,000 block and TCS aggregation logic (Handbook §2.6 "Business Rules 🚨") is written *as if* a Statutory Parameters table already exists, and Rate Master's "fat-finger" second-approval flow (Handbook §2.3) already implies a permission model. Building these pieces informally now and then formally introducing RBAC/Statutory Parameters much later (Phase 12) risks rework or drift between the informal and formal versions.

**Status:** ⚠️ **Important caveat found during this documentation pass:** the Developer Handbook document actually supplied for this documentation effort (`Jewellery_ERP_Developer_Handbook.md`, 1065 lines) **only contains Phases 1–3 in full** (Business Primer, all 8 Master Data modules, Inventory & Tagging). It does **not** contain any drafted content for Phase 12 (Security, RBAC & Statutory Hooks) or any explicit discussion of pulling RBAC/Statutory Parameters earlier — the TOC simply lists "Phase 12 — Security, RBAC & Statutory Hooks" as a future, undrafted phase, with no further detail. **The specific reasoning/resolution for this sequencing question, referenced in prior project context, is not present in the copy of the handbook available at the time this documentation was authored.**

**What to do:** If a more complete version of the Handbook exists (one that actually drafted Phase 12, or that discusses this sequencing decision explicitly), supply it so this documentation set (`DATABASE.md`, `MODULE_STATUS.md`, `DECISIONS.md`) can be corrected and completed. Otherwise, this sequencing decision needs to be made fresh: the recommendation, based on the dependencies already visible in Phases 1–3, is to **draft a minimal Statutory Parameters table and a basic permission-check layer alongside Phase 2's Party Master and Rate Master work**, rather than waiting until Phase 12 — but this has not been formally decided or recorded as a `DECISIONS.md` entry, and should be before backend work on Phase 2 begins in earnest.

## 3. Handbook Completeness Discrepancy — Read Before Trusting Any "Phase 4+" Reference

The Handbook's own table of contents (top of the document) lists 14 planned phases and marks Phase 1 complete (`[x]`) and Phase 2 in progress (`[~]`). In reality, the document body goes further than its own TOC admits — it fully completes Phase 2 (all 8 Master Data modules) and also fully drafts Phase 3 (Inventory & Tagging) — but **stops there**. Phases 4 through 14 exist **only as single-line TOC placeholders** with no drafted content at all:

```
Phase 4 — Procurement & Karigar/Job-Work Management
Phase 5 — Billing / POS Calculation Engine
Phase 6 — Old Gold Exchange (Buyback)
Phase 7 — GST Compliance Engine
Phase 8 — Accounting Engine
Phase 9 — BIS Hallmarking & HUID
Phase 10 — Gold Savings Schemes
Phase 11 — CRM/Loyalty, Reports & Dashboards
Phase 12 — Security, RBAC & Statutory Hooks
Phase 13 — System Architecture & Multi-Tenant SaaS Design
Phase 14 — QA/Test Strategy & Worked Examples
```

Prior conversation history/memory suggests a more complete draft (covering all 14 phases) may have existed at some point. **The document actually supplied for this documentation-generation task does not contain that content.** This documentation set (`DATABASE.md`, `MODULE_STATUS.md`, `API_REFERENCE.md`, `DECISIONS.md`) has been written to accurately reflect only what Phases 1–3 actually establish, and clearly marks every reference to Phases 4–14 as "not yet drafted" rather than inventing plausible-sounding content for them.

**Action for the next agent:** If a complete 14-phase Handbook is available, supply it, and regenerate/extend the affected `.ai/` files (primarily `DATABASE.md` §3, `MODULE_STATUS.md`, and `DECISIONS.md`'s "Open Decisions" section) to incorporate it. Until then, treat Phases 4–14 as genuinely open design work, not as "already decided but undocumented here."

## 4. General Handoff Notes

- This `.ai/` documentation set was authored by reviewing: `Jewellery_Retail_Software_PRD.md` (full, 759 lines), `Jewellery_ERP_Developer_Handbook.md` (full, 1065 lines, Phases 1–3 only per §3 above), and the entire `stitch-jewellery-erp` frontend source tree (every `.tsx`/`.ts` file, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.css`). No source content was skipped, but the Handbook's Phases 4–14 simply don't exist to review (see §3).
- The frontend prototype (this repo) and the domain design documents (PRD/Handbook) are **not yet aligned** — the prototype was built as a UI/UX reference independent of the deeper domain modeling work, and several of its calculation shortcuts directly contradict explicit PRD business rules (see `KNOWN_ISSUES.md` #1–4, and D-9/D-10 in `DECISIONS.md`). Do not assume the prototype's behavior reflects an intentional simplification of the PRD — in the Old Gold Exchange case (`KNOWN_ISSUES.md` #1) it's a genuine compliance bug if carried forward unchanged.
- No task was implemented as part of creating this documentation set, per the explicit instruction to document-only and not implement new features yet. The next work session should start from `TODO.md`'s Track A (resolve the two open items above) before any new feature/backend work begins.
