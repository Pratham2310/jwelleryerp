# ARCHITECTURE.md

## 1. Current Architecture (as built in this repo)

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (single tab)                    │
│                                                               │
│  React 19 SPA (Vite 6, TS, HashRouter)                       │
│  ├─ App.tsx  ─── owns top-level state for:                   │
│  │     metalRates, items, customers, karigars,               │
│  │     workOrders, invoices  (lifted state, prop-drilled)     │
│  │                                                            │
│  ├─ StoneManager.tsx  ─── owns its OWN state (not lifted)     │
│  ├─ JobBagManager.tsx ─── owns its OWN state (not lifted)     │
│  │                                                            │
│  └─ localStorage  ─── the entire "database":                 │
│        stitch_metal_rates, stitch_jewellery_items,           │
│        stitch_customers, stitch_karigars,                    │
│        stitch_work_orders, stitch_invoices,                  │
│        stitch_loose_stones, stitch_job_bags,                 │
│        stitch_auth_user, stitch_theme,                       │
│        stitch_api_latency, stitch_api_force_offline          │
└─────────────────────────────────────────────────────────────┘
```

There is **no server tier**. There is **no network call** anywhere in the codebase (no `fetch`, no `axios`, no real REST/GraphQL client). The "Simulation Desk" widget (bottom-right floating button, wired in `App.tsx`) fakes API latency and offline errors with `setTimeout`, purely to let the UI show loading skeletons and error states — it does not talk to anything real.

**Auth** is cosmetic: `LoginPage`/`RegisterPage` accept any input, wait ~800ms, and call `onLoginSuccess` with a hardcoded user object (`{ name: 'Prathamesh S.', role: 'Store Manager', branch: 'Mumbai BST' }`). There is a "Guest / Demo Direct Sign In" button that skips the form entirely. `App.tsx` gates all routes behind `if (!user)`, but once logged in, every role sees every screen — **no RBAC is enforced anywhere in the frontend, and there is no backend to enforce it server-side either.**

**Multi-tenancy, multi-branch, GSTIN, and rate versioning do not exist** in this codebase. All data is implicitly single-tenant, single-branch. The `Sidebar` hardcodes `STORE: MUM-01`.

### Dead/unused scaffolding
`package.json` includes `@google/genai`, `express`, and `motion`, none of which are imported anywhere in `src/`. These are leftover Google AI Studio template dependencies (the README references a Gemini API key and Cloud Run deployment) and can be removed once a real backend architecture replaces this prototype, unless a specific feature (e.g. AI-assisted design suggestions, per PRD §18 Phase 4) is planned to use them.

## 2. Target Architecture (per PRD §16 and Handbook Phase 1–3)

The PRD (§16.1) and Handbook (§1.5, §1.9) specify a **layered, multi-tenant SaaS architecture**:

```
Presentation
 ├─ Web back-office (Admin/HQ) ── React (this repo's likely eventual role)
 ├─ Desktop/Tablet POS app ── offline-capable, barcode + weighing-scale peripheral input
 ├─ Mobile app ── owner dashboard, on-the-go approvals
 └─ Customer portal ── Phase 2/3 of rollout, not MVP

API layer
 ├─ Versioned REST/GraphQL, per-module:
 │    Inventory Service, Billing Service, Accounting Service,
 │    GST Service, Karigar Service, Scheme Service, Reporting Service
 └─ Master Data Service (Metal/Purity/Item/Party/MC-Wastage/Stone/Tax/Branch) — cached, read-heavy

Business Logic layer
 └─ Central Pricing/Calculation Engine (PRD §7) — a SHARED, independently-testable
    service consumed identically by Billing, Estimate, and Old-Gold modules.
    This is explicitly called out as "single source of truth for all formulas,
    to avoid divergent calculation bugs" — the current prototype already
    violates this principle by recomputing billing math ad hoc inside
    BillingEstimator.tsx with no shared/testable function (see KNOWN_ISSUES.md).

Data layer
 ├─ PostgreSQL (ACID, relational integrity) — see DATABASE.md for target schema
 ├─ Append-only event/audit log store (Rate Master, Tax Master are event-sourced,
 │  never UPDATEd)
 └─ S3-compatible object storage — images, hallmarking certificates, stone
    certification files

Integration layer
 ├─ GST e-Invoice / e-Way Bill APIs (via a GSP — GST Suvidha Provider)
 ├─ SMS/WhatsApp Business API
 ├─ Payment Gateway (UPI/Card) — tokenized, PCI-DSS-aware, never store card data
 ├─ Tally/Busy/Marg/Zoho Books export connectors
 └─ Barcode/RFID/weighing-scale device drivers (serial/USB/Bluetooth)
```

### Key architectural decisions already locked in (see `DECISIONS.md` for full rationale)

1. **Multi-branch regional chain is the primary target**, not single-store or full franchise/national-brand (yet). Every master table gets `tenant_id` + nullable `branch_id` (NULL = tenant-wide/HQ record, overridden by a branch-specific row when present) — **except** Metal/Purity Master and Party Master, which are tenant-wide only and never branch-scoped (a branch cannot invent its own purity, and a customer's identity/TCS exposure must be consistent across every branch they visit).
2. **Two parallel, always-reconciling ledgers**: Weight Ledger (grams, by purity) and Money Ledger (₹). Never persist a money figure without the weight and rate-version it was derived from.
3. **Rate Master and Tax Master are append-only/event-sourced.** No `UPDATE` statement ever touches historical rate or tax rows — corrections are new dated rows.
4. **`stock_ownership_type` (`OWNED` / `GML_FINANCED` / `CONSIGNMENT`)** is a field on every stock/tag record from day one, even though only `OWNED` is used in MVP — retrofitting this later touches every stock and accounting table (Handbook §1.6).
5. **Tag (not Item/SKU) is the atomic sellable unit.** Item/Design Master is a template; Tag is the individually-weighed, individually-serialized, barcode/QR/HUID-bearing sellable instance, governed by an explicit state machine (never a free-text status column).
6. **Central Pricing/Calculation Engine is one shared, testable service** — Billing, Estimate, and Old-Gold modules must call the *same* function, never re-derive the formula independently.

### Gap Analysis: Current Repo vs. Target

| Concern | Current Repo | Target (PRD/Handbook) |
|---|---|---|
| Persistence | `localStorage`, per-browser, no server | PostgreSQL, multi-tenant, ACID |
| Multi-branch | None (single implicit branch) | `tenant_id` + nullable `branch_id` pattern everywhere |
| Auth/RBAC | Cosmetic; any credentials work; no roles enforced | Full RBAC per persona (§3 PRD), maker-checker for high-value txns |
| Rate Master | Static array, no history, no versioning | Append-only `rate_versions`, pub/sub propagation, fat-finger sanity check |
| Tag/Inventory | `JewelleryItem` = flat item, `status` is a free string | `tags` table with enforced state-machine transitions, `tag_status_history` |
| Billing Engine | Inline math in `BillingEstimator.tsx`, several formula bugs | Shared, versioned, unit-tested Calculation Engine service |
| GST | Flat hardcoded 3%, no CGST/SGST split, no HSN | Versioned `tax_rates` table, auto CGST/SGST vs IGST by state comparison |
| Old Gold Exchange | Subtracted from taxable subtotal before GST (incorrect) | Separate purchase voucher, netted at payment stage only |
| Karigar Ledger | In-memory only, not persisted centrally, no fine-gold-equivalent calc | Dual ledger (grams payable / money payable), Handbook Phase 4 (not yet drafted) |
| Multi-tenancy | None | Core to every table per §1.9 |
| Offline POS | None (single-page app assumes always-online) | Explicit offline cache + reconnect conflict resolution requirement |

## 3. Non-Functional Requirements to Design Against (PRD §16.2)

- Billing calculation <200ms per line.
- 99.9% uptime target; graceful degradation to offline POS mode.
- All weight/money math in fixed-point/decimal — **never floating point** (JS `number` arithmetic in the current prototype is a latent precision risk once real money is at stake; a production calculation engine should use a decimal library or integer-minor-unit arithmetic).
- Peak load: festival days (Akshaya Tritiya, Dhanteras, Diwali) see 5–10x normal daily volume.
- Tag-level uniqueness enforced at the DB level, not just app level.
