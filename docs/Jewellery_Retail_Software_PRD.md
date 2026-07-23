# Product Requirement Document
## Retail Jewellery Shop Management Software — Indian Sarafa Market
### (Gold / Silver / Diamond / Platinum)

**Document Owner:** Product Management
**Prepared for:** Engineering, QA, Design, Implementation, and Support teams
**Version:** 1.0
**Status:** Draft for Development

---

## 0. How to Read This Document

This PRD assumes the reader (developer, tester, designer) has **zero prior knowledge** of the Indian jewellery ("Sarafa") retail trade. Every module therefore begins with a **"Business Context"** sub-section that explains the real-world process in plain language, followed by **"System Requirements"** (what the software must do), **"Business Rules / Formulas"** (exact calculation logic), and **"Data Fields"** where relevant. Read Section 1 (Industry Primer) fully before any other section — it defines vocabulary used everywhere else.

---

## 1. Industry Primer — Concepts Every Developer Must Know

### 1.1 What is a "Sarafa" shop?
A Sarafa (also spelled Sarafa/Sunar/Jeweller) shop is a retail outlet that sells ornaments (jewellery) made of gold, silver, platinum, and diamond/gemstone-studded pieces. Unlike a normal retail store where price = cost + margin, jewellery price is **derived live from the metal's market rate**, updated daily (sometimes twice a day). This is the single biggest difference from any other POS/retail system.

### 1.2 Core Vocabulary

| Term | Meaning |
|---|---|
| **Purity / Fineness** | The proportion of pure metal in an item, expressed as **Karat (KT)** for gold (24KT = 100% pure) or as a **decimal/percentage (e.g., 999, 916, 750)** called "Hallmark Purity" or "Touch". 916 = 91.6% pure gold (this is "22KT" gold, the most common in India). Silver is usually 999 (fine) or 92.5 (Sterling). |
| **Gross Weight (GW)** | Total weight of the item as weighed on the scale, including metal + stones + any other attached material. Measured in **grams**, typically to 3 decimal places. |
| **Stone Weight (SW)** | Weight of diamonds/gemstones/beads/pearls embedded in the item. This weight does NOT get metal rate — it is charged separately (per carat or per piece). |
| **Net Weight (NW)** | NW = GW − SW. This is the weight on which the **metal value** is calculated. |
| **Rate (Metal Rate)** | The current market price of 1 gram (or 10 grams / 1 troy ounce) of a given metal at a given purity, set daily by the shop owner based on bullion market (e.g., MCX, local Sarafa association rate, IBJA rate). |
| **Making Charges (MC) / Labour Charges** | The fee charged for craftsmanship — converting raw metal into a finished ornament. Can be charged as **(a) Per gram flat rate**, **(b) Percentage of metal value**, or **(c) Fixed amount per piece**. |
| **Wastage (Ghatai/Vateri)** | An additional charge, expressed as a **percentage of net weight**, that compensates the jeweller for metal lost during manufacturing (filing, polishing, melting loss). Functionally it behaves like an addition to chargeable weight, not a separate cash charge, in many shops — see §5. |
| **Value Addition (VA)** | Modern GST-compliant shops often merge Wastage + Making Charges into a single line called "Value Addition %" charged on net weight metal value. |
| **HUID** | **Hallmark Unique Identification Number** — a mandatory 6-digit alphanumeric code issued by BIS (Bureau of Indian Standards) laser-engraved on every hallmarked gold jewellery piece sold in India (mandatory since June 2021, updated rules 2023). Each unique piece has a unique HUID. |
| **BIS Hallmark** | Government-mandated purity certification mark. Mandatory for gold jewellery of 14KT, 18KT, 20KT, 22KT, 23KT, 24KT sold in India (with exemptions for very small business turnover, antique/ two-hundred-year-old jewellery, and export items). |
| **Tag / Ticket** | A small paper/barcode tag physically tied to each piece of jewellery showing item code, gross weight, purity, stone details — the retail equivalent of a barcode label, often still handwritten in smaller shops. |
| **Old Gold Exchange / Buyback** | Customers frequently bring their **used/old jewellery** to exchange against a new purchase, or sell outright. The shop tests its purity, weighs it, and pays/credits the customer at a rate lower than market rate (deduction for melting loss). |
| **Karigar** | The goldsmith / artisan (in-house or outside job-worker) who manufactures jewellery from raw metal supplied by the shop. Metal is "issued" to the karigar and finished goods are "received back" — this is a job-work loop that must be tracked (metal given out is a liability until returned as finished goods). |
| **Tunch / Touch Test** | The purity-testing process (using touchstone, acid testing, or XRF/Karat meter machine) done when a customer sells or exchanges old jewellery, to determine payable purity. |
| **MC (Metal Conversion) / Melting** | Old jewellery melted down to produce reusable raw gold/silver, which re-enters inventory as "raw metal" stock. |
| **Scheme / Chit / Gold Savings Plan** | A pre-purchase savings product: customer deposits a fixed amount monthly for 11 months; on completion, shop adds a bonus (e.g., 1 month free) and the accumulated amount can be redeemed against jewellery purchase. |
| **HSN Code** | Harmonized System of Nomenclature — GST classification code. Gold jewellery = 7113, Silver jewellery = 7113, Diamond = 7102, etc. (see §9). |
| **CGST / SGST / IGST** | India's dual GST structure — Central + State GST for intra-state sale, Integrated GST for inter-state sale. |
| **Sale of Old Jewellery by Customer (Second-hand goods)** | Purchases of used gold from individual (non-registered) customers may fall under the **Margin Scheme (Rule 32(5) of CGST Rules)** — GST charged only on the margin, not full value, under specific conditions. |

### 1.3 Why This Is Different From Generic Retail POS Software
1. **Price is not fixed** — it is computed live at the time of billing using weight × current rate + making charges + wastage + stone value + GST.
2. **Every single piece of inventory is unique** (a ring is not identical to another ring even of same design, because gross weight varies piece to piece). This means inventory cannot simply be tracked by "SKU quantity" — it must be tracked by **individual tag/piece with its own weight**.
3. **Two parallel units of value exist simultaneously**: weight (grams) and money (₹). Reports must always reconcile both.
4. **Old jewellery exchange** introduces a reverse flow (purchase from unregistered individual) that has special GST and accounting treatment.
5. **Regulatory compliance is heavy**: BIS Hallmarking + HUID, GST, PMLA (Prevention of Money Laundering Act) for high-value cash transactions, and TCS (Tax Collected at Source) under Income Tax Act for large cash sales.

---

## 2. Product Vision & Goals

**Vision:** A single, GST-compliant, end-to-end retail management platform purpose-built for Indian jewellery businesses, that handles the full lifecycle — procurement, manufacturing/job-work, tagging, inventory, billing, old-gold exchange, schemes, accounting, and statutory compliance — with zero manual rate/weight/tax calculation errors.

**Goals:**
- Eliminate manual calculator-based billing errors.
- Provide real-time, weight-accurate and value-accurate inventory (dual-unit: grams + ₹).
- Ensure 100% GST and Hallmarking/HUID compliance out of the box.
- Reduce billing time per customer to under 2 minutes using barcode scanning.
- Give owners a live view of capital locked in metal, stones, and karigar-held stock.
- Support omni-channel growth (multi-branch, scheme customers, CRM, WhatsApp billing/reminders).

**Out of Scope (v1):** E-commerce storefront, third-party marketplace integration, international multi-currency operations, manufacturing MRP/BOM planning at factory scale (only shop-level job-work is covered).

---

## 3. User Personas & Roles

| Role | Description | Key Permissions |
|---|---|---|
| **Owner/Admin** | Shop proprietor(s) | Full access, rate master, financial reports, user management |
| **Store Manager** | Runs day-to-day floor operations | Billing, inventory, approvals up to a discount limit |
| **Sales Executive / Counter Staff** | Handles walk-in customers, billing | Billing, old-gold estimate (view only), stock lookup |
| **Accountant** | Books entries, GST filing, reconciliation | Accounting module, GST reports, ledgers — no billing edits |
| **Karigar/Job-work Coordinator** | Manages metal issue/receipt to artisans | Karigar module only |
| **Inventory/Stock Manager** | Tags new stock, manages purchases, stock transfer between branches | Inventory & purchase module |
| **Auditor (read-only)** | External CA/auditor | Read-only access to reports & ledgers |
| **Customer (self-service, optional Phase 2)** | Views scheme balance, order status via portal/app | Own-data view only |

---

## 4. Master Data Modules

### 4.1 Metal Master
**Business Context:** The shop deals in multiple metals, each with multiple purities. Each purity needs its own daily rate.

**Data Fields:**
| Field | Type | Notes |
|---|---|---|
| Metal Code | Auto | GOLD, SILVER, PLATINUM |
| Purity Name | Text | 24KT/999, 22KT/916, 18KT/750, 14KT/585, Silver 999, Silver 925 (Sterling) |
| Purity % | Decimal | e.g., 0.916 |
| Standard Unit | Enum | Gram / Kg / Troy Ounce (India uses gram, 10-gram as quoting convention) |
| HSN Code | Text | Default per metal (editable) |
| Is Active | Boolean | |

### 4.2 Rate Master (Daily Metal Rate)
**Business Context:** Owners set the day's buying and selling rate every morning (and can update intraday if bullion market moves significantly). ALL billing, valuation, and old-gold exchange calculations pull the rate live from this master — nothing should ever be hardcoded.

**Data Fields:** Effective Date, Effective Time, Metal, Purity, **Sale Rate/gram**, **Purchase(Buy-back) Rate/gram**, Entered By, Approved By (optional 2-step for large shops).

**Business Rules:**
- Rate history must be preserved (never overwritten) — every bill stores the exact rate used, for audit trail even if today's rate later changes.
- System must support **multiple rate revisions per day**; billing always uses the latest "Active" rate at the time of invoice unless a manager manually overrides (with reason logged) — e.g., honoring yesterday's rate for a booked/advance order.
- Rate for 22KT/18KT/14KT etc. is usually **derived from 24KT rate × purity fraction**, but the system must allow manual override per purity since market convention/rounding varies by region.
- Silver rate typically quoted per kg but system should normalize to per-gram internally for calculation consistency.

### 4.3 Item / Design Master
**Business Context:** Unlike FMCG, "SKU" in jewellery = a *design/category*, not a fixed-price product, because each physical piece has a different weight. The Item Master stores the *design template*; actual sellable stock is tracked as individual **Tags** (Section 5).

**Data Fields:**
| Field | Notes |
|---|---|
| Item Code / Design No. | Unique |
| Category | Ring, Necklace, Bangle, Chain, Earring, Bracelet, Pendant, Coin, Bar, etc. |
| Sub-category | Ladies/Gents/Kids, Traditional/Modern/Antique/Casting/Handmade |
| Metal & Purity | Link to Metal Master |
| Default Making Charge Type | Per gram / % of value / Fixed |
| Default Making Charge Value | Numeric |
| Default Wastage % | Numeric |
| HSN Code | |
| Images | Multiple |
| Barcode/QR template | |
| Gender/Occasion tags | For search/filters |

### 4.4 Party Master (Customer & Supplier — Unified Ledger)
**Business Context:** In Indian trade accounting, customers and suppliers both sit in one "Party" ledger concept (as in Tally), because the same person may sometimes buy (debtor) and sometimes sell old gold to the shop (creditor) in the same relationship.

**Data Fields:** Name, Address, Mobile (mandatory - used for SMS/WhatsApp), Email, **PAN** (mandatory if transaction value crosses Rs 2,00,000 per Income Tax Rule 114B), **GSTIN** (if a registered business buyer, for B2B invoicing/ITC), Aadhaar (optional, for high value/PMLA), Customer Type (Retail/Wholesale/Scheme/Karigar/Supplier), Credit Limit, Opening Balance, KYC documents upload.

**Business Rule (PMLA/Income Tax):**
- Cash sale >= Rs 2,00,000 -> PAN mandatory; if no PAN, Form 60 must be captured.
- Cash receipt from a customer > Rs 2,00,000 in aggregate (single transaction/related transactions) -> **TCS (Tax Collected at Source) @ 1%** applies under Income Tax Act Section 206C(1F)/(1H) as applicable - system must flag and compute automatically.
- Cash transactions >= Rs 10 lakh (single or connected transactions in a day) require reporting as **Cash Transaction Report (CTR)** under PMLA - system should flag such transactions for the accountant.

### 4.5 Making Charge / Wastage Scheme Master
Predefined slabs so counter staff doesn't need to remember rules, e.g.:
| Category | Making Charge | Wastage % |
|---|---|---|
| Gold Chain (Machine made) | Rs 450/gram | 6% |
| Gold Ring (Handmade) | 12% of metal value | 8% |
| Bangles (Casting) | Rs 350/gram | 5% |

Editable per item, overridable at bill level with manager approval + reason.

### 4.6 Stone/Diamond Rate Master
**Business Context:** Diamonds and precious stones are priced very differently from metal - by **carat weight, cut, clarity, color grade (4Cs)**, not by the shop's daily metal rate.

**Data Fields:** Stone Type (Diamond/Ruby/Emerald/Sapphire/Pearl/CZ/etc.), Shape, Clarity, Color Grade, Carat Range, **Rate per carat** or **Rate per piece**, Certification (GIA/IGI/SGL number if certified).

### 4.7 Tax Master
GST rates per HSN (see Section 9), Cess if any, State code list for CGST/SGST/IGST determination.

### 4.8 Branch / Location Master
For multi-branch shops: Branch Code, GSTIN per branch (GST registration is state-wise, so each branch in a different state = separate GSTIN), Branch-wise stock, Stock-transfer-in-transit tracking.


## 5. Inventory Management & Tagging

### 5.1 Business Context
Every physical piece of jewellery in the shop must be individually identifiable ("Tagged") because each piece differs in gross weight even within the same design. Inventory is therefore tracked at **two levels**:
1. **Design/Item level** (aggregated view — "how many rings of Design R-101 do we have, total weight, total value")
2. **Piece/Tag level** (the actual sellable unit — "Tag #GR10234, Gross Wt 5.230g, Net Wt 5.180g, Purity 916")

### 5.2 Tag Lifecycle (Status Flow)
```
RAW METAL (Purchased/Melted) 
   -> ISSUED TO KARIGAR (job-work out)
   -> RECEIVED FROM KARIGAR (finished goods in)
   -> TAGGED / HALLMARKED (barcode/QR generated, HUID linked)
   -> IN STOCK (available for sale)
   -> [ON APPROVAL / ON MEMO OUT] (sent to customer's home for trial - temp out)
   -> SOLD  |  RETURNED TO STOCK  |  TRANSFERRED (inter-branch)  |  DAMAGED/MELTED BACK
```

### 5.3 Barcode / QR / RFID Support
**Business Requirement:** Every tag must have a machine-scannable barcode/QR label printed at the time of tagging, containing (encoded, not necessarily human-visible):
- Unique Tag ID
- Item/Design Code
- Gross Weight, Net Weight, Stone Weight
- Purity
- HUID (once hallmarked)
- Batch/Purchase reference

**System Requirements:**
- Generate barcode (Code-128) or QR at tag creation; support bulk label printing to standard jewellery barcode printers (e.g., 25mm x 15mm thermal labels).
- Barcode scanning at billing counter must auto-populate item, weight, purity, making charge, and default price into the bill line — **eliminating manual weight entry** as the primary flow (manual weight entry remains available as fallback, e.g., for used/exchanged items or if a tag is re-weighed to confirm).
- Support **re-verification weighing**: many shops re-weigh the item on an electronic scale at the counter and the system should allow the scanned "tag weight" to be confirmed/overridden against the "live scale weight" (optional serial/USB integration with digital weighing scales).
- RFID support (Phase 2) for bulk stock-taking (wave an RFID reader across a tray to count/verify hundreds of pieces in seconds without individual scanning) — recommended for shops with high-value/high-volume inventory.

### 5.4 Stock Valuation Methods
**Business Context:** Since gold rate changes daily, the "value" of unsold stock changes daily too, even though nothing physically moved. Valuation must be reportable in two ways:
- **At Cost** (purchase-day rate) — for accounting/Balance Sheet purposes (GST/Income Tax requires consistent method, generally FIFO or Weighted Average, applied consistently).
- **At Current Market Rate** (today's rate) — for the owner's "what is my stock worth today" MIS view.

**Business Rule:** Metal costing method = **FIFO (First-In-First-Out)** by default (configurable to Weighted Average), applied at the raw-metal/lot level. Making charges and stone costs are tracked at actual (specific identification) since each tag is unique.

### 5.5 Stock Registers to Maintain (Statutory + Operational)
- **Metal Stock Register** (grams in/out per purity — purchase, sales, job-work issue/receipt, melting, closing balance) — this is the digital equivalent of the traditional "Stock Register" that GST/Income-Tax officers may inspect.
- **Item-wise Stock Register** (piece count + weight + value)
- **Stone/Diamond Stock Register** (carats in/out)
- **Karigar-wise Outstanding Register** (metal issued but not yet returned)
- **Branch-wise Stock Register**

### 5.6 Physical Stock Audit / Reconciliation
- System supports a "Stock Take" mode: scan every tag in a given tray/section, system compares scanned list vs expected system list, flags missing/extra tags, generates a discrepancy report (count and weight-wise) for owner sign-off.

### 5.7 Approval / Memo (Jewellery Sent Out on Trial)
**Business Context:** High-value customers often take jewellery home "on approval" to decide/show family before buying.
**System Requirement:** "Memo Out" transaction — reduces available stock, creates a receivable-like tracking entry (not a sale, no GST yet), with an expected return date and reminder. On return: either converts to a Sale (§6) or item returns to stock. Memo items must not appear as "available" stock during the approval period but must still appear in total asset reports.


## 6. Procurement & Karigar (Job-Work) Management

### 6.1 Purchase of Raw Metal / Finished Goods from Suppliers
**Business Context:** Shops buy raw gold bars/coins from bullion dealers/banks, or finished jewellery from wholesalers.

**Workflow:**
1. Purchase Order (optional) -> 2. Goods Receipt (weight, purity, invoice from supplier) -> 3. Purchase Invoice booking (with GST as applicable - purchases from registered bullion dealers attract GST which becomes **Input Tax Credit (ITC)**) -> 4. Stock updated (raw metal register or finished-goods tag creation).

**Business Rule:** If purchasing raw gold (bullion) from a registered dealer, GST @ 3% is charged by supplier; shop can claim ITC against output GST liability on sales, subject to normal ITC eligibility rules.

### 6.2 Karigar / Job-Work Module
**Business Context:** The shop supplies raw gold (by weight and purity) to a goldsmith (karigar), who manufactures ornaments and returns them along with a "wastage" (metal lost in the process) and charges Making Charges (labour) for the work. This is functionally a **job-work loan of metal** - the karigar owes metal back, not money.

**Workflow:**
```
1. METAL ISSUE TO KARIGAR
   - Record: Karigar name, Date, Metal, Purity, Gross Wt issued, Purpose/Design instructions
   - System creates a "Karigar Metal Payable" ledger entry (grams owed BY karigar TO shop)

2. KARIGAR WORK-IN-PROGRESS
   - Optional partial receipt tracking for large jobs

3. RECEIPT OF FINISHED GOODS FROM KARIGAR
   - Record: Finished piece(s) gross weight, net weight, stone weight (if karigar also set stones)
   - System calculates: Wastage/Loss = Metal Issued (in fine gold equivalent) - Metal Returned (in fine gold equivalent, i.e., net weight x purity of finished piece)
   - Karigar Making Charges booked as an expense (Karigar Labour Payable - a money liability)
   - Excess wastage beyond the agreed % is flagged for owner review (possible loss/theft indicator)

4. TAGGING
   - Finished piece(s) get a new Tag ID, enter "In Stock" status (Section 5)
```

**Business Rules / Formulas:**
- **Fine Gold Equivalent** = Gross Weight x Purity% (this normalizes different-purity metal to a common "24KT equivalent" for comparing issued vs returned metal).
  - Example: 100g of 916 purity gold issued = 91.6g fine gold equivalent.
- **Karigar Wastage %** = (Fine Gold Issued - Fine Gold Returned) / Fine Gold Issued x 100. Compared against the agreed wastage slab (e.g., "up to 6% wastage allowed free; beyond that, karigar bears the cost or it is billed back").
- Karigar ledger must show running **grams payable** balance separately from **money payable** (making charges) balance - these are two distinct liabilities.
- Support for **outside job-work GST**: job-work services attract GST (typically 5% for job work related to gems/jewellery under specific HSN/SAC, subject to current notification) which the shop may need to pay under reverse charge or normal charge depending on the karigar's registration status - system must support recording GST on job-work invoices and ITC claim if eligible.

### 6.3 Melting (Old Jewellery -> Raw Metal)
**Business Context:** Old jewellery taken in exchange, or unsellable/outdated designs, are melted back into raw bars for reuse.
**Workflow:** Select tag(s)/old-gold-exchange lot(s) -> record actual melted output weight & purity (after refining) -> raw metal stock increases; original tag(s) removed from finished-goods inventory.


## 7. Billing / Point of Sale (POS) Engine — Complete Calculation Logic

This is the **most critical module**. Every formula below must be implemented exactly, with configurable rounding rules (see 7.7).

### 7.1 Billing Workflow (Screen Flow)
1. Select/Create Customer (search by mobile number - primary key for lookup).
2. Scan barcode(s) of item(s) OR manually search/select item -> item(s) added as bill lines.
3. For each line: system auto-fetches Gross Weight, Stone Weight (if any), Purity, Default Making Charge/Wastage from tag & item master; live Metal Rate pulled from Rate Master.
4. Staff can (with permission) override: Making charge, Wastage %, discount, rate (with manager approval + reason log).
5. If applicable: add Old-Gold-Exchange line(s) (Section 8) as a deduction.
6. If applicable: apply Scheme redemption (Section 12).
7. System computes: Metal Value, Making Charges, Stone Value, Sub-total, Taxable Value, GST (CGST+SGST or IGST), Round-off, **Net Payable**.
8. Payment entry: Cash / Card / UPI / Cheque / Old-gold-adjustment / Scheme-adjustment / Split payment across multiple modes.
9. TCS check (Section 4.4) auto-applied if cash threshold breached.
10. Invoice generated (GST-compliant format), printed/emailed/WhatsApp'd; e-Invoice/e-Way Bill generated if applicable (Section 9).
11. Stock tag status updated to SOLD; accounting entries auto-posted (Section 10).

### 7.2 Per-Line Item Calculation (THE core formula)

For each jewellery piece sold:

```
Step 1: Net Weight (NW) = Gross Weight (GW) - Stone Weight (SW)

Step 2: Metal Value = NW x Metal Rate per gram (for that purity)

Step 3: Wastage Value (if wastage is charged as weight-equivalent %):
        Wastage Weight = NW x Wastage % 
        Wastage Value  = Wastage Weight x Metal Rate per gram
        (Alternative: some shops directly do 
         Effective Chargeable Weight = NW x (1 + Wastage%), 
         then Metal+Wastage Value = Effective Chargeable Weight x Rate 
         -- mathematically identical to Step2+Step3 combined)

Step 4: Making Charges (MC) -- calculated by configured type on this item:
        (a) Per Gram:      MC = NW x MC Rate/gram
        (b) Percentage:    MC = Metal Value x MC%
        (c) Fixed/Piece:   MC = Fixed Amount

Step 5: Stone/Diamond Value = SUM over each stone type of (Stone Weight in carat x Rate/carat) 
        OR (Piece count x Rate/piece), as configured per stone.

Step 6: Line Sub-Total (Taxable Value before GST) 
        = Metal Value + Wastage Value + Making Charges + Stone Value 
          - Item-level Discount (if any)

Step 7: GST on this line (Section 9 explains rate/split logic)
        GST Amount = Line Sub-Total x Applicable GST Rate%

Step 8: Line Total = Line Sub-Total + GST Amount
```

> **Note on Wastage vs Making Charge display:** GST law requires making charges to be shown separately if charged separately (common practice: many shops now merge wastage into "Making Charges/Value Addition %" as a single labour line to simplify GST invoicing - the system must support BOTH the traditional separate Metal+Wastage+Making display AND the merged Value-Addition display, configurable per shop policy).

### 7.3 Bill-Level Aggregation

```
Bill Sub-Total (Taxable Value) = SUM of all Line Sub-Totals (post line-level discounts)

Bill-Level Discount (if any, e.g., festival scheme discount on Making Charges) 
   applied as a further deduction from Taxable Value (configurable: 
   flat amount / % / "Making charge waiver" type)

Old Gold Exchange Adjustment (Section 8) - NOT part of taxable value; 
   it is a separate purchase transaction netted at payment stage, 
   NOT a discount on the sale invoice (critical GST distinction - see 8.3)

GST Computation (Section 9):
   If Shop State == Customer State (or unregistered/no state captured, 
      default to shop's state): 
        CGST = Taxable Value x (Rate/2)
        SGST = Taxable Value x (Rate/2)
   Else (inter-state):
        IGST = Taxable Value x Rate

Round Off = Round(Total) - Total   [adjusts final invoice to nearest Re.1, 
      posted to a separate "Round Off" ledger per GST/accounting norms]

NET PAYABLE = Taxable Value + GST + Round Off
```

### 7.4 Discounts
- **Line-level discount:** flat ₹ or % on Making Charges only (metal value is rarely discounted since it's market-linked and transparent to customer) — configurable whether discount is allowed on metal value at all (Owner/Admin permission).
- **Bill-level discount:** promotional schemes (e.g., "Flat 20% off making charges on festival day").
- All discounts must be **applied before GST calculation** (discount reduces taxable value), matching GST law (Section 15 CGST Act — discount known/agreed at time of supply reduces transaction value).

### 7.5 Payment & Split Payment
Supported modes: Cash, Debit/Credit Card, UPI, Net Banking, Cheque, Gift Voucher, Old-Gold-Adjustment (from Section 8), Scheme-Redemption-Adjustment (Section 12), Advance-Adjustment (against booking/token advance). A single bill can be settled via multiple modes (split payment) — sum of all modes must equal Net Payable, else bill cannot be finalized (or system creates a "Balance Due" receivable).

### 7.6 Advance / Booking (Token Advance)
Customer pays a token advance against a future purchase (common during festive bookings when rate is expected to rise, or a custom-order piece). System must:
- Record advance as a liability (Advance from Customer) in accounting.
- Optionally **"lock" today's rate** for the advance amount (business decision, configurable) so the customer is protected against rate increase up to an agreed date.
- On final billing, adjust advance against Net Payable.
- GST on advance receipt: for goods (unlike services), GST is generally NOT required to be paid at advance-receipt stage (post-2019 rule for goods) — GST applies at the time of invoice for the underlying goods; system should support this rule but allow configuration in case rules change.

### 7.7 Rounding Rules
- Weight: round to 3 decimal places (milligram precision) throughout.
- Rate: round to 2 decimal places (paise).
- Line/bill amounts: round to 2 decimals internally; final invoice total rounded to nearest ₹1 (standard "Round Off" line, per common invoicing practice) — configurable.
- Rounding method: Round-half-up (banker's rounding NOT used, to match manual/shop convention).

### 7.8 Estimate / Quotation Mode
Before finalizing a sale, staff can generate a non-fiscal **"Estimate"** (same calculation engine, no GST invoice number, no stock deduction, no accounting entry) so a customer can compare 2-3 pieces before deciding. Estimate can be converted to a final Tax Invoice with one click, re-pulling the current rate at conversion time (with option to honor the estimate's original rate if within the same day/policy window).

### 7.9 Repair / Alteration Billing (Sub-module)
**Business Context:** Customers bring their own jewellery for repair (resizing, polishing, stone re-setting).
**Workflow:** Create Repair Job -> record item description, weight (in/out), issue to karigar if needed -> charge only labour (no metal value since it's the customer's own metal) -> GST applies on labour/service charge only. Track "customer-owned metal held by shop" as a separate memo register (not shop's asset/liability, but must be tracked for safekeeping/insurance).


## 8. Old Gold / Silver Exchange (Buyback) Module

### 8.1 Business Context
Customers frequently bring old/used jewellery to either (a) sell outright for cash, or (b) exchange its value against a new purchase. This is one of the most operationally sensitive and error-prone processes in a jewellery shop because it involves **purity testing** and **rate negotiation**, and has distinct accounting/GST treatment from a normal sale.

### 8.2 Workflow
```
1. RECEIVE OLD ITEM(S) from customer - record description, gross weight (as received)
2. PURITY TESTING (Tunch) - staff tests using touchstone/acid/XRF machine, 
   records "Tested Purity %" 
3. DEDUCT PROCESSING/MELTING LOSS - shop applies a deduction % 
   (e.g., 2-4%) to account for melting/refining loss and testing risk
4. CALCULATE PAYABLE WEIGHT & VALUE:
   Net Payable Weight = Gross Weight Received x Tested Purity% x (1 - Deduction%)
   Buyback Value = Net Payable Weight x Today's Buy-back Rate/gram 
                   (Buy-back rate is usually slightly LOWER than sale rate 
                    - see Rate Master, Section 4.2)
5. CUSTOMER APPROVAL - value shown to customer for confirmation before finalizing
6. SETTLEMENT:
   (a) Adjusted against new purchase invoice (most common), OR
   (b) Paid out in cash/bank transfer (outright buy)
7. OLD ITEM ENTERS "OLD GOLD STOCK" - either sent for melting (Section 6.3) 
   or, if design is still saleable "as-is" (rare, mainly antique/investment coins), 
   re-tagged for direct resale
```

### 8.3 GST Treatment of Old Gold Purchase (Critical Business Rule)
- Purchasing old jewellery from an **unregistered individual customer** for the shop's own trading stock (not as an agent) is a **purchase transaction**, generally outside GST's forward-charge scope from the individual seller (individuals selling personal used goods are not "in the course or furtherance of business," hence not a taxable supply by them).
- When the shop later re-sells this old gold (after melting into new jewellery, or directly), GST is charged normally on the full sale value of the new bill.
- **Margin Scheme (Rule 32(5), CGST Rules 2017):** If the shop resells the *very same* second-hand goods without any process that changes their nature (rare in jewellery, since most old gold is melted), GST may be payable only on the margin (Selling Price − Purchase Price), if no ITC was availed on the original purchase. **This must never be blended with a normal sale invoice; it should be a distinct transaction type flagged for the accountant**, since it materially changes GST liability computation. Given melting is near-universal in this trade, this mode should be off by default and enabled only per shop's CA guidance.
- **Old-gold exchange adjusted against a new purchase invoice** must NOT be shown as a "discount" on the new item's taxable value (this would incorrectly reduce GST payable on the new sale). Instead: the new item is billed and taxed at its full value; the old-gold buyback value is recorded as a **separate purchase voucher** and settled at the **payment stage** (i.e., "Amount Payable by customer for new item = ₹X, less Old Gold value paid to customer = ₹Y, Net Cash from customer = X−Y"). This is a Payment/Settlement netting, not a Sales-side discount.

### 8.4 Data Captured Per Old-Gold Transaction
Customer details (mandatory — treat as a purchase, KYC per Party Master rules), Item description & photo, Gross Weight, Tested Purity, Deduction %, Net Payable Weight, Buy-back Rate applied, Buyback Value, Settlement mode, Linked Sale Invoice number (if adjusted).


## 9. GST Compliance Module

### 9.1 Business Context (Explained From Scratch)
GST (Goods and Services Tax) is India's unified indirect tax. Every sale invoice must show tax split correctly and the shop must periodically file returns summarizing all sales/purchases. Jewellery has a **flat GST rate** structure (unlike many goods with multiple slabs).

### 9.2 HSN Codes & GST Rates (must be maintained in Tax Master, kept updatable since rates/notifications can change)
| Goods | HSN | Typical GST Rate* |
|---|---|---|
| Gold jewellery (articles of gold) | 7113 | 3% |
| Silver jewellery | 7113 | 3% |
| Platinum jewellery | 7113 | 3% |
| Diamond (unset, cut & polished) | 7102 | 1.5%(CGST+SGST combined typically quoted as 1.5%, i.e. 0.75+0.75; verify current notification) |
| Precious/semi-precious stones (other) | 7103 | 3% (verify) |
| Gold/Silver bars/coins (bullion) | 7108 / 7106 | 3% |
| Job-work service (making charges, if billed as a separate service by a job-worker) | SAC 9988 | 5% (verify current notification for gems & jewellery job work) |
| Old jewellery purchase from individual | N/A (non-supply) | Not applicable (see Section 8.3) |

*Rates shown reflect commonly understood rates as of recent years; **the system MUST NOT hardcode these as immutable** — Tax Master must allow the accountant/admin to update rates instantly (with effective-date versioning) whenever GST Council issues a new notification, and the engineering team should build in a rate-change alert/checklist rather than trusting this table indefinitely.

### 9.3 Invoice Format Requirements (GST Rule 46)
A compliant Tax Invoice must show: Invoice number (sequential, no gaps, financial-year-wise series), Invoice Date, Shop's GSTIN & Address, Customer's Name/Address/GSTIN (if B2B), HSN code per line, Description of goods, Quantity/Weight, Rate, Taxable Value, GST rate & amount split as CGST+SGST or IGST, **HUID number of each hallmarked piece** (industry-specific requirement — many state jewellers' associations and BIS require HUID printed on the invoice per item), Total Invoice Value in figures and words, Terms/Signature.

### 9.4 e-Invoicing (IRN/QR)
**Business Context:** Businesses above a GST-notified turnover threshold (threshold has been progressively lowered over the years — currently very low, effectively covering most mid-to-large jewellers) must generate an **e-Invoice**: the invoice data is pushed to the Government's Invoice Registration Portal (IRP), which returns an **IRN (Invoice Reference Number)** and a **signed QR code** that must be printed on the invoice.
**System Requirement:** Configurable toggle (per shop's applicability) to auto-generate e-Invoice via GSP (GST Suvidha Provider)/NIC API integration at the moment of bill finalization; QR code embedded on printed invoice; retry/queue mechanism for API downtime; cancellation workflow (e-Invoices can only be cancelled within 24 hours on the portal).

### 9.5 e-Way Bill
Required for movement of goods where invoice value exceeds the state-notified threshold (commonly ₹50,000, but many states have special lower/higher thresholds specifically for jewellery due to its high value-to-weight ratio — **must be configurable per state**) — relevant mainly for inter-branch stock transfers or high-value deliveries, not typical over-the-counter retail sale to walk-in customers carrying goods themselves (in-hand carriage by the purchaser is generally exempted, but rules vary by state/notification — system should support generating one when required).

### 9.6 GST Returns Support
System should generate data exports (or direct API push, Phase 2) formatted for:
- **GSTR-1** (outward supplies — sales register, HSN-wise summary)
- **GSTR-3B** (summary return — output tax vs ITC vs net payable)
- **Purchase Register** (for ITC reconciliation against GSTR-2B)
- **HSN Summary Report**

### 9.7 Reverse Charge Mechanism (RCM)
If the shop procures job-work/other notified services from an unregistered supplier, RCM may apply (shop pays GST directly to government, then claims ITC). System must support RCM invoice flagging separately in Purchase entries.

### 9.8 GST on Making Charges — Special Note
Making charges are taxed at the **same rate as the jewellery item itself** (not at a separate services rate) when billed as part of a composite jewellery sale invoice, per current GST treatment (making charge is treated as part of a composite supply of jewellery, not a standalone service) — this is a deliberate business rule the system must apply automatically rather than taxing making-charges lines separately at a service rate.


## 10. Accounting Module (Chartered Accountant Perspective)

### 10.1 Business Context
The software must generate proper double-entry accounting entries automatically behind every transaction, so the shop's books (P&L, Balance Sheet) are always accurate without manual journal entries, and can be exported/synced to Tally (the de-facto standard accounting software used by most Indian jewellers) or other accounting systems (Busy, Marg, Zoho Books).

### 10.2 Chart of Accounts (Minimum Required Ledgers)
- Sales A/c (segregated by Gold Sales, Silver Sales, Diamond Sales, Making Charges Income — for MIS clarity)
- Purchase A/c (Metal Purchase, Old Gold Purchase, Diamond/Stone Purchase)
- Output CGST / Output SGST / Output IGST Payable
- Input CGST / Input SGST / Input IGST Receivable (ITC)
- TCS Payable / TCS Receivable
- Stock-in-Hand (Raw Metal, Finished Goods, Stones) — Asset
- Karigar Metal Payable (grams-tracked, memo) / Karigar Labour Payable (money)
- Customer Advance (Liability) / Scheme Collection (Liability until redeemed)
- Sundry Debtors (Customer dues) / Sundry Creditors (Supplier dues)
- Cash-in-Hand / Bank Accounts
- Round Off A/c
- Discount Given A/c
- Making Charges Waived / Promotional Discount A/c

### 10.3 Auto-Posted Journal Entries — Key Transactions

**On Sale Invoice (regular cash/credit sale):**
```
Dr. Cash/Bank/Debtors A/c        [Net Payable]
    Cr. Sales A/c (Metal+Making+Stone, taxable value)  [Taxable Value]
    Cr. Output CGST A/c                                 [CGST Amt]
    Cr. Output SGST A/c                                 [SGST Amt]
    Cr. Round Off A/c (or Dr., if negative)              [Round Off]
```

**On Old-Gold Purchase (settled against new sale):**
```
Dr. Old Gold Purchase A/c        [Buyback Value]
    Cr. Cash/Bank/Debtors A/c (netted against sale receivable)  [Buyback Value]
```
(Net effect: Debtor/Cash entry above nets to Net Payable minus buyback value)

**On Raw Metal Purchase from Registered Bullion Dealer:**
```
Dr. Purchase A/c (Metal)         [Taxable Value]
Dr. Input CGST/SGST/IGST A/c     [GST Amt]
    Cr. Supplier A/c (Creditor)  [Total Invoice Value]
```

**On Metal Issued to Karigar:** Memo entry (grams only) in Karigar Metal Payable register — NOT a P&L transaction (metal still owned by shop, just physically with karigar). Some CAs prefer a contra-type "Stock with Karigar" sub-ledger under Inventory to keep it on the Balance Sheet distinctly from in-shop stock.

**On Karigar Making Charges (Labour) Booking:**
```
Dr. Making Charges Expense (or capitalized into Stock cost) A/c   [Labour Amount]
Dr. Input GST (if applicable, RCM/forward charge)                 [GST Amt]
    Cr. Karigar Labour Payable A/c                                [Total]
```

**On Advance Receipt from Customer:**
```
Dr. Cash/Bank A/c
    Cr. Customer Advance (Liability) A/c
```
(Reversed/adjusted when final sale invoice is raised against this customer)

**On TCS Collection:**
```
Dr. Cash/Bank A/c                [includes TCS]
    Cr. Sales A/c + GST A/cs     [Invoice value]
    Cr. TCS Payable A/c          [1% of applicable amount]
```

### 10.4 Stock Valuation for Balance Sheet
Closing stock valued at **lower of cost or net realizable value** (standard accounting prudence principle), cost determined via FIFO/Weighted Average (Section 5.4) for metal, and specific identification for making charges & stones already incurred per tag.

### 10.5 Karigar/Job-work Reconciliation Report
A CA-facing report reconciling: Opening metal balance with karigar (grams) + Metal issued during period − Metal received back (fine gold equivalent) − Wastage allowed = Closing metal balance with karigar. Any unexplained variance must be highlighted for investigation (potential loss, theft, or unrecorded wastage).

### 10.6 Bank/Cash Reconciliation
Daily cash-in-hand vs system-cash-sales reconciliation screen; bank statement import/match against UPI/Card/Cheque receipts.

### 10.7 Financial Reports
Trial Balance, P&L Statement, Balance Sheet, Day Book, Ledger-wise Statement, Debtors/Creditors Ageing.

### 10.8 Export/Integration
- Tally-compatible XML/CSV export (or direct Tally Prime API/ODBC push).
- Excel/CSV export for all registers.
- GST return-ready JSON (for GSTR-1/3B upload utilities or GSP integration).


## 11. BIS Hallmarking & HUID Compliance Module

### 11.1 Business Context
Since mandatory hallmarking rules took effect, gold jewellery sold in India (above small-business exemption thresholds) must carry a BIS Hallmark and a unique **HUID** (6-character alphanumeric code) allotted by a BIS-recognized **Assaying & Hallmarking Centre (AHC)** when the shop sends jewellery for hallmarking. Each HUID is unique to one physical piece and cannot be reused, and must be captured at billing so it appears on the invoice and can be traced.

### 11.2 Workflow
```
1. Finished tagged jewellery sent to AHC for testing/hallmarking (batch dispatch)
2. AHC returns items with a HUID laser-engraved + a Hallmarking Certificate/report 
   (uploaded/scanned into system)
3. System maps HUID <-> Tag ID <-> Item <-> Purity certified by AHC 
   (may differ slightly from declared purity - flag mismatches for review)
4. Item status moves to "Hallmarked - In Stock"
5. At time of billing, HUID is scanned/entered and printed on the invoice 
6. HUID marked "Sold" / "Consumed" once billed - cannot be reused for another sale
```

### 11.3 System Requirements
- Track items sent to AHC (dispatch register), pending, received, rejected (failed purity test — must trigger internal investigation/karigar accountability).
- Store HUID against each Tag permanently for warranty/exchange/resale traceability and for any future BIS portal reporting/integration.
- Alert if an un-hallmarked item (above exemption threshold) is attempted to be billed — configurable hard-block vs warning, since exemptions exist (e.g., items below 2 grams, certain categories, or shops below the exempted annual turnover, and specific antique/export cases).
- Support hallmarking exemption categories configuration since rules evolve.


## 12. Scheme / Gold Savings Plan Module

### 12.1 Business Context
A very common Indian jewellery-retail product: customer commits to depositing a fixed amount every month for a fixed tenure (commonly 11 months); at the end, the shop typically contributes a bonus installment (e.g., the 12th month's equivalent, or a fixed bonus %), and the total accumulated value can be redeemed **only against jewellery purchase** (rarely cash-refundable, by scheme terms).

### 12.2 Data Fields
Scheme Master: Scheme Name, Tenure (months), Bonus Type (Extra month free / % bonus / Slab-based bonus), Minimum/Fixed installment amount, Redemption rules (jewellery only / specific categories), Premature closure penalty rules.
Customer Enrollment: Customer, Scheme, Start Date, Installment Amount, Payment frequency reminders.

### 12.3 Workflow
```
1. Customer enrolls -> monthly installment receipts recorded (Dr. Cash/Bank, Cr. Scheme Collection Liability)
2. Reminders sent (SMS/WhatsApp) for due installments; missed-installment tracking
3. On maturity: Bonus computed & credited to customer's scheme balance
4. At redemption (billing time): Scheme balance (principal + bonus) applied as a 
   payment mode against the Net Payable of a sale invoice (Section 7.5)
5. Scheme Collection Liability reduced accordingly; any GST implication only 
   arises at actual jewellery sale (installments themselves are not a taxable 
   supply, being advance deposits for future goods - consistent with GST 
   treatment of advances for goods, Section 7.6)
```

### 12.4 Reports
Scheme-wise active/matured/lapsed customer list, Total outstanding scheme liability (important Balance Sheet figure — this is real money the shop owes in jewellery value), Collection due/overdue report, Bonus liability accrual report.

## 13. Loyalty, CRM & Customer Engagement (Supporting Module)

- Loyalty points on purchase value (configurable earn/redeem rate).
- Birthday/Anniversary reminders with auto SMS/WhatsApp offers.
- Purchase history & preference profile per customer (design categories liked, average ticket size).
- Automated rate-alert subscription ("notify me when gold rate drops below ₹X/gram").
- Festival/collection-launch broadcast campaigns (WhatsApp Business API integration).


## 14. Reports & Dashboards — Complete List

### 14.1 Owner/Management Dashboard (Real-time)
Today's Sales (₹ and grams, metal-wise), Live Stock Value (at cost vs at market), Karigar outstanding metal value, Scheme liability outstanding, Top-selling categories, Cash-in-hand snapshot, Old-gold purchased today, GST payable (running month-to-date).

### 14.2 Sales Reports
Day Book / Sales Register (invoice-wise), Item/Category-wise Sales, Salesperson-wise Sales & Incentive calculation, Customer-wise Sales History, Making-Charges Income Report, Discount Given Report, Estimate-to-Sale Conversion Ratio.

### 14.3 Inventory Reports
Stock Summary (item-wise, purity-wise, weight & value), Ageing Report (slow-moving stock — jewellery unsold beyond X days, important since capital is locked in metal), Tag-wise Stock Ledger, Branch Stock Comparison, Stock Transfer Register, Memo/Approval Outstanding Report, Physical Stock Discrepancy Report (Section 5.6).

### 14.4 Purchase & Karigar Reports
Purchase Register, Old-Gold Purchase Register, Karigar Issue-Receipt Reconciliation (Section 10.5), Karigar Wastage Analysis (karigar-wise average wastage% trend — helps identify inefficient or dishonest karigars), Pending Karigar Jobs (overdue).

### 14.5 GST & Statutory Reports
GSTR-1 data, GSTR-3B summary, HSN Summary, ITC Register, e-Invoice/IRN Log, e-Way Bill Log, TCS Report, PAN/Form-60 Compliance Report (flag transactions missing mandatory PAN), Cash Transaction Report for PMLA threshold monitoring (Section 4.4).

### 14.6 Accounting Reports
Trial Balance, P&L, Balance Sheet, Ledger Statements, Debtors/Creditors Ageing, Bank Reconciliation Statement.

### 14.7 Hallmarking Reports
HUID Register, Pending Hallmarking Dispatch, AHC-wise Rejection Report.

### 14.8 Scheme Reports
As per Section 12.4.

### 14.9 Audit Trail
Every master-data change, rate override, discount override, and cancelled/edited invoice must be logged with User, Timestamp, Old Value, New Value, Reason (mandatory text field for overrides) — exportable for internal/statutory audit.


## 15. Security, Access Control & Regulatory Compliance

### 15.1 Role-Based Access Control (RBAC)
Implement per Section 3 personas; every sensitive action (rate override, discount beyond limit, invoice cancellation/edit after finalization, stock write-off) requires role-based approval, with a maker-checker (dual control) option for high-value transactions (configurable threshold, e.g., transactions above ₹5,00,000).

### 15.2 Data Security
- Encrypted storage of PAN/Aadhaar/KYC documents.
- Role-based visibility of customer PII (e.g., counter staff shouldn't see full financial history; only accountant/owner should).
- Full audit logging (Section 14.9).
- Automated daily backup with off-site/cloud redundancy (critical — this is a high-value trade where data loss is unacceptable).

### 15.3 Statutory/Regulatory Hooks Summary (Consolidated)
| Regulation | Trigger | System Behavior |
|---|---|---|
| Income Tax Rule 114B | Cash sale ≥ ₹2,00,000 | Mandatory PAN or Form 60 capture, block invoice without it |
| TCS (Sec 206C) | Cash receipt over notified threshold | Auto-compute & add TCS, separate ledger |
| PMLA (Cash Transaction Report) | Cash transactions ≥ ₹10 lakh (single/connected) | Auto-flag for CTR filing, cannot be silently bypassed |
| BIS Hallmarking / HUID | Sale of gold jewellery above exemption | HUID mandatory field before invoice finalization (configurable hard/soft block) |
| GST e-Invoicing | Shop turnover above notified threshold | Auto IRN/QR generation |
| GST e-Way Bill | Goods movement above value threshold | Auto e-way bill trigger for stock transfer/delivery |

*(Exact thresholds/percentages must be maintained in a configurable "Statutory Parameters" table, not hardcoded, since Government notifications change these periodically — engineering must design this as data, not code.)*


## 16. Software Architecture (System Architect Perspective)

### 16.1 High-Level Architecture
- **Deployment model:** Cloud-hosted SaaS (multi-tenant) with offline-capable POS client (billing must work even during internet outage — critical for retail floor; syncs to cloud once connectivity resumes). Optional on-premise/hybrid for large customers wanting local server + cloud backup.
- **Layered architecture:**
  - Presentation: Web app (Admin/Back-office) + Desktop/Tablet POS app (billing counter, optimized for barcode scanner + weighing-scale peripheral input) + Mobile app (owner dashboard, on-the-go approvals) + Customer portal (Phase 2).
  - API layer: RESTful/GraphQL services, versioned, per-module (Inventory Service, Billing Service, Accounting Service, GST Service, Karigar Service, Scheme Service, Reporting Service).
  - Business Logic layer: Central **Pricing/Calculation Engine** (Section 7) as a shared, independently-testable service consumed by Billing, Estimate, and Old-Gold modules alike — single source of truth for all formulas, to avoid divergent calculation bugs.
  - Data layer: Relational DB (PostgreSQL/MySQL) for transactional integrity (financial data must be ACID-compliant); event/audit log store (append-only) for audit trail; object storage (S3-compatible) for images, certificates, hallmarking documents.
- **Integration layer:** GST e-Invoice/e-Way Bill APIs (via GSP), SMS/WhatsApp Business API, Payment Gateway (UPI/Card), Tally/accounting export connectors, Barcode/RFID/Weighing-scale device drivers (serial/USB/Bluetooth), BIS HUID data capture (manual/certificate upload since no public real-time BIS API currently exists for shops — verify at implementation time).

### 16.2 Key Non-Functional Requirements
| Category | Requirement |
|---|---|
| Performance | Billing calculation (Section 7 engine) must complete in <200ms per line to keep counter checkout fast |
| Offline Support | POS billing client must cache today's rate master, item master, and tag data locally; queue invoices for sync; must prevent duplicate tag sale across branches on reconnect (conflict resolution logic) |
| Precision | All weight/money calculations must use fixed-point/decimal arithmetic (NEVER floating point) to avoid rounding drift on high-value transactions |
| Scalability | Support multi-branch, multi-GSTIN tenants; peak-season (festival) load spikes (Akshaya Tritiya, Dhanteras, Diwali see 5-10x normal daily volume) |
| Auditability | Immutable audit log (Section 14.9); invoice numbers must be strictly sequential per financial year per GSTIN, no gaps (GST law requirement) |
| Data Integrity | Tag-level uniqueness constraint (a tag can never be "in stock" at two places or sold twice) enforced at DB level, not just app level |
| Availability | 99.9% uptime target for cloud services; graceful degradation to offline POS mode |
| Security | Role-based access (Section 15), encryption at rest & in transit, PCI-DSS compliance if storing card data (recommend NOT storing card data — use tokenized payment gateway) |
| Localization | Multi-language UI (Hindi, regional languages) since counter staff literacy in English varies across India |
| Peripherals | Native driver support for common barcode/label printers (TSC, Zebra) and digital weighing scale brands used in jewellery trade (serial/RS232 or USB-HID integration) |

### 16.3 Suggested Technology Stack (Indicative, not prescriptive)
Backend: Node.js/Java/Python (any mature stack with strong decimal-arithmetic libraries). Database: PostgreSQL (strong transactional + JSON support for flexible item attributes). Frontend: React/Angular for web back-office; lightweight native/Electron app for offline POS counter. Mobile: React Native/Flutter for owner app. Reporting: Embedded BI (Metabase/Power BI embedded) or custom report engine with export to Excel/PDF.


## 17. Worked Example — End-to-End Billing Calculation (For QA Test-Case Design)

**Scenario:** Customer buys one 22KT (916 purity) gold necklace with diamonds, and exchanges an old gold chain. Intra-state sale (CGST+SGST).

**Item Master / Tag Data:**
- Gross Weight: 25.500g
- Stone (Diamond) Weight: 1.500g (= 7.5 carats, assume 5 carats/gram conversion for illustration)
- Net Weight = 25.500 − 1.500 = **24.000g**
- Purity: 916 (22KT)
- Making Charge: ₹550/gram (per-gram type)
- Wastage: 5% of Net Weight

**Rate Master (today):** 22KT Gold Sale Rate = ₹6,200/gram

**Stone Master:** Diamond rate = ₹45,000/carat; assume 7.5 carats → but for simplicity in this illustration assume diamond value is directly ₹1,20,000 (certified value entered by staff for this specific piece, since real diamond pricing depends on 4Cs, not just weight).

**Calculation:**
```
Metal Value        = 24.000g x Rs 6,200/g               = Rs 1,48,800.00
Wastage Weight      = 24.000g x 5%                        = 1.200g
Wastage Value       = 1.200g x Rs 6,200/g                 = Rs   7,440.00
Making Charges      = 24.000g x Rs 550/g                  = Rs  13,200.00
Stone (Diamond) Val = (certified)                         = Rs 1,20,000.00
-----------------------------------------------------------------------
Taxable Value (Sub-Total)                                 = Rs 2,89,440.00

GST @ 3% (Gold/Diamond jewellery composite rate, intra-state):
   CGST @ 1.5%      = Rs 4,341.60
   SGST @ 1.5%      = Rs 4,341.60
-----------------------------------------------------------------------
Invoice Total (before round-off)                          = Rs 2,98,123.20
Round Off                                                  = -Rs 0.20
NET PAYABLE (before old-gold adjustment)                   = Rs 2,98,123.00
```

**Old Gold Exchange (settlement, separate purchase voucher — Section 8):**
```
Old Chain Gross Weight received  = 15.000g
Tested Purity                    = 875 (approx 21KT, tested lower than claimed)
Deduction for melting loss        = 3%
Net Payable Weight = 15.000 x 0.875 x (1 - 0.03) = 12.740g (rounded to 3 dp)
Buy-back Rate (today)              = Rs 6,050/gram (slightly below sale rate)
Buyback Value = 12.740g x Rs 6,050/g = Rs 77,077.00
```

**Final Settlement:**
```
Net Payable (Sale Invoice)          = Rs 2,98,123.00
Less: Old Gold Buyback Value        = Rs   77,077.00
-----------------------------------------------------------------------
NET CASH/DIGITAL PAYMENT DUE FROM CUSTOMER = Rs 2,21,046.00
```

**PAN/TCS Check:** Cash portion (if paid in cash) — since transaction value exceeds ₹2,00,000, PAN is mandatory (Section 4.4); if the final cash component itself crosses relevant TCS thresholds, TCS @1% auto-applies on the applicable amount.

**Accounting Entries Auto-Posted:**
```
Dr. Debtor/Cash A/c                Rs 2,21,046.00
Dr. Old Gold Purchase A/c          Rs   77,077.00
    Cr. Sales A/c (Jewellery)      Rs 2,89,440.00
    Cr. Output CGST A/c            Rs    4,341.60
    Cr. Output SGST A/c            Rs    4,341.60
    Cr. Round Off A/c              Rs        0.20
    (Dr = Cr, balanced)
```

*(This worked example is the reference test case the QA team should replicate exactly with unit tests, including edge cases: zero stone weight, wastage merged into MC, inter-state IGST variant, split payment, and old-gold-only transaction with no new sale.)*

## 18. Phased Rollout Roadmap (Suggested)

| Phase | Scope |
|---|---|
| **Phase 1 (MVP)** | Master Data, Rate Master, Tagging & Barcode, Billing Engine (Sections 4,5,7), basic GST invoice, basic Accounting entries, Old Gold Exchange, core Reports |
| **Phase 2** | Karigar/Job-work module, Schemes, e-Invoice/e-Way Bill integration, Multi-branch, Advanced audit/RBAC, Tally integration |
| **Phase 3** | RFID stock-taking, Customer self-service portal/app, WhatsApp/Loyalty automation, BI dashboards, offline-first POS hardening |
| **Phase 4** | AI-assisted demand/design analytics, dynamic pricing alerts, marketplace/e-commerce extension (explicitly out of scope for v1 core, per Section 2) |

## 19. Glossary (Quick Reference)
GW = Gross Weight | NW = Net Weight | SW = Stone Weight | MC = Making Charge | HUID = Hallmark Unique ID | AHC = Assaying & Hallmarking Centre | ITC = Input Tax Credit | RCM = Reverse Charge Mechanism | TCS = Tax Collected at Source | PMLA = Prevention of Money Laundering Act | HSN = Harmonized System of Nomenclature | SAC = Services Accounting Code | KT = Karat | IRN = Invoice Reference Number | IRP = Invoice Registration Portal | GSP = GST Suvidha Provider

---
*End of Document. This PRD should be treated as a living document — GST rates, TCS/PAN thresholds, and Hallmarking rules must be re-verified against current Government notifications before final implementation, as these are periodically revised by the GST Council, CBDT, and BIS respectively.*
