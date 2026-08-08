/**
 * e-Invoice GSP transport layer (Milestone 60, PRD §9.4).
 *
 * Milestone 22 built the *domain* side — when an e-invoice applies, the IRN, the signed QR, the
 * 24-hour cancellation window. What it did not build is the shape a real GSP integration needs:
 * the payload the IRP actually accepts, and what to do when it says no.
 *
 * This module is still **simulated** — there are no GSP credentials and no server. What it makes
 * correct is the *shape*, so wiring a real GSP later is configuration rather than a rewrite.
 *
 * ─── The IRP deduplicates; so must we ─────────────────────────────────────────────────
 * The IRP keys an invoice on **supplier GSTIN + document type + document number + financial
 * year**. Submitting the same invoice twice does not create a second IRN — it returns error 2150,
 * "Duplicate IRN", along with the IRN that already exists.
 *
 * That means **2150 is not a failure**. Treating it as one is the classic integration bug: a
 * retry after a network timeout gets 2150, the code marks the invoice FAILED, and a shop that
 * actually has a valid registered e-invoice believes it does not. So `classifyResponse` maps it
 * to success and carries the existing IRN through.
 *
 * ─── Retryable is not the same as failed ──────────────────────────────────────────────
 * A gateway timeout should be retried; a missing HSN code never will succeed no matter how many
 * times it is sent. Retrying a validation error forever burns quota and hides the real problem,
 * so errors are classified before the retry loop sees them.
 */

import type { SaleInvoice, Branch, Customer } from '../types';
import { roundMoney } from './money';

/** The IRP schema version this payload targets. */
export const IRP_SCHEMA_VERSION = '1.1';

/* ─────────────────────────────── Payload ─────────────────────────────── */

export interface IrpDocDetails {
  Typ: 'INV' | 'CRN' | 'DBN';
  No: string;
  Dt: string; // dd/mm/yyyy — the IRP does not accept ISO
}

export interface IrpPartyDetails {
  Gstin: string;
  LglNm: string;
  Addr1: string;
  Loc: string;
  Pin: number;
  Stcd: string;
}

export interface IrpItem {
  SlNo: string;
  PrdDesc: string;
  IsServc: 'Y' | 'N';
  HsnCd: string;
  Qty: number;
  Unit: string;
  UnitPrice: number;
  TotAmt: number;
  AssAmt: number;
  GstRt: number;
  CgstAmt: number;
  SgstAmt: number;
  IgstAmt: number;
  TotItemVal: number;
}

export interface IrpPayload {
  Version: string;
  TranDtls: { TaxSch: 'GST'; SupTyp: 'B2B' | 'B2C'; RegRev: 'Y' | 'N' };
  DocDtls: IrpDocDetails;
  SellerDtls: IrpPartyDetails;
  BuyerDtls: IrpPartyDetails;
  ItemList: IrpItem[];
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    RndOffAmt: number;
    TotInvVal: number;
  };
}

/** The IRP wants dd/mm/yyyy, not ISO. A silent format mismatch is a rejected invoice. */
export function toIrpDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

const DOC_TYPE: Record<string, IrpDocDetails['Typ']> = {
  TAX_INVOICE: 'INV',
  CREDIT_NOTE: 'CRN',
};

export function buildIrpPayload(
  invoice: SaleInvoice,
  seller: Branch,
  buyer?: Customer | null
): IrpPayload {
  const isB2B = !!buyer?.gstin;
  const items = invoice.items.map((line, i) => {
    const taxable = roundMoney(line.subtotal || 0);
    const rate = line.gstRatePercent ?? 0;
    const share = invoice.subtotal > 0 ? taxable / invoice.subtotal : 0;
    return {
      SlNo: String(i + 1),
      PrdDesc: line.name,
      IsServc: 'N' as const,
      HsnCd: line.hsnCode || '',
      Qty: line.netWeight || 0,
      Unit: 'GMS',
      UnitPrice: line.netWeight ? roundMoney(taxable / line.netWeight) : taxable,
      TotAmt: taxable,
      AssAmt: taxable,
      GstRt: rate,
      CgstAmt: roundMoney((invoice.cgst ?? 0) * share),
      SgstAmt: roundMoney((invoice.sgst ?? 0) * share),
      IgstAmt: roundMoney((invoice.igst ?? 0) * share),
      TotItemVal: roundMoney(taxable + ((invoice.tax ?? 0) * share)),
    };
  });

  return {
    Version: IRP_SCHEMA_VERSION,
    TranDtls: { TaxSch: 'GST', SupTyp: isB2B ? 'B2B' : 'B2C', RegRev: 'N' },
    DocDtls: {
      Typ: DOC_TYPE[invoice.invoiceType] ?? 'INV',
      No: invoice.invoiceNumber,
      Dt: toIrpDate(invoice.date),
    },
    SellerDtls: {
      Gstin: seller.gstin,
      LglNm: seller.name,
      Addr1: seller.address,
      Loc: seller.name,
      Pin: 400002,
      Stcd: seller.stateCode,
    },
    BuyerDtls: {
      // The IRP requires the literal 'URP' for an unregistered buyer, not an empty string.
      Gstin: buyer?.gstin || 'URP',
      LglNm: invoice.customerName,
      Addr1: '-',
      Loc: '-',
      Pin: 400002,
      Stcd: buyer?.stateCode || seller.stateCode,
    },
    ItemList: items,
    ValDtls: {
      AssVal: roundMoney(invoice.subtotal),
      CgstVal: roundMoney(invoice.cgst ?? 0),
      SgstVal: roundMoney(invoice.sgst ?? 0),
      IgstVal: roundMoney(invoice.igst ?? 0),
      RndOffAmt: roundMoney(invoice.roundOff ?? 0),
      TotInvVal: roundMoney(invoice.grandTotal),
    },
  };
}

/**
 * The checks the IRP itself enforces. Running them locally turns a rejected submission into a
 * message at the counter, which is where it can still be fixed.
 */
export function validateIrpPayload(payload: IrpPayload): string[] {
  const errors: string[] = [];

  if (!payload.SellerDtls.Gstin || payload.SellerDtls.Gstin.length !== 15) {
    errors.push('Seller GSTIN is missing or not 15 characters.');
  }
  if (payload.TranDtls.SupTyp === 'B2B' && payload.BuyerDtls.Gstin === 'URP') {
    errors.push('A B2B supply must carry the buyer GSTIN.');
  }
  if (payload.ItemList.length === 0) errors.push('An e-invoice must have at least one line.');

  payload.ItemList.forEach(item => {
    if (!item.HsnCd) {
      errors.push(`Line ${item.SlNo} (${item.PrdDesc}) has no HSN code.`);
    }
  });

  // The IRP rejects a payload whose item values do not sum to the declared total.
  const lineSum = roundMoney(payload.ItemList.reduce((s, i) => s + i.AssAmt, 0));
  if (lineSum !== payload.ValDtls.AssVal) {
    errors.push(`Line assessable values (${lineSum}) do not sum to the declared ${payload.ValDtls.AssVal}.`);
  }
  return errors;
}

/* ─────────────────────────────── Idempotency ─────────────────────────────── */

/**
 * The key the IRP itself dedupes on. Holding the same key locally means a retry after a timeout
 * asks about the *same* document rather than creating a second one.
 */
export function idempotencyKey(
  sellerGstin: string,
  invoice: Pick<SaleInvoice, 'invoiceType' | 'invoiceNumber' | 'date'>
): string {
  const fyStartYear = Number(invoice.date.slice(0, 4)) - (Number(invoice.date.slice(5, 7)) < 4 ? 1 : 0);
  const fy = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
  return `${sellerGstin}:${DOC_TYPE[invoice.invoiceType] ?? 'INV'}:${invoice.invoiceNumber}:${fy}`;
}

/* ─────────────────────────────── Responses ─────────────────────────────── */

export interface IrpResponse {
  status: 'SUCCESS' | 'ERROR';
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  signedQrCode?: string;
  errors?: { code: string; message: string }[];
}

export type ResponseOutcome = 'REGISTERED' | 'ALREADY_REGISTERED' | 'RETRYABLE' | 'TERMINAL';

/**
 * IRP error codes that mean "try again" rather than "this will never work".
 * Anything not listed is treated as terminal, because retrying a validation failure forever
 * burns quota and hides the real problem.
 */
export const RETRYABLE_CODES = new Set([
  '1005', // invalid/expired token — refresh and retry
  '2283', // IRP busy
  '9999', // unexpected portal error
  'GSP_TIMEOUT',
  'GSP_UNAVAILABLE',
]);

/** "Duplicate IRN". Not a failure — the document is already registered. */
export const DUPLICATE_IRN_CODE = '2150';

export interface Classification {
  outcome: ResponseOutcome;
  irn?: string;
  message: string;
}

export function classifyResponse(response: IrpResponse): Classification {
  if (response.status === 'SUCCESS' && response.irn) {
    return { outcome: 'REGISTERED', irn: response.irn, message: 'Registered with the IRP.' };
  }

  const errors = response.errors ?? [];
  const duplicate = errors.find(e => e.code === DUPLICATE_IRN_CODE);
  if (duplicate) {
    // The single most important case: a retry after a timeout lands here, and marking it FAILED
    // would tell a shop it has no e-invoice when it demonstrably does.
    return {
      outcome: 'ALREADY_REGISTERED',
      irn: response.irn ?? extractIrnFromMessage(duplicate.message),
      message: 'Already registered — the IRP returned the existing IRN.',
    };
  }

  if (errors.some(e => RETRYABLE_CODES.has(e.code))) {
    return {
      outcome: 'RETRYABLE',
      message: errors.map(e => `${e.code}: ${e.message}`).join('; '),
    };
  }

  return {
    outcome: 'TERMINAL',
    message: errors.length
      ? errors.map(e => `${e.code}: ${e.message}`).join('; ')
      : 'The IRP rejected the invoice without a reason code.',
  };
}

/** The IRP returns the existing IRN inside the 2150 message text rather than a field. */
export function extractIrnFromMessage(message: string): string | undefined {
  return /\b([0-9a-f]{64})\b/i.exec(message)?.[1];
}

/* ─────────────────────────────── Retry ─────────────────────────────── */

export const MAX_ATTEMPTS = 5;

/** Exponential backoff, capped. Hammering a busy portal makes it busier. */
export function backoffSeconds(attempt: number): number {
  return Math.min(300, Math.round(Math.pow(2, Math.max(0, attempt)) * 5));
}

export function shouldRetry(outcome: ResponseOutcome, attempts: number): boolean {
  return outcome === 'RETRYABLE' && attempts < MAX_ATTEMPTS;
}

export interface SubmissionAttempt {
  at: string;
  outcome: ResponseOutcome;
  message: string;
  nextRetryInSeconds?: number;
}

export function recordAttempt(
  outcome: ResponseOutcome,
  message: string,
  attempts: number,
  at: string = new Date().toISOString()
): SubmissionAttempt {
  return {
    at,
    outcome,
    message,
    nextRetryInSeconds: shouldRetry(outcome, attempts) ? backoffSeconds(attempts) : undefined,
  };
}

/* ─────────────────────────────── Readiness ─────────────────────────────── */

export interface GspReadiness {
  ready: boolean;
  blockers: string[];
  note: string;
}

/**
 * Whether a real GSP could be wired in today. Stated plainly rather than implied, because the
 * whole point of this milestone is that the shape is correct and the credentials are not.
 */
export function gspReadiness(seller: Branch | null): GspReadiness {
  const blockers: string[] = [];
  if (!seller?.gstin) blockers.push('The active branch has no GSTIN.');
  blockers.push('No GSP credentials are configured — there is no server to hold them.');
  blockers.push('Submissions are simulated locally and never reach the IRP.');

  return {
    ready: false,
    blockers,
    note: 'The payload, error handling, idempotency and retry policy are production-shaped. '
      + 'Wiring a real GSP is configuration plus a server endpoint, not a rewrite.',
  };
}
