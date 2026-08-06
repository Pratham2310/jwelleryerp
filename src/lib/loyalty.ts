/**
 * Loyalty Points Engine (Milestone 59, PRD §12.4).
 *
 * `Customer.tier` and `Customer.loyaltyPoints` have existed since the first schema as decorative
 * fields — a number that never moved and a tier nobody earned. This makes them mean something.
 *
 * ─── Points earn on value added, never on metal ───────────────────────────────────────
 * The same rule as the incentive engine (M58), and it matters more here because the liability is
 * open-ended. If points accrue as a percentage of the whole bill, a shop rewards customers more
 * generously every time the gold rate rises — for the identical piece, sold identically. The
 * shop's margin lives in making charges and stone value; that is what a loyalty scheme can
 * afford to give back.
 *
 * ─── Redemption is a TENDER, not a discount ───────────────────────────────────────────
 * This is the mistake that turns a loyalty scheme into a tax problem. A discount reduces the
 * taxable value of the supply; redeeming points does not — the customer is paying with something
 * the shop previously issued. Treating redemption as a discount understates output GST on every
 * redeemed bill, which is precisely the error decision **D-10** already prevents for old gold.
 * So redemption settles the amount *due*, and the taxable value is untouched.
 *
 * ─── The ledger is append-only and the balance is derived ─────────────────────────────
 * Earning, redeeming and expiry are entries; the balance is computed from them. A stored balance
 * would drift the first time an expiry job ran twice or a redemption was reversed — the same
 * reasoning as karigar balances (M16) and scheme balances (M26).
 */

import { roundMoney } from './money';

export type LoyaltyEntryType = 'EARNED' | 'REDEEMED' | 'ADJUSTED';

export interface LoyaltyEntry {
  id: string;
  customerId: string;
  type: LoyaltyEntryType;
  /** Positive when earned or adjusted up, negative when redeemed or adjusted down. */
  points: number;
  at: string;
  /** Points expire; redemptions and adjustments do not. */
  expiresOn?: string;
  invoiceNumber?: string;
  note?: string;
}

export interface LoyaltyRule {
  /** Points granted per ₹100 of value added (making + stones). */
  pointsPerHundred: number;
  /** What one point is worth when redeemed, in paisa. */
  pointValuePaisa: number;
  /** Redemption cannot settle more than this share of a bill. */
  maxRedeemPercentOfBill: number;
  /** Points expire this many months after they are earned. */
  expiryMonths: number;
  /** Minimum balance before any redemption is allowed. */
  minRedeemPoints: number;
}

export const DEFAULT_LOYALTY_RULE: LoyaltyRule = {
  pointsPerHundred: 1,
  pointValuePaisa: 100,        // 1 point = ₹1
  maxRedeemPercentOfBill: 10,
  expiryMonths: 12,
  minRedeemPoints: 100,
};

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

/** Tiers run on **lifetime earned points**, not the current balance — spending should not demote. */
export const TIER_THRESHOLDS: { tier: LoyaltyTier; minLifetimePoints: number }[] = [
  { tier: 'Platinum', minLifetimePoints: 10000 },
  { tier: 'Gold', minLifetimePoints: 5000 },
  { tier: 'Silver', minLifetimePoints: 1000 },
  { tier: 'Bronze', minLifetimePoints: 0 },
];

export function tierFor(lifetimePoints: number): LoyaltyTier {
  return TIER_THRESHOLDS.find(t => lifetimePoints >= t.minLifetimePoints)?.tier ?? 'Bronze';
}

/* ─────────────────────────────── Earning ─────────────────────────────── */

/** Value the shop added on this bill, in paisa — making charges plus stone value. */
export function valueAddedPaisa(
  lines: { makingCharge?: number; stoneCharge?: number }[]
): number {
  return roundMoney(lines.reduce(
    (s, l) => s + ((l.makingCharge || 0) + (l.stoneCharge || 0)) * 100, 0
  ));
}

export function pointsEarned(valueAdded: number, rule: LoyaltyRule): number {
  if (valueAdded <= 0) return 0;
  return Math.floor((valueAdded / 10000) * rule.pointsPerHundred);
}

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return date;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildEarnEntry(
  customerId: string,
  points: number,
  invoiceNumber: string,
  rule: LoyaltyRule,
  at: string = new Date().toISOString().slice(0, 10)
): LoyaltyEntry {
  return {
    id: `loy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerId,
    type: 'EARNED',
    points,
    at,
    expiresOn: addMonths(at, rule.expiryMonths),
    invoiceNumber,
  };
}

/* ─────────────────────────────── Balance ─────────────────────────────── */

export interface LoyaltyBalance {
  lifetimeEarned: number;
  redeemed: number;
  expired: number;
  available: number;
  /** Points that will lapse within 60 days — the number worth telling a customer. */
  expiringSoon: number;
  nextExpiryDate: string | null;
  tier: LoyaltyTier;
}

export const EXPIRY_WARNING_DAYS = 60;

/**
 * Derives the balance, consuming **oldest points first**.
 *
 * FIFO matters: redeeming the newest points first would let older ones lapse while the customer
 * still had a usable balance, which is the behaviour that generates complaints. Expiry is
 * computed here rather than written as entries, so re-running this can never double-count.
 */
export function deriveBalance(
  entries: LoyaltyEntry[],
  today: string = new Date().toISOString().slice(0, 10)
): LoyaltyBalance {
  const earned = entries
    .filter(e => e.type === 'EARNED' || (e.type === 'ADJUSTED' && e.points > 0))
    .sort((a, b) => a.at.localeCompare(b.at));

  const spent = Math.abs(entries
    .filter(e => e.type === 'REDEEMED' || (e.type === 'ADJUSTED' && e.points < 0))
    .reduce((s, e) => s + e.points, 0));

  const lifetimeEarned = earned.reduce((s, e) => s + e.points, 0);

  // Walk the earned lots oldest-first, consuming redemptions, then age what remains.
  let toConsume = spent;
  let available = 0;
  let expired = 0;
  let expiringSoon = 0;
  let nextExpiryDate: string | null = null;
  const warnBefore = addDays(today, EXPIRY_WARNING_DAYS);

  for (const lot of earned) {
    let remaining = lot.points;
    if (toConsume > 0) {
      const used = Math.min(toConsume, remaining);
      remaining -= used;
      toConsume -= used;
    }
    if (remaining <= 0) continue;

    if (lot.expiresOn && lot.expiresOn < today) {
      expired += remaining;
      continue;
    }
    available += remaining;
    if (lot.expiresOn && lot.expiresOn <= warnBefore) {
      expiringSoon += remaining;
      if (!nextExpiryDate || lot.expiresOn < nextExpiryDate) nextExpiryDate = lot.expiresOn;
    }
  }

  return {
    lifetimeEarned,
    redeemed: spent,
    expired,
    available,
    expiringSoon,
    nextExpiryDate,
    tier: tierFor(lifetimeEarned),
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function entriesFor(entries: LoyaltyEntry[], customerId: string): LoyaltyEntry[] {
  return entries
    .filter(e => e.customerId === customerId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/* ─────────────────────────────── Redemption ─────────────────────────────── */

export interface RedemptionQuote {
  maxPoints: number;
  maxValuePaisa: number;
  capReason: 'BALANCE' | 'BILL_CAP' | 'BELOW_MINIMUM' | 'NONE';
}

/**
 * How much a customer may redeem against a given bill. Capped by their balance, by the per-bill
 * share the rule allows, and refused entirely below the minimum — the cap exists so a loyalty
 * scheme discounts the margin rather than replacing the sale.
 */
export function quoteRedemption(
  balance: LoyaltyBalance,
  billTotalPaisa: number,
  rule: LoyaltyRule
): RedemptionQuote {
  if (balance.available < rule.minRedeemPoints) {
    return { maxPoints: 0, maxValuePaisa: 0, capReason: 'BELOW_MINIMUM' };
  }
  const byBalance = balance.available;
  const capPaisa = roundMoney((billTotalPaisa * rule.maxRedeemPercentOfBill) / 100);
  const byBill = Math.floor(capPaisa / rule.pointValuePaisa);

  const maxPoints = Math.max(0, Math.min(byBalance, byBill));
  return {
    maxPoints,
    maxValuePaisa: roundMoney(maxPoints * rule.pointValuePaisa),
    capReason: maxPoints === 0 ? 'BILL_CAP' : byBill < byBalance ? 'BILL_CAP' : 'BALANCE',
  };
}

export function validateRedemption(
  points: number,
  balance: LoyaltyBalance,
  billTotalPaisa: number,
  rule: LoyaltyRule
): string | null {
  if (!Number.isFinite(points) || points <= 0) return 'Enter the points to redeem.';
  if (points > balance.available) {
    return `Only ${balance.available} point(s) available.`;
  }
  if (balance.available < rule.minRedeemPoints) {
    return `A minimum of ${rule.minRedeemPoints} points is needed before redeeming.`;
  }
  const quote = quoteRedemption(balance, billTotalPaisa, rule);
  if (points > quote.maxPoints) {
    return `This bill allows at most ${quote.maxPoints} point(s) — `
      + `${rule.maxRedeemPercentOfBill}% of its value.`;
  }
  return null;
}

export function buildRedeemEntry(
  customerId: string,
  points: number,
  invoiceNumber: string,
  at: string = new Date().toISOString().slice(0, 10)
): LoyaltyEntry {
  return {
    id: `loy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerId,
    type: 'REDEEMED',
    points: -Math.abs(points),
    at,
    invoiceNumber,
  };
}

export function redemptionValuePaisa(points: number, rule: LoyaltyRule): number {
  return roundMoney(Math.abs(points) * rule.pointValuePaisa);
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface LoyaltySummary {
  membersWithPoints: number;
  outstandingPoints: number;
  /** What the shop would owe if everyone redeemed today — points are a liability. */
  liabilityPaisa: number;
  expiringSoonPoints: number;
  redeemedThisPeriod: number;
}

export function summariseLoyalty(
  entries: LoyaltyEntry[],
  rule: LoyaltyRule,
  today: string = new Date().toISOString().slice(0, 10)
): LoyaltySummary {
  const ids = [...new Set(entries.map(e => e.customerId))];
  const balances = ids.map(id => deriveBalance(entriesFor(entries, id), today));
  const withPoints = balances.filter(b => b.available > 0);
  const outstanding = withPoints.reduce((s, b) => s + b.available, 0);

  return {
    membersWithPoints: withPoints.length,
    outstandingPoints: outstanding,
    liabilityPaisa: roundMoney(outstanding * rule.pointValuePaisa),
    expiringSoonPoints: balances.reduce((s, b) => s + b.expiringSoon, 0),
    redeemedThisPeriod: Math.abs(
      entries.filter(e => e.type === 'REDEEMED').reduce((s, e) => s + e.points, 0)
    ),
  };
}

export function validateRule(draft: Partial<LoyaltyRule>): string | null {
  if (!Number.isFinite(draft.pointsPerHundred) || (draft.pointsPerHundred ?? 0) <= 0) {
    return 'Points per ₹100 must be above zero.';
  }
  if (!Number.isFinite(draft.pointValuePaisa) || (draft.pointValuePaisa ?? 0) <= 0) {
    return 'A point must be worth something when redeemed.';
  }
  if (!Number.isFinite(draft.maxRedeemPercentOfBill)
      || (draft.maxRedeemPercentOfBill ?? 0) <= 0
      || (draft.maxRedeemPercentOfBill ?? 0) > 100) {
    return 'The per-bill redemption cap must be between 1% and 100%.';
  }
  if (!Number.isFinite(draft.expiryMonths) || (draft.expiryMonths ?? 0) <= 0) {
    // Points that never expire are an unbounded liability that grows forever.
    return 'Set an expiry. Points that never lapse are a liability that only grows.';
  }
  return null;
}
