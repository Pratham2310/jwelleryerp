# API_REFERENCE.md

## 1. There Is No Real API Yet

This repository contains **zero network calls** — no `fetch`, no `axios`, no GraphQL client, no WebSocket, nothing. Every "data operation" is a synchronous in-memory React state update, immediately mirrored to `localStorage`. Anywhere the UI *looks* like it's calling a backend (loading skeletons, a "Database Connection Timeout" error screen, retry buttons), it is **entirely simulated** by the "Simulation Desk" in `App.tsx` using `setTimeout`. This section documents that simulated behavior (so it isn't mistaken for real integration) and then specifies what a real API layer needs to expose per the PRD/Handbook, as a starting contract for backend work.

## 2. Simulated API Behavior (current prototype)

Controlled by the floating "Simulation Desk" button (bottom-right of every authenticated screen):

| Control | Effect |
|---|---|
| **API Roundtrip Latency**: `0ms` / `600ms` (default) / `1500ms` | On every route change, `App.tsx` sets `isLoading = true`, waits this many ms via `setTimeout`, then flips it off. Drives the shimmering skeleton UI. |
| **Force Network Offline** (toggle) | When on, every route change resolves the loading delay into `apiError` being set to a fixed string, rendering a full-screen "Database Connection Timeout" panel instead of the route's content, with "Disable Offline & Reconnect" and "Retry Connection" buttons. |
| **Clear DB / Restore Defaults** | `localStorage.clear()` + `window.location.reload()` — wipes every `stitch_*` key and reseeds from `mockData.ts`. |

Settings persist in `localStorage['stitch_api_latency']` and `localStorage['stitch_api_force_offline']`. None of this touches any real network stack — it exists purely so the prototype can demonstrate loading/error/offline UX states for stakeholder review before a real backend exists.

## 3. Target API Surface (derived from PRD §16.1 and current frontend data needs)

The PRD specifies **versioned, per-module REST/GraphQL services**: Inventory Service, Billing Service, Accounting Service, GST Service, Karigar Service, Scheme Service, Reporting Service, plus a shared Master Data Service. None of these exist yet. Below is a **starting-point contract**, derived by mapping what the current frontend already needs against what the Handbook's drafted schema (Phases 1–3) supports. Treat this as a first draft for the backend team, not a finalized spec — Phases 4–14 of the Handbook (not yet drafted) will refine the Billing/Karigar/GST/Accounting/Scheme endpoints substantially.

### Master Data Service (backed by Handbook Phase 2 tables)
- `GET /metals`, `GET /metal-purities` — cached, tenant-wide, must be bundled into any offline POS client.
- `GET /rate-versions?purity_id&branch_id&as_of` — implements the branch-override-preferring lookup query from `DATABASE.md` §2.3. **This is the single most frequently called endpoint in the system** (every billing line needs it) and must be served from a cache layer, not a live query, per the PRD's <200ms/line performance budget.
- `POST /rate-versions` — HQ/Rate-Setter role only; always inserts a new row, never updates.
- `GET/POST /item-designs`, `GET/POST /parties`, `GET/POST /mc-wastage-schemes`, `GET/POST /stone-rate-master`, `GET/POST /tax-rates`, `GET/POST /branches`.

### Inventory/Tagging Service (Handbook Phase 3)
- `POST /tags` — create a tag (weigh-in), enforces the `RawMetal → ... → InStock` state machine.
- `PATCH /tags/:id/status` — transactional status transition; must reject illegal transitions and enforce the "never sellable at two branches simultaneously" constraint at the DB/transaction level, not just in application code.
- `GET /tags?status&branch_id&purity_id&weight_range` — stock lookup/search.
- `GET /tags/:id/history` — the `tag_status_history` audit trail.

### Billing Service (PRD §7 — not yet drafted in the Handbook)
- A **Pricing/Calculation Engine** endpoint (or shared library called identically by Billing, Estimate, and Old-Gold flows) implementing the exact formula sequence in PRD §7.2–7.3. This must be the single source of truth — see `KNOWN_ISSUES.md` for how the current frontend prototype instead re-derives (and gets subtly wrong) this math inline.
- `POST /invoices` (finalize a sale), `POST /estimates` (non-fiscal quote, same engine, no stock deduction/no accounting entry, convertible to an invoice).
- Old Gold Exchange must be its **own transaction endpoint** (`POST /old-gold-purchases`), settled at the payment stage against an invoice — never modeled as a discount parameter on `POST /invoices` (PRD §8.3; current prototype violates this, see `KNOWN_ISSUES.md` #1).

### Karigar Service (PRD §6.2 — not yet drafted in the Handbook)
- `POST /karigar/metal-issue`, `POST /karigar/receipts` (with wastage/fine-gold-equivalent reconciliation), `GET /karigar/:id/ledger` (grams-payable and money-payable as two distinct, separately-queryable balances, not one collapsed number).

### GST / Accounting / Scheme / Reporting Services
Not specified further here — these need their own phase documents (Handbook Phases 7, 8, 10, 11) before an API contract can be drafted responsibly. Do not improvise these endpoints ahead of that domain design work; see `HANDOFF.md`.

## 4. Authentication (target)

The PRD implies standard session/token-based auth with full RBAC (§3, §15.1) — role-scoped JWTs or session cookies, maker-checker dual-approval for high-value transactions, and audit logging of every sensitive action (rate override, discount override, invoice cancellation). None of this exists in the current prototype (see `ARCHITECTURE.md` §1) beyond a cosmetic login form.
