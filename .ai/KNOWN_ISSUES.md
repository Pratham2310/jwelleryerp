# KNOWN_ISSUES.md

Concrete, code-referenced issues found while auditing the current prototype against the PRD/Handbook. Ordered roughly by severity. **Issues #1–4 are GST/business-rule correctness bugs** — if this billing logic is ever pointed at real money/real invoices without fixing these, it will produce non-compliant tax invoices.

---

### 1. ✅ RESOLVED (2026-07-25) — Old Gold Exchange incorrectly reduces the GST taxable value
**File:** `src/components/BillingEstimator.tsx`, lines 186–190.
```ts
const invoiceSubtotal = billingItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
const oldGoldValue = Math.round(oldGoldWeight * oldGoldRate);
const payableSubtotal = Math.max(0, invoiceSubtotal - oldGoldValue);
const gstTax = Math.round(payableSubtotal * 0.03); // 3% Indian GST on Gold
```
GST is computed on `payableSubtotal`, which already has the old-gold trade-in value subtracted out. **This is exactly the mistake PRD §8.3 explicitly and repeatedly warns against:** "Old-gold exchange adjusted against a new purchase invoice must NOT be shown as a discount on the new item's taxable value (this would incorrectly reduce GST payable on the new sale)." The correct model (PRD §8.3, worked example §17): the new item is billed and taxed at its **full** value; old-gold value is a separate purchase voucher, netted only at the **payment/settlement** stage (`Net Cash Due = Invoice Total (incl. GST) − Old Gold Buyback Value`).
**Fix direction:** compute `gstTax` from `invoiceSubtotal` (post line-level/bill-level discounts, per §7.4, but *before* old-gold netting), then net old-gold value only against the final payable amount, exactly as shown in the PRD §17 worked example.

**Resolved:** `src/lib/billingCalculations.ts`'s `calculateInvoiceTotals()` computes GST on the full taxable subtotal; `settleOldGold()` nets old gold only against the final `netAmountDue`, which is a separate field on `SaleInvoice` from the tax-compliant `grandTotal`. See `CHANGELOG.md` 2026-07-25.

### 2. GST is a flat hardcoded 3% with no CGST/SGST/IGST split, no HSN
**File:** same location, `gstTax = Math.round(payableSubtotal * 0.03)`.
No HSN code, no Tax Master lookup, no CGST+SGST-vs-IGST determination by comparing shop state to customer state (PRD §7.3, §9.2, §9.7 — Handbook §2.9 explicitly calls hardcoding "3% GST on jewellery" as a constant "the most common shortcut first-time builders take" and warns against it by name). Also doesn't distinguish jewellery (HSN 7113) from diamond value (HSN 7102, ~1.5% per the PRD's own table) — see item 6 below and `HANDOFF.md` item 1 for the deeper open question here.

### 3. ✅ RESOLVED (2026-07-25) — Wastage is a hardcoded 3.5% constant, ignoring each item's actual configured wastage%
**File:** `src/components/BillingEstimator.tsx`, line 118.
```ts
const wastagePercent = 3.5; // average default if not specified
```
Every `JewelleryItem` already carries its own `wastagePercent` field (populated correctly in `mockData.ts`, e.g. 3.5%, 5.0%, 2.0%, 4.0%, etc. — genuinely varied per item), but `calculateItemSubtotal()` never reads it — it always uses the literal `3.5` regardless of which item is billed. Any item with a different configured wastage % will be billed incorrectly.

**Resolved:** `calculateLineItem()` in `src/lib/billingCalculations.ts` reads `wastagePercent` per line (from the item master when pulled from stock, or a new manual input for custom rows).

### 4. ✅ RESOLVED (2026-07-25) — Making-charge calculation conflates wastage into making charge, and ignores making-charge *type*
**File:** `src/components/BillingEstimator.tsx`, lines 118–124.
```ts
const wastageWeight = netWeight * (wastagePercent / 100);
const totalMakingBasis = netWeight + wastageWeight;
const finalMaking = totalMakingBasis * makingCharge;
const itemTotal = goldValue + finalMaking + stoneCharge;
```
Per PRD §7.2, Wastage Value and Making Charges are two **separate** line items (`Wastage Value = Wastage Weight × Metal Rate`, not × making-charge rate), and Making Charges itself has three distinct types — **Per-gram**, **Percentage-of-metal-value**, and **Fixed/piece** (PRD §7.2 Step 4) — selected per item (`JewelleryItem.makingChargeType`). The current code always treats making charge as a flat per-gram rate applied to `(net weight + wastage weight)`, which is neither the PRD's separate-line model nor its merged Value-Addition model (§7.2's note allows *either* display mode, but always as a documented, consistent choice — not this ad hoc blend). It also silently ignores `makingChargeType === 'flat'` items (e.g. mock item `EAR-18K-109` has `makingChargeType: 'flat', makingChargeValue: 2500` — a flat ₹2,500 — but billing math will multiply that 2500 by weight as if it were a per-gram rate).
**Fix direction:** implement PRD §7.2 Steps 2–4 literally and separately, branching on `makingChargeType`, and use each item's own `wastagePercent` (issue #3). This is exactly the kind of formula work that should live in one shared, unit-tested Calculation Engine function (see `ARCHITECTURE.md`), tested against the PRD §17 worked example.

**Resolved:** exactly as suggested — `calculateLineItem()` branches on `makingChargeType` (`per-gram` multiplies by net weight, `flat` does not) and computes Wastage Value as its own figure (`netWeight × wastagePercent/100 × metalRate`), separate from Making Charge. Unit-tested in `src/lib/billingCalculations.test.ts` against the PRD §17 worked example and the previously-mischarged `EAR-18K-109` mock item.

### 5. ✅ RESOLVED (2026-07-25) — "Scheme Redemption" payment method doesn't touch the scheme balance
**Files:** `src/components/BillingEstimator.tsx` (payment method selector, line ~786) and `src/components/CustomerManager.tsx` (`savingsSchemeBalance`).
Selecting `'Scheme Redemption'` as the payment method is purely a label choice on the invoice — it never validates against, deducts from, or even reads `selectedCustomer.savingsSchemeBalance`. A customer could "redeem" more than their scheme balance with no warning, and their balance is never actually reduced.

**Resolved:** `BillingEstimator.tsx`'s `handleCheckout()` now blocks checkout (via `validationError`) if `paymentMethod === 'Scheme Redemption'` and the customer's `savingsSchemeBalance` is insufficient or the customer has no active scheme, and deducts the redeemed amount from that customer's balance via `setCustomers` on success.

### 6. Diamond/stone value is taxed identically to metal value, with no HSN-split handling
Related to issue #2. The PRD's own worked example (§17) treats the whole composite piece (metal + wastage + making + diamond) as **one** taxable value at the jewellery-composite rate, while the PRD's own HSN table (§9.2) lists diamonds separately at a materially different rate. The Handbook (§2.8) flags this as an **open, unresolved tension requiring CA sign-off** before the GST engine is built — the current prototype has (understandably, since this is unresolved) implemented neither approach rigorously; it just adds `stoneCharge` into one blended subtotal. **Do not "fix" this without first resolving the open question in `HANDOFF.md` item 1.**

### 7. Cash-refund of scheme balances has no legal guardrail
Handbook §1.6.1 states plainly: Gold Savings Schemes are only exempt from being classified as illegal deposit-taking (Banning of Unregulated Deposit Schemes Act, 2019) if redemption is **strictly in-kind (jewellery) and never cash-refundable**. The current `CustomerManager.tsx` scheme UI has no such restriction modeled at all (there's no redemption flow yet, only balance accrual) — when the redemption flow is built, a hard default block on cash payout (configurable only via a logged compliance override) is a legal requirement, not a nice-to-have feature request.

### 8. ✅ RESOLVED (2026-07-25) — `StoneManager` and `JobBagManager` state is isolated from the rest of the app
See `FRONTEND_ARCHITECTURE.md` §3 and `DATABASE.md` §1.1. `LooseStone[]` and `JobBag[]` are owned locally inside their respective components (their own `useState` + their own direct `localStorage` keys), unlike every other domain entity, which is lifted to `App.tsx`. Practical consequences: the Dashboard cannot show stone-vault or job-bag KPIs; the global header search can't find stones/bags; `JobBag` and `WorkOrder` (in `KarigarManager.tsx`) represent overlapping real-world concepts (a karigar job) but share no data or foreign key, so the same job can drift out of sync between the two screens.

**Partially resolved:** `LooseStone[]` and `JobBag[]` state (with `localStorage` sync) is now lifted to `App.tsx`, same pattern as `items`/`customers`/`karigars` — the Dashboard/global-search/other-screens visibility problem is fixed. **Still open:** `JobBag` and `WorkOrder` remain two separate, unlinked data shapes — that structural unification is Milestone 7 (Karigar Work Order & Job Bag Integration), not attempted here.

### 9. ✅ RESOLVED (2026-07-25) — Global header search operates on stale, static seed data
**File:** `src/components/layout/Header.tsx`, imports `initialJewelleryItems`, `initialCustomers`, `initialKarigars` directly from `src/data/mockData.ts` rather than receiving live state as props. Items/customers/karigars added, edited, or deleted during a session are invisible to the search box — it only ever searches the original fixture data. `Header` isn't even passed `items`/`customers`/`karigars` props from `App.tsx` today, so this requires a prop-wiring change, not just an import swap.

**Resolved:** `Header.tsx` now takes `items`/`customers`/`karigars` as props, wired from `App.tsx`'s live state; the static `mockData` import was removed.

### 10. ✅ RESOLVED (2026-07-27) — Karigar ledger has no transaction history, only two mutable running totals
**File:** `src/types.ts` (`Karigar.metalBalance`, `Karigar.laborChargesOwed`) and `src/components/KarigarManager.tsx`. Every issue/receipt/payout directly mutates these two numbers in place. There is no append-only ledger of individual transactions, no way to reconstruct "how did we arrive at this balance," and no reconciliation report (PRD §10.5) is possible without one. This mirrors the same event-sourcing gap called out for Rate Master (`DATABASE.md` §2.3) but for the karigar domain.

**Resolved (Milestone 16):** `KarigarLedgerEntry[]` is now an append-only ledger; balances are derived with `deriveKarigarBalance()` and a statement view shows every entry with its running balance. Weight and money are structurally separate per D-2 — `validateLedgerEntry()` rejects an entry carrying both. `Karigar.metalBalance`/`laborChargesOwed` remain on the type only for legacy seed compatibility and must not be read. **Note the same event-sourcing gap is still open for Rate Master** — that is Milestone 48, and it remains a live D-4 violation.

### 11. ✅ RESOLVED (2026-07-28) — Invoice numbering is not GST-compliant
**File:** `src/components/BillingEstimator.tsx`, `invoiceNumber: `INV-2026-${1000 + invoices.length + 1}`` (handleCheckout). This derives the "next" invoice number from the in-memory array length, which (a) isn't guaranteed gap-free or sequential once invoices can be deleted/filtered/multi-branch, and (b) has no per-GSTIN, per-financial-year scoping at all — a hard GST Rule 46 requirement (PRD §9.3, Handbook §2.9 for the Branch/GSTIN relationship this depends on).

**Resolved (a) 2026-07-25:** `nextInvoiceNumber()` in `BillingEstimator.tsx` uses a monotonic counter persisted at `stitch_invoice_seq_<year>` in `localStorage`, gap-free regardless of array filtering/deletion.

**Resolved (b) 2026-07-28 (Milestone 19):** `nextBranchInvoiceNumber()` in `src/lib/branch.ts` allocates from a **per-GSTIN series** keyed on the branch's `invoiceSeriesPrefix`, as GST Rule 46 requires, taking the highest existing number for that prefix rather than an array length. Two branches can no longer issue colliding invoice numbers.

### 12. ⚠️ ROOT CAUSE FIXED (2026-07-28) — Design-system duplication: `ui/` components vs. raw-Tailwind + global CSS overrides
See `COMPONENT_LIBRARY.md` §3 for full detail. Only 3 of 15 components use the shared `ui/Button`/`Input`/`Card`/`Badge` primitives; the other 8 screens hand-roll markup styled via generic Tailwind class names that are then repainted by `!important` overrides in `index.css`. Not a functional bug, but a real maintainability risk: any new Tailwind class not already covered by an override rule will silently render with wrong/un-themed colors in dark mode.

**This is no longer hypothetical.** Building `StockAuditPanel.tsx` (Milestone 6) reproduced it exactly on the first attempt: discrepancy rows rendered unreadable gray-on-gray, and the "Generate Discrepancy Report" button rendered white-on-white (invisible). It then recurred twice more — Dashboard SVG labels (M13, because `index.css` only remaps `text-*`, not `fill-*`) and the Karigar ledger modal (M16).

**Root cause, found in Milestone 20 after three symptom-level fixes.** The reason `dark:` utilities could never be relied on: this project is on **Tailwind v4**, where `dark:` defaults to `@media (prefers-color-scheme: dark)` — the **operating system's** setting — whereas `ThemeProvider` signals the theme by putting a `.dark` class on `<html>`. No `@custom-variant` was declared, so every `dark:` utility in the codebase was decoupled from the app's own toggle: never applied for a user on a light OS even in dark mode, and wrongly applied for a user on a dark OS in light mode. `index.css` now declares:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

**`dark:` utilities are therefore now trustworthy** and are the preferred way to theme new UI. Explicit `useTheme()` branching remains correct and is still required for anything Tailwind cannot express as a variant (inline SVG `fill`, computed style objects).

**Still open:** the `!important` repaint layer in `index.css` itself. Two traps survive and both bit during the M20 sweep:
- A blanket `.light .text-white { color: #09090B }` assumes light text always sits on a light card. For a panel deliberately dark in *both* themes it produces black-on-black. Mark such a panel `.on-dark-panel` (documented escape hatch in `index.css`) rather than adding another hyper-specific selector chain like `.bg-slate-900.p-5.rounded-2xl`.
- Colour families are remapped inconsistently: `text-amber-*` is globally forced to the brand gold `#C5A059`, but indigo, emerald and others have no remap at all, so they render at their raw Tailwind value against whichever surface they land on. Check before relying on one.

A shared `Card`/`Modal` primitive that encapsulates this (see `CURRENT_PROGRESS.md` §3.6) remains the real fix.

### 13. Dead dependencies
`@google/genai`, `express`, `motion` are all declared in `package.json` but never imported anywhere in `src/`. Space Grotesk is imported as a web font in `index.css` but never referenced by any class. Not harmful, but worth pruning or deliberately using before shipping, to avoid confusing future contributors into thinking there's a hidden AI/animation/server feature.

### 14. ✅ RESOLVED (2026-07-25) — Duplicated theme-detection boilerplate
See `FRONTEND_ARCHITECTURE.md` §4 — the `useState` + `MutationObserver` theme-detection block is copy-pasted (not extracted into a hook/context) across at least six files. Not a bug today, but a maintenance hazard: any future change to how theme is stored/read requires editing every copy correctly.

**Resolved:** extracted to `src/contexts/ThemeContext.tsx` (`ThemeProvider` + `useTheme()`). `App.tsx`, `Header.tsx`, `StoneManager.tsx`, `JobBagManager.tsx`, `BillingEstimator.tsx`, `CatalogManager.tsx`, and `Sidebar.tsx` all consume `useTheme()` instead of their own copy of the detection logic.
