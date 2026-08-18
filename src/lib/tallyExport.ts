/**
 * Tally Prime XML export (PRD §10.5, Handbook Phase 8, Milestone 29).
 *
 * A downloaded file only — there is no Tally integration and no network call, per the
 * simulation ground rule in `.ai/IMPLEMENTATION_WORKFLOW.md`. What matters is that the file is
 * shaped the way Tally's import actually expects, because a jeweller's accountant will drop it
 * straight into Tally and a malformed voucher fails the whole import silently.
 *
 * ─── Three conventions that are easy to get wrong ──────────────────────────────────────
 *
 * **1. Tally's sign convention is inverted from the ledger's.**
 * In Tally XML a DEBIT carries a NEGATIVE `<AMOUNT>` and `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`;
 * a CREDIT carries a POSITIVE amount and `No`. That reads backwards to anyone who has just written
 * a double-entry engine, and getting it wrong produces a file that imports cleanly and puts every
 * figure on the wrong side of every account.
 *
 * **2. Dates are `YYYYMMDD` with no separators.** `2026-07-20` is rejected; `20260720` is not.
 *
 * **3. Ledger names must be XML-escaped.** This is not hypothetical here: the seeded supplier is
 * "Zaveri Bullion & Refinery Co." — a raw `&` makes the document malformed and Tally refuses the
 * entire import, not just that voucher.
 */

import type { JournalVoucher, VoucherType } from './journalPosting';
import { accountName, isBalanced } from './journalPosting';
import { roundToPaisa } from './money';

/** Tally's own voucher-type names. Ours are internal; these are what Tally expects to see. */
export const TALLY_VOUCHER_TYPE: Record<VoucherType, string> = {
  SALES: 'Sales',
  CREDIT_NOTE: 'Credit Note',
  OLD_GOLD_PURCHASE: 'Purchase',
  KARIGAR_LABOUR: 'Journal',
  KARIGAR_PAYMENT: 'Payment',
  SCHEME_COLLECTION: 'Receipt',
};

/** The five characters XML reserves. An unescaped `&` in a ledger name kills the whole import. */
export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `2026-07-20` → `20260720`. Tally rejects separators. */
export function tallyDate(isoDate: string): string {
  return String(isoDate ?? '').slice(0, 10).replace(/-/g, '');
}

/** Always two decimals — Tally treats a bare integer as rupees but the format expects paisa. */
export function tallyAmount(value: number): string {
  return roundToPaisa(Number(value) || 0).toFixed(2);
}

export interface TallyLedgerEntry {
  ledgerName: string;
  isDeemedPositive: boolean;
  amount: number;
}

/**
 * Maps one journal line to Tally's representation, applying the inverted sign convention.
 *
 * A debit of 1000 becomes `amount: -1000, isDeemedPositive: true`. That is not a bug — see the
 * module header. Reversing it would import cleanly and mirror every account.
 */
export function toTallyEntry(accountCode: string, debit: number, credit: number): TallyLedgerEntry {
  const isDebit = debit > 0;
  const magnitude = isDebit ? debit : credit;
  return {
    ledgerName: accountName(accountCode),
    isDeemedPositive: isDebit,
    amount: isDebit ? -roundToPaisa(magnitude) : roundToPaisa(magnitude),
  };
}

export function voucherEntries(voucher: JournalVoucher): TallyLedgerEntry[] {
  return voucher.lines.map(l => toTallyEntry(l.accountCode, l.debit, l.credit));
}

/**
 * The party ledger Tally shows on the voucher head. Falls back to the first debited account,
 * which is the conventional choice for a sales voucher.
 */
export function partyLedgerName(voucher: JournalVoucher): string {
  const firstDebit = voucher.lines.find(l => l.debit > 0);
  return accountName(firstDebit?.accountCode ?? voucher.lines[0]?.accountCode ?? '');
}

function voucherXml(voucher: JournalVoucher): string {
  const entries = voucherEntries(voucher)
    .map(e => [
      '          <ALLLEDGERENTRIES.LIST>',
      `            <LEDGERNAME>${escapeXml(e.ledgerName)}</LEDGERNAME>`,
      `            <ISDEEMEDPOSITIVE>${e.isDeemedPositive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`,
      `            <AMOUNT>${tallyAmount(e.amount)}</AMOUNT>`,
      '          </ALLLEDGERENTRIES.LIST>',
    ].join('\n'))
    .join('\n');

  const type = TALLY_VOUCHER_TYPE[voucher.type] ?? 'Journal';

  return [
    '        <TALLYMESSAGE xmlns:UDF="TallyUDF">',
    `          <VOUCHER VCHTYPE="${escapeXml(type)}" ACTION="Create" OBJVIEW="Accounting Voucher View">`,
    `            <DATE>${tallyDate(voucher.date)}</DATE>`,
    `            <VOUCHERTYPENAME>${escapeXml(type)}</VOUCHERTYPENAME>`,
    `            <VOUCHERNUMBER>${escapeXml(voucher.voucherNo)}</VOUCHERNUMBER>`,
    `            <PARTYLEDGERNAME>${escapeXml(partyLedgerName(voucher))}</PARTYLEDGERNAME>`,
    `            <NARRATION>${escapeXml(voucher.narration)}</NARRATION>`,
    entries,
    '          </VOUCHER>',
    '        </TALLYMESSAGE>',
  ].join('\n');
}

export interface TallyExportOptions {
  companyName: string;
  fromDate: string;
  toDate: string;
}

/**
 * Builds the complete import file.
 *
 * **Unbalanced vouchers are excluded, not silently repaired.** Tally rejects an import whose
 * debits and credits disagree, and a file that fails at the accountant's desk with no explanation
 * is worse than one that is short a voucher and says so. `summariseExport()` reports what was
 * dropped so the omission is visible before the file leaves.
 */
export function buildTallyXml(vouchers: JournalVoucher[], options: TallyExportOptions): string {
  const exportable = vouchers.filter(isBalanced);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ENVELOPE>',
    '  <HEADER>',
    '    <TALLYREQUEST>Import Data</TALLYREQUEST>',
    '  </HEADER>',
    '  <BODY>',
    '    <IMPORTDATA>',
    '      <REQUESTDESC>',
    '        <REPORTNAME>Vouchers</REPORTNAME>',
    '        <STATICVARIABLES>',
    `          <SVCURRENTCOMPANY>${escapeXml(options.companyName)}</SVCURRENTCOMPANY>`,
    `          <SVFROMDATE>${tallyDate(options.fromDate)}</SVFROMDATE>`,
    `          <SVTODATE>${tallyDate(options.toDate)}</SVTODATE>`,
    '        </STATICVARIABLES>',
    '      </REQUESTDESC>',
    '      <REQUESTDATA>',
    ...exportable.map(voucherXml),
    '      </REQUESTDATA>',
    '    </IMPORTDATA>',
    '  </BODY>',
    '</ENVELOPE>',
  ].join('\n');
}

/* ─────────────────────────────── Selection & reporting ─────────────────────────────── */

export function vouchersInPeriod(
  vouchers: JournalVoucher[],
  fromDate: string,
  toDate: string
): JournalVoucher[] {
  return vouchers
    .filter(v => v.date >= fromDate && v.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo));
}

export interface ExportSummary {
  totalVouchers: number;
  exportable: number;
  /** Vouchers left out because they do not balance — Tally would reject the whole file. */
  excludedUnbalanced: number;
  totalDebit: number;
  totalCredit: number;
  byType: { type: string; count: number }[];
}

export function summariseExport(vouchers: JournalVoucher[]): ExportSummary {
  const exportable = vouchers.filter(isBalanced);
  const counts = new Map<string, number>();
  for (const v of exportable) {
    const name = TALLY_VOUCHER_TYPE[v.type] ?? 'Journal';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const sum = (pick: (l: { debit: number; credit: number }) => number) =>
    roundToPaisa(exportable.flatMap(v => v.lines).reduce((t, l) => t + pick(l), 0));

  return {
    totalVouchers: vouchers.length,
    exportable: exportable.length,
    excludedUnbalanced: vouchers.length - exportable.length,
    totalDebit: sum(l => l.debit),
    totalCredit: sum(l => l.credit),
    byType: [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type)),
  };
}

export function validateExportRange(fromDate: string, toDate: string): string | null {
  if (!fromDate) return 'Choose a start date for the export.';
  if (!toDate) return 'Choose an end date for the export.';
  if (toDate < fromDate) return 'The end date cannot be before the start date.';
  return null;
}

/** `Aurum_Tally_20260701_20260731.xml` — period in the name, so files do not overwrite. */
export function exportFileName(fromDate: string, toDate: string): string {
  return `Aurum_Tally_${tallyDate(fromDate)}_${tallyDate(toDate)}.xml`;
}
