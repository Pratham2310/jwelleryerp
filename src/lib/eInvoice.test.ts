import { describe, it, expect } from 'vitest';
import {
  isEInvoiceApplicable,
  financialYearOf,
  generateIrn,
  buildQrPayload,
  canTransitionEInvoice,
  canCancelEInvoice,
  hoursUntilCancellationCloses,
  submitForIrn,
  cancelEInvoice,
  nextEWayBillNumber,
  eWayBillValidityDays,
  eWayBillExpiry,
  validateEWayBillDraft,
  CANCELLATION_WINDOW_HOURS,
} from './eInvoice';
import type { SaleInvoice, EInvoiceRecord, EInvoiceStatus } from '../types';

const GSTIN = '27AACCS9948H1Z1';

function invoice(over: Partial<SaleInvoice> = {}): SaleInvoice {
  return {
    id: 'inv1',
    invoiceType: 'TAX_INVOICE',
    invoiceNumber: 'MUM/2026-27/0001',
    date: '2026-07-29',
    customerName: 'Walk-in',
    customerPhone: 'N/A',
    items: [],
    oldGoldWeight: 0,
    oldGoldValue: 0,
    subtotal: 100000,
    tax: 3000,
    discount: 0,
    grandTotal: 103000,
    netAmountDue: 103000,
    paymentMethod: 'Cash',
    ...over,
  };
}

describe('isEInvoiceApplicable', () => {
  it('applies to tax invoices and credit notes', () => {
    expect(isEInvoiceApplicable({ invoiceType: 'TAX_INVOICE' })).toBe(true);
    expect(isEInvoiceApplicable({ invoiceType: 'CREDIT_NOTE' })).toBe(true);
  });

  it('never applies to an estimate — a quotation is not a supply', () => {
    expect(isEInvoiceApplicable({ invoiceType: 'ESTIMATE' })).toBe(false);
  });
});

describe('financialYearOf — the Indian FY is part of the IRN input', () => {
  it('starts a new FY on 1 April', () => {
    expect(financialYearOf('2026-04-01')).toBe('2026-27');
    expect(financialYearOf('2026-03-31')).toBe('2025-26');
  });

  it('handles both halves of a calendar year', () => {
    expect(financialYearOf('2026-01-15')).toBe('2025-26');
    expect(financialYearOf('2026-12-15')).toBe('2026-27');
  });

  it('pads the century rollover', () => {
    expect(financialYearOf('2099-05-01')).toBe('2099-00');
  });
});

describe('generateIrn', () => {
  it('produces a 64-character hex string, the real IRN shape', () => {
    const irn = generateIrn(GSTIN, 'INV', 'MUM/2026-27/0001', '2026-27');
    expect(irn).toHaveLength(64);
    expect(irn).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic, so a retry after a timeout cannot double-register a document', () => {
    // The real IRP is idempotent per (GSTIN, doc type, doc number, FY); this mirrors that.
    const a = generateIrn(GSTIN, 'INV', 'MUM/2026-27/0001', '2026-27');
    const b = generateIrn(GSTIN, 'INV', 'MUM/2026-27/0001', '2026-27');
    expect(a).toBe(b);
  });

  it('differs for every distinguishing input', () => {
    const base = generateIrn(GSTIN, 'INV', 'MUM/2026-27/0001', '2026-27');
    expect(generateIrn('29AACCS9948H3Z7', 'INV', 'MUM/2026-27/0001', '2026-27')).not.toBe(base);
    expect(generateIrn(GSTIN, 'CRN', 'MUM/2026-27/0001', '2026-27')).not.toBe(base);
    expect(generateIrn(GSTIN, 'INV', 'MUM/2026-27/0002', '2026-27')).not.toBe(base);
    expect(generateIrn(GSTIN, 'INV', 'MUM/2026-27/0001', '2025-26')).not.toBe(base);
  });

  it('does not collide across a realistic run of invoice numbers', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 2000; i++) {
      seen.add(generateIrn(GSTIN, 'INV', `MUM/2026-27/${i}`, '2026-27'));
    }
    expect(seen.size).toBe(2000);
  });
});

describe('buildQrPayload', () => {
  it('carries the NIC QR fields and is explicitly marked simulated', () => {
    const payload = JSON.parse(buildQrPayload(invoice(), GSTIN, 'abc'));
    expect(payload.SellerGstin).toBe(GSTIN);
    expect(payload.DocNo).toBe('MUM/2026-27/0001');
    expect(payload.DocTyp).toBe('INV');
    expect(payload.TotInvVal).toBe(103000);
    expect(payload.Irn).toBe('abc');
    // A simulated payload must never be mistakable for a genuinely signed one.
    expect(payload.SIMULATED).toBe(true);
  });

  it('marks a credit note with the CRN document type', () => {
    const payload = JSON.parse(buildQrPayload(invoice({ invoiceType: 'CREDIT_NOTE' }), GSTIN, 'abc'));
    expect(payload.DocTyp).toBe('CRN');
  });
});

describe('e-Invoice state machine', () => {
  const legal: [EInvoiceStatus, EInvoiceStatus][] = [
    ['PENDING', 'GENERATED'],
    ['PENDING', 'FAILED'],
    ['FAILED', 'PENDING'], // the retry queue PRD §9.4 requires
    ['FAILED', 'GENERATED'],
    ['GENERATED', 'CANCELLED'],
  ];
  it.each(legal)('allows %s -> %s', (a, b) => expect(canTransitionEInvoice(a, b)).toBe(true));

  const illegal: [EInvoiceStatus, EInvoiceStatus][] = [
    ['GENERATED', 'PENDING'], // an IRN, once issued, is never un-issued
    ['GENERATED', 'FAILED'],
    ['CANCELLED', 'GENERATED'], // a cancelled e-Invoice cannot be revived
    ['CANCELLED', 'PENDING'],
    ['NOT_APPLICABLE', 'GENERATED'], // an estimate never gets an IRN
    ['PENDING', 'PENDING'],
  ];
  it.each(illegal)('blocks %s -> %s', (a, b) => expect(canTransitionEInvoice(a, b)).toBe(false));
});

describe('submitForIrn', () => {
  const now = new Date('2026-07-29T10:00:00Z');

  it('registers a tax invoice and returns a full acknowledgement', () => {
    const r = submitForIrn(invoice(), GSTIN, undefined, { now });
    expect(r.status).toBe('GENERATED');
    expect(r.irn).toMatch(/^[0-9a-f]{64}$/);
    expect(r.ackNo).toBeTruthy();
    expect(r.ackDate).toBe(now.toISOString());
    expect(r.signedQrPayload).toContain('SIMULATED');
    expect(r.attempts).toBe(1);
  });

  it('refuses to register an estimate', () => {
    const r = submitForIrn(invoice({ invoiceType: 'ESTIMATE' }), GSTIN, undefined, { now });
    expect(r.status).toBe('NOT_APPLICABLE');
    expect(r.irn).toBeUndefined();
  });

  it('records a failure with a reason and keeps counting attempts', () => {
    const first = submitForIrn(invoice(), GSTIN, undefined, { now, forceFailure: true });
    expect(first.status).toBe('FAILED');
    expect(first.failureReason).toMatch(/timeout/i);
    expect(first.attempts).toBe(1);

    const retry = submitForIrn(invoice(), GSTIN, first, { now });
    expect(retry.status).toBe('GENERATED');
    expect(retry.attempts).toBe(2);
  });

  it('yields the same IRN on a retry, so a timeout cannot register twice', () => {
    const a = submitForIrn(invoice(), GSTIN, undefined, { now });
    const b = submitForIrn(invoice(), GSTIN, a, { now });
    expect(b.irn).toBe(a.irn);
  });
});

describe('cancellation window (PRD §9.4 — 24 hours)', () => {
  const acked: EInvoiceRecord = {
    status: 'GENERATED',
    attempts: 1,
    irn: 'x'.repeat(64),
    ackDate: '2026-07-29T10:00:00Z',
  };

  it('allows cancellation inside the window', () => {
    expect(canCancelEInvoice(acked, new Date('2026-07-29T18:00:00Z'))).toBe(true);
    expect(canCancelEInvoice(acked, new Date('2026-07-30T09:59:00Z'))).toBe(true);
  });

  it('refuses once the window has closed', () => {
    expect(canCancelEInvoice(acked, new Date('2026-07-30T10:01:00Z'))).toBe(false);
  });

  it('treats exactly 24 hours as still inside', () => {
    expect(canCancelEInvoice(acked, new Date('2026-07-30T10:00:00Z'))).toBe(true);
  });

  it('never allows cancelling something not generated', () => {
    expect(canCancelEInvoice({ status: 'PENDING', attempts: 1 })).toBe(false);
    expect(canCancelEInvoice({ status: 'FAILED', attempts: 1 })).toBe(false);
    expect(canCancelEInvoice(undefined)).toBe(false);
  });

  it('reports the hours remaining, floored at zero', () => {
    expect(hoursUntilCancellationCloses(acked, new Date('2026-07-29T16:00:00Z'))).toBe(18);
    expect(hoursUntilCancellationCloses(acked, new Date('2026-08-01T10:00:00Z'))).toBe(0);
    expect(hoursUntilCancellationCloses({ status: 'PENDING', attempts: 1 })).toBeNull();
  });

  it('cancels with a reason and stamps the time', () => {
    const { record, error } = cancelEInvoice(acked, 'Wrong customer selected', new Date('2026-07-29T12:00:00Z'));
    expect(error).toBeNull();
    expect(record.status).toBe('CANCELLED');
    expect(record.cancelReason).toBe('Wrong customer selected');
    expect(record.cancelledOn).toBeTruthy();
  });

  it('requires a substantive reason', () => {
    const { record, error } = cancelEInvoice(acked, 'x', new Date('2026-07-29T12:00:00Z'));
    expect(error).toMatch(/at least 5 characters/i);
    expect(record.status).toBe('GENERATED'); // unchanged
  });

  it('points the user at a credit note once the window has closed', () => {
    const { record, error } = cancelEInvoice(acked, 'Wrong customer', new Date('2026-08-05T12:00:00Z'));
    expect(error).toMatch(/credit note/i);
    expect(error).toContain(String(CANCELLATION_WINDOW_HOURS));
    expect(record.status).toBe('GENERATED');
  });
});

describe('e-Way Bill (PRD §9.5)', () => {
  it('allocates a 12-digit number from the highest existing, not a count', () => {
    const first = nextEWayBillNumber([]);
    expect(first).toHaveLength(12);
    expect(nextEWayBillNumber([first])).toBe(String(Number(first) + 1));
  });

  it('cannot collide after a record is deleted', () => {
    const ebn = nextEWayBillNumber(['341000000005']);
    expect(ebn).toBe('341000000006');
  });

  it('gives one day per 200km, part thereof, minimum one day', () => {
    expect(eWayBillValidityDays(0)).toBe(1);
    expect(eWayBillValidityDays(150)).toBe(1);
    expect(eWayBillValidityDays(200)).toBe(1);
    expect(eWayBillValidityDays(201)).toBe(2);
    expect(eWayBillValidityDays(600)).toBe(3);
  });

  it('computes the expiry date from the validity', () => {
    expect(eWayBillExpiry('2026-07-29', 150)).toBe('2026-07-30');
    expect(eWayBillExpiry('2026-07-29', 600)).toBe('2026-08-01');
  });

  it('validates the transporter, vehicle format and distance', () => {
    const ok = { transporterName: 'Blue Dart', vehicleNumber: 'MH12AB1234', distanceKm: 150 };
    expect(validateEWayBillDraft(ok)).toBeNull();

    expect(validateEWayBillDraft({ ...ok, transporterName: '' })).toMatch(/transporter/i);
    expect(validateEWayBillDraft({ ...ok, vehicleNumber: '' })).toMatch(/vehicle number is required/i);
    expect(validateEWayBillDraft({ ...ok, vehicleNumber: 'NOTAPLATE' })).toMatch(/valid vehicle number/i);
    expect(validateEWayBillDraft({ ...ok, distanceKm: 0 })).toMatch(/distance/i);
    expect(validateEWayBillDraft({ ...ok, distanceKm: 9000 })).toMatch(/implausible/i);
  });

  it('accepts a vehicle number written with spaces or dashes', () => {
    expect(validateEWayBillDraft({ transporterName: 'X', vehicleNumber: 'MH 12 AB 1234', distanceKm: 10 })).toBeNull();
    expect(validateEWayBillDraft({ transporterName: 'X', vehicleNumber: 'mh-12-ab-1234', distanceKm: 10 })).toBeNull();
  });
});
