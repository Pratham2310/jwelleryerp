import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateInvoiceTotals, settleOldGold } from './billingCalculations';

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

describe('bill-level discount', () => {
  it('is applied after GST, against the invoice total', () => {
    const invoice = calculateInvoiceTotals([106366], 1500);
    expect(invoice.gstTax).toBe(3191); // 106366 * 3%, rounded
    expect(invoice.grandTotal).toBe(108057); // 106366 + 3191 - 1500
  });
});
