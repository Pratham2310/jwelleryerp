import { describe, it, expect } from 'vitest';
import {
  fineGoldEquivalent,
  purityPercentForMetal,
  karigarWastagePercent,
  assessWastage,
  deriveKarigarBalance,
  buildLedgerStatement,
  validateLedgerEntry,
} from './fineGoldLedger';
import type { KarigarLedgerEntry } from '../types';

function entry(over: Partial<KarigarLedgerEntry> = {}): KarigarLedgerEntry {
  return {
    id: 'e1',
    karigarId: 'k1',
    date: '2026-07-01',
    sequence: 1,
    type: 'METAL_ISSUED',
    narration: 'test',
    fineWeightDelta: 0,
    ...over,
  };
}

describe('fineGoldEquivalent (PRD §6.2)', () => {
  it('matches the PRD example: 100g of 916 purity = 91.6g fine', () => {
    expect(fineGoldEquivalent(100, 91.6)).toBe(91.6);
  });

  it('normalises different purities to a common basis', () => {
    expect(fineGoldEquivalent(100, 75)).toBe(75);
    expect(fineGoldEquivalent(100, 99.9)).toBe(99.9);
  });

  it('returns 0 for zero weight and clamps nonsensical purity', () => {
    expect(fineGoldEquivalent(0, 91.6)).toBe(0);
    expect(fineGoldEquivalent(10, -5)).toBe(0);
    expect(fineGoldEquivalent(10, 150)).toBe(10); // clamped to 100%
  });

  it('rounds to 3dp, matching the weight precision used everywhere else', () => {
    expect(fineGoldEquivalent(7.777, 91.6)).toBe(7.124);
  });
});

describe('purityPercentForMetal', () => {
  it('maps the app\'s metal standards to their purity', () => {
    expect(purityPercentForMetal('Gold (22K)')).toBe(91.6);
    expect(purityPercentForMetal('Gold (18K)')).toBe(75.0);
    expect(purityPercentForMetal('Gold (24K)')).toBe(99.9);
  });

  it('falls back to 100% for an unknown metal rather than zeroing the weight', () => {
    expect(purityPercentForMetal('Palladium (Unknown)')).toBe(100);
  });
});

describe('karigarWastagePercent (PRD §6.2)', () => {
  it('computes loss as a percentage of fine gold issued', () => {
    expect(karigarWastagePercent(100, 94)).toBe(6);
  });

  it('is 0 when nothing was lost', () => {
    expect(karigarWastagePercent(100, 100)).toBe(0);
  });

  it('returns 0 rather than Infinity when nothing was issued', () => {
    expect(karigarWastagePercent(0, 0)).toBe(0);
    expect(Number.isFinite(karigarWastagePercent(0, 5))).toBe(true);
  });
});

describe('assessWastage — the purity bug this milestone fixes', () => {
  it('catches a loss that comparing raw grams would have missed entirely', () => {
    // 100g of 22K issued, 95g of 18K returned. Raw grams say "5g lost".
    const fineIssued = fineGoldEquivalent(100, 91.6); // 91.6
    const fineReturned = fineGoldEquivalent(95, 75); // 71.25
    const a = assessWastage(fineIssued, fineReturned, 6);

    expect(a.fineLost).toBe(20.35); // not 5g
    expect(a.wastagePercent).toBeCloseTo(22.216, 2);
    expect(a.isExcessive).toBe(true);
  });

  it('treats a within-cap loss as fully absorbed, with no excess', () => {
    const a = assessWastage(91.6, 87.0, 6);
    expect(a.fineLost).toBe(4.6);
    expect(a.allowedFineWeight).toBe(5.496); // 91.6 × 6%
    expect(a.excessFineWeight).toBe(0);
    expect(a.isExcessive).toBe(false);
  });

  it('splits an over-cap loss into the allowed portion and the excess', () => {
    const a = assessWastage(100, 90, 6);
    expect(a.fineLost).toBe(10);
    expect(a.allowedFineWeight).toBe(6);
    expect(a.excessFineWeight).toBe(4);
    expect(a.isExcessive).toBe(true);
  });

  it('never reports negative loss when a karigar returns more than issued', () => {
    const a = assessWastage(90, 95, 6);
    expect(a.fineLost).toBe(0);
    expect(a.excessFineWeight).toBe(0);
    expect(a.isExcessive).toBe(false);
  });

  it('treats a 0% cap as allowing nothing', () => {
    const a = assessWastage(100, 99, 0);
    expect(a.allowedFineWeight).toBe(0);
    expect(a.excessFineWeight).toBe(1);
    expect(a.isExcessive).toBe(true);
  });
});

describe('deriveKarigarBalance — replaces the mutable running totals', () => {
  it('is zero for a karigar with no entries', () => {
    expect(deriveKarigarBalance([], 'k1')).toEqual({
      fineWeightPayable: 0, moneyPayable: 0, entryCount: 0,
    });
  });

  it('folds weight entries into a fine-gram payable', () => {
    const b = deriveKarigarBalance([
      entry({ id: 'a', type: 'METAL_ISSUED', fineWeightDelta: 91.6 }),
      entry({ id: 'b', type: 'METAL_RETURNED', fineWeightDelta: -85.0 }),
      entry({ id: 'c', type: 'WASTAGE_ALLOWED', fineWeightDelta: -5.496 }),
    ], 'k1');
    expect(b.fineWeightPayable).toBe(1.104);
    expect(b.moneyPayable).toBe(0);
  });

  it('folds money entries independently of weight — the two never net (D-2)', () => {
    const b = deriveKarigarBalance([
      entry({ id: 'a', type: 'METAL_ISSUED', fineWeightDelta: 91.6 }),
      entry({ id: 'b', type: 'LABOUR_CHARGED', fineWeightDelta: undefined, moneyDelta: 14500 }),
      entry({ id: 'c', type: 'LABOUR_PAID', fineWeightDelta: undefined, moneyDelta: -10000 }),
    ], 'k1');
    expect(b.fineWeightPayable).toBe(91.6);
    expect(b.moneyPayable).toBe(4500);
  });

  it('scopes to one karigar and ignores everyone else', () => {
    const all = [
      entry({ id: 'a', karigarId: 'k1', fineWeightDelta: 10 }),
      entry({ id: 'b', karigarId: 'k2', fineWeightDelta: 999 }),
    ];
    expect(deriveKarigarBalance(all, 'k1').fineWeightPayable).toBe(10);
    expect(deriveKarigarBalance(all, 'k2').fineWeightPayable).toBe(999);
  });

  it('supports a negative balance — the shop can owe the karigar metal', () => {
    const b = deriveKarigarBalance([
      entry({ id: 'a', type: 'METAL_ISSUED', fineWeightDelta: 10 }),
      entry({ id: 'b', type: 'METAL_RETURNED', fineWeightDelta: -15 }),
    ], 'k1');
    expect(b.fineWeightPayable).toBe(-5);
  });
});

describe('buildLedgerStatement', () => {
  it('orders oldest-first and carries a running balance, so a balance is explainable', () => {
    const rows = buildLedgerStatement([
      entry({ id: 'c', date: '2026-07-10', sequence: 3, type: 'METAL_RETURNED', fineWeightDelta: -80 }),
      entry({ id: 'a', date: '2026-07-01', sequence: 1, type: 'METAL_ISSUED', fineWeightDelta: 91.6 }),
      entry({ id: 'b', date: '2026-07-01', sequence: 2, type: 'LABOUR_CHARGED', fineWeightDelta: undefined, moneyDelta: 5000 }),
    ], 'k1');

    expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows[0].runningFineWeight).toBe(91.6);
    expect(rows[1].runningMoney).toBe(5000);
    expect(rows[2].runningFineWeight).toBe(11.6);
    // The final running balance must equal the derived balance
    expect(rows[rows.length - 1].runningFineWeight).toBe(
      deriveKarigarBalance([
        entry({ id: 'a', fineWeightDelta: 91.6 }),
        entry({ id: 'c', fineWeightDelta: -80 }),
      ], 'k1').fineWeightPayable
    );
  });

  it('returns an empty statement for a karigar with no entries', () => {
    expect(buildLedgerStatement([entry({ karigarId: 'other' })], 'k1')).toEqual([]);
  });
});

describe('validateLedgerEntry — enforces D-2 structurally', () => {
  it('rejects an entry that moves both ledgers at once', () => {
    const err = validateLedgerEntry({ karigarId: 'k1', type: 'METAL_ISSUED', fineWeightDelta: 10, moneyDelta: 500 });
    expect(err).toMatch(/never both/i);
  });

  it('rejects an entry that moves neither ledger', () => {
    expect(validateLedgerEntry({ karigarId: 'k1', type: 'METAL_ISSUED' })).toMatch(/must move either/i);
  });

  it('accepts a weight-only and a money-only entry', () => {
    expect(validateLedgerEntry({ karigarId: 'k1', type: 'METAL_ISSUED', fineWeightDelta: 10 })).toBeNull();
    expect(validateLedgerEntry({ karigarId: 'k1', type: 'LABOUR_CHARGED', moneyDelta: 500 })).toBeNull();
  });

  it('requires a karigar and a type', () => {
    expect(validateLedgerEntry({ type: 'METAL_ISSUED', fineWeightDelta: 10 })).toMatch(/belong to a karigar/i);
    expect(validateLedgerEntry({ karigarId: 'k1', fineWeightDelta: 10 })).toMatch(/must have a type/i);
  });
});
