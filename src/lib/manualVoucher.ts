/**
 * Manual Payment / Receipt / Contra vouchers (PRD §10.3/§10.5, Milestone 45).
 *
 * Milestone 28 derives journals from business documents — a sale posts itself. But money moves
 * for reasons no document covers: rent paid, a cash deposit into the bank, a supplier settled.
 * Those need manual entry, and they post through the **same** journal engine so the books stay
 * one set of records rather than two.
 *
 * ─── Why Contra is validated differently ──────────────────────────────────────────────
 * A Contra is cash↔bank only. Depositing ₹50,000 of takings into the bank does not make the shop
 * ₹50,000 richer or poorer — it is the same money in a different place. If either leg were
 * allowed to touch an income or expense account, the entry would silently create profit or loss
 * out of a movement that changed nothing. `validateManualVoucher()` therefore restricts a Contra
 * to accounts in the cash/bank family, which is what makes "a contra never touches P&L" a
 * structural guarantee rather than a convention.
 */

import type { ManualVoucher, ManualVoucherType } from '../types';
import type { JournalVoucher } from './journalPosting';
import { accountByCode, accountName, ACCOUNT } from './journalPosting';
import { financialYearOf } from './eInvoice';
import { roundMoney, moneyEquals } from './money';

export const VOUCHER_TYPE_LABEL: Record<ManualVoucherType, string> = {
  PAYMENT: 'Payment',
  RECEIPT: 'Receipt',
  CONTRA: 'Contra',
};

const PREFIX: Record<ManualVoucherType, string> = {
  PAYMENT: 'PAY',
  RECEIPT: 'REC',
  CONTRA: 'CON',
};

/** The accounts money can physically sit in. A Contra may only move value between these. */
export const CASH_AND_BANK: string[] = [ACCOUNT.CASH, ACCOUNT.BANK];

export function isCashOrBank(code: string): boolean {
  return CASH_AND_BANK.includes(code);
}

export function nextVoucherNumber(
  type: ManualVoucherType,
  existing: ManualVoucher[],
  onIsoDate: string
): string {
  const prefix = `${PREFIX[type]}-${financialYearOf(onIsoDate)}-`;
  const highest = existing
    .filter(v => v.type === type)
    .map(v => v.voucherNo)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

/**
 * The two legs of a manual voucher, in the direction its type implies.
 *
 * A Payment moves money OUT: the cash/bank account is credited and whatever it was spent on is
 * debited. A Receipt is the mirror. Stating it here once means no screen has to reason about
 * which side is which.
 */
export function voucherLegs(v: {
  type: ManualVoucherType;
  moneyAccount: string;
  againstAccount: string;
}): { debitAccount: string; creditAccount: string } {
  if (v.type === 'PAYMENT') {
    return { debitAccount: v.againstAccount, creditAccount: v.moneyAccount };
  }
  // RECEIPT and CONTRA both bring value INTO the named money account.
  return { debitAccount: v.moneyAccount, creditAccount: v.againstAccount };
}

export interface ManualVoucherDraft {
  type?: ManualVoucherType;
  date?: string;
  moneyAccount?: string;
  againstAccount?: string;
  amount?: number;
  narration?: string;
  branchId?: string;
}

export function validateManualVoucher(draft: ManualVoucherDraft): string | null {
  if (!draft.type) return 'Choose the voucher type.';
  if (!draft.date) return 'Set the voucher date.';
  if (!draft.moneyAccount) return 'Select the cash or bank account.';
  if (!draft.againstAccount) return 'Select the account on the other side.';

  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than zero.';

  if ((draft.narration ?? '').trim().length < 5) {
    // A manual entry has no source document behind it, so the narration IS the audit trail.
    return 'Write a narration — a manual voucher has no source document, so this is its only explanation.';
  }

  if (draft.moneyAccount === draft.againstAccount) {
    return 'The two sides of a voucher must be different accounts.';
  }

  if (!isCashOrBank(draft.moneyAccount)) {
    return `${accountName(draft.moneyAccount)} is not a cash or bank account.`;
  }

  if (draft.type === 'CONTRA') {
    /**
     * Both legs must be cash or bank. Allowing an income or expense account here would turn a
     * movement that changed nothing into a profit or a loss.
     */
    if (!isCashOrBank(draft.againstAccount)) {
      return `A Contra only moves money between cash and bank. ${accountName(draft.againstAccount)} is neither — use a Payment or Receipt instead.`;
    }
  } else if (isCashOrBank(draft.againstAccount)) {
    return `Moving money between cash and bank is a Contra, not a ${VOUCHER_TYPE_LABEL[draft.type]}.`;
  }

  const against = accountByCode(draft.againstAccount);
  if (!against) return 'That account is not in the chart of accounts.';

  return null;
}

/** Converts a saved manual voucher into a journal voucher, so it joins the same books. */
export function postManualVoucher(v: ManualVoucher): JournalVoucher {
  const { debitAccount, creditAccount } = voucherLegs(v);
  const amount = roundMoney(v.amount);

  return {
    id: `jv-${v.id}`,
    voucherNo: v.voucherNo,
    date: v.date,
    // Manual vouchers reuse the journal engine's existing types rather than widening it.
    type: v.type === 'RECEIPT' ? 'SCHEME_COLLECTION' : v.type === 'PAYMENT' ? 'KARIGAR_PAYMENT' : 'KARIGAR_LABOUR',
    narration: v.narration,
    sourceType: 'ManualVoucher',
    sourceId: v.id,
    lines: [
      { accountCode: debitAccount, debit: amount, credit: 0 },
      { accountCode: creditAccount, debit: 0, credit: amount },
    ],
    branchId: v.branchId,
  };
}

/** A contra must leave total income and total expense untouched — asserted, not assumed. */
export function touchesProfitAndLoss(v: ManualVoucher): boolean {
  const { debitAccount, creditAccount } = voucherLegs(v);
  return [debitAccount, creditAccount].some(code => {
    const type = accountByCode(code)?.type;
    return type === 'INCOME' || type === 'EXPENSE';
  });
}

export interface ManualVoucherSummary {
  total: number;
  payments: number;
  receipts: number;
  contras: number;
  moneyOut: number;
  moneyIn: number;
  /** Contra volume, reported separately because it is neither in nor out — it is a move. */
  transferred: number;
}

export function summariseManualVouchers(vouchers: ManualVoucher[]): ManualVoucherSummary {
  const by = (t: ManualVoucherType) => vouchers.filter(v => v.type === t);
  const sum = (list: ManualVoucher[]) => roundMoney(list.reduce((s, v) => s + (Number(v.amount) || 0), 0));

  return {
    total: vouchers.length,
    payments: by('PAYMENT').length,
    receipts: by('RECEIPT').length,
    contras: by('CONTRA').length,
    moneyOut: sum(by('PAYMENT')),
    moneyIn: sum(by('RECEIPT')),
    transferred: sum(by('CONTRA')),
  };
}

/** Accounts offerable on the "against" side, filtered to what the type actually permits. */
export function selectableAgainstAccounts(
  type: ManualVoucherType,
  all: { code: string; name: string; type: string }[]
): { code: string; name: string; type: string }[] {
  if (type === 'CONTRA') return all.filter(a => isCashOrBank(a.code));
  return all.filter(a => !isCashOrBank(a.code));
}

/** Sanity check used by the tests and the UI: a posted voucher must balance. */
export function postsBalanced(v: ManualVoucher): boolean {
  const jv = postManualVoucher(v);
  const debit = jv.lines.reduce((s, l) => s + l.debit, 0);
  const credit = jv.lines.reduce((s, l) => s + l.credit, 0);
  return moneyEquals(debit, credit);
}
