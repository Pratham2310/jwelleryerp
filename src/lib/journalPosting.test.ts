import { describe, it, expect } from 'vitest';
import {
  CHART_OF_ACCOUNTS, ACCOUNT, accountByCode, accountName, normalBalanceOf,
  isBalanced, voucherTotal, settlementAccount,
  postSaleInvoice, postCreditNote, postOldGoldPurchase, postSchemeInstalment,
  postKarigarLedgerEntry, deriveJournal, buildDayBook, buildLedgerStatement,
  buildTrialBalance, summariseJournal, reconcileDayBook,
} from './journalPosting';
import { sumMoney } from './money';
import type { SaleInvoice, OldGoldVoucher, SchemeInstalment, KarigarLedgerEntry } from '../types';

function invoice(over: Partial<SaleInvoice> = {}): SaleInvoice {
  return {
    id: 'inv-1', invoiceType: 'TAX_INVOICE', invoiceNumber: 'INV-2026-1001',
    date: '2026-07-30', customerName: 'Sharda Sharma', customerPhone: '9876543210',
    items: [], oldGoldWeight: 0, oldGoldValue: 0,
    subtotal: 289440, tax: 8683, discount: 0, grandTotal: 298123,
    netAmountDue: 298123, paymentMethod: 'Cash',
    cgst: 4342, sgst: 4341, igst: 0, roundOff: 0,
    branchId: 'br-1', ...over,
  };
}

function oldGold(over: Partial<OldGoldVoucher> = {}): OldGoldVoucher {
  return {
    id: 'ogv-1', voucherNumber: 'OGV-2026-001', date: '2026-07-30',
    customerName: 'Ramesh Patel', customerPhone: '9876500000',
    itemDescription: 'Old chain', grossWeight: 15, testedPurityPercent: 87.5,
    meltingLossPercent: 3, netPayableWeight: 12.731, buybackRatePerGram: 6050,
    buybackValue: 77023, settlementMode: 'ADJUSTED_AGAINST_SALE', status: 'InSafe', ...over,
  } as OldGoldVoucher;
}

const instalment = (over: Partial<SchemeInstalment> = {}): SchemeInstalment => ({
  id: 'si-1', enrollmentId: 'en-1', installmentNo: 1, amount: 5000,
  paidOn: '2026-07-30', mode: 'Cash', receiptNo: 'SR-2026-0001', ...over,
});

const karigarEntry = (over: Partial<KarigarLedgerEntry> = {}): KarigarLedgerEntry => ({
  id: 'kl-1', karigarId: 'kar-1', date: '2026-07-30', sequence: 1,
  type: 'LABOUR_CHARGED', narration: 'Labour for JOB-2026-1', moneyDelta: 14500, ...over,
});

describe('Chart of Accounts (PRD §10.2)', () => {
  it('has unique codes', () => {
    const codes = CHART_OF_ACCOUNTS.map(a => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('carries every ledger PRD §10.2 lists as a minimum', () => {
    const names = CHART_OF_ACCOUNTS.map(a => a.name).join(' | ');
    for (const required of [
      'Output CGST', 'Output SGST', 'Output IGST', 'Input CGST', 'TCS Payable',
      'Stock-in-Hand', 'Karigar Labour Payable', 'Customer Advance',
      'Scheme Collection Liability', 'Sundry Debtors', 'Sundry Creditors',
      'Cash-in-Hand', 'Round Off', 'Discount Given',
    ]) {
      expect(names).toContain(required);
    }
  });

  it('knows which side increases each account type', () => {
    expect(normalBalanceOf('ASSET')).toBe('DEBIT');
    expect(normalBalanceOf('EXPENSE')).toBe('DEBIT');
    expect(normalBalanceOf('LIABILITY')).toBe('CREDIT');
    expect(normalBalanceOf('INCOME')).toBe('CREDIT');
  });

  it('resolves an account and degrades safely on an unknown code', () => {
    expect(accountByCode(ACCOUNT.CASH)?.name).toBe('Cash-in-Hand');
    expect(accountName('9999')).toMatch(/unmapped/i);
  });

  it('routes each tender to the right asset account', () => {
    expect(settlementAccount('Cash')).toBe(ACCOUNT.CASH);
    expect(settlementAccount('Card')).toBe(ACCOUNT.BANK);
    expect(settlementAccount('UPI')).toBe(ACCOUNT.BANK);
    // Redeeming a scheme settles the liability rather than bringing money in.
    expect(settlementAccount('Scheme Redemption')).toBe(ACCOUNT.SCHEME_LIABILITY);
    expect(settlementAccount('Mixed')).toBe(ACCOUNT.DEBTORS);
  });
});

describe('sale invoice posting (PRD §10.3)', () => {
  it('balances', () => {
    const v = postSaleInvoice(invoice())!;
    expect(isBalanced(v)).toBe(true);
  });

  it('debits the settlement account with the FULL invoice total', () => {
    const v = postSaleInvoice(invoice())!;
    const cash = v.lines.find(l => l.accountCode === ACCOUNT.CASH)!;
    expect(cash.debit).toBe(298123);
  });

  it('credits sales at the gross, pre-discount value and books the discount separately', () => {
    const v = postSaleInvoice(invoice({
      subtotal: 100000, discount: 5000, tax: 2850, cgst: 1425, sgst: 1425,
      grandTotal: 97850, netAmountDue: 97850,
    }))!;
    expect(v.lines.find(l => l.accountCode === ACCOUNT.GOLD_SALES)!.credit).toBe(100000);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.DISCOUNT_GIVEN)!.debit).toBe(5000);
    expect(isBalanced(v)).toBe(true);
  });

  it('does NOT net old gold into the sale (decision D-10)', () => {
    // Netting it here would understate output GST — the exact bug Milestone 2 fixed forward.
    const v = postSaleInvoice(invoice({ oldGoldValue: 77023, netAmountDue: 221100 }))!;
    expect(v.lines.find(l => l.accountCode === ACCOUNT.CASH)!.debit).toBe(298123);
    expect(v.lines.some(l => l.accountCode === ACCOUNT.OLD_GOLD_PURCHASE)).toBe(false);
    expect(isBalanced(v)).toBe(true);
  });

  it('posts CGST and SGST separately, and IGST instead on an inter-state supply', () => {
    const intra = postSaleInvoice(invoice())!;
    expect(intra.lines.find(l => l.accountCode === ACCOUNT.OUTPUT_CGST)!.credit).toBe(4342);
    expect(intra.lines.find(l => l.accountCode === ACCOUNT.OUTPUT_SGST)!.credit).toBe(4341);
    expect(intra.lines.some(l => l.accountCode === ACCOUNT.OUTPUT_IGST)).toBe(false);

    const inter = postSaleInvoice(invoice({ cgst: 0, sgst: 0, igst: 8683 }))!;
    expect(inter.lines.find(l => l.accountCode === ACCOUNT.OUTPUT_IGST)!.credit).toBe(8683);
    expect(isBalanced(inter)).toBe(true);
  });

  it('balances with a positive and a negative round-off', () => {
    const gain = postSaleInvoice(invoice({ grandTotal: 298124, roundOff: 1 }))!;
    expect(isBalanced(gain)).toBe(true);
    const loss = postSaleInvoice(invoice({ grandTotal: 298123, roundOff: -0.2, tax: 8683.2 }))!;
    expect(isBalanced(loss)).toBe(true);
  });

  it('still posts a balanced entry for a pre-Milestone-21 invoice with no CGST/SGST split', () => {
    // Dropping the tax would leave the entry short; it is split rather than lost.
    const legacy = postSaleInvoice(invoice({ cgst: undefined, sgst: undefined, igst: undefined }))!;
    expect(isBalanced(legacy)).toBe(true);
    expect(sumMoney([
      legacy.lines.find(l => l.accountCode === ACCOUNT.OUTPUT_CGST)!.credit,
      legacy.lines.find(l => l.accountCode === ACCOUNT.OUTPUT_SGST)!.credit,
    ])).toBe(8683);
  });

  it('posts nothing for an estimate — a quotation is not a supply', () => {
    expect(postSaleInvoice(invoice({ invoiceType: 'ESTIMATE' }))).toBeNull();
  });

  it('omits zero-value lines rather than cluttering the ledger', () => {
    const v = postSaleInvoice(invoice())!;
    expect(v.lines.every(l => l.debit !== 0 || l.credit !== 0)).toBe(true);
    expect(v.lines.some(l => l.accountCode === ACCOUNT.DISCOUNT_GIVEN)).toBe(false);
  });

  it('traces back to the document it came from', () => {
    const v = postSaleInvoice(invoice())!;
    expect(v.sourceType).toBe('SaleInvoice');
    expect(v.sourceId).toBe('inv-1');
    expect(v.voucherNo).toContain('INV-2026-1001');
  });
});

describe('credit note posting', () => {
  const note = invoice({
    id: 'cn-1', invoiceType: 'CREDIT_NOTE', invoiceNumber: 'CRN-2026-01',
    subtotal: -100000, discount: -5000, tax: -2850, cgst: -1425, sgst: -1425,
    grandTotal: -97850, netAmountDue: -97850, creditNoteAgainstInvoice: 'INV-2026-1001',
  });

  it('balances', () => {
    expect(isBalanced(postCreditNote(note)!)).toBe(true);
  });

  it('reverses the sale — sales debited, cash credited', () => {
    // Negative debits would be posted by a naive sign-flip; no ledger accepts those.
    const v = postCreditNote(note)!;
    expect(v.lines.find(l => l.accountCode === ACCOUNT.GOLD_SALES)!.debit).toBe(100000);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.CASH)!.credit).toBe(97850);
    expect(v.lines.every(l => l.debit >= 0 && l.credit >= 0)).toBe(true);
  });

  it('reverses the output tax so the GST liability actually reduces', () => {
    const v = postCreditNote(note)!;
    expect(v.lines.find(l => l.accountCode === ACCOUNT.OUTPUT_CGST)!.debit).toBe(1425);
  });

  it('nets to zero against the original sale', () => {
    const sale = postSaleInvoice(invoice({
      subtotal: 100000, discount: 5000, tax: 2850, cgst: 1425, sgst: 1425,
      grandTotal: 97850, netAmountDue: 97850,
    }))!;
    const tb = buildTrialBalance([sale, postCreditNote(note)!]);
    expect(tb.rows).toEqual([]); // every account nets flat
    expect(tb.balanced).toBe(true);
  });

  it('posts nothing for a tax invoice passed to it by mistake', () => {
    expect(postCreditNote(invoice())).toBeNull();
  });
});

describe('old gold purchase (decision D-10)', () => {
  it('is its own voucher, debiting purchase not contra-ing sales', () => {
    const v = postOldGoldPurchase(oldGold());
    expect(isBalanced(v)).toBe(true);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.OLD_GOLD_PURCHASE)!.debit).toBe(77023);
    expect(v.lines.some(l => l.accountCode === ACCOUNT.GOLD_SALES)).toBe(false);
  });

  it('settles against the receivable when traded in, and cash when bought outright', () => {
    expect(postOldGoldPurchase(oldGold({ linkedInvoiceNumber: 'INV-2026-1001' }))
      .lines.find(l => l.credit > 0)!.accountCode).toBe(ACCOUNT.DEBTORS);
    expect(postOldGoldPurchase(oldGold({ linkedInvoiceNumber: undefined }))
      .lines.find(l => l.credit > 0)!.accountCode).toBe(ACCOUNT.CASH);
  });
});

describe('scheme instalment — a liability, never income (PRD §12.3)', () => {
  it('credits the liability, not a sales account', () => {
    // Booking it as income recognises revenue the shop has not earned.
    const v = postSchemeInstalment(instalment(), 'Sharda Sharma');
    expect(isBalanced(v)).toBe(true);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.SCHEME_LIABILITY)!.credit).toBe(5000);
    expect(v.lines.some(l => accountByCode(l.accountCode)?.type === 'INCOME')).toBe(false);
  });

  it('routes the receipt by payment mode', () => {
    expect(postSchemeInstalment(instalment({ mode: 'UPI' }), 'X')
      .lines.find(l => l.debit > 0)!.accountCode).toBe(ACCOUNT.BANK);
  });
});

describe('karigar postings — money only (decision D-2)', () => {
  it('raises the labour payable on a charge', () => {
    const v = postKarigarLedgerEntry(karigarEntry(), 'Gopal')!;
    expect(isBalanced(v)).toBe(true);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.MAKING_CHARGES_EXPENSE)!.debit).toBe(14500);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.KARIGAR_LABOUR_PAYABLE)!.credit).toBe(14500);
  });

  it('settles the payable on a payment', () => {
    const v = postKarigarLedgerEntry(karigarEntry({ type: 'LABOUR_PAID', moneyDelta: -14500 }), 'Gopal')!;
    expect(v.lines.find(l => l.accountCode === ACCOUNT.KARIGAR_LABOUR_PAYABLE)!.debit).toBe(14500);
    expect(v.lines.find(l => l.accountCode === ACCOUNT.CASH)!.credit).toBe(14500);
  });

  it('posts NOTHING for a weight entry — metal never enters the money books', () => {
    // D-2: valuing outstanding metal into rupees would net the two ledgers.
    const weightOnly = karigarEntry({
      type: 'METAL_ISSUED', moneyDelta: undefined, fineWeightDelta: 45.8,
    });
    expect(postKarigarLedgerEntry(weightOnly, 'Gopal')).toBeNull();
  });

  it('posts nothing for a zero-money entry', () => {
    expect(postKarigarLedgerEntry(karigarEntry({ moneyDelta: 0 }), 'Gopal')).toBeNull();
  });
});

describe('deriveJournal + reports', () => {
  const sources = {
    invoices: [invoice(), invoice({ id: 'inv-2', invoiceNumber: 'INV-2026-1002', date: '2026-07-29' })],
    oldGoldVouchers: [oldGold()],
    schemeInstalments: [instalment()],
    karigarLedger: [karigarEntry(), karigarEntry({ id: 'kl-2', type: 'METAL_ISSUED', moneyDelta: undefined, fineWeightDelta: 10 })],
  };

  it('derives a voucher per postable document and skips the rest', () => {
    const journal = deriveJournal(sources);
    // 2 invoices + 1 old gold + 1 instalment + 1 money karigar entry; the weight entry is skipped.
    expect(journal).toHaveLength(5);
  });

  it('EVERY derived voucher balances — the milestone acceptance criterion', () => {
    for (const v of deriveJournal(sources)) {
      expect(isBalanced(v), `${v.voucherNo} does not balance`).toBe(true);
    }
    expect(summariseJournal(deriveJournal(sources)).unbalancedCount).toBe(0);
  });

  it('orders the book by date', () => {
    const dates = deriveJournal(sources).map(v => v.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('is a pure projection — deriving twice gives the same books', () => {
    expect(deriveJournal(sources)).toEqual(deriveJournal(sources));
  });

  it('builds a Day Book that reconciles against the day’s documents', () => {
    const journal = deriveJournal(sources);
    const day = buildDayBook(journal, '2026-07-30');
    expect(day).toHaveLength(4); // one invoice is dated the 29th
    expect(day.every(e => e.voucher.date === '2026-07-30')).toBe(true);
    expect(sumMoney(day.map(e => e.amount))).toBe(
      sumMoney(journal.filter(v => v.date === '2026-07-30').map(voucherTotal))
    );
  });

  it('builds a ledger statement with a running balance in the natural direction', () => {
    const journal = deriveJournal(sources);
    const cash = buildLedgerStatement(journal, ACCOUNT.CASH);
    expect(cash.length).toBeGreaterThan(0);
    // Cash is an asset: receipts read as a rising positive balance.
    expect(cash[cash.length - 1].runningBalance).toBeGreaterThan(0);
  });

  it('shows a liability’s balance positive when the shop owes it', () => {
    const journal = deriveJournal(sources);
    const payable = buildLedgerStatement(journal, ACCOUNT.KARIGAR_LABOUR_PAYABLE);
    expect(payable[payable.length - 1].runningBalance).toBe(14500);
  });

  it('returns an empty statement for an account with no movement', () => {
    expect(buildLedgerStatement(deriveJournal(sources), '1310')).toEqual([]);
  });

  it('produces a Trial Balance whose columns agree', () => {
    const tb = buildTrialBalance(deriveJournal(sources));
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.rows.length).toBeGreaterThan(0);
  });

  it('omits accounts that net flat from the Trial Balance', () => {
    const tb = buildTrialBalance(deriveJournal(sources));
    expect(tb.rows.every(r => r.debit > 0 || r.credit > 0)).toBe(true);
  });

  it('handles an entirely empty book', () => {
    expect(deriveJournal({})).toEqual([]);
    expect(buildTrialBalance([])).toMatchObject({ rows: [], totalDebit: 0, totalCredit: 0, balanced: true });
    expect(summariseJournal([])).toEqual({ voucherCount: 0, unbalancedCount: 0, totalPosted: 0 });
  });
});

describe('reconcileDayBook — the Milestone 28 acceptance criterion', () => {
  it('reconciles income credited against the invoices raised that day', () => {
    const invs = [invoice({ subtotal: 100000, discount: 1500, grandTotal: 101350, tax: 2850, cgst: 1425, sgst: 1425 })];
    const r = reconcileDayBook(deriveJournal({ invoices: invs }), '2026-07-30', invs);
    expect(r.salesCredited).toBe(100000);
    expect(r.invoicedGross).toBe(100000);
    expect(r.reconciles).toBe(true);
  });

  it('explains why gross postings differ from the invoice total', () => {
    // A discounted sale debits Discount Given AND reduces the cash debit by the same amount, so
    // the discount cancels out of total debits: gross postings are gross sales plus output tax.
    // Against the invoice's grandTotal it therefore reads high by exactly the discount, which is
    // what an owner comparing the two would notice and needs explained.
    const invs = [invoice({ subtotal: 100000, discount: 1500, grandTotal: 101350, tax: 2850, cgst: 1425, sgst: 1425 })];
    const r = reconcileDayBook(deriveJournal({ invoices: invs }), '2026-07-30', invs);
    expect(r.discountPosted).toBe(1500);
    expect(r.grossPostings).toBe(102850);
    expect(r.grossPostings).toBe(r.invoicedGross + 2850);
    expect(r.grossPostings - invs[0].grandTotal).toBe(r.discountPosted);
  });

  it('still reconciles with no discount, where the two are simply equal', () => {
    const invs = [invoice()];
    const r = reconcileDayBook(deriveJournal({ invoices: invs }), '2026-07-30', invs);
    expect(r.discountPosted).toBe(0);
    expect(r.reconciles).toBe(true);
  });

  it('nets a credit note raised the same day', () => {
    const invs = [
      invoice({ subtotal: 100000, grandTotal: 103000, tax: 3000, cgst: 1500, sgst: 1500 }),
      invoice({
        id: 'cn', invoiceType: 'CREDIT_NOTE', invoiceNumber: 'CRN-2026-01',
        subtotal: -40000, grandTotal: -41200, tax: -1200, cgst: -600, sgst: -600, discount: 0,
      }),
    ];
    const r = reconcileDayBook(deriveJournal({ invoices: invs }), '2026-07-30', invs);
    expect(r.invoicedGross).toBe(60000);
    expect(r.salesCredited).toBe(60000);
    expect(r.reconciles).toBe(true);
  });

  it('reports a clean zero for a day with nothing on it', () => {
    const r = reconcileDayBook([], '2026-01-01', []);
    expect(r).toMatchObject({ grossPostings: 0, salesCredited: 0, invoicedGross: 0, reconciles: true });
  });

  it('ignores estimates, which post nothing', () => {
    const invs = [invoice(), invoice({ id: 'est', invoiceType: 'ESTIMATE', invoiceNumber: 'EST-1', subtotal: 999999 })];
    const r = reconcileDayBook(deriveJournal({ invoices: invs }), '2026-07-30', invs);
    expect(r.invoicedGross).toBe(289440);
    expect(r.reconciles).toBe(true);
  });
});
