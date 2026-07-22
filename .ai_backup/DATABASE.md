# DATABASE.md

## 1. Current State: There Is No Database

This repo has **no database**. `src/types.ts` defines the TypeScript interfaces that stand in for a schema, and `src/data/mockData.ts` provides seed/fixture data. At runtime, `App.tsx` (and, inconsistently, `StoneManager.tsx`/`JobBagManager.tsx` themselves — see `ARCHITECTURE.md` and `KNOWN_ISSUES.md`) load these into React state, then mirror every change back into the browser's `localStorage` as JSON blobs.

### 1.1 Current "Tables" (TypeScript interfaces in `src/types.ts`)

| Interface | Purpose | localStorage key |
|---|---|---|
| `MetalRate` | Daily rate per metal/purity, plus a fake 8-point sparkline history | `stitch_metal_rates` |
| `JewelleryItem` | Flattened item **and** stock record in one — no separation between "design template" and "physical tag" | `stitch_jewellery_items` |
| `Customer` | Party record, retail-only fields, scheme fields inlined | `stitch_customers` |
| `Karigar` | Artisan record with a running `metalBalance` (grams) and `laborChargesOwed` (₹) — no ledger/history, just two mutable running totals | `stitch_karigars` |
| `WorkOrder` | Karigar job-work order (issue → completion) | `stitch_work_orders` |
| `SaleInvoice` / `InvoiceItem` | POS invoice + its line items | `stitch_invoices` |
| `LooseStone` | Vault stone/diamond lot | `stitch_loose_stones` |
| `JobBag` | Visual factory-floor job tracking (separate concept from `WorkOrder` — see below) | `stitch_job_bags` |

**Important note on `WorkOrder` vs. `JobBag`:** these are two independent, overlapping concepts for what the PRD/Handbook treat as one thing (a karigar job-work order, PRD §6.2 / Handbook Phase 4, not yet drafted). `WorkOrder` lives in `KarigarManager.tsx` (issue/receipt, wastage %, labour charge). `JobBag` lives in `JobBagManager.tsx` (visual stage tracker: Casting → Filing → Setting → Polishing → Hallmark → Completed). They are not linked by any foreign key, and the mock data (`mockData.ts`) manually keeps them superficially in sync (same karigar names, similar designs) with no actual relationship. **A production data model must unify these into one Karigar Job-Work aggregate** — the PRD's single workflow (§6.2) has a metal-issue step, a WIP stage, and a receipt/wastage-reconciliation step; the current prototype has split this into two disconnected screens with two disconnected data models.

### 1.2 What's Structurally Missing (vs. any real schema, let alone the target one)

- No `tenant_id` / `branch_id` anywhere — implicitly single-tenant, single-branch.
- No UUIDs — ids are strings like `'item-1'`, `'cust-1'`, generated via `Date.now()` for new records (collision-prone, non-sortable, not globally unique).
- No relational integrity — `WorkOrder.karigarId` and `JobBag.assignedKarigarName` are **not** enforced foreign keys; nothing prevents orphaned references or renaming drift (`karigarName` is copy-pasted into child records instead of joined).
- No append-only/event-sourced history anywhere — `MetalRate` is a single mutable row per metal/purity; there is no rate history, no audit trail, no "what rate was actually used on this invoice" traceability (a `SaleInvoice.items[].goldPrice` is stored as a computed number, with no link back to which `MetalRate` version produced it).
- No separation between Item/Design (template) and Tag (physical, individually-weighed, serialized unit) — `JewelleryItem` conflates both, exactly the anti-pattern the Handbook calls out as "the classic generic-retail-POS instinct to resist" (Phase 3 §16).
- No `stock_ownership_type` (OWNED/GML_FINANCED/CONSIGNMENT).
- No HSN, no GST rate table, no CGST/SGST/IGST split, no invoice-numbering sequence.
- No Party PAN/GSTIN/Aadhaar/KYC fields, no PAN/TCS/PMLA threshold logic.

## 2. Target Schema (from the Developer Handbook, Phases 1–3 — the only phases drafted so far)

This is real, reviewed PostgreSQL DDL from the Handbook. It is the authoritative starting point for the actual backend schema. **Phases 4–14 (Karigar ledger, Billing/Invoice, Old Gold, GST, Accounting, Hallmarking, Schemes, CRM, Reporting, RBAC/security tables) have not been drafted yet** — see `HANDOFF.md`.

### 2.1 Master Data ERD (Handbook §2.1)

```
METAL ||--o{ METAL_PURITY : "has purities"
METAL_PURITY ||--o{ RATE_VERSION : "priced daily as"
METAL_PURITY ||--o{ ITEM_DESIGN : "made in"
ITEM_DESIGN ||--o{ MAKING_CHARGE_SCHEME : "defaults from"
ITEM_DESIGN }o--|| TAX_MASTER : "taxed via HSN"
STONE_MASTER ||--o{ ITEM_DESIGN : "used in"
BRANCH ||--o{ RATE_VERSION : "overrides (optional)"
BRANCH }o--|| TAX_MASTER : "has GSTIN/state"
PARTY ||--o{ BRANCH : "transacts at"
```

**Universal pattern:** every table carries `tenant_id`. Every table **except** `metals`/`metal_purities` and `parties` (both tenant-wide only, see below) also carries a nullable `branch_id` — NULL means "applies tenant-wide unless a branch-specific row overrides it."

### 2.2 `metals` / `metal_purities` (tenant-wide, no `branch_id`)

```sql
CREATE TABLE metals (
    metal_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    metal_code      VARCHAR(10)  NOT NULL,   -- GOLD, SILVER, PLATINUM
    metal_name      VARCHAR(50)  NOT NULL,
    default_hsn_code VARCHAR(10),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, metal_code)
);

CREATE TABLE metal_purities (
    purity_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    metal_id        UUID NOT NULL REFERENCES metals(metal_id),
    purity_name     VARCHAR(30) NOT NULL,     -- '22KT/916'
    purity_fraction NUMERIC(6,4) NOT NULL,    -- 0.9160
    standard_unit   VARCHAR(10) NOT NULL DEFAULT 'GRAM',
    hsn_code        VARCHAR(10),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- soft-delete only, never hard-deleted
    deactivated_at  TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, metal_id, purity_name),
    CONSTRAINT chk_fraction CHECK (purity_fraction > 0 AND purity_fraction <= 1)
);
```
Never hard-deleted. Deactivating hides a purity from *new* tagging but existing tagged stock remains sellable. Cache this tenant-wide in Redis/in-memory (read-heavy, write-rare); must be in the offline POS bundle.

### 2.3 `rate_versions` (append-only, event-sourced — the single most important table)

```sql
-- (full column list per Handbook §2.3; core shape:)
CREATE TABLE rate_versions (
    rate_version_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    purity_id            UUID NOT NULL REFERENCES metal_purities(purity_id),
    branch_id            UUID,              -- NULL = HQ-wide rate
    sale_rate_per_gram    NUMERIC(12,2) NOT NULL,
    purchase_rate_per_gram NUMERIC(12,2) NOT NULL,  -- buy-back rate, usually <= sale rate
    effective_from        TIMESTAMPTZ NOT NULL,
    entered_by            UUID NOT NULL,
    approved_by           UUID,
    override_reason       TEXT
);

CREATE INDEX idx_rate_lookup
    ON rate_versions (tenant_id, purity_id, branch_id, effective_from DESC);
```

**Lookup query used everywhere** (Billing, Old Gold, Valuation reports) — prefers a branch override if one exists at that timestamp, else falls back to the tenant-wide HQ rate:
```sql
SELECT * FROM rate_versions
WHERE tenant_id = :tenant
  AND purity_id = :purity
  AND effective_from <= :as_of_timestamp
  AND (branch_id = :branch OR branch_id IS NULL)
ORDER BY (branch_id IS NOT NULL) DESC, effective_from DESC
LIMIT 1;
```

🚨 **There is no `UPDATE` statement anywhere in the codebase that touches this table.** Corrections are new rows with a later `effective_from` and an `override_reason`. This is the audit trail a GST/Income-tax officer or a customer billing dispute relies on. Propagation is pub/sub (Kafka/Redis) from HQ rate-entry to branch caches, not per-bill-line polling. A fat-finger sanity check (±5% deviation from the 24KT-derived value) requires second-person approval before activation.

### 2.4 `item_designs` (the design *template* — never stores actual weight/stock)

```sql
CREATE TABLE item_designs (
    item_id            UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    design_code         VARCHAR(30) NOT NULL,
    design_family_code  VARCHAR(30),   -- groups the same design across purities
    category            VARCHAR(30),
    sub_category        VARCHAR(50),
    metal_id            UUID REFERENCES metals(metal_id),
    purity_id           UUID REFERENCES metal_purities(purity_id),
    default_mc_type      VARCHAR(10),  -- PER_GRAM | PERCENT | FIXED
    default_mc_value     NUMERIC(12,2),
    default_wastage_pct  NUMERIC(5,2),
    hsn_code            VARCHAR(10),
    gender_tag          VARCHAR(20),
    is_active           BOOLEAN DEFAULT TRUE,
    UNIQUE (tenant_id, design_code)
);
CREATE TABLE item_branch_availability (item_id UUID, branch_id UUID, is_offered BOOLEAN, PRIMARY KEY (item_id, branch_id));
CREATE TABLE item_images (item_id UUID, image_url TEXT, sort_order INT);
```
Same design in two purities = two rows sharing one `design_family_code`, never one row with multiple purities. Ad-hoc/bespoke items must be billable with **no** `item_id` at all (a "Custom Item" line).

### 2.5 `parties` (tenant-wide, NEVER branch-scoped — this is critical for TCS aggregation correctness)

```sql
CREATE TABLE parties (
    party_id        UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,          -- tenant-wide, NO branch_id
    party_name      VARCHAR(150) NOT NULL,
    mobile          VARCHAR(15) NOT NULL,
    email           VARCHAR(150),
    pan             VARCHAR(10),            -- encrypted at rest
    form60_on_file  BOOLEAN DEFAULT FALSE,
    gstin           VARCHAR(15),
    aadhaar_enc     TEXT,                   -- encrypted, masked everywhere except KYC screen
    party_type      VARCHAR(15) NOT NULL,   -- RETAIL | WHOLESALE | SCHEME | SUPPLIER
    credit_limit    NUMERIC(14,2) DEFAULT 0,
    opening_balance NUMERIC(14,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (tenant_id, mobile)
);
CREATE TABLE party_ledger_entries (
    entry_id UUID PRIMARY KEY, party_id UUID REFERENCES parties(party_id),
    branch_id UUID,   -- WHERE the txn happened, for reporting only — NOT a scoping key
    txn_type VARCHAR(20), ref_invoice_id UUID, debit NUMERIC(14,2), credit NUMERIC(14,2),
    balance_after NUMERIC(14,2), entry_date TIMESTAMPTZ
);
```
🚨 **PAN/Rule-114B/TCS/PMLA checks must be DB/service-layer constraints, never frontend-only** — a sale cannot finalize with `cash_amount >= 200000` unless `pan IS NOT NULL OR form60_on_file = true`. TCS liability aggregates cash receipts from a party **across the entire tenant**, not per-branch.

### 2.6 `mc_wastage_schemes` (three-tier override hierarchy: Category Slab → Item Design default → Transaction-time override)

```sql
CREATE TABLE mc_wastage_schemes (
    scheme_id      UUID PRIMARY KEY,
    tenant_id      UUID NOT NULL,
    branch_id      UUID,             -- NULL = tenant-wide slab
    category       VARCHAR(30),
    sub_category   VARCHAR(50),
    mc_type        VARCHAR(10),      -- PER_GRAM | PERCENT | FIXED
    mc_value       NUMERIC(12,2),
    wastage_pct    NUMERIC(5,2),
    effective_from DATE NOT NULL,
    is_active      BOOLEAN DEFAULT TRUE
);
```

### 2.7 `stone_rate_master` / `stone_certifications`

```sql
CREATE TABLE stone_rate_master (
    stone_rate_id   UUID PRIMARY KEY, tenant_id UUID NOT NULL,
    stone_type      VARCHAR(30), shape VARCHAR(20), clarity VARCHAR(10), color_grade VARCHAR(10),
    carat_range_min NUMERIC(6,3), carat_range_max NUMERIC(6,3),
    rate_per_carat  NUMERIC(12,2), rate_per_piece NUMERIC(12,2),
    effective_from  DATE NOT NULL
);
CREATE TABLE stone_certifications (
    cert_id UUID PRIMARY KEY, tag_id UUID REFERENCES tags(tag_id),
    cert_body VARCHAR(20), cert_number VARCHAR(50),
    certified_carat NUMERIC(6,3), certified_value NUMERIC(14,2), cert_file_url TEXT
);
```
Once a certification is attached, `certified_value` **always** overrides the slab-rate calculation for that stone — never silently recomputed from the slab afterward.

### 2.8 `tax_rates` / `state_codes` (append-only, versioned — never hardcode "3% GST")

```sql
CREATE TABLE tax_rates (
    tax_rate_id     UUID PRIMARY KEY, tenant_id UUID NOT NULL,
    hsn_or_sac_code VARCHAR(10), description VARCHAR(100),
    cgst_rate NUMERIC(5,2), sgst_rate NUMERIC(5,2), igst_rate NUMERIC(5,2),
    effective_from DATE NOT NULL, effective_to DATE,
    notification_ref VARCHAR(100)   -- traceability to the actual government notification
);
CREATE TABLE state_codes (state_code CHAR(2) PRIMARY KEY, state_name VARCHAR(50));
```
🚨 **Unresolved tension flagged by the Handbook (§2.8):** the PRD's own worked example (§17) bills diamond value as part of one composite 3% taxable value, while the PRD's own HSN table (§9.2) lists diamonds separately at ~1.5%. **This must be resolved with the client's CA before the GST engine is built** — see `HANDOFF.md` item 1.

### 2.9 `branches` / `inter_branch_transfers`

```sql
CREATE TABLE branches (
    branch_id          UUID PRIMARY KEY, tenant_id UUID NOT NULL,
    branch_code        VARCHAR(20) NOT NULL,
    branch_name        VARCHAR(100), address TEXT, state_code CHAR(2),
    gstin              VARCHAR(15),   -- NOT always unique per branch! (see below)
    invoice_series_prefix VARCHAR(10),
    is_active          BOOLEAN DEFAULT TRUE,
    default_stock_ownership_type VARCHAR(15) DEFAULT 'OWNED',
    UNIQUE (tenant_id, branch_code)
);
CREATE TABLE inter_branch_transfers (
    transfer_id UUID PRIMARY KEY, tenant_id UUID NOT NULL,
    from_branch_id UUID REFERENCES branches(branch_id),
    to_branch_id   UUID REFERENCES branches(branch_id),
    dispatched_at TIMESTAMPTZ, received_at TIMESTAMPTZ,
    status VARCHAR(20)   -- IN_TRANSIT | RECEIVED | DISCREPANCY
);
```
🚨 Two branches in the same state can legally share **one** GSTIN — `gstin` is not 1:1 with `branch_id`. Invoice numbering sequence is per-GSTIN-per-financial-year, never a global or per-branch counter.

### 2.10 `tags` / `tag_status_history` (Phase 3 — the atomic sellable unit)

```sql
CREATE TABLE tags (
    tag_id          UUID PRIMARY KEY, tenant_id UUID NOT NULL, branch_id UUID NOT NULL,
    item_id         UUID REFERENCES item_designs(item_id),
    purity_id       UUID REFERENCES metal_purities(purity_id),
    gross_weight    NUMERIC(10,3) NOT NULL,
    stone_weight    NUMERIC(10,3) NOT NULL DEFAULT 0,
    net_weight      NUMERIC(10,3) GENERATED ALWAYS AS (gross_weight - stone_weight) STORED,
    huid            VARCHAR(6),
    stock_ownership_type VARCHAR(15) NOT NULL DEFAULT 'OWNED',  -- OWNED | GML_FINANCED | CONSIGNMENT
    status          VARCHAR(25) NOT NULL,   -- enforced state machine, see below
    cost_rate_version_id UUID REFERENCES rate_versions(rate_version_id), -- for at-cost valuation
    barcode_value   VARCHAR(30) UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_weights CHECK (gross_weight >= stone_weight AND stone_weight >= 0)
);
CREATE TABLE tag_status_history (
    history_id UUID PRIMARY KEY, tag_id UUID REFERENCES tags(tag_id),
    from_status VARCHAR(25), to_status VARCHAR(25),
    changed_by UUID, changed_at TIMESTAMPTZ, reason TEXT
);
```
Status transitions: `RawMetal → IssuedToKarigar → ReceivedFromKarigar → PendingHallmark → Hallmarked → InStock → {MemoOut, TransferInTransit, Sold, DamagedOrMelted}`, each transition enforced by a state machine (service layer or DB trigger) — never a free-text field any code path can set arbitrarily. A tag can never be "in stock" sellable at two branches simultaneously — enforced via a unique transactional status update (first successful commit wins). HUID/barcode are never reused, even after melting/reissue.

## 3. Not Yet Designed (Phases 4–14 of the Handbook)

The following schema areas are referenced conceptually by the PRD but have **no drafted DDL** in the Handbook as currently supplied:

- Karigar issue/receipt ledger (grams payable + money payable, dual-tracked, fine-gold-equivalent reconciliation) — PRD §6.2, Handbook Phase 4 (not drafted)
- Billing/Invoice/InvoiceLine tables, the Calculation Engine's persisted output — PRD §7, Handbook Phase 5 (not drafted)
- Old Gold Exchange transaction table — PRD §8, Handbook Phase 6 (not drafted)
- GST engine tables beyond `tax_rates` (e-Invoice/IRN log, e-Way Bill log) — PRD §9, Handbook Phase 7 (not drafted)
- Chart of Accounts, journal entries, ledgers — PRD §10, Handbook Phase 8 (not drafted)
- Hallmarking dispatch/HUID allotment tracking beyond the `tags.huid` column — PRD §11, Handbook Phase 9 (not drafted)
- Gold Savings Scheme tables (enrollment, installments, bonus accrual, redemption) — PRD §12, Handbook Phase 10 (not drafted)
- CRM/Loyalty, Reporting/OLAP tables — PRD §13/14, Handbook Phase 11 (not drafted)
- RBAC/permission tables, Statutory Parameters table (the data-driven home for PAN/TCS/PMLA/Hallmarking thresholds referenced in PRD §15.3) — PRD §15, Handbook Phase 12 (not drafted)

**Before writing migrations for these areas, draft the corresponding Handbook phase(s) first** (or explicitly design them ad hoc using the same 18-point method and locked architectural decisions established in Phases 1–3), so the schema stays consistent with the rest of the system. Do not silently invent conflicting patterns.

## 4. Migration Notes (current prototype data → target schema)

If the current localStorage-driven UI is evolved rather than rebuilt from scratch:
- `JewelleryItem` must be split into `item_designs` (template) + `tags` (physical instance) — this is a breaking, non-trivial migration, not a column rename.
- `Karigar.metalBalance` / `laborChargesOwed` (two mutable running totals) must become a proper ledger (append-only entries + a materialized/derived balance), matching the Weight Ledger / Money Ledger principle.
- `WorkOrder` and `JobBag` must be unified into one Karigar Job-Work aggregate (see §1.1 above).
- `SaleInvoice`/`InvoiceItem` need `tenant_id`, `branch_id`, a real `rate_version_id` reference per line, HSN/tax split fields, and a proper sequential-per-GSTIN invoice numbering scheme — the current `INV-2026-${1000 + invoices.length + 1}` scheme is not GST-compliant (gaps/collisions possible, not GSTIN-scoped).
