import { describe, it, expect } from 'vitest';
import { calculateReturnTotals, selectableReturnLines, validateReturnSelection } from './salesReturn';
import { calculateInvoiceTotals } from './billingCalculations';

describe('salesReturn.calculateReturnTotals', () => {
  const lines = [{ subtotal: 60000 }, { subtotal: 40000 }];
  const originalSubtotal = 100000;

  it('reverses a full return to exactly the negative of the original invoice', () => {
    const forward = calculateInvoiceTotals([60000, 40000], 0);
    const credit = calculateReturnTotals(lines, [0, 1], originalSubtotal, 0);

    expect(credit.returnedSubtotal).toBe(-forward.subtotal);
    expect(credit.returnedTax).toBe(-forward.gstTax);
    expect(credit.returnedTotal).toBe(-forward.grandTotal);
  });

  it('reverses a partial return for only the selected line', () => {
    const credit = calculateReturnTotals(lines, [1], originalSubtotal, 0);
    expect(credit.returnedSubtotal).toBe(-40000);
    expect(credit.returnedTax).toBe(-1200); // 3% of 40000
    expect(credit.returnedTotal).toBe(-41200);
  });

  it('reverses a bill-level discount proportionally on a partial return', () => {
    // Rs 1,500 off a Rs 1,00,000 bill; returning the Rs 40,000 line = 40% -> Rs 600 clawed back
    const credit = calculateReturnTotals(lines, [1], originalSubtotal, 1500);
    expect(credit.discountReversed).toBe(-600);
    expect(credit.returnedTaxableValue).toBe(-39400); // 40000 - 600
    expect(credit.returnedTax).toBe(-1182); // 3% of 39400
    expect(credit.returnedTotal).toBe(-40582);
  });

  it('a full return of a discounted invoice nets exactly to zero against it', () => {
    const forward = calculateInvoiceTotals([60000, 40000], 1500);
    const credit = calculateReturnTotals(lines, [0, 1], originalSubtotal, 1500);

    expect(forward.grandTotal + credit.returnedTotal).toBe(0);
    expect(forward.gstTax + credit.returnedTax).toBe(0);
  });

  it('returns all zeroes when nothing is selected', () => {
    const credit = calculateReturnTotals(lines, [], originalSubtotal, 1500);
    expect(credit.returnedSubtotal).toBe(0);
    expect(credit.returnedTotal).toBe(0);
  });

  it('ignores out-of-range line indexes rather than producing NaN', () => {
    const credit = calculateReturnTotals(lines, [0, 99, -3], originalSubtotal, 0);
    expect(credit.returnedSubtotal).toBe(-60000);
  });

  it('never produces a positive (i.e. revenue-increasing) credit note', () => {
    const credit = calculateReturnTotals(lines, [0, 1], originalSubtotal, 999999);
    expect(credit.returnedTaxableValue).toBeLessThanOrEqual(0);
    expect(credit.returnedTax).toBeLessThanOrEqual(0);
    expect(credit.returnedTotal).toBeLessThanOrEqual(0);
  });

  it('handles a zero-value original invoice without dividing by zero', () => {
    const credit = calculateReturnTotals([{ subtotal: 0 }], [0], 0, 500);
    expect(credit.discountReversed).toBe(0);
    expect(credit.returnedTotal).toBe(0);
  });
});

describe('salesReturn selection guards', () => {
  it('excludes already-returned lines from the selectable set', () => {
    expect(selectableReturnLines(3, [1])).toEqual([0, 2]);
    expect(selectableReturnLines(2, [0, 1])).toEqual([]);
  });

  it('blocks an empty selection', () => {
    expect(validateReturnSelection([], [])).toMatch(/at least one/i);
  });

  it('blocks returning a line that was already credited', () => {
    expect(validateReturnSelection([1], [1])).toMatch(/already been returned/i);
  });

  it('allows a valid, not-yet-returned selection', () => {
    expect(validateReturnSelection([0, 2], [1])).toBeNull();
  });
});
