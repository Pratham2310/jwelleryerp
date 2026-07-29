import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateInvoiceTotals, settleOldGold, validatePaymentSplit } from './billingCalculations';

describe('PRD §17 worked example — 22KT diamond necklace + old gold exchange', () => {
  // Item Master / Tag Data
  const line = calculateLineItem({
    netWeight: 24.0,
    metalRate: 6200,
    wastagePercent: 5,
    makingChargeType: 'per-gram',
    makingChargeValue: 550,
    stoneCharge: 120000 // certified diamond value, per the PRD's own simplification
  });

  it('computes Metal Value, Wastage Value, Making Charges and Stone Value per §7.2', () => {
    expect(line.metalValue).toBe(148800);
    expect(line.wastageValue).toBe(7440);
    expect(line.makingCharge).toBe(13200);
    expect(line.stoneValue).toBe(120000);
  });

  it('computes the Taxable Value (line subtotal) as Rs 2,89,440.00', () => {
    expect(line.subtotal).toBe(289440);
  });

  const invoice = calculateInvoiceTotals([line.subtotal], 0);

  it('computes GST @3% and the Invoice Total (Net Payable before old-gold adjustment)', () => {
    expect(invoice.subtotal).toBe(289440);
    // PRD splits this into CGST 4,341.60 + SGST 4,341.60 = 8,683.20; this app
    // models a single combined GST field, rounded to the nearest rupee.
    expect(invoice.gstTax).toBe(8683);
    // Matches PRD §17's "NET PAYABLE (before old-gold adjustment) = Rs 2,98,123.00"
    expect(invoice.grandTotal).toBe(298123);
  });

  it('never reduces the taxable base or GST for old-gold trade-in (fixes KNOWN_ISSUES.md #1)', () => {
    // Old gold must not appear anywhere in calculateInvoiceTotals's inputs.
    const withoutOldGold = calculateInvoiceTotals([line.subtotal], 0);
    expect(withoutOldGold.subtotal).toBe(invoice.subtotal);
    expect(withoutOldGold.gstTax).toBe(invoice.gstTax);
  });

  it('nets old-gold buyback value only at the final settlement stage', () => {
    // PRD §17: 15.000g gross x 0.875 tested purity x (1 - 3% melting loss)
    // = 12.740g net payable weight, at a buyback rate of Rs 6,050/g. The
    // melt/touch valuation calculator itself is out of scope here (Milestone
    // 6) — this test takes the PRD's own worked figure as given.
    const oldGoldValue = 77077;

    const netCashDue = settleOldGold(invoice.grandTotal, oldGoldValue);
    // Matches PRD §17's "NET CASH/DIGITAL PAYMENT DUE FROM CUSTOMER = Rs 2,21,046.00"
    expect(netCashDue).toBe(221046);
  });
});

describe('making-charge type branching (fixes KNOWN_ISSUES.md #4)', () => {
  it('treats a flat making charge as a fixed amount, not per-gram (mock item EAR-18K-109)', () => {
    const line = calculateLineItem({
      netWeight: 3.4,
      metalRate: 5440,
      wastagePercent: 2.0,
      makingChargeType: 'flat',
      makingChargeValue: 2500,
      stoneCharge: 85000
    });

    expect(line.metalValue).toBe(18496);
    expect(line.wastageValue).toBe(370);
    // Previously the buggy code computed 2500 * (3.4 + wastage weight) — a ~₹8,600 overcharge.
    expect(line.makingCharge).toBe(2500);
    expect(line.subtotal).toBe(106366);
  });

  it('still multiplies per-gram making charges by net weight', () => {
    const line = calculateLineItem({
      netWeight: 8.2,
      metalRate: 6650,
      wastagePercent: 3.5,
      makingChargeType: 'per-gram',
      makingChargeValue: 450,
      stoneCharge: 4500
    });

    expect(line.makingCharge).toBe(3690);
    expect(line.subtotal).toBe(64629);
  });
});

describe('per-item wastage percent (fixes KNOWN_ISSUES.md #3)', () => {
  it('uses 0% wastage for an item configured with none, instead of a hardcoded 3.5%', () => {
    const line = calculateLineItem({
      netWeight: 10,
      metalRate: 7250,
      wastagePercent: 0,
      makingChargeType: 'flat',
      makingChargeValue: 450,
      stoneCharge: 0
    });

    expect(line.wastageValue).toBe(0);
    expect(line.subtotal).toBe(72950);
  });
});

describe('zero old-gold transaction', () => {
  it('leaves the grand total unchanged when there is no trade-in', () => {
    expect(settleOldGold(100000, 0)).toBe(100000);
  });
});

describe('bill-level discount reduces the taxable value before GST (fixes Milestone 7 / PRD §7.4)', () => {
  it('computes GST on (subtotal - discount), not on the pre-discount subtotal', () => {
    const invoice = calculateInvoiceTotals([106366], 1500);
    expect(invoice.subtotal).toBe(106366);
    expect(invoice.taxableValue).toBe(104866); // 106366 - 1500
    expect(invoice.gstTax).toBe(3146); // 104866 * 3%, rounded (not 106366 * 3% = 3191)
    expect(invoice.grandTotal).toBe(108012); // 104866 + 3146
  });

  it('a zero discount leaves the taxable value equal to the subtotal', () => {
    const invoice = calculateInvoiceTotals([100000], 0);
    expect(invoice.taxableValue).toBe(100000);
    expect(invoice.gstTax).toBe(3000);
    expect(invoice.grandTotal).toBe(103000);
  });

  it('a discount larger than the subtotal never produces a negative taxable value or GST', () => {
    const invoice = calculateInvoiceTotals([1000], 5000);
    expect(invoice.taxableValue).toBe(0);
    expect(invoice.gstTax).toBe(0);
    expect(invoice.grandTotal).toBe(0);
  });
});

describe('CGST/SGST vs IGST split (Milestone 21, PRD §7.3/§9.2)', () => {
  it('splits an intra-state sale into equal halves that sum to the tax charged', () => {
    const invoice = calculateInvoiceTotals([289440], 0, { ratePercent: 3, supplyType: 'INTRA_STATE' });
    // PRD §17 prints CGST 4,341.60 + SGST 4,341.60; at whole rupees that is 4342 + 4341.
    expect(invoice.gstSplit).toEqual({ cgst: 4342, sgst: 4341, igst: 0, total: 8683 });
    expect(invoice.gstSplit.cgst + invoice.gstSplit.sgst).toBe(invoice.gstTax);
    expect(invoice.gstSplit.igst).toBe(0);
  });

  it('bills the PRD §17 inter-state variant entirely as IGST', () => {
    // PRD §17 names "inter-state IGST variant" as a required QA edge case.
    const invoice = calculateInvoiceTotals([289440], 0, { ratePercent: 3, supplyType: 'INTER_STATE' });
    expect(invoice.gstSplit).toEqual({ cgst: 0, sgst: 0, igst: 8683, total: 8683 });
    expect(invoice.grandTotal).toBe(298123); // identical total; only the split differs
  });

  it('defaults to intra-state at the composite rate when no tax context is given', () => {
    // Guards the pre-Milestone-21 call signature, still used by older call sites.
    const invoice = calculateInvoiceTotals([100000], 0);
    expect(invoice.ratePercent).toBe(3);
    expect(invoice.supplyType).toBe('INTRA_STATE');
    expect(invoice.gstSplit).toEqual({ cgst: 1500, sgst: 1500, igst: 0, total: 3000 });
  });

  it('honours a non-composite rate from the Tax Master', () => {
    // Proves the rate is genuinely data-driven and no longer a hardcoded 0.03.
    const invoice = calculateInvoiceTotals([100000], 0, { ratePercent: 1.5 });
    expect(invoice.gstTax).toBe(1500);
    expect(invoice.gstSplit).toEqual({ cgst: 750, sgst: 750, igst: 0, total: 1500 });
  });

  it('reports the round-off that GST on a whole-rupee base leaves behind (PRD §7.3)', () => {
    const invoice = calculateInvoiceTotals([289440], 0, { ratePercent: 3 });
    // 2,89,440 + 8,683.20 = 2,98,123.20, rounded to 2,98,123.
    expect(invoice.roundOff).toBe(-0.2);
    expect(invoice.grandTotal).toBe(298123);
  });

  it('reports a zero round-off when the exact total is already whole', () => {
    expect(calculateInvoiceTotals([100000], 0, { ratePercent: 3 }).roundOff).toBe(0);
  });
});

describe('multi-tender payment split (PRD §7.5, Milestone 9)', () => {
  it('accepts a split across Cash + Card + UPI that sums exactly to the amount due', () => {
    const result = validatePaymentSplit(100000, [
      { mode: 'Cash', amount: 40000 },
      { mode: 'Card', amount: 35000 },
      { mode: 'UPI', amount: 25000 },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.totalPaid).toBe(100000);
    expect(result.error).toBeNull();
  });

  it('blocks an underpaid split and reports the shortfall', () => {
    const result = validatePaymentSplit(100000, [{ mode: 'Cash', amount: 60000 }]);
    expect(result.isValid).toBe(false);
    expect(result.shortfall).toBe(40000);
    expect(result.error).toMatch(/short by/i);
  });

  it('blocks an overpaid split and reports the excess', () => {
    const result = validatePaymentSplit(100000, [
      { mode: 'Cash', amount: 60000 },
      { mode: 'Card', amount: 60000 },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.shortfall).toBe(-20000);
    expect(result.error).toMatch(/exceeds/i);
  });

  it('rejects a negative payment amount', () => {
    const result = validatePaymentSplit(100000, [
      { mode: 'Cash', amount: 120000 },
      { mode: 'Card', amount: -20000 },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/negative/i);
  });

  it('accepts a single-mode payment (the common case) as a valid split of one', () => {
    const result = validatePaymentSplit(65538, [{ mode: 'UPI', amount: 65538 }]);
    expect(result.isValid).toBe(true);
  });

  it('treats a zero-value bill with no payment entries as settled', () => {
    expect(validatePaymentSplit(0, []).isValid).toBe(true);
  });
});
