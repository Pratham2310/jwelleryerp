# HANDOFF.md

**Read this file before doing substantive work on this project.** It captures context that isn't obvious from the code or source documents, including critical open items, document sync rules, and the current roadmap status.

> 🚨 **MANDATORY POST-TASK PROTOCOL:**
> After EVERY completed task, the active agent MUST update all 5 tracking files:
> 1. `CHANGELOG.md`
> 2. `CURRENT_PROGRESS.md`
> 3. `MODULE_STATUS.md`
> 4. `HANDOFF.md`
> 5. `TODO.md`
> 
> Both the root copies and the `.ai/` copies must be kept synchronized (`.ai_backup/` was consolidated into `.ai/` on 2026-07-25 and no longer exists as a separate folder). Never complete a task without updating them.

---

## 1a. 🚨 Open Item: PRD §17's Old-Gold Figures Don't Match PRD §8.2's Formula — Needs Confirmation

**The problem:** §8.2 step 4 states the valuation formula normatively:
`Net Payable Weight = Gross Weight × Tested Purity% × (1 − Deduction%)`.
§17's worked example applies it to 15.000g at 875 touch with 3% melting loss and prints
**12.740g / ₹77,077**. That arithmetic does not hold — the formula yields **12.73125g → 12.731g**
and **₹77,023**. The printed 12.740g implies a tested purity of ~87.56%, not the 875 stated two
lines above it in the same example.

**What was done (Milestone 14):** `src/lib/oldGoldValuation.ts` implements the **formula**, on the
reading that §8.2 is normative and §17 is an illustrative example containing an arithmetic slip.
A test in `oldGoldValuation.test.ts` explicitly asserts the engine does *not* reproduce §17's
figures, so anyone "fixing" the engine to match the PRD fails loudly instead of silently
reintroducing the error.

**Why it needs sign-off:** the PRD describes §17 as the canonical QA reference, so a tester
working from it will flag the engine as wrong. Either §17 is corrected, or the client tells us
the intended purity/deduction differs from what §8.2 says.

**Not affected:** the Milestone 2 billing tests still use ₹77,077 as a *given* settlement input.
That remains valid — they never claimed to derive it.

---

## 1. 🚨 Open Item: Diamond HSN Classification Ambiguity — Needs CA Sign-Off

**The problem:** The PRD is internally inconsistent about how diamond-studded gold jewellery should be taxed under GST.
- PRD §17 (the worked billing example, canonical QA reference) bills diamond value as part of **one composite taxable value**, taxed entirely at the ~3% jewellery GST rate.
- PRD §9.2 (the HSN/GST rate table) lists diamonds **separately** under HSN 7102 at ~1.5% (0.75% CGST + 0.75% SGST).

**Status:** Still unresolved. Requires client CA confirmation. Handbook Phase 7 / §2.8 notes this must be signed off by a Chartered Accountant before the GST Engine goes live.

**Resolution:** Get explicit confirmation from the client's Chartered Accountant. Record in `DECISIONS.md`, then drive Tax Master and Billing Engine logic accordingly.

---

## 2. 🚨 Open Item: RBAC / Statutory Parameters Sequencing

**The problem:** RBAC and a data-driven "Statutory Parameters" table (PAN threshold ₹2L, TCS threshold ₹5L) need to be built alongside Master Data (Phase 2), earlier than the Handbook TOC schedules them (Phase 12).

**Reasoning:** Master Data modules already depend on permission/threshold concepts (Party Master's PAN >= ₹2,00,000 block; Rate Master fat-finger approval).

---

## 3. Handbook Completeness Status: ✅ All 14 Phases Complete

The full 14-phase **Developer Implementation Handbook** (`docs/Jewellery_ERP_Developer_Handbook (1).md`, 2,077 lines) has been read and analyzed in full. It covers:
- **Phase 1:** Business Primer, Weight/Money Dual Ledgers, GML/Consignment Stock, BUIDS Act compliance.
- **Phase 2:** Master Data Architecture (Metal Master, Rate Master append-only DDL, Item/Design Master, Party Master tenant-wide, MC/Wastage 3-tier hierarchy, Stone Rate Master, Tax Master, Branch Master).
- **Phase 3:** Inventory & Tagging (Atomic Tag Model DDL, State Machine transitions, HUID Laser-engraving, At-cost vs At-market valuation).
- **Phase 4:** Procurement & Karigar Management (Procurement DDL, GML drawdown ledger, Karigar Fine Gold Equivalent dual-ledger, Scrap return, Melting loop).
- **Phase 5:** Billing / POS Calculation Engine (Pure stateless calculation function DDL & logic, PRD §17 worked example, line item breakdown, multi-tender split).
- **Phase 6:** Old Gold Exchange Buyback (Old Gold DDL, Purity touch testing, melting deduction %, payment-stage netting, separate purchase voucher).
- **Phase 7:** GST Compliance Engine (e-Invoice IRN/QR code DDL & async queue, e-Way Bill auto-trigger, GSTR-1/3B summary tables, Reverse Charge).
- **Phase 8:** Accounting Engine (Auto-posted double-entry journal vouchers behind every event DDL, Chart of Accounts, Tally Prime XML export).
- **Phase 9:** BIS Hallmarking & HUID Compliance (AHC batch dispatch/receipt DDL, 6-digit HUID tag assignment, non-hallmarked sale block).
- **Phase 10:** Gold Savings Schemes (Swarna Nidhi) (Scheme DDL, monthly installments, bonus calculation, BUIDS Act legal cash refund hard block).
- **Phase 11:** CRM, Loyalty, Reports & Dashboards (Customer 360, WhatsApp rate alerts, real-time Owner Dashboard, Stock Ageing, Karigar Reconciliation).
- **Phase 12:** Security, RBAC & Statutory Hooks (Admin roles DDL, permission matrices, Statutory Parameters table for PAN/TCS/PMLA thresholds, Audit Trail).
- **Phase 13:** System Architecture & Multi-Tenant SaaS Design (Layered SaaS architecture, Postgres schema, Redis caching, offline sync).
- **Phase 14:** QA / Test Strategy & Canonical Worked Example (PRD §17 worked example test suite + 11 edge case test variants, Top-10 developer mistakes).

---

## 4. Development Roadmap & Execution Status

- **Completed so far:** Full codebase analysis, full PRD & complete 14-phase Developer Handbook reading, gap analysis, and a 34-milestone development roadmap in `TODO.md` (restructured 2026-07-25 from the original 13 into single-feature, independently-testable milestones — see `TODO.md`'s header note).
- **✅ Done (2026-07-25): Milestone 1 — State Unification & Design System Cleanup.** `ThemeContext`/`useTheme()` extracted; `LooseStone[]`/`JobBag[]` lifted to `App.tsx`; `Header.tsx` search wired to live state; Vitest configured. See `CHANGELOG.md` and `KNOWN_ISSUES.md` #8, #9, #14.
- **✅ Done (2026-07-25): Milestone 2 — Critical Financial & Billing Calculation Fixes.** Old-gold/GST base bug, hardcoded wastage, making-charge type branching, Scheme Redemption wiring, and invoice numbering all fixed in a new `src/lib/billingCalculations.ts` engine, unit-tested against the PRD §17 worked example. See `CHANGELOG.md` and `KNOWN_ISSUES.md` #1, #3, #4, #5, #11.
- **✅ Done (2026-07-25): Milestone 3 — Item Design vs. Tag Data Model & Catalog UI Split.** `JewelleryItem` split into `ItemDesign` (template) + `Tag` (physical piece, with real `huid` and `stockOwnershipType` fields); `CatalogManager.tsx` rebuilt with Tag Inventory / Item Design Templates tabs. Resolves Handbook decision D-6. See `CHANGELOG.md`.
- **✅ Done (2026-07-25): Milestones 4–10.** Phase 2 (Tagging Foundation) and Phase 3's first four billing-compliance milestones are complete — Tag lifecycle state machine, real barcode/QR generation, Stock Audit UI, discount-before-GST fix, PAN verification gate, multi-payment split, and the manager override reason log. Test suite grew from 10 to **76 passing tests across 5 suites**. See `CHANGELOG.md` for the full per-milestone detail.
- **✅ Done (2026-07-26): Milestones 11–13 — Phase 3 complete.** Estimate/Quotation mode, Sales Return & Credit Note, and the Dashboard real-data fix. Test suite now **114 passing across 7 suites**. See `CHANGELOG.md`.
- **✅ Done (2026-07-26): Roadmap coverage audit.** A client module list was checked against the PRD and this roadmap; the PRD covered everything, the roadmap didn't. **Extended to 53 milestones** (Phases 12–15, M37–M53) covering Procurement, financial statements, accounting vouchers, Stock Adjustment, Melting, Rate Master, User Management, Notification Center, System Health and the ITC/HSN reports. Full mapping is in `TODO.md`'s Coverage Audit table.
- **✅ Done (2026-07-26): Milestones 14–15 — Phase 4 complete.** Old Gold Buyback at `/oldgold`: melt/touch valuation engine (PRD §8.2), standalone purchase voucher with its own `OGV-` series, and an enforced vault lifecycle with refining-variance tracking. Surfaced a genuine arithmetic error in PRD §17 — see §1a above. Test suite now **155 passing across 9 suites**.
- **✅ Done (2026-07-27): Milestones 16–18 — Phase 5 complete.** Karigar append-only ledger + Fine Gold Equivalent engine, WorkOrder/JobBag unification into one `JobWork` aggregate, and the excess-wastage review workflow with scrap/stone returns. Closes `KNOWN_ISSUES.md` #10. Test suite now **214 passing across 12 suites**.
- **✅ Done (2026-07-28): Milestones 19–20 — Phase 6 complete.** Branch Master + header branch switcher, and Inter-Branch Stock Transfer with per-piece accept/reject. Closes `KNOWN_ISSUES.md` #11(b) (per-GSTIN invoice series, GST Rule 46) and finds the **root cause** of #12 after three symptom fixes. Test suite now **270 passing across 14 suites**.
- **✅ Done (2026-07-29): Milestones 21–23 — Phase 7 complete.** Tax Master with effective-dated HSN rates, CGST/SGST vs IGST determination and PRD §7.3's Round Off; simulated e-Invoice IRN/QR and e-Way Bill; GSTR-1/GSTR-3B previews with CSV export. Test suite now **383 passing across 18 suites**.
- **✅ Done (2026-07-29): Milestone 48 — Metal Rate Master, pulled forward out of Phase 15.** Append-only rate history with a timestamped resolver, the PRD §4.2 fat-finger guard, and 24K purity derivation as a suggestion. **This closes the last standing D-4 violation** — both masters (tax and metal rate) are now append-only. Test suite now **423 passing across 19 suites**.
- **✅ Done (2026-07-29): Milestone 24 — AHC dispatch register & HUID assignment.** Real batch dispatch/receipt, globally-unique HUID enforcement, certified-purity variance with karigar accountability, and a new `PendingHallmark → ReceivedFromKarigar` state-machine edge so a failed assay is reworked rather than melted. Test suite now **468 passing across 20 suites**.
- **✅ Done (2026-07-29): Milestone 25 — Non-hallmarked sale prevention guard.** Configurable block/warn/off gate with the §11.3 exemptions (metal, category, weight, shop turnover), a live banner while billing, and detection kept separate from enforcement. Test suite now **501 passing across 21 suites**. **Phase 9's BIS hallmarking pair is complete.**
- **✅ Done (2026-07-29): Milestones 26–27 — Gold Savings Schemes.** Scheme master, enrolments, instalment receipts, derived balances, printable passbook and the BUIDS Act cash-refund notice. **Phase 8 is complete.** Test suite now **556 passing across 22 suites**.
- **✅ Done (2026-07-30): Money & weight arithmetic foundation.** `src/lib/money.ts` (integer paisa / milligrams, plus `allocate()`), and a real discount leak it exposed in successive partial returns. Test suite now **586 passing across 22 suites**.
- **✅ Done (2026-07-30): Milestone 28 — Accounting ledgers & auto-journal posting.** Derived double-entry vouchers behind every document, with Day Book, Trial Balance, Ledger Statement and Chart of Accounts. Test suite now **631 passing across 23 suites**.
- **✅ Done (2026-08-01): Milestones 37–41 — Phase 12 (Procurement) complete.** Supplier Master, Purchase Order, Goods Receipt, Purchase Invoice with ITC, and Purchase Return. The app can now buy stock, and GST has an input side as well as an output one. Test suite now **813 passing across 28 suites**.
- **✅ Done (2026-08-01): Milestone 29 — Tally Prime export. Phase 9 complete.** Client-side XML only. Test suite now **849 passing across 29 suites**.
- **✅ Done (2026-08-01): Milestones 45–47 — Phase 14 complete.** Manual Payment/Receipt/Contra vouchers, Cash Book, P&L and Balance Sheet. Accounting is now complete end to end. Test suite now **888 passing across 30 suites**.
- **✅ Done (2026-08-01): Milestone 32 — Roles & permissions.** Permission matrix, navigation and route gating, role CRUD, and a role picker at login. Test suite now **926 passing across 31 suites**.
- **✅ Done (2026-08-01): Milestones 30–31 — Phase 10 complete.** Reports Hub with six families and live reconciliation checks, plus the Customer 360 drawer. Test suite now **959 passing across 32 suites**.
- **Phase 13 is complete (2026-08-03).** M42–M44 shipped on one Inventory Ops screen. Three rules worth carrying forward: a write-off **never deletes** the tag (erasing the piece erases the loss); ITC reversal is **per reason**, since a book correction destroyed nothing and reversing there costs the shop money it is owed; and a melt **cannot recover more than went in**, with loss derived rather than typed so a batch reconciles by construction.
- **The roadmap is COMPLETE as of 2026-08-09 — 61 of 61 milestones, plus M62.** Phase 16 (M54–M61) added the eight full-product gaps found when planning the SaaS: repairs, customer orders, memo-out, credit and receivables, salesperson incentives, loyalty, e-Invoice GSP shape and outbound messaging. There is no "next milestone". **M62 (2026-08-09)** then closed the gap between the role model designed for the SaaS and the one actually built: the Salesperson and Auditor roles, and the `approvals.grant` / `catalog.view.network` permissions. **The next work is the backend, not another screen.**
- **`can(role, permission)` still has no branch dimension.** A Pune manager and a Mumbai manager are indistinguishable to it. This is deliberate and is backend work — it changes the user schema and every repository query, and a browser holding one branch switcher cannot exercise it. Do not retrofit it in the frontend; see `.ai/BACKEND_ARCHITECTURE.md`.
- **M60 and M61 are deliberately still simulated** — no GSP credentials, no WhatsApp BSP, no DLT registration, because all three need a server. Their *shapes* are production-correct, so wiring real providers is configuration rather than a rewrite. Do not describe them as integrated.
- **The backend plan now exists: see `.ai/BACKEND_ARCHITECTURE.md`** (stack decisions are D-12/D-13/D-14 in `DECISIONS.md`). Node + TypeScript + NestJS + PostgreSQL + Drizzle, tenant isolation by Row-Level Security, identity bought from Clerk and authorization kept in our own database. The frontend's `src/lib` becomes `packages/domain` verbatim — it is already framework-free.
- **What genuinely comes next is the backend.** Every permission check, statutory gate, supervisor approval and audit trail in this app **gates the interface, not the data** — there is no server, so none of it stops a determined actor. Each one has to be re-asserted server-side when a server exists; `permissions.ts`, `statutoryParameters.ts` and `users.ts` all say so in their headers. Related: all data lives in one browser profile, which System Health (M51) reports as CRITICAL until a backup is exported.
- **Known gaps that were never roadmap milestones:** the Stone Rate master; a full Audit Log viewer (M50's event store records events as they happen, but holds only recent activity in this browser — a notification feed, not a complete trail); and the diamond/stone HSN-split question in item 1a below, still awaiting CA sign-off.
- **Phase 11 is complete (2026-08-01).** M35 and M36 were both built past their "simulated" label, because in each the interesting half is a domain rule: a scale reading cannot be captured until it settles, and an offline sale's *invoice number* — not its storage — is what breaks on reconnect (Rule 46 requires a unique consecutive series). A queued sale is never dropped; a collision is resolved by renumbering with the original number kept on the record.
- **Just landed (2026-08-01): M33–M34.** Supervisor approval is deliberately *not* a permission — M32 answers "may this person do it", M33 answers "was it authorised this time". Self-approval is refused, an approval only covers the amount it was given for, and only roles holding `billing.override` can be named as supervisors. Statutory thresholds (PAN/TCS/PMLA) now live in `localStorage` and fall back to the statutory default rather than to zero — zero would demand a PAN on every sale and stop the shop trading.

### Notes for whoever picks this up

- **A HUID is unique to one piece, forever.** Enforce it globally across all tags AND within the batch being received (`src/lib/hallmarking.ts`) — pieces in an unsaved batch are not on any tag yet, so a tag-level check alone misses that collision. Reuse is what a substituted piece looks like in the data.
- **The hallmark sale guard is configurable BY DESIGN, and detection is separate from enforcement.** PRD §11.3 requires block-vs-warn because mandatory hallmarking is a gold-only regime with real carve-outs (silver is voluntary, coins are not jewellery, sub-2g is exempt, small shops are exempt). Never turn it into an unconditional block. And always compute violations regardless of mode — a WARN-mode shop must still be able to report its exposure, not appear clean.
- **Compliance guards must cover the manual path too.** The billing desk has a one-click "Add Custom Item Row" that defaults to Gold (22K). Any control keyed off a `Tag` will be silently bypassable there unless it also assesses the typed line — this already bit the hallmark guard once. A tag-derived value shown on such a line (a HUID, a certificate number) must be **read-only**: it comes from an external authority, not the till.
- **A missing weight is not a light piece.** `netWeight` of 0 means "not captured", so it must never earn the sub-threshold hallmarking exemption. The same reasoning applies anywhere else absent data could be read as a qualifying value.
- **A failed assay is an accountability event, not a data-entry outcome.** Certified purity below declared means the shop was about to sell under-karat gold; surface it against the karigar. Over-delivery is a margin leak and is deliberately NOT flagged for review — conflating the two buries the serious one.
- **Every status change to a `Tag` must go through `canTransition()`** (`src/lib/tagStateMachine.ts`). Do not assign `tag.status` directly anywhere — the whole point of Milestone 4 is that the lifecycle is enforced rather than advisory (Handbook D-6/D-7). Note `Sold → Returned` is the *only* way out of `Sold` (added in Milestone 12), so stock can never be un-sold without a credit note; `DamagedOrMelted` is the only fully terminal state.
- **Documents are typed, and revenue must respect the type.** `SaleInvoice.invoiceType` is now `ESTIMATE | TAX_INVOICE | CREDIT_NOTE`. Any new figure that sums invoices must exclude estimates (non-fiscal) and include credit notes (which carry negative values, giving net-of-returns automatically). Getting this wrong silently corrupts reported revenue — it was caught twice during Phase 3.
- **Each fiscal document type has its own number series** (`INV-`, `EST-`, `CRN-`, and later `PO-`/`DBN-`). Never let one consume another's sequence — GST Rule 46/53 requires each to be independently consecutive.
- **`dark:` utilities work now — as of Milestone 20, and not before.** This is Tailwind v4, where `dark:` defaults to the *operating system's* `prefers-color-scheme` rather than the `.dark` class `ThemeProvider` sets, so every `dark:` utility written before 2026-07-28 was dead. `index.css` now declares `@custom-variant dark (&:where(.dark, .dark *))`. Two traps in the `!important` repaint layer survive (`KNOWN_ISSUES.md` #12): a blanket `.light .text-white → #09090B` breaks any panel deliberately dark in *both* themes — mark those `.on-dark-panel` — and colour families are remapped inconsistently (`text-amber-*` is forced to brand gold, indigo and emerald are not remapped at all). When in doubt, verify the rendered colour in a browser rather than reading the class name.
- **Branch scoping is deliberate, not uniform.** Stock-like records (`Tag`, `LooseStone`, `JobWork`, `SaleInvoice`, `OldGoldVoucher`) carry `branchId`; `Customer` and `Karigar` must **never** be branch-scoped (decision **D-5** — it breaks chain-wide loyalty and TCS aggregation). `StockTransfer` is also deliberately unscoped, because a transfer belongs to two branches at once and the destination has to see it arriving. Records predating `branchId` fall back to the primary branch instead of vanishing.
- **A tag in transit must stay unsellable.** `TransferInTransit` is excluded from `isSellable()`, which is the *entire* mechanism enforcing D-7 ("a tag can never be sellable at two branches simultaneously"). A test in `stockTransfer.test.ts` asserts this directly; if it ever fails, two counters can sell the same physical ornament.
- **Karigar balances are DERIVED, never stored.** Fold the append-only ledger with `deriveKarigarBalance()`; never read `Karigar.metalBalance`/`laborChargesOwed` (kept only for legacy seed compatibility). Weight and money entries must never be combined in one entry — `validateLedgerEntry()` enforces D-2.
- **Compare metal in Fine Gold Equivalent, never raw grams.** Different purities are not comparable; `fineGoldEquivalent()` exists for this and skipping it understates losses badly (see the Milestone 16 entry in `CHANGELOG.md`).
- **`WorkOrder` and `JobBag` no longer exist as separate models.** There is one `JobWork` record with a financial and a production dimension; both screens are views of it. `WorkOrder` remains in `types.ts` marked `@deprecated` for reference only.
- **The billing calculation engine is the single source of truth** (`src/lib/billingCalculations.ts`, Handbook D-9). Estimate mode, Sales Return (M12), and Old Gold (M14) must all call it rather than re-deriving any formula.
- **The books are DERIVED, never stored.** `deriveJournal()` rebuilds every voucher from the invoices, old-gold vouchers, scheme receipts and karigar ledger. Never persist a voucher or let one be hand-edited — the moment the accounts stop being a projection of the documents, they can disagree with them and there is no way to tell which is right.
- **Three postings that are easy to get wrong, and expensive.** Old gold posts its own purchase voucher and must never contra Sales (D-10, or output GST is understated again). A scheme instalment credits a LIABILITY, not income (PRD §12.3, or you book unearned revenue). A weight-only karigar entry posts NOTHING (D-2, or weight and money net).
- **A report is only as honest as its document filter.** Revenue must EXCLUDE estimates (a quotation is not a supply) and INCLUDE credit notes (they carry negative figures, which is what nets returns automatically). `fiscalDocuments()` in `src/lib/reports.ts` is the single place this is decided — use it rather than re-filtering by hand.
- **Absent data must never be reported as the flattering case.** An undated tag is *unknown age*, not *new*, or inventory ageing shows zero old stock and hides the capital it exists to find. The same reasoning already applies to a missing weight in the hallmark guard.
- **RBAC gates the interface, not the data — and that is written on the screen.** There is no backend, so `localStorage` is rewritable by anyone with a console. Do not let this be mistaken for security, and re-assert every check server-side when a backend lands; the permission names are designed to port unchanged. Two rules inside it must not be relaxed: an **unknown role gets nothing** (defaulting to full access is how a permission system silently stops working), and **at least one role must keep `admin.roles`** or the shop is permanently locked out of its own permission screen.
- **The Balance Sheet balances only because the P&L is carried into it.** Every voucher balances, so `Assets − Liabilities = Income − Expenses = Net Profit`. If a Balance Sheet ever shows out, it is almost certainly a missing account in the chart rather than a wrong posting — do NOT plug the difference. Note also that the P&L is **periodic** and the Balance Sheet **cumulative**; using the same window for both makes retained earnings drop every prior period.
- **A Contra must never touch income or expense.** Both legs are cash or bank. It is enforced in `validateManualVoucher()`, and relaxing it would let a transfer that changed nothing create profit.
- **Tally's sign convention is inverted from ours.** In the export a DEBIT is a NEGATIVE `<AMOUNT>` with `ISDEEMEDPOSITIVE=Yes`. Reversing it produces a file that imports cleanly and mirrors every account, so it fails silently at the accountant's desk rather than at ours. Dates are `YYYYMMDD`, and every ledger name must go through `escapeXml()` — one raw `&` voids the whole import.
- **A GSTIN encodes the state code and the PAN.** Chars 1–2 and 3–12 respectively. Never let a typed state code disagree with it — M21 picks CGST+SGST vs IGST from that field, so a mistype misfiles tax on every document for the party and stays invisible until filing. `validatePartyIdentity()` checks it; `deriveIdentityFromGstin()` fills it.
- **Reverse charge posts TWO legs.** An output liability AND an input credit, netting to zero in cash. Recording only the credit leaves the books balanced while the shop under-declares tax it owes. Never add the RCM liability into a claimable-ITC total — one is owed BY the shop, the other TO it.
- **An unfixed-rate purchase has no value, not a zero value.** `poValue()` returns `null`. Anything summing purchase commitments must handle that explicitly rather than coercing it to 0.
- **Purchased finished goods must not enter at `InStock`.** They land at `PendingHallmark` unless the supplier already engraved a HUID, or they bypass the M25 hallmarking guard entirely.
- **Use `src/lib/money.ts` for anything that sums a list or splits a total.** Money is integer paisa, weight integer milligrams. `allocate()` guarantees the parts sum to the whole — rounding each share independently does not, and that already cost a rupee off a discount reversal. Never compare two computed amounts with `===`; use `moneyEquals()`. A single multiply-then-round is still fine, so this is not a mandate to rewrite every number.
- **Scheme balances are derived, and there is no cash-out on purpose.** Fold `SchemeInstalment[]`; never store a balance. The absence of any refund-to-cash path is a legal position (BUIDS Act 2019 — collections are advances against goods, not deposits), not an unimplemented feature. Premature closure returns *jewellery credit*. Say so via `CASH_REFUND_BLOCK_NOTICE` rather than rewording it per screen.
- **A scheme bonus is earned, not granted.** It accrues only when matured AND fully paid. Relaxing either condition lets a customer collect the shop's contribution after one instalment, and overstates the liability figure PRD §12.4 puts on the balance sheet.
- **Rates of every kind are append-only, and both masters now prove it.** Metal rates live in `MetalRateVersion[]` (`src/lib/rateMaster.ts`) and tax rates in the Tax Master (`src/lib/taxMaster.ts`). Never write a rate in place — append a version and let the current value be *projected* from history. `MetalRate.ratePerGram` is a derived view now; `projectCurrentRates()` is its only writer. Resolve a historical rate with `resolveRateAt(metal, versions, isoTimestamp)`, not by reading today's figure.
- **The fat-finger guard is intentionally 5%, and intentionally not a hard block.** Gold moves a few percent daily, so a tighter threshold would train staff to dismiss the warning; and a genuine spike must still be recordable, with a reason. Don't "tighten" it to 2% or convert it into a block without that context.
- **GST rates are DATA, never a constant.** They live in the Tax Master with effective-date versioning (`src/lib/taxMaster.ts`), because PRD §9.2 requires an accountant to be able to apply a notification immediately and because reprinting an old invoice must resolve the rate that applied on *its* date. Never reintroduce a hardcoded rate; resolve it with `resolveGstRatePercent(hsn, rates, invoiceDate)`.
- **CGST and SGST must sum to the tax charged, exactly.** They are derived as `round(total/2)` and `total − cgst`, never rounded independently — otherwise the halves can total a rupee more than the invoice's own GST and GSTR-1 will not reconcile. The same rule applies anywhere else a tax is split.
- **Diamonds are still billed at the composite jewellery rate (HSN 7113).** HSN 7102 exists in the Tax Master and resolves, but nothing is assigned to it pending the CA sign-off in §1 above. Reassigning it would halve the tax on every diamond sale — do not "fix" this without that decision.
- **An ESTIMATE is never a supply.** It gets no IRN and never appears in a GST return. Anything new that touches statutory output must filter on `invoiceType`, the same way revenue reporting already does.
- **Credit notes are stored negative but reported positive in GSTR-1.** The negative storage is what makes net-of-returns sums work (M12, and GSTR-3B relies on it); GSTR-1 asks how much was credited and the portal applies the sign, so its own table uses magnitudes. Both come from the same records — see `src/lib/gstReturns.ts`.
- **e-Invoice/e-Way Bill are simulated by design**, not unfinished. See the ground rule in `.ai/IMPLEMENTATION_WORKFLOW.md`. Keep the SIMULATED markings; the IRN is deliberately deterministic so a retry cannot double-register a document, mirroring the real portal's idempotency.

---

## 5. General Handoff Notes

- The frontend prototype (`stitch-jewellery-erp`) and domain design documents (PRD / 14-Phase Handbook) are aligned across the 13 milestones in `TODO.md`.
- Always check `KNOWN_ISSUES.md` and `CODING_RULES.md` before touching calculation logic in `BillingEstimator.tsx`.
