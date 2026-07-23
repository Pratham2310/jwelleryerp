# Indian Jewellery Retail Management System
## Developer Implementation Handbook

**Role:** Senior Product Architect / Indian Jewellery Domain Expert / Enterprise Solution Architect
**Source PRD reviewed:** `Jewellery_Retail_Software_PRD.md` (v1.0)
**Method:** Phase-by-phase, module-by-module. Nothing is skipped. Every module will eventually cover all 18 dimensions (Business Objective → Phase Checklist). Gaps in the PRD are called out as we go, not patched over.

---

## 📖 Master Table of Contents (grows as we proceed)

- [x] **Phase 1 — Understanding the Indian Jewellery Retail Business**
- [~] **Phase 2 — Master Data Architecture** *(in progress — this document)*
  - [x] 2.1 Domain Model & Multi-Branch Architecture Decision
  - [x] 2.2 Metal Master
  - [x] 2.3 Rate Master (Daily Metal Rate)
  - [ ] 2.4 Item / Design Master
  - [ ] 2.5 Party Master (Customer/Supplier — Unified Ledger)
  - [ ] 2.6 Making-Charge / Wastage Scheme Master
  - [ ] 2.7 Stone / Diamond Rate Master
  - [ ] 2.8 Tax Master
  - [ ] 2.9 Branch / Location Master
- [ ] Phase 3 — Inventory & Tagging (the Tag as the atomic unit of the system)
- [ ] Phase 4 — Procurement & Karigar/Job-Work Management
- [ ] Phase 5 — Billing / POS Calculation Engine
- [ ] Phase 6 — Old Gold Exchange (Buyback)
- [ ] Phase 7 — GST Compliance Engine
- [ ] Phase 8 — Accounting Engine
- [ ] Phase 9 — BIS Hallmarking & HUID
- [ ] Phase 10 — Gold Savings Schemes
- [ ] Phase 11 — CRM/Loyalty, Reports & Dashboards
- [ ] Phase 12 — Security, RBAC & Statutory Hooks
- [ ] Phase 13 — System Architecture & Multi-Tenant SaaS Design
- [ ] Phase 14 — QA/Test Strategy & Worked Examples

We do not jump ahead. Each phase builds the vocabulary and mental model the next phase needs.

---

# PHASE 1 — Understanding the Indian Jewellery Retail Business

### 1.0 Why We Start Here, Not With a Database Schema

Every failed jewellery-ERP project I've seen (and every weak clone of JewelACC/LOGIC/Marg/ORNATE) fails for the same reason: the engineering team designs the database like a **generic retail POS** (SKU, quantity, fixed price) and only *later* discovers that jewellery has no SKUs, no quantities, and no fixed prices. By the time this is discovered, the schema is load-bearing and the rewrite is expensive.

So before touching a single table, you must internalize **how money and metal actually move through a real Indian jewellery shop** — from a sarafa gully shop in a small town to a Tanishq showroom. That is Phase 1.

---

### 1.1 The Core Paradigm Shift 🏗

| Generic Retail (Kirana, Apparel, Electronics) | Indian Jewellery Retail |
|---|---|
| Product = SKU with a fixed price | Product = a **unique physical piece**, priced live at sale time |
| Inventory tracked by **quantity** | Inventory tracked by **individual tag + weight** |
| One unit of value: ₹ | **Two parallel units of value**: grams (weight) AND ₹ (money) — every report must reconcile both |
| Cost is fixed at purchase | "Cost" of unsold stock **changes every day** the metal rate changes, even though nothing moved |
| Selling price = cost + margin | Selling price = **(weight × today's rate) + making + wastage + stones + GST** |
| Returns/exchanges are simple refunds | "Old Gold Exchange" is a **reverse purchase transaction with its own KYC, purity testing, and GST treatment** — never a discount |

🚨 **Critical Business Rule:** If your architecture cannot answer *"what is my total stock worth in grams AND in rupees, split by purity, as of this exact moment, using today's rate"* — the architecture is wrong. This single query is the heartbeat of the entire business, and every large chain's owner dashboard opens with it.

---

### 1.2 The End-to-End Business Lifecycle

This is the physical + financial loop that repeats every day in every jewellery business, from the smallest sarafa shop to Kalyan Jewellers. Every module in this handbook is a system built to record **one stage** of this loop.

```mermaid
flowchart TD
    A["Bullion Sourcing<br/>(Own Capital / GML Loan / Consignment)"] --> B["Raw Metal Stock<br/>(Weight Ledger)"]
    B --> C["Karigar Job-Work<br/>Metal Issued (loan of metal)"]
    C --> D["Finished Goods Received<br/>+ Wastage Reconciled"]
    D --> E["BIS Hallmarking<br/>Dispatch to AHC → HUID Allotted"]
    E --> F["Tagging<br/>Barcode/QR Generated"]
    F --> G["In-Stock Inventory<br/>(Sellable)"]
    G --> H1["Counter Sale"]
    G --> H2["Memo / Approval Out"]
    G --> H3["Repair / Alteration Job"]
    H1 --> I["GST Tax Invoice +<br/>Auto Accounting Entry"]
    J["Old Gold Exchange<br/>(Customer brings used jewellery)"] --> K["Melting"]
    K --> B
    G -.customer brings old gold.-> J
    L["Scheme Collections<br/>(Monthly Deposits)"] --> H1
    I --> M["GST Returns / Books of Accounts / CA"]
```

Notice two things that generic retail software never has to model:
1. **A closed loop back to raw material** (melting), which most retail systems have no equivalent of.
2. **Metal that the shop owns but doesn't physically hold** (with the karigar) and **metal the shop physically holds but doesn't fully own** (GML/consignment — see §1.6). This dual-ownership concept is where most home-grown ERPs break.

---

### 1.3 The Stakeholder Ecosystem

```mermaid
graph TD
    Owner(("Owner / Promoter<br/>Family"))
    Shop["Retail Shop / Branch"]
    Karigar["Karigar<br/>(In-house or Outside Job-Worker)"]
    AHC["BIS Assaying &<br/>Hallmarking Centre (AHC)"]
    Bank["Bullion Bank / Supplier<br/>(GML, Consignment, Cash Purchase)"]
    Customer["Customer"]
    CA["Chartered Accountant /<br/>Tax Consultant"]
    Gov["Regulators:<br/>GST Council · BIS · Income Tax (PMLA/TCS)"]

    Owner --> Shop
    Shop --> Karigar
    Shop --> AHC
    Shop --> Bank
    Shop --> Customer
    Customer -. old gold .-> Shop
    Customer -. scheme deposits .-> Shop
    Shop --> CA
    CA --> Gov
    Shop --> Gov
```

Each arrow above is a data flow your system must record: metal issue vouchers (Karigar), hallmarking dispatch/receipt (AHC), purchase invoices and loan drawdowns (Bank), tax invoices and receipts (Customer), and statutory filings (Gov via CA). A module that can't name which stakeholder it serves is probably not needed yet.

---

### 1.4 The Two Parallel Ledgers — Weight and Money 🚨

This is the single most important architectural mental model in the entire system, and the PRD alludes to it (§1.3.3) but never elevates it to the explicit "two independent, always-reconciling ledgers" principle it deserves.

```mermaid
flowchart LR
    subgraph WL["WEIGHT LEDGER (grams, by purity)"]
        direction TB
        W1["Metal Purchased +g"] --> W2["Issued to Karigar -g"]
        W2 --> W3["Received from Karigar<br/>+g (fine-gold equivalent)"]
        W3 --> W4["Tagged / In-Stock +g"]
        W4 --> W5["Sold -g"]
    end
    subgraph ML["MONEY LEDGER (₹)"]
        direction TB
        M1["Purchase Cost ₹"] --> M2["+ Making Charges ₹"]
        M2 --> M3["Stock Value @ Cost ₹"]
        M3 --> M4["Sale Value ₹ (incl. GST)"]
    end
    W4 -. "valued using rate on the day of tagging" .-> M3
    W5 -. "valued using today's live rate" .-> M4
```

**Why this matters for schema design (preview of Phase 2):** every stock table needs **weight columns that are the source of truth**, with money columns being a *derived, rate-dependent* view. If you store "stock value in ₹" as a persisted field without also keeping the weight and the rate-used, you cannot answer "what is this worth *today*" without replaying history — which is exactly the query owners ask most.

💡 **Best Practice:** Never persist a money value without also persisting (a) the weight it was computed from, and (b) the exact rate ID/version used. This single rule prevents 80% of the reconciliation bugs seen in home-grown jewellery software.

---

### 1.5 Business Model Variants — And Why They Need Different Architecture

The PRD treats "single-store," "multi-branch," and "national brand" as scale variations of the same thing. In reality, they differ **structurally**, not just in size:

| Dimension | Single-Store Sarafa Shop | Family-Owned / Regional Chain | National Brand (Tanishq/Kalyan/Malabar) |
|---|---|---|---|
| **Rate-setting authority** | Owner sets rate once/twice a day, manually, often by phone call with the local Sarafa Association | Head office sets rate; branches usually cannot override | Centralized rate engine, pushed to all branches/franchisees within seconds of a change; branch-level override disabled |
| **Karigar model** | 1–3 known local karigars, informal, cash/trust-based | Mix of in-house karigars + outsourced job-work across branches | Large in-house manufacturing units + regional karigar networks + vendor-supplied finished goods (multi-sourced) |
| **Hallmarking rigor** | Often partial compliance historically; increasingly enforced | Fully compliant, dedicated hallmarking coordinator | 100% compliant, HUID traceability integrated into ERP, often has in-house/contracted AHC relationships |
| **Financing of stock** | Own capital, occasional local gold loan | Own capital + **Gold Metal Loan (GML)** from a bank/bullion supplier (see §1.6) — very common | Heavy use of **GML/Metal Gold Loan** and consignment stock from suppliers; treasury function manages metal-vs-money exposure |
| **Schemes (§12 of PRD)** | Informal, ledger-book based | Formal scheme software, single GSTIN | Structured schemes run with legal safeguards (see §1.6.2) — often via a separate registered entity/trust arrangement |
| **GSTIN / Branches** | Single GSTIN | Possibly multiple GSTINs if branches cross state lines | Always multi-GSTIN (state-wise registration is mandatory), sometimes franchise-operated branches with their own GSTIN under a brand license |
| **IT sophistication** | Excel/manual + calculator historically, now demanding simple, cheap software | Wants an affordable multi-branch ERP with WhatsApp/SMS | Wants enterprise integration: ERP + CRM + BI + Tally/SAP + e-invoicing at scale |
| **Ownership model of a "branch"** | N/A | Owned branches only | **Owned showrooms AND franchise (FOFO/FOCO) showrooms** — a business model the PRD never mentions, but is central to how Kalyan and Malabar actually expanded |

🏗 **Architecture Note:** A true SaaS product must support all three tiers from **one codebase** via configuration, not via three different products:
- **Single-store** → single-tenant-feel UI, rate entry is manual and simple, most modules optional/hidden.
- **Multi-branch** → central rate propagation, inter-branch stock transfer with in-transit tracking, branch-wise GSTIN.
- **Enterprise/National** → all of the above **plus** franchise-partition of data (a franchisee should never see another franchisee's stock/customers, even on the same platform), role hierarchy up to "Regional/Cluster Manager" and "Brand HQ," and GML/consignment stock-ownership tracking.

This tiering decision belongs in your **tenant configuration model**, which we'll design properly in Phase 13, but it must be *anticipated* now — retrofitting franchise data isolation onto a single-store schema later is a rewrite, not a patch.

---

### 1.6 A Domain Reality Missing From the PRD: Gold Metal Loan (GML) & Consignment Stock 🚨

This is the most consequential gap in the source PRD, and it's worth stopping on.

**What it is:** Most mid-to-large Indian jewellers do **not** buy all their gold with cash. They borrow **gold itself** (not rupees) from a bank or bullion supplier — this is called a **Gold Metal Loan (GML)** or **Metal Gold Loan (MGL)**. The jeweller receives, say, 10 kg of gold on loan (denominated in grams, at a small interest rate on the metal), converts it into jewellery and sells it, and later **repays the loan in gold** (or its rupee-equivalent at prevailing rate) — not in the original purchase-day rupees. Similarly, some designer/branded lines are given to a retailer **on consignment** (ownership stays with the supplier/brand until sold).

**Why it matters to your system:**
- Stock sitting in the showroom is **not uniformly "owned"**. A tag might be:
  - **Owned outright** (shop's own capital)
  - **Financed via GML** (shop owns it, but owes the *lender* an equivalent weight of gold, with interest accruing in grams, not just rupees)
  - **Consignment** (shop does *not* own it until sold — it should not appear on the shop's own Balance Sheet as stock, but must still appear as "in showroom, sellable" in inventory)
- This directly affects: Balance Sheet stock valuation (Phase 8), what "available for sale" means at the tag level (Phase 3), and the interest-cost/MIS view owners actually care about (a large chain's finance team watches "GML exposure in grams" daily, just like the sales team watches revenue).

❌ **Common Developer Mistake:** Treating "In Stock" as a single binary status. The moment you build multi-branch or enterprise-tier support, "In Stock" must be **(a) sellable-or-not** and **(b) whose-balance-sheet-is-this-on** as two independent flags on the tag record.

💡 **Best Practice:** Add a `stock_ownership_type` enum (`OWNED`, `GML_FINANCED`, `CONSIGNMENT`) at the Tag/Lot level from day one, even in your MVP schema, even if Phase 1 (MVP) of the rollout only supports `OWNED`. Adding this later means a migration touching every stock and accounting table.

We will design the actual tables for this in **Phase 2/Phase 3**; for now, just carry the concept forward.

#### 1.6.1 A Second Missing Nuance: Are Gold Schemes Legally "Deposits"? ⚖

The PRD's Scheme module (§12) describes the mechanics correctly (monthly deposit → bonus → redemption in jewellery) but never flags the **compliance boundary** that makes this legal in India:

- A scheme is safe from being classified as an illegal "deposit-taking" activity (which would trigger the **Banning of Unregulated Deposit Schemes Act, 2019** and/or issues under the **Prize Chits and Money Circulation Schemes (Banning) Act, 1978**) **only if redemption is strictly in kind (jewellery) and never cash-refundable**, and the terms are transparently disclosed upfront (this is why every scheme brochure you've seen explicitly says "redeemable against jewellery purchase only, no cash refund").
- Large chains typically also register schemes under the **Consumer Protection (Direct Selling) Rules** disclosure norms and sometimes route them through a separate legal entity for ring-fencing.

⚖ **Indian Compliance Requirement:** The system must **hard-block cash refund of scheme balances** by default (configurable only with an explicit legal/compliance override, logged in the audit trail) — this is a legal safety rail, not just a UX choice. We will build this constraint into Phase 10.

---

### 1.7 Critical Review of PRD Sections 0–3 (Line-by-Line)

**What the PRD gets right:**
- The Industry Primer (§1) correctly identifies the core vocabulary (GW/SW/NW, Wastage, HUID) and the "why this differs from generic retail" framing — this is a strong foundation.
- §1.3 already senses the dual-unit (weight+money) problem, though it doesn't develop it into an explicit ledger-pair architecture (we did that in §1.4 above).
- The Persona table (§3) is a reasonable *operational* role list.

**Gaps and ambiguities you must resolve before Phase 2:**

1. **🚨 No stock-ownership/financing concept anywhere** (§1.6 above) — affects Master Data, Inventory, and Accounting phases materially. This is the single biggest omission.
2. **Persona table (§3) is missing enterprise-tier roles:** no "Franchise Owner/Partner," no "Regional/Cluster Manager," no "Brand HQ Compliance Officer." Without these, your RBAC model (Phase 12) will need a breaking change the day a national-brand customer signs up.
3. **Persona table conflates "Inventory/Stock Manager" with "Purchase Manager."** In real chains these are different people with different approval limits (a stock manager tags and transfers; a purchase manager commits capital to buy metal/consignment). Worth splitting in Phase 2's RBAC design.
4. **Scheme module (§12) has no compliance guardrail** for cash-refund (see §1.6.1) — must be added as an explicit business rule, not left to configuration alone.
5. **"Out of Scope" (§2) doesn't address franchise/FOFO-FOCO billing separation** — if this product is meant to also serve growing regional chains that later franchise out, this decision needs to be made explicitly now (even if the answer is "not in v1"), because it changes the tenant model.
6. **Vision (§2) doesn't state a primary target segment for MVP prioritization.** "Single-store jeweller wanting simple billing" and "50-branch chain wanting GML tracking and franchise isolation" pull the MVP scope in very different directions. This is a product decision I'll ask you to make explicitly before Phase 2, since it determines how much of Phase 2's schema needs multi-tenant/multi-ownership fields from day one versus deferred.
7. **No mention of stock insurance / bank hypothecation of inventory** — many jewellers pledge showroom stock as collateral for a Cash Credit (CC) limit; hypothecated stock often has reporting obligations to the bank (a "stock statement" submitted monthly). Not urgent for MVP, but worth a placeholder field in Phase 2's Branch/Metal master.

None of these are reasons to distrust the PRD — it's an unusually strong document for a first draft. They are exactly the kind of gaps that only surface when you model the *actual business* first, which is the entire point of Phase 1.

---

### 1.8 SaaS Suitability Assessment (Preview)

| Deployment Target | Is Current PRD Design Sufficient As-Is? | Verdict |
|---|---|---|
| Single-store jeweller | Yes, largely | PRD's modules map cleanly; just hide GML/franchise complexity behind config |
| Multi-branch regional chain | Mostly, with gaps | Needs GML/consignment ownership flag (§1.6) and finer RBAC (§1.7-3) before Phase 8/12 build |
| National / enterprise / franchise | No — needs explicit design decisions | Needs franchise data-partition, GML tracking, Regional Manager role, and a scheme compliance guardrail before those modules are built (Phases 10, 12, 13) |

We'll revisit this table at the end of every phase and update the checkboxes as gaps get closed.

---

### 1.9 🚩 Decision Needed Before Phase 2 — RESOLVED

**Decision:** Architect for **multi-branch regional chain** first.

**Implication locked in for Phase 2 onward:**
- Every master data table carries `tenant_id` + `branch_id` (nullable `branch_id` = tenant-wide/HQ-level record) from day one.
- Rate Master is designed with **centralized HQ rate-setting + real-time propagation to branches**, with a controlled branch-level override path (permissioned, reason-logged) — not the single-shop "one person types the rate" model.
- Branch-wise GSTIN linkage is mandatory in Branch Master, not deferred.
- `stock_ownership_type` (§1.6) is included as a field now, but enterprise-only concerns (franchise data partitioning, Regional/Cluster Manager role) are *noted but deferred* — regional chain ≠ full franchise network yet. We'll revisit if you later confirm franchise support is needed.

---

### 1.10 Phase 1 Completion Checklist ✅

- [x] Understand why jewellery pricing is fundamentally different from generic retail (weight × live rate, not fixed SKU price)
- [x] Understand the full physical+financial lifecycle loop (bullion → karigar → hallmarking → tag → sale/exchange → accounting → back to melting)
- [x] Understand the stakeholder ecosystem and which module will serve which stakeholder
- [x] Internalize the **Weight Ledger / Money Ledger** dual-ledger model — this governs schema design in every future phase
- [x] Understand how single-store, regional-chain, and national-brand businesses differ *structurally*, not just in scale
- [x] Understand Gold Metal Loan (GML) and consignment stock as a first-class domain concept, missing from the PRD
- [x] Understand the legal guardrail around Gold Scheme cash-refunds
- [x] Have a documented list of PRD gaps to resolve before/during Phase 2

---

### 1.11 What Phase 2 Will Cover

**Phase 2 — Master Data Architecture**, covering (per the full 18-point framework: Business Objective through Phase Checklist) for each of: Metal Master, Rate Master (including the rate-versioning/history design that everything else depends on), Item/Design Master, Party Master (with the PAN/TCS/PMLA rules built in as data-level constraints, not app-level afterthoughts), Making-Charge/Wastage Scheme Master, Stone/Diamond Rate Master, Tax Master, and Branch/Location Master — plus the `stock_ownership_type` groundwork from §1.6 and the ERD showing how they all relate.

---

*End of Phase 1.*

---
---

# PHASE 2 — Master Data Architecture

**Decision locked (§1.9):** Architecting for **multi-branch regional chain** first. Every design decision below assumes multiple branches, one or more GSTINs, and a central HQ that sets policy — with room to grow into full enterprise/franchise later without a rewrite.

### 2.1 The Master Data Domain Model

Master data is the *shared vocabulary* every transaction module (Tagging, Billing, Karigar, Old Gold, Accounting) speaks. Get this wrong and every downstream module inherits the mistake permanently — master data is nearly impossible to safely restructure once transactions reference it.

```mermaid
erDiagram
    METAL ||--o{ METAL_PURITY : "has purities"
    METAL_PURITY ||--o{ RATE_VERSION : "priced daily as"
    METAL_PURITY ||--o{ ITEM_DESIGN : "made in"
    ITEM_DESIGN ||--o{ MAKING_CHARGE_SCHEME : "defaults from"
    ITEM_DESIGN }o--|| TAX_MASTER : "taxed via HSN"
    STONE_MASTER ||--o{ ITEM_DESIGN : "used in"
    BRANCH ||--o{ RATE_VERSION : "overrides (optional)"
    BRANCH }o--|| TAX_MASTER : "has GSTIN/state"
    PARTY ||--o{ BRANCH : "transacts at"

    METAL {
        uuid metal_id PK
        string metal_code
    }
    METAL_PURITY {
        uuid purity_id PK
        uuid metal_id FK
        numeric purity_fraction
    }
    RATE_VERSION {
        uuid rate_version_id PK
        uuid purity_id FK
        uuid branch_id FK "nullable = HQ-wide"
        numeric sale_rate_per_gram
        timestamp effective_from
    }
    BRANCH {
        uuid branch_id PK
        string gstin
        string state_code
    }
    PARTY {
        uuid party_id PK
        string pan
        string gstin
    }
```

🏗 **Architecture Note:** Every table in this diagram carries `tenant_id`. Every one **except METAL, METAL_PURITY, TAX_MASTER policy definitions** also carries a nullable `branch_id` — nullable meaning "this record applies across all branches unless a branch-specific row overrides it." This single pattern (tenant-wide row with `branch_id = NULL`, overridden by a branch-specific row when present) is what lets one schema serve single-store and multi-branch tenants without a fork.

---

### 2.2 MODULE: Metal Master

#### 1. Business Objective
Provide the single, canonical, tenant-wide list of metals and purities the business deals in, so every other module references a normalized ID — never a free-text string like `"22K"` or `"916"` typed differently by different staff.

#### 2. Jewellery Domain Concepts
- **Purity/Fineness/Karat**: 24KT gold = 999 fine (100% pure); 22KT ≈ 916 (91.6% pure) — the dominant retail gold purity in India; 18KT = 750 (common for diamond-studded jewellery, since higher-karat gold is too soft to securely hold stone settings); 14KT = 585. Silver: 999 (fine silver, used for coins/bars) or 925 (Sterling, used for articles/utensils).
- **Standard unit**: India quotes gold conventionally per **10 grams** in the bullion/newspaper market, but internal system calculation must normalize to **per-gram** to avoid repeated unit-conversion bugs throughout the codebase.
- A **purity** is metal + a fineness fraction; it is the atomic unit that Rate Master prices and that every tag/item ultimately references.

#### 3. End-to-End Business Workflow
This master is set up **once at tenant onboarding** (pre-seeded with standard Indian purities) and changed **rarely** — only when the business adds a new product line (e.g., starts a platinum range, or a regional branch needs a locally-conventional purity like 970). In a multi-branch chain, this master is **HQ-owned and tenant-wide**; branches never create their own metals/purities — this is what keeps "22KT" meaning exactly the same thing across every branch's tags, rates, and reports.

```mermaid
flowchart LR
    A["Tenant Onboarding"] --> B["Pre-seed standard purities<br/>(24K/999, 22K/916, 18K/750, Silver 999/925)"]
    B --> C["HQ Admin reviews/edits"]
    C --> D["Available tenant-wide<br/>to all branches (read-only there)"]
    D --> E{"New product line?<br/>e.g. Platinum range"}
    E -->|Yes| F["HQ Admin adds new purity"]
    F --> D
```

#### 4. Database Design Thinking
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
    purity_fraction NUMERIC(6,4) NOT NULL,    -- 0.9160  (CHECK: 0 < x <= 1)
    standard_unit   VARCHAR(10) NOT NULL DEFAULT 'GRAM',
    hsn_code        VARCHAR(10),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = hidden from NEW tagging, not a delete
    deactivated_at  TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, metal_id, purity_name),
    CONSTRAINT chk_fraction CHECK (purity_fraction > 0 AND purity_fraction <= 1)
);
```
🚨 **Critical Business Rule:** No `branch_id` column here. Metal/Purity is **tenant-wide by design** — a branch cannot invent its own purity. This is the one master in the whole system that should *not* follow the nullable-branch-override pattern from §2.1, because purity meaning must be identical everywhere for rate/reporting integrity.

#### 5. Backend Architecture
Expose via a lightweight **Master Data Service**. This is read-heavy (called on nearly every billing line, tagging action, and report) and write-rare (edited maybe a few times a year). Cache the full active purity list per tenant in Redis/in-memory with a TTL + explicit invalidate-on-write; never let the billing hot path hit Postgres for this lookup.

#### 6. Frontend Screens
- **HQ Settings → Metal & Purity Master**: list, add, deactivate. HQ/Owner role only.
- Everywhere else (Item Master, Tagging, Billing): a read-only dropdown sourced from cache, scoped to `is_active = true`.

#### 7. Business Rules
- 🚨 A purity is **never hard-deleted**, only deactivated — historical tags, rates, and invoices reference it permanently.
- Deactivating a purity hides it from *new* tagging/purchase entry, but **existing tagged stock in that purity remains fully sellable** until sold out — deactivation is forward-looking only.
- `purity_fraction` is the single source of truth used to derive purity-specific rates from the 24KT base rate (Rate Master, §2.3) and to compute Fine Gold Equivalent for Karigar reconciliation (Phase 4).

#### 8. Validation Rules
- `purity_fraction` strictly between 0 (exclusive) and 1 (inclusive).
- `purity_name` unique per metal per tenant.
- Cannot deactivate the last remaining active purity of a metal that has open (unsold) stock — soft warning, not a hard block (owner may legitimately be discontinuing a line).

#### 9. Compliance Requirements ⚖
`default_hsn_code` must align with the GST HSN table (gold/silver/platinum jewellery = HSN 7113, per current GST Council notification — see Phase 7). This master only stores the *default* for auto-fill convenience; the authoritative GST rate itself lives in Tax Master and must be independently verifiable/updatable, since GST notifications change.

#### 10. Edge Cases
- Regional purity conventions that don't fit a clean KT number (e.g., some markets historically use 970 or other in-between fineness for specific traditional ornament styles) — the fraction field must accept **any** value in range, never a fixed enum/dropdown of "standard" karats only.
- A branch in a different state insists on a locally-used purity naming convention — resolved by tenant-wide naming plus (in Phase 2.9, Branch Master) a display-label override, not a duplicate purity record.

#### 11. Module Dependencies
Item/Design Master (purity FK), Rate Master (prices each purity), Tagging (tag stores purity_id), Billing Engine (rate lookup by purity), Karigar module (Fine Gold Equivalent calc), GST/HSN (Tax Master).

#### 12. Reports & KPIs
Metal/Purity-wise stock summary (foreshadowed — built fully in Phase 3), Purity Master change audit log.

#### 13. Security Considerations
Write access restricted to Owner/Admin/HQ role only; every create/deactivate is audit-logged (old value, new value, user, timestamp, reason) per PRD §14.9.

#### 14. Performance Considerations
Must be servable from cache in <5ms; must be bundled into the **offline POS cache** (PRD §16.2) so branches can keep billing during an internet outage without this lookup failing.

#### 15. Testing Strategy
Unit tests: fraction range validation; uniqueness constraint; deactivate-does-not-orphan-existing-tags; cache invalidation fires correctly on write; offline bundle includes latest active set.

#### 16. Common Developer Mistakes ❌
- Storing purity as a raw string (`"22K"`, `"916"`, `"22kt"` — three different strings for one concept) scattered across tables instead of a single FK — this alone causes most cross-report reconciliation bugs in first-draft jewellery software.
- Hardcoding purity fractions in application code instead of reading from this master — breaks the moment a shop needs a non-standard purity.
- Forgetting to seed default HSN codes at tenant onboarding, causing silent GST miscalculation later that's hard to trace back to "an empty master field."

#### 17. Production Best Practices 💡
Pre-seed standard Indian purities at onboarding (24KT/999, 22KT/916, 18KT/750, 14KT/585, Silver 999, Silver 925, Platinum 950) but keep the master fully editable; enforce soft-delete-only at the database constraint level, not just in application logic, so a future developer can't "clean up" the table with a DELETE statement.

#### 18. Phase Completion Checklist ✅
- [ ] `metals` and `metal_purities` tables created, tenant-scoped, no `branch_id`
- [ ] Soft-delete (`is_active`) enforced, hard delete blocked at DB level
- [ ] Standard purity seed data script written
- [ ] Redis/in-memory cache layer with invalidate-on-write
- [ ] Offline POS bundle includes this master
- [ ] Audit logging wired for create/deactivate

---

### 2.3 MODULE: Rate Master (Daily Metal Rate)

This is the single most important master in the entire system — nearly every rupee figure the business produces traces back to a row in this table. Get the versioning model wrong here and no amount of correct billing-engine code downstream can save you.

#### 1. Business Objective
Provide a **live, immutable, fully-auditable** record of "what is 1 gram of purity X worth right now," centrally set by HQ and propagated to all branches in near real time, while still allowing a controlled, logged branch-level override for genuine local market variance.

#### 2. Jewellery Domain Concepts
- Rate is set once or **multiple times a day** (intraday revisions are normal, especially around bullion market volatility or festivals).
- **Sale Rate** vs **Purchase/Buy-back Rate** — the shop always buys old gold back slightly below what it sells at (its margin/risk buffer on old gold exchange, Phase 6).
- Rates for 22KT/18KT/14KT are conventionally **derived from the 24KT base rate × purity fraction**, but real shops frequently round or manually adjust the derived figure to match local market/association convention — the system must support **both** auto-derivation and manual override, per purity, on every revision.
- "**Active rate**" is not "today's rate" — it is the *latest revision whose `effective_from` timestamp has passed*, which may be the 3rd revision of the day by 2 PM.

#### 3. End-to-End Business Workflow

```mermaid
sequenceDiagram
    participant HQ as HQ Admin
    participant RM as Rate Master Service
    participant Cache as Pub/Sub + Cache Layer
    participant Branch as Branch POS / Billing Engine
    HQ->>RM: Enter 24KT Gold Sale Rate = ₹X, Buy-back Rate = ₹Y
    RM->>RM: Auto-derive 22K/18K/14K rates (purity_fraction), HQ may override any derived value
    RM->>RM: INSERT new immutable rate_version row (effective_from = now)
    RM->>Cache: Publish "new active rate set" event, tenant-wide
    Cache-->>Branch: Push (or next poll) delivers updated rate to local cache
    Branch->>Branch: Billing engine reads latest ACTIVE rate as of invoice timestamp
    Note over Branch: Manager may override at bill-level<br/>only with a logged reason (rare exception path)
```

#### 4. Database Design Thinking
```sql
CREATE TABLE rate_versions (
    rate_version_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    branch_id            UUID NULL,   -- NULL = HQ tenant-wide rate; set = branch-specific override
    purity_id            UUID NOT NULL REFERENCES metal_purities(purity_id),
    sale_rate_per_gram      NUMERIC(12,2) NOT NULL CHECK (sale_rate_per_gram > 0),
    purchase_rate_per_gram  NUMERIC(12,2) NOT NULL CHECK (purchase_rate_per_gram > 0),
    effective_from       TIMESTAMPTZ NOT NULL,
    entered_by           UUID NOT NULL,
    approved_by          UUID,
    is_override          BOOLEAN NOT NULL DEFAULT FALSE,
    override_reason      TEXT,             -- mandatory if is_override = true
    derived_from_version_id UUID REFERENCES rate_versions(rate_version_id), -- traceability if auto-derived
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    -- NOTE: no updated_at, no UPDATE ever performed on this table.
);

CREATE INDEX idx_rate_lookup
    ON rate_versions (tenant_id, purity_id, branch_id, effective_from DESC);
```
🚨 **Critical Business Rule:** `rate_versions` is **append-only**. There is no `UPDATE` statement anywhere in the codebase that touches this table. "Correcting" a mistaken rate entry means inserting a *new* row with a later `effective_from` and an `override_reason` explaining the correction — never editing history. This is the exact evidentiary trail a GST/Income-tax audit or an internal dispute (customer claims they were billed at yesterday's rate) relies on.

**Lookup logic** (used everywhere — Billing, Old Gold, Valuation reports):
```sql
SELECT * FROM rate_versions
WHERE tenant_id = :tenant
  AND purity_id = :purity
  AND effective_from <= :as_of_timestamp
  AND (branch_id = :branch OR branch_id IS NULL)
ORDER BY (branch_id IS NOT NULL) DESC, effective_from DESC
LIMIT 1;
```
This prefers a branch-specific override if one exists at that timestamp, else falls back to the HQ tenant-wide rate — this single query pattern is what makes the nullable-`branch_id` design from §2.1 actually work in practice.

#### 5. Backend Architecture 🏗
Rate Master runs as its own service with a **publish/subscribe** channel (Kafka topic or Redis pub/sub) — the moment HQ activates a new rate, an event fans out to every branch's local cache instantly, rather than branches polling the database on every bill line (which would both be slow and hammer the DB during festival-season load spikes, PRD §16.2). Each branch POS keeps a **local in-memory "current rate per purity" cache**, refreshed by the subscription, with a periodic reconciliation poll as a safety net. Offline POS clients persist the last-received rate bundle to local storage and display a "rate last updated at HH:MM — may be stale" banner if disconnected beyond a configurable tolerance (e.g., 30 minutes) rather than silently billing on old data.

#### 6. Frontend Screens
- **HQ Rate Entry** (fast, large numeric-keypad UI — done under time pressure every morning): enter 24KT sale + buy-back rate → auto-derived table for every other active purity appears instantly, editable inline → single "Activate" action.
- **Branch Rate Ticker/Board** (read-only): many shops physically display a rate board; this screen can double as that public-facing display.
- **Rate History & Audit**: full immutable history, filterable by purity/branch/date, exportable for the CA.
- **Branch Override** screen: permissioned separately from normal billing permission; mandatory reason field; flags to HQ if the override deviates from HQ rate beyond a configured tolerance.

#### 7. Business Rules 🚨
- Billing **always** resolves rate by `(tenant, purity, branch, invoice_timestamp)` — never by calendar date alone, since multiple revisions per day are the norm, not the exception.
- An **Advance/Booking** (Phase 5, PRD §7.6) that locks today's rate does so by **storing the specific `rate_version_id`**, not a copied number — at conversion time, the system re-fetches that exact version unless staff explicitly opts to re-price at the current live rate.
- Purchase (buy-back) rate must be ≤ sale rate for the same purity — a soft validation warning, not a hard block, since rare local exceptions can occur but should always be surfaced for review.

#### 8. Validation Rules
- Both rate fields > 0.
- If a purity's rate is manually overridden away from its 24KT-derived value by more than a configurable sanity threshold (e.g., ±5%), the system requires a second-person approval before activation. This single guard rail catches the single most damaging real-world failure mode in this domain: a fat-fingered rate entry (an extra zero, a decimal shift) that silently misprices every bill for the rest of the day until someone notices.

#### 9. Compliance Requirements ⚖
Rate history must be preserved **permanently, never purged** — it is the primary evidence that a specific invoice's metal valuation was correct and untampered-with, and is exactly the kind of register a GST or Income Tax officer can ask to inspect (PRD §5.5 treats the *stock* register as inspectable; the *rate* register underpinning every stock valuation deserves the same permanence guarantee, and the PRD doesn't say this explicitly — worth calling out as a strengthening addition).

#### 10. Edge Cases
- Two HQ users submitting a rate revision within the same second (race condition) — needs a serialized write path (DB-level unique constraint or application-level lock per tenant+purity) so one write cleanly supersedes the other with a deterministic `effective_from` ordering.
- A branch goes offline right when HQ pushes a new rate — must queue and reconcile on reconnect; must never let a branch silently keep billing on a stale cached rate indefinitely (staleness banner + configurable hard cutoff).
- Festival days (Akshaya Tritiya, Dhanteras) with 10+ revisions in one day — UI must show "latest 5, expand for full history," not an unbounded flat list.
- A branch legitimately needs a different rate due to local market convention — handled via the permissioned override path, never a workaround in application code.

#### 11. Module Dependencies
Metal Master (purity FK, §2.2), Billing Engine (every single line item, Phase 5), Old Gold Exchange (buy-back rate, Phase 6), Stock Valuation reports ("at market" vs "at cost" views, Phase 3/8), Advance/Booking rate-lock (Phase 5).

#### 12. Reports & KPIs
Rate History/Audit Trail, Rate Volatility report (revisions-per-day trend — also a useful signal for reviewing staff override patterns), Branch Rate Variance report (branch override vs HQ rate, outliers flagged).

#### 13. Security Considerations
Write access restricted to a specific "Rate Setter" permission (typically Owner/Admin at HQ) distinct from general admin rights; branch override requires its own distinct permission; every write is immutably audit-logged (this table *is* the audit log, by design).

#### 14. Performance Considerations
Rate lookup sits in the hot path of every billing line — PRD §16.2 budgets <200ms per line for the whole calculation engine, so this specific lookup must be served from the local branch cache in low single-digit milliseconds, never a live cross-network DB query per line.

#### 15. Testing Strategy
Concurrency test (simultaneous rate submissions resolve deterministically), derivation-accuracy test (24KT → 22K/18K/14K arithmetic), rate-lock/advance-booking honoring test, offline-cache staleness-banner test, fat-finger sanity-threshold test, branch-override-precedence-in-lookup-query test.

#### 16. Common Developer Mistakes ❌
- Running `UPDATE rate_versions SET sale_rate = ...` to "fix" a wrong entry — destroys the audit trail; the correct fix is always a new row.
- Looking up rate by `DATE(effective_from) = today` instead of a timestamp comparison — silently breaks the moment there's a second revision in the same day.
- Skipping the cache/pub-sub layer and querying Postgres directly per bill line — works fine in a demo, then collapses under real festival-season concurrent load.

#### 17. Production Best Practices 💡
Treat this table as an **event-sourced ledger**, not a "current value with history" table — the mental model matters because it changes how every future developer is tempted to write to it. Build the fat-finger sanity-threshold guard rail from day one; it is cheap to build and prevents the single most damaging class of error in this entire domain. Make the HQ rate-entry screen fast and low-friction, since it is done under genuine time pressure every single morning by someone who wants to get back to the sales floor.

#### 18. Phase Completion Checklist ✅
- [ ] `rate_versions` table created, append-only enforced (no UPDATE path exists in code or DB permissions)
- [ ] Pub/sub propagation from HQ to branch caches implemented
- [ ] Branch-override permission separate from HQ rate-setter permission
- [ ] Fat-finger sanity-threshold check with second-approval flow
- [ ] Offline staleness banner + cutoff implemented
- [ ] Rate-lock mechanism for Advance/Booking stores `rate_version_id`, not a copied number
- [ ] Rate History/Audit and Branch Variance reports available

---

### 2.4 What Comes Next in Phase 2

Next up: **Item/Design Master** and **Party Master** — the latter needs real care, since the PAN/TCS/PMLA rules from PRD §4.4 have to be built as *data-level constraints* on the Party/transaction tables (not just a UI warning), or they will eventually be bypassed. After that: Making-Charge/Wastage Scheme Master, Stone/Diamond Rate Master, Tax Master, and Branch Master (where the GSTIN-per-branch and `stock_ownership_type` groundwork from §1.6 gets finalized).

---

*End of Phase 2, Part A (Metal Master + Rate Master).*

---
---

### 2.5 MODULE: Item / Design Master

**1. Business Objective:** Define the *design template* (not a fixed-price SKU) — category, default making charge/wastage, HSN, images — that every physical Tag (Phase 3) instantiates with its own actual weight.

**2. Domain Concepts:** "SKU" doesn't fit jewellery; **Item = design template**, **Tag = sellable instance** with real weight. Category (Ring, Necklace, Bangle, Chain, Earring, Bracelet, Pendant, Coin, Bar) and sub-category (Ladies/Gents/Kids; Traditional/Modern/Antique/Casting/Handmade) drive default making-charge slabs.

**3. Workflow:** Created at design stage (in-house design or received from karigar/supplier) → default MC/wastage/HSN attached → reused as a template every time a batch of that design is tagged. In a multi-branch chain, the design catalog is tenant-wide, with a per-branch "offered here" flag (flagship stores often carry a heavier bridal range that smaller branches don't stock).

**4. Database Design Thinking:**
```sql
CREATE TABLE item_designs (
    item_id            UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    design_code         VARCHAR(30) NOT NULL,
    design_family_code  VARCHAR(30),   -- groups same design across purities, see Edge Cases
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

**5. Backend Architecture:** Extension of the Master Data Service; cached; a search/filter index (category, sub-category, gender, price band) is needed once the catalog grows past a few thousand designs — large chains carry tens of thousands.

**6. Frontend Screens:** HQ design-catalog admin (image upload, branch-availability toggle); counter search/filter screen for staff.

**7. Business Rules 🚨:** Resolving an ambiguity between PRD §4.3 (item-level defaults) and §4.5 (category-level slabs): the correct hierarchy is a **three-tier override chain — Category Slab (§2.6) → Item Design default (this table) → Transaction-time override (Phase 5, with approval)**. The PRD never states this hierarchy explicitly; it matters, because without it, two developers will build two different, conflicting "default" resolution paths.

**8. Validation Rules:** `design_code` unique per tenant; MC value non-negative; wastage % 0–100, flagged for review above ~15%.

**9. Compliance Requirements ⚖:** HSN default inherited from Metal Master but overridable per item — a diamond-studded gold design may need different classification handling once Phase 7's HSN-split question (raised in §2.8 below) is resolved.

**10. Edge Cases:** The same design offered in two purities (e.g., 22K and 18K versions of one ring) → model as two separate `item_designs` rows sharing one `design_family_code` for reporting rollups, never a single row with multiple purities. Bespoke/custom-order pieces (Phase 5) may have no catalog entry at all — billing must support an ad-hoc "Custom Item" line not tied to any `item_id`, optionally promoted to a catalog design later.

**11. Module Dependencies:** Metal/Purity Master, Making-Charge Scheme Master (§2.6), Billing Engine (Phase 5), Stone Master (§2.8) for studded designs.

**12. Reports & KPIs:** Design-wise sales velocity, category-wise contribution, slow-moving design report (feeds the Ageing Report in Phase 3).

**13. Security Considerations:** HQ/merchandising role writes; branch staff read-only, with availability-toggle rights only if explicitly delegated.

**14. Performance Considerations:** Full-text/faceted search index required at catalog scale; cached for counter-side lookups.

**15. Testing Strategy:** design-code uniqueness; design-family rollup correctness across purity variants; ad-hoc custom-item bypass path; branch-availability filter correctness.

**16. Common Developer Mistakes ❌:** Conflating Item with Tag — putting weight/quantity fields on this table is the classic generic-retail-POS instinct to resist; this table holds *only* design metadata and defaults, never actual stock.

**17. Production Best Practices 💡:** Introduce `design_family_code` from day one — retrofitting cross-purity reporting rollups onto an existing catalog is painful and error-prone.

**18. Phase Completion Checklist:**
- [ ] `item_designs` + `item_branch_availability` + `item_images` tables created
- [ ] Three-tier MC/wastage override hierarchy documented and implemented consistently
- [ ] Ad-hoc custom-item billing path supported without a catalog entry
- [ ] Search index in place for catalog-scale lookups

---

### 2.6 MODULE: Party Master (Customer & Supplier — Unified Ledger)

**1. Business Objective:** One unified ledger entity (Tally-style "Party") since the same individual can be both a debtor (buyer) and a creditor (old-gold seller) — avoids duplicated/fragmented records and lets balances net correctly.

**2. Domain Concepts:** PAN mandatory above ₹2,00,000 cash (Rule 114B), Form 60 as the no-PAN fallback, GSTIN for B2B invoicing/ITC, TCS (Sec 206C) on qualifying cash receipts, PMLA Cash Transaction Report (CTR) threshold at ₹10 lakh, Aadhaar as optional high-value KYC.

**3. End-to-End Workflow:** Created at first transaction (search-by-mobile is the primary lookup, PRD §7.1) or pre-registered (scheme enrollment, wholesale account).

🏗 **Architecture Note (locked in by the multi-branch decision, §1.9):** Party Master **must be tenant-wide, not branch-scoped**. A customer's purchase history, credit limit, and — critically — their **aggregate TCS threshold across all branches** must be consistent no matter which branch they walk into. Branch-scoping this table is a common, subtle mistake that silently breaks both chain-wide loyalty (Phase 11) and TCS aggregation (a genuine compliance risk, since the ₹2,00,000/threshold rules apply to the *person*, not to "the person at Branch A").

**4. Database Design Thinking:**
```sql
CREATE TABLE parties (
    party_id        UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,          -- tenant-wide, NO branch_id here
    party_name      VARCHAR(150) NOT NULL,
    mobile          VARCHAR(15) NOT NULL,
    email           VARCHAR(150),
    pan             VARCHAR(10),            -- encrypted at rest
    form60_on_file  BOOLEAN DEFAULT FALSE,
    gstin           VARCHAR(15),
    aadhaar_enc     TEXT,                   -- encrypted, masked in all UI except KYC screen
    party_type      VARCHAR(15) NOT NULL,   -- RETAIL | WHOLESALE | SCHEME | SUPPLIER
    credit_limit    NUMERIC(14,2) DEFAULT 0,
    opening_balance NUMERIC(14,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (tenant_id, mobile)
);
CREATE TABLE party_ledger_entries (
    entry_id UUID PRIMARY KEY, party_id UUID REFERENCES parties(party_id),
    branch_id UUID,   -- WHERE the txn happened, for reporting -- not a scoping key on the party itself
    txn_type VARCHAR(20), ref_invoice_id UUID, debit NUMERIC(14,2), credit NUMERIC(14,2),
    balance_after NUMERIC(14,2), entry_date TIMESTAMPTZ
);
```

**5. Backend Architecture:** A Party Service exposing search-by-mobile as its primary API, a duplicate-detection/merge utility (a very real operational need — the same customer routinely gets entered twice under a mistyped mobile number, and ledger history must survive a merge intact), and a ledger-posting API consumed by Billing, Old Gold, and Scheme modules alike.

**6. Frontend Screens:** Quick-add-customer modal at the billing counter (mobile + name minimum; more fields required only once a compliance threshold is triggered); full Party profile (ledger, purchase history, scheme enrollments) visible only to Owner/Accountant per PRD §15.2 — counter staff see a limited view.

**7. Business Rules 🚨 (enforced as data-level constraints, not UI-only checks — this directly resolves the open question from the end of Phase 2's first message):**
- A sale cannot be finalized with `cash_amount >= 200000` unless the linked party has a non-null `pan` OR `form60_on_file = true`. This check belongs in the invoice-finalization service/stored procedure — **never only in the frontend form**, since a frontend-only check is trivially bypassed by direct API calls or bulk imports.
- TCS liability is computed from **cumulative cash receipts from a party across the entire tenant** (all branches), not per-branch — a service-level trigger, not a per-invoice isolated check.
- PMLA CTR: cash transactions ≥ ₹10 lakh (single or connected) are auto-flagged into a compliance review queue table, never silently passed through.

**8. Validation Rules:** mobile mandatory and unique per tenant; PAN format regex; GSTIN format + checksum validation when provided.

**9. Compliance Requirements ⚖:** Rule 114B, TCS Sec 206C, PMLA CTR — all three enforced as described above; PAN/Aadhaar encrypted at rest (PRD §15.2).

**10. Edge Cases:** Family members sharing one mobile number (needs a "linked family group" concept for loyalty/scheme purposes without merging distinct legal identities, since PAN differs); NRI/foreign customers with no PAN/Aadhaar (Form 60 or passport-based KYC path); wholesale B2B buyers needing GSTIN-based invoicing distinct from the retail flow.

**11. Module Dependencies:** Billing (every invoice), Old Gold Exchange (seller KYC), Scheme (enrollment), Accounting (Debtors/Creditors ledger, Phase 8).

**12. Reports & KPIs:** Customer-wise sales history, PAN/Form-60 Compliance Report (flags transactions missing mandatory PAN), TCS Report, Cash Transaction/PMLA Report, Credit-limit-exceeded report.

**13. Security Considerations:** PAN/Aadhaar visible only to Owner/Accountant roles; counter staff see name/mobile/loyalty tier only — not full financial/KYC detail.

**14. Performance Considerations:** Mobile-number search must be sub-100ms — it's the very first action of every single billing transaction; index on `(tenant_id, mobile)`.

**15. Testing Strategy:** dedupe/merge correctness (ledger history intact post-merge), PAN-threshold-block trigger test, tenant-wide TCS-aggregation test, encryption-at-rest verification.

**16. Common Developer Mistakes ❌:** Branch-scoping the customer table (breaks chain-wide loyalty and TCS aggregation); implementing the PAN/₹2,00,000 rule only as a frontend form validation (bypassable via API/bulk import); storing PAN/Aadhaar in plaintext.

**17. Production Best Practices 💡:** Build the PAN/TCS/PMLA rules as database triggers or a dedicated compliance-check service every entry point (POS, API, bulk import) must pass through — never rely on any single UI form being the only gate.

**18. Phase Completion Checklist:**
- [ ] `parties` table is tenant-wide, no `branch_id` column
- [ ] PAN/Form-60 threshold enforced at the service/DB layer, not just the UI
- [ ] TCS aggregation computed across all branches for one party
- [ ] PAN/Aadhaar encrypted at rest, masked in non-KYC views
- [ ] Duplicate-party merge tool preserves ledger history

---

### 2.7 MODULE: Making-Charge / Wastage Scheme Master

**1. Business Objective:** Predefine MC/wastage slabs by category so counter staff never has to remember or manually type rates — reduces billing errors and speeds up the counter.

**2. Domain Concepts:** Three MC types (Per-gram, Percentage-of-metal-value, Fixed-per-piece); Wastage as % of net weight; the merged "Value-Addition" display mode (PRD §7.2) as an alternative to showing Wastage and Making Charges as separate lines.

**3. Workflow:** HQ merchandising sets slabs per category/sub-category, optionally per branch (a flagship store may command a different MC than a small outlet). This is **tier 1** of the three-tier override hierarchy established in §2.5 — Item Design (tier 2) and transaction-time override (tier 3) can each override it in sequence.

**4. Database Design Thinking:**
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
Unlike Rate Master, slabs change infrequently enough that simple effective-dating (not full event-sourcing per transaction) is adequate — but a row is still never overwritten; a change means a new dated row.

**5. Backend Architecture:** Cached master, low write-frequency; resolved via the three-tier hierarchy at billing time.

**6. Frontend Screens:** HQ slab-editor grid (category × sub-category × MC/wastage).

**7. Business Rules 🚨:** The three-tier hierarchy (Category Slab → Item Design override → Transaction-time override with approval) is the single resolution order used everywhere — must be implemented as one shared function, not re-derived independently in Billing vs. Estimate screens (echoing the Phase 5 Calculation Engine principle).

**8. Validation Rules:** Wastage % in a sane range, flagged above ~15% for review.

**9. Compliance Requirements ⚖:** GST law requires Making Charges shown separately if charged separately, OR merged as Value-Addition — the display mode must be **consistent within one invoice**, never mixed line-by-line.

**10. Edge Cases:** Festival promotional MC-waiver campaigns — a temporary, time-bound override, modeled as a dated slab row, not a code branch.

**11. Module Dependencies:** Item Master (§2.5), Billing Engine (Phase 5).

**12. Reports & KPIs:** Making-Charges Income by category (feeds Phase 5/11 reports).

**13. Security Considerations:** HQ/merchandising write access only.

**14. Performance Considerations:** Cached, low-write — no special concern.

**15. Testing Strategy:** Override-hierarchy resolution-order test across all three tiers.

**16. Common Developer Mistakes ❌:** Hardcoding slabs in the billing engine code instead of driving them from this data-driven master.

**17. Production Best Practices 💡:** Keep this fully data-driven so a festival MC-waiver campaign is a data change, not a code deploy.

**18. Phase Completion Checklist:**
- [ ] `mc_wastage_schemes` table with tenant/branch-nullable scoping
- [ ] Three-tier override resolution implemented as one shared function
- [ ] Value-Addition vs. separate-line display mode is a per-invoice-consistent setting

---

### 2.8 MODULE: Stone / Diamond Rate Master

**1. Business Objective:** Price stones (diamonds/gemstones) independently of the metal rate, since their value depends on the 4Cs (carat, cut, clarity, colour) or a per-piece figure for small/melee stones — never weight × metal-rate.

**2. Domain Concepts:** Certified stones (GIA/IGI/SGL certificate number) vs. uncertified melee stones; rate-per-carat vs. rate-per-piece; 1 carat = 0.2 grams (relevant to the GW/SW/NW math, PRD §17).

**3. Workflow:** Staff/gemologist maintains slab rates by type + shape + clarity + colour + carat-range for uncertified/small stones. For anything certified or one-off, the PRD's own worked example (§17) shows the *normal* path is entering a **certified valuation directly per piece** — the slab-rate lookup is really the fallback for small uncertified stones, not the primary path, and this handbook makes that priority order explicit where the PRD leaves it implicit.

**4. Database Design Thinking:**
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

**5. Backend Architecture:** Cached slab master plus a certification-attachment service (file upload to the same S3-compatible object store used for hallmarking certificates, PRD §16.1).

**6. Frontend Screens:** Slab-rate editor; per-tag stone-entry screen with certificate upload.

**7. Business Rules 🚨:** Once a certification is attached, its `certified_value` **always overrides** the slab-rate calculation for that stone — the system must never silently recompute from the slab after a certified value has been entered.

**8. Validation Rules:** carat > 0; certificate number is free-text (format varies by lab, no fixed regex).

**9. Compliance Requirements ⚖:** No GST-specific rule beyond correct HSN classification at billing time.

🚨 **Unresolved tension worth flagging before Phase 7 is finalized:** the PRD's own worked example (§17) bills the diamond value as part of *one* composite taxable value at the 3% jewellery-composite GST rate, while its own HSN table (§9.2) lists diamonds separately at roughly 1.5%. These two parts of the source PRD are in tension with each other, and this must be resolved with the client's CA (does the specific jewellery piece require a split HSN line for the diamond portion, or is the whole piece taxed as one composite supply?) before the GST module (Phase 7) is built — this is exactly the kind of ambiguity that's cheap to resolve now and expensive to discover after invoices have already been issued incorrectly.

**10. Edge Cases:** Multiple small stones of mixed types in one piece — store an itemized stone-weight/value breakdown per tag, never one blended figure, so the HSN-split question above stays resolvable later without re-entering data.

**11. Module Dependencies:** Item Master, Billing Engine, Tagging.

**12. Reports & KPIs:** Stone Stock Register (carats in/out, PRD §5.5).

**13. Security Considerations:** Standard write-role restriction.

**14. Performance Considerations:** Low volume, no special concern.

**15. Testing Strategy:** Certification-override-precedence test; carat-to-gram conversion accuracy test.

**16. Common Developer Mistakes ❌:** Blending metal + stone value into one number at the tag level with no stone-level breakdown retained — forecloses the HSN-split question before it's even been decided by the CA.

**17. Production Best Practices 💡:** Always retain the itemized stone breakdown even while billing a composite line — the classification question can then be resolved later without re-entering historical data.

**18. Phase Completion Checklist:**
- [ ] `stone_rate_master` + `stone_certifications` tables created
- [ ] Certified-value-overrides-slab rule enforced
- [ ] Itemized stone breakdown retained even in composite-billing mode
- [ ] HSN-split question flagged for CA sign-off before Phase 7

---

### 2.9 MODULE: Tax Master

**1. Business Objective:** A central, versioned, government-notification-driven table of HSN codes and GST rates — the PRD is explicit (§9.2) these must never be hardcoded, and Tax Master is where that principle becomes an actual table.

**2. Domain Concepts:** HSN 7113 (gold/silver/platinum jewellery), 7102 (diamond), 7103 (other stones), 7108/7106 (bullion), SAC 9988 (job-work services); CGST/SGST split for intra-state, IGST for inter-state, determined by comparing the billing branch's state to the customer's billing state.

**3. Workflow:** HQ/Accountant maintains versioned rate rows whenever the GST Council issues a notification; the system should alert (Phase 11) when a rate's effective period is about to lapse with no successor row, prompting review rather than silently defaulting to a stale rate.

**4. Database Design Thinking:**
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
🚨 Same append/version discipline as Rate Master (§2.3): never overwrite a historical tax-rate row — old invoices must remain reconstructible exactly as filed.

**5. Backend Architecture:** Cached, versioned lookup by `(hsn_code, as_of_date)`.

**6. Frontend Screens:** HQ/Accountant-only Tax Master screen with a `notification_ref` field — every CA who audits this system will ask "which government notification authorizes this rate," and having it queryable saves real pain later.

**7. Business Rules 🚨:** CGST+SGST vs. IGST is determined automatically from branch-state vs. customer-state comparison — never manually chosen by counter staff.

**8. Validation Rules:** `cgst_rate + sgst_rate` should typically equal `igst_rate` for the same HSN (a sanity check, since the dual-GST and integrated-GST rates are designed to be equivalent) — mismatches are flagged for review, not silently accepted.

**9. Compliance Requirements ⚖:** This table's currency *is* the compliance requirement — a stale rate here is a direct filing-error risk.

**10. Edge Cases:** A rate change effective mid-month (must be date-precise, not month-precise).

**11. Module Dependencies:** Metal/Item Master (default HSN, §2.2/§2.5), Billing/GST Engine (Phase 5/7).

**12. Reports & KPIs:** Effective Tax Rate report; "rates expiring soon" alert list.

**13. Security Considerations:** Accountant/HQ write access only.

**14. Performance Considerations:** Cached, low write frequency.

**15. Testing Strategy:** Intra- vs. inter-state split correctness; effective-date boundary tests.

**16. Common Developer Mistakes ❌:** Hardcoding "3% GST on jewellery" as a constant in billing code — the exact failure mode the source PRD explicitly warns against (§9.2), and the most common shortcut first-time builders take.

**17. Production Best Practices 💡:** Build the `notification_ref` field in from day one; it is the single cheapest thing you can do to make this system audit-friendly.

**18. Phase Completion Checklist:**
- [ ] `tax_rates` table append-only, versioned by `effective_from`/`effective_to`
- [ ] CGST/SGST vs. IGST determined automatically from state comparison
- [ ] `notification_ref` populated for every rate row
- [ ] "Rate expiring soon" alert implemented

---

### 2.10 MODULE: Branch / Location Master

**1. Business Objective:** Register every physical location with its own GSTIN (GST registration is state-wise), enabling correct invoice numbering, correct CGST/SGST-vs-IGST determination, and branch-wise reporting — this is the master that makes the multi-branch decision (§1.9) real.

**2. Domain Concepts:** GST registration is state-wise — a chain with showrooms in Maharashtra and Karnataka needs two GSTINs, one per state, even under one company/PAN. Invoice numbering must be sequential and gap-free **per GSTIN per financial year** (a hard GST-law requirement, PRD §16.2). Stock-in-transit between branches needs its own tracked state.

**3. Workflow:** HQ registers each branch at onboarding/expansion; GSTIN, state code, address, invoice-numbering series prefix, and (per §1.6) the branch's default `stock_ownership_type` are configured once and rarely touched thereafter.

**4. Database Design Thinking:**
```sql
CREATE TABLE branches (
    branch_id          UUID PRIMARY KEY, tenant_id UUID NOT NULL,
    branch_code        VARCHAR(20) NOT NULL,
    branch_name        VARCHAR(100), address TEXT, state_code CHAR(2),
    gstin              VARCHAR(15),   -- see business rule below: NOT always unique per branch
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

**5. Backend Architecture 🏗:** Branch is the tenant-partitioning anchor that nearly every other table's `branch_id` FK ultimately points to.

**6. Frontend Screens:** HQ branch-setup wizard; inter-branch transfer dispatch/receive screens.

**7. Business Rules 🚨:** Invoice numbering sequence is maintained **per GSTIN per financial year**, never a single global counter across branches sharing a GSTIN-blind sequence — a common and serious compliance bug. e-Way Bills (Phase 7) auto-trigger for inter-branch transfers above the state-notified value threshold.

**8. Validation Rules:** GSTIN format + checksum; `state_code` must match the state embedded in the GSTIN's first two digits — a trivial, automatic sanity check the source PRD doesn't mention but is valuable and cheap to implement.

**9. Compliance Requirements ⚖:** Branch-wise GSTIN and sequential invoice numbering are both hard GST-law requirements (Rule 46 / e-invoicing rules).

**10. Edge Cases 🚨:** Two branches in the same state can legally share **one** GSTIN (GST registration can be single-per-state covering multiple physical outlets) — so `gstin` is **not always 1:1 with `branch_id`**; it can be many-branches-to-one-GSTIN. A naive 1:1 assumption here is a real, common architectural mistake worth correcting explicitly.

**11. Module Dependencies:** Effectively every phase, since `branch_id` is the tenant-partitioning anchor.

**12. Reports & KPIs:** Branch Stock Comparison, Branch P&L, Stock-Transfer-in-Transit register (PRD §5.5).

**13. Security Considerations:** Only HQ/Owner can create or edit branch records.

**14. Performance Considerations:** Negligible — low-cardinality, cached master.

**15. Testing Strategy:** GSTIN-state-code cross-check; per-GSTIN invoice-sequence gap-detection test; many-branches-to-one-GSTIN scenario test.

**16. Common Developer Mistakes ❌:** Assuming one branch always equals one GSTIN — breaks the moment a chain consolidates multiple outlets in one state under a single registration.

**17. Production Best Practices 💡:** Model the invoice-numbering sequence against **GSTIN**, not branch, letting multiple branches share a sequence when that reflects the real registration structure.

**18. Phase Completion Checklist:**
- [ ] `branches` + `inter_branch_transfers` tables created
- [ ] Invoice numbering sequence keyed to GSTIN, not branch
- [ ] GSTIN-state-code cross-validation implemented
- [ ] Many-branches-per-GSTIN scenario explicitly supported, not assumed away

---

*End of Phase 2 (all 8 Master Data modules complete).*

---
---

# PHASE 3 — Inventory & Tagging: The Tag as the Atomic Unit

### 1. Business Objective
Track every individual physical piece of jewellery uniquely from creation to sale, since — unlike generic retail — two pieces of the "same design" never have identical weight or value. The **Tag** is the sellable, serialized unit of inventory; the Item Design (Phase 2 §2.5) is only its template.

### 2. Jewellery Domain Concepts
GW/SW/NW recap (Phase 1 §1.1); the Tag lifecycle state machine below; barcode/QR carrying tag identity for scan-to-bill (RFID for bulk stock-take as a Phase-2-of-rollout enhancement); dual valuation — **at-cost** (for the Balance Sheet) vs. **at-market** (for the owner's live "what's my stock worth today" view, Phase 1 §1.1's critical business rule).

### 3. End-to-End Business Workflow — Tag Lifecycle

```mermaid
stateDiagram-v2
    [*] --> RawMetal
    RawMetal --> IssuedToKarigar
    IssuedToKarigar --> ReceivedFromKarigar
    ReceivedFromKarigar --> PendingHallmark
    PendingHallmark --> Hallmarked
    Hallmarked --> InStock
    InStock --> MemoOut : sent on approval
    MemoOut --> InStock : returned
    MemoOut --> Sold : customer keeps
    InStock --> Sold
    InStock --> TransferInTransit : inter-branch transfer
    TransferInTransit --> InStock : received at destination
    InStock --> DamagedOrMelted
    DamagedOrMelted --> RawMetal : melted back
    Sold --> [*]
```

### 4. Database Design Thinking
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
    status          VARCHAR(25) NOT NULL,   -- see state machine above
    cost_rate_version_id UUID REFERENCES rate_versions(rate_version_id), -- rate at tagging time, for at-cost valuation
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
🚨 **Critical Business Rule:** `tags.status` transitions are enforced by a state machine at the service layer (or DB trigger) — never a free-text field any code path can set arbitrarily. A tag jumping straight from `RAW_METAL` to `SOLD` should be structurally impossible.

🚨 **Critical Business Rule (explicit in PRD §16.2):** a tag can never be "in stock" and sellable at two branches simultaneously. This is enforced via a unique, transactional status update — the *first* successful commit to `SOLD` (or `TRANSFER_IN_TRANSIT`) wins; any competing attempt fails and is surfaced to staff, never silently overwritten.

### 5. Backend Architecture
The Inventory Service owns the state machine; every transition is a transactional operation that also writes to `tag_status_history` (the same event-sourced-history philosophy as Rate Master, Phase 2 §2.3). Barcode (Code-128) or QR generation happens at tag creation. Offline POS caches today's sellable-tag list per branch; on reconnect, conflict resolution means "first successful transactional commit wins" — not last-write-wins, since selling the same physical tag twice is a real, damaging failure mode, not a theoretical one.

### 6. Frontend Screens
Tagging screen (weigh-in, HUID entry, barcode print), stock lookup/search (design, purity, weight range, branch), Stock-Take/reconciliation screen (scan-and-compare against the expected list), Memo-Out screen (customer-approval tracking with due-date reminders), inter-branch transfer dispatch/receive screen.

### 7. Business Rules 🚨
- Valuation is always reportable **both ways**: at-cost (using `cost_rate_version_id`, FIFO/weighted-average per lot) for the Balance Sheet, and at-market (live Rate Master lookup) for the owner's MIS view — never conflate the two into one stored column.
- Memo-Out items are excluded from "available for sale" counts but included in total-asset/insurance reports.
- `stock_ownership_type = CONSIGNMENT` tags are excluded from the shop's own Balance Sheet stock value even while shown as "in showroom, sellable" — the concrete implementation of the Phase 1 §1.6 GML/consignment gap.

### 8. Validation Rules
`gross_weight >= stone_weight >= 0`; HUID exactly 6 alphanumeric characters, globally unique per tenant and never reused, even after a sale reversal; barcode uniqueness.

### 9. Compliance Requirements ⚖
HUID must be captured before a hallmark-required item moves to `IN_STOCK`/billable (configurable hard/soft block, PRD §11.3, exemptions apply per Phase 9). Metal/Item-wise/Stone/Karigar-wise/Branch-wise Stock Registers (PRD §5.5) must be exportable for GST/Income-tax inspection.

### 10. Edge Cases
Re-weighing at the counter shows a different weight than the tag label (scale drift, wear, or tampering) — system supports "confirm/override with reason," logging the discrepancy rather than silently overwriting the recorded weight. A tag scanned for sale while simultaneously mid-transfer between branches — must be structurally prevented by the state machine, not caught after the fact. Melted-and-reissued tags never reuse a HUID or barcode value, even though the metal is now physically "new."

### 11. Module Dependencies
Metal/Item/Stone Masters (Phase 2), Karigar module (issue/receipt, Phase 4), Hallmarking (Phase 9), Billing (Phase 5, consumes `IN_STOCK` tags), Old Gold Exchange (Phase 6, feeds the melting loop back to `RAW_METAL`), Accounting (Phase 8, stock valuation).

### 12. Reports & KPIs
Stock Summary (item/purity-wise, weight + value), Ageing Report (unsold beyond X days — a direct capital-lock signal), Tag-wise Stock Ledger, Branch Stock Comparison, Memo/Approval Outstanding Report, Physical Stock Discrepancy Report, and a **GML/Consignment exposure report** (new, introduced by this handbook per Phase 1 §1.6, absent from the source PRD).

### 13. Security Considerations
Tag status transitions are logged with user + timestamp; stock write-offs (damaged/lost) require elevated approval.

### 14. Performance Considerations
Barcode-scan-to-bill-line lookup must be near-instant (well under the Phase 5 <200ms budget, since it's a sub-step of that budget); offline cache must hold the branch's full sellable-tag list.

### 15. Testing Strategy
State-machine illegal-transition rejection tests; cross-branch double-sell-prevention test (the PRD's own explicit DB-level requirement); HUID/barcode uniqueness tests; offline-reconnect conflict-resolution test; at-cost-vs-at-market valuation reconciliation test.

### 16. Common Developer Mistakes ❌
Modeling stock as a quantity counter per design instead of individually serialized tags — the single most fundamental generic-retail instinct to avoid in this domain. Allowing free-text status updates instead of an enforced state machine. Storing only one valuation figure and losing the at-cost/at-market distinction that owners actually rely on daily.

### 17. Production Best Practices 💡
Treat tag status transitions as an append-only event log (`tag_status_history`) in addition to the current-status field, mirroring the Rate Master's event-sourced philosophy — this pays off enormously the first time an owner asks "why doesn't the stock report match the shelf" during an audit.

### 18. Phase Completion Checklist ✅
- [ ] `tags` + `tag_status_history` tables created with enforced state machine
- [ ] Cross-branch double-sell prevented at the DB/transaction level
- [ ] HUID and barcode uniqueness enforced, never reused
- [ ] At-cost and at-market valuation both queryable independently
- [ ] `stock_ownership_type` correctly excludes consignment stock from the Balance Sheet view
- [ ] Offline sellable-tag cache + reconnect conflict resolution implemented

---

*End of Phase 3.*
