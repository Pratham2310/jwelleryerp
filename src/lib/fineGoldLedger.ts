/**
 * Karigar Fine Gold Equivalent + append-only ledger (PRD §6.2, Milestone 16).
 *
 * Two things this replaces, both of which were genuinely wrong before:
 *
 * 1. Wastage was computed by subtracting raw grams (`issued - returned`), ignoring purity
 *    entirely. Issue 100g of 22K and receive back 95g of 18K and the old code called that a
 *    5g loss; in fine-gold terms it is 91.6g out, 71.25g back — a 20.35g loss. PRD §6.2 is
 *    explicit that comparison must be in Fine Gold Equivalent.
 *
 * 2. `Karigar.metalBalance` / `laborChargesOwed` were two mutable running totals with no
 *    history, so "how did we arrive at this balance" was unanswerable (KNOWN_ISSUES #10).
 *    Balances are now derived by folding an append-only entry list.
 *
 * Decision D-2 (Weight and Money are two parallel ledgers that never net against each other)
 * is enforced structurally: an entry carries EITHER a fine-weight delta OR a money delta.
 */

import type { KarigarLedgerEntry, KarigarLedgerEntryType } from '../types';

/**
 * Purity of each metal standard the app sells, as a percentage.
 * Used to normalise different-purity metal to a common 24KT-equivalent basis.
 */
export const METAL_PURITY_PERCENT: Record<string, number> = {
  'Gold (24K)': 99.9,
  'Gold (22K)': 91.6,
  'Gold (18K)': 75.0,
  'Silver (999)': 99.9,
  'Platinum (950)': 95.0,
};

/** Falls back to 24K-equivalent (100%) for an unknown metal rather than silently zeroing it. */
export function purityPercentForMetal(metalType: string): number {
  return METAL_PURITY_PERCENT[metalType] ?? 100;
}

const round3 = (n: number) => Number((Number(n) || 0).toFixed(3));

/** PRD §6.2: Fine Gold Equivalent = Gross Weight × Purity%. */
export function fineGoldEquivalent(grossWeight: number, purityPercent: number): number {
  const g = Number(grossWeight) || 0;
  const p = Math.min(100, Math.max(0, Number(purityPercent) || 0));
  return round3(g * (p / 100));
}

/**
 * PRD §6.2: Karigar Wastage % = (Fine Issued − Fine Returned) / Fine Issued × 100.
 * Returns 0 when nothing was issued, rather than Infinity/NaN.
 */
export function karigarWastagePercent(fineIssued: number, fineReturned: number): number {
  const issued = Number(fineIssued) || 0;
  if (issued <= 0) return 0;
  const returned = Number(fineReturned) || 0;
  return Number((((issued - returned) / issued) * 100).toFixed(3));
}

export interface WastageAssessment {
  fineIssued: number;
  fineReturned: number;
  fineLost: number;
  wastagePercent: number;
  allowedPercent: number;
  allowedFineWeight: number;
  excessFineWeight: number; // fine grams lost beyond the agreed cap — 0 if within
  isExcessive: boolean;
}

/**
 * Compares an issue against a receipt in fine-gold terms and splits the loss into the
 * agreed-and-absorbed portion and the excess that must be flagged (PRD §6.2; the
 * flag-for-owner-review workflow itself is Milestone 18).
 */
export function assessWastage(
  fineIssued: number,
  fineReturned: number,
  allowedPercent: number
): WastageAssessment {
  const issued = round3(fineIssued);
  const returned = round3(fineReturned);
  const allowed = Math.max(0, Number(allowedPercent) || 0);

  const fineLost = round3(Math.max(0, issued - returned));
  const allowedFineWeight = round3(issued * (allowed / 100));
  const excessFineWeight = round3(Math.max(0, fineLost - allowedFineWeight));

  return {
    fineIssued: issued,
    fineReturned: returned,
    fineLost,
    wastagePercent: karigarWastagePercent(issued, returned),
    allowedPercent: allowed,
    allowedFineWeight,
    excessFineWeight,
    isExcessive: excessFineWeight > 0,
  };
}

// ---------- Append-only ledger ----------

/** Entry types that move the WEIGHT ledger (fine grams owed BY karigar TO the shop). */
export const WEIGHT_ENTRY_TYPES: KarigarLedgerEntryType[] = [
  'METAL_ISSUED',
  'METAL_RETURNED',
  'WASTAGE_ALLOWED',
  'WASTAGE_EXCESS_WRITTEN_OFF',
  'SCRAP_RETURNED',
];

/** Entry types that move the MONEY ledger (rupees owed BY the shop TO the karigar). */
export const MONEY_ENTRY_TYPES: KarigarLedgerEntryType[] = ['LABOUR_CHARGED', 'LABOUR_PAID'];

export const LEDGER_ENTRY_LABEL: Record<KarigarLedgerEntryType, string> = {
  METAL_ISSUED: 'Metal Issued',
  METAL_RETURNED: 'Finished Goods Received',
  WASTAGE_ALLOWED: 'Wastage Allowed',
  WASTAGE_EXCESS_WRITTEN_OFF: 'Excess Wastage Written Off',
  SCRAP_RETURNED: 'Scrap / Filings Returned',
  LABOUR_CHARGED: 'Labour Charged',
  LABOUR_PAID: 'Labour Paid',
};

export interface KarigarBalance {
  /** Fine (24K-equivalent) grams the karigar still owes the shop. */
  fineWeightPayable: number;
  /** Rupees the shop still owes the karigar for labour. */
  moneyPayable: number;
  entryCount: number;
}

/**
 * Folds a karigar's entries into their two balances. This is the ONLY way a balance should
 * ever be obtained — never read from a stored running total (KNOWN_ISSUES #10 / D-2).
 */
export function deriveKarigarBalance(entries: KarigarLedgerEntry[], karigarId?: string): KarigarBalance {
  const scoped = karigarId ? entries.filter(e => e.karigarId === karigarId) : entries;

  let fineWeightPayable = 0;
  let moneyPayable = 0;

  for (const e of scoped) {
    fineWeightPayable += Number(e.fineWeightDelta) || 0;
    moneyPayable += Number(e.moneyDelta) || 0;
  }

  return {
    fineWeightPayable: round3(fineWeightPayable),
    moneyPayable: Math.round(moneyPayable),
    entryCount: scoped.length,
  };
}

/** Entries for one karigar, oldest first, each carrying the running balance after it. */
export interface LedgerRow extends KarigarLedgerEntry {
  runningFineWeight: number;
  runningMoney: number;
}

export function buildLedgerStatement(entries: KarigarLedgerEntry[], karigarId: string): LedgerRow[] {
  const scoped = entries
    .filter(e => e.karigarId === karigarId)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.sequence - b.sequence : a.date.localeCompare(b.date)));

  let fine = 0;
  let money = 0;
  return scoped.map(e => {
    fine += Number(e.fineWeightDelta) || 0;
    money += Number(e.moneyDelta) || 0;
    return { ...e, runningFineWeight: round3(fine), runningMoney: Math.round(money) };
  });
}

/**
 * Guards the one thing an append-only ledger cannot tolerate: an entry that moves both
 * ledgers at once, which would silently net weight against money (D-2).
 */
export function validateLedgerEntry(entry: Partial<KarigarLedgerEntry>): string | null {
  const hasWeight = entry.fineWeightDelta !== undefined && entry.fineWeightDelta !== 0;
  const hasMoney = entry.moneyDelta !== undefined && entry.moneyDelta !== 0;

  if (hasWeight && hasMoney) {
    return 'A ledger entry may move the weight ledger or the money ledger, never both (decision D-2).';
  }
  if (!hasWeight && !hasMoney) {
    return 'A ledger entry must move either the weight ledger or the money ledger.';
  }
  if (!entry.karigarId) return 'A ledger entry must belong to a karigar.';
  if (!entry.type) return 'A ledger entry must have a type.';
  return null;
}
