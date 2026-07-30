/**
 * Double-entry accounting: Chart of Accounts and auto-posted journal vouchers
 * (PRD §10, Handbook Phase 8, Milestone 28).
 *
 * PRD §10.1: the books must be correct "without manual journal entries". So nothing here is
 * hand-posted — every voucher is *derived* from a business document that already exists. That
 * makes the accounts a projection of the transaction log rather than a second set of records
 * that can drift from it, which is the same principle as derived karigar balances (M16), derived
 * metal rates (M48) and derived scheme balances (M26).
 *
 * ─── Three domain rules the postings must not violate ─────────────────────────────────
 *
 * 1. **Old gold is a purchase, not a discount** (decision D-10). It gets its own voucher —
 *    `Dr Old Gold Purchase / Cr Cash` — and never touches the sale's taxable value. Netting it
 *    into the sale would understate output GST, which is the bug Milestone 2 fixed; posting it
 *    as a contra-sale here would quietly reintroduce it in the ledgers.
 *
 * 2. **Scheme collections are a liability, not income** (PRD §12.3). A customer paying an
 *    instalment has bought nothing yet. Revenue arises only when jewellery is actually sold, so
 *    an instalment posts `Dr Cash / Cr Scheme Collection Liability`. Booking it as income would
 *    recognise revenue that has not been earned and inflate both the P&L and the tax due on it.
 *
 * 3. **Weight never enters the money books** (decision D-2). "Karigar Metal Payable" appears in
 *    PRD §10.2's chart as a *grams-tracked memo* account. It is deliberately NOT posted here:
 *    valuing an artisan's outstanding metal into rupees would net the two ledgers, which is
 *    exactly what D-2 forbids. Metal stays in the karigar weight ledger; only labour money is
 *    posted. See `fineGoldLedger.ts`.
 */

import type { SaleInvoice, OldGoldVoucher, SchemeInstalment, KarigarLedgerEntry } from '../types';
import { sumMoney, moneyEquals, roundMoney } from './money';

/* ─────────────────────────── Chart of Accounts (PRD §10.2) ─────────────────────────── */

export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';

export interface LedgerAccount {
  code: string;
  name: string;
  type: AccountType;
  group: string;
}

/**
 * Which side increases the account. Assets and expenses are debit-natured; liabilities and
 * income are credit-natured. This is what lets a Trial Balance decide the column a balance
 * belongs in without a hardcoded list per account.
 */
export function normalBalanceOf(type: AccountType): 'DEBIT' | 'CREDIT' {
  return type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT';
}

export const CHART_OF_ACCOUNTS: LedgerAccount[] = [
  // Assets
  { code: '1100', name: 'Cash-in-Hand', type: 'ASSET', group: 'Current Assets' },
  { code: '1110', name: 'Bank Accounts', type: 'ASSET', group: 'Current Assets' },
  { code: '1200', name: 'Sundry Debtors', type: 'ASSET', group: 'Current Assets' },
  { code: '1300', name: 'Stock-in-Hand — Finished Goods', type: 'ASSET', group: 'Inventory' },
  { code: '1310', name: 'Stock-in-Hand — Raw Metal', type: 'ASSET', group: 'Inventory' },
  { code: '1320', name: 'Stock-in-Hand — Stones', type: 'ASSET', group: 'Inventory' },
  { code: '1400', name: 'Input CGST Receivable', type: 'ASSET', group: 'Duties & Taxes' },
  { code: '1410', name: 'Input SGST Receivable', type: 'ASSET', group: 'Duties & Taxes' },
  { code: '1420', name: 'Input IGST Receivable', type: 'ASSET', group: 'Duties & Taxes' },
  { code: '1430', name: 'TCS Receivable', type: 'ASSET', group: 'Duties & Taxes' },

  // Liabilities
  { code: '2100', name: 'Sundry Creditors', type: 'LIABILITY', group: 'Current Liabilities' },
  { code: '2200', name: 'Output CGST Payable', type: 'LIABILITY', group: 'Duties & Taxes' },
  { code: '2210', name: 'Output SGST Payable', type: 'LIABILITY', group: 'Duties & Taxes' },
  { code: '2220', name: 'Output IGST Payable', type: 'LIABILITY', group: 'Duties & Taxes' },
  { code: '2230', name: 'TCS Payable', type: 'LIABILITY', group: 'Duties & Taxes' },
  { code: '2300', name: 'Karigar Labour Payable', type: 'LIABILITY', group: 'Current Liabilities' },
  { code: '2400', name: 'Customer Advance', type: 'LIABILITY', group: 'Current Liabilities' },
  { code: '2410', name: 'Scheme Collection Liability', type: 'LIABILITY', group: 'Current Liabilities' },

  // Income
  { code: '3100', name: 'Gold Sales', type: 'INCOME', group: 'Sales' },
  { code: '3110', name: 'Silver Sales', type: 'INCOME', group: 'Sales' },
  { code: '3120', name: 'Diamond & Stone Sales', type: 'INCOME', group: 'Sales' },
  { code: '3130', name: 'Making Charges Income', type: 'INCOME', group: 'Sales' },

  // Expenses
  { code: '4100', name: 'Metal Purchase', type: 'EXPENSE', group: 'Purchases' },
  { code: '4110', name: 'Old Gold Purchase', type: 'EXPENSE', group: 'Purchases' },
  { code: '4120', name: 'Diamond & Stone Purchase', type: 'EXPENSE', group: 'Purchases' },
  { code: '4200', name: 'Making Charges Expense', type: 'EXPENSE', group: 'Direct Expenses' },
  { code: '4300', name: 'Discount Given', type: 'EXPENSE', group: 'Indirect Expenses' },
  { code: '4400', name: 'Round Off', type: 'EXPENSE', group: 'Indirect Expenses' },
];

export const ACCOUNT: Record<string, string> = {
  CASH: '1100',
  BANK: '1110',
  DEBTORS: '1200',
  OUTPUT_CGST: '2200',
  OUTPUT_SGST: '2210',
  OUTPUT_IGST: '2220',
  KARIGAR_LABOUR_PAYABLE: '2300',
  SCHEME_LIABILITY: '2410',
  GOLD_SALES: '3100',
  OLD_GOLD_PURCHASE: '4110',
  MAKING_CHARGES_EXPENSE: '4200',
  DISCOUNT_GIVEN: '4300',
  ROUND_OFF: '4400',
};

export function accountByCode(code: string): LedgerAccount | undefined {
  return CHART_OF_ACCOUNTS.find(a => a.code === code);
}

export function accountName(code: string): string {
  return accountByCode(code)?.name ?? `Unmapped account ${code}`;
}

/* ─────────────────────────── Vouchers ─────────────────────────── */

export type VoucherType =
  | 'SALES'
  | 'CREDIT_NOTE'
  | 'OLD_GOLD_PURCHASE'
  | 'KARIGAR_LABOUR'
  | 'KARIGAR_PAYMENT'
  | 'SCHEME_COLLECTION';

export interface JournalLine {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface JournalVoucher {
  id: string;
  voucherNo: string;
  date: string;
  type: VoucherType;
  narration: string;
  /** What this voucher was derived from, so every figure traces back to its document. */
  sourceType: string;
  sourceId: string;
  lines: JournalLine[];
  branchId?: string;
}

/** Σdebit must equal Σcredit. Compared in paisa — `===` on two float sums is not reliable. */
export function isBalanced(voucher: JournalVoucher): boolean {
  return moneyEquals(
    sumMoney(voucher.lines.map(l => l.debit)),
    sumMoney(voucher.lines.map(l => l.credit))
  );
}

export function voucherTotal(voucher: JournalVoucher): number {
  return sumMoney(voucher.lines.map(l => l.debit));
}

/** Drops lines that move nothing — a zero-value row is noise in a ledger, not information. */
function compact(lines: JournalLine[]): JournalLine[] {
  return lines.filter(l => !moneyEquals(l.debit, 0) || !moneyEquals(l.credit, 0));
}

const dr = (accountCode: string, amount: number): JournalLine =>
  ({ accountCode, debit: roundMoney(amount), credit: 0 });
const cr = (accountCode: string, amount: number): JournalLine =>
  ({ accountCode, debit: 0, credit: roundMoney(amount) });

/**
 * A negative amount on the wrong side is not an error — a round-off can go either way, and a
 * credit note reverses every sign. This puts a signed figure on whichever side it belongs.
 */
function signed(accountCode: string, amount: number, naturalSide: 'DEBIT' | 'CREDIT'): JournalLine {
  const value = roundMoney(amount);
  const onNatural = naturalSide === 'DEBIT' ? value >= 0 : value >= 0;
  if (naturalSide === 'DEBIT') {
    return onNatural ? dr(accountCode, value) : cr(accountCode, -value);
  }
  return onNatural ? cr(accountCode, value) : dr(accountCode, -value);
}

/** Which asset account the money landed in. Scheme redemption settles against the liability. */
export function settlementAccount(paymentMethod: string): string {
  switch (paymentMethod) {
    case 'Cash':
      return ACCOUNT.CASH;
    case 'Card':
    case 'UPI':
      return ACCOUNT.BANK;
    case 'Scheme Redemption':
      return ACCOUNT.SCHEME_LIABILITY;
    default:
      // 'Mixed' and anything unrecognised go to Debtors, which is where an unsettled
      // receivable belongs until the split is applied.
      return ACCOUNT.DEBTORS;
  }
}

/* ─────────────────────────── Posting rules (PRD §10.3) ─────────────────────────── */

/**
 * Sale invoice (PRD §10.3):
 *
 *   Dr Cash/Bank/Debtors      [invoice total]
 *   Dr Discount Given         [discount]
 *      Cr Sales               [gross, pre-discount]
 *      Cr Output CGST/SGST/IGST
 *      Cr/Dr Round Off
 *
 * The debit is the FULL invoice total, not the net of old gold. Old gold is settled by its own
 * voucher (D-10), so netting it here would understate both the receivable and output GST.
 *
 * The discount is shown as its own expense rather than folded into Sales, because PRD §10.2
 * requires a Discount Given ledger and an owner wants to see what was given away.
 */
export function postSaleInvoice(invoice: SaleInvoice): JournalVoucher | null {
  // An estimate is a quotation, not a supply — nothing has happened in the books yet.
  if (invoice.invoiceType !== 'TAX_INVOICE') return null;

  const gross = roundMoney(invoice.subtotal);
  const discount = roundMoney(invoice.discount || 0);
  const roundOff = roundMoney(invoice.roundOff || 0);
  const total = roundMoney(invoice.grandTotal);

  const cgst = roundMoney(invoice.cgst ?? 0);
  const sgst = roundMoney(invoice.sgst ?? 0);
  const igst = roundMoney(invoice.igst ?? 0);
  // Invoices raised before Milestone 21 carry only the combined `tax`; put it under CGST/SGST
  // rather than dropping it, so an old document still posts a balanced entry.
  const splitTotal = sumMoney([cgst, sgst, igst]);
  const legacyTax = moneyEquals(splitTotal, 0) ? roundMoney(invoice.tax || 0) : 0;
  const legacyCgst = roundMoney(legacyTax / 2);
  const legacySgst = roundMoney(legacyTax - legacyCgst);

  const lines = compact([
    dr(settlementAccount(invoice.paymentMethod), total),
    dr(ACCOUNT.DISCOUNT_GIVEN, discount),
    cr(ACCOUNT.GOLD_SALES, gross),
    cr(ACCOUNT.OUTPUT_CGST, cgst || legacyCgst),
    cr(ACCOUNT.OUTPUT_SGST, sgst || legacySgst),
    cr(ACCOUNT.OUTPUT_IGST, igst),
    // A round-off can be a gain or a loss; `signed` puts it on whichever side keeps the books.
    signed(ACCOUNT.ROUND_OFF, roundOff, 'CREDIT'),
  ]);

  return {
    id: `jv-${invoice.id}`,
    voucherNo: `JV-${invoice.invoiceNumber}`,
    date: invoice.date,
    type: 'SALES',
    narration: `Sale to ${invoice.customerName} vide ${invoice.invoiceNumber}`,
    sourceType: 'SaleInvoice',
    sourceId: invoice.id,
    lines,
    branchId: invoice.branchId,
  };
}

/**
 * Credit note — the sale entry with every side reversed. A `CREDIT_NOTE` already carries
 * negative figures throughout (Milestone 12), so the amounts are negated back to positive and
 * posted on the opposite side rather than left as negative debits, which no ledger would accept.
 */
export function postCreditNote(invoice: SaleInvoice): JournalVoucher | null {
  if (invoice.invoiceType !== 'CREDIT_NOTE') return null;

  const abs = (n: number) => Math.abs(roundMoney(n || 0));
  const gross = abs(invoice.subtotal);
  const discount = abs(invoice.discount);
  const roundOff = roundMoney(invoice.roundOff || 0);
  const total = abs(invoice.grandTotal);

  const cgst = abs(invoice.cgst ?? 0);
  const sgst = abs(invoice.sgst ?? 0);
  const igst = abs(invoice.igst ?? 0);
  const splitTotal = sumMoney([cgst, sgst, igst]);
  const legacyTax = moneyEquals(splitTotal, 0) ? abs(invoice.tax) : 0;
  const legacyCgst = roundMoney(legacyTax / 2);
  const legacySgst = roundMoney(legacyTax - legacyCgst);

  const lines = compact([
    dr(ACCOUNT.GOLD_SALES, gross),
    dr(ACCOUNT.OUTPUT_CGST, cgst || legacyCgst),
    dr(ACCOUNT.OUTPUT_SGST, sgst || legacySgst),
    dr(ACCOUNT.OUTPUT_IGST, igst),
    cr(ACCOUNT.DISCOUNT_GIVEN, discount),
    cr(settlementAccount(invoice.paymentMethod), total),
    signed(ACCOUNT.ROUND_OFF, Math.abs(roundOff), 'DEBIT'),
  ]);

  return {
    id: `jv-${invoice.id}`,
    voucherNo: `JV-${invoice.invoiceNumber}`,
    date: invoice.date,
    type: 'CREDIT_NOTE',
    narration: `Credit note ${invoice.invoiceNumber} against ${invoice.creditNoteAgainstInvoice ?? 'invoice'}`,
    sourceType: 'SaleInvoice',
    sourceId: invoice.id,
    lines,
    branchId: invoice.branchId,
  };
}

/**
 * Old gold purchase (PRD §10.3): `Dr Old Gold Purchase / Cr Cash`.
 *
 * Its own voucher, never a contra against Sales — decision D-10. Buying metal from a customer is
 * a purchase that happens to be settled by netting at the counter; the netting is a payment
 * arrangement, not an accounting one.
 */
export function postOldGoldPurchase(voucher: OldGoldVoucher): JournalVoucher {
  const value = roundMoney(voucher.buybackValue);
  // Settled against the sale receivable when it was traded in, otherwise paid out in cash.
  const contra = voucher.linkedInvoiceNumber ? ACCOUNT.DEBTORS : ACCOUNT.CASH;

  return {
    id: `jv-${voucher.id}`,
    voucherNo: `JV-${voucher.voucherNumber}`,
    date: voucher.date,
    type: 'OLD_GOLD_PURCHASE',
    narration: `Old gold purchased from ${voucher.customerName} vide ${voucher.voucherNumber}`,
    sourceType: 'OldGoldVoucher',
    sourceId: voucher.id,
    lines: compact([dr(ACCOUNT.OLD_GOLD_PURCHASE, value), cr(contra, value)]),
    branchId: voucher.branchId,
  };
}

/**
 * Scheme instalment (PRD §12.3): `Dr Cash / Cr Scheme Collection Liability`.
 *
 * Emphatically NOT income — see rule 2 in the module header. The customer has bought nothing;
 * the shop owes them jewellery.
 */
export function postSchemeInstalment(
  instalment: SchemeInstalment,
  customerName: string
): JournalVoucher {
  const amount = roundMoney(instalment.amount);
  return {
    id: `jv-${instalment.id}`,
    voucherNo: `JV-${instalment.receiptNo}`,
    date: instalment.paidOn,
    type: 'SCHEME_COLLECTION',
    narration: `Scheme instalment ${instalment.installmentNo} from ${customerName} (${instalment.receiptNo})`,
    sourceType: 'SchemeInstalment',
    sourceId: instalment.id,
    lines: compact([
      dr(settlementAccount(instalment.mode), amount),
      cr(ACCOUNT.SCHEME_LIABILITY, amount),
    ]),
  };
}

/**
 * Karigar money entries (PRD §10.3). Only the MONEY ledger posts — a weight entry is skipped
 * entirely, per rule 3 in the module header. `LABOUR_CHARGED` raises the payable; `LABOUR_PAID`
 * settles it.
 */
export function postKarigarLedgerEntry(
  entry: KarigarLedgerEntry,
  karigarName: string
): JournalVoucher | null {
  // D-2: metal never enters the money books. An entry carrying weight has nothing to post.
  if (entry.moneyDelta === undefined || moneyEquals(entry.moneyDelta, 0)) return null;

  const amount = Math.abs(roundMoney(entry.moneyDelta));
  const isCharge = entry.moneyDelta > 0;

  return {
    id: `jv-${entry.id}`,
    voucherNo: `JV-KAR-${entry.id}`,
    date: entry.date,
    type: isCharge ? 'KARIGAR_LABOUR' : 'KARIGAR_PAYMENT',
    narration: `${entry.narration} — ${karigarName}`,
    sourceType: 'KarigarLedgerEntry',
    sourceId: entry.id,
    lines: compact(
      isCharge
        ? [dr(ACCOUNT.MAKING_CHARGES_EXPENSE, amount), cr(ACCOUNT.KARIGAR_LABOUR_PAYABLE, amount)]
        : [dr(ACCOUNT.KARIGAR_LABOUR_PAYABLE, amount), cr(ACCOUNT.CASH, amount)]
    ),
  };
}

/* ─────────────────────────── Derivation & reports ─────────────────────────── */

export interface PostingSources {
  invoices?: SaleInvoice[];
  oldGoldVouchers?: OldGoldVoucher[];
  schemeInstalments?: SchemeInstalment[];
  karigarLedger?: KarigarLedgerEntry[];
  customerNameById?: (id: string) => string;
  karigarNameById?: (id: string) => string;
}

/**
 * Derives the whole voucher book from the business documents. Nothing is stored: re-running this
 * on the same documents yields the same books, so the accounts can never drift from the source.
 */
export function deriveJournal(sources: PostingSources): JournalVoucher[] {
  const vouchers: JournalVoucher[] = [];

  for (const invoice of sources.invoices ?? []) {
    const posted = invoice.invoiceType === 'CREDIT_NOTE'
      ? postCreditNote(invoice)
      : postSaleInvoice(invoice);
    if (posted) vouchers.push(posted);
  }

  for (const voucher of sources.oldGoldVouchers ?? []) {
    vouchers.push(postOldGoldPurchase(voucher));
  }

  for (const instalment of sources.schemeInstalments ?? []) {
    vouchers.push(postSchemeInstalment(instalment, 'Scheme member'));
  }

  for (const entry of sources.karigarLedger ?? []) {
    const name = sources.karigarNameById?.(entry.karigarId) ?? 'Karigar';
    const posted = postKarigarLedgerEntry(entry, name);
    if (posted) vouchers.push(posted);
  }

  return vouchers.sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo));
}

export interface DayBookEntry {
  voucher: JournalVoucher;
  amount: number;
}

export function buildDayBook(vouchers: JournalVoucher[], date: string): DayBookEntry[] {
  return vouchers
    .filter(v => v.date === date)
    .map(v => ({ voucher: v, amount: voucherTotal(v) }));
}

export interface DayBookReconciliation {
  /** Sum of every voucher's debits for the day. */
  grossPostings: number;
  /** Credited to income accounts — the day's sales value at gross, pre-discount. */
  salesCredited: number;
  /** Gross value of the tax invoices actually raised that day. */
  invoicedGross: number;
  /** Debited to Discount Given — the difference between postings and money movement. */
  discountPosted: number;
  reconciles: boolean;
}

/**
 * Ties the Day Book back to the day's invoices (the Milestone 28 acceptance criterion).
 *
 * The gross postings figure is deliberately NOT the day's sales value: a discounted sale debits
 * Discount Given as well as cash, so total debits exceed what the customer paid. That is correct
 * double-entry and confusing to read, so what actually reconciles is stated explicitly — income
 * credited for the day against the gross value of the invoices raised for it.
 */
export function reconcileDayBook(
  vouchers: JournalVoucher[],
  date: string,
  invoices: SaleInvoice[]
): DayBookReconciliation {
  const onDay = vouchers.filter(v => v.date === date);

  const grossPostings = sumMoney(onDay.map(voucherTotal));
  const salesCredited = sumMoney(onDay.flatMap(v =>
    v.lines
      .filter(l => accountByCode(l.accountCode)?.type === 'INCOME')
      .map(l => l.credit - l.debit)
  ));
  const discountPosted = sumMoney(onDay.flatMap(v =>
    v.lines.filter(l => l.accountCode === ACCOUNT.DISCOUNT_GIVEN).map(l => l.debit - l.credit)
  ));

  const invoicedGross = sumMoney(
    invoices
      .filter(i => i.date === date && (i.invoiceType === 'TAX_INVOICE' || i.invoiceType === 'CREDIT_NOTE'))
      .map(i => i.subtotal)
  );

  return {
    grossPostings,
    salesCredited,
    invoicedGross,
    discountPosted,
    reconciles: moneyEquals(salesCredited, invoicedGross),
  };
}

export interface LedgerStatementRow {
  date: string;
  voucherNo: string;
  narration: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * Ledger statement for one account, with a running balance in the account's natural direction —
 * a debtor's balance reads positive when they owe money, not negative.
 */
export function buildLedgerStatement(
  vouchers: JournalVoucher[],
  accountCode: string
): LedgerStatementRow[] {
  const account = accountByCode(accountCode);
  const sign = account && normalBalanceOf(account.type) === 'CREDIT' ? -1 : 1;

  let running = 0;
  return vouchers
    .filter(v => v.lines.some(l => l.accountCode === accountCode))
    .flatMap(v =>
      v.lines
        .filter(l => l.accountCode === accountCode)
        .map(line => {
          running = roundMoney(running + sign * (line.debit - line.credit));
          return {
            date: v.date,
            voucherNo: v.voucherNo,
            narration: v.narration,
            debit: line.debit,
            credit: line.credit,
            runningBalance: running,
          };
        })
    );
}

export interface TrialBalanceRow {
  account: LedgerAccount;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  /** The whole point of the report: if this is false, something is posted wrong. */
  balanced: boolean;
}

/**
 * Trial Balance (PRD §10.7). Each account's net movement is shown in its own column; the two
 * columns must agree, which is the check that every voucher balanced *and* nothing was lost in
 * aggregation.
 */
export function buildTrialBalance(vouchers: JournalVoucher[]): TrialBalance {
  const net = new Map<string, number>();

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const current = net.get(line.accountCode) ?? 0;
      net.set(line.accountCode, current + toSigned(line));
    }
  }

  const rows: TrialBalanceRow[] = [];
  for (const [code, rawValue] of net) {
    const account = accountByCode(code);
    if (!account) continue;
    const value = roundMoney(rawValue);
    if (moneyEquals(value, 0)) continue;
    rows.push({
      account,
      debit: value > 0 ? value : 0,
      credit: value < 0 ? -value : 0,
    });
  }

  rows.sort((a, b) => a.account.code.localeCompare(b.account.code));
  const totalDebit = sumMoney(rows.map(r => r.debit));
  const totalCredit = sumMoney(rows.map(r => r.credit));

  return { rows, totalDebit, totalCredit, balanced: moneyEquals(totalDebit, totalCredit) };
}

function toSigned(line: JournalLine): number {
  return (Number(line.debit) || 0) - (Number(line.credit) || 0);
}

export interface JournalSummary {
  voucherCount: number;
  unbalancedCount: number;
  totalPosted: number;
}

export function summariseJournal(vouchers: JournalVoucher[]): JournalSummary {
  return {
    voucherCount: vouchers.length,
    unbalancedCount: vouchers.filter(v => !isBalanced(v)).length,
    totalPosted: sumMoney(vouchers.map(voucherTotal)),
  };
}
