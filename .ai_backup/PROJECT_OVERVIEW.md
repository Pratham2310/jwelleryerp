# PROJECT_OVERVIEW.md

> Read this file first. It orients any new agent (human or AI) to what this repository is, what it isn't yet, and where to find the deeper documents.

## 1. What This Project Is

**Stitch Jewellery ERP** is a production-grade, multi-tenant SaaS ERP/retail-management platform being built for the Indian jewellery ("Sarafa") retail trade — from single-store shops to multi-branch regional chains. The target market is India-specific: gold/silver/platinum/diamond retail, with GST, BIS Hallmarking/HUID, TCS/PMLA, and Karigar (artisan job-work) compliance baked into the domain model, not bolted on.

The **locked architectural decision** (see `DECISIONS.md`) is to build for a **multi-branch regional chain** first — single-store shops are a config-simplified subset of this, and full franchise/national-brand support is deferred but anticipated.

## 2. What This Repository Currently Contains

This repo currently contains **only the frontend** — a high-fidelity, browser-only prototype called **"Stitch ERP"**, generated via Google AI Studio's "Stitch" design-to-code tool. Concretely:

- A React 19 + Vite 6 + TypeScript single-page app (`src/`) with no backend, no database, and no API server.
- All "persistence" is `localStorage` in the browser. All "business logic" (billing calculations, GST, karigar wastage) lives inline inside React components.
- A mock authentication flow (any email/password logs in; there's also a one-click "Guest" login). No real RBAC is enforced anywhere.
- Eight screens: Dashboard, Catalog (item/tag showcase), Stones & Diamonds, Billing Estimator (POS), Karigar & Jobwork, Job Bags Tracker, Customers & Schemes.
- Leftover Google AI Studio scaffolding (`@google/genai`, `express`, `motion` in `package.json`) that is **not used anywhere** in the current code — dead dependencies, not a hidden backend.

**In short: this is a UI/UX reference implementation and interactive demo, not yet the production system described in the PRD/Handbook.** Building the real product means designing the actual multi-tenant backend, database, and calculation engine described in the PRD and Handbook, and either evolving this frontend or rebuilding it against real APIs.

See `MODULE_STATUS.md` for a precise module-by-module implementation status, and `KNOWN_ISSUES.md` for calculation-correctness bugs already found in the prototype (some of which — e.g. how Old Gold Exchange interacts with taxable value — are **GST-compliance-breaking** if carried into production unchanged).

## 3. Source Documents (in `/mnt` at doc-authoring time, not in this repo)

Two documents govern all business/domain decisions. They are dense and load-bearing — read them, don't skim them, before making schema or calculation-engine decisions:

1. **`Jewellery_Retail_Software_PRD.md`** (v1.0, 759 lines) — the original Product Requirement Document. Section 1 is a mandatory glossary (GW/SW/NW, Wastage, HUID, Karigar, etc.) that every other section assumes you know. Section 17 is a worked billing example that QA should replicate as literal unit tests. Section 19 is a glossary quick-reference.
2. **`Jewellery_ERP_Developer_Handbook.md`** (1065 lines) — a phase-by-phase engineering elaboration of the PRD, written by a "Senior Product Architect / Indian Jewellery Domain Expert." It critiques the PRD, fills domain gaps the PRD misses (most importantly: **Gold Metal Loan / consignment stock ownership**, §1.6), and gives concrete PostgreSQL DDL + full 18-point analysis (Business Objective → Phase Completion Checklist) per module.

**⚠️ Important gap:** The Handbook's own table of contents lists 14 planned phases, but **the copy of the handbook available when this documentation was authored only contains Phases 1–3 in full** (Business Primer, all 8 Master Data modules, and Inventory/Tagging). Phases 4–14 (Karigar ledger, Billing Engine, Old Gold, GST, Accounting, Hallmarking, Schemes, CRM/Reports, RBAC/Security, System Architecture, QA) are **only single-line TOC placeholders, not yet drafted**, despite prior conversation history suggesting a more complete draft existed. **If a more complete Handbook exists, it should be re-supplied and this documentation set updated accordingly.** See `HANDOFF.md` for the full detail on this discrepancy and the two specific open items it left unresolved.

## 4. How to Use This `.ai/` Knowledge Base

| File | Read this when you need to know... |
|---|---|
| `PROJECT_OVERVIEW.md` | (this file) The big picture, orientation |
| `ARCHITECTURE.md` | Current (frontend-only) vs. target (multi-tenant SaaS) system architecture |
| `DATABASE.md` | Current fake "schema" (TS interfaces + localStorage) vs. target Postgres schema from the Handbook |
| `FRONTEND_ARCHITECTURE.md` | React app structure, state management pattern, theming, build tooling |
| `COMPONENT_LIBRARY.md` | The `ui/` components, design tokens, and — importantly — how inconsistently they're actually used |
| `ROUTING.md` | Every route, what guards it, what props it wires up |
| `API_REFERENCE.md` | There is no real API yet — this documents the *simulated* API behavior and what a real API needs to expose |
| `CURRENT_PROGRESS.md` | What's actually built, screen by screen, against the PRD's 14 modules |
| `TODO.md` | Prioritized backlog to go from prototype → production |
| `CODING_RULES.md` | Conventions this codebase follows (and where it's inconsistent) — follow these for new code |
| `CHANGELOG.md` | Dated log of what changed in the project (docs and code) |
| `HANDOFF.md` | **Read this early.** Critical unresolved context, the two open items, and the handbook-completeness discrepancy |
| `DECISIONS.md` | Every architecture decision that's been locked in, and why |
| `MODULE_STATUS.md` | Per-PRD-module status: Not Started / Prototype UI Only / Partially Correct / Done |
| `KNOWN_ISSUES.md` | Concrete bugs in the current prototype, including GST-compliance-breaking ones |

## 5. Non-Negotiable Domain Rules (memorize these before writing any calculation code)

These come from the PRD/Handbook and must never be violated by new code, regardless of what shortcuts the current prototype has taken:

1. **Weight and Money are two parallel ledgers that must always reconcile.** Never persist a money value without also persisting the weight it was computed from and the exact rate version used.
2. **Old Gold Exchange is a separate purchase transaction settled at the payment stage — it is never a discount on the new sale's taxable value.** (The current prototype violates this — see `KNOWN_ISSUES.md` #1.)
3. **GST rates, HSN codes, and statutory thresholds (PAN/TCS/PMLA) must live in versioned, database-driven master tables — never hardcoded constants.**
4. **Every physical piece of jewellery is a uniquely-weighed Tag, never a quantity-counted SKU.**
5. **Rate Master is append-only / event-sourced.** "Correcting" a rate means inserting a new dated row, never `UPDATE`-ing history.
6. **Gold Savings Scheme balances must be legally blocked from cash refund by default** (Banning of Unregulated Deposit Schemes Act, 2019 exposure) — redemption is jewellery-only unless explicitly overridden with a logged compliance reason.
7. **HSN classification of diamond-studded gold pieces is an open, CA-sign-off-required question** — see `HANDOFF.md` item 1 before building the GST engine.
