import { describe, it, expect } from 'vitest';
import {
  OVERCLAIM_TOLERANCE_POINTS,
  lotsInPeriod,
  buybackHeadline,
  intakeByPurityBand,
  claimedVsTested,
  meltingLossTrend,
  vaultByState,
  intakeByMonth,
  reconcileBuyback,
} from './buybackDashboard';
import type { OldGoldVoucher } from '../types';

const lot = (over: Partial<OldGoldVoucher> = {}): OldGoldVoucher => ({
  id: 'v1', voucherNumber: 'OGV-2026-1', date: '2026-07-10', customerName: 'C',
  customerPhone: 'x', itemDescription: 'chain', grossWeight: 20, testedPurityPercent: 91.6,
  meltingLossPercent: 2, netPayableWeight: 17.95, buybackRatePerGram: 6000,
  buybackValue: 107700, settlementMode: 'AdjustAgainstPurchase', status: 'InSafe',
  ...over,
} as OldGoldVoucher);

describe('buybackHeadline', () => {
  const lots = [lot(), lot({ id: 'v2', grossWeight: 10, netPayableWeight: 8, buybackValue: 48000 })];

  it('totals gross, payable and value', () => {
    const h = buybackHeadline(lots);
    expect(h.lots).toBe(2);
    expect(h.grossWeight).toBe(30);
    expect(h.netPayableWeight).toBe(25.95);
    expect(h.totalPaid).toBe(155700);
  });

  it('averages the rate against payable weight, which is what was actually bought', () => {
    expect(buybackHeadline(lots).averageRatePerGram).toBe(6000);
  });

  it('reports what purity testing and melting allowance removed', () => {
    const h = buybackHeadline(lots);
    expect(h.deductedWeight).toBe(4.05);
    expect(h.deductedPercent).toBeCloseTo(13.5, 1);
  });

  it('handles an empty book without dividing by zero', () => {
    expect(buybackHeadline([])).toMatchObject({ lots: 0, averageRatePerGram: 0, deductedPercent: 0 });
  });
});

describe('intakeByPurityBand', () => {
  const lots = [
    lot({ id: 'a', testedPurityPercent: 99 }),
    lot({ id: 'b', testedPurityPercent: 91.6 }),
    lot({ id: 'c', testedPurityPercent: 76 }),
    lot({ id: 'd', testedPurityPercent: 60 }),
  ];

  it('bands every lot', () => {
    expect(intakeByPurityBand(lots).reduce((n, b) => n + b.lots, 0)).toBe(4);
  });

  it('omits empty bands rather than printing zero rows', () => {
    expect(intakeByPurityBand([lot({ testedPurityPercent: 91.6 })])).toHaveLength(1);
  });

  it('shares sum to 100%', () => {
    const total = intakeByPurityBand(lots).reduce((s, b) => s + b.sharePercent, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('puts a boundary purity in exactly one band', () => {
    expect(intakeByPurityBand([lot({ testedPurityPercent: 90 })]).length).toBe(1);
    expect(intakeByPurityBand([lot({ testedPurityPercent: 95 })]).length).toBe(1);
  });
});

describe('claimedVsTested — the metric that earns the screen', () => {
  it('reports the gap as tested minus claimed, so worse-than-claimed reads negative', () => {
    const g = claimedVsTested([lot({ claimedPurityPercent: 91.6, testedPurityPercent: 78 })]);
    expect(g.averageGap).toBeCloseTo(-13.6, 1);
  });

  it('EXCLUDES lots with no recorded claim rather than treating them as agreeing', () => {
    // Folding unclaimed lots in at parity would drag the gap toward zero and hide exactly
    // what the metric exists to show.
    const g = claimedVsTested([
      lot({ id: 'a', claimedPurityPercent: 91.6, testedPurityPercent: 78 }),
      lot({ id: 'b', claimedPurityPercent: undefined, testedPurityPercent: 91.6 }),
    ]);
    expect(g.comparableLots).toBe(1);
    expect(g.lotsWithoutClaim).toBe(1);
    expect(g.averageGap).toBeCloseTo(-13.6, 1);
  });

  it('counts materially overclaimed lots past the tolerance', () => {
    const g = claimedVsTested([
      lot({ id: 'a', claimedPurityPercent: 91.6, testedPurityPercent: 78 }),
      lot({ id: 'b', claimedPurityPercent: 91.6, testedPurityPercent: 91 }),
    ]);
    expect(g.materiallyOverclaimed).toBe(1);
    expect(OVERCLAIM_TOLERANCE_POINTS).toBe(2);
  });

  it('returns zeroes rather than NaN when nothing has a claim', () => {
    const g = claimedVsTested([lot({ claimedPurityPercent: undefined })]);
    expect(g).toMatchObject({ comparableLots: 0, averageGap: 0, lotsWithoutClaim: 1 });
  });

  it('handles a lot tested better than claimed, giving a positive gap', () => {
    expect(claimedVsTested([lot({ claimedPurityPercent: 75, testedPurityPercent: 91.6 })]).averageGap)
      .toBeCloseTo(16.6, 1);
  });
});

describe('meltingLossTrend', () => {
  const melted = lot({
    id: 'm1', status: 'Melted', meltedOn: '2026-07-20',
    grossWeight: 20, testedPurityPercent: 90, recoveredFineWeight: 17.4,
  });

  it('computes loss against expected fine content', () => {
    const [point] = meltingLossTrend([melted]);
    expect(point.expectedFine).toBe(18);
    expect(point.recoveredFine).toBe(17.4);
    expect(point.lossPercent).toBeCloseTo(3.333, 2);
  });

  it('EXCLUDES lots still in the safe — they have no loss yet', () => {
    // Averaging an unmelted lot in as zero loss would understate real refining loss.
    expect(meltingLossTrend([melted, lot({ id: 'safe', status: 'InSafe' })])[0].lots).toBe(1);
  });

  it('groups by the month it was melted, not the month it came in', () => {
    const [point] = meltingLossTrend([lot({
      ...melted, date: '2026-05-01', meltedOn: '2026-07-20',
    } as Partial<OldGoldVoucher>)]);
    expect(point.month).toBe('2026-07');
  });

  it('returns nothing when no lot has been melted', () => {
    expect(meltingLossTrend([lot()])).toEqual([]);
  });
});

describe('vaultByState', () => {
  it('groups lots by status with a human label', () => {
    const rows = vaultByState([lot(), lot({ id: 'v2', status: 'Melted' })]);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.label.length > 0)).toBe(true);
  });

  it('sorts by value, largest first', () => {
    const rows = vaultByState([
      lot({ id: 'a', status: 'InSafe', buybackValue: 1000 }),
      lot({ id: 'b', status: 'Melted', buybackValue: 90000 }),
    ]);
    expect(rows[0].status).toBe('Melted');
  });
});

describe('intakeByMonth & lotsInPeriod', () => {
  const lots = [lot({ date: '2026-06-05' }), lot({ id: 'v2', date: '2026-07-10' })];

  it('orders months chronologically', () => {
    expect(intakeByMonth(lots).map(m => m.month)).toEqual(['2026-06', '2026-07']);
  });

  it('filters a period inclusively at both ends', () => {
    expect(lotsInPeriod(lots, '2026-07-10', '2026-07-10')).toHaveLength(1);
    expect(lotsInPeriod(lots)).toHaveLength(2);
  });
});

describe('reconcileBuyback — every figure ties to the lots', () => {
  const lots = [
    lot({ id: 'a', testedPurityPercent: 91.6, status: 'InSafe' }),
    lot({ id: 'b', testedPurityPercent: 60, status: 'Melted', meltedOn: '2026-07-20', recoveredFineWeight: 11 }),
    lot({ id: 'c', testedPurityPercent: 99, status: 'FineGoldStock', date: '2026-06-01' }),
  ];

  it('every check passes against real lots', () => {
    for (const c of reconcileBuyback(lots)) {
      expect(c.passes, `${c.label}: ${c.detail}`).toBe(true);
    }
  });

  it('passes on an empty book', () => {
    for (const c of reconcileBuyback([])) expect(c.passes).toBe(true);
  });

  it('CATCHES paying for more metal than came through the door', () => {
    const bad = [lot({ grossWeight: 10, netPayableWeight: 12 })];
    const check = reconcileBuyback(bad).find(c => c.label.includes('never exceeds gross'));
    expect(check?.passes).toBe(false);
  });

  it('reports four checks with readable detail', () => {
    const checks = reconcileBuyback(lots);
    expect(checks).toHaveLength(4);
    for (const c of checks) expect(c.detail.length).toBeGreaterThan(0);
  });
});
