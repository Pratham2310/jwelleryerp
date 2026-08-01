import { describe, it, expect } from 'vitest';
import {
  buildCashBook,
  balancesUpTo,
  buildProfitAndLoss,
  buildBalanceSheet,
  groupLines,
} from './financialStatements';
import {
  validateManualVoucher,
  voucherLegs,
  postManualVoucher,
  touchesProfitAndLoss,
  postsBalanced,
  nextVoucherNumber,
  summariseManualVouchers,
  selectableAgainstAccounts,
  isCashOrBank,
} from './manualVoucher';
import { ACCOUNT, CHART_OF_ACCOUNTS, isBalanced } from './journalPosting';
import type { JournalVoucher } from './journalPosting';
import type { ManualVoucher } from '../types';

const jv = (over: Partial<JournalVoucher> = {}): JournalVoucher => ({
  id: 'v1', voucherNo: 'V1', date: '2026-07-10', type: 'SALES',
  narration: 'n', sourceType: 'x', sourceId: 'y', lines: [], ...over,
});

/** A simple, genuinely balanced book: one cash sale of 10,000 + 300 tax. */
const sale = jv({
  id: 'v-sale', voucherNo: 'INV-1', date: '2026-07-10',
  lines: [
    { accountCode: ACCOUNT.CASH, debit: 10300, credit: 0 },
    { accountCode: ACCOUNT.GOLD_SALES, debit: 0, credit: 10000 },
    { accountCode: ACCOUNT.OUTPUT_CGST, debit: 0, credit: 150 },
    { accountCode: ACCOUNT.OUTPUT_SGST, debit: 0, credit: 150 },
  ],
});

const expense = jv({
  id: 'v-exp', voucherNo: 'PAY-1', date: '2026-07-12', type: 'KARIGAR_PAYMENT',
  lines: [
    { accountCode: ACCOUNT.MAKING_CHARGES_EXPENSE, debit: 2000, credit: 0 },
    { accountCode: ACCOUNT.CASH, debit: 0, credit: 2000 },
  ],
});

const contra = jv({
  id: 'v-con', voucherNo: 'CON-1', date: '2026-07-13', type: 'KARIGAR_LABOUR',
  lines: [
    { accountCode: ACCOUNT.BANK, debit: 5000, credit: 0 },
    { accountCode: ACCOUNT.CASH, debit: 0, credit: 5000 },
  ],
});

function manual(over: Partial<ManualVoucher> = {}): ManualVoucher {
  return {
    id: 'm1', voucherNo: 'PAY-2026-27-001', type: 'PAYMENT', date: '2026-07-12',
    moneyAccount: ACCOUNT.CASH, againstAccount: ACCOUNT.MAKING_CHARGES_EXPENSE,
    amount: 2000, narration: 'Karigar labour settled in cash', ...over,
  };
}

/* ─────────────────────────── M45: manual vouchers ─────────────────────────── */

describe('manual voucher legs', () => {
  it('a Payment credits the money account and debits what it was spent on', () => {
    expect(voucherLegs({ type: 'PAYMENT', moneyAccount: ACCOUNT.CASH, againstAccount: ACCOUNT.MAKING_CHARGES_EXPENSE }))
      .toEqual({ debitAccount: ACCOUNT.MAKING_CHARGES_EXPENSE, creditAccount: ACCOUNT.CASH });
  });

  it('a Receipt is the mirror', () => {
    expect(voucherLegs({ type: 'RECEIPT', moneyAccount: ACCOUNT.CASH, againstAccount: ACCOUNT.GOLD_SALES }))
      .toEqual({ debitAccount: ACCOUNT.CASH, creditAccount: ACCOUNT.GOLD_SALES });
  });

  it('a Contra debits the destination and credits the source', () => {
    expect(voucherLegs({ type: 'CONTRA', moneyAccount: ACCOUNT.BANK, againstAccount: ACCOUNT.CASH }))
      .toEqual({ debitAccount: ACCOUNT.BANK, creditAccount: ACCOUNT.CASH });
  });
});

describe('validateManualVoucher', () => {
  it('accepts a well-formed payment', () => {
    expect(validateManualVoucher(manual())).toBeNull();
  });

  it('requires type, date, both accounts, an amount and a narration', () => {
    expect(validateManualVoucher({ ...manual(), type: undefined })).toMatch(/voucher type/i);
    expect(validateManualVoucher({ ...manual(), date: '' })).toMatch(/voucher date/i);
    expect(validateManualVoucher({ ...manual(), moneyAccount: '' })).toMatch(/cash or bank account/i);
    expect(validateManualVoucher({ ...manual(), againstAccount: '' })).toMatch(/other side/i);
    expect(validateManualVoucher({ ...manual(), amount: 0 })).toMatch(/greater than zero/i);
    expect(validateManualVoucher({ ...manual(), narration: 'no' })).toMatch(/no source document/i);
  });

  it('refuses the same account on both sides', () => {
    expect(validateManualVoucher(manual({ againstAccount: ACCOUNT.CASH })))
      .toMatch(/must be different accounts/i);
  });

  it('refuses a money account that is not cash or bank', () => {
    expect(validateManualVoucher(manual({ moneyAccount: ACCOUNT.GOLD_SALES })))
      .toMatch(/not a cash or bank account/i);
  });

  it('refuses a Contra whose other side is not cash or bank', () => {
    // This is the one that matters: allowing it would create profit from a movement that
    // changed nothing.
    const err = validateManualVoucher(manual({ type: 'CONTRA', againstAccount: ACCOUNT.GOLD_SALES }));
    expect(err).toMatch(/only moves money between cash and bank/i);
    expect(err).toMatch(/Payment or Receipt instead/i);
  });

  it('accepts a genuine cash-to-bank Contra', () => {
    expect(validateManualVoucher(manual({
      type: 'CONTRA', moneyAccount: ACCOUNT.BANK, againstAccount: ACCOUNT.CASH,
      narration: 'Daily takings deposited',
    }))).toBeNull();
  });

  it('redirects a cash↔bank move booked as a Payment', () => {
    expect(validateManualVoucher(manual({ againstAccount: ACCOUNT.BANK })))
      .toMatch(/is a Contra, not a Payment/i);
  });
});

describe('a Contra never touches P&L — structurally, not by convention', () => {
  it('holds for a valid contra', () => {
    const v = manual({ type: 'CONTRA', moneyAccount: ACCOUNT.BANK, againstAccount: ACCOUNT.CASH });
    expect(touchesProfitAndLoss(v)).toBe(false);
  });

  it('a payment against an expense DOES touch P&L, as it should', () => {
    expect(touchesProfitAndLoss(manual())).toBe(true);
  });

  it('every voucher type posts a balanced pair', () => {
    for (const v of [
      manual(),
      manual({ type: 'RECEIPT', againstAccount: ACCOUNT.GOLD_SALES }),
      manual({ type: 'CONTRA', moneyAccount: ACCOUNT.BANK, againstAccount: ACCOUNT.CASH }),
    ]) {
      expect(postsBalanced(v)).toBe(true);
      expect(isBalanced(postManualVoucher(v))).toBe(true);
    }
  });

  it('carries the narration through as the audit trail', () => {
    expect(postManualVoucher(manual()).narration).toBe('Karigar labour settled in cash');
    expect(postManualVoucher(manual()).sourceType).toBe('ManualVoucher');
  });
});

describe('voucher numbering and selection', () => {
  it('numbers each type on its own series, per financial year', () => {
    expect(nextVoucherNumber('PAYMENT', [], '2026-07-12')).toBe('PAY-2026-27-001');
    expect(nextVoucherNumber('RECEIPT', [], '2026-07-12')).toBe('REC-2026-27-001');
    expect(nextVoucherNumber('CONTRA', [], '2026-07-12')).toBe('CON-2026-27-001');
  });

  it('does not let one type consume another’s numbers', () => {
    const existing = [manual({ voucherNo: 'PAY-2026-27-007' })];
    expect(nextVoucherNumber('PAYMENT', existing, '2026-07-12')).toBe('PAY-2026-27-008');
    expect(nextVoucherNumber('RECEIPT', existing, '2026-07-12')).toBe('REC-2026-27-001');
  });

  it('offers only cash/bank on the far side of a Contra, and only non-cash otherwise', () => {
    const contraOpts = selectableAgainstAccounts('CONTRA', CHART_OF_ACCOUNTS);
    expect(contraOpts.every(a => isCashOrBank(a.code))).toBe(true);
    const payOpts = selectableAgainstAccounts('PAYMENT', CHART_OF_ACCOUNTS);
    expect(payOpts.every(a => !isCashOrBank(a.code))).toBe(true);
  });

  it('summarises in, out and transferred separately', () => {
    const s = summariseManualVouchers([
      manual({ amount: 2000 }),
      manual({ id: 'm2', type: 'RECEIPT', amount: 5000 }),
      manual({ id: 'm3', type: 'CONTRA', amount: 8000 }),
    ]);
    expect(s).toMatchObject({ payments: 1, receipts: 1, contras: 1, moneyOut: 2000, moneyIn: 5000, transferred: 8000 });
  });
});

/* ─────────────────────────── M46: Cash Book ─────────────────────────── */

describe('buildCashBook', () => {
  const book = [sale, expense, contra];

  it('runs a balance forward through the period', () => {
    const cb = buildCashBook(book, ACCOUNT.CASH, '2026-07-01', '2026-07-31');
    expect(cb.rows.map(r => r.balance)).toEqual([10300, 8300, 3300]);
    expect(cb.closingBalance).toBe(3300);
  });

  it('reconciles: opening + receipts − payments = closing', () => {
    const cb = buildCashBook(book, ACCOUNT.CASH, '2026-07-01', '2026-07-31');
    expect(cb.openingBalance).toBe(0);
    expect(cb.totalReceipts).toBe(10300);
    expect(cb.totalPayments).toBe(7000);
    expect(cb.reconciles).toBe(true);
  });

  it('carries an OPENING balance from before the window', () => {
    // A cash book that restarts at zero each period shows a closing balance unrelated to the till.
    const cb = buildCashBook(book, ACCOUNT.CASH, '2026-07-12', '2026-07-31');
    expect(cb.openingBalance).toBe(10300);
    expect(cb.closingBalance).toBe(3300);
  });

  it('tracks the bank account separately', () => {
    const cb = buildCashBook(book, ACCOUNT.BANK, '2026-07-01', '2026-07-31');
    expect(cb.totalReceipts).toBe(5000);
    expect(cb.closingBalance).toBe(5000);
  });

  it('a contra leaves the two books mirroring each other', () => {
    const cash = buildCashBook([contra], ACCOUNT.CASH, '2026-07-01', '2026-07-31');
    const bank = buildCashBook([contra], ACCOUNT.BANK, '2026-07-01', '2026-07-31');
    expect(cash.closingBalance).toBe(-5000);
    expect(bank.closingBalance).toBe(5000);
    expect(cash.closingBalance + bank.closingBalance).toBe(0);
  });

  it('is empty but still reconciles with no activity', () => {
    const cb = buildCashBook([], ACCOUNT.CASH, '2026-07-01', '2026-07-31');
    expect(cb.rows).toEqual([]);
    expect(cb.closingBalance).toBe(0);
    expect(cb.reconciles).toBe(true);
  });
});

/* ─────────────────────────── M47: P&L and Balance Sheet ─────────────────────────── */

describe('buildProfitAndLoss', () => {
  it('nets income against expenses for the PERIOD only', () => {
    const pl = buildProfitAndLoss([sale, expense], '2026-07-01', '2026-07-31');
    expect(pl.totalIncome).toBe(10000);
    expect(pl.totalExpenses).toBe(2000);
    expect(pl.netProfit).toBe(8000);
  });

  it('excludes activity outside the window — a P&L is not cumulative', () => {
    // Mixing the two is how a monthly P&L ends up showing lifetime revenue.
    const pl = buildProfitAndLoss([sale, expense], '2026-07-11', '2026-07-31');
    expect(pl.totalIncome).toBe(0);
    expect(pl.totalExpenses).toBe(2000);
    expect(pl.netProfit).toBe(-2000);
  });

  it('leaves tax out of the P&L — it is a liability, not income', () => {
    const pl = buildProfitAndLoss([sale], '2026-07-01', '2026-07-31');
    expect(pl.income.map(l => l.code)).not.toContain(ACCOUNT.OUTPUT_CGST);
    expect(pl.totalIncome).toBe(10000); // not 10300
  });

  it('reports a loss as a negative net profit rather than hiding it', () => {
    expect(buildProfitAndLoss([expense], '2026-07-01', '2026-07-31').netProfit).toBe(-2000);
  });

  it('is empty for a period with no postings', () => {
    const pl = buildProfitAndLoss([], '2026-07-01', '2026-07-31');
    expect(pl).toMatchObject({ totalIncome: 0, totalExpenses: 0, netProfit: 0 });
  });
});

describe('buildBalanceSheet — balances only because the P&L is carried in', () => {
  it('balances on a simple book', () => {
    const bs = buildBalanceSheet([sale, expense], '2026-07-31');
    expect(bs.isBalanced).toBe(true);
    expect(bs.difference).toBe(0);
  });

  it('carries retained earnings equal to the cumulative net profit', () => {
    const bs = buildBalanceSheet([sale, expense], '2026-07-31');
    const lifetime = buildProfitAndLoss([sale, expense], '0000-01-01', '2026-07-31');
    expect(bs.retainedEarnings).toBe(lifetime.netProfit);
    expect(bs.retainedEarnings).toBe(8000);
  });

  it('would be out by exactly the profit if earnings were omitted', () => {
    // The failure this guards against: dropping net profit leaves the sheet wrong by the profit,
    // and the instinct is then to plug the gap, which hides the real cause.
    const bs = buildBalanceSheet([sale, expense], '2026-07-31');
    expect(bs.totalAssets - bs.totalLiabilities).toBe(bs.retainedEarnings);
  });

  it('assets equal liabilities plus equity', () => {
    const bs = buildBalanceSheet([sale, expense], '2026-07-31');
    expect(bs.totalAssets).toBe(bs.totalLiabilitiesAndEquity);
    expect(bs.totalAssets).toBe(8300);     // cash 10300 − 2000
    expect(bs.totalLiabilities).toBe(300); // CGST + SGST payable
  });

  it('stays balanced after a contra, which moves value without changing it', () => {
    const bs = buildBalanceSheet([sale, expense, contra], '2026-07-31');
    expect(bs.isBalanced).toBe(true);
    expect(bs.totalAssets).toBe(8300); // unchanged by the transfer
  });

  it('is cumulative, not periodic — it must carry every prior period', () => {
    const later = jv({
      id: 'v-later', voucherNo: 'INV-2', date: '2026-08-05',
      lines: [
        { accountCode: ACCOUNT.CASH, debit: 5000, credit: 0 },
        { accountCode: ACCOUNT.GOLD_SALES, debit: 0, credit: 5000 },
      ],
    });
    const bs = buildBalanceSheet([sale, expense, later], '2026-08-31');
    expect(bs.retainedEarnings).toBe(13000); // 8000 + 5000, not just August
    expect(bs.isBalanced).toBe(true);
  });

  it('balances on an empty book', () => {
    const bs = buildBalanceSheet([], '2026-07-31');
    expect(bs.isBalanced).toBe(true);
    expect(bs.totalAssets).toBe(0);
  });
});

describe('balancesUpTo & groupLines', () => {
  it('reports balances in each account’s normal direction', () => {
    const b = balancesUpTo([sale], '2026-07-31');
    const cash = b.find(x => x.code === ACCOUNT.CASH)!;
    const sales = b.find(x => x.code === ACCOUNT.GOLD_SALES)!;
    expect(cash.balance).toBe(10300);  // asset, debit-normal
    expect(sales.balance).toBe(10000); // income, credit-normal
  });

  it('excludes accounts with no movement', () => {
    expect(balancesUpTo([sale], '2026-07-31').every(b => b.debit !== 0 || b.credit !== 0)).toBe(true);
  });

  it('groups statement lines deterministically', () => {
    const bs = buildBalanceSheet([sale, expense], '2026-07-31');
    const groups = groupLines(bs.assets);
    expect(groups).toEqual(groupLines(bs.assets));
    expect(groups.every(g => g.total === g.lines.reduce((s, l) => s + l.amount, 0))).toBe(true);
  });
});
