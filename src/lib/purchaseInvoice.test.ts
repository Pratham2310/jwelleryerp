import { describe, it, expect } from 'vitest';
import {
  nextPurchaseInvoiceRef,
  purchaseSupplyType,
  computePurchaseTax,
  reverseChargeLegs,
  assessItcEligibility,
  validatePurchaseInvoice,
  summarisePurchaseRegister,
  unbilledReceiptIds,
} from './purchaseInvoice';
import type { PurchaseInvoice, Supplier, Branch } from '../types';

function supplier(over: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1', supplierCode: 'SUP-0001', name: 'Zaveri Bullion Co.',
    supplierType: 'BULLION_DEALER', phone: '9820011223',
    gstin: '27AACCS9948H1Z1', pan: 'AACCS9948H', stateCode: '27',
    openingBalance: 0, creditTermsDays: 30, isActive: true, ...over,
  };
}

const unregistered = supplier({
  id: 'sup-3', name: 'Suresh Polishing Works', supplierType: 'SERVICE',
  gstin: undefined, pan: undefined, stateCode: '27',
});

function branch(stateCode = '27'): Branch {
  return {
    id: 'br-1', branchCode: 'MUM-01', name: 'Mumbai', address: '', gstin: '27AAA0000A1Z1',
    stateCode, invoiceSeriesPrefix: 'INV', defaultStockOwnershipType: 'OWNED', isActive: true,
  };
}

function invoice(over: Partial<PurchaseInvoice> = {}): PurchaseInvoice {
  return {
    id: 'pi1', internalRef: 'PINV-2026-27-001', supplierId: 'sup-1',
    supplierInvoiceNo: 'ZB/2026/881', supplierInvoiceDate: '2026-07-20',
    taxableValue: 725000, gstRatePercent: 3, isReverseCharge: false,
    cgst: 10875, sgst: 10875, igst: 0, totalTax: 21750, invoiceTotal: 746750,
    itcEligible: true, postedOn: '2026-07-21', branchId: 'br-1', ...over,
  };
}

describe('nextPurchaseInvoiceRef', () => {
  it('runs per financial year and continues from the highest', () => {
    expect(nextPurchaseInvoiceRef([], '2026-07-20')).toBe('PINV-2026-27-001');
    expect(nextPurchaseInvoiceRef([invoice({ internalRef: 'PINV-2026-27-007' })], '2026-07-20'))
      .toBe('PINV-2026-27-008');
  });

  it('restarts in a new FY', () => {
    expect(nextPurchaseInvoiceRef([invoice({ internalRef: 'PINV-2025-26-099' })], '2026-07-20'))
      .toBe('PINV-2026-27-001');
  });
});

describe('purchaseSupplyType — compares the SUPPLIER to the branch', () => {
  it('is intra-state when supplier and branch share a state', () => {
    expect(purchaseSupplyType(supplier({ stateCode: '27' }), branch('27'))).toBe('INTRA_STATE');
  });

  it('is inter-state otherwise', () => {
    // Getting the direction backwards would file every inter-state purchase as CGST+SGST,
    // and that credit cannot be set off the way IGST can.
    expect(purchaseSupplyType(supplier({ stateCode: '29' }), branch('27'))).toBe('INTER_STATE');
  });

  it('defaults to intra-state when a state is unknown, per PRD §7.3', () => {
    expect(purchaseSupplyType(supplier({ stateCode: undefined }), branch('27'))).toBe('INTRA_STATE');
    expect(purchaseSupplyType(supplier(), null)).toBe('INTRA_STATE');
  });
});

describe('computePurchaseTax', () => {
  it('splits an intra-state purchase into CGST and SGST', () => {
    const t = computePurchaseTax(725000, 3, 'INTRA_STATE');
    expect(t.totalTax).toBe(21750);
    expect(t.cgst).toBe(10875);
    expect(t.sgst).toBe(10875);
    expect(t.igst).toBe(0);
    expect(t.cgst + t.sgst).toBe(t.totalTax); // halves must reconstitute the whole
  });

  it('puts an inter-state purchase entirely in IGST', () => {
    const t = computePurchaseTax(725000, 3, 'INTER_STATE');
    expect(t.igst).toBe(21750);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
  });

  it('adds the tax to the invoice total on a normal purchase', () => {
    expect(computePurchaseTax(725000, 3, 'INTRA_STATE').invoiceTotal).toBe(746750);
  });

  it('EXCLUDES the tax from the total on a reverse-charge invoice', () => {
    // The supplier bills only the goods; the shop pays the tax to the government itself.
    const t = computePurchaseTax(50000, 18, 'INTRA_STATE', true);
    expect(t.totalTax).toBe(9000);
    expect(t.invoiceTotal).toBe(50000);
  });

  it('handles a zero-rated purchase', () => {
    const t = computePurchaseTax(100000, 0, 'INTRA_STATE');
    expect(t.totalTax).toBe(0);
    expect(t.invoiceTotal).toBe(100000);
  });
});

describe('reverseChargeLegs — both sides, because they net to zero', () => {
  it('returns an output liability AND an input credit', () => {
    // Booking only the credit leaves the books looking right while the shop under-declares
    // tax it legally owes.
    const legs = reverseChargeLegs(9000);
    expect(legs.outputLiability).toBe(9000);
    expect(legs.inputCredit).toBe(9000);
    expect(legs.netCashEffect).toBe(0);
  });

  it('is zero on both legs for no tax', () => {
    expect(reverseChargeLegs(0)).toEqual({ outputLiability: 0, inputCredit: 0, netCashEffect: 0 });
  });
});

describe('assessItcEligibility', () => {
  it('allows credit on a registered supplier’s invoice', () => {
    expect(assessItcEligibility(supplier(), false)).toEqual({ eligible: true, reason: null });
  });

  it('refuses credit on an unregistered supplier’s bill and explains why', () => {
    const a = assessItcEligibility(unregistered, false);
    expect(a.eligible).toBe(false);
    expect(a.reason).toMatch(/unregistered/i);
    expect(a.reason).toMatch(/reverse charge instead/i);
  });

  it('allows credit under reverse charge — the shop paid that tax itself', () => {
    expect(assessItcEligibility(unregistered, true)).toEqual({ eligible: true, reason: null });
  });
});

describe('validatePurchaseInvoice', () => {
  const base = {
    supplierId: 'sup-1', supplierInvoiceNo: 'ZB/2026/900',
    supplierInvoiceDate: '2026-07-25', taxableValue: 100000, gstRatePercent: 3, branchId: 'br-1',
  };

  it('accepts a well-formed invoice', () => {
    expect(validatePurchaseInvoice(base, [], supplier())).toBeNull();
  });

  it('requires supplier, their number, their date, branch and a value', () => {
    expect(validatePurchaseInvoice({ ...base, supplierId: undefined }, [], supplier())).toMatch(/select the supplier/i);
    expect(validatePurchaseInvoice({ ...base, supplierInvoiceNo: '' }, [], supplier())).toMatch(/invoice number/i);
    expect(validatePurchaseInvoice({ ...base, supplierInvoiceDate: '' }, [], supplier())).toMatch(/invoice date/i);
    expect(validatePurchaseInvoice({ ...base, branchId: undefined }, [], supplier())).toMatch(/branch/i);
    expect(validatePurchaseInvoice({ ...base, taxableValue: 0 }, [], supplier())).toMatch(/taxable value/i);
  });

  it('rejects an implausible GST rate', () => {
    expect(validatePurchaseInvoice({ ...base, gstRatePercent: 40 }, [], supplier())).toMatch(/0–28%/);
  });

  it('refuses to book the same supplier invoice twice', () => {
    // The number is the supplier's; booking it again claims the same credit twice.
    const err = validatePurchaseInvoice(
      { ...base, supplierInvoiceNo: 'ZB/2026/881' }, [invoice()], supplier());
    expect(err).toMatch(/already booked as PINV-2026-27-001/);
    expect(err).toMatch(/same credit twice/);
  });

  it('is case- and space-insensitive about the duplicate check', () => {
    expect(validatePurchaseInvoice(
      { ...base, supplierInvoiceNo: ' zb/2026/881 ' }, [invoice()], supplier()))
      .toMatch(/already booked/);
  });

  it('allows the same number from a DIFFERENT supplier', () => {
    expect(validatePurchaseInvoice(
      { ...base, supplierId: 'sup-2', supplierInvoiceNo: 'ZB/2026/881' }, [invoice()], supplier({ id: 'sup-2' })))
      .toBeNull();
  });

  it('refuses reverse charge on a registered supplier — they already charged the tax', () => {
    const err = validatePurchaseInvoice({ ...base, isReverseCharge: true }, [], supplier());
    expect(err).toMatch(/GST-registered and charges tax/i);
  });

  it('allows reverse charge on an unregistered supplier', () => {
    expect(validatePurchaseInvoice(
      { ...base, supplierId: 'sup-3', isReverseCharge: true }, [], unregistered)).toBeNull();
  });
});

describe('summarisePurchaseRegister', () => {
  it('summarises an empty register', () => {
    expect(summarisePurchaseRegister([])).toMatchObject({
      invoiceCount: 0, claimableItc: 0, reverseChargeLiability: 0,
    });
  });

  it('separates claimable credit from reverse-charge LIABILITY', () => {
    // These must never be added together — one is money owed to the shop, the other by it.
    const s = summarisePurchaseRegister([
      invoice(),
      invoice({ id: 'pi2', internalRef: 'PINV-2026-27-002', supplierId: 'sup-3',
        supplierInvoiceNo: 'SP/12', taxableValue: 50000, gstRatePercent: 18,
        isReverseCharge: true, cgst: 4500, sgst: 4500, igst: 0, totalTax: 9000,
        invoiceTotal: 50000, itcEligible: true }),
    ]);
    expect(s.invoiceCount).toBe(2);
    expect(s.totalTaxableValue).toBe(775000);
    expect(s.claimableItc).toBe(30750); // 21750 + 9000
    expect(s.reverseChargeLiability).toBe(9000);
    expect(s.reverseChargeInvoices).toBe(1);
  });

  it('keeps ineligible credit out of the claimable figure', () => {
    const s = summarisePurchaseRegister([
      invoice(),
      invoice({ id: 'pi3', internalRef: 'PINV-2026-27-003', supplierInvoiceNo: 'X/1',
        itcEligible: false, itcIneligibleReason: 'Unregistered supplier', totalTax: 5000 }),
    ]);
    expect(s.claimableItc).toBe(21750);
    expect(s.ineligibleItc).toBe(5000);
  });

  it('splits claimable credit by head', () => {
    const s = summarisePurchaseRegister([
      invoice(),
      invoice({ id: 'pi4', internalRef: 'PINV-2026-27-004', supplierInvoiceNo: 'Y/1',
        cgst: 0, sgst: 0, igst: 21750, totalTax: 21750 }),
    ]);
    expect(s.itcCgst).toBe(10875);
    expect(s.itcSgst).toBe(10875);
    expect(s.itcIgst).toBe(21750);
  });
});

describe('unbilledReceiptIds — an unbilled receipt is an unbooked liability', () => {
  it('lists receipts no invoice has been booked against', () => {
    const invoices = [invoice({ goodsReceiptId: 'grn-1' })];
    expect(unbilledReceiptIds(['grn-1', 'grn-2', 'grn-3'], invoices)).toEqual(['grn-2', 'grn-3']);
  });

  it('returns everything when nothing is billed', () => {
    expect(unbilledReceiptIds(['grn-1'], [])).toEqual(['grn-1']);
  });

  it('returns nothing when all are billed', () => {
    expect(unbilledReceiptIds(['grn-1'], [invoice({ goodsReceiptId: 'grn-1' })])).toEqual([]);
  });
});
