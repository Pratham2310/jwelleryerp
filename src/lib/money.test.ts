import { describe, it, expect } from 'vitest';
import {
  toPaisa, fromPaisa, roundMoney, roundToPaisa, sumMoney, multiplyMoney, percentOf,
  moneyEquals, allocate, splitEvenly,
  roundWeight, sumWeight, weightEquals, allocateWeight,
} from './money';

describe('paisa conversion', () => {
  it('round-trips rupees through integer paisa', () => {
    expect(toPaisa(1234.56)).toBe(123456);
    expect(fromPaisa(123456)).toBe(1234.56);
  });

  it('survives the float noise that naive multiplication produces', () => {
    // (1234.565 * 100) is 123456.49999999999 in IEEE-754 — a naive round loses the paisa.
    expect(toPaisa(1234.565)).toBe(123457);
    expect(toPaisa(0.07 * 100)).toBe(700);
  });

  it('treats junk input as zero rather than NaN', () => {
    expect(toPaisa(NaN)).toBe(0);
    expect(toPaisa(undefined as unknown as number)).toBe(0);
    expect(fromPaisa(NaN)).toBe(0);
  });

  it('rounds to whole rupees and to paisa', () => {
    expect(roundMoney(8.2 * 6650)).toBe(54530); // raw product is 54529.99999999999
    expect(roundMoney(1234.5)).toBe(1235);
    expect(roundToPaisa(1234.5678)).toBe(1234.57);
  });
});

describe('sumMoney — accumulation must not drift', () => {
  it('sums a thousand small amounts exactly', () => {
    const values = Array.from({ length: 1000 }, () => 0.1);
    expect(values.reduce((a, b) => a + b, 0)).not.toBe(100); // the naive version is wrong
    expect(sumMoney(values)).toBe(100);
  });

  it('sums realistic line values without a residue', () => {
    expect(sumMoney([54530, 1908.55, 3690])).toBe(60128.55);
  });

  it('handles an empty list and negatives (credit notes)', () => {
    expect(sumMoney([])).toBe(0);
    expect(sumMoney([1000, -400, -600])).toBe(0);
  });
});

describe('multiplyMoney / percentOf', () => {
  it('multiplies without compounding drift', () => {
    expect(multiplyMoney(1234.56, 3)).toBe(3703.68);
    expect(multiplyMoney(8.2, 6650)).toBe(54530);
  });

  it('computes a GST percentage exactly', () => {
    expect(percentOf(289440, 3)).toBe(8683.2);
    expect(percentOf(100, 3)).toBe(3);
  });

  it('returns zero for a zero factor', () => {
    expect(multiplyMoney(1000, 0)).toBe(0);
  });
});

describe('moneyEquals — never compare computed amounts with ===', () => {
  it('sees through float noise', () => {
    expect(0.1 + 0.2 === 0.3).toBe(false); // the trap
    expect(moneyEquals(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('still distinguishes a genuine one-paisa difference', () => {
    expect(moneyEquals(100.01, 100.02)).toBe(false);
  });
});

describe('allocate — the parts MUST sum to the whole', () => {
  it('fixes the case that was losing a rupee', () => {
    // round(1000 * 3333/10000) three times gives 333+333+333 = 999.
    const parts = allocate(1000, [3333, 3333, 3334]);
    expect(sumMoney(parts)).toBe(1000);
  });

  it('sums exactly for an indivisible split', () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(sumMoney(parts)).toBe(100);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
  });

  it('sums exactly across a spread of awkward cases', () => {
    const cases: [number, number[]][] = [
      [5000, [10000, 10000, 10000]],
      [999, [7777, 1111, 2222]],
      [1, [1000, 1000, 1000]],
      [0.03, [1, 1, 1]],
      [123456.78, [7, 11, 13, 17]],
    ];
    for (const [total, weights] of cases) {
      expect(sumMoney(allocate(total, weights))).toBe(total);
    }
  });

  it('gives the leftover paisa to the largest fraction, deterministically', () => {
    // Ties break toward the earlier bucket so a re-run cannot reshuffle a customer's figures.
    expect(allocate(100, [1, 1, 1])).toEqual(allocate(100, [1, 1, 1]));
  });

  it('handles a negative total, as a credit note carries', () => {
    const parts = allocate(-1000, [3333, 3333, 3334]);
    expect(sumMoney(parts)).toBe(-1000);
  });

  it('is proportional, not merely exact', () => {
    const parts = allocate(1000, [1, 3]);
    expect(parts).toEqual([250, 750]);
  });

  it('does not divide by zero when the weights are empty or zero', () => {
    expect(allocate(1000, [])).toEqual([]);
    // The money exists and must land somewhere rather than vanishing.
    expect(sumMoney(allocate(1000, [0, 0, 0]))).toBe(1000);
  });

  it('splits evenly and still sums to the whole', () => {
    expect(sumMoney(splitEvenly(100, 3))).toBe(100);
    expect(splitEvenly(10, 2)).toEqual([5, 5]);
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe('weight — priced per gram, so a drifting gram is a drifting rupee', () => {
  it('rounds to milligrams', () => {
    expect(roundWeight(8.2456)).toBe(8.246);
    expect(roundWeight(8.2454)).toBe(8.245);
  });

  it('sums a thousand weights exactly', () => {
    const values = Array.from({ length: 1000 }, () => 8.245);
    expect(values.reduce((a, b) => a + b, 0)).not.toBe(8245); // naive drifts
    expect(sumWeight(values)).toBe(8245);
  });

  it('compares weights without float noise', () => {
    expect(weightEquals(0.1 + 0.2, 0.3)).toBe(true);
    expect(weightEquals(8.245, 8.246)).toBe(false);
  });

  it('apportions weight so the parts sum to the whole', () => {
    const parts = allocateWeight(10, [1, 1, 1]);
    expect(sumWeight(parts)).toBe(10);
  });

  it('handles an empty weight allocation', () => {
    expect(allocateWeight(10, [])).toEqual([]);
  });
});
