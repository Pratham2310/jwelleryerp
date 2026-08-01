/**
 * Purchase Invoice & Input Tax Credit (PRD §6.1/§9.6/§9.7, Milestone 40).
 *
 * Output tax has existed since Milestone 21; input tax has not. A GSTR-3B built without the
 * purchase side is structurally half a return — the shop would declare everything it collected
 * and nothing it paid. This books the supplier's tax invoice and the credit it carries.
 *
 * ─── Reverse Charge is the part that is easy to book wrongly ───────────────────────────
 * On a normal purchase the supplier charges GST, the shop pays it to them, and the shop later
 * claims it back. Under Reverse Charge (PRD §9.7) — notified supplies from an **unregistered**
 * supplier — the supplier charges nothing and the shop pays that GST directly to the government
 * itself, then claims it as credit.
 *
 * So an RCM invoice creates **two** postings, not one: an output liability the shop owes, and an
 * input credit it can claim. They usually net to zero in cash, which is exactly why booking only
 * the credit is such an inviting mistake — the books would look right and the shop would be
 * under-declaring tax it legally owes. `reverseChargeLegs()` returns both, and the register
 * reports the liability separately from ordinary claimable credit.
 *
 * The other trap is duplicate booking. A supplier's invoice number is *theirs*, not ours, and
 * booking the same one twice claims the same credit twice. `validatePurchaseInvoice()` treats a
 * repeat of (supplier, their invoice number) as an error rather than a new document.
 */

import type { PurchaseInvoice, Supplier, Branch } from '../types';
import { financialYearOf } from './eInvoice';
import { splitGst, type SupplyType, type GstSplit } from './taxMaster';
import { sumMoney, percentOf, roundMoney } from './money';

/** Our own internal reference. The *supplier's* number is recorded separately and is theirs. */
export function nextPurchaseInvoiceRef(existing: PurchaseInvoice[], onIsoDate: string): string {
  const prefix = `PINV-${financialYearOf(onIsoDate)}-`;
  const highest = existing
    .map(p => p.internalRef)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

/**
 * Supply type for a PURCHASE: compares the supplier's state to the receiving branch's.
 *
 * Note the direction. Milestone 21 compares the *customer's* state to the branch's for a sale;
 * here the counterparty is the supplier. Getting this backwards would file every inter-state
 * purchase as CGST+SGST, and that credit cannot be set off the way IGST can.
 */
export function purchaseSupplyType(supplier: Supplier | null, branch: Branch | null): SupplyType {
  const supplierState = supplier?.stateCode?.trim();
  const branchState = branch?.stateCode?.trim();
  // An unregistered supplier with no state on file is treated as local, matching PRD §7.3's
  // treatment of a counterparty whose state is unknown.
  if (!supplierState || !branchState) return 'INTRA_STATE';
  return supplierState === branchState ? 'INTRA_STATE' : 'INTER_STATE';
}

export interface PurchaseTax extends GstSplit {
  taxableValue: number;
  gstRatePercent: number;
  /** Alias of `GstSplit.total`, named for what it is on a purchase document. */
  totalTax: number;
  invoiceTotal: number;
  supplyType: SupplyType;
}

export function computePurchaseTax(
  taxableValue: number,
  gstRatePercent: number,
  supplyType: SupplyType,
  isReverseCharge = false
): PurchaseTax {
  const taxable = roundMoney(taxableValue);
  const exactTax = percentOf(taxable, gstRatePercent);
  const totalTax = roundMoney(exactTax);
  const split = splitGst(totalTax, supplyType);

  return {
    ...split,
    taxableValue: taxable,
    gstRatePercent,
    totalTax,
    /**
     * On a reverse-charge invoice the supplier bills only the goods — the tax is paid by the
     * shop straight to the government, so it is not part of what the supplier is owed.
     */
    invoiceTotal: isReverseCharge ? taxable : sumMoney([taxable, totalTax]),
    supplyType,
  };
}

export interface ReverseChargeLegs {
  /** Tax the shop must itself declare and pay, as though it were the supplier. */
  outputLiability: number;
  /** The same amount, claimable back as input credit. */
  inputCredit: number;
  netCashEffect: number;
}

/**
 * Both sides of a reverse-charge supply.
 *
 * They net to zero in cash, and that is precisely the trap: recording only the credit leaves the
 * books looking balanced while the shop under-declares tax it legally owes.
 */
export function reverseChargeLegs(totalTax: number): ReverseChargeLegs {
  const tax = roundMoney(totalTax);
  return { outputLiability: tax, inputCredit: tax, netCashEffect: 0 };
}

export interface ItcAssessment {
  eligible: boolean;
  reason: string | null;
}

/**
 * Whether the credit on this invoice can actually be claimed.
 *
 * A registered supplier's tax invoice carries claimable credit. An unregistered supplier charges
 * no tax at all, so there is nothing to claim UNLESS reverse charge applies — in which case the
 * shop paid the tax itself and may claim exactly that.
 */
export function assessItcEligibility(
  supplier: Supplier | null,
  isReverseCharge: boolean
): ItcAssessment {
  if (isReverseCharge) {
    return { eligible: true, reason: null };
  }
  if (!supplier?.gstin?.trim()) {
    return {
      eligible: false,
      reason: 'Supplier is unregistered, so no tax was charged and there is no credit to claim. If this is a notified supply, book it under reverse charge instead.',
    };
  }
  return { eligible: true, reason: null };
}

export interface PurchaseInvoiceDraft {
  supplierId?: string;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: string;
  goodsReceiptId?: string;
  taxableValue?: number;
  gstRatePercent?: number;
  isReverseCharge?: boolean;
  branchId?: string;
}

export function validatePurchaseInvoice(
  draft: PurchaseInvoiceDraft,
  existing: PurchaseInvoice[],
  supplier: Supplier | null
): string | null {
  if (!draft.supplierId) return 'Select the supplier who issued the invoice.';
  if (!draft.supplierInvoiceNo?.trim()) return "Enter the supplier's invoice number.";
  if (!draft.supplierInvoiceDate) return "Enter the supplier's invoice date.";
  if (!draft.branchId) return 'Select the branch this purchase belongs to.';

  const taxable = Number(draft.taxableValue);
  if (!Number.isFinite(taxable) || taxable <= 0) return 'Enter the taxable value of the purchase.';

  const rate = Number(draft.gstRatePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 28) {
    return 'Enter a valid GST rate (0–28%).';
  }

  /**
   * Booking the same supplier invoice twice claims the same input credit twice. The number
   * belongs to the supplier, so uniqueness is only meaningful per supplier.
   */
  const key = draft.supplierInvoiceNo.trim().toUpperCase();
  const duplicate = existing.find(
    p => p.supplierId === draft.supplierId && p.supplierInvoiceNo.trim().toUpperCase() === key
  );
  if (duplicate) {
    return `Invoice ${draft.supplierInvoiceNo.trim()} from this supplier is already booked as ${duplicate.internalRef}. Booking it again would claim the same credit twice.`;
  }

  // Reverse charge exists for supplies from UNREGISTERED suppliers. Flagging it on a registered
  // dealer's invoice would double-count: they already charged the tax.
  if (draft.isReverseCharge && supplier?.gstin?.trim()) {
    return `${supplier.name} is GST-registered and charges tax on their invoice. Reverse charge applies to notified supplies from unregistered suppliers.`;
  }
  return null;
}

/* ─────────────────────────────── Purchase register ─────────────────────────────── */

export interface PurchaseRegisterSummary {
  invoiceCount: number;
  totalTaxableValue: number;
  /** Ordinary credit from registered suppliers' invoices. */
  claimableItc: number;
  itcCgst: number;
  itcSgst: number;
  itcIgst: number;
  /** Tax the shop owes on reverse-charge supplies — a LIABILITY, not a credit. */
  reverseChargeLiability: number;
  reverseChargeInvoices: number;
  ineligibleItc: number;
}

export function summarisePurchaseRegister(invoices: PurchaseInvoice[]): PurchaseRegisterSummary {
  const eligible = invoices.filter(p => p.itcEligible);
  const rcm = invoices.filter(p => p.isReverseCharge);

  return {
    invoiceCount: invoices.length,
    totalTaxableValue: sumMoney(invoices.map(p => p.taxableValue)),
    claimableItc: sumMoney(eligible.map(p => p.totalTax)),
    itcCgst: sumMoney(eligible.map(p => p.cgst)),
    itcSgst: sumMoney(eligible.map(p => p.sgst)),
    itcIgst: sumMoney(eligible.map(p => p.igst)),
    reverseChargeLiability: sumMoney(rcm.map(p => p.totalTax)),
    reverseChargeInvoices: rcm.length,
    ineligibleItc: sumMoney(invoices.filter(p => !p.itcEligible).map(p => p.totalTax)),
  };
}

/** Goods receipts not yet billed by the supplier — an unbilled receipt is an unbooked liability. */
export function unbilledReceiptIds(
  receiptIds: string[],
  invoices: PurchaseInvoice[]
): string[] {
  const billed = new Set(invoices.map(p => p.goodsReceiptId).filter(Boolean));
  return receiptIds.filter(id => !billed.has(id));
}
