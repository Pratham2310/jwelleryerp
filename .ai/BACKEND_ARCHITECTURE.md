# BACKEND_ARCHITECTURE.md

_Written 2026-08-04, after the 53-milestone frontend was completed. Stack decisions are recorded as
**D-12**, **D-13** and **D-14** in `DECISIONS.md` — this document is the architecture those decisions
imply, plus how four people divide it._

**Read `DECISIONS.md` D-1 through D-14 before this file.** Several things that look like schema
choices below are locked domain decisions, and reversing one silently will break a compliance rule
rather than merely a table.

---

## 1. The premise

The frontend is not a throwaway prototype whose logic gets rewritten server-side. It contains the
domain:

| | |
|---|---|
| Domain modules in `src/lib/` | **45** |
| Passing unit tests | **1264** across 43 suites |
| Modules touching a browser API | **3** — and two inject storage as a parameter |

So the backend's first job is not to write business logic. It is to put a **database, a tenant
boundary and an HTTP surface** around business logic that already exists and is tested.

The one module that is genuinely browser-only is the CSV download helper in `gstReturns.ts`; that
belongs in the UI and stays there. Everything else moves.

---

## 2. Repository layout

```
stitch/
├── apps/
│   ├── api/                      NestJS HTTP server
│   │   └── src/modules/<context>/
│   │         *.controller.ts     HTTP, DTO validation, guards. No business logic.
│   │         *.service.ts        use-case orchestration, transaction boundaries
│   │         *.repository.ts     Drizzle queries, always tenant-scoped
│   │         dto/                Zod schemas
│   ├── worker/                   BullMQ consumers — exports, notifications, backups
│   └── web/                      the existing React app
│
└── packages/
    ├── domain/                   ← src/lib, verbatim. Pure. No Nest, no Drizzle, no I/O.
    ├── contracts/                Zod DTOs + generated client, imported by web AND api
    └── db/                       Drizzle schema, migrations, RLS policies
```

### The layer contract

This is the rule that keeps four people from writing four different backends:

| Layer | May do | May **not** do |
|---|---|---|
| **Controller** | parse/validate input, check auth guard, call one service, shape the response | contain an `if` about business meaning, touch the database |
| **Service** | orchestrate a use case, open transactions, call domain functions, call repositories, emit events | contain arithmetic or domain rules |
| **Domain** (`packages/domain`) | compute, validate, decide — pure functions over plain data | import anything with I/O, know that a database exists |
| **Repository** | Drizzle queries, mapping rows to types | make decisions about what *should* happen |

A request flows one way:

```
Controller → Service ─┬─→ Repository (load)
                      ├─→ Domain (decide / compute)     ← pure, already tested
                      └─→ Repository (persist, one transaction)
```

**Why the domain must stay pure.** Its 1264 tests run with no database and no HTTP. The moment
someone injects a repository into `billingCalculations.ts`, that suite needs fixtures and a
container, and it stops being run on every save. Guard this in code review.

### Derived, not stored

`journalPosting.ts`, `financialStatements.ts`, karigar balances (M16), scheme balances (M26) and
metal rates (M48) are all **derived from source documents on read**. That is why they cannot drift.

Keep it. When a report gets slow, add a materialised view refreshed on a schedule — the derivation
stays the single source of truth and the cache is visibly a cache. Do not add a stored
`current_balance` column because a query took 300 ms.

---

## 3. Multi-tenancy

Three levels (D-1):

```
Tenant        the business — one subscription, one Clerk Organization
  └── Branch  a shop in the chain — its own GSTIN and invoice series
        └── User / operator
```

Every request runs inside a transaction that sets the tenant, and Postgres does the filtering:

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.tenant_id = ${ctx.tenantId}`);
  // every query below is RLS-filtered by the database itself
});
```

`SET LOCAL` is transaction-scoped, so this is safe behind pgBouncer in transaction mode.

**Three schema rules that are domain decisions, not preferences:**

- **D-5** — party masters (customers, suppliers, karigars) and the Metal/Purity master carry
  `tenant_id` but **no `branch_id`**. Branch-scoping the customer table silently breaks chain-wide
  loyalty *and* cumulative TCS aggregation against the Rule 114B threshold.
- **D-7** — a tag is sellable at one branch only, enforced as a partial unique index, not a
  convention.
- **D-4** — rate versions and tax rates are append-only, enforced by revoking `UPDATE`/`DELETE`
  from the application's Postgres role.

---

## 4. Core schema sketch

Not the full schema — the spine the four slices hang off. Money is `BIGINT` paisa, weight is
`BIGINT` milligrams (D-12).

```sql
tenants        (id, name, subscription_tier, clerk_org_id, created_at)
branches       (id, tenant_id, code, name, gstin, state_code,
                invoice_series_prefix, is_active)
users          (id, tenant_id, clerk_user_id, name, role_name, branch_id NULL,
                supervisor_pin_hash, is_active, deactivated_at, deactivation_reason)
roles          (id, tenant_id, name, permissions JSONB, is_system)

item_designs   (id, tenant_id, design_code, category, hsn_code, defaults…)
tags           (id, tenant_id, branch_id, item_design_id, sku, huid,
                gross_weight_mg, net_weight_mg, status, stock_ownership_type,
                tagged_on)
tag_events     (id, tenant_id, tag_id, from_status, to_status, reason,
                actor_user_id, occurred_at)          -- append-only lifecycle trail

sale_invoices  (id, tenant_id, branch_id, invoice_number, invoice_type, date,
                customer_id, taxable_paisa, cgst_paisa, sgst_paisa, igst_paisa,
                grand_total_paisa, net_amount_due_paisa, pan_declaration JSONB)
invoice_lines  (id, tenant_id, invoice_id, tag_id NULL, hsn_code,
                net_weight_mg, rate_per_gram_paisa, making_paisa,
                stone_paisa, subtotal_paisa)

metal_rate_versions (id, tenant_id, metal_type, rate_per_gram_paisa,
                     effective_from TIMESTAMPTZ, set_by, override_reason)  -- append-only
tax_rates           (id, tenant_id, hsn_code, rate_percent,
                     effective_from, notification_ref)                     -- append-only
karigar_ledger      (id, tenant_id, karigar_id, entry_type,
                     weight_mg, amount_paisa, occurred_at)                 -- append-only
approvals           (id, tenant_id, kind, amount_paisa, reason,
                     requested_by, approved_by, approver_role, approved_at) -- append-only
```

### Invoice numbering is a concurrency primitive

GST Rule 46 requires a **unique consecutive series per GSTIN**. Two terminals selling at once must
not both get `MUM-2026-1042`.

```sql
invoice_sequences (tenant_id, branch_id, fiscal_year, next_number,
                   PRIMARY KEY (tenant_id, branch_id, fiscal_year))
```

Claim the number inside the same transaction that writes the invoice, with `SELECT … FOR UPDATE` or
a transaction-level advisory key. **This service belongs to the platform slice, not the billing
slice** — it is a locking problem, not a sales feature.

`offlineQueue.ts` (M36) already handles collisions by renumbering and keeping the original number on
the record. That is the recovery path for sales raised while a terminal was offline; it is not
licence for the server to create collisions of its own.

---

## 5. Dividing the work across four people

### Weeks 0–2: nobody splits

One spine must exist before parallel work is possible. Built by the strongest backend developer with
the other three reviewing:

1. Monorepo, TypeScript config, CI
2. `packages/domain` extracted from `src/lib`, its 1264 tests green in the new location
3. Drizzle + first migration + **RLS policies and the tenant-context interceptor**
4. Clerk integration, the auth guard, and request context (`tenantId`, `userId`, `role`)
5. One reference module built end to end — **Branches** is ideal: small, tenant-scoped, real
6. The invoice-sequence service

Four people starting before this exists will produce four different conventions and a fortnight of
merge conflicts.

### Then, by bounded context

Each person owns their slice **from migration to endpoint to tests** — not by layer. Splitting by
layer ("you do controllers, I do the database") makes everyone block on everyone.

| Dev | Slice | Milestones |
|---|---|---|
| **A** | **Platform & Identity** — tenancy, RLS, auth, users, roles, permissions, supervisor approvals, statutory parameters, audit log, system health, **invoice sequences** | M32, M33, M34, M49, M51 |
| **B** | **Inventory & Production** — designs, tags, lifecycle state machine, branches, transfers, hallmarking, karigar & job work, adjustments, melting, purchase orders & goods receipts | M3–M6, M16–M20, M24–M25, M37–M39, M42–M44 |
| **C** | **Sales & Customer** — billing, invoices, returns, old gold, customers, savings schemes, offline sync endpoint | M2, M7–M15, M26–M27, M36, M53 |
| **D** | **Money & Compliance** — journals, vouchers, financial statements, GST returns & registers, Tally export, rate master, purchase invoices & ITC | M21–M23, M28–M29, M40–M41, M45–M48, M52 |

**Two seams worth stating explicitly:**

- **Procurement splits B/D.** Purchase orders and goods receipts are goods movement → B. Purchase
  invoice and ITC are money and tax → D. The handoff is the receipt: B produces it, D bills it.
- **Invoice numbering is A's, consumed by C.** See above.

### Integration discipline

**Contract-first.** The Zod DTO in `packages/contracts` is written and merged *before* the
implementation. C can then build against B's contract while B is still writing it, and the frontend
can be wired in parallel against the same types.

---

## 6. Frontend cutover

Do not big-bang it. `App.tsx` holds all state in one place with a consistent
`useState` + `useEffect(localStorage)` shape — that is a clean seam.

Introduce a repository interface per module in the web app, with two implementations
(`localStorage` and `api`), switched by a flag. Cut modules over one at a time as their endpoints
land. The app stays shippable throughout, and the offline queue (M36) becomes real rather than
simulated.

---

## 7. Non-negotiables

1. **Every permission, statutory gate and approval is re-asserted server-side.** `permissions.ts`
   and `HANDOFF.md` both already say the current checks gate the interface, not the data. That
   sentence is the backend's specification — see D-14.
2. **Money is `BIGINT` paisa; weight is `BIGINT` milligrams.** Never float.
3. **Append-only stays append-only**, enforced by Postgres grants (D-4).
4. **Idempotency keys on every POST.** The offline queue retries; a retried sale must not become two
   invoices.
5. **A tenant-isolation test in CI** proving tenant A cannot read tenant B's data, on every PR.
6. **The domain package imports no framework.** Reviewers should reject the PR that changes this.

---

## 8. Open questions this document does not settle

- **Hosting**, object storage provider, observability vendor, CI provider. Deliberately deferred;
  the stack stays plain Postgres + an S3-compatible interface so these remain reversible. Data
  residency for GST records is the factor most likely to decide it.
- **The HSN classification of diamond-studded pieces** (see `DECISIONS.md`, Open Decisions) still
  awaits CA sign-off and blocks the final shape of `invoice_lines.hsn_code` for those items.
- **Reporting at scale.** Derivation is correct and fast enough at one shop. The threshold at which
  the trial balance and GSTR-1 need materialised views is unknown and should be measured, not
  guessed.
