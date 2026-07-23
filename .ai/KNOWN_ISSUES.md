# KNOWN_ISSUES.md

Concrete, code-referenced issues found while auditing the current prototype against the PRD/Handbook. Ordered roughly by severity. **Issues #1–4 are GST/business-rule correctness bugs** — if this billing logic is ever pointed at real money/real invoices without fixing these, it will produce non-compliant tax invoices.

---

### 1. 🚨 Old Gold Exchange incorrectly reduces the GST taxable value
**File:** `src/components/BillingEstimator.tsx`, lines 186–190.
```ts
const invoiceSubtotal = billingItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
const oldGoldValue = Math.round(oldGoldWeight * oldGoldRate);
const payableSubtotal = Math.max(0, invoiceSubtotal - oldGoldValue);
const gstTax = Math.round(payableSubtotal * 0.03); // 3% Indian GST on Gold
```
GST is computed on `payableSubtotal`, which already has the old-gold trade-in value subtracted out. **This is exactly the mistake PRD §8.3 explicitly and repeatedly warns against:** "Old-gold exchange adjusted against a new purchase invoice must NOT be shown as a discount on the new item's taxable value (this would incorrectly reduce GST payable on the new sale)." The correct model (PRD §8.3, worked example §17): the new item is billed and taxed at its **full** value; old-gold value is a separate purchase voucher, netted only at the **payment/settlement** stage (`Net Cash Due = Invoice Total (incl. GST) − Old Gold Buyback Value`).
**Fix direction:** compute `gstTax` from `invoiceSubtotal` (post line-level/bill-level discounts, per §7.4, but *before* old-gold netting), then net old-gold value only against the final payable amount, exactly as shown in the PRD §17 worked example.

### 2. GST is a flat hardcoded 3% with no CGST/SGST/IGST split, no HSN
**File:** same location, `gstTax = Math.round(payableSubtotal * 0.03)`.
No HSN code, no Tax Master lookup, no CGST+SGST-vs-IGST determination by comparing shop state to customer state (PRD §7.3, §9.2, §9.7 — Handbook §2.9 explicitly calls hardcoding "3% GST on jewellery" as a constant "the most common shortcut first-time builders take" and warns against it by name). Also doesn't distinguish jewellery (HSN 7113) from diamond value (HSN 7102, ~1.5% per the PRD's own table) — see item 6 below and `HANDOFF.md` item 1 for the deeper open question here.

### 3. Wastage is a hardcoded 3.5% constant, ignoring each item's actual configured wastage%
**File:** `src/components/BillingEstimator.tsx`, line 118.
```ts
const wastagePercent = 3.5; // average default if not specified
```
Every `JewelleryItem` already carries its own `wastagePercent` field (populated correctly in `mockData.ts`, e.g. 3.5%, 5.0%, 2.0%, 4.0%, etc. — genuinely varied per item), but `calculateItemSubtotal()` never reads it — it always uses the literal `3.5` regardless of which item is billed. Any item with a different configured wastage % will be billed incorrectly.

### 4. Making-charge calculation conflates wastage into making charge, and ignores making-charge *type*
**File:** `src/components/BillingEstimator.tsx`, lines 118–124.
```ts
const wastageWeight = netWeight * (wastagePercent / 100);
const totalMakingBasis = netWeight + wastageWeight;
const finalMaking = totalMakingBasis * makingCharge;
const itemTotal = goldValue + finalMaking + stoneCharge;
```
Per PRD §7.2, Wastage Value and Making Charges are two **separate** line items (`Wastage Value = Wastage Weight × Metal Rate`, not × making-charge rate), and Making Charges itself has three distinct types — **Per-gram**, **Percentage-of-metal-value**, and **Fixed/piece** (PRD §7.2 Step 4) — selected per item (`JewelleryItem.makingChargeType`). The current code always treats making charge as a flat per-gram rate applied to `(net weight + wastage weight)`, which is neither the PRD's separate-line model nor its merged Value-Addition model (§7.2's note allows *either* display mode, but always as a documented, consistent choice — not this ad hoc blend). It also silently ignores `makingChargeType === 'flat'` items (e.g. mock item `EAR-18K-109` has `makingChargeType: 'flat', makingChargeValue: 2500` — a flat ₹2,500 — but billing math will multiply that 2500 by weight as if it were a per-gram rate).
**Fix direction:** implement PRD §7.2 Steps 2–4 literally and separately, branching on `makingChargeType`, and use each item's own `wastagePercent` (issue #3). This is exactly the kind of formula work that should live in one shared, unit-tested Calculation Engine function (see `ARCHITECTURE.md`), tested against the PRD §17 worked example.

### 5. "Scheme Redemption" payment method doesn't touch the scheme balance
**Files:** `src/components/BillingEstimator.tsx` (payment method selector, line ~786) and `src/components/CustomerManager.tsx` (`savingsSchemeBalance`).
Selecting `'Scheme Redemption'` as the payment method is purely a label choice on the invoice — it never validates against, deducts from, or even reads `selectedCustomer.savingsSchemeBalance`. A customer could "redeem" more than their scheme balance with no warning, and their balance is never actually reduced.

### 6. Diamond/stone value is taxed identically to metal value, with no HSN-split handling
Related to issue #2. The PRD's own worked example (§17) treats the whole composite piece (metal + wastage + making + diamond) as **one** taxable value at the jewellery-composite rate, while the PRD's own HSN table (§9.2) lists diamonds separately at a materially different rate. The Handbook (§2.8) flags this as an **open, unresolved tension requiring CA sign-off** before the GST engine is built — the current prototype has (understandably, since this is unresolved) implemented neither approach rigorously; it just adds `stoneCharge` into one blended subtotal. **Do not "fix" this without first resolving the open question in `HANDOFF.md` item 1.**

### 7. Cash-refund of scheme balances has no legal guardrail
Handbook §1.6.1 states plainly: Gold Savings Schemes are only exempt from being classified as illegal deposit-taking (Banning of Unregulated Deposit Schemes Act, 2019) if redemption is **strictly in-kind (jewellery) and never cash-refundable**. The current `CustomerManager.tsx` scheme UI has no such restriction modeled at all (there's no redemption flow yet, only balance accrual) — when the redemption flow is built, a hard default block on cash payout (configurable only via a logged compliance override) is a legal requirement, not a nice-to-have feature request.

### 8. `StoneManager` and `JobBagManager` state is isolated from the rest of the app
See `FRONTEND_ARCHITECTURE.md` §3 and `DATABASE.md` §1.1. `LooseStone[]` and `JobBag[]` are owned locally inside their respective components (their own `useState` + their own direct `localStorage` keys), unlike every other domain entity, which is lifted to `App.tsx`. Practical consequences: the Dashboard cannot show stone-vault or job-bag KPIs; the global header search can't find stones/bags; `JobBag` and `WorkOrder` (in `KarigarManager.tsx`) represent overlapping real-world concepts (a karigar job) but share no data or foreign key, so the same job can drift out of sync between the two screens.

### 9. Global header search operates on stale, static seed data
**File:** `src/components/layout/Header.tsx`, imports `initialJewelleryItems`, `initialCustomers`, `initialKarigars` directly from `src/data/mockData.ts` rather than receiving live state as props. Items/customers/karigars added, edited, or deleted during a session are invisible to the search box — it only ever searches the original fixture data. `Header` isn't even passed `items`/`customers`/`karigars` props from `App.tsx` today, so this requires a prop-wiring change, not just an import swap.

### 10. Karigar ledger has no transaction history, only two mutable running totals
**File:** `src/types.ts` (`Karigar.metalBalance`, `Karigar.laborChargesOwed`) and `src/components/KarigarManager.tsx`. Every issue/receipt/payout directly mutates these two numbers in place. There is no append-only ledger of individual transactions, no way to reconstruct "how did we arrive at this balance," and no reconciliation report (PRD §10.5) is possible without one. This mirrors the same event-sourcing gap called out for Rate Master (`DATABASE.md` §2.3) but for the karigar domain.

### 11. Invoice numbering is not GST-compliant
**File:** `src/components/BillingEstimator.tsx`, `invoiceNumber: `INV-2026-${1000 + invoices.length + 1}`` (handleCheckout). This derives the "next" invoice number from the in-memory array length, which (a) isn't guaranteed gap-free or sequential once invoices can be deleted/filtered/multi-branch, and (b) has no per-GSTIN, per-financial-year scoping at all — a hard GST Rule 46 requirement (PRD §9.3, Handbook §2.9 for the Branch/GSTIN relationship this depends on).

### 12. Design-system duplication: `ui/` components vs. raw-Tailwind + global CSS overrides
See `COMPONENT_LIBRARY.md` §3 for full detail. Only 3 of 15 components use the shared `ui/Button`/`Input`/`Card`/`Badge` primitives; the other 8 screens hand-roll markup styled via generic Tailwind class names that are then repainted by `!important` overrides in `index.css`. Not a functional bug, but a real maintainability risk: any new Tailwind class not already covered by an override rule will silently render with wrong/un-themed colors in dark mode.

### 13. Dead dependencies
`@google/genai`, `express`, `motion` are all declared in `package.json` but never imported anywhere in `src/`. Space Grotesk is imported as a web font in `index.css` but never referenced by any class. Not harmful, but worth pruning or deliberately using before shipping, to avoid confusing future contributors into thinking there's a hidden AI/animation/server feature.

### 14. Duplicated theme-detection boilerplate
See `FRONTEND_ARCHITECTURE.md` §4 — the `useState` + `MutationObserver` theme-detection block is copy-pasted (not extracted into a hook/context) across at least six files. Not a bug today, but a maintenance hazard: any future change to how theme is stored/read requires editing every copy correctly.
