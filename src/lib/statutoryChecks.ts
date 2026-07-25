// Statutory compliance checks (PRD §4.4/§15.3, Income Tax Rule 114B).
// Thresholds live here as named constants; Milestone 34 makes them data-driven.

export const PAN_THRESHOLD = 200000; // Rs 2,00,000 — PAN/Form 60 mandatory at or above this

// Structural PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
// The 4th character encodes holder type; 'P' = individual, but jewellery customers
// can legitimately be companies/HUFs/firms too, so holder type is not restricted here.
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function isPanRequired(invoiceTotal: number): boolean {
  return (Number(invoiceTotal) || 0) >= PAN_THRESHOLD;
}

export function isValidPanFormat(pan: string): boolean {
  return PAN_REGEX.test((pan || '').trim().toUpperCase());
}

export type PanDeclarationType = 'PAN' | 'FORM_60';

export interface PanDeclaration {
  type: PanDeclarationType;
  panNumber?: string; // required when type === 'PAN'
}

/**
 * Returns an error message if this transaction cannot legally proceed, or null if it can.
 * Format validation only — there is no real government verification in this prototype.
 */
export function validatePanDeclaration(invoiceTotal: number, declaration: PanDeclaration | null): string | null {
  if (!isPanRequired(invoiceTotal)) return null;
  if (!declaration) {
    return `PAN or Form 60 is mandatory for transactions of ₹${PAN_THRESHOLD.toLocaleString('en-IN')} or more (Income Tax Rule 114B).`;
  }
  if (declaration.type === 'FORM_60') return null;
  if (!declaration.panNumber || !isValidPanFormat(declaration.panNumber)) {
    return 'Enter a valid PAN in the format ABCDE1234F, or record a Form 60 declaration instead.';
  }
  return null;
}
