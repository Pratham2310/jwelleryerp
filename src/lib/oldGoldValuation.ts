/**
 * Old Gold / Silver buyback valuation (PRD §8.2, Milestone 14).
 *
 * PRD §8.2 step 4 states the formula normatively:
 *   Net Payable Weight = Gross Weight × Tested Purity% × (1 − Deduction%)
 *   Buyback Value      = Net Payable Weight × Buy-back Rate/gram
 *
 * ⚠️ KNOWN DISCREPANCY IN THE SOURCE DOCUMENT: PRD §17's worked example prints
 * 15.000g × 0.875 × (1 − 0.03) = 12.740g and a buyback value of ₹77,077. That
 * arithmetic does not hold — the formula yields 12.73125g (12.731g at 3dp) and
 * ₹77,024. The printed 12.740g implies a tested purity of ~87.560%, not the 875
 * stated two lines above it. This module implements the **formula**, which is the
 * normative statement; §17 is an illustrative example containing an arithmetic
 * slip. Flagged in HANDOFF.md for client/CA confirmation before go-live, since
 * §17 is described in the PRD as the canonical QA reference.
 */

export interface OldGoldValuationInput {
  grossWeight: number; // grams, as received from the customer
  testedPurityPercent: number; // e.g. 87.5 for a 875 / ~21KT touch reading
  meltingLossPercent: number; // shop's processing/refining deduction, typically 2-4%
  buybackRatePerGram: number; // ₹/g — normally set BELOW the sale rate (PRD §4.2)
}

export interface OldGoldValuationResult {
  grossWeight: number;
  pureContentWeight: number; // gross × purity, before the melting-loss deduction
  meltingLossWeight: number; // grams deducted for melting/refining risk
  netPayableWeight: number; // rounded to 3dp, the weight the customer is paid for
  buybackValue: number; // rounded to the nearest rupee
}

const round3 = (n: number) => Number(n.toFixed(3));

/** PRD §8.2 steps 3-4. Pure; no rounding applied until the two output figures. */
export function calculateOldGoldValuation(input: OldGoldValuationInput): OldGoldValuationResult {
  const grossWeight = Math.max(0, Number(input.grossWeight) || 0);
  const purityFraction = Math.min(100, Math.max(0, Number(input.testedPurityPercent) || 0)) / 100;
  const lossFraction = Math.min(100, Math.max(0, Number(input.meltingLossPercent) || 0)) / 100;
  const rate = Math.max(0, Number(input.buybackRatePerGram) || 0);

  const pureContentWeight = grossWeight * purityFraction;
  const meltingLossWeight = pureContentWeight * lossFraction;
  const netPayableWeight = round3(pureContentWeight - meltingLossWeight);
  const buybackValue = Math.round(netPayableWeight * rate);

  return {
    grossWeight: round3(grossWeight),
    pureContentWeight: round3(pureContentWeight),
    meltingLossWeight: round3(meltingLossWeight),
    netPayableWeight,
    buybackValue,
  };
}

/**
 * Returns an error message if the inputs can't produce a valid voucher, else null.
 * Deliberately strict about purity: a touch reading above 100% is physically
 * impossible and almost always a millesimal value (875) typed into a percent field.
 */
export function validateOldGoldValuation(input: Partial<OldGoldValuationInput>): string | null {
  const gross = Number(input.grossWeight) || 0;
  const purity = Number(input.testedPurityPercent) || 0;
  const loss = Number(input.meltingLossPercent) || 0;
  const rate = Number(input.buybackRatePerGram) || 0;

  if (gross <= 0) return 'Enter the gross weight received from the customer.';
  if (purity <= 0) return 'Record the tested purity before valuing the item.';
  if (purity > 100) {
    return 'Tested purity is a percentage (e.g. 87.5 for a 875 touch), not a millesimal value.';
  }
  if (loss < 0 || loss > 100) return 'Melting loss must be between 0% and 100%.';
  if (rate <= 0) return 'Enter the buy-back rate per gram.';
  return null;
}

/** Millesimal touch readings (875, 916, 995…) converted to the percentage this module expects. */
export function millesimalToPercent(millesimal: number): number {
  return Number(((Number(millesimal) || 0) / 10).toFixed(3));
}

/**
 * Common Indian touch standards, offered as presets so staff aren't hand-typing
 * purity for the overwhelmingly common cases.
 */
export const PURITY_PRESETS: { label: string; millesimal: number; percent: number }[] = [
  { label: '24KT (995 fine)', millesimal: 995, percent: 99.5 },
  { label: '22KT (916 hallmark)', millesimal: 916, percent: 91.6 },
  { label: '21KT (875 touch)', millesimal: 875, percent: 87.5 },
  { label: '18KT (750 touch)', millesimal: 750, percent: 75.0 },
  { label: '14KT (585 touch)', millesimal: 585, percent: 58.5 },
  { label: 'Silver (925 sterling)', millesimal: 925, percent: 92.5 },
];
