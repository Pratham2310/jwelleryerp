import { describe, it, expect } from 'vitest';
import {
  canTransitionLot,
  nextLotStatuses,
  isHeldInVault,
  summariseVault,
  validateRecoveredWeight,
  ALL_LOT_STATUSES,
} from './oldGoldVault';
import type { OldGoldVoucher, OldGoldLotStatus } from '../types';

function voucher(over: Partial<OldGoldVoucher> = {}): OldGoldVoucher {
  return {
    id: 'v1',
    voucherNumber: 'OGV-2026-301',
    date: '2026-07-20',
    customerName: 'Seller',
    customerPhone: '9990001111',
    itemDescription: 'Old chain',
    grossWeight: 15,
    testedPurityPercent: 87.5,
    meltingLossPercent: 3,
    netPayableWeight: 12.731,
    buybackRatePerGram: 6050,
    buybackValue: 77023,
    settlementMode: 'CASH',
    status: 'InSafe',
    ...over,
  };
}

describe('oldGoldVault state machine', () => {
  const legal: [OldGoldLotStatus, OldGoldLotStatus][] = [
    ['InSafe', 'SentForMelting'],
    ['InSafe', 'ResaleAsIs'],
    ['SentForMelting', 'Melted'],
    ['SentForMelting', 'InSafe'], // refiner returned it unmelted
    ['Melted', 'FineGoldStock'],
  ];

  it.each(legal)('allows %s -> %s', (from, to) => {
    expect(canTransitionLot(from, to)).toBe(true);
  });

  const illegal: [OldGoldLotStatus, OldGoldLotStatus][] = [
    // Must pass through Melted, which is where recovered weight is captured
    ['InSafe', 'FineGoldStock'],
    ['InSafe', 'Melted'],
    ['SentForMelting', 'FineGoldStock'],
    // Metal already converted can't go backwards
    ['FineGoldStock', 'InSafe'],
    ['FineGoldStock', 'Melted'],
    ['ResaleAsIs', 'InSafe'],
    ['Melted', 'InSafe'],
    ['InSafe', 'InSafe'],
  ];

  it.each(illegal)('blocks %s -> %s', (from, to) => {
    expect(canTransitionLot(from, to)).toBe(false);
  });

  it('has exactly two terminal states', () => {
    const terminal = ALL_LOT_STATUSES.filter(s => nextLotStatuses(s).length === 0);
    expect(terminal.sort()).toEqual(['FineGoldStock', 'ResaleAsIs']);
  });

  it('counts a lot as held only while it is still in the vault cycle', () => {
    expect(isHeldInVault('InSafe')).toBe(true);
    expect(isHeldInVault('SentForMelting')).toBe(true);
    expect(isHeldInVault('Melted')).toBe(true);
    expect(isHeldInVault('FineGoldStock')).toBe(false);
    expect(isHeldInVault('ResaleAsIs')).toBe(false);
  });
});

describe('summariseVault', () => {
  it('reports an empty vault without dividing by zero or producing NaN', () => {
    const s = summariseVault([]);
    expect(s.lotsInSafe).toBe(0);
    expect(s.grossWeightHeld).toBe(0);
    expect(s.refiningVariance).toBe(0);
    expect(s.capitalDeployed).toBe(0);
  });

  it('counts lots by stage', () => {
    const s = summariseVault([
      voucher({ id: 'a', status: 'InSafe' }),
      voucher({ id: 'b', status: 'SentForMelting' }),
      voucher({ id: 'c', status: 'Melted', recoveredFineWeight: 12.7 }),
      voucher({ id: 'd', status: 'FineGoldStock', recoveredFineWeight: 12.7 }),
    ]);
    expect(s.lotsInSafe).toBe(1);
    expect(s.lotsAtRefiner).toBe(1);
    expect(s.lotsMelted).toBe(1);
  });

  it('excludes converted lots from held weight and deployed capital', () => {
    const s = summariseVault([
      voucher({ id: 'a', status: 'InSafe', grossWeight: 10, netPayableWeight: 8, buybackValue: 50000 }),
      voucher({ id: 'b', status: 'FineGoldStock', grossWeight: 99, netPayableWeight: 90, buybackValue: 999999 }),
    ]);
    expect(s.grossWeightHeld).toBe(10);
    expect(s.expectedFineWeight).toBe(8);
    expect(s.capitalDeployed).toBe(50000);
  });

  it('reports a negative refining variance when the refiner returns less than predicted', () => {
    // Predicted 12.731g, refiner returned 12.500g -> the melting-loss deduction was too low
    const s = summariseVault([
      voucher({ status: 'FineGoldStock', netPayableWeight: 12.731, recoveredFineWeight: 12.5 }),
    ]);
    expect(s.recoveredFineWeight).toBe(12.5);
    expect(s.refiningVariance).toBe(-0.231);
  });

  it('reports a positive variance when a lot assays better than the conservative deduction', () => {
    const s = summariseVault([
      voucher({ status: 'FineGoldStock', netPayableWeight: 12.731, recoveredFineWeight: 12.9 }),
    ]);
    expect(s.refiningVariance).toBeCloseTo(0.169, 3);
  });

  it('ignores lots that have not reported a recovered weight when computing variance', () => {
    const s = summariseVault([
      voucher({ id: 'a', status: 'Melted', netPayableWeight: 12.731 }), // no recovery figure yet
      voucher({ id: 'b', status: 'FineGoldStock', netPayableWeight: 10, recoveredFineWeight: 10 }),
    ]);
    expect(s.refiningVariance).toBe(0);
  });
});

describe('validateRecoveredWeight', () => {
  const v = voucher({ grossWeight: 15 });

  it('accepts a plausible recovery', () => {
    expect(validateRecoveredWeight(v, 12.7)).toBeNull();
  });

  it('allows recovery above the predicted net payable weight', () => {
    // The buyback deduction is deliberately conservative; assaying better is normal.
    expect(validateRecoveredWeight(v, 13.5)).toBeNull();
  });

  it('rejects a recovery greater than the gross weight originally received', () => {
    expect(validateRecoveredWeight(v, 15.001)).toMatch(/cannot exceed/i);
  });

  it('rejects zero, negative and non-numeric entries', () => {
    expect(validateRecoveredWeight(v, 0)).toMatch(/recovered/i);
    expect(validateRecoveredWeight(v, -3)).toMatch(/recovered/i);
    expect(validateRecoveredWeight(v, NaN)).toMatch(/recovered/i);
  });
});
