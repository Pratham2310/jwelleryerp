import { describe, it, expect } from 'vitest';
import {
  calculateOldGoldValuation,
  validateOldGoldValuation,
  millesimalToPercent,
  PURITY_PRESETS,
} from './oldGoldValuation';
import { settleOldGold } from './billingCalculations';

describe('PRD §8.2 melt/touch valuation formula', () => {
  // The exact scenario from PRD §17: 15.000g old chain, tested 875, 3% melting loss,
  // buy-back rate ₹6,050/g.
  const prdScenario = {
    grossWeight: 15.0,
    testedPurityPercent: 87.5,
    meltingLossPercent: 3,
    buybackRatePerGram: 6050,
  };

  it('applies Gross × Purity × (1 − Loss) exactly as §8.2 step 4 states', () => {
    const r = calculateOldGoldValuation(prdScenario);
    expect(r.pureContentWeight).toBe(13.125); // 15.000 × 0.875
    expect(r.meltingLossWeight).toBe(0.394); // 13.125 × 3%, to 3dp
    expect(r.netPayableWeight).toBe(12.731); // 13.125 × 0.97 = 12.73125
    // The ROUNDED weight is what gets multiplied, matching how §17 lays the example out
    // and — more importantly — keeping the voucher internally consistent: the printed
    // weight × the printed rate must equal the printed value, or staff get challenged at
    // the counter. Multiplying the unrounded 12.73125 would give ₹77,024 instead.
    expect(r.buybackValue).toBe(77023); // 12.731 × 6050 = 77,022.55
  });

  it('does NOT reproduce §17\'s printed 12.740g / ₹77,077 — that example is arithmetically wrong', () => {
    // Documenting the discrepancy so a future change that "fixes" the engine to match
    // §17 fails loudly instead of silently reintroducing the error.
    const r = calculateOldGoldValuation(prdScenario);
    expect(r.netPayableWeight).not.toBe(12.74);
    expect(r.buybackValue).not.toBe(77077);
    // 12.740g would require a tested purity of ~87.56%, not the 875 the example states.
    const impliedPurity = 12.74 / (15 * 0.97);
    expect(impliedPurity).toBeGreaterThan(0.8755);
  });

  it('feeds the settlement stage without ever touching the taxable base (PRD §8.3 / D-10)', () => {
    const { buybackValue } = calculateOldGoldValuation(prdScenario);
    // Sale side is unchanged; old gold nets only against the final amount collected.
    expect(settleOldGold(298123, buybackValue)).toBe(298123 - buybackValue);
  });
});

describe('calculateOldGoldValuation edge cases', () => {
  it('returns zeroes for a zero-weight item rather than NaN', () => {
    const r = calculateOldGoldValuation({
      grossWeight: 0, testedPurityPercent: 91.6, meltingLossPercent: 3, buybackRatePerGram: 6000,
    });
    expect(r.netPayableWeight).toBe(0);
    expect(r.buybackValue).toBe(0);
  });

  it('a 0% melting loss pays for the full pure content', () => {
    const r = calculateOldGoldValuation({
      grossWeight: 10, testedPurityPercent: 91.6, meltingLossPercent: 0, buybackRatePerGram: 6000,
    });
    expect(r.meltingLossWeight).toBe(0);
    expect(r.netPayableWeight).toBe(9.16);
    expect(r.buybackValue).toBe(54960);
  });

  it('a 100% melting loss pays nothing, and never goes negative', () => {
    const r = calculateOldGoldValuation({
      grossWeight: 10, testedPurityPercent: 91.6, meltingLossPercent: 100, buybackRatePerGram: 6000,
    });
    expect(r.netPayableWeight).toBe(0);
    expect(r.buybackValue).toBe(0);
  });

  it('clamps a nonsensical negative weight to zero instead of producing a negative payout', () => {
    const r = calculateOldGoldValuation({
      grossWeight: -5, testedPurityPercent: 91.6, meltingLossPercent: 3, buybackRatePerGram: 6000,
    });
    expect(r.buybackValue).toBe(0);
  });

  it('rounds net payable weight to 3 decimal places, as the PRD specifies', () => {
    const r = calculateOldGoldValuation({
      grossWeight: 7.777, testedPurityPercent: 91.6, meltingLossPercent: 2.5, buybackRatePerGram: 6100,
    });
    expect(r.netPayableWeight.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });

  it('values 22KT higher than 18KT for the same gross weight', () => {
    const base = { grossWeight: 10, meltingLossPercent: 3, buybackRatePerGram: 6000 };
    const k22 = calculateOldGoldValuation({ ...base, testedPurityPercent: 91.6 });
    const k18 = calculateOldGoldValuation({ ...base, testedPurityPercent: 75 });
    expect(k22.buybackValue).toBeGreaterThan(k18.buybackValue);
  });
});

describe('validateOldGoldValuation', () => {
  const valid = {
    grossWeight: 10, testedPurityPercent: 91.6, meltingLossPercent: 3, buybackRatePerGram: 6000,
  };

  it('accepts a complete, sane voucher', () => {
    expect(validateOldGoldValuation(valid)).toBeNull();
  });

  it('blocks a missing gross weight', () => {
    expect(validateOldGoldValuation({ ...valid, grossWeight: 0 })).toMatch(/gross weight/i);
  });

  it('blocks an untested item — purity is the whole point of the workflow', () => {
    expect(validateOldGoldValuation({ ...valid, testedPurityPercent: 0 })).toMatch(/tested purity/i);
  });

  it('catches a millesimal value typed into the percentage field', () => {
    // The single most likely data-entry error here: typing 875 instead of 87.5
    expect(validateOldGoldValuation({ ...valid, testedPurityPercent: 875 })).toMatch(/millesimal/i);
  });

  it('blocks a missing buy-back rate', () => {
    expect(validateOldGoldValuation({ ...valid, buybackRatePerGram: 0 })).toMatch(/buy-back rate/i);
  });
});

describe('purity helpers', () => {
  it('converts millesimal touch readings to percent', () => {
    expect(millesimalToPercent(875)).toBe(87.5);
    expect(millesimalToPercent(916)).toBe(91.6);
    expect(millesimalToPercent(995)).toBe(99.5);
  });

  it('ships presets whose millesimal and percent values agree', () => {
    for (const preset of PURITY_PRESETS) {
      expect(millesimalToPercent(preset.millesimal)).toBeCloseTo(preset.percent, 3);
    }
  });
});
