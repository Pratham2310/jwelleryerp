import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOYALTY_RULE,
  EXPIRY_WARNING_DAYS,
  tierFor,
  valueAddedPaisa,
  pointsEarned,
  addMonths,
  buildEarnEntry,
  deriveBalance,
  entriesFor,
  quoteRedemption,
  validateRedemption,
  buildRedeemEntry,
  redemptionValuePaisa,
  summariseLoyalty,
  validateRule,
  type LoyaltyEntry,
  type LoyaltyRule,
} from './loyalty';

const rule = (over: Partial<LoyaltyRule> = {}): LoyaltyRule => ({ ...DEFAULT_LOYALTY_RULE, ...over });
const TODAY = '2026-08-06';

const earn = (points: number, at: string, expiresOn?: string): LoyaltyEntry => ({
  id: `e-${at}-${points}`, customerId: 'c1', type: 'EARNED', points, at,
  expiresOn: expiresOn ?? addMonths(at, 12),
});
const redeem = (points: number, at: string): LoyaltyEntry => ({
  id: `r-${at}`, customerId: 'c1', type: 'REDEEMED', points: -points, at,
});

describe('earning is on value added, never on metal', () => {
  it('counts making charges and stone value only', () => {
    expect(valueAddedPaisa([{ makingCharge: 5000, stoneCharge: 2000 }])).toBe(700000);
  });

  it('is unaffected by how expensive the metal was', () => {
    // Otherwise a shop rewards customers more generously every time gold rises, for the
    // identical piece sold identically.
    const lines = [{ makingCharge: 5000, stoneCharge: 2000 }];
    expect(valueAddedPaisa(lines)).toBe(valueAddedPaisa(lines));
  });

  it('grants points per ₹100 of value added', () => {
    expect(pointsEarned(700000, rule({ pointsPerHundred: 1 }))).toBe(70);
    expect(pointsEarned(700000, rule({ pointsPerHundred: 2 }))).toBe(140);
  });

  it('rounds down — never grants a fraction of a point', () => {
    expect(pointsEarned(15000, rule())).toBe(1);
  });

  it('grants nothing on a bill with no value added', () => {
    expect(pointsEarned(0, rule())).toBe(0);
  });

  it('stamps an expiry when earning', () => {
    const e = buildEarnEntry('c1', 70, 'MUM-1', rule({ expiryMonths: 12 }), '2026-08-06');
    expect(e.expiresOn).toBe('2027-08-06');
    expect(e.type).toBe('EARNED');
  });
});

describe('balance is derived, oldest points consumed first', () => {
  it('sums unexpired earnings', () => {
    const b = deriveBalance([earn(100, '2026-07-01'), earn(50, '2026-08-01')], TODAY);
    expect(b.available).toBe(150);
    expect(b.lifetimeEarned).toBe(150);
  });

  it('CONSUMES THE OLDEST LOT FIRST', () => {
    // Redeeming the newest first would let older points lapse while a usable balance existed —
    // the behaviour that generates complaints.
    const entries = [
      earn(100, '2025-09-01', '2026-09-01'),   // expires soon
      earn(100, '2026-08-01', '2027-08-01'),
      redeem(100, '2026-08-05'),
    ];
    const b = deriveBalance(entries, TODAY);
    expect(b.available).toBe(100);
    expect(b.expiringSoon).toBe(0);            // the old lot was the one spent
  });

  it('ages out an expired lot without touching newer ones', () => {
    const b = deriveBalance([
      earn(100, '2025-01-01', '2026-01-01'),   // lapsed
      earn(40, '2026-08-01'),
    ], TODAY);
    expect(b.expired).toBe(100);
    expect(b.available).toBe(40);
  });

  it('never double-counts expiry when re-derived', () => {
    const entries = [earn(100, '2025-01-01', '2026-01-01')];
    expect(deriveBalance(entries, TODAY).expired).toBe(100);
    expect(deriveBalance(entries, TODAY).expired).toBe(100);
  });

  it('warns about points lapsing within the window', () => {
    const soon = addMonths(TODAY, 1);
    const b = deriveBalance([earn(80, '2025-09-06', soon)], TODAY);
    expect(b.expiringSoon).toBe(80);
    expect(b.nextExpiryDate).toBe(soon);
    expect(EXPIRY_WARNING_DAYS).toBe(60);
  });

  it('reports redeemed separately from expired', () => {
    const b = deriveBalance([earn(100, '2026-07-01'), redeem(30, '2026-08-01')], TODAY);
    expect(b.redeemed).toBe(30);
    expect(b.available).toBe(70);
    expect(b.expired).toBe(0);
  });

  it('handles a customer with no entries', () => {
    expect(deriveBalance([], TODAY)).toMatchObject({ available: 0, tier: 'Bronze' });
  });

  it('filters to one customer', () => {
    const mixed = [earn(100, '2026-07-01'), { ...earn(500, '2026-07-01'), customerId: 'c2' }];
    expect(entriesFor(mixed, 'c1')).toHaveLength(1);
  });
});

describe('tiers run on lifetime earned, not the current balance', () => {
  it('promotes by lifetime points', () => {
    expect(tierFor(0)).toBe('Bronze');
    expect(tierFor(1000)).toBe('Silver');
    expect(tierFor(5000)).toBe('Gold');
    expect(tierFor(10000)).toBe('Platinum');
  });

  it('does NOT demote a customer for spending their points', () => {
    // Spending is the behaviour the scheme wants; punishing it would be perverse.
    const b = deriveBalance([earn(6000, '2026-01-01'), redeem(5900, '2026-08-01')], TODAY);
    expect(b.available).toBe(100);
    expect(b.tier).toBe('Gold');
  });
});

describe('redemption is capped', () => {
  const balance = deriveBalance([earn(5000, '2026-07-01')], TODAY);

  it('caps at the per-bill share the rule allows', () => {
    // ₹10,000 bill, 10% cap, 1 point = ₹1 → 1000 points, well under the 5000 balance.
    const q = quoteRedemption(balance, 1000000, rule());
    expect(q.maxPoints).toBe(1000);
    expect(q.maxValuePaisa).toBe(100000);
    expect(q.capReason).toBe('BILL_CAP');
  });

  it('caps at the balance when the bill is large enough to allow more', () => {
    // ₹1,00,000 bill allows 10,000 points, but only 5000 are held.
    const q = quoteRedemption(balance, 10000000, rule());
    expect(q.maxPoints).toBe(5000);
    expect(q.capReason).toBe('BALANCE');
  });

  it('caps at the balance when that is the smaller limit', () => {
    const small = deriveBalance([earn(200, '2026-07-01')], TODAY);
    expect(quoteRedemption(small, 10000000, rule()).maxPoints).toBe(200);
  });

  it('refuses below the minimum balance', () => {
    const tiny = deriveBalance([earn(50, '2026-07-01')], TODAY);
    const q = quoteRedemption(tiny, 10000000, rule({ minRedeemPoints: 100 }));
    expect(q.maxPoints).toBe(0);
    expect(q.capReason).toBe('BELOW_MINIMUM');
  });

  it('rejects redeeming more than available', () => {
    expect(validateRedemption(9999, balance, 10000000, rule())).toMatch(/only 5000 point/i);
  });

  it('rejects redeeming past the bill cap, naming the percentage', () => {
    // A ₹10,000 bill allows 1000 points; asking for 2000 must be refused.
    expect(validateRedemption(2000, balance, 1000000, rule()))
      .toMatch(/at most 1000 point\(s\) — 10% of its value/i);
  });

  it('accepts a redemption inside both limits', () => {
    expect(validateRedemption(500, balance, 1000000, rule())).toBeNull();
  });

  it('rejects zero or negative', () => {
    expect(validateRedemption(0, balance, 10000000, rule())).toMatch(/enter the points/i);
  });

  it('values points in paisa', () => {
    expect(redemptionValuePaisa(500, rule({ pointValuePaisa: 100 }))).toBe(50000);
  });

  it('records a redemption as a negative entry', () => {
    const e = buildRedeemEntry('c1', 500, 'MUM-1', TODAY);
    expect(e.points).toBe(-500);
    expect(e.type).toBe('REDEEMED');
    expect(e.expiresOn).toBeUndefined();   // a redemption does not expire
  });
});

describe('summariseLoyalty — points are a liability', () => {
  const entries = [
    earn(500, '2026-07-01'),
    { ...earn(300, '2026-07-01'), customerId: 'c2', id: 'x' },
    redeem(100, '2026-08-01'),
  ];

  it('counts members holding points and what they hold', () => {
    const s = summariseLoyalty(entries, rule(), TODAY);
    expect(s.membersWithPoints).toBe(2);
    expect(s.outstandingPoints).toBe(700);
  });

  it('states what the shop would owe if everyone redeemed today', () => {
    expect(summariseLoyalty(entries, rule({ pointValuePaisa: 100 }), TODAY).liabilityPaisa).toBe(70000);
  });

  it('reports what has been redeemed', () => {
    expect(summariseLoyalty(entries, rule(), TODAY).redeemedThisPeriod).toBe(100);
  });

  it('handles an empty programme', () => {
    expect(summariseLoyalty([], rule(), TODAY)).toMatchObject({
      membersWithPoints: 0, outstandingPoints: 0, liabilityPaisa: 0,
    });
  });
});

describe('validateRule', () => {
  it('accepts the shipped default', () => {
    expect(validateRule(DEFAULT_LOYALTY_RULE)).toBeNull();
  });

  it('REQUIRES an expiry — points that never lapse only grow', () => {
    expect(validateRule(rule({ expiryMonths: 0 }))).toMatch(/liability that only grows/i);
  });

  it('requires a sane per-bill cap', () => {
    expect(validateRule(rule({ maxRedeemPercentOfBill: 0 }))).toMatch(/between 1% and 100%/i);
    expect(validateRule(rule({ maxRedeemPercentOfBill: 150 }))).toMatch(/between 1% and 100%/i);
  });

  it('requires a point to be worth something', () => {
    expect(validateRule(rule({ pointValuePaisa: 0 }))).toMatch(/worth something/i);
  });
});
