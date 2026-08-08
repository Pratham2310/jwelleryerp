import { describe, it, expect } from 'vitest';
import {
  IRP_SCHEMA_VERSION,
  DUPLICATE_IRN_CODE,
  MAX_ATTEMPTS,
  toIrpDate,
  buildIrpPayload,
  validateIrpPayload,
  idempotencyKey,
  classifyResponse,
  extractIrnFromMessage,
  backoffSeconds,
  shouldRetry,
  recordAttempt,
  gspReadiness,
  type IrpResponse,
} from './eInvoiceGsp';
import type { SaleInvoice, Branch, Customer } from '../types';

const branch = (over: Partial<Branch> = {}): Branch => ({
  id: 'b1', branchCode: 'MUM-01', name: 'Mumbai BST Showroom',
  address: '102 Zaveri Bazaar', gstin: '27AACCS9948H1Z1', stateCode: '27',
  invoiceSeriesPrefix: 'MUM', defaultStockOwnershipType: 'OWNED', isActive: true,
  ...over,
} as Branch);

const invoice = (over: Partial<SaleInvoice> = {}): SaleInvoice => ({
  id: 'i1', invoiceType: 'TAX_INVOICE', invoiceNumber: 'MUM-2026-1001', date: '2026-08-06',
  customerName: 'Sharda Sharma', customerPhone: 'x',
  items: [{ name: 'Coin', netWeight: 10, subtotal: 72950, hsnCode: '7108', gstRatePercent: 3 }],
  oldGoldWeight: 0, oldGoldValue: 0, subtotal: 72950, tax: 2189, discount: 0,
  cgst: 1095, sgst: 1094, igst: 0, roundOff: 0,
  grandTotal: 75139, netAmountDue: 75139, paymentMethod: 'Cash',
  ...over,
} as SaleInvoice);

const buyer = (over: Partial<Customer> = {}): Customer => ({
  id: 'c1', name: 'Sharda Sharma', phone: 'x', email: '', tier: 'Gold',
  loyaltyPoints: 0, lifetimeSpend: 0, savingsSchemeActive: false, stateCode: '27',
  ...over,
} as Customer);

describe('payload shape', () => {
  it('formats the date as dd/mm/yyyy, which is what the IRP accepts', () => {
    // A silent format mismatch is a rejected invoice.
    expect(toIrpDate('2026-08-06')).toBe('06/08/2026');
  });

  it('targets the declared schema version', () => {
    expect(buildIrpPayload(invoice(), branch()).Version).toBe(IRP_SCHEMA_VERSION);
  });

  it('marks a supply B2B only when the buyer has a GSTIN', () => {
    expect(buildIrpPayload(invoice(), branch(), buyer()).TranDtls.SupTyp).toBe('B2C');
    expect(buildIrpPayload(invoice(), branch(), buyer({ gstin: '27AAAAA0000A1Z5' })).TranDtls.SupTyp).toBe('B2B');
  });

  it('uses the literal URP for an unregistered buyer, not an empty string', () => {
    expect(buildIrpPayload(invoice(), branch(), buyer()).BuyerDtls.Gstin).toBe('URP');
  });

  it('maps a credit note to document type CRN', () => {
    expect(buildIrpPayload(invoice({ invoiceType: 'CREDIT_NOTE' }), branch()).DocDtls.Typ).toBe('CRN');
  });

  it('carries HSN, quantity in grams, and the tax split per line', () => {
    const [line] = buildIrpPayload(invoice(), branch()).ItemList;
    expect(line).toMatchObject({ HsnCd: '7108', Unit: 'GMS', Qty: 10, AssAmt: 72950 });
    expect(line.CgstAmt + line.SgstAmt).toBeCloseTo(2189, 0);
  });
});

describe('validateIrpPayload catches what the IRP would reject', () => {
  it('passes a well-formed payload', () => {
    expect(validateIrpPayload(buildIrpPayload(invoice(), branch()))).toEqual([]);
  });

  it('catches a missing HSN, naming the line', () => {
    const noHsn = invoice({ items: [{ name: 'Ring', netWeight: 5, subtotal: 72950 }] } as Partial<SaleInvoice>);
    expect(validateIrpPayload(buildIrpPayload(noHsn, branch()))[0]).toMatch(/has no HSN code/i);
  });

  it('catches a malformed seller GSTIN', () => {
    expect(validateIrpPayload(buildIrpPayload(invoice(), branch({ gstin: 'TOOSHORT' }))))
      .toContainEqual(expect.stringMatching(/15 characters/i));
  });

  it('catches a B2B supply with no buyer GSTIN', () => {
    const payload = buildIrpPayload(invoice(), branch(), buyer({ gstin: '27AAAAA0000A1Z5' }));
    payload.BuyerDtls.Gstin = 'URP';
    expect(validateIrpPayload(payload)).toContainEqual(expect.stringMatching(/B2B supply must carry/i));
  });

  it('catches lines that do not sum to the declared assessable value', () => {
    const payload = buildIrpPayload(invoice(), branch());
    payload.ValDtls.AssVal = 99999;
    expect(validateIrpPayload(payload)).toContainEqual(expect.stringMatching(/do not sum to the declared/i));
  });
});

describe('idempotency', () => {
  it('keys on seller GSTIN, doc type, number and financial year', () => {
    expect(idempotencyKey('27AACCS9948H1Z1', invoice()))
      .toBe('27AACCS9948H1Z1:INV:MUM-2026-1001:2026-27');
  });

  it('puts a January invoice in the PREVIOUS financial year', () => {
    // The Indian FY starts in April; getting this wrong dedupes against the wrong year.
    expect(idempotencyKey('G', invoice({ date: '2026-01-15' }))).toContain('2025-26');
  });

  it('gives a credit note a different key from the invoice of the same number', () => {
    const inv = idempotencyKey('G', invoice());
    const cn = idempotencyKey('G', invoice({ invoiceType: 'CREDIT_NOTE' }));
    expect(inv).not.toBe(cn);
  });

  it('is stable — the same document always produces the same key', () => {
    expect(idempotencyKey('G', invoice())).toBe(idempotencyKey('G', invoice()));
  });
});

describe('classifyResponse', () => {
  const irn = 'a'.repeat(64);

  it('treats a successful registration as registered', () => {
    const r: IrpResponse = { status: 'SUCCESS', irn, ackNo: '1', ackDate: '2026-08-06' };
    expect(classifyResponse(r)).toMatchObject({ outcome: 'REGISTERED', irn });
  });

  it('treats DUPLICATE IRN as already registered, NOT as a failure', () => {
    // The classic integration bug: a retry after a timeout gets 2150, the code marks the
    // invoice FAILED, and a shop with a valid e-invoice believes it has none.
    const r: IrpResponse = {
      status: 'ERROR',
      errors: [{ code: DUPLICATE_IRN_CODE, message: `Duplicate IRN ${irn}` }],
    };
    const c = classifyResponse(r);
    expect(c.outcome).toBe('ALREADY_REGISTERED');
    expect(c.irn).toBe(irn);
  });

  it('pulls the existing IRN out of the duplicate message text', () => {
    expect(extractIrnFromMessage(`Duplicate IRN ${irn}`)).toBe(irn);
    expect(extractIrnFromMessage('no irn here')).toBeUndefined();
  });

  it('marks portal errors retryable', () => {
    for (const code of ['1005', '2283', '9999', 'GSP_TIMEOUT']) {
      const r: IrpResponse = { status: 'ERROR', errors: [{ code, message: 'busy' }] };
      expect(classifyResponse(r).outcome).toBe('RETRYABLE');
    }
  });

  it('marks a validation error TERMINAL — retrying it forever hides the real problem', () => {
    const r: IrpResponse = { status: 'ERROR', errors: [{ code: '2172', message: 'Invalid HSN' }] };
    const c = classifyResponse(r);
    expect(c.outcome).toBe('TERMINAL');
    expect(c.message).toMatch(/Invalid HSN/);
  });

  it('handles an error response with no codes at all', () => {
    expect(classifyResponse({ status: 'ERROR' }).outcome).toBe('TERMINAL');
  });
});

describe('retry policy', () => {
  it('backs off exponentially and caps', () => {
    expect(backoffSeconds(0)).toBe(5);
    expect(backoffSeconds(3)).toBe(40);
    expect(backoffSeconds(20)).toBe(300);
  });

  it('retries only retryable outcomes, and only up to the limit', () => {
    expect(shouldRetry('RETRYABLE', 0)).toBe(true);
    expect(shouldRetry('RETRYABLE', MAX_ATTEMPTS)).toBe(false);
    expect(shouldRetry('TERMINAL', 0)).toBe(false);
    expect(shouldRetry('ALREADY_REGISTERED', 0)).toBe(false);
  });

  it('records an attempt with the next retry delay when one applies', () => {
    expect(recordAttempt('RETRYABLE', 'busy', 1, 'T').nextRetryInSeconds).toBe(10);
    expect(recordAttempt('TERMINAL', 'bad HSN', 1, 'T').nextRetryInSeconds).toBeUndefined();
  });
});

describe('gspReadiness is honest about what is missing', () => {
  it('is never ready without credentials, and says so', () => {
    const r = gspReadiness(branch());
    expect(r.ready).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/no GSP credentials/i);
    expect(r.blockers.join(' ')).toMatch(/simulated/i);
  });

  it('flags a branch with no GSTIN as a separate blocker', () => {
    expect(gspReadiness(branch({ gstin: '' })).blockers[0]).toMatch(/no GSTIN/i);
  });

  it('states that the shape is production-ready even though the wiring is not', () => {
    expect(gspReadiness(branch()).note).toMatch(/not a rewrite/i);
  });
});
