# CHANGELOG.md

Dated log of changes to the project, covering both documentation and code. Newest entries at the top. This log covers the documentation knowledge base as well as the underlying project — any agent making a non-trivial change to code or domain decisions should add an entry here.

---

## 2026-07-30 — Milestone 28: Accounting Ledgers & Auto-Journal Posting

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign.

PRD §10.1 requires the books to be correct *"without manual journal entries"*, so nothing here is hand-posted. Every voucher is **derived** from a business document that already exists, which makes the accounts a projection of the transaction log rather than a second set of records that can drift from it — the same principle as derived karigar balances (M16), metal rates (M48) and scheme balances (M26). Re-deriving the same documents yields byte-identical books, and a test asserts it.

**Three domain rules the postings deliberately respect:**

1. **Old gold is a purchase, not a discount** (decision **D-10**). It gets its own voucher — `Dr Old Gold Purchase / Cr Cash` — and never touches the sale's taxable value. Netting it into the sale would understate output GST, the exact bug Milestone 2 fixed in the forward direction; posting it as a contra-sale here would have quietly reintroduced it in the ledgers.
2. **Scheme collections are a liability, not income** (PRD §12.3). An instalment posts `Dr Cash / Cr Scheme Collection Liability`. Booking it as income would recognise revenue the shop has not earned and inflate both the P&L and the tax due on it.
3. **Weight never enters the money books** (decision **D-2**). "Karigar Metal Payable" sits in PRD §10.2's chart as a *grams-tracked memo* and is deliberately not posted — valuing an artisan's outstanding metal into rupees would net the two ledgers. A weight-only karigar entry posts nothing at all.

Screens: **Day Book**, **Trial Balance**, **Ledger Statement** and **Chart of Accounts**, on a new Accounting route. Ledger balances run in each account's natural direction, so a liability the shop owes reads positive rather than negative.

**A presentation defect browser testing turned up, worth naming.** The Day Book total read ₹1,09,512 against invoices of ₹1,08,012. That is correct double-entry — a discounted sale debits Discount Given as well as cash — but it does not *reconcile* the way the milestone requires, and an owner comparing the two figures would reasonably conclude the books were wrong. Added `reconcileDayBook()`, which states what genuinely ties (income credited for the day against the gross value of the documents raised for it) and shows the discount that explains the gap. The header KPI was relabelled **Gross Postings (Dr)** for the same reason: sitting beside a different trial-balance figure, "Total Posted" read as a second, conflicting total.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **631 tests passing across 23 suites** (up from 586); `npm run build` clean. Playwright-verified: 20 vouchers derived from the seed data with **zero unbalanced**, the Trial Balance agreeing at ₹3,85,034 on both sides, scheme instalments landing in the liability ledger rather than income, and the karigar payable carrying only money entries. Regression across all 9 screens × 2 themes and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Not built here:** the P&L and Balance Sheet themselves (Milestone 47), and stock valuation for the balance sheet (PRD §10.4), which needs a costing method decision before it can be posted.

---

## 2026-08-01 — Milestone 32: Roles & Permissions

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation.

Every screen was reachable by anyone and the login role was decorative. This adds a real permission matrix, gates navigation and routes by it, and lets roles be created and edited.

**It gates the interface, not the data** — stated in the module header and on the screen itself. There is no backend, everything lives in `localStorage`, and anyone with a console can rewrite it. So this is a control against *mistakes and process violations*, which is what a shop actually needs day to day, not against a determined actor. That is written down rather than implied because the failure mode is someone later treating a checkbox here as though it enforced security. The permission names are chosen to port unchanged to a server, so re-asserting them there is a re-implementation rather than a redesign.

**Three decisions worth recording:**

- **An unknown role gets nothing, not everything.** Defaulting an unrecognised role to full access is the classic way a permission system quietly stops working — one typo in a role name would silently unlock the whole app.
- **At least one role must always keep `admin.roles`.** Remove it from the last one and nobody can ever grant it back: the shop would be locked out of its own permission screen with no recovery short of clearing storage. Both the edit and the delete path refuse it, and say why.
- **Gated screens are hidden, and the route is guarded too.** Hiding a nav link is not a guard — a typed URL would still render. A denied route bounces to the Dashboard, which is deliberately ungated so a denied user always lands somewhere rather than on a blank page.

`billing.discount` and `billing.override` are separate permissions on purpose: an override changes the calculated rate itself, which is why Milestone 10 makes it require a logged reason. Login now offers a role, because the matrix is only observable if you can sign in as something other than the fully-privileged one.

**Two of my own defects, caught in the browser pass and fixed:** a React key warning from an unkeyed `<>` in the grouped matrix, and the unchecked-permission marker measuring 1.76:1 in dark mode — subdued is fine, illegible is not, since that mark carries the actual answer.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **926 tests passing across 31 suites** (up from 888); `npm run build` clean. Browser-verified across roles: Owner sees 11 screens, Counter Staff 6, and all five hidden ones stay hidden when their URLs are typed directly; the Accountant has the books but not billing; stripping `admin.roles` from the only administrator is refused by name. Full sweep across both themes and mobile: zero contrast failures, zero console errors.

---

## 2026-08-01 — Phase 14 Complete: Milestones 45–47 (Accounting Depth)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation.

Completes the accounting story. Milestone 28 derived journals from business documents; this adds the money movements no document covers, and the three statements PRD §10.5 / §14.7 require. Built after Procurement deliberately — a P&L before purchases existed would have shown revenue with no cost of goods.

**M45 — Payment / Receipt / Contra vouchers.** Posted through the **same** journal engine as everything else, so the books stay one set of records rather than two that can disagree. A **Contra is validated differently on purpose**: depositing takings into the bank does not make the shop richer, so both legs must be cash or bank. Allowing an income or expense account there would turn a movement that changed nothing into profit or loss — which makes *"a contra never touches P&L"* a structural guarantee rather than a convention. The reverse is caught too: a cash↔bank move booked as a Payment is redirected to Contra. Narration is mandatory, because a manual voucher has no source document behind it and is therefore its own only audit trail.

**M46 — Cash Book.** The opening balance carries everything posted **before** the window, so the book is continuous. One that restarts at zero each period would show a closing balance with nothing to do with what is actually in the drawer. `opening + receipts − payments = closing` is asserted and displayed rather than assumed.

**M47 — Profit & Loss and Balance Sheet**, both derived from the journal.

**The load-bearing point is why the Balance Sheet balances at all.** Since every voucher balances, across the whole book:

    Assets − Liabilities = Income − Expenses = Net Profit

So the sheet balances **only because the P&L result is carried into it** as retained earnings. Omitting it leaves the sheet out by exactly the profit — and the instinct is then to plug the difference somewhere, which buries the real cause. `buildBalanceSheet()` carries it explicitly and reports `isBalanced`, so the identity is checked rather than trusted. The chart of accounts previously had no equity side at all, which is why it could never have balanced: there was nowhere for profit to land.

Two distinctions kept deliberately apart, both easy to collapse: the **P&L is a period statement** while the **Balance Sheet is cumulative to a date** (so retained earnings carries every prior period, not just this month's); and **GST collected is a liability, never income**, so it does not reach the P&L.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **888 tests passing across 30 suites** (up from 849); `npm run build` clean. Browser-verified: the Balance Sheet balances at ₹92,826 on both sides on seeded data and still balances after posting vouchers; a Contra offers only cash and bank on its far side; the Cash Book reconciles. One result looked wrong and was chased down rather than accepted — the Balance Sheet total was unchanged after posting two vouchers, which turned out to be correct because the test's Payment was against Sundry Debtors, an asset-to-asset move. Re-running against an expense account moved **both** sides to ₹87,826, confirming the vouchers were not being ignored. All 9 Accounting tabs × 2 themes, the 10-screen sweep and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Not done, and recorded rather than glossed:** PRD §10.4's at-cost vs at-market closing-stock valuation. Stock movements are not yet costed into the ledger, so the closing-stock figure that task asks for has nothing to draw on — it belongs with the inventory valuation work (M44).

---

## 2026-08-01 — Phase 9 Complete: Milestone 29 (Tally Prime Export)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation.

Closes the accounting phase. A downloaded XML file only — no Tally integration and no network call, per the simulation ground rule — but shaped the way Tally's import actually expects, because an accountant drops it straight in and a malformed voucher fails the **entire** import rather than just itself.

Deliberately built after Procurement rather than before: run in roadmap order it would have exported only the sales half of the books, since input tax and purchases did not exist until M40.

**Three conventions that yield a plausible-looking but wrong file when missed:**

1. **Tally's sign convention is inverted from the ledger's.** A DEBIT carries a NEGATIVE `<AMOUNT>` with `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`; a CREDIT carries a positive amount with `No`. That reads backwards to anyone who has just written a double-entry engine, and reversing it produces a file that imports **cleanly** while putting every figure on the wrong side of every account.
2. **Dates are `YYYYMMDD`**, no separators. `2026-07-20` is rejected outright.
3. **Ledger names must be XML-escaped.** Not hypothetical: the seeded supplier is "Zaveri Bullion & Refinery Co.", and a raw `&` makes the document malformed so Tally refuses everything.

**Unbalanced vouchers are excluded and reported, never silently shipped.** Tally rejects an import whose debits and credits disagree, and a file that fails at the accountant's desk with no explanation is worse than one that is short a voucher and says so on screen.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **849 tests passing across 29 suites** (up from 813); `npm run build` clean. Verified against the **actual downloaded file**, not just the generator: 20 vouchers over the seeded period, correct envelope and period header, dates in `YYYYMMDD`, debits negative and deemed-positive, credits positive and not, every amount to two decimals, no unescaped ampersand, and every voucher's amounts netting to exactly zero. All 5 Accounting tabs × 2 themes and the full 10-screen sweep: zero contrast failures, zero console errors.

**Test-scope note:** the suite runs in Node with no `DOMParser`, and jsdom is not a dependency. Rather than add one for a single assertion, the well-formedness test checks the two properties that actually break an import — no bare ampersand and balanced tags — driven through reserved characters in a narration. A real parse was done on the downloaded file in the browser pass instead.

---

## 2026-08-01 — Phase 12 Complete: Milestones 37–41 (Procurement & Supplier)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation.

The largest coverage gap in the roadmap, and the one that made two other modules structurally incomplete. Until now the app had **no way to buy stock** — inventory existed only because the seed data said so — and GST had an output side with no input side, so a GSTR-3B declared everything collected and nothing paid.

**M37 — Supplier Master.** PRD §4.4 frames customers and suppliers as one "Party" ledger; they stay separate records here but share one KYC shape and validator set. Per **D-5** the Party Master is tenant-wide with no `branchId` — a supplier delivering to two branches is one creditor. The load-bearing insight: **a GSTIN is not opaque.** Characters 1–2 are the state code and 3–12 are the PAN, so both are cross-checked against what was typed and auto-derived when blank. A state contradicting the GSTIN is the dangerous case, because M21 picks CGST+SGST vs IGST from it — a mistype misfiles tax on every document for that party and stays invisible until a return is filed. A bullion dealer is required to be registered, since ITC cannot be claimed without a supplier GSTIN. `Customer` also gained the PAN/Aadhaar/credit-limit/KYC fields PRD §4.4 requires and the type never had.

**M38 — Purchase Order.** Bullion is commonly bought **unfixed**: the metal is booked now and priced later. Such an order has a weight but **no knowable rupee value**, so `poValue()` returns `null` rather than 0 — zero would understate the commitment, and pricing it at today's rate would be a guess dressed as a fact. A fully-received PO does *not* auto-close, because closing is a decision (a shop may hold one open pending the invoice, or close it short); and over-receipt is flagged rather than clamped, because bullion genuinely arrives heavy.

**M39 — Goods Receipt.** The milestone that actually closes the hole. **Tested purity is not contracted purity, and the difference is money**: 100g at 99.9% delivered at 99.5% is 0.4g of fine gold, about ₹2,900 — surfaced live in grams *and* rupees so it reads as a claim against the supplier. The tolerance is 0.05 points, deliberately tighter than hallmarking's 0.2, because bullion is bought *to* a stated fineness rather than assayed after the fact. Received goods **enter the Tag lifecycle**: raw metal at `RawMetal` (a state the machine always had and nothing had ever produced), finished goods at `PendingHallmark` — **not** `InStock` — unless supplier-hallmarked, because entering at stock would let a purchased piece bypass the M25 guard entirely. Each piece is weighed individually per **D-6**.

**M40 — Purchase Invoice & ITC.** **Reverse charge posts two legs, not one**: an output liability the shop owes and an input credit it can claim. They net to zero in cash, which is exactly why recording only the credit is the inviting mistake — the books balance while the shop under-declares tax it legally owes. Both are shown before committing and reported separately so they can never be summed. A supplier's invoice number is *theirs*, so a repeat of (supplier, their number) is refused: booking it twice claims the same credit twice. Supply type compares the **supplier's** state to the branch's — the mirror of M21's customer comparison, and reversing that direction would file every inter-state purchase as CGST+SGST, which cannot be set off the way IGST can.

**M41 — Purchase Return & Debit Note.** Reuses `salesReturn.ts`'s arithmetic, and specifically reuses **the fix**: shares are derived cumulatively so successive partial returns telescope. Verified — ₹10,000 returned as 3333+3333+3334 reverses exactly ₹300 of credit, not ₹299; a residue would sit on the books as credit against goods that are gone. Reversal goes back into the same heads it was claimed under. This **required a new terminal Tag state, `ReturnedToSupplier`** — the only terminal state was `DamagedOrMelted`, and recording goods sent back to a dealer as goods destroyed is false in the stock ledger and wrong in the valuation. That changed an existing invariant (one terminal state → two), and the test was updated to assert the new one rather than weakened.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **813 tests passing across 28 suites** (up from 631); `npm run build` clean. Every milestone browser-verified end to end. Regression across 10 screens × 2 themes, all 4 Purchases sub-tabs × 2 themes, and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Scope note:** the "reverse charge refused on a registered supplier" rule is covered by unit test but not by the browser pass — that step hit the duplicate-invoice-number error first, since validation short-circuits there.

---

## 2026-07-30 — Money & Weight Arithmetic Foundation (Phase 9 prerequisite)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual change.

Built ahead of Milestone 28 because double-entry postings have to balance to the paisa, and the app's arithmetic could not guarantee that. Investigating it turned up a **live defect**, so this is a bug fix as much as a foundation.

**Why float bites here.** Every figure is a JavaScript double. That is fine for one multiplication and a `Math.round`, which is precisely why nothing had visibly broken. It stops being fine in two places:

1. **Accumulation.** `8.2 × 6650` is `54529.99999999999`, not `54530`. Summing `0.10` a thousand times gives `99.9999999999986`; a thousand weights of `8.245g` gives `8244.99999999991`.
2. **Splitting.** Rounding each part of an apportionment independently does not reproduce the whole. ₹1,000 across lines of 3333/3333/3334 by `round(share)` yields 333+333+333 = **999**.

**The defect that second point was already causing.** Successive partial returns against one invoice each rounded their own share of the bill-level discount. Returning all three lines of a 3333/3333/3334 invoice against a ₹1,000 discount reversed only ₹999 — the customer was a rupee short and the invoice could never be fully closed. That is the exact shape of a book that does not balance, which is why this had to land *before* the accounting phase rather than after it.

`src/lib/money.ts` does money in integer **paisa** and weight in integer **milligrams**. The load-bearing piece is `allocate()`, which apportions by the largest-remainder method so the parts sum to the total **by construction** rather than by luck; ties break toward the earlier bucket so a re-run cannot reshuffle a customer's figures. `moneyEquals()` exists because "does this payment split settle the invoice" is a float comparison, and `0.1 + 0.2 === 0.3` is false.

`salesReturn` now derives the discount share **cumulatively** — what is due on everything returned so far, less what earlier notes already reversed — so the shares telescope and the final note picks up any residue. Returning every line reverses exactly the discount given, whether in one credit note or three.

Retrofitted the accumulation sites where drift compounds across many records rather than one bill: invoice subtotals and the tender-split check, the GSTR figures that must reconcile against a filed return, the scheme principal that PRD §12.4 puts on the balance sheet, old-gold fine-weight totals feeding refining variance, stock-audit weight discrepancies, and metal on the factory floor.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **586 tests passing across 22 suites** (up from 556); `npm run build` clean. **No existing test was changed**, which is the signal that mattered for a cross-cutting retrofit: it is behaviour-preserving everywhere the old arithmetic was already right, and differs only where it was wrong. Regression across 8 screens × 2 themes and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Not done:** this is the foundation and the sites that demonstrably drift, not a wholesale conversion of every number in the app. UI-level display arithmetic still uses plain numbers; the rule going forward is that anything summing a list or splitting a total uses these helpers.

---

## 2026-07-29 — Milestones 26–27: Gold Savings Scheme Master, Enrolment & Passbook

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign.

Replaces the single hardcoded "Swarna Nidhi" — three loose fields on `Customer` with a mutable balance that billing decremented directly — with a real scheme master, enrolments, instalment receipts and a printable passbook. Two seeded schemes now differ deliberately (11-month fixed with a free instalment; 18-month flexible with an 8% bonus) so both bonus types are exercised.

**Balances are DERIVED, never stored.** They fold from the append-only instalment receipts, the same as karigar balances (M16) and metal rates (M48). A stored balance cannot answer *"which instalments make this up"*, which is precisely what a customer disputing their passbook asks — and PRD §12.4 calls the total a balance-sheet figure, so it should not be a number anyone can edit.

**The maturity bonus accrues only when the scheme has matured AND the tenure was paid in full.** Crediting it earlier would overstate both the customer's balance and the shop's liability, and would let someone collect the shop's contribution by paying a single instalment and waiting for the maturity date. Redemption is gated on the same condition, and the block reason names either the maturity date or the count of unpaid instalments rather than just refusing.

Dues are counted from the **start date** rather than from the last payment, so a customer who stopped in month 3 of 11 reads as 8 missed rather than merely idle. That is what drives the collection-overdue figure (PRD §12.4).

The `EXTRA_INSTALMENT` bonus ("pay 11, get the 12th free") is computed from the **enrolled** instalment amount rather than from what was actually paid, because that is what the customer was promised at enrolment.

**There is deliberately no cash-out function anywhere in this module.** Under the Banning of Unregulated Deposit Schemes Act 2019, these collections are advances against future goods; refunding them as cash would make them deposits, which an unregistered shop cannot lawfully accept (Handbook §1.6.1 / D-11). Premature closure forfeits the bonus, deducts the configured penalty, and returns the residue as *jewellery credit*. The reason is stated on the panel and on every printed passbook rather than left implicit — that absence is intentional, and a future contributor should not read it as a missing feature. The notice is a single shared constant so every surface words it identically.

The passbook shows the shop's bonus as **its own final row** rather than folded into the last instalment, because that contribution is the scheme's whole selling point and the customer needs to see it stated separately.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **556 tests passing across 22 suites** (up from 501); `npm run build` clean. Playwright-verified: the seeded liability of ₹52,000 and overdue collections of ₹28,000 both tie to the underlying receipts; a duplicate scheme code, a bonus exceeding the tenure, and a second live enrolment in the same scheme are each rejected; a newly created 6-month ₹4,000 scheme accrues independently of the original 11+1 (the milestone's own acceptance criterion); a fixed instalment is read-only at the counter; and the passbook runs ₹5,000 through ₹30,000 with the early-exit maths and the statutory notice on it. Regression across 8 screens × 2 themes, both Customer tabs × 2 themes, and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Follow-up, recorded not hidden:** scheme redemption at billing still debits the legacy `Customer.savingsSchemeBalance` rather than a specific enrollment. Both work, but they are two books; wiring redemption to consume a matured enrollment is the natural next step for this module.

---

## 2026-07-29 — Milestone 25: Non-Hallmarked Sale Prevention Guard

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign.

Closes the legal exposure Milestone 24 left open. M24 made HUIDs assignable; nothing stopped a piece being sold *without* one, and selling un-hallmarked gold that is not exempt is a BIS offence.

**Deliberately configurable rather than absolute**, because PRD §11.3 says so: *"configurable hard-block vs warning, since exemptions exist"*. Mandatory hallmarking has real carve-outs, and a shop hitting an unconditional block on a legitimate sale simply could not trade. Four exemptions are modelled:

- **Metal.** Mandatory hallmarking is a *gold* regime — silver hallmarking is voluntary and platinum separately regulated — so blocking a silver ring for want of a HUID would be wrong, not merely strict.
- **Category.** Coins and bullion are not "articles of jewellery", consistent with Milestone 21 filing them under HSN 7108/7106 rather than 7113.
- **Weight.** Articles below a threshold (2g by default, configurable) are exempt.
- **Turnover.** A shop below the notified annual turnover is exempt entirely.

**Detection is kept separate from enforcement.** Violations are computed in every mode and only the till behaviour changes — switching to WARN does not make a piece compliant. That separation is what lets a shop run relaxed and still report its own exposure honestly, rather than showing itself as clean because the till stopped complaining.

Two smaller judgement calls worth recording. A **zero or missing weight does not earn the below-threshold exemption**: absent data is not a light piece, and treating it as one would let an unweighed ornament through. And an **ESTIMATE is never blocked**, because a quotation is not a supply — the banner instead says it must be resolved before conversion, and the guard re-applies at that point.

The gate runs **before** the PAN and tender checks: if a piece legally cannot be sold at all, there is no point collecting a PAN or a payment for it.

**The custom-line bypass, closed the same day.** This milestone initially shipped with manually-typed lines skipped, recorded as a known gap. On inspection the gap was one click wide: *"Add Custom Item Row"* sits on the billing desk and defaults to Gold (22K) with an editable weight, so anyone could sidestep a legal control by typing the piece in rather than scanning it — and a compliance guard that is optional in practice is not a guard. Custom lines are now assessed from their own typed fields and can record their own HUID, so a legitimately hallmarked custom order still bills. A catalogue line shows its tag's HUID **read-only**: it is laser-engraved by the AHC and must never be editable at the till. A custom line has no category, so the "not an article of jewellery" exemption cannot reach it — deliberate, and consistent with how a missing weight is treated.

That work also surfaced a **Rule 46 gap**: the post-checkout receipt — the copy the customer actually receives — was missing both the per-line HSN code and the HUID, because Milestones 21 and 25 had only added them to the registry detail modal. Both print views now carry both.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **501 tests passing across 21 suites** (up from 468); `npm run build` clean. Playwright-verified: an un-hallmarked 22K ring is named in a live banner while the bill is being built and refused at checkout with no invoice raised; the same piece quotes freely as an estimate; switching to *Warn only* lets the sale complete while still flagging it; and a silver ring and a gold coin, both without HUIDs, never trip the guard even in *Block* mode. Regression across 8 screens × 2 themes, all 5 Catalog tabs × 2 themes, and a 390×844 mobile pass: zero contrast failures, zero console errors.

---

## 2026-07-29 — Milestone 24: AHC Dispatch Register & HUID Assignment

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign.

HUID is a **legal** requirement, not a nicety: gold jewellery sold in India above the exemption thresholds must carry a BIS Hallmark and a unique 6-character HUID allotted by an Assaying & Hallmarking Centre. `Tag.huid` already existed and printed on the invoice, but nothing populated it except someone typing a string — there was no dispatch register, no uniqueness enforcement, and no record of what purity the AHC actually certified.

Batches now run `Draft → AtAHC → Received | PartiallyReceived`, surfaced as a fifth Catalog tab, with a per-piece outcome recorded on receipt.

**Two rules carry the weight here.**

A HUID is unique to one physical piece and **can never be reused** (PRD §11.1). Uniqueness is therefore checked globally across every tag — and *separately* within the batch being received, because two pieces received together are not persisted yet and a tag-level check alone would miss that collision. Reuse is what a substituted or diverted piece looks like in the data, so this is worth catching twice.

A failed assay is an **accountability event, not a clerical one** (PRD §11.3). The AHC certifies actual fineness, which can come back below what the piece was declared as — meaning the shop was about to sell under-karat gold and the karigar who made it owes an explanation. A shortfall beyond measurement tolerance is surfaced on the receipt form as it is typed and again as a standing banner. Over-delivery is reported too, but deliberately *not* treated as an integrity question: it is a margin leak (the shop gave away metal it did not charge for), and conflating the two would bury the one that matters.

**A missing state-machine edge had to be added.** `PendingHallmark` could only reach `Hallmarked` or `DamagedOrMelted`, so a piece that failed the purity test had nowhere legal to go except the melting pot — which would have destroyed both a rectifiable ornament and the evidence of the shortfall. It now returns to `ReceivedFromKarigar` for rework and can be re-submitted for hallmarking. It still cannot reach sellable stock directly from the AHC.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **468 tests passing across 20 suites** (up from 423); `npm run build` clean. Playwright-verified end to end: dispatch requires an AHC name and at least one piece; a malformed HUID, one colliding with an existing tag, and two identical HUIDs inside one batch are each rejected with the offending piece named; a failure recorded with no reason is refused; a 3-point purity shortfall warns live as it is typed; and on confirmation the passed pieces become `Hallmarked` carrying their HUIDs while the failed piece returns as `ReceivedFromKarigar` with none. Regression across 8 screens × 2 themes, all 5 Catalog tabs × 2 themes, and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Still open:** a piece with no HUID can still be billed. The non-hallmarked sale guard is Milestone 25, which this unblocks.

---

## 2026-07-29 — Milestone 48 (pulled forward): Metal Rate Master & Append-Only History

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign.

Built out of roadmap order, ahead of Phase 8, because it replaced a **live defect** rather than adding a missing feature — `TODO.md`'s own dependency line already said so: *"the current inline-edit behaviour violates decision D-4, so this is higher priority than its number suggests."*

The Dashboard let anyone overwrite `MetalRate.ratePerGram` in place, and that one field drives metal value on every invoice line, old-gold buyback valuation, and stock-transfer declared value (and therefore the e-Way Bill threshold). Three things were wrong simultaneously:

1. **No history.** "Why was this bill priced at ₹6,650/g?" became unanswerable the moment the rate moved — which is precisely what a disputed invoice or an audit asks for.
2. **No sanity check.** Any positive number was accepted, so typing `66500` instead of `6650` silently mispriced every subsequent sale until a human noticed. PRD §4.2 requires a deviation guard; there was none.
3. **D-4 violated.** The Rate Master is specified as append-only/event-sourced and was being `UPDATE`d. The Tax Master built in M21 already did this correctly for tax rates, so this brings metal rates into line and makes the pattern consistent across both masters. **This closes the last standing D-4 violation.**

Rates are now append-only `MetalRateVersion` rows. `effectiveFrom` is a full **timestamp** rather than a date, because gold moves intraday and two rates on the same day must still order deterministically — `resolveRateAt()` returns the rate live at any given instant, so an old invoice resolves what it was actually billed at instead of today's figure.

The fat-finger guard sits at **5%**, the outer bound of PRD §4.2's "2–5%" range, and that choice is deliberate: gold genuinely moves a few percent in a day, so a tighter default would cry wolf on real movements and train counter staff to click through the warning — worse than having no warning. Beyond the threshold a written reason is mandatory; beyond 50% the message names a misplaced decimal point specifically. It is never a **hard** block, because a real spike can happen and the shop must still be able to trade.

`MetalRate` is now **projected** from the version history rather than edited directly, mirroring how Milestone 16 made karigar balances derived rather than stored, so every existing screen consumes it unchanged. One consequence worth recording: `history24h` was previously a decorative array that shifted a value in on each edit, and is now the real recorded versions — the sparkline finally shows actual movement. Shops predating this milestone have their existing sparkline points reconstructed into an opening trail, marked `MIGRATED` so a reconstructed timestamp is never mistaken for a genuinely recorded one.

Purity derivation from the 24K base (PRD §4.2) is offered as a **suggestion, never applied**. A shop's 22K counter rate is not exactly 91.6% of its 24K rate — the seed data is 7250 and 6650 where strict derivation gives 6648 — because the quoted rate absorbs local premium and rounding. Silently overwriting a deliberately-set counter rate with arithmetic would change what customers are charged.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **423 tests passing across 19 suites** (up from 383); `npm run build` clean. Playwright-verified: a normal move records with no ceremony; `67000` entered against `6700` warns about a decimal point and is refused without a reason, leaving the rate untouched; a 7.46% move is accepted with one; a no-op that would clutter the audit trail is refused; and the history retains all ten versions including superseded rates, the recorded reason, and the migrated opening row. Regression across 8 screens × 2 themes and a 390×844 mobile pass: zero contrast failures, zero console errors.

**Still open on this module:** a rate change records a reason but requires no second person to approve it. Maker-checker depends on RBAC (M32/M45).

---

## 2026-07-29 — Phase 7 Complete: Milestones 21–23 (GST Compliance)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign; the deployed design is the approved one.

**Milestone 21 — Tax Master & HSN / CGST-SGST-IGST split.** The hardcoded `GST_RATE = 0.03` is gone. PRD §9.2 states outright that the system "MUST NOT hardcode these as immutable" — an accountant has to apply a GST Council notification the day it lands — so rates are now rows in a Tax Master with **effective-date versioning**. A change appends a new row and closes the previous one the day before it takes effect; nothing is overwritten, so reprinting a two-year-old invoice resolves the rate that actually applied on its date rather than today's. This is the same append-only principle as decision **D-4**, and the Tax Master is now a working reference implementation for the M48 Rate Master, where D-4 is still violated.

Supply type follows PRD §7.3: same state gives CGST+SGST, different gives IGST, and a walk-in with no state on file defaults to the shop's own state. That default is not a shortcut — the PRD specifies it, and it matters commercially, because treating stateless retail buyers as inter-state would misfile every counter sale.

The CGST/SGST halves are derived as `round(total/2)` and `total − cgst`, never rounded independently. Rounding both would let them sum to a rupee more than the tax on the invoice (8683 → 4342 + 4342 = 8684), and an invoice whose components do not equal its own GST total will not reconcile in GSTR-1.

Also implements PRD §7.3's **Round Off** line, which sat in the spec's formula block but was tracked in no milestone and no issue list. `grandTotal` is now rounded from the *exact* tax rather than from the rupee-rounded tax, so the round-off reported is real: PRD §17's own example lands on ₹2,98,123.20 and books −0.20.

The diamond HSN question stays open by design. HSN 7102 is seeded and resolves correctly, but `defaultHsnForLine()` bills a diamond-set ornament as one composite supply under 7113 until the `HANDOFF.md` item 1 question gets CA sign-off — reassigning it would silently halve the tax charged on every diamond sale. A unit test and an on-screen caveat both pin this down, and the engine already supports the split, so authorising it later is a data change rather than a code change.

Two GST Rule 46 defects surfaced and were fixed along the way: every invoice printed a hardcoded Mumbai GSTIN and address regardless of which branch raised it (a real multi-branch bug that M19 had left behind), and no line carried an HSN code. The gold-coin design was also classified 7113; bullion is 7108, and while the rate is identical the GSTR-1 HSN summary would have been wrong.

**Milestone 22 — e-Invoice (IRN/QR) & e-Way Bill simulation.** Simulation only, per the ground rule in `.ai/IMPLEMENTATION_WORKFLOW.md`; every surface is labelled SIMULATED and the QR payload carries a `SIMULATED` flag so it can never be mistaken for a signed one. The IRN is deterministic on the same four inputs the real portal uses (supplier GSTIN, document type, document number, financial year) and has the real 64-hex shape. Determinism is the design, not a convenience: the real IRP is idempotent per those fields, so a retry after a gateway timeout must return the same IRN instead of registering the invoice twice.

Estimates are never registered — a quotation is not a supply. Cancellation is held to PRD §9.4's 24-hour window measured from acknowledgement, and once it closes the UI points at a credit note, which the app has supported since M12. The failure path is reachable deliberately via "Simulate Gateway Failure", because an error path nobody can reproduce is an error path nobody has tested; `FAILED → PENDING` is legal (the retry queue §9.4 asks for) while `GENERATED → PENDING` is not.

The e-Way Bill completes what M20 left unfinished: M20 detected that a transfer crossed the threshold, and M22 generates the document against it, with validity of one day per 200 km per the rules and vehicle-number validation.

**Milestone 23 — GSTR-1 / GSTR-3B preview & CSV export.** GSTR-1 tables 4A, 7, 9B and 12, plus GSTR-3B 3.1(a), derived read-only from the invoice register. Three domain rules drive it, each easy to get wrong: an ESTIMATE never reaches a return; B2B vs B2C is decided by whether the buyer holds a GSTIN rather than by transaction size (misfiling a registered buyer as B2C silently denies them input credit); and credit notes, stored negative here so 3B nets automatically, are reported as **positive magnitudes** in GSTR-1's own table because the portal applies the sign — filing them negative would double-subtract them. A reconciliation banner compares the return against the register and names the difference when they disagree.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **383 tests passing across 18 suites** (up from 270); `npm run build` clean. Playwright-verified: a state-27 customer bills CGST ₹970 + SGST ₹969 while a state-29 customer bills IGST ₹3,878 and a customer with no state on file defaults to the branch state; superseding a Tax Master rate closes the old row at the day before and leaves it resolvable; an e-Invoice failure then retry yields a 64-hex IRN with a real scannable QR, and a short cancellation reason is refused; an invalid vehicle plate is rejected and a 600 km movement produces a 12-digit EBN valid three days; the exported GSTR-3B CSV totals equal the register read independently from storage (₹5,085 tax on ₹1,69,495 taxable). Full regression across 8 screens × 2 themes, the 4 Billing sub-tabs × 2 themes, and a 390×844 mobile pass: **zero contrast failures and zero console errors**.

**Bug found in browser testing that typechecking could not catch:** the e-Invoice cancellation modal is opened *from* the invoice-detail modal, but both were `z-50` and the detail overlay comes later in the DOM — so it painted on top and swallowed every click. The dialog was visible but completely dead. Fixed by stacking the child modal at `z-[60]`.

---

## 2026-07-28 — Phase 6 Complete: Milestones 19–20 (Multi-Branch)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign; the deployed design is the approved one.

**Milestone 19 — Branch Master & Branch Switcher.** Introduces a real `Branch` entity (`branchCode`, `gstin`, `stateCode`, `invoiceSeriesPrefix`, `defaultStockOwnershipType`, optional `rateOverrides`) and a header switcher, replacing the hardcoded "Mumbai BST"/"MUM-01" strings. `branchId` was added to `Tag`, `LooseStone`, `JobWork`, `SaleInvoice` and `OldGoldVoucher` — and **deliberately not** to `Customer` or `Karigar`, per decision **D-5**: branch-scoping the Party Master silently breaks both chain-wide loyalty and TCS aggregation. Legacy records predating `branchId` are attributed to the primary branch rather than disappearing from every branch's view.

This also closes `KNOWN_ISSUES.md` **#11(b)**. Invoice numbers came from a single shop-wide sequence, which GST Rule 46 does not permit: each GSTIN requires its own consecutive series. `nextBranchInvoiceNumber()` now allocates per branch prefix, from the highest existing number rather than array length, so deletions and filtering cannot cause a collision.

**Milestone 20 — Inter-Branch Stock Transfer (IBST).** Lifecycle `Draft → InTransit → Received | PartiallyReceived | Rejected`, surfaced as a fourth Catalog tab. The destination accepts or rejects **per piece** with a mandatory refusal reason; partial receipt is the realistic case, since a consignment can arrive with one piece damaged, and rejected pieces return to the source branch.

Decision **D-7** ("a tag can never be sellable at two branches simultaneously") is satisfied *structurally* rather than by convention: a dispatched Tag moves to `TransferInTransit`, which `isSellable()` returns false for, so the piece is invisible to **both** branches until accepted somewhere. There is no window in which two counters could sell the same physical ornament, and a unit test asserts `isSellable('TransferInTransit') === false` so that guarantee cannot be silently removed. Consignments are valued at metal + stones and deliberately exclude making charge, because a branch transfer is a movement of goods rather than a sale, and are flagged when they exceed the e-Way Bill threshold (PRD §9.5) — generating the actual e-Way Bill is M22 and genuinely per-state thresholds are M34.

Note that `stockTransfers` is intentionally **not** branch-scoped state: a transfer belongs to two branches at once, and the destination must be able to see it arriving.

**Root cause found for `KNOWN_ISSUES.md` #12, after three symptom-level fixes.** Dark-mode contrast had been patched three times (M6 StockAuditPanel, M13 Dashboard SVG labels, M16 Karigar ledger modal), each time by adding explicit `useTheme()` branching. The underlying reason those were necessary: this project is on Tailwind v4, where `dark:` defaults to `@media (prefers-color-scheme: dark)` — the **operating system's** setting — while `ThemeProvider` signals the theme with a `.dark` class on `<html>`. No `@custom-variant` was ever declared, so **every `dark:` utility in the codebase was decoupled from the theme toggle**: invisible to a user on a light OS even in dark mode, and wrongly applied to a user on a dark OS in light mode. One line in `index.css` binds the variant to the class and makes all of them work.

Fixing that exposed two real contrast defects that the dead utilities had been masking, both now fixed: the Job Bags hero banner rendered black-on-black in light mode (a blanket `.light .text-white → #09090B` rule assumed light text always sits on a light card, which is false for a panel deliberately dark in both themes — hence the new documented `.on-dark-panel` escape hatch), and the Karigar "Labor Charges Due" figure rendered indigo-on-black in dark mode (unlike `text-amber-*`, indigo has no global remap in `index.css`, so it must branch explicitly). The Stones status badges, authored for a dark row, were also dropping to ~1.9:1 on the white light-mode row.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **270 tests passing across 14 suites** (up from 214); `npm run build` clean. Playwright-verified end to end: dispatching two pieces from Mumbai to Pune removes them from Mumbai's sellable stock, they appear in **neither** branch's sellable list while in transit, and on partial receipt the accepted piece lands in Pune's stock while the rejected one returns to Mumbai; the e-Way Bill flag fires above ₹50,000; only the destination branch is offered the Receive action; the short-refusal-reason guard fires. Full regression across all 8 screens × both themes, plus a 390×844 mobile pass: **zero contrast failures and zero console errors**.

---

## 2026-07-27 — Phase 5 Complete: Milestones 16–18 (Karigar & Production)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. No visual redesign; all new UI is explicitly theme-aware per the `KNOWN_ISSUES.md` #12 working rule.

**Milestone 16 — Karigar Append-Only Ledger & Fine Gold Equivalent.** Fixed two defects that were both silently understating what artisans owed the shop:

1. **Wastage ignored purity entirely.** The old code computed loss as `issued − finishedWeight` in raw grams. Issue 100g of 22K, receive 95g of 18K back, and it reported a **5g** loss; in fine-gold terms that is 91.6g out against 71.25g back — a **20.35g** loss, four times larger. PRD §6.2 requires the comparison be in Fine Gold Equivalent (Gross × Purity%). `src/lib/fineGoldLedger.ts` implements it, and the receipt form now captures the *returned* purity, without which the comparison is meaningless.
2. **Balances were mutable running totals.** `Karigar.metalBalance` / `laborChargesOwed` were overwritten on every transaction, so "how did we arrive at this balance" was unanswerable (`KNOWN_ISSUES.md` #10). Balances are now **derived** by folding an append-only `KarigarLedgerEntry` list; nothing is edited or deleted. A Ledger Statement modal shows every entry with its running balance.

Decision **D-2** (Weight and Money are parallel ledgers that never net) is now enforced *structurally*: an entry carries either a `fineWeightDelta` or a `moneyDelta`, and `validateLedgerEntry()` rejects one carrying both.

**Milestone 17 — WorkOrder / Job Bag Unification.** `WorkOrder` and `JobBag` were two disconnected models describing the same real thing. The seed data proved it: `wo-1` "Mayur Peacock Gold Jhumkas" and `bag-1` were one job (same karigar, 15g, same due date), as were `wo-3` and `bag-2` — three work orders plus four job bags were really **five jobs**. Now one `JobWork` aggregate with a financial dimension (feeding the M16 ledger) and a production dimension (driving the kanban). Consequences fixed: the ledger could previously mark a job Completed while the kanban still showed it at Casting (`canReceiveFinishedGoods()` now requires genuine floor completion and blocks double-booking); `JobBag` stored only a karigar *name* with no id, which is why the screens could never be joined; two number series (`WO-`/`BAG-`) became one `JOB-` series allocated from the highest existing number rather than array length; and stage advance now goes through `canAdvanceStage()`, so Hallmark cannot be skipped.

**Milestone 18 — Wastage Cap Alerts & Scrap/Stone Return.** PRD §6.2 requires excess wastage to be "flagged for owner review (possible loss/theft indicator)"; the original code did the opposite, silently capping it away with `Math.min()`. An over-cap receipt now raises a Pending review; a banner lists the queue and names the **highest-exposure artisan, aggregated per karigar** — one over-cap job is usually a bad casting, but one artisan repeatedly topping the list is the pattern §6.2 actually wants surfaced. The owner resolves it with a mandatory note: *Shop Absorbs* appends a write-off entry clearing the excess from the balance, *Karigar Bears It* deliberately leaves the balance untouched. Also adds the Scrap & Unused Stone Return receipt, reusing StoneManager's existing Issued/In Vault states rather than inventing a parallel status.

**Bug found in browser testing that typechecking could not catch:** after the M17 rename, the karigar `<select>` *read* `karigarName` but still *wrote* `assignedKarigarName`, so choosing a karigar silently never updated state and the form could not submit. Excess-property checking does not apply through a spread, so `tsc` was clean. This is precisely the class of defect the Playwright pass exists to catch.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **214 tests passing across 12 suites** (up from 155); `npm run build` clean. Playwright-verified end to end: a 15g 22K issue received back as 12g against a 3% cap flags exactly **2.336g** excess (13.740 fine issued, 10.992 returned, 2.748 lost, 0.412 allowed); the short-note guard fires; writing off clears the banner and posts a ledger entry; an empty scrap return is rejected before a real one posts; all five seed jobs appear on both screens under identical `JOB-` numbers with no legacy `BAG-` numbers. Full regression across all 8 screens, both themes and a 390×844 mobile viewport: **zero console errors**.

---

## 2026-07-26 — Phase 4 Complete: Milestones 14–15 (Old Gold Buyback)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. Adds the Old Gold module at a new `/oldgold` route. No visual redesign — the screen reuses the app's established card/modal/filter-chip patterns and colour tokens, and is explicitly theme-aware per the working rule in `KNOWN_ISSUES.md` #12.

**Milestone 14 — Old Gold Purchase Voucher & Melt/Touch Valuation Engine.** `src/lib/oldGoldValuation.ts` implements PRD §8.2 step 4 (`Net Payable Weight = Gross × Tested Purity% × (1 − Melting Loss%)`; `Buyback Value = Net Payable Weight × Buy-back Rate`). A standalone voucher flow now supports buying old jewellery outright with no linked sale — something the billing screen's inline trade-in fields never allowed. Captures everything §8.4 requires (seller KYC, description, gross weight, tested purity, deduction %, net weight, rate, value, settlement mode, linked invoice) and shows a live customer-facing valuation breakdown before confirmation (§8.2 step 5). Purity presets cover the common Indian touch standards; a guard catches the likeliest data-entry error, a millesimal `875` typed into a percentage field. The Milestone 8 PAN threshold is enforced on buybacks too. Vouchers use their own `OGV-` series — this is a purchase, not a sale, and must never consume tax-invoice numbering (§8.3 / D-10).

**Milestone 15 — Old Gold Vault Tracking.** Lots move through an enforced lifecycle: `InSafe → SentForMelting → Melted → FineGoldStock`, plus `InSafe → ResaleAsIs` for the rare antique/investment piece retagged without melting (§8.2 step 7). Modelled as a state machine for the same reason `Tag.status` is — this is real metal in a safe. `InSafe → FineGoldStock` is deliberately not a legal shortcut, because `Melted` is where the recovered fine weight is captured; `SentForMelting → InSafe` is allowed, since refiners do return batches unmelted. The vault summary surfaces the **refining variance** (actual recovered weight vs. what the melt valuation predicted) — a persistently negative variance means the shop's melting-loss deduction is set too low and it is quietly losing metal on every buyback — alongside capital tied up in unconverted lots.

**🚨 DISCREPANCY FOUND IN THE PRD — needs client/CA confirmation.** PRD §17's worked example prints `15.000g × 0.875 × (1 − 0.03) = 12.740g` and a buyback value of ₹77,077. That arithmetic does not hold: the formula stated in §8.2 gives **12.73125g → 12.731g** and **₹77,023**. The printed 12.740g implies a tested purity of ~87.56%, not the 875 stated two lines above it. The engine implements the **formula** (§8.2 is the normative statement; §17 is an illustrative example containing a slip), and a test asserts the engine does *not* reproduce the §17 figures so a future "fix" fails loudly rather than silently reintroducing the error. This matters because the PRD describes §17 as the canonical QA reference — see `HANDOFF.md` §1a. Note the pre-existing Milestone 2 billing test still uses ₹77,077 as a *given* input, which remains valid: it never claimed to derive it.

**Rounding decision:** the 3dp-rounded net weight is what gets multiplied by the rate, not the unrounded value. This keeps the voucher internally consistent — the printed weight × printed rate must equal the printed value, or staff get challenged at the counter. (Multiplying the unrounded figure would give ₹77,024.)

**Also fixed:** my own seed voucher data initially carried the same class of arithmetic inconsistency I had just flagged in the PRD (a net weight that didn't follow from its own inputs); corrected so the seed data reconciles with the formula.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **155 tests passing across 9 suites** (up from 114); `npm run build` clean. Playwright-verified: the PRD scenario reproduces 12.731g / ₹77,023 on screen; validation gates fire; only legal lot transitions are offered at each stage; an over-gross recovery is rejected; a short recovery of 16.100g against a 16.438g estimate surfaces as −0.338g variance. Full regression across all 8 screens, both themes and a 390×844 mobile viewport: **zero console errors**.

---

## 2026-07-26 — Phase 3 Complete: Milestones 11–13, plus a Roadmap Coverage Audit

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`), roadmap, and tracking documentation. Completes Phase 3 (Billing Compliance & Correctness). No visual redesign — all new UI reuses the app's established patterns and colour tokens.

**Milestone 11 — Estimate / Quotation Mode:** a non-fiscal Estimate document type (PRD §7.8) alongside the Tax Invoice. Estimates draw from their own `EST-<year>` sequence so they never consume a GST tax-invoice number (Rule 46 requires that series to contain only real supplies), deduct no stock, collect no payment, touch no scheme balance, and skip the PAN gate. "Convert to Tax Invoice" makes staff explicitly choose between honouring the quoted rate and re-pricing at today's rate — gold moves daily, so silently picking either would be wrong — and re-applies the PAN gate at conversion, stamping the source estimate so it can't be billed twice.

**Milestone 12 — Sales Return & Credit Note:** GST credit notes against a prior invoice (CGST Act §34) with partial-return support and their own `CRN-<year>` series. `src/lib/salesReturn.ts` reverses a bill-level discount *proportionally* on a partial return — reversing the full discount would refund more than was ever collected, reversing none would refund less. Tests assert a full return nets exactly to zero against `calculateInvoiceTotals`, so the forward and reverse directions can't drift apart. Refunds against a Scheme Redemption sale credit the balance back; old gold is deliberately not unwound (separate purchase transaction, PRD §8.3/D-10).

**Milestone 13 — Dashboard Real-Data Fix:** the Monthly Sales Revenue Trend was hardcoded SVG coordinates with invented values, and the ERP Action Log was four fabricated entries. Both now derive from real state via a new, unit-tested `dashboardAnalytics.ts`. Added the Stone Vault and Metal-On-Factory-Floor KPI cards for state that had been lifted to `App.tsx` since Milestone 1 but never displayed.

**Design decision forced by Milestone 12 — `Sold` is no longer terminal.** Milestone 4 made `Sold` a terminal state, which would have meant a returned ornament could never be resold. Rather than opening `Sold` up, it now has exactly one outgoing edge to a new `Returned` state, reachable only via a credit note — so stock can never be un-sold without a fiscal document. `Returned` quarantines the piece for QC; only `Returned → InStock` makes it sellable again. `DamagedOrMelted` is now the only fully terminal state.

**Correctness issues found and fixed beyond the milestone scope:**
- Estimates and credit notes would both have corrupted revenue reporting. Every revenue figure (Dashboard "Today's Sales Revenue", "Completed Bills", the recent-invoices table, and all registry KPIs) now excludes estimates and nets credit notes.
- The estimate receipt read "Invoice Total (**Tax Invoice**)" on a document stamped "NOT A TAX INVOICE", and carried the BIS Hallmark **certification** — a false declaration on a quotation. Both fixed; the certification block is now tax-invoice-only.
- Milestone 8 gated on PAN but never recorded *which* PAN was collected, leaving no audit trail for the thing the law required. `SaleInvoice.panDeclaration` now stores it.
- Negating zero produced `-0`, which would have rendered as "-₹0" on a zero-value credit line.
- A second instance of `KNOWN_ISSUES.md` #12: SVG `fill-*` utilities aren't covered by `index.css`'s dark-mode repaint (which only remaps `text-*`), so the chart's current-month label rendered dark-on-dark.

**Roadmap coverage audit (2026-07-26):** a client-supplied module list was checked line-by-line against this roadmap and the PRD. The PRD covers every item; the roadmap did not. The original 36 milestones omitted the entire Procurement chain (PRD §6.1), the three statutory financial statements (§10.5/§14.7), manual accounting vouchers, Stock Adjustment, the Melting workflow, the Rate Master screen, User Management, Notification Center, System Health, and the ITC/HSN reports. **Roadmap extended to 53 milestones** (new Phases 12–15, M37–M53), with a Coverage Audit table in `TODO.md` recording the full mapping. Note that the Rate Master gap (M48) means rates are currently edited in place on the Dashboard, which violates decision D-4 outright.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **114 tests passing across 7 suites** (up from 76); `npm run build` clean. Each milestone individually Playwright-verified against the running app. Full regression sweep across all 7 screens, both themes, and a 390×844 mobile viewport: **zero console errors**.

---

## 2026-07-25 — Milestones 4–10 Implemented (Tagging Foundation + Billing Compliance)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. Implements `TODO.md` Milestones 4 through 10, each built, tested, and committed independently. No visual redesign — all new UI reuses the app's established card/modal/filter-chip patterns and color tokens.

**Milestone 4 — Tag Lifecycle State Machine:** `src/lib/tagStateMachine.ts` implements a pure `canTransition(from, to)` over the full 12-state lifecycle (`RawMetal → IssuedToKarigar → ReceivedFromKarigar → PendingHallmark → Hallmarked → InStock → {InShowcase, OutForJobwork, MemoOut, TransferInTransit, Sold, DamagedOrMelted}`), with `Sold`/`DamagedOrMelted` terminal. `Tag.status` is now this enum instead of a free-text 4-value union. Catalog's Tag detail modal gained a guarded "move to next status" control that only offers legal targets and rejects illegal ones with a visible error. Billing's `availableStock`/checkout and Dashboard's in-stock KPI now use `isSellable()`/`canTransition()` (Handbook D-6/D-7). 31 unit tests.

**Milestone 5 — Barcode/QR Generation:** `src/components/ui/TagCode.tsx` wraps `qrcode.react` (QR encoding the Tag/JobBag id) and `jsbarcode` (CODE128 encoding the SKU), replacing the decorative `lucide-react` icons in both Catalog's Tag Preview and JobBagManager's print tag. Also fixed a real bug found while wiring this: Catalog's "Print Tag" called `window.print()` but the sticker was never wrapped in the app's `#print-area` convention, so it printed the whole page.

**Milestone 6 — Physical Stock Audit:** new third Catalog tab. `src/lib/stockAudit.ts`'s `reconcileStockAudit()` compares a scanned tray sequence against the tags the system expects on-premises, flagging missing tags and extra/unexpected scans (unknown codes *and* real tags that shouldn't be in this tray), with a count-and-weight discrepancy report for owner sign-off. 7 unit tests.

**Milestone 7 — 🚨 Discount-Before-GST Fix:** a bill-level discount now reduces the taxable value *before* GST is computed (PRD §7.4). The previous order applied the discount post-GST against the invoice total, overstating GST on every discounted sale. `calculateInvoiceTotals()` gained an explicit `taxableValue` field, clamped at zero. Both invoice display surfaces and the POS summary panel reordered to Subtotal → Discount → GST → Invoice Total. The affected mock invoice's stored figures were corrected (tax 3191 → 3146, grandTotal 108057 → 108012).

**Milestone 8 — Mandatory PAN Verification:** `src/lib/statutoryChecks.ts` blocks checkout at/above ₹2,00,000 without a captured PAN (structural format validation only) or a Form 60 declaration (PRD §4.4/§15.3, Rule 114B). The threshold tests the tax invoice total, not the post-old-gold cash collected. A live banner in the summary panel surfaces the requirement before staff reach checkout. 9 unit tests.

**Milestone 9 — Multi-Payment Split:** `validatePaymentSplit()` allows one bill to be settled across several modes, requiring the tendered amounts to sum exactly to the amount due (PRD §7.5). Split mode is opt-in; the single-mode quick-select remains the default fast path. Scheme Redemption validation is now portion-aware — only the amount actually tendered against the scheme is validated and debited. Invoices record their full `paymentSplit`, shown as "Settled Via" on both display surfaces. 6 new unit tests.

**Milestone 10 — Manager Override + Reason Log:** `src/lib/priceOverrides.ts` detects billing lines edited away from their Tag's master values and blocks checkout until a manager reason (min. 5 chars) is logged per changed field (PRD §7.1 step 4, §15.1). Reasons persist onto the saved invoice line and render as an "Approved Price Overrides" audit block on the receipt. Custom rows with no linked Tag correctly aren't treated as overrides. 11 unit tests.

**Bug found and fixed during this work (beyond the milestone scope):** the "Goddess Lakshmi Gold Coin" design/tag pointed at a dead Unsplash URL, producing an `ERR_BLOCKED_BY_ORB` console error and a broken-image card on Catalog — replaced with a working URL. Separately, my own new Stock Audit panel initially reproduced `KNOWN_ISSUES.md` #12 exactly (unreadable gray-on-gray rows and an invisible white-on-white button in dark mode, because `index.css`'s blanket dark-mode overrides don't cover every ad hoc class combo); fixed by making that panel explicitly theme-aware via `useTheme()` rather than relying on the global override.

**Verification:** `npx tsc --noEmit` clean; `npm test` — **76 tests passing across 5 suites** (up from 10); `npm run build` clean. Each milestone was individually Playwright-verified against the running app (state transitions rejected/accepted correctly, real QR/barcode SVG geometry rendered, audit discrepancies flagged, discount-before-GST arithmetic confirmed on screen, PAN gate blocking then allowing checkout, split payment under/overpayment blocked then settled, override gate blocking then logging). A final full-app regression pass across all 7 screens, both themes, and a 390×844 mobile viewport reported **zero console errors**.

---

## 2026-07-25 — Live Deployment QA Pass (jwelleryerp.vercel.app) & Mobile Sidebar Fix

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Manual/automated QA against the production Vercel deployment, one bug fix.

**What was done:**
- Full Playwright walkthrough of the live deployment as a user: guest login, theme toggle, Catalog (both tabs), Add Tag/Add Design modals, Stones & Diamonds, Billing (line-item pull, old-gold trade-in, invoice generation, registry), Karigar & Jobwork, Job Bags, Customers & Schemes, global header search, and every "Add"/"Register"/"Issue" modal — confirmed the deployment is live and current (matches the Milestone 1-3 codebase; e.g. real `huid`/Stock Ownership fields render correctly in the Tag detail and print-preview modals).
- Specifically re-verified the two Milestone 2 GST/compliance fixes against production data: an invoice with an old-gold trade-in correctly shows GST computed on the full taxable subtotal with the old-gold value netted only against Net Amount Due; Scheme Redemption correctly blocks checkout with a visible error for a customer without an active scheme.
- 🐛 **Found and fixed:** on mobile viewports, opening the sidebar (hamburger toggle) rendered the drawer at `z-50`, fully covering the same hamburger button underneath it (`z-40`) — there was no way to close the drawer except tapping a narrow, unlabeled backdrop strip. Fixed by adding a visible `X` close button inside the mobile sidebar's header row (`src/components/Sidebar.tsx`), matching the close-button pattern already used in every modal elsewhere in the app.
- No other bugs, console errors, or broken flows found in this pass.

**Verification:** `npx tsc --noEmit` clean; `npm test` (10/10 passing); `npm run build` clean; local Playwright test at a 390×844 mobile viewport confirming the new close button dismisses the drawer, the hamburger button still reopens it, and in-app navigation still auto-closes it — zero console errors throughout.

---

## 2026-07-25 — Milestone 3 Implemented (Item Design vs. Tag Data Model & Catalog UI Split)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. Implements `TODO.md` Milestone 3, following the PRD (§5.1-5.2), the Developer Handbook (Phase 2 §2.5, Phase 3, decision D-6), and the existing Stitch UI design system (no visual redesign — new UI reuses the app's established card/modal/filter-chip patterns and color tokens).

**What was done:**
- Split `src/types.ts`'s `JewelleryItem` into two interfaces: `ItemDesign` (the design *template* — category, metal, default wastage %/making-charge/stone-type, HSN, image, active flag; never carries weight or stock status) and `Tag` (the atomic, individually-weighed, sellable physical piece — gross/net weight, stone details, `huid?: string`, `stockOwnershipType: 'OWNED' | 'GML_FINANCED' | 'CONSIGNMENT'`, status). This resolves Handbook decision D-6, previously flagged in `DECISIONS.md` and `DATABASE.md` §1.1 as not yet implemented.
- `src/data/mockData.ts`: `initialJewelleryItems` replaced with `initialItemDesigns` (8 design templates) + `initialTags` (8 physical pieces, IDs kept identical to the old `item-N` records so existing mock `SaleInvoice.items[].itemId` references still resolve).
- `App.tsx`: lifted `itemDesigns`/`setItemDesigns` and `tags`/`setTags` state (replacing `items`/`setItems`), each with its own `localStorage` key (`stitch_item_designs`, `stitch_tags`); updated every route's props accordingly.
- `CatalogManager.tsx` rebuilt with a two-tab interface — **Tag Inventory** (the existing grid/detail/tag-preview UI, now showing a Stock Ownership badge and the real `huid` field instead of a hardcoded mock string) and **Item Design Templates** (a new grid of design cards showing defaults and tagged-stock count, with its own Add Design modal). The "Add Tag" modal now requires selecting a parent Item Design, which pre-fills category/metal/wastage/making-charge/stone-type defaults onto the new tag (still fully editable). Clicking a design card jumps to the Tag Inventory tab pre-filtered to that design's tags.
- Added a Stock Ownership filter row (Owned / GML Financed / Consignment) to the Tag Inventory tab, per Handbook §1.6/D-3.
- `BillingEstimator.tsx`, `Header.tsx`, `Dashboard.tsx` updated to consume `Tag[]` (renamed from `items`/`JewelleryItem[]`) — no behavioral changes to billing math, search, or KPI calculations, since `Tag` retains every field these screens previously read.

**Explicitly not done in this milestone** (scoped to later milestones per `TODO.md`): the full Tag lifecycle state machine (`RawMetal → ... → Sold`, Milestone 4) — `Tag.status` remains the same 4-value union as before; real barcode/QR generation (Milestone 5) — the tag preview modal still shows a decorative icon, now alongside the real HUID; the three-tier Making-Charge/Wastage override hierarchy (Category Slab → Design → Transaction) is not built, only the Design-default tier exists.

**Verification:** `npx tsc --noEmit` clean; `npm test` (10/10 passing, unaffected); `npm run build` clean; Playwright smoke test (guest login → Catalog Tag Inventory tab → Item Design Templates tab → clicking a design filters Tag Inventory → adding a new Tag against a selected Design correctly auto-fills and saves → adding a new Design Template → global header search still finds live tags → Billing still pulls stock and generates a correct invoice → Dashboard KPIs still render) with zero browser console errors.

---

## 2026-07-25 — Milestone 1 & Milestone 2 Implemented (State Unification + Critical Billing Fixes)

**Author:** AI agent (Claude Code), pair programming with USER.
**Scope:** Application code (`src/`) and tracking documentation. First code milestones executed against the `TODO.md` roadmap.

**What was done — Milestone 1 (State Unification & Design System Cleanup):**
- Extracted `src/contexts/ThemeContext.tsx` (`ThemeProvider` + `useTheme()`), removing the duplicated `useState` + `MutationObserver` theme-detection block from `StoneManager.tsx`, `JobBagManager.tsx`, `BillingEstimator.tsx`, `CatalogManager.tsx`, `Sidebar.tsx`, and `Header.tsx` (`KNOWN_ISSUES.md` #14).
- Lifted `LooseStone[]` and `JobBag[]` state (with their `localStorage` sync) out of `StoneManager.tsx`/`JobBagManager.tsx` and into `App.tsx`, mirroring the existing pattern for `items`/`customers`/`karigars` (`KNOWN_ISSUES.md` #8).
- Wired live `items`/`customers`/`karigars` state into `Header.tsx`'s global search instead of static `mockData` imports (`KNOWN_ISSUES.md` #9).
- Added Vitest (`vitest.config.ts`, `npm test`).

**What was done — Milestone 2 (Critical Financial & Billing Calculation Fixes):**
- Extracted a pure, unit-tested calculation engine at `src/lib/billingCalculations.ts` (`calculateLineItem`, `calculateInvoiceTotals`, `settleOldGold`), implementing PRD §7.2/§7.3 literally.
- 🚨 Fixed Old Gold Tax Deduction (`KNOWN_ISSUES.md` #1): GST is now computed on the full taxable subtotal; old gold is applied only as a settlement credit against the final `netAmountDue`, never against the taxable base.
- 🚨 Fixed hardcoded wastage (`KNOWN_ISSUES.md` #3): each billing line now uses its own `wastagePercent` (from the item master, or a new manual input for custom rows) instead of a fixed 3.5%.
- 🚨 Fixed making-charge type handling (`KNOWN_ISSUES.md` #4): `per-gram` vs `flat` now branches correctly, and Wastage Value is computed and displayed as its own line, separate from Making Charge.
- Wired Scheme Redemption to the customer's actual `savingsSchemeBalance` (`KNOWN_ISSUES.md` #5): validates sufficient balance before checkout and deducts on success.
- Replaced array-length-derived invoice numbers with a gap-free, `localStorage`-persisted per-financial-year sequence (`KNOWN_ISSUES.md` #11).
- Added `wastagePercent`, `makingChargeType`, `makingChargeValue`, `wastageValue` to `InvoiceItem` and `netAmountDue` to `SaleInvoice` (`types.ts`); updated `mockData.ts`'s two sample invoices to the corrected math.
- Added `src/lib/billingCalculations.test.ts`, replicating the PRD §17 worked example (Metal ₹1,48,800 / Wastage ₹7,440 / Making ₹13,200 / Stone ₹1,20,000 / Taxable ₹2,89,440 / GST ₹8,683 / Invoice Total ₹2,98,123 / Net Cash Due after old-gold settlement ₹2,21,046) plus the flat-making-charge, zero-wastage, and zero-old-gold edge cases.
- Reordered both invoice display surfaces (post-checkout receipt, registry "View Bill" modal) to: Taxable Subtotal → GST → Discount → **Invoice Total (Tax Invoice)** → Old Gold Buyback (settlement only) → **Net Amount Due**.

**Explicitly not touched:** the diamond/stone HSN-split question (`HANDOFF.md` item 1) — still unresolved, still requires CA sign-off; GST remains a single flat 3% rate on the composite taxable value, matching the PRD §17 worked example.

**Verification:** `npx tsc --noEmit` clean; `npm test` (10/10 passing); `npm run build` clean; manual Playwright smoke test against the dev server (guest login → theme toggle → Stones/Job Bags pages with lifted state → global search on live data → full billing flow pulling a flat-making-charge item, old-gold trade-in, invoice generation) with zero browser console errors.

---

## 2026-07-22 — Full 14-Phase Developer Handbook Analyzed & Integrated

**Author:** AI agent (Antigravity), pair programming with USER.
**Scope:** Documentation & Project Memory.

**What was done:**
- Located and thoroughly read the complete 14-phase **Developer Implementation Handbook** in `docs/Jewellery_ERP_Developer_Handbook (1).md` (2,077 lines, 144 KB).
- Verified that all 14 phases (Phases 1 through 14) are fully drafted in detail, complete with PostgreSQL DDL schemas, domain rules, calculation formulas, async queue architectures, and QA test strategies.
- Updated `HANDOFF.md`, `CHANGELOG.md`, and project memory files across `.ai/`, `.ai_backup/`, and root directories.

---

## 2026-07-22 — Frontend Gap Analysis & 13-Milestone Development Roadmap Created

**Author:** AI agent (Antigravity), pair programming with USER.
**Scope:** Documentation & Roadmap. No application code written.

**What was done:**
- Conducted an in-depth, feature-by-feature comparison of the current React 19/TypeScript frontend prototype against the PRD (v1.0, 19 sections), Developer Handbook, and Stitch UI.
- Identified and cataloged missing frontend features across all 16 PRD modules.
- Created a 13-milestone development roadmap ordered strictly by architectural dependency.
- Populated `.ai/` and synchronized root and `.ai_backup/` documentation sets (`CURRENT_PROGRESS.md`, `MODULE_STATUS.md`, `TODO.md`, `HANDOFF.md`, `CHANGELOG.md`).

---

## 2026-07-22 — AI Development Knowledge Base Created (Initial Pass)

**Author:** AI agent (Claude), acting as Lead Software Architect.
**Scope:** Documentation initial setup.

**What was done:**
- Created initial `.ai_backup/` documentation set.
