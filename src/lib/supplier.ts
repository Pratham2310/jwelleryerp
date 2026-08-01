/**
 * Party Master — Supplier, and the KYC fields Customer was missing (PRD §4.4, Milestone 37).
 *
 * PRD §4.4 frames customers and suppliers as one "Party" ledger, as in Tally, "because the same
 * person may sometimes buy (debtor) and sometimes sell old gold to the shop (creditor)". They
 * stay as separate records here — a supplier carries credit terms a retail buyer does not — but
 * they share one KYC shape and one set of validators, so a GSTIN is checked identically wherever
 * it is captured.
 *
 * Per decision **D-5** the Party Master is tenant-wide and must NEVER carry a `branchId`. A
 * supplier who delivers to two branches is one creditor, and scoping them per branch would split
 * that balance into two half-truths.
 *
 * ─── Why the GSTIN cross-checks matter ────────────────────────────────────────────────
 * A GSTIN is not an opaque string. It is structured:
 *
 *     2 7 A A C C S 9 9 4 8 H 1 Z 1
 *     └┬┘ └──────┬──────┘ ┬ ┬ ┬
 *      │         │        │ │ └─ checksum
 *      │         │        │ └─── always 'Z'
 *      │         │        └───── registration count for that PAN in that state
 *      │         └────────────── the holder's PAN (chars 3–12)
 *      └──────────────────────── state code (chars 1–2)
 *
 * So a GSTIN silently contains both the state and the PAN. If the typed state disagrees with the
 * GSTIN, Milestone 21 picks the wrong tax split — IGST instead of CGST+SGST or vice versa — on
 * every document for that party, and the error is invisible until a return is filed. Likewise a
 * PAN that disagrees with the one embedded in the GSTIN means one of the two was mistyped.
 * Checking them against each other costs nothing and catches the mistake at data entry.
 */

import type { Supplier, Customer } from '../types';
import { isValidPanFormat } from './statutoryChecks';

/** 15 characters: 2 digits state, 10-char PAN, 1 alphanumeric entity code, 'Z', 1 checksum. */
export const GSTIN_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export function normaliseGstin(gstin: string): string {
  return (gstin || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_PATTERN.test(normaliseGstin(gstin));
}

/** The state code a GSTIN declares (its first two characters). */
export function stateCodeFromGstin(gstin: string): string | null {
  const value = normaliseGstin(gstin);
  return isValidGstinFormat(value) ? value.slice(0, 2) : null;
}

/** The PAN embedded in a GSTIN (characters 3–12). */
export function panFromGstin(gstin: string): string | null {
  const value = normaliseGstin(gstin);
  return isValidGstinFormat(value) ? value.slice(2, 12) : null;
}

export interface PartyIdentityInput {
  gstin?: string;
  pan?: string;
  stateCode?: string;
}

/**
 * Cross-validates the three identity fields against each other. Returns the first genuine
 * contradiction, or null. Absent fields are not errors here — whether a GSTIN is *required*
 * depends on the party type, which the caller decides.
 */
export function validatePartyIdentity(input: PartyIdentityInput): string | null {
  const gstin = normaliseGstin(input.gstin || '');
  const pan = (input.pan || '').trim().toUpperCase();
  const stateCode = (input.stateCode || '').trim();

  if (gstin && !isValidGstinFormat(gstin)) {
    return 'A GSTIN is 15 characters, e.g. 27AACCS9948H1Z1.';
  }
  if (pan && !isValidPanFormat(pan)) {
    return 'A PAN is 10 characters, e.g. AACCS9948H.';
  }

  if (gstin) {
    const embeddedState = stateCodeFromGstin(gstin)!;
    if (stateCode && stateCode !== embeddedState) {
      return `GSTIN ${gstin} is registered in state ${embeddedState}, but the state code says ${stateCode}. One of them is wrong — the tax split depends on it.`;
    }
    const embeddedPan = panFromGstin(gstin)!;
    if (pan && pan !== embeddedPan) {
      return `GSTIN ${gstin} contains PAN ${embeddedPan}, which does not match the PAN entered (${pan}).`;
    }
  }
  return null;
}

/**
 * Fills state code and PAN from the GSTIN when they were left blank — they are already in it.
 *
 * The return type widens to include the derived fields: the caller may pass an object that only
 * has `gstin`, and gets one that also carries `stateCode` and `pan`.
 */
export function deriveIdentityFromGstin<T extends PartyIdentityInput>(input: T): T & PartyIdentityInput {
  const gstin = normaliseGstin(input.gstin || '');
  if (!isValidGstinFormat(gstin)) return input;
  return {
    ...input,
    gstin,
    stateCode: input.stateCode || stateCodeFromGstin(gstin) || undefined,
    pan: input.pan || panFromGstin(gstin) || undefined,
  };
}

/* ─────────────────────────────── Supplier ─────────────────────────────── */

export const SUPPLIER_TYPE_LABEL: Record<Supplier['supplierType'], string> = {
  BULLION_DEALER: 'Bullion Dealer',
  WHOLESALER: 'Finished Goods Wholesaler',
  SERVICE: 'Service Provider',
};

export function nextSupplierCode(existing: Supplier[]): string {
  const highest = existing
    .map(s => s.supplierCode)
    .filter(c => /^SUP-\d+$/.test(c || ''))
    .map(c => Number(c.slice(4)))
    .reduce((max, n) => Math.max(max, n), 0);
  return `SUP-${String(highest + 1).padStart(4, '0')}`;
}

export function validateSupplier(
  draft: Partial<Supplier>,
  existing: Supplier[] = []
): string | null {
  if (!draft.name?.trim()) return 'Enter the supplier name.';
  if (!draft.phone?.trim()) return 'A mobile number is required — it is how the shop reaches them.';
  if (!/^[0-9]{10}$/.test(draft.phone.trim().replace(/\D/g, '').slice(-10))) {
    return 'Enter a valid 10-digit mobile number.';
  }

  const identityError = validatePartyIdentity(draft);
  if (identityError) return identityError;

  /**
   * A bullion dealer must be registered: PRD §6.1 says the shop claims ITC on bullion, and ITC
   * can only be claimed against a registered supplier's tax invoice. Recording one without a
   * GSTIN would let a purchase be booked whose input credit can never actually be claimed.
   */
  if (draft.supplierType === 'BULLION_DEALER' && !draft.gstin?.trim()) {
    return 'A bullion dealer must have a GSTIN — input tax credit cannot be claimed without one.';
  }

  const terms = Number(draft.creditTermsDays);
  if (!Number.isFinite(terms) || terms < 0 || terms > 365) {
    return 'Credit terms must be between 0 and 365 days.';
  }

  const gstin = normaliseGstin(draft.gstin || '');
  if (gstin) {
    const clash = existing.find(s => s.id !== draft.id && normaliseGstin(s.gstin || '') === gstin);
    if (clash) return `GSTIN ${gstin} is already recorded against ${clash.name}.`;
  }
  return null;
}

/**
 * Opening balance sign convention, stated once so no screen has to guess.
 *
 * Positive means the shop OWES the supplier (a creditor balance), which is the normal direction
 * for a purchase relationship. Negative means the supplier owes the shop — an advance paid, or
 * an unconsumed debit note. This is the mirror of the customer convention, where positive means
 * the customer owes the shop.
 */
export function supplierBalanceLabel(balance: number): string {
  if (balance > 0) return 'Payable to supplier';
  if (balance < 0) return 'Advance with supplier';
  return 'Settled';
}

export interface SupplierSummary {
  total: number;
  active: number;
  registered: number;
  unregistered: number;
  totalPayable: number;
  totalAdvances: number;
}

export function summariseSuppliers(suppliers: Supplier[]): SupplierSummary {
  const active = suppliers.filter(s => s.isActive);
  return {
    total: suppliers.length,
    active: active.length,
    registered: active.filter(s => !!s.gstin?.trim()).length,
    /**
     * Unregistered suppliers matter beyond a headcount: a notified purchase from one can attract
     * Reverse Charge, where the shop pays the GST itself rather than the supplier collecting it
     * (PRD §9.7). Milestone 40 books that; this is where the exposure first becomes visible.
     */
    unregistered: active.filter(s => !s.gstin?.trim()).length,
    totalPayable: active.reduce((sum, s) => sum + Math.max(0, s.openingBalance || 0), 0),
    totalAdvances: active.reduce((sum, s) => sum + Math.max(0, -(s.openingBalance || 0)), 0),
  };
}

/** Suppliers selectable on a purchase document. */
export function selectableSuppliers(suppliers: Supplier[]): Supplier[] {
  return suppliers.filter(s => s.isActive);
}

/* ─────────────────────────────── Customer KYC ─────────────────────────────── */

/**
 * PRD §4.4 requires PAN, Aadhaar and KYC on the Party Master; `Customer` carried none of them.
 * PAN in particular is not cosmetic — Rule 114B makes it mandatory at ₹2,00,000, and Milestone 8
 * already blocks checkout without a declaration. Holding it on the customer means a returning
 * buyer does not have to produce it again at every high-value sale.
 */
export function validateCustomerKyc(draft: Partial<Customer>): string | null {
  const identityError = validatePartyIdentity(draft);
  if (identityError) return identityError;

  const aadhaar = (draft.aadhaar || '').replace(/\s+/g, '');
  if (aadhaar && !/^[0-9]{12}$/.test(aadhaar)) {
    return 'An Aadhaar number is 12 digits.';
  }

  const limit = Number(draft.creditLimit ?? 0);
  if (!Number.isFinite(limit) || limit < 0) return 'Credit limit cannot be negative.';
  return null;
}

/** Masks all but the last four digits — an Aadhaar should never be displayed in full (UIDAI). */
export function maskAadhaar(aadhaar?: string): string {
  const digits = (aadhaar || '').replace(/\D/g, '');
  if (digits.length !== 12) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
}
