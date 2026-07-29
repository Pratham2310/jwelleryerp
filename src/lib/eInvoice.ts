/**
 * e-Invoice (IRN/QR) and e-Way Bill — SIMULATION ONLY (PRD §9.4/§9.5, Milestone 22).
 *
 * There is no GSP/NIC integration here and there must not be: `.ai/IMPLEMENTATION_WORKFLOW.md`
 * sets simulation as a ground rule for statutory portals. What this module does model is the
 * data shape and the state machine, so that swapping in a real Invoice Registration Portal
 * client later is a transport change rather than a redesign.
 *
 * The IRN produced here is deterministic and clearly marked as simulated. A real IRN is the
 * SHA-256 of supplier GSTIN + document type + document number + financial year; this uses the
 * same *inputs* and the same 64-hex *shape*, so the plumbing (storage, display, dedupe,
 * idempotency on retry) is exercised honestly — but it is NOT a cryptographic hash and must
 * never be presented to a tax authority as one.
 */

import type { SaleInvoice, EInvoiceRecord, EInvoiceStatus } from '../types';

/** Only real fiscal documents get an IRN. An ESTIMATE is a quotation and is not a supply. */
export function isEInvoiceApplicable(invoice: Pick<SaleInvoice, 'invoiceType'>): boolean {
  return invoice.invoiceType === 'TAX_INVOICE' || invoice.invoiceType === 'CREDIT_NOTE';
}

/**
 * Indian financial year label for a date, e.g. 2026-04-01 → "2026-27", 2026-03-31 → "2025-26".
 * The FY runs April–March and is part of the IRN input, so an off-by-one here would produce a
 * different IRN for the same document.
 */
export function financialYearOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0 = January
  const startYear = month >= 3 ? year : year - 1; // April is month index 3
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * Deterministic 64-hex stand-in for the real SHA-256 IRN.
 *
 * Determinism is the point: resubmitting the same document must yield the same IRN, exactly as
 * the real portal is idempotent per (GSTIN, doc type, doc number, FY). That is what stops a
 * retry after a timeout from registering the same invoice twice.
 */
export function generateIrn(
  supplierGstin: string,
  docType: string,
  docNumber: string,
  financialYear: string
): string {
  const seed = `${supplierGstin}|${docType}|${docNumber}|${financialYear}`;

  // FNV-1a over four offset streams, concatenated to 64 hex chars. Not cryptographic —
  // see the module header. Sufficient to be stable, well-distributed and collision-free
  // across the document volumes a single shop produces.
  const stream = (offset: number): string => {
    let h = 0x811c9dc5 ^ offset;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };

  return [0, 1, 2, 3, 4, 5, 6, 7].map(i => stream(i * 0x9e3779b9)).join('');
}

/** The fields the NIC signed QR carries (PRD §9.4). Encoded into the QR shown on the invoice. */
export function buildQrPayload(invoice: SaleInvoice, supplierGstin: string, irn: string): string {
  return JSON.stringify({
    SellerGstin: supplierGstin,
    BuyerGstin: invoice.customerId ? undefined : 'URP', // URP = unregistered person
    DocNo: invoice.invoiceNumber,
    DocTyp: invoice.invoiceType === 'CREDIT_NOTE' ? 'CRN' : 'INV',
    DocDt: invoice.date,
    TotInvVal: invoice.grandTotal,
    Irn: irn,
    SIMULATED: true, // never let a simulated payload be mistaken for a signed one
  });
}

const TRANSITIONS: Record<EInvoiceStatus, EInvoiceStatus[]> = {
  NOT_APPLICABLE: [],
  PENDING: ['GENERATED', 'FAILED'],
  // A failed submission is retried — that is the queue/retry mechanism PRD §9.4 asks for.
  FAILED: ['PENDING', 'GENERATED'],
  GENERATED: ['CANCELLED'],
  CANCELLED: [],
};

export function canTransitionEInvoice(from: EInvoiceStatus, to: EInvoiceStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const CANCELLATION_WINDOW_HOURS = 24;

/**
 * PRD §9.4: "e-Invoices can only be cancelled within 24 hours on the portal."
 *
 * After the window closes the only lawful remedy is a credit note, which this app already
 * supports (Milestone 12) — so refusing here does not strand the user.
 */
export function canCancelEInvoice(record: EInvoiceRecord | undefined, now: Date = new Date()): boolean {
  if (!record || record.status !== 'GENERATED' || !record.ackDate) return false;
  const acked = new Date(record.ackDate).getTime();
  if (!Number.isFinite(acked)) return false;
  const hours = (now.getTime() - acked) / 36e5;
  return hours >= 0 && hours <= CANCELLATION_WINDOW_HOURS;
}

export function hoursUntilCancellationCloses(
  record: EInvoiceRecord | undefined,
  now: Date = new Date()
): number | null {
  if (!record?.ackDate || record.status !== 'GENERATED') return null;
  const acked = new Date(record.ackDate).getTime();
  if (!Number.isFinite(acked)) return null;
  const remaining = CANCELLATION_WINDOW_HOURS - (now.getTime() - acked) / 36e5;
  return Math.max(0, Math.round(remaining * 10) / 10);
}

export interface SubmissionResult {
  record: EInvoiceRecord;
}

/**
 * Simulates a submission to the IRP. `forceFailure` exists so the UI can exercise the
 * failure/retry path deliberately rather than leaving it to chance — an error path nobody can
 * reproduce is an error path nobody has tested.
 */
export function submitForIrn(
  invoice: SaleInvoice,
  supplierGstin: string,
  previous: EInvoiceRecord | undefined,
  options: { forceFailure?: boolean; now?: Date } = {}
): EInvoiceRecord {
  const now = options.now ?? new Date();
  const attempts = (previous?.attempts ?? 0) + 1;

  if (!isEInvoiceApplicable(invoice)) {
    return { status: 'NOT_APPLICABLE', attempts: previous?.attempts ?? 0 };
  }

  if (options.forceFailure) {
    return {
      status: 'FAILED',
      attempts,
      failureReason: 'IRP gateway timeout — queued for retry (simulated).',
    };
  }

  const irn = generateIrn(
    supplierGstin,
    invoice.invoiceType === 'CREDIT_NOTE' ? 'CRN' : 'INV',
    invoice.invoiceNumber,
    financialYearOf(invoice.date)
  );

  return {
    status: 'GENERATED',
    attempts,
    irn,
    ackNo: String(112000000000000 + (parseInt(irn.slice(0, 8), 16) % 8999999999)),
    ackDate: now.toISOString(),
    signedQrPayload: buildQrPayload(invoice, supplierGstin, irn),
  };
}

export function cancelEInvoice(
  record: EInvoiceRecord,
  reason: string,
  now: Date = new Date()
): { record: EInvoiceRecord; error: string | null } {
  if (!canCancelEInvoice(record, now)) {
    return {
      record,
      error: `The ${CANCELLATION_WINDOW_HOURS}-hour cancellation window has closed. Raise a credit note instead.`,
    };
  }
  if (reason.trim().length < 5) {
    return { record, error: 'Record why this e-Invoice is being cancelled (at least 5 characters).' };
  }
  return {
    record: { ...record, status: 'CANCELLED', cancelledOn: now.toISOString(), cancelReason: reason.trim() },
    error: null,
  };
}

/* ─────────────────────────── e-Way Bill (PRD §9.5) ─────────────────────────── */

/**
 * PRD §9.5: an e-Way Bill covers *movement of goods*. Over-the-counter retail where the buyer
 * carries the piece away themselves is generally exempt — so this is driven by inter-branch
 * transfers and deliveries, not by every counter sale. Milestone 20 already flags a transfer
 * that crosses the threshold; this generates the document for it.
 */
export function nextEWayBillNumber(existing: string[] = []): string {
  // Real EBNs are 12 digits. Allocated from the highest existing rather than a count, so a
  // deleted record cannot cause a collision.
  const highest = existing
    .map(n => Number(String(n).replace(/\D/g, '')))
    .filter(n => Number.isFinite(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 341000000000);
  return String(highest + 1);
}

/**
 * Validity under the e-Way Bill rules: one day per 200 km (or part thereof) for regular
 * cargo, minimum one day.
 */
export function eWayBillValidityDays(distanceKm: number): number {
  const km = Math.max(0, Number(distanceKm) || 0);
  return Math.max(1, Math.ceil(km / 200));
}

export function eWayBillExpiry(generatedOn: string, distanceKm: number): string {
  const d = new Date(`${generatedOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + eWayBillValidityDays(distanceKm));
  return d.toISOString().slice(0, 10);
}

export function validateEWayBillDraft(draft: {
  transporterName?: string;
  vehicleNumber?: string;
  distanceKm?: number;
}): string | null {
  if (!draft.transporterName?.trim()) return 'Transporter name is required.';
  if (!draft.vehicleNumber?.trim()) return 'Vehicle number is required.';
  // Indian format: 2 letters, 1-2 digits, 1-3 letters, 4 digits (e.g. MH12AB1234).
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i.test(draft.vehicleNumber.replace(/[\s-]/g, ''))) {
    return 'Enter a valid vehicle number, e.g. MH12AB1234.';
  }
  const km = Number(draft.distanceKm);
  if (!Number.isFinite(km) || km <= 0) return 'Enter the approximate distance in km.';
  if (km > 4000) return 'Distance looks implausible for a domestic movement.';
  return null;
}
