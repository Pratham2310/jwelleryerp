# DECISIONS.md

Architecture Decision Log. Newest decisions at the top of each section is not enforced here — decisions are grouped by theme and kept in the order they were established (Handbook Phase 1 → Phase 3), since later decisions build on earlier ones. **Do not silently reverse or contradict a locked decision below without recording a new dated entry explaining why.**

---

## D-1: Target deployment tier is "multi-branch regional chain," not single-store or full enterprise/franchise
**Source:** Handbook §1.9 ("🚩 Decision Needed Before Phase 2 — RESOLVED").
**Decision:** Architect for a multi-branch regional chain first.
**Implications locked in:**
- Every master data table carries `tenant_id` + nullable `branch_id` from day one (nullable = tenant-wide/HQ record, overridden by a branch-specific row when present).
- Rate Master is centralized HQ-set with real-time propagation to branches, plus a controlled, permissioned, reason-logged branch-level override — not a single-shop "one person types the rate" model.
- Branch-wise GSTIN linkage is mandatory in Branch Master from the start, not deferred.
- `stock_ownership_type` is included as a field now (see D-3), but enterprise-only concerns — franchise data partitioning, Regional/Cluster Manager role — are **noted but deferred**, to be revisited only if/when franchise support is explicitly confirmed as needed.
**Why:** Single-store, multi-branch, and national-brand jewellers differ *structurally*, not just in scale (Handbook §1.5 table) — rate-setting authority, karigar sourcing model, hallmarking rigor, stock financing (GML/consignment), scheme formality, GSTIN count, and even "branch ownership model" (owned vs. franchise) all diverge. Retrofitting multi-branch or franchise support onto a single-store schema later is a rewrite, not a patch.

## D-2: Two parallel, always-reconciling ledgers — Weight (grams) and Money (₹)
**Source:** Handbook §1.4.
**Decision:** Every stock-related table must treat weight as the source of truth, with money values as a *derived*, rate-dependent view — never persist a money figure without also persisting the weight it was computed from and the exact rate version used.
**Why:** "What is my total stock worth in grams AND in rupees, split by purity, as of this exact moment, using today's rate" is the single most important query the business asks, daily. Persisting only a money value without its weight/rate provenance makes this query unanswerable without replaying history — the single biggest source of reconciliation bugs in home-grown jewellery software (Handbook §1.4).

## D-3: `stock_ownership_type` (OWNED / GML_FINANCED / CONSIGNMENT) is a field from day one, even in MVP
**Source:** Handbook §1.6, §1.6 "Best Practice" callout, reaffirmed in Phase 3 §7.
**Decision:** Add this enum to every Tag/Lot record now, even though only `OWNED` is used in the true MVP scope.
**Why:** Most mid-to-large Indian jewellers finance stock via Gold Metal Loan (GML) or hold supplier consignment stock — ownership of "in showroom" stock is not uniform. This affects Balance Sheet valuation, what "available for sale" means, and owner/finance MIS. Adding it later means a migration touching every stock and accounting table — cheap now, expensive later. This is the single most consequential domain gap the Handbook found missing from the original PRD.

## D-4: Rate Master and Tax Master are append-only / event-sourced — never `UPDATE`d
**Source:** Handbook §2.3, §2.9.
**Decision:** No code path may ever `UPDATE` a historical `rate_versions` or `tax_rates` row. Corrections are always new rows with a later `effective_from`/`override_reason` (rates) or `notification_ref` (tax).
**Why:** This is the primary evidentiary trail for GST/Income-tax audits and customer billing disputes ("I was billed at yesterday's rate"). Treat these tables as event-sourced ledgers, not "current value with history" tables — this mental model changes how every future developer is tempted to write to them (Handbook §2.3 "Production Best Practices").

## D-5: Metal/Purity Master and Party Master are tenant-wide only — never branch-scoped
**Source:** Handbook §2.2 ("no branch_id column here"), §2.6 ("Party Master must be tenant-wide, not branch-scoped").
**Decision:** These two masters are the explicit exceptions to the "nullable `branch_id` everywhere" pattern (D-1) — they never carry a `branch_id` at all.
**Why:** Purity meaning must be identical everywhere for rate/reporting integrity (a branch cannot invent its own "22KT"). Party identity, credit limit, and — critically — cumulative TCS exposure (₹2,00,000 Rule 114B threshold) must be consistent regardless of which branch a customer transacts at; branch-scoping the customer table is called out explicitly as "a common, subtle mistake that silently breaks both chain-wide loyalty and TCS aggregation," i.e. a genuine compliance risk, not just a UX inconvenience.

## D-6: Tag is the atomic sellable unit — never a quantity-counted Item/SKU
**Source:** PRD §5.1–5.2, Handbook Phase 3 throughout.
**Decision:** `item_designs` stores only the design *template* (category, defaults, images); `tags` stores each individually-weighed, individually-serialized, barcode/QR/HUID-bearing physical piece, governed by an explicit, enforced state machine — never a free-text status column any code path can set arbitrarily.
**Why:** This is THE defining structural difference between jewellery retail and generic retail POS (PRD §1.3, Handbook §1.1's "critical business rule"). Modeling stock as a quantity counter per design is called out as "the single most fundamental generic-retail instinct to avoid in this domain" (Handbook Phase 3 §16). **The current prototype (`JewelleryItem`) has not yet made this split — see `DATABASE.md` §1.1 and `MODULE_STATUS.md` for the migration this implies.**

## D-7: A tag can never be sellable at two branches simultaneously — enforced at the DB/transaction level
**Source:** PRD §16.2 (explicit DB-level requirement), Handbook Phase 3 §4/§7.
**Decision:** Tag status transitions to `SOLD`/`TRANSFER_IN_TRANSIT` are transactional; the first successful commit wins, any competing attempt fails and surfaces to staff — never silently overwritten, never resolved via last-write-wins on offline reconnect.
**Why:** Explicitly named in the PRD as a hard data-integrity constraint, and named again in the Handbook as a "genuine, damaging failure mode, not a theoretical one" for offline POS reconnect scenarios.

## D-8: Three-tier Making-Charge/Wastage override hierarchy
**Source:** Handbook §2.5 §7, §2.7 §3/§7 (resolves an ambiguity between PRD §4.3 and §4.5).
**Decision:** The resolution order for making-charge/wastage is always: **Category Slab** (`mc_wastage_schemes`, tenant/branch-nullable) → **Item Design default** (`item_designs`) → **Transaction-time override** (billing screen, requires approval). This must be implemented as one shared, reusable resolution function, never re-derived independently per screen (Billing vs. Estimate).
**Why:** The PRD never states this hierarchy explicitly; without it, two developers building Billing and Estimate independently will each invent a different, silently-conflicting "default" resolution path.

## D-9: The Pricing/Calculation Engine is one shared, independently-testable service
**Source:** PRD §16.1.
**Decision:** Billing, Estimate, and Old-Gold-Exchange modules must all call the *same* calculation function/service for metal value, wastage, making charges, stone value, and GST — never re-implement the formula independently per screen.
**Why:** Explicitly named as the mechanism to avoid "divergent calculation bugs." **The current prototype violates this today** — `BillingEstimator.tsx` has its own inline, untested calculation logic with multiple correctness bugs (see `KNOWN_ISSUES.md` #1–4) that a shared, unit-tested engine (tested against the PRD §17 worked example) would have caught.

## D-10: Old Gold Exchange is a separate purchase transaction, settled at payment stage — never a sale-side discount
**Source:** PRD §8.3 (stated three times, in increasingly explicit terms, within the same section — treat this as maximally load-bearing).
**Decision:** The new item's taxable value and GST are always computed at full value. Old-gold buyback value is a distinct purchase voucher, netted only against the final `Net Payable` at settlement.
**Why:** Netting old-gold value into the taxable subtotal before GST incorrectly reduces GST payable on the new sale — a real compliance violation, not a cosmetic modeling choice. **The current prototype violates this today** — see `KNOWN_ISSUES.md` #1, the highest-severity issue found in this audit.

## D-11: GML/Consignment stock exposure and the Scheme cash-refund legal guardrail are first-class requirements, not deferred nice-to-haves
**Source:** Handbook §1.6, §1.6.1.
**Decision:** `stock_ownership_type` (D-3) and a hard default block on cash-refunding Gold Savings Scheme balances (configurable only via a logged compliance override) must both be designed in from the start of their respective modules (Inventory/Accounting and Scheme, respectively) — not added later as compliance polish.
**Why:** Both carry genuine legal exposure (Balance Sheet misstatement risk for GML; Banning of Unregulated Deposit Schemes Act, 2019 exposure for cash-refundable schemes) rather than being pure UX/feature decisions.

## D-12: Backend stack is Node + TypeScript + NestJS + PostgreSQL + Drizzle — not MERN
**Source:** Backend planning session, 2026-08-04.
**Decision:** The server is Node 22 LTS + TypeScript, NestJS for structure, PostgreSQL 16 for storage, Drizzle as the query layer with drizzle-kit migrations, Redis + BullMQ for background work, and Zod for validation shared with the frontend. Clerk provides *identity*; authorization stays in our own database.
**Implications locked in:**
- The existing `src/lib/` becomes `packages/domain` **verbatim**. It is framework-free today — of 45 modules only three touch a browser API, and two of those already take storage as an injected parameter — so it ports with its 1264 tests intact.
- `packages/domain` may never import NestJS, Drizzle or any I/O library. Services do I/O and own transactions; the domain package takes data and returns data. This is what keeps the domain suite running in milliseconds with no database.
- Money is `BIGINT` paisa and weight is `BIGINT` milligrams at the column level, matching `money.ts`. No `FLOAT`/`DOUBLE` anywhere in the schema.
- Append-only tables (D-4: rate versions, tax rates; plus karigar ledger, approvals, notifications) have `UPDATE`/`DELETE` revoked at the Postgres role level, not merely avoided in code.
**Why not MongoDB (i.e. why not MERN):** four properties of this domain are database problems in Postgres and application problems in Mongo — journals that must balance (M28), integer money that must not drift, a gap-free consecutive invoice series per GSTIN required by GST Rule 46, and tenant isolation. The reporting surface (GSTR-1, trial balance, HSN summary, stock ageing) is relational aggregation.
**Why not another language:** the domain rules — wastage caps, tunch valuation, Fine Gold Equivalent, ITC reversal under s.17(5)(h), the HUID lifecycle — already exist as tested TypeScript. Rewriting them elsewhere discards the most expensive asset in the project to gain nothing.
**Known risk, accepted:** the team knows Express but not NestJS, and Nest + Drizzle has thinner tutorial coverage than Nest + Prisma. Mitigation: learn Drizzle + RLS first and Nest structure second, because dropping Nest for Fastify later costs about a day while changing the query layer after the schema exists does not.

## D-13: Tenant isolation is enforced by PostgreSQL Row-Level Security, not by application discipline
**Source:** Backend planning session, 2026-08-04. Extends D-1 and D-5.
**Decision:** One database, one schema, `tenant_id` on every tenant-owned table (per D-1), with an RLS policy on each. Every request opens a transaction that sets `SET LOCAL app.tenant_id`; policies read `current_setting('app.tenant_id', true)`. Not schema-per-tenant, not database-per-tenant.
**Implications locked in:**
- A repository method that forgets its tenant predicate returns **zero rows**, never another shop's stock. That is the entire point: isolation cannot depend on every developer remembering.
- `SET LOCAL` is transaction-scoped, so this is safe behind pgBouncer in transaction mode.
- D-5 still holds and is now a schema rule: party masters and the Metal/Purity master carry `tenant_id` but **no** `branch_id`.
- D-7 becomes a partial unique index rather than a convention — a tag may be sellable at only one branch.
- CI must contain a test proving tenant A cannot read tenant B's data, run on every pull request.
**Why not schema-per-tenant:** migrations become O(tenants) and break down past a few hundred shops. **Why not database-per-tenant:** far too heavy for a single-shop customer, which is the majority of the market this targets. Both remain available as an escape hatch for one enterprise customer later, since the application only ever talks to plain Postgres.

## D-14: Identity is bought; authorization is built
**Source:** Backend planning session, 2026-08-04.
**Decision:** Clerk owns login, password reset, MFA and sessions. A Clerk Organization maps to one tenant. Roles, permissions, operator accounts and supervisor PINs stay in our own database — `permissions.ts` (M32), `users.ts` (M49) and `statutoryParameters.ts` (M33) move server-side unchanged.
**Why:** authentication is commodity and getting it wrong is a breach; authorization here is domain-specific and getting it wrong is a business rule failure. The supervisor PIN in particular is **not** an authentication factor — it records that a second person authorised a discount (M33), which is an accounting control, not a login step. Handing it to an identity vendor would misclassify it.
**Consequence:** the frontend's current claim that its checks "gate the interface, not the data" stops being true only once each check is re-asserted in a Nest guard or service. Until then it remains true and must keep being stated.

---

## Open Decisions Not Yet Made (flagged, not resolved — see `HANDOFF.md` for full detail)

- **HSN classification of diamond-studded gold pieces** — single composite line at jewellery-rate vs. split HSN lines (jewellery @ ~3% + diamond @ ~1.5%). Requires client CA sign-off before the GST engine (Handbook Phase 7, not yet drafted) is built.
- ~~**Where RBAC and the Statutory Parameters table should be built relative to Phase 2**~~ — **RESOLVED by delivery (2026-08-01).** Both shipped in the frontend as M32/M34, and D-12/D-13 place them in the backend's platform slice, built before any business module. Original note kept for context: **where RBAC and the Statutory Parameters table (PAN/TCS/PMLA/Hallmarking thresholds as data, not code) should be built relative to the Phase 2 Master Data work** — flagged in prior project context as needing earlier sequencing than the Handbook's TOC currently implies (Phase 12), but the currently-available Handbook draft does not yet contain the reasoning or resolution for this. Needs to be revisited once Phase 12 (or an accelerated version of it) is actually drafted.
