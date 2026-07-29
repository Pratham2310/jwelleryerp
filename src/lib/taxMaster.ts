/**
 * Tax Master + CGST/SGST/IGST determination (PRD §9.2/§9.3, §7.3, Milestone 21).
 *
 * PRD §9.2 is explicit that the system "MUST NOT hardcode these as immutable" — the
 * accountant has to be able to apply a new GST Council notification the day it lands.
 * So rates live in data, not in a constant, and carry **effective-date versioning**:
 * a row is never edited in place, it is superseded by a new row with a later
 * `effectiveFrom`. That is the same append-only principle as decision D-4, and it is
 * what makes it possible to re-print a two-year-old invoice at the rate that actually
 * applied on its date rather than today's rate.
 *
 * ─── DELIBERATE SCOPE LIMIT: the diamond HSN split ───────────────────────────────
 * PRD §9.2 lists diamonds (HSN 7102) at 1.5% against jewellery (7113) at 3%, but
 * flags it "verify current notification", and HANDOFF.md item 1 records this as an
 * open question needing CA sign-off: whether a diamond-set gold ornament is one
 * composite supply at 3%, or two supplies split by HSN.
 *
 * This module models per-HSN rates fully — the 7102 row exists and resolves — but
 * `defaultHsnForLine()` deliberately returns 7113 for a diamond-set ornament, so the
 * shipped behaviour stays the single composite rate that PRD §17's worked example
 * uses. When the CA answers, only that one function changes; the engine already
 * supports the split. Do not "fix" this by reassigning diamonds to 7102 without the
 * sign-off — it would silently halve the tax charged on every diamond sale.
 */

import type { TaxRate } from '../types';

/**
 * Fallback rate, used only when a line's HSN has no row in force on the invoice date.
 * It is the composite jewellery rate from PRD §17. This is a safety net for
 * mis-configured data, NOT the primary path — a real lookup should always find a row.
 */
export const FALLBACK_COMPOSITE_RATE_PERCENT = 3;

export type SupplyType = 'INTRA_STATE' | 'INTER_STATE';

/** HSN/SAC codes from PRD §9.2, referenced by name so call sites don't hardcode strings. */
export const HSN = {
  JEWELLERY: '7113', // gold / silver / platinum articles
  DIAMOND: '7102', // unset, cut & polished — see the scope limit above
  OTHER_STONES: '7103',
  GOLD_BULLION: '7108',
  SILVER_BULLION: '7106',
  JOB_WORK_SERVICE: '9988', // SAC, not HSN
} as const;

/**
 * The TaxRate row in force for an HSN on a given date.
 *
 * A row applies when `effectiveFrom <= onDate` and either it has no `effectiveTo` or
 * `onDate <= effectiveTo`. If several qualify (overlapping data), the one with the
 * latest `effectiveFrom` wins, so a correction posted later takes precedence.
 */
export function resolveTaxRate(
  hsnCode: string,
  rates: TaxRate[],
  onDate: string
): TaxRate | null {
  const applicable = rates.filter(
    r =>
      r.hsnCode === hsnCode &&
      r.effectiveFrom <= onDate &&
      (!r.effectiveTo || onDate <= r.effectiveTo)
  );
  if (applicable.length === 0) return null;

  return applicable.reduce((latest, r) => (r.effectiveFrom > latest.effectiveFrom ? r : latest));
}

/** Convenience wrapper returning just the percentage, with the documented fallback. */
export function resolveGstRatePercent(hsnCode: string, rates: TaxRate[], onDate: string): number {
  return resolveTaxRate(hsnCode, rates, onDate)?.gstRatePercent ?? FALLBACK_COMPOSITE_RATE_PERCENT;
}

export interface HsnLineContext {
  metalType?: string;
  category?: string;
  /** An explicit code from the Item Design master, which wins if set. */
  hsnCode?: string;
}

/**
 * The HSN a sale line is billed under.
 *
 * An `ItemDesign` carries its own `hsnCode`, and that is authoritative when present —
 * the accountant classifying a design should not be silently overridden by a guess from
 * its category. Only when a line has no code (a manually-added row, or an older design)
 * is it derived.
 *
 * Bullion (coins/bars) is a genuinely different HSN from an ornament even though both
 * currently sit at 3%, and GSTR-1 requires an HSN-wise summary — so getting this right
 * matters for the return even when it does not change the tax charged.
 *
 * Stones are intentionally NOT split out here; see the scope limit at the top.
 */
export function defaultHsnForLine(ctx: HsnLineContext): string {
  if (ctx.hsnCode?.trim()) return ctx.hsnCode.trim();

  const category = (ctx.category || '').toLowerCase();
  const metalType = (ctx.metalType || '').toLowerCase();

  if (category === 'coins' || category === 'bullion' || category === 'bars') {
    return metalType.includes('silver') ? HSN.SILVER_BULLION : HSN.GOLD_BULLION;
  }
  return HSN.JEWELLERY;
}

/**
 * PRD §7.3: "If Shop State == Customer State (or unregistered/no state captured,
 * default to shop's state): CGST/SGST. Else: IGST."
 *
 * The default matters commercially: most retail jewellery customers are walk-ins with
 * no state on file, and treating those as inter-state would wrongly move tax out of the
 * shop's own state and misfile every counter sale.
 */
export function determineSupplyType(
  branchStateCode: string | undefined,
  customerStateCode: string | undefined
): SupplyType {
  if (!branchStateCode) return 'INTRA_STATE';
  if (!customerStateCode?.trim()) return 'INTRA_STATE';
  return customerStateCode.trim() === branchStateCode ? 'INTRA_STATE' : 'INTER_STATE';
}

export interface GstSplit {
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/**
 * Splits an already-computed total tax into its statutory components.
 *
 * The halves are derived as `cgst = round(total/2)` and `sgst = total - cgst` rather
 * than rounding each half independently. Rounding both would let them sum to a rupee
 * more or less than the tax actually charged on the invoice (e.g. 8683 → 4342 + 4342 =
 * 8684), and an invoice whose CGST + SGST does not equal its GST total will not
 * reconcile in GSTR-1. This way they always sum to exactly `total`.
 */
export function splitGst(totalTax: number, supplyType: SupplyType): GstSplit {
  const total = Math.round(Number(totalTax) || 0);
  if (supplyType === 'INTER_STATE') {
    return { cgst: 0, sgst: 0, igst: total, total };
  }
  const cgst = Math.round(total / 2);
  return { cgst, sgst: total - cgst, igst: 0, total };
}

/** Human label for the tax lines on an invoice, e.g. "CGST @1.5%". */
export function gstComponentLabels(ratePercent: number, supplyType: SupplyType): string[] {
  const half = ratePercent / 2;
  const fmt = (n: number) => `${Number(n.toFixed(2))}%`;
  return supplyType === 'INTER_STATE'
    ? [`IGST @${fmt(ratePercent)}`]
    : [`CGST @${fmt(half)}`, `SGST @${fmt(half)}`];
}

/**
 * PRD §7.3: `Round Off = Round(Total) - Total`, posted to its own ledger.
 *
 * Returned in rupees to 2dp. It is normally a few paise either way, arising because GST
 * at 3% on a whole-rupee taxable value lands on paise (289440 × 3% = 8683.20).
 */
export function computeRoundOff(exactTotal: number): { roundedTotal: number; roundOff: number } {
  const exact = Number(exactTotal) || 0;
  const roundedTotal = Math.round(exact);
  return {
    roundedTotal,
    roundOff: Math.round((roundedTotal - exact) * 100) / 100,
  };
}

/**
 * Validates a new Tax Master row before it is appended.
 * Rates are never edited, so this only ever runs against a row being added.
 */
export function validateTaxRate(draft: Partial<TaxRate>, existing: TaxRate[] = []): string | null {
  if (!draft.hsnCode?.trim()) return 'An HSN or SAC code is required.';
  if (!/^\d{4,8}$/.test(draft.hsnCode.trim())) {
    return 'HSN/SAC must be 4 to 8 digits.';
  }
  if (!draft.description?.trim()) return 'Describe what this code covers.';

  const rate = Number(draft.gstRatePercent);
  if (!Number.isFinite(rate) || rate < 0) return 'Enter a valid GST rate.';
  if (rate > 28) return 'GST cannot exceed 28% — the highest GST Council slab.';

  if (!draft.effectiveFrom) return 'An effective-from date is required.';
  if (draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) {
    return 'The effective-to date cannot precede the effective-from date.';
  }

  const duplicate = existing.some(
    r => r.hsnCode === draft.hsnCode!.trim() && r.effectiveFrom === draft.effectiveFrom
  );
  if (duplicate) {
    return `A rate for HSN ${draft.hsnCode.trim()} effective ${draft.effectiveFrom} already exists.`;
  }
  return null;
}

/**
 * Appends a new rate and closes the previous open-ended row for that HSN the day before
 * the new one takes effect. The old row is retained, not overwritten — an invoice dated
 * inside its window must still resolve to it.
 */
export function supersedeTaxRate(rates: TaxRate[], incoming: TaxRate): TaxRate[] {
  const dayBefore = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const closed = rates.map(r =>
    r.hsnCode === incoming.hsnCode && !r.effectiveTo && r.effectiveFrom < incoming.effectiveFrom
      ? { ...r, effectiveTo: dayBefore(incoming.effectiveFrom) }
      : r
  );
  return [...closed, incoming];
}

export interface HsnSummaryRow {
  hsnCode: string;
  description: string;
  ratePercent: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * HSN-wise summary (PRD §9.5 "HSN Summary Report", and a mandatory GSTR-1 table).
 * Groups already-computed invoice lines; it does not recompute tax.
 */
export function summariseByHsn(
  lines: { hsnCode?: string; taxableValue: number; cgst: number; sgst: number; igst: number; ratePercent?: number }[],
  rates: TaxRate[] = []
): HsnSummaryRow[] {
  const byHsn = new Map<string, HsnSummaryRow>();

  for (const line of lines) {
    const hsnCode = line.hsnCode || HSN.JEWELLERY;
    const existing = byHsn.get(hsnCode);
    if (existing) {
      existing.taxableValue += line.taxableValue;
      existing.cgst += line.cgst;
      existing.sgst += line.sgst;
      existing.igst += line.igst;
    } else {
      byHsn.set(hsnCode, {
        hsnCode,
        description: rates.find(r => r.hsnCode === hsnCode)?.description ?? 'Unclassified',
        ratePercent: line.ratePercent ?? FALLBACK_COMPOSITE_RATE_PERCENT,
        taxableValue: line.taxableValue,
        cgst: line.cgst,
        sgst: line.sgst,
        igst: line.igst,
      });
    }
  }

  return [...byHsn.values()].sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
}
