/**
 * Cash Book, Profit & Loss and Balance Sheet (PRD §10.5/§14.7, Milestones 46–47).
 *
 * All three are **derived** from the posted journal, never hand-computed — the same principle as
 * Milestone 28. A statement that can be edited independently of the vouchers behind it is a
 * second set of books.
 *
 * ─── Why the Balance Sheet balances, and the mistake that breaks it ────────────────────
 * Every journal voucher balances, so across the whole book:
 *
 *     Σ(debits) = Σ(credits)
 *
 * Split by account type and rearranged, that identity becomes:
 *
 *     Assets − Liabilities  =  Income − Expenses  =  Net Profit
 *
 * So the Balance Sheet balances **only because the P&L result is carried into it** as retained
 * earnings. This is the thing to know before "fixing" a Balance Sheet that appears out: omitting
 * net profit leaves it wrong by exactly the profit, and the instinct is then to plug the
 * difference somewhere, which hides the real error. `buildBalanceSheet()` carries the P&L in
 * explicitly and reports `isBalanced` so the identity is checked rather than assumed.
 *
 * The chart of accounts had no equity side at all before this milestone, which is why it could
 * not have balanced: there was nowhere for the profit to land.
 */

import type { JournalVoucher, AccountType } from './journalPosting';
import { accountByCode, accountName, normalBalanceOf, ACCOUNT } from './journalPosting';
import { sumMoney, roundMoney, moneyEquals } from './money';

/* ─────────────────────────────── Cash Book (M46) ─────────────────────────────── */

export interface CashBookRow {
  date: string;
  voucherNo: string;
  narration: string;
  /** Money into the account. */
  receipt: number;
  /** Money out of it. */
  payment: number;
  balance: number;
}

export interface CashBook {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  rows: CashBookRow[];
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
  /** opening + receipts − payments must equal closing. Checked, not trusted. */
  reconciles: boolean;
}

/**
 * Chronological movement of one cash or bank account.
 *
 * The opening balance is everything posted *before* the window, so the book is continuous rather
 * than restarting at zero each period — a cash book that opens at zero every morning would show
 * a closing balance that has nothing to do with what is in the drawer.
 */
export function buildCashBook(
  journal: JournalVoucher[],
  accountCode: string,
  fromDate: string,
  toDate: string
): CashBook {
  const movementsFor = (vouchers: JournalVoucher[]) =>
    vouchers.flatMap(v =>
      v.lines
        .filter(l => l.accountCode === accountCode)
        .map(l => ({ voucher: v, receipt: l.debit, payment: l.credit }))
    );

  // Cash and bank are assets: a debit increases them.
  const opening = roundMoney(
    movementsFor(journal.filter(v => v.date < fromDate))
      .reduce((s, m) => s + m.receipt - m.payment, 0)
  );

  const inWindow = journal
    .filter(v => v.date >= fromDate && v.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo));

  let running = opening;
  const rows: CashBookRow[] = movementsFor(inWindow).map(m => {
    running = roundMoney(running + m.receipt - m.payment);
    return {
      date: m.voucher.date,
      voucherNo: m.voucher.voucherNo,
      narration: m.voucher.narration,
      receipt: m.receipt,
      payment: m.payment,
      balance: running,
    };
  });

  const totalReceipts = sumMoney(rows.map(r => r.receipt));
  const totalPayments = sumMoney(rows.map(r => r.payment));
  const closing = roundMoney(opening + totalReceipts - totalPayments);

  return {
    accountCode,
    accountName: accountName(accountCode),
    openingBalance: opening,
    rows,
    totalReceipts,
    totalPayments,
    closingBalance: closing,
    reconciles: moneyEquals(closing, opening + totalReceipts - totalPayments),
  };
}

/* ─────────────────────────────── Balances by type ─────────────────────────────── */

export interface AccountBalance {
  code: string;
  name: string;
  type: AccountType;
  group: string;
  debit: number;
  credit: number;
  /** Positive in the account's own normal direction. */
  balance: number;
}

export function balancesUpTo(journal: JournalVoucher[], toDate: string): AccountBalance[] {
  const totals = new Map<string, { debit: number; credit: number }>();

  for (const v of journal.filter(x => x.date <= toDate)) {
    for (const l of v.lines) {
      const t = totals.get(l.accountCode) ?? { debit: 0, credit: 0 };
      t.debit += l.debit;
      t.credit += l.credit;
      totals.set(l.accountCode, t);
    }
  }

  return [...totals.entries()]
    .map(([code, t]) => {
      const account = accountByCode(code);
      const type = (account?.type ?? 'ASSET') as AccountType;
      const debit = roundMoney(t.debit);
      const credit = roundMoney(t.credit);
      return {
        code,
        name: accountName(code),
        type,
        group: account?.group ?? 'Unclassified',
        debit,
        credit,
        balance: normalBalanceOf(type) === 'DEBIT'
          ? roundMoney(debit - credit)
          : roundMoney(credit - debit),
      };
    })
    .filter(b => b.debit !== 0 || b.credit !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/* ─────────────────────────────── Profit & Loss (M47) ─────────────────────────────── */

export interface StatementLine {
  code: string;
  name: string;
  group: string;
  amount: number;
}

export interface ProfitAndLoss {
  fromDate: string;
  toDate: string;
  income: StatementLine[];
  expenses: StatementLine[];
  totalIncome: number;
  totalExpenses: number;
  /** Positive = profit, negative = loss. This figure is what the Balance Sheet carries. */
  netProfit: number;
}

export function buildProfitAndLoss(
  journal: JournalVoucher[],
  fromDate: string,
  toDate: string
): ProfitAndLoss {
  // P&L is a PERIOD statement — only what happened inside the window, unlike the Balance Sheet
  // which is cumulative to a date. Mixing the two is how a P&L ends up showing lifetime revenue.
  const inWindow = journal.filter(v => v.date >= fromDate && v.date <= toDate);
  const balances = balancesUpTo(inWindow, toDate);

  const pick = (type: AccountType): StatementLine[] =>
    balances
      .filter(b => b.type === type && b.balance !== 0)
      .map(b => ({ code: b.code, name: b.name, group: b.group, amount: b.balance }));

  const income = pick('INCOME');
  const expenses = pick('EXPENSE');
  const totalIncome = sumMoney(income.map(l => l.amount));
  const totalExpenses = sumMoney(expenses.map(l => l.amount));

  return {
    fromDate,
    toDate,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit: roundMoney(totalIncome - totalExpenses),
  };
}

/* ─────────────────────────────── Balance Sheet (M47) ─────────────────────────────── */

export interface BalanceSheet {
  asOnDate: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  totalAssets: number;
  totalLiabilities: number;
  /** The P&L result, carried in — without it the sheet cannot balance. */
  retainedEarnings: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  /** Non-zero only if something is genuinely wrong; surfaced rather than plugged. */
  difference: number;
}

/**
 * Assets on one side; liabilities plus retained earnings on the other.
 *
 * `retainedEarnings` is the cumulative P&L to the same date, not the period's. A Balance Sheet is
 * a position statement: it must carry every rupee of profit ever earned, not just this month's,
 * or it will be out by all prior periods.
 */
export function buildBalanceSheet(journal: JournalVoucher[], asOnDate: string): BalanceSheet {
  const balances = balancesUpTo(journal, asOnDate);

  const pick = (type: AccountType): StatementLine[] =>
    balances
      .filter(b => b.type === type && b.balance !== 0)
      .map(b => ({ code: b.code, name: b.name, group: b.group, amount: b.balance }));

  const assets = pick('ASSET');
  const liabilities = pick('LIABILITY');
  const totalAssets = sumMoney(assets.map(l => l.amount));
  const totalLiabilities = sumMoney(liabilities.map(l => l.amount));

  // Cumulative, deliberately: everything from the first voucher to this date.
  const lifetime = buildProfitAndLoss(journal, '0000-01-01', asOnDate);
  const retainedEarnings = lifetime.netProfit;

  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + retainedEarnings);

  return {
    asOnDate,
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    retainedEarnings,
    totalLiabilitiesAndEquity,
    isBalanced: moneyEquals(totalAssets, totalLiabilitiesAndEquity),
    difference: roundMoney(totalAssets - totalLiabilitiesAndEquity),
  };
}

/**
 * Groups statement lines for display, preserving the chart's own grouping.
 * Sorted by group name so two runs render identically.
 */
export function groupLines(lines: StatementLine[]): { group: string; lines: StatementLine[]; total: number }[] {
  const map = new Map<string, StatementLine[]>();
  for (const l of lines) {
    map.set(l.group, [...(map.get(l.group) ?? []), l]);
  }
  return [...map.entries()]
    .map(([group, ls]) => ({ group, lines: ls, total: sumMoney(ls.map(l => l.amount)) }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

/** Cash and bank accounts a Cash Book can be built for. */
export const CASH_BOOK_ACCOUNTS = [ACCOUNT.CASH, ACCOUNT.BANK];
