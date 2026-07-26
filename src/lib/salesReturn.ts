// Sales Return / Credit Note calculation (PRD §7.x, CGST Act §34; Milestone 12).
// A credit note reverses part or all of a prior tax invoice. Every figure it carries is
// negative, so a credit note can simply be summed alongside invoices to yield net revenue.

const GST_RATE = 0.03; // must match billingCalculations.ts's composite jewellery rate

// Negation that never yields -0. JavaScript's `-0` is truthy-equal to 0 but formats as "-0",
// which would render a zero-value credit line as "-₹0" in the UI.
const negate = (n: number) => (n === 0 ? 0 : -n);

export interface ReturnableLine {
  subtotal: number;
}

export interface CreditNoteTotals {
  returnedSubtotal: number; // negative
  discountReversed: number; // negative — proportional share of the original bill-level discount
  returnedTaxableValue: number; // negative
  returnedTax: number; // negative
  returnedTotal: number; // negative
}

/**
 * Computes the reversal for a partial or full return.
 *
 * A bill-level discount on the original invoice must be reversed *proportionally* — if a
 * customer got ₹1,500 off a ₹1,00,000 bill and returns half of it, only ₹750 of that discount
 * is clawed back. Reversing the full discount on a partial return would refund more than was
 * ever collected; reversing none of it would refund less.
 *
 * GST is then computed on the post-discount returned value, mirroring the forward direction
 * (PRD §7.4 / Milestone 7) so a full return nets exactly to zero against the original.
 */
export function calculateReturnTotals(
  lines: ReturnableLine[],
  selectedIndexes: number[],
  originalSubtotal: number,
  originalDiscount: number
): CreditNoteTotals {
  const selected = selectedIndexes
    .filter(i => i >= 0 && i < lines.length)
    .map(i => Number(lines[i].subtotal) || 0);

  const returnedGross = selected.reduce((sum, s) => sum + s, 0);

  const base = Number(originalSubtotal) || 0;
  const discount = Number(originalDiscount) || 0;
  const proportion = base > 0 ? returnedGross / base : 0;
  const discountShare = Math.round(discount * proportion);

  const taxableValue = Math.max(0, returnedGross - discountShare);
  const tax = Math.round(taxableValue * GST_RATE);
  const total = taxableValue + tax;

  return {
    returnedSubtotal: negate(returnedGross),
    discountReversed: negate(discountShare),
    returnedTaxableValue: negate(taxableValue),
    returnedTax: negate(tax),
    returnedTotal: negate(total),
  };
}

/**
 * A line already covered by an earlier credit note cannot be returned again. Callers pass the
 * set of line indexes previously returned against this invoice.
 */
export function selectableReturnLines(lineCount: number, alreadyReturned: number[]): number[] {
  const done = new Set(alreadyReturned);
  return Array.from({ length: lineCount }, (_, i) => i).filter(i => !done.has(i));
}

export function validateReturnSelection(selectedIndexes: number[], alreadyReturned: number[]): string | null {
  if (selectedIndexes.length === 0) {
    return 'Select at least one line item to return.';
  }
  const done = new Set(alreadyReturned);
  const duplicate = selectedIndexes.find(i => done.has(i));
  if (duplicate !== undefined) {
    return 'One or more selected items have already been returned against this invoice.';
  }
  return null;
}
