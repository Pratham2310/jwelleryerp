import { describe, it, expect } from 'vitest';
import {
  nextDebitNoteNumber,
  calculatePurchaseReturn,
  validatePurchaseReturn,
  priorReturnedValueFor,
  summarisePurchaseReturns,
  returnableInvoices,
} from './purchaseReturn';
import { canTransition, isSellable, TAG_STATUS_LABEL } from './tagStateMachine';
import type { PurchaseInvoice, PurchaseReturn } from '../types';

function invoice(over: Partial<PurchaseInvoice> = {}): PurchaseInvoice {
  return {
    id: 'pi1', internalRef: 'PINV-2026-27-001', supplierId: 'sup-1',
    supplierInvoiceNo: 'ZB/2026/881', supplierInvoiceDate: '2026-07-20',
    taxableValue: 10000, gstRatePercent: 3, isReverseCharge: false,
    cgst: 150, sgst: 150, igst: 0, totalTax: 300, invoiceTotal: 10300,
    itcEligible: true, postedOn: '2026-07-21', branchId: 'br-1', ...over,
  };
}

function ret(over: Partial<PurchaseReturn> = {}): PurchaseReturn {
  return {
    id: 'dbn1', debitNoteNo: 'DBN-2026-27-001', purchaseInvoiceId: 'pi1', supplierId: 'sup-1',
    returnDate: '2026-07-25', reason: 'Under-karat on assay',
    returnedTaxableValue: -1000, reversedCgst: -15, reversedSgst: -15, reversedIgst: 0,
    reversedTotalTax: -30, debitNoteTotal: -1030, returnedTagIds: [], ...over,
  };
}

describe('ReturnedToSupplier — a purchase return needed an honest state', () => {
  it('is reachable from stock and from goods awaiting hallmark', () => {
    expect(canTransition('InStock', 'ReturnedToSupplier')).toBe(true);
    expect(canTransition('PendingHallmark', 'ReturnedToSupplier')).toBe(true);
    expect(canTransition('RawMetal', 'ReturnedToSupplier')).toBe(true);
  });

  it('is terminal — the piece has left the shop', () => {
    expect(canTransition('ReturnedToSupplier', 'InStock')).toBe(false);
    expect(canTransition('ReturnedToSupplier', 'Sold')).toBe(false);
  });

  it('is not sellable', () => {
    expect(isSellable('ReturnedToSupplier')).toBe(false);
  });

  it('is distinct from DamagedOrMelted, which would misstate the valuation', () => {
    // Goods sent back to a dealer are not goods destroyed.
    expect(TAG_STATUS_LABEL.ReturnedToSupplier).toBe('Returned to Supplier');
    expect(TAG_STATUS_LABEL.ReturnedToSupplier).not.toBe(TAG_STATUS_LABEL.DamagedOrMelted);
  });

  it('cannot be reached from a sold piece — that is a customer return, not a purchase one', () => {
    expect(canTransition('Sold', 'ReturnedToSupplier')).toBe(false);
  });
});

describe('nextDebitNoteNumber', () => {
  it('runs per financial year, continuing from the highest', () => {
    expect(nextDebitNoteNumber([], '2026-07-25')).toBe('DBN-2026-27-001');
    expect(nextDebitNoteNumber([ret({ debitNoteNo: 'DBN-2026-27-004' })], '2026-07-25'))
      .toBe('DBN-2026-27-005');
  });
});

describe('calculatePurchaseReturn', () => {
  it('reverses proportionally on a partial return', () => {
    const t = calculatePurchaseReturn(invoice(), 2500);
    expect(t.returnedTaxableValue).toBe(-2500);
    expect(t.reversedTotalTax).toBe(-75); // a quarter of 300
    expect(t.debitNoteTotal).toBe(-2575);
  });

  it('reverses the full credit on a full return', () => {
    const t = calculatePurchaseReturn(invoice(), 10000);
    expect(t.reversedTotalTax).toBe(-300);
    expect(t.debitNoteTotal).toBe(-10300);
  });

  it('reverses into the SAME heads the credit was claimed under', () => {
    // An IGST claim cannot be reversed as CGST+SGST — different ledgers to the department.
    const intra = calculatePurchaseReturn(invoice(), 10000);
    expect(intra.reversedCgst).toBe(-150);
    expect(intra.reversedSgst).toBe(-150);
    expect(intra.reversedIgst).toBe(0);

    const inter = calculatePurchaseReturn(invoice({ cgst: 0, sgst: 0, igst: 300 }), 10000);
    expect(inter.reversedIgst).toBe(-300);
    expect(inter.reversedCgst).toBe(0);
  });

  it('never yields -0', () => {
    const t = calculatePurchaseReturn(invoice({ totalTax: 0, cgst: 0, sgst: 0 }), 10000);
    expect(Object.is(t.reversedTotalTax, -0)).toBe(false);
    expect(Object.is(t.reversedCgst, -0)).toBe(false);
  });

  it('excludes the tax from a reverse-charge debit note total', () => {
    // The supplier was never paid that tax, so reversing it does not change what they owe back.
    const t = calculatePurchaseReturn(invoice({ isReverseCharge: true }), 10000);
    expect(t.debitNoteTotal).toBe(-10000);
    expect(t.reversedTotalTax).toBe(-300); // the reversal still happens on both legs
  });

  it('handles a zero-value invoice without dividing by zero', () => {
    const t = calculatePurchaseReturn(invoice({ taxableValue: 0, totalTax: 0 }), 0);
    expect(t.reversedTotalTax).toBe(0);
  });
});

describe('successive partial returns must reverse exactly what was claimed', () => {
  // 10,000 taxable / 300 tax over three uneven returns. Independent rounding would leak.
  const inv = invoice({ taxableValue: 10000, totalTax: 300 });
  const parts = [3333, 3333, 3334];

  it('telescopes so the total reversal equals the credit claimed', () => {
    let prior = 0, reversed = 0;
    for (const part of parts) {
      const t = calculatePurchaseReturn(inv, part, prior);
      reversed += t.reversedTotalTax;
      prior += part;
    }
    expect(reversed).toBe(-300);
  });

  it('matches a single full return however the shop gets there', () => {
    const oneGo = calculatePurchaseReturn(inv, 10000);
    let prior = 0, reversed = 0, value = 0;
    for (const part of parts) {
      const t = calculatePurchaseReturn(inv, part, prior);
      reversed += t.reversedTotalTax;
      value += t.returnedTaxableValue;
      prior += part;
    }
    expect(reversed).toBe(oneGo.reversedTotalTax);
    expect(value).toBe(oneGo.returnedTaxableValue);
  });

  it('is unchanged for a first return with nothing prior', () => {
    expect(calculatePurchaseReturn(inv, 3333, 0)).toEqual(calculatePurchaseReturn(inv, 3333));
  });
});

describe('validatePurchaseReturn', () => {
  const base = { returnDate: '2026-07-25', reason: 'Under-karat on assay', returnedTaxableValue: 2500 };

  it('accepts a well-formed return', () => {
    expect(validatePurchaseReturn(base, invoice())).toBeNull();
  });

  it('requires an invoice, a date, a reason and a value', () => {
    expect(validatePurchaseReturn(base, null)).toMatch(/select the purchase invoice/i);
    expect(validatePurchaseReturn({ ...base, returnDate: '' }, invoice())).toMatch(/return date/i);
    expect(validatePurchaseReturn({ ...base, reason: 'no' }, invoice())).toMatch(/record why/i);
    expect(validatePurchaseReturn({ ...base, returnedTaxableValue: 0 }, invoice())).toMatch(/taxable value/i);
  });

  it('refuses to return more than remains unreturned', () => {
    // Reversing credit that was never claimed would leave the books owing the department money.
    const err = validatePurchaseReturn({ ...base, returnedTaxableValue: 9000 }, invoice(), 2000);
    expect(err).toMatch(/Only ₹8,000 of PINV-2026-27-001 remains/);
    expect(err).toMatch(/never claimed/);
  });

  it('allows returning exactly the remaining balance', () => {
    expect(validatePurchaseReturn({ ...base, returnedTaxableValue: 8000 }, invoice(), 2000)).toBeNull();
  });

  it('refuses a further return once fully returned', () => {
    expect(validatePurchaseReturn(base, invoice(), 10000)).toMatch(/already been returned in full/i);
  });
});

describe('priorReturnedValueFor', () => {
  it('sums earlier returns against the same invoice only', () => {
    const returns = [
      ret({ id: 'a', returnedTaxableValue: -1000 }),
      ret({ id: 'b', returnedTaxableValue: -1500 }),
      ret({ id: 'c', purchaseInvoiceId: 'pi-other', returnedTaxableValue: -9999 }),
    ];
    expect(priorReturnedValueFor('pi1', returns)).toBe(2500);
  });

  it('is zero when nothing has been returned', () => {
    expect(priorReturnedValueFor('pi1', [])).toBe(0);
  });
});

describe('summarisePurchaseReturns', () => {
  it('summarises an empty book', () => {
    expect(summarisePurchaseReturns([], [])).toMatchObject({ count: 0, reversedItc: 0, netClaimableItc: 0 });
  });

  it('nets reversed credit off the claimed credit', () => {
    const s = summarisePurchaseReturns([ret()], [invoice()]);
    expect(s.reversedItc).toBe(30);
    expect(s.netClaimableItc).toBe(270); // 300 claimed less 30 reversed
  });

  it('counts an invoice returned in full', () => {
    const s = summarisePurchaseReturns([ret({ returnedTaxableValue: -10000 })], [invoice()]);
    expect(s.fullyReturnedInvoices).toBe(1);
    expect(s.returnedValue).toBe(10000);
  });

  it('ignores credit that was never claimable', () => {
    const s = summarisePurchaseReturns([], [invoice({ itcEligible: false })]);
    expect(s.netClaimableItc).toBe(0);
  });
});

describe('returnableInvoices', () => {
  const invoices = [invoice({ id: 'pi1' }), invoice({ id: 'pi2', supplierId: 'sup-2' })];

  it('offers invoices with value still unreturned', () => {
    expect(returnableInvoices(invoices, []).map(i => i.id)).toEqual(['pi1', 'pi2']);
  });

  it('drops a fully returned invoice', () => {
    const returns = [ret({ purchaseInvoiceId: 'pi1', returnedTaxableValue: -10000 })];
    expect(returnableInvoices(invoices, returns).map(i => i.id)).toEqual(['pi2']);
  });

  it('keeps a partially returned one', () => {
    const returns = [ret({ purchaseInvoiceId: 'pi1', returnedTaxableValue: -4000 })];
    expect(returnableInvoices(invoices, returns).map(i => i.id)).toEqual(['pi1', 'pi2']);
  });

  it('filters to one supplier when asked', () => {
    expect(returnableInvoices(invoices, [], 'sup-2').map(i => i.id)).toEqual(['pi2']);
  });
});
