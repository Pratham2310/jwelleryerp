# CHANGELOG.md

Dated log of changes to the project, covering both documentation and code. Newest entries at the top. This log covers the `.ai/` knowledge base itself as well as the underlying project — any agent making a non-trivial change to code or domain decisions should add an entry here.

---

## 2026-07-22 — AI Development Knowledge Base created (documentation-only pass)

**Author:** AI agent (Claude), acting as Lead Software Architect per project owner's request.
**Scope:** Documentation only. No application code was changed or added.

**What was done:**
- Reviewed the complete project source (`stitch-jewellery-erp` frontend, every file), the full PRD (`Jewellery_Retail_Software_PRD.md`), and the full Developer Handbook (`Jewellery_ERP_Developer_Handbook.md`) end-to-end.
- Created `.ai/` inside the repository with 15 files: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE.md`, `FRONTEND_ARCHITECTURE.md`, `COMPONENT_LIBRARY.md`, `ROUTING.md`, `API_REFERENCE.md`, `CURRENT_PROGRESS.md`, `TODO.md`, `CODING_RULES.md`, `CHANGELOG.md` (this file), `HANDOFF.md`, `DECISIONS.md`, `MODULE_STATUS.md`, `KNOWN_ISSUES.md`.
- Identified and documented 14 concrete issues in the current frontend prototype (`KNOWN_ISSUES.md`), including two GST-compliance-relevant calculation bugs in `BillingEstimator.tsx` (Old Gold Exchange incorrectly reducing taxable value; hardcoded wastage % ignoring per-item configuration).
- Identified and documented that the supplied Developer Handbook only contains Phases 1–3 of its own 14-phase table of contents, and flagged this discrepancy prominently in `HANDOFF.md` and `PROJECT_OVERVIEW.md`, since prior project context implied a more complete draft.
- Logged both outstanding open items from prior project context — the diamond HSN classification ambiguity and the RBAC/Statutory Parameters sequencing question — in `HANDOFF.md` §1–2, with the specific caveat that the RBAC/Statutory Parameters item's underlying reasoning is not present in the Handbook copy reviewed.
- Recorded 11 locked-in architectural decisions (`DECISIONS.md`, D-1 through D-11) with sourcing back to specific PRD/Handbook sections, plus 2 flagged-but-unresolved open decisions.
- Built a full PRD-module-by-Handbook-phase-by-implementation-status matrix (`MODULE_STATUS.md`).
- Built a 33-item, track-organized backlog (`TODO.md`) covering: resolving open domain questions, fixing known prototype bugs, the actual backend/schema build-out (Handbook Phases 4–14), frontend cleanup, and later/nice-to-have items.

**Why this matters going forward:** any future agent (human or AI) working on this repository should read `PROJECT_OVERVIEW.md` and `HANDOFF.md` first, before re-reading the PRD/Handbook from scratch or making schema/calculation-engine decisions, per the project owner's stated goal for this documentation set.

---

_Prior history (before this documentation pass) is not itemized here — it lives in the PRD's and Handbook's own version markers (PRD v1.0; Handbook's own phase-completion checkboxes) and in whatever source control history exists outside this `.ai/` folder. Future entries in this file should log meaningful changes to code, schema, or recorded decisions — not routine formatting/typo fixes._
