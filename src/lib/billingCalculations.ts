/**
 * Pure billing/GST calculation engine, implementing PRD §7.2 (per-line item
 * calculation) and §17 (worked example) literally. No React, no localStorage —
 * safe to unit test directly.
 *
 * Deliberately NOT modeled here (out of scope, see .ai/HANDOFF.md item 1):
 * a per-HSN GST split between metal (7113) and diamonds (7102). GST is a
 * single flat rate applied to the composite taxable value, matching the
 * PRD §17 worked example.
 */

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
  gstTax: number;
  grandTotal: number;
}

const GST_RATE = 0.03; // 3% composite jewellery GST rate (PRD §17)

/**
 * Bill-level aggregation (PRD §7.3, §7.4). A bill-level discount reduces the
 * taxable value BEFORE GST is computed — GST must never be charged on an
 * amount the customer isn't actually being asked to pay for the goods
 * (Milestone 7; previously this app computed GST on the pre-discount
 * subtotal and applied the discount only after, which overstates GST).
 * Old gold trade-in must still NEVER touch this base (PRD §8.3, KNOWN_ISSUES #1)
 * — it is netted separately via settleOldGold(), after grandTotal.
 */
export function calculateInvoiceTotals(lineSubtotals: number[], discount: number): InvoiceTotals {
  const subtotal = lineSubtotals.reduce((sum, s) => sum + s, 0);
  const discountAmount = Number(discount) || 0;
  const taxableValue = Math.max(0, subtotal - discountAmount);
  const gstTax = Math.round(taxableValue * GST_RATE);
  const grandTotal = taxableValue + gstTax;

  return { subtotal, taxableValue, gstTax, grandTotal };
}

/**
 * Old Gold Exchange settlement (PRD §8.3 / §17 "Final Settlement"). This is
 * a separate purchase transaction netted only against the final amount
 * collected — it must never be passed into calculateInvoiceTotals.
 */
export function settleOldGold(grandTotal: number, oldGoldValue: number): number {
  return Math.max(0, grandTotal - (Number(oldGoldValue) || 0));
}
