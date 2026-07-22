# TODO.md

Prioritized backlog. Grouped by track since "frontend polish" and "backend/domain design" can proceed in parallel once the open decisions in `HANDOFF.md` are resolved. This is a planning document, not a sprint commitment — re-prioritize freely, but don't silently drop the 🚨-marked items without a recorded reason (add to `DECISIONS.md`).

## Track A — Resolve Open Domain Questions (blocking, do first)
1. 🚨 Get CA sign-off on the diamond HSN classification question (`HANDOFF.md` item 1) before writing any GST engine code.
2. 🚨 Resolve/re-confirm the RBAC/Statutory-Parameters sequencing question (`HANDOFF.md` item 2) — decide whether RBAC and a data-driven Statutory Parameters table should be pulled forward alongside/soon after Phase 2 Master Data work, rather than deferred to Phase 12.
3. If a more complete version of the Developer Handbook (Phases 4–14) exists elsewhere, supply it and regenerate/extend `DATABASE.md`, `MODULE_STATUS.md`, and `DECISIONS.md` accordingly — see `HANDOFF.md` for why this matters.

## Track B — Fix Known Calculation/Compliance Bugs in the Prototype (high priority, self-contained)
Each of these is fully specified in `KNOWN_ISSUES.md` with file/line references:
4. 🚨 Fix Old Gold Exchange to net at settlement, not reduce taxable value before GST (`KNOWN_ISSUES.md` #1).
5. Replace hardcoded `wastagePercent = 3.5` with each item's actual `wastagePercent` (`KNOWN_ISSUES.md` #3).
6. Fix making-charge calculation to branch on `makingChargeType` (`per-gram`/`percentage`/`flat`) and compute Wastage Value and Making Charges as separate figures per PRD §7.2 (`KNOWN_ISSUES.md` #4).
7. Wire "Scheme Redemption" payment method to actually validate against and deduct from `savingsSchemeBalance` (`KNOWN_ISSUES.md` #5).
8. Fix invoice numbering to be sequential/gap-free (at minimum, don't derive it from array length) — full GSTIN-scoping depends on Branch Master existing first (Track C).

## Track C — Backend & Data Model (the real product work)
9. Draft Handbook Phase 4 (Karigar/Job-Work) — and in doing so, design the unification of `WorkOrder` + `JobBag` into one aggregate (`DATABASE.md` §1.1, `KNOWN_ISSUES.md` #10).
10. Draft Handbook Phase 5 (Billing/POS Calculation Engine) as a formal spec, then implement it as one shared, unit-tested function/service (D-9 in `DECISIONS.md`) — write the PRD §17 worked example as its first test case.
11. Draft Handbook Phase 6 (Old Gold Exchange) as its own transaction type/table, separate from the sale invoice.
12. Draft Handbook Phase 7 (GST Compliance Engine) — blocked on Track A item 1.
13. Draft Handbook Phase 8 (Accounting Engine / chart of accounts / auto-posted journal entries).
14. Draft Handbook Phase 9 (BIS Hallmarking & HUID workflow, AHC dispatch/receipt).
15. Draft Handbook Phase 10 (Gold Savings Schemes) — must include the cash-refund hard-block (`DECISIONS.md` D-11).
16. Draft Handbook Phase 11 (CRM/Loyalty, Reports & Dashboards).
17. Draft Handbook Phase 12 (Security, RBAC & Statutory Parameters table) — see Track A item 2 for sequencing.
18. Draft Handbook Phase 13 (multi-tenant SaaS system architecture, offline POS sync design).
19. Draft Handbook Phase 14 (QA/test strategy) — formalize the PRD §17 worked example plus edge cases (zero stone weight, wastage merged into MC, inter-state IGST, split payment, old-gold-only transaction) as the canonical test suite.
20. Design and stand up the actual PostgreSQL schema from `DATABASE.md`, plus the Master Data / Inventory / Billing / Karigar services from `API_REFERENCE.md`.
21. Migrate the current `JewelleryItem` model into the target `item_designs` + `tags` split (`DATABASE.md` §4) — this is a breaking migration, plan it as one.

## Track D — Frontend Cleanup (medium priority, non-blocking, improves maintainability)
22. Extract a shared `useTheme()` hook (or `ThemeContext`) and migrate all six-plus components off the duplicated theme-detection boilerplate (`KNOWN_ISSUES.md` #14).
23. Lift `LooseStone[]` (`StoneManager.tsx`) and `JobBag[]` (`JobBagManager.tsx`) state up to `App.tsx` to match the rest of the app's state pattern (`KNOWN_ISSUES.md` #8).
24. Wire live `items`/`customers`/`karigars` state into `Header.tsx`'s global search instead of the static mock-data import (`KNOWN_ISSUES.md` #9).
25. Migrate the eight raw-Tailwind business screens onto the `ui/` component primitives incrementally; once coverage is complete, retire the corresponding `!important` override rules in `index.css` (`COMPONENT_LIBRARY.md` §3, `KNOWN_ISSUES.md` #12).
26. Remove or deliberately use the dead dependencies (`@google/genai`, `express`, `motion`) and the unused Space Grotesk font import (`KNOWN_ISSUES.md` #13).
27. Add a real barcode/QR generation library (the current Catalog/JobBag "barcode preview" is a static visual mock, not a scannable code) — needed before any real peripheral/scanner integration per PRD §5.3.
28. Add a test runner (Vitest is the natural Vite-native choice) and an ESLint config — neither exists in the repo today.
29. Consider switching `HashRouter` → `BrowserRouter` once a real backend/CDN with SPA fallback routing is in place (`ROUTING.md` §1) — deliberate, not incidental.

## Track E — Nice-to-Have / Later
30. Real barcode/RFID and digital-scale peripheral integration (PRD §5.3, §16.1) — depends on Track C's backend existing first.
31. Offline-capable POS client with genuine local caching and reconnect conflict resolution (PRD §7.1 note, §16.2) — the current "Simulation Desk" is cosmetic only (`API_REFERENCE.md` §2) and should not be mistaken for a starting point for this.
32. WhatsApp/SMS integration for scheme reminders and rate alerts (PRD §13).
33. Tally/Busy/Marg/Zoho Books export connectors (PRD §10.8).
