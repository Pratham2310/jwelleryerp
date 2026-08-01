import { describe, it, expect } from 'vitest';
import {
  canTransitionPo,
  isPoSettled,
  nextPoNumber,
  lineProgress,
  resolvePoStatusFromReceipts,
  isFullyReceived,
  poValue,
  poCommittedWeight,
  validatePoDraft,
  validatePoCancellation,
  summarisePos,
  receivablePos,
  PO_STATUS_LABEL,
} from './purchaseOrder';
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../types';

function rawLine(over: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    id: 'l1', kind: 'RAW_METAL', description: '100g 24K bullion bar',
    metalType: 'Gold (24K)', purityPercent: 99.9, orderedWeight: 100, ratePerGram: 7250, ...over,
  };
}

function goodsLine(over: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    id: 'l2', kind: 'FINISHED_GOODS', description: 'Temple choker',
    orderedQty: 5, ratePerPiece: 250000, ...over,
  };
}

function po(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po1', poNumber: 'PO-2026-27-001', supplierId: 'sup-1',
    orderDate: '2026-07-01', expectedDeliveryDate: '2026-07-15',
    rateBasis: 'FIXED', status: 'Sent', lines: [rawLine()], branchId: 'br-1', ...over,
  };
}

describe('PO lifecycle', () => {
  const legal: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
    ['Draft', 'Sent'], ['Draft', 'Cancelled'],
    ['Sent', 'PartiallyReceived'], ['Sent', 'Closed'], ['Sent', 'Cancelled'],
    ['PartiallyReceived', 'Closed'], ['PartiallyReceived', 'Cancelled'],
  ];
  it.each(legal)('allows %s -> %s', (a, b) => expect(canTransitionPo(a, b)).toBe(true));

  const illegal: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
    ['Draft', 'PartiallyReceived'], // goods cannot arrive against an unsent order
    ['Closed', 'Sent'],
    ['Cancelled', 'Sent'],
    ['Sent', 'Draft'],
    ['Sent', 'Sent'],
  ];
  it.each(illegal)('blocks %s -> %s', (a, b) => expect(canTransitionPo(a, b)).toBe(false));

  it('treats Closed and Cancelled as settled', () => {
    expect(isPoSettled('Closed')).toBe(true);
    expect(isPoSettled('Cancelled')).toBe(true);
    expect(isPoSettled('PartiallyReceived')).toBe(false);
  });

  it('labels every status', () => {
    expect(Object.keys(PO_STATUS_LABEL)).toHaveLength(5);
  });
});

describe('nextPoNumber — per Indian financial year (Apr–Mar)', () => {
  it('uses the FY of the order date, not the calendar year', () => {
    expect(nextPoNumber([], '2026-04-01')).toBe('PO-2026-27-001');
    expect(nextPoNumber([], '2026-03-31')).toBe('PO-2025-26-001');
  });

  it('continues from the highest in that FY, not the array length', () => {
    const list = [po({ poNumber: 'PO-2026-27-001' }), po({ poNumber: 'PO-2026-27-014' })];
    expect(nextPoNumber(list, '2026-07-01')).toBe('PO-2026-27-015');
  });

  it('restarts the series in a new financial year', () => {
    const list = [po({ poNumber: 'PO-2025-26-099' })];
    expect(nextPoNumber(list, '2026-07-01')).toBe('PO-2026-27-001');
  });
});

describe('lineProgress', () => {
  it('tracks raw metal in grams', () => {
    const p = lineProgress(rawLine({ orderedWeight: 100, receivedWeight: 40 }));
    expect(p).toMatchObject({ ordered: 100, received: 40, outstanding: 60, unit: 'g', isComplete: false });
  });

  it('tracks finished goods in pieces', () => {
    const p = lineProgress(goodsLine({ orderedQty: 5, receivedQty: 5 }));
    expect(p).toMatchObject({ ordered: 5, received: 5, outstanding: 0, unit: 'pcs', isComplete: true });
  });

  it('treats an unreceived line as outstanding in full', () => {
    expect(lineProgress(rawLine()).outstanding).toBe(100);
  });

  it('flags over-receipt rather than hiding it — bullion really does arrive heavy', () => {
    const p = lineProgress(rawLine({ orderedWeight: 100, receivedWeight: 100.5 }));
    expect(p.isOverReceived).toBe(true);
    expect(p.outstanding).toBe(0); // never negative
    expect(p.isComplete).toBe(true);
  });

  it('does not drift on fractional gram receipts', () => {
    const p = lineProgress(rawLine({ orderedWeight: 8.2, receivedWeight: 3.1 }));
    expect(p.outstanding).toBe(5.1);
  });
});

describe('resolvePoStatusFromReceipts', () => {
  it('stays Sent while nothing has arrived', () => {
    expect(resolvePoStatusFromReceipts(po())).toBe('Sent');
  });

  it('moves to PartiallyReceived on the first receipt', () => {
    expect(resolvePoStatusFromReceipts(po({ lines: [rawLine({ receivedWeight: 10 })] })))
      .toBe('PartiallyReceived');
  });

  it('does NOT auto-close a fully received order — closing is a decision, not arithmetic', () => {
    // A shop may hold a fully-received PO open pending the supplier's invoice.
    const full = po({ lines: [rawLine({ receivedWeight: 100 })] });
    expect(isFullyReceived(full)).toBe(true);
    expect(resolvePoStatusFromReceipts(full)).toBe('PartiallyReceived');
  });

  it('leaves a settled PO alone', () => {
    expect(resolvePoStatusFromReceipts(po({ status: 'Closed' }))).toBe('Closed');
    expect(resolvePoStatusFromReceipts(po({ status: 'Cancelled' }))).toBe('Cancelled');
  });

  it('is not fully received when it has no lines at all', () => {
    expect(isFullyReceived(po({ lines: [] }))).toBe(false);
  });
});

describe('poValue — an unfixed order has no value, not a zero one', () => {
  it('values a fixed raw-metal order', () => {
    expect(poValue(po())).toBe(725000); // 100g x 7250
  });

  it('values fixed finished goods per piece', () => {
    expect(poValue(po({ lines: [goodsLine()] }))).toBe(1250000); // 5 x 250000
  });

  it('sums a mixed order', () => {
    expect(poValue(po({ lines: [rawLine(), goodsLine()] }))).toBe(1975000);
  });

  it('returns NULL for an unfixed-rate order', () => {
    // Zero would flow into a commitment total and understate what the shop has agreed to buy;
    // today's rate would look authoritative while being a guess.
    expect(poValue(po({ rateBasis: 'UNFIXED', lines: [rawLine({ ratePerGram: undefined })] }))).toBeNull();
  });

  it('still reports the committed WEIGHT of an unfixed order', () => {
    // The metal commitment is real and known even when its price is not.
    const unfixed = po({ rateBasis: 'UNFIXED', lines: [rawLine({ ratePerGram: undefined })] });
    expect(poCommittedWeight(unfixed)).toBe(100);
  });

  it('counts only raw metal toward committed weight', () => {
    expect(poCommittedWeight(po({ lines: [rawLine(), goodsLine()] }))).toBe(100);
  });
});

describe('validatePoDraft', () => {
  const base = { supplierId: 'sup-1', orderDate: '2026-07-01', branchId: 'br-1', rateBasis: 'FIXED' as const };

  it('accepts a well-formed order', () => {
    expect(validatePoDraft({ ...base, lines: [rawLine()] })).toBeNull();
  });

  it('requires supplier, date, branch and at least one line', () => {
    expect(validatePoDraft({ ...base, supplierId: undefined, lines: [rawLine()] })).toMatch(/select the supplier/i);
    expect(validatePoDraft({ ...base, orderDate: undefined, lines: [rawLine()] })).toMatch(/order date/i);
    expect(validatePoDraft({ ...base, branchId: undefined, lines: [rawLine()] })).toMatch(/branch/i);
    expect(validatePoDraft({ ...base, lines: [] })).toMatch(/at least one line/i);
  });

  it('refuses a delivery date before the order date', () => {
    expect(validatePoDraft({ ...base, expectedDeliveryDate: '2026-06-01', lines: [rawLine()] }))
      .toMatch(/cannot be before the order date/i);
  });

  it('requires metal, weight and purity on a raw-metal line', () => {
    expect(validatePoDraft({ ...base, lines: [rawLine({ metalType: undefined })] })).toMatch(/select the metal/i);
    expect(validatePoDraft({ ...base, lines: [rawLine({ orderedWeight: 0 })] })).toMatch(/weight to order/i);
    expect(validatePoDraft({ ...base, lines: [rawLine({ purityPercent: 0 })] })).toMatch(/purity being bought/i);
    expect(validatePoDraft({ ...base, lines: [rawLine({ purityPercent: 120 })] })).toMatch(/0–100%/);
  });

  it('requires a whole number of finished pieces', () => {
    expect(validatePoDraft({ ...base, lines: [goodsLine({ orderedQty: 2.5 })] })).toMatch(/whole number/i);
    expect(validatePoDraft({ ...base, lines: [goodsLine({ orderedQty: 0 })] })).toMatch(/whole number/i);
  });

  it('requires a rate on a FIXED order and names the alternative', () => {
    const err = validatePoDraft({ ...base, lines: [rawLine({ ratePerGram: undefined })] });
    expect(err).toMatch(/needs an agreed rate/i);
    expect(err).toMatch(/rate to be fixed/i);
  });

  it('does not require a rate on an UNFIXED order — that is the point of one', () => {
    expect(validatePoDraft({
      ...base, rateBasis: 'UNFIXED', lines: [rawLine({ ratePerGram: undefined })],
    })).toBeNull();
  });

  it('names the offending line', () => {
    expect(validatePoDraft({ ...base, lines: [rawLine(), rawLine({ id: 'l9', orderedWeight: 0 })] }))
      .toMatch(/100g 24K bullion bar/);
  });
});

describe('validatePoCancellation', () => {
  it('accepts a reasoned cancellation of an untouched order', () => {
    expect(validatePoCancellation(po(), 'Dealer withdrew the quote')).toBeNull();
  });

  it('requires a reason', () => {
    expect(validatePoCancellation(po(), 'no')).toMatch(/record why/i);
  });

  it('refuses to cancel an order goods have arrived against', () => {
    // Cancelling would orphan those receipts; closing short is the correct move.
    expect(validatePoCancellation(po({ lines: [rawLine({ receivedWeight: 10 })] }), 'Changed mind'))
      .toMatch(/close it short instead/i);
  });

  it('refuses to cancel an already-settled order', () => {
    expect(validatePoCancellation(po({ status: 'Closed' }), 'Any reason here')).toMatch(/already closed/i);
  });
});

describe('summarisePos', () => {
  it('summarises an empty book', () => {
    expect(summarisePos([])).toMatchObject({ total: 0, open: 0, committedValue: 0, unpricedOrders: 0 });
  });

  it('separates priced commitment from orders that cannot yet be priced', () => {
    const s = summarisePos([
      po({ id: 'a' }),
      po({ id: 'b', rateBasis: 'UNFIXED', lines: [rawLine({ ratePerGram: undefined, orderedWeight: 50 })] }),
      po({ id: 'c', status: 'Closed' }),
    ], '2026-07-10');
    expect(s.total).toBe(3);
    expect(s.open).toBe(2);
    expect(s.committedValue).toBe(725000); // only the fixed one
    expect(s.unpricedOrders).toBe(1);
    expect(s.committedWeight).toBe(150);
  });

  it('counts orders past their expected delivery date', () => {
    const s = summarisePos([po({ expectedDeliveryDate: '2026-07-01' })], '2026-07-10');
    expect(s.overdue).toBe(1);
    expect(summarisePos([po({ expectedDeliveryDate: '2026-07-20' })], '2026-07-10').overdue).toBe(0);
  });

  it('excludes settled orders from the overdue count', () => {
    expect(summarisePos([po({ status: 'Closed', expectedDeliveryDate: '2026-01-01' })], '2026-07-10').overdue).toBe(0);
  });
});

describe('receivablePos', () => {
  const list = [
    po({ id: 'a', status: 'Sent', supplierId: 'sup-1' }),
    po({ id: 'b', status: 'PartiallyReceived', supplierId: 'sup-2' }),
    po({ id: 'c', status: 'Draft', supplierId: 'sup-1' }),
    po({ id: 'd', status: 'Closed', supplierId: 'sup-1' }),
  ];

  it('offers only orders goods can actually arrive against', () => {
    expect(receivablePos(list).map(p => p.id)).toEqual(['a', 'b']);
  });

  it('filters to one supplier when asked', () => {
    expect(receivablePos(list, 'sup-1').map(p => p.id)).toEqual(['a']);
  });
});
