/**
 * Pure billing/GST calculation engine, implementing PRD §7.2 (per-line item
 * calculation) and §17 (worked example) literally. No React, no localStorage —
 * safe to unit test directly.
 *
 * The GST *rate* is no longer hardcoded here — it comes from the Tax Master
 * (`src/lib/taxMaster.ts`, Milestone 21), which is data with effective-date
 * versioning, per PRD §9.2's requirement that rates never be immutable constants.
 *
 * Still deliberately NOT modeled (out of scope, see .ai/HANDOFF.md item 1):
 * applying a *different* HSN rate to the diamond portion of a composite ornament.
 * The engine supports per-HSN rates, but a diamond-set piece is billed as one
 * composite supply at the jewellery rate until a CA confirms otherwise, matching
 * the PRD §17 worked example.
 */

import { splitGst, computeRoundOff, type SupplyType, type GstSplit } from './taxMaster';

export type MakingChargeType = 'per-gram' | 'flat';

export interface LineItemInput {
  netWeight: number;
  metalRate: number;
  wastagePercent: number;
  makingChargeType: MakingChargeType;
  makingChargeValue: number;
  stoneCharge: number;
}

export interface LineItemResult {
  metalValue: number;
  wastageValue: number;
  makingCharge: number;
  stoneValue: number;
  subtotal: number;
}

/** PRD §7.2 Steps 2-6 for a single jewellery line item. */
export function calculateLineItem(input: LineItemInput): LineItemResult {
  const netWeight = Number(input.netWeight) || 0;
  const metalRate = Number(input.metalRate) || 0;
  const wastagePercent = Number(input.wastagePercent) || 0;
  const makingChargeValue = Number(input.makingChargeValue) || 0;
  const stoneCharge = Number(input.stoneCharge) || 0;

  const metalValue = netWeight * metalRate;

  const wastageWeight = netWeight * (wastagePercent / 100);
  const wastageValue = wastageWeight * metalRate;

  const makingCharge =
    input.makingChargeType === 'flat' ? makingChargeValue : netWeight * makingChargeValue;

  const stoneValue = stoneCharge;

  const subtotal = metalValue + wastageValue + makingCharge + stoneValue;

  return {
    metalValue: Math.round(metalValue),
    wastageValue: Math.round(wastageValue),
    makingCharge: Math.round(makingCharge),
    stoneValue: Math.round(stoneValue),
    subtotal: Math.round(metalValue) + Math.round(wastageValue) + Math.round(makingCharge) + Math.round(stoneValue)
  };
}

export interface InvoiceTotals {
  subtotal: number; // pre-discount sum of line items
  taxableValue: number; // subtotal - discount — the actual GST base (PRD §7.4)
  gstTax: number; // combined GST, rounded to the rupee
  grandTotal: number;
  /** Statutory split; cgst + sgst + igst always equals gstTax exactly. */
  gstSplit: GstSplit;
  supplyType: SupplyType;
  ratePercent: number;
  /** PRD §7.3: Round(Total) - Total, in rupees to 2dp. Posted to its own ledger. */
  roundOff: number;
}

/**
 * Default when no Tax Master row is supplied — the composite jewellery rate from
 * PRD §17. Callers in the app always pass the resolved rate; this keeps the pure
 * function usable (and its older call signature valid) without a rates array.
 */
export const DEFAULT_GST_RATE_PERCENT = 3;

export interface TaxContext {
  ratePercent?: number;
  supplyType?: SupplyType;
}

/**
 * Bill-level aggregation (PRD §7.3, §7.4). A bill-level discount reduces the
 * taxable value BEFORE GST is computed — GST must never be charged on an
 * amount the customer isn't actually being asked to pay for the goods
 * (Milestone 7; previously this app computed GST on the pre-discount
 * subtotal and applied the discount only after, which overstates GST).
 * Old gold trade-in must still NEVER touch this base (PRD §8.3, KNOWN_ISSUES #1)
 * — it is netted separately via settleOldGold(), after grandTotal.
 *
 * `grandTotal` is rounded from the *exact* tax rather than from the rupee-rounded
 * `gstTax`, so the round-off figure reported is the real one. At 3% on a whole-rupee
 * base the exact tax lands on paise (289440 × 3% = 8683.20), which is precisely what
 * PRD §7.3's Round Off line exists to absorb.
 */
export function calculateInvoiceTotals(
  lineSubtotals: number[],
  discount: number,
  tax: TaxContext = {}
): InvoiceTotals {
  const ratePercent = Number.isFinite(tax.ratePercent as number)
    ? (tax.ratePercent as number)
    : DEFAULT_GST_RATE_PERCENT;
  const supplyType: SupplyType = tax.supplyType ?? 'INTRA_STATE';

  const subtotal = lineSubtotals.reduce((sum, s) => sum + s, 0);
  const discountAmount = Number(discount) || 0;
  const taxableValue = Math.max(0, subtotal - discountAmount);

  const exactTax = taxableValue * (ratePercent / 100);
  const gstTax = Math.round(exactTax);
  const { roundedTotal: grandTotal, roundOff } = computeRoundOff(taxableValue + exactTax);

  return {
    subtotal,
    taxableValue,
    gstTax,
    grandTotal,
    gstSplit: splitGst(gstTax, supplyType),
    supplyType,
    ratePercent,
    roundOff,
  };
}

/**
 * Old Gold Exchange settlement (PRD §8.3 / §17 "Final Settlement"). This is
 * a separate purchase transaction netted only against the final amount
 * collected — it must never be passed into calculateInvoiceTotals.
 */
export function settleOldGold(grandTotal: number, oldGoldValue: number): number {
  return Math.max(0, grandTotal - (Number(oldGoldValue) || 0));
}

export type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Scheme Redemption';

export interface PaymentSplitEntry {
  mode: PaymentMode;
  amount: number;
}

export interface PaymentSplitValidation {
  totalPaid: number;
  shortfall: number; // positive if underpaid, negative if overpaid
  isValid: boolean;
  error: string | null;
}

/**
 * Multi-tender split validation (PRD §7.5). One bill may be settled across
 * several payment modes; the sum must exactly equal the amount due before
 * checkout is allowed.
 */
export function validatePaymentSplit(amountDue: number, entries: PaymentSplitEntry[]): PaymentSplitValidation {
  const due = Number(amountDue) || 0;
  const totalPaid = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const shortfall = Math.round((due - totalPaid) * 100) / 100;

  if (entries.some(e => (Number(e.amount) || 0) < 0)) {
    return { totalPaid, shortfall, isValid: false, error: 'A payment amount cannot be negative.' };
  }
  if (shortfall > 0) {
    return { totalPaid, shortfall, isValid: false, error: `Payment is short by ₹${shortfall.toLocaleString('en-IN')}.` };
  }
  if (shortfall < 0) {
    return { totalPaid, shortfall, isValid: false, error: `Payment exceeds the amount due by ₹${Math.abs(shortfall).toLocaleString('en-IN')}.` };
  }
  return { totalPaid, shortfall: 0, isValid: true, error: null };
}
