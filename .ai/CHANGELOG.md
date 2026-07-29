# CHANGELOG.md

Dated log of changes to the project, covering both documentation and code. Newest entries at the top. This log covers the documentation knowledge base as well as the underlying project — any agent making a non-trivial change to code or domain decisions should add an entry here.

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
