# CURRENT_PROGRESS.md

_Last updated: documentation authoring pass, see `CHANGELOG.md`._

## 1. Snapshot Summary

- **Documentation (business/domain design):** PRD complete (v1.0, all 19 sections). Developer Handbook complete for **Phase 1 (Business Primer)**, **Phase 2 (all 8 Master Data modules)**, and **Phase 3 (Inventory & Tagging)**. Phases 4–14 are TOC placeholders only — not drafted (see `HANDOFF.md`).
- **Backend/database:** Not started. No server, no schema migrations, no API exists in this repo.
- **Frontend:** A complete, navigable, high-fidelity 8-screen prototype exists, built against mock/localStorage data, with real (if sometimes domain-incorrect) calculation logic in the Billing screen. See per-screen detail below and `MODULE_STATUS.md` for the PRD-module-by-module mapping.

## 2. Screen-by-Screen Build Status

### Dashboard (`/dashboard`, `Dashboard.tsx`)
Executive KPI overview: today's sales, live stock value, karigar outstanding, active work orders, metal rate ticker with editable rates and inline sparkline history, quick-action buttons (new sale, issue job-work, add item, add customer — these both open a modal *and* navigate to the target screen). Reads `metalRates`, `items`, `karigars`, `invoices`, `customersCount`, `activeWorkOrdersCount` — all lifted state from `App.tsx`. **Does not** reflect `LooseStone`/`JobBag` data at all (that state isn't lifted — see `FRONTEND_ARCHITECTURE.md`).

### Catalog & Showcase (`/catalog`, `CatalogManager.tsx`)
Item/tag CRUD: search/filter by category+status, add-item modal, per-item detail view, barcode/QR preview (`QrCode`/`Barcode` icons — visual mockup only, not a real generated/scannable code), a hallmark badge mock. Conflates Item-Design-template and physical-Tag concepts into one `JewelleryItem` record (see `DATABASE.md` §1.1 — this is the biggest structural gap versus the target Tag-based model).

### Stones & Diamonds (`/stones`, `StoneManager.tsx`)
Loose stone/diamond vault ledger: search/filter by type/cut, issue-to-karigar workflow, add-stone modal. **Owns its own state independent of `App.tsx`** (see `FRONTEND_ARCHITECTURE.md` §3) — an architectural inconsistency versus every other screen.

### Billing Estimator (`/billing`, `BillingEstimator.tsx`)
The most functionally complete screen: multi-line invoice builder (pull from catalog stock or manual entry), customer search/guest checkout, old-gold trade-in field, discount field, payment-method selector, GST computation, printable receipt, and a searchable invoice registry/history tab. **This is also where the most significant calculation-correctness bugs live** — see `KNOWN_ISSUES.md` #1–4. This screen is the de facto "Calculation Engine" today, but it is neither shared/reusable nor unit-tested, which the PRD/Handbook explicitly warn against (PRD §16.1: "single source of truth for all formulas, to avoid divergent calculation bugs").

### Karigar & Jobwork (`/karigar`, `KarigarManager.tsx`)
Karigar directory with running `metalBalance`/`laborChargesOwed`, issue-metal modal, work-order lifecycle (`Assigned → In Progress → Completed → Returned`) with a wastage-cap input and computed actual wastage on completion, payout-confirmation flow for labour charges. Does **not** persist a ledger of individual transactions — `metalBalance`/`laborChargesOwed` are mutated in place with no audit trail, unlike the append-only philosophy required elsewhere in the target system.

### Job Bags Tracker (`/jobbags`, `JobBagManager.tsx`)
A separate, visual Kanban-style stage tracker (`Casting → Filing → Setting → Polishing → Hallmark → Completed`) for karigar jobs, with priority flags, a metal-loss field, an "advance payment" modal, and a tag-preview/print screen. **Owns its own state independent of `App.tsx`**, and is **not data-linked to `WorkOrder`** in `KarigarManager.tsx` despite representing overlapping real-world workflow (see `DATABASE.md` §1.1 for the required future unification).

### Customers & Schemes (`/customers`, `CustomerManager.tsx`)
Customer directory (tier badges, loyalty points, lifetime spend), add-customer modal (auto-computes tier from spend), and a "Swarna Nidhi" gold-savings-scheme balance view per customer with an "add installment" action that credits the balance and bonus loyalty points. **No cash-refund block exists** on scheme balances (Handbook §1.6.1's required legal guardrail is not implemented — expected, since Scheme is a not-yet-designed backend module, but worth flagging early since it's a hard legal requirement, not a nice-to-have).

## 3. What Works End-to-End Today (as a demo)
Login (mock) → browse rates/stock on Dashboard → create a sale in Billing (pulling from Catalog stock, applying an old-gold trade-in and a discount) → invoice appears in the registry and the sold tag flips to `Sold` status in Catalog → issue metal to a Karigar and track a work order to completion → browse customers and bump a scheme balance. All of this persists across page reloads via `localStorage` (but not across browsers/devices, and is wiped by the "Clear DB" button).

## 4. What Does Not Work / Does Not Exist
See `KNOWN_ISSUES.md` for specifics, and `MODULE_STATUS.md` for the full PRD-module matrix. Headline items: no real GST compliance (flat 3%, no CGST/SGST/IGST split, no HSN), Old Gold Exchange incorrectly reduces taxable value, no RBAC enforcement, no multi-branch/multi-tenant support, no rate versioning/audit trail, no hallmarking/HUID workflow beyond a display field, no e-Invoice/e-Way Bill/Tally integration, no real barcode/scale peripheral integration, no offline-capable POS behavior (the "offline simulation" is cosmetic only).
