/**
 * Money and weight arithmetic (Handbook §1.6 "money is domain-critical", prerequisite for the
 * Phase 9 accounting milestones).
 *
 * Every figure in this app is a JavaScript number, which is an IEEE-754 double. That is fine for
 * one multiplication and a `Math.round`, and it is exactly why nothing has visibly broken so far.
 * It stops being fine in two places, both of which the accounting phase walks straight into:
 *
 *  1. **Accumulation.** `8.2 × 6650` is `54529.99999999999`, not `54530`. Add a thousand such
 *     figures and the error is real, not notional — summing `0.10` a thousand times gives
 *     `99.9999999999986`.
 *
 *  2. **Splitting.** Rounding each part of a split independently does not reproduce the whole.
 *     Apportioning ₹1,000 across lines of 3333/3333/3334 by `round(share)` yields 333+333+333 =
 *     **999**. In a double-entry system that is a book that does not balance, and it was already
 *     a live defect here: three successive partial returns against one invoice reversed only
 *     ₹999 of a ₹1,000 discount, so the invoice could never be fully closed.
 *
 * The remedy is not to sprinkle more `Math.round` calls. It is to do money arithmetic in integer
 * **paisa** and to allocate rather than divide — `allocate()` guarantees by construction that the
 * parts sum back to the total, which is the property double-entry actually depends on.
 */

/** Normalises IEEE-754 noise before rounding: (1234.565 * 100) is 123456.49999999999. */
function scrub(value: number): number {
  return Number((Number(value) || 0).toFixed(6));
}

/** Rupees → integer paisa. The canonical internal representation for money. */
export function toPaisa(rupees: number): number {
  return Math.round(scrub((Number(rupees) || 0) * 100));
}

/** Integer paisa → rupees. */
export function fromPaisa(paisa: number): number {
  return scrub((Number(paisa) || 0) / 100);
}

/** Rounds to whole rupees, the unit invoices are actually issued in. */
export function roundMoney(rupees: number): number {
  return Math.round(scrub(Number(rupees) || 0));
}

/** Rounds to paisa — for anything that must not lose sub-rupee precision before a final total. */
export function roundToPaisa(rupees: number): number {
  return fromPaisa(toPaisa(rupees));
}

/**
 * Sums in integer paisa, so a long list of amounts cannot drift.
 * Prefer this over `values.reduce((a, b) => a + b, 0)` anywhere the list can grow.
 */
export function sumMoney(values: number[]): number {
  return fromPaisa(values.reduce((total, v) => total + toPaisa(v), 0));
}

/** Multiplies an amount by a factor (rate, percentage, quantity) without compounding drift. */
export function multiplyMoney(amount: number, factor: number): number {
  return fromPaisa(Math.round(scrub(toPaisa(amount) * (Number(factor) || 0))));
}

/** Percentage of an amount, e.g. `percentOf(289440, 3)` for 3% GST. */
export function percentOf(amount: number, percent: number): number {
  return multiplyMoney(amount, (Number(percent) || 0) / 100);
}

/**
 * Money comparison. Never use `===` on two computed amounts — `0.1 + 0.2 === 0.3` is false, and
 * "does this payment split settle the invoice" is exactly that comparison.
 */
export function moneyEquals(a: number, b: number): boolean {
  return toPaisa(a) === toPaisa(b);
}

/**
 * Apportions `total` across `weights` such that the parts sum **exactly** to the total.
 *
 * Uses the largest-remainder method: floor every share, then hand the leftover paisa one at a
 * time to the shares with the biggest discarded fractions. That is the fairest deterministic
 * distribution, and — the point of the whole exercise — `sum(allocate(t, w)) === t` always.
 *
 * Rounding each share independently does NOT have that property, which is how ₹1,000 apportioned
 * over 3333/3333/3334 becomes ₹999.
 *
 * A zero or negative weight total returns everything to the first bucket rather than dividing by
 * zero — the money exists and has to land somewhere.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const totalPaisa = toPaisa(total);
  const weightSum = weights.reduce((sum, w) => sum + (Number(w) || 0), 0);

  if (weightSum <= 0) {
    return weights.map((_, i) => (i === 0 ? fromPaisa(totalPaisa) : 0));
  }

  const exact = weights.map(w => (totalPaisa * (Number(w) || 0)) / weightSum);
  const floors = exact.map(Math.floor);
  let remainder = totalPaisa - floors.reduce((sum, f) => sum + f, 0);

  // Hand out the leftover paisa to the largest fractional parts first; ties go to the earlier
  // bucket, so the result is deterministic and a re-run cannot shuffle a customer's figures.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    result[order[i].index] += 1;
  }
  // A negative total (a credit note) leaves a negative remainder — take paisa back the same way.
  for (let i = 0; remainder < 0 && i < order.length; i++, remainder++) {
    result[order[order.length - 1 - i].index] -= 1;
  }

  return result.map(fromPaisa);
}

/** Splits an amount into `parts` equal shares that still sum exactly to the original. */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  return allocate(total, Array.from({ length: parts }, () => 1));
}

/* ─────────────────────────────── Weight ─────────────────────────────── */

/**
 * Weight is domain-critical for the same reason money is, and worse: gold is priced per gram, so
 * a drifting gram becomes a drifting rupee. The trade works to 3 decimal places (milligrams).
 */
export const WEIGHT_DP = 3;
const WEIGHT_FACTOR = 10 ** WEIGHT_DP;

export function roundWeight(grams: number): number {
  return Math.round(scrub((Number(grams) || 0) * WEIGHT_FACTOR)) / WEIGHT_FACTOR;
}

/** Sums weights in integer milligrams — `1000 × 8.245g` otherwise lands on 8244.99999999991. */
export function sumWeight(values: number[]): number {
  const mg = values.reduce((total, v) => total + Math.round(scrub((Number(v) || 0) * WEIGHT_FACTOR)), 0);
  return mg / WEIGHT_FACTOR;
}

export function weightEquals(a: number, b: number): boolean {
  return roundWeight(a) === roundWeight(b);
}

/** Apportions a weight across parts that sum exactly to the whole — `allocate` for grams. */
export function allocateWeight(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  // Reuse the money allocator by working in milligrams-as-paisa, then scale back.
  const asRupees = allocate(roundWeight(total) * (WEIGHT_FACTOR / 100), weights);
  return asRupees.map(v => roundWeight((v * 100) / WEIGHT_FACTOR));
}
