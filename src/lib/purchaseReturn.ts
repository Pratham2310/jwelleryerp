/**
 * Purchase Return / Debit Note (PRD §6.1, Milestone 41) — the mirror of the sales credit note.
 *
 * Goods go back to the supplier, the purchase is reversed, and — the part that matters for a
 * return — **the input tax credit already claimed on them must be reversed too**. Returning
 * stock while keeping its ITC would leave the shop claiming credit on goods it no longer owns,
 * which is precisely the sort of thing a GST audit looks for.
 *
 * ─── Reusing the sales-return arithmetic rather than re-deriving it ────────────────────
 * `salesReturn.ts` already solved proportional reversal across *successive partial* returns, and
 * solved it the hard way: rounding each note's share independently leaked a rupee, so the share
 * is derived cumulatively — what is due on everything returned so far, less what earlier notes
 * already reversed. The shares then telescope and a fully-returned document reverses exactly what
 * it booked.
 *
 * The same trap exists here with ITC, and the same fix applies. Returning a purchase in three
 * debit notes must reverse exactly the credit claimed, never a rupee less — a residue would sit
 * on the books as credit against goods that are gone.
 */

import type { PurchaseInvoice, PurchaseReturn, Supplier } from '../types';
import { financialYearOf } from './eInvoice';
import { splitGst } from './taxMaster';
import { sumMoney, multiplyMoney, roundMoney } from './money';

/** Negation that never yields `-0`, which would render as "-₹0". */
const negate = (n: number) => (n === 0 ? 0 : -n);

export function nextDebitNoteNumber(existing: PurchaseReturn[], onIsoDate: string): string {
  const prefix = `DBN-${financialYearOf(onIsoDate)}-`;
  const highest = existing
    .map(r => r.debitNoteNo)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

export interface PurchaseReturnTotals {
  /** All figures are negative — a debit note can be summed alongside purchases to net them. */
  returnedTaxableValue: number;
  reversedCgst: number;
  reversedSgst: number;
  reversedIgst: number;
  reversedTotalTax: number;
  debitNoteTotal: number;
}

/**
 * Computes a debit note against a booked purchase invoice.
 *
 * `priorReturnedValue` is the taxable value already reversed by earlier debit notes against the
 * same invoice. Supplying it is what makes successive partial returns add up exactly — see the
 * module header.
 */
export function calculatePurchaseReturn(
  invoice: PurchaseInvoice,
  returnedTaxableValue: number,
  priorReturnedValue = 0
): PurchaseReturnTotals {
  const base = roundMoney(invoice.taxableValue);
  const thisReturn = roundMoney(returnedTaxableValue);
  const prior = roundMoney(priorReturnedValue);

  // Cumulative, then subtract what earlier notes already reversed, so the shares telescope.
  const taxDueOn = (value: number) =>
    base > 0 ? roundMoney(multiplyMoney(invoice.totalTax, value / base)) : 0;

  const cumulativeTax = taxDueOn(sumMoney([prior, thisReturn]));
  const priorTax = taxDueOn(prior);
  const reversedTax = roundMoney(cumulativeTax - priorTax);

  // Reverse into the same heads the credit was claimed under. An IGST claim cannot be reversed
  // as CGST+SGST — they are different ledgers to the department.
  const supplyType = invoice.igst > 0 ? 'INTER_STATE' : 'INTRA_STATE';
  const split = splitGst(reversedTax, supplyType);

  return {
    returnedTaxableValue: negate(thisReturn),
    reversedCgst: negate(split.cgst),
    reversedSgst: negate(split.sgst),
    reversedIgst: negate(split.igst),
    reversedTotalTax: negate(reversedTax),
    /**
     * On a reverse-charge purchase the supplier was never paid the tax, so reversing it does not
     * change what they owe back — the debit note is for the goods only. The tax reversal still
     * happens on both the liability and the credit side, it simply nets to zero in cash again.
     */
    debitNoteTotal: negate(
      invoice.isReverseCharge ? thisReturn : sumMoney([thisReturn, reversedTax])
    ),
  };
}

export interface PurchaseReturnDraft {
  purchaseInvoiceId?: string;
  returnDate?: string;
  returnedTaxableValue?: number;
  reason?: string;
  returnedTagIds?: string[];
}

export function validatePurchaseReturn(
  draft: PurchaseReturnDraft,
  invoice: PurchaseInvoice | null,
  priorReturnedValue = 0
): string | null {
  if (!invoice) return 'Select the purchase invoice being returned against.';
  if (!draft.returnDate) return 'Set the return date.';
  if ((draft.reason ?? '').trim().length < 5) {
    // A debit note reverses tax already claimed; an unexplained one is indefensible in an audit.
    return 'Record why the goods are going back (at least 5 characters).';
  }

  const value = Number(draft.returnedTaxableValue);
  if (!Number.isFinite(value) || value <= 0) return 'Enter the taxable value being returned.';

  const remaining = roundMoney(invoice.taxableValue - priorReturnedValue);
  if (remaining <= 0) {
    return `${invoice.internalRef} has already been returned in full.`;
  }
  if (value > remaining) {
    return `Only ₹${remaining.toLocaleString('en-IN')} of ${invoice.internalRef} remains unreturned — returning more would reverse credit that was never claimed.`;
  }
  return null;
}

/** Taxable value already reversed against an invoice by earlier debit notes. */
export function priorReturnedValueFor(
  invoiceId: string,
  returns: PurchaseReturn[]
): number {
  return sumMoney(
    returns
      .filter(r => r.purchaseInvoiceId === invoiceId)
      .map(r => Math.abs(r.returnedTaxableValue))
  );
}

export interface PurchaseReturnSummary {
  count: number;
  returnedValue: number;
  reversedItc: number;
  /** Credit still standing after reversals — what the shop may actually claim. */
  netClaimableItc: number;
  fullyReturnedInvoices: number;
}

export function summarisePurchaseReturns(
  returns: PurchaseReturn[],
  invoices: PurchaseInvoice[]
): PurchaseReturnSummary {
  const reversedItc = sumMoney(returns.map(r => Math.abs(r.reversedTotalTax)));
  const claimed = sumMoney(invoices.filter(i => i.itcEligible).map(i => i.totalTax));

  const fullyReturned = invoices.filter(i => {
    const prior = priorReturnedValueFor(i.id, returns);
    return prior > 0 && prior >= i.taxableValue;
  }).length;

  return {
    count: returns.length,
    returnedValue: sumMoney(returns.map(r => Math.abs(r.returnedTaxableValue))),
    reversedItc,
    netClaimableItc: roundMoney(claimed - reversedItc),
    fullyReturnedInvoices: fullyReturned,
  };
}

/** Invoices with value still unreturned — the only ones a debit note can be raised against. */
export function returnableInvoices(
  invoices: PurchaseInvoice[],
  returns: PurchaseReturn[],
  supplierId?: string
): PurchaseInvoice[] {
  return invoices.filter(i => {
    if (supplierId && i.supplierId !== supplierId) return false;
    return priorReturnedValueFor(i.id, returns) < i.taxableValue;
  });
}

export function supplierOf(invoice: PurchaseInvoice, suppliers: Supplier[]): Supplier | null {
  return suppliers.find(s => s.id === invoice.supplierId) ?? null;
}
