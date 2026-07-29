/**
 * Non-hallmarked sale prevention (PRD §11.3, Milestone 25).
 *
 * Milestone 24 made HUIDs assignable; this stops a piece being sold without one. Selling
 * un-hallmarked gold that isn't exempt is a BIS offence, so it is the actual legal exposure the
 * hallmarking module exists to close.
 *
 * ─── Why this is configurable rather than an absolute block ───────────────────────────
 * PRD §11.3 is explicit: "configurable hard-block vs warning, since exemptions exist". Mandatory
 * hallmarking has real carve-outs, and a shop hitting an unconditional block on a legitimate sale
 * would simply be unable to trade. The exemptions modelled here:
 *
 *  - **Metal.** Mandatory hallmarking covers GOLD jewellery and artefacts. Silver hallmarking is
 *    voluntary, and platinum is separately regulated — so blocking a silver ring for want of a
 *    HUID would be wrong, not merely strict.
 *  - **Weight.** Articles below a threshold (commonly 2g) are exempt.
 *  - **Category.** Coins and bullion are not "articles of jewellery" — consistent with Milestone
 *    21 classifying them under HSN 7108/7106 rather than 7113.
 *  - **Turnover.** A shop below the notified annual turnover is exempt entirely.
 *
 * The rules themselves change with notifications, which is why they are a policy object rather
 * than constants baked into the check. `enforcement` decides what happens when a violation is
 * found; it never decides whether one *is* found, so the audit answer stays the same either way.
 */

import type { Tag, HallmarkPolicy, InvoiceItem } from '../types';

export const DEFAULT_HALLMARK_POLICY: HallmarkPolicy = {
  enforcement: 'BLOCK',
  minimumWeightGrams: 2,
  // Mandatory hallmarking is a gold regime; silver is voluntary and platinum separate.
  exemptMetals: ['Silver (999)', 'Platinum (950)'],
  // Bullion is not an article of jewellery.
  exemptCategories: ['Coins'],
  shopExemptByTurnover: false,
};

export type HallmarkExemption =
  | 'SHOP_TURNOVER'
  | 'METAL_NOT_COVERED'
  | 'CATEGORY_NOT_JEWELLERY'
  | 'BELOW_WEIGHT_THRESHOLD';

export const EXEMPTION_LABEL: Record<HallmarkExemption, string> = {
  SHOP_TURNOVER: 'Shop below the notified turnover threshold',
  METAL_NOT_COVERED: 'Metal not under mandatory hallmarking',
  CATEGORY_NOT_JEWELLERY: 'Not an article of jewellery',
  BELOW_WEIGHT_THRESHOLD: 'Below the minimum weight threshold',
};

export interface HallmarkComplianceResult {
  /** Whether a HUID is legally needed for this piece at all. */
  required: boolean;
  /** True when the piece may be sold: either exempt, or hallmarked. */
  compliant: boolean;
  exemption: HallmarkExemption | null;
  huid: string | null;
  message: string | null;
}

export interface HallmarkSubject {
  metalType?: string;
  category?: string;
  netWeight?: number;
  huid?: string;
  sku?: string;
  name?: string;
}

/**
 * Assesses one piece against the policy.
 *
 * Exemptions are evaluated before the HUID is looked at, because an exempt piece is compliant
 * whether or not it happens to carry one — and the reason shown to the operator should be the
 * exemption, not "no HUID".
 */
export function assessHallmarkCompliance(
  subject: HallmarkSubject,
  policy: HallmarkPolicy = DEFAULT_HALLMARK_POLICY
): HallmarkComplianceResult {
  const huid = (subject.huid || '').trim() || null;

  const exemption = findExemption(subject, policy);
  if (exemption) {
    return {
      required: false,
      compliant: true,
      exemption,
      huid,
      message: null,
    };
  }

  if (huid) {
    return { required: true, compliant: true, exemption: null, huid, message: null };
  }

  const label = subject.sku || subject.name || 'This piece';
  return {
    required: true,
    compliant: false,
    exemption: null,
    huid: null,
    message: `${label} is ${subject.metalType || 'gold'} and requires a BIS HUID, but none is assigned. Send it for hallmarking before sale.`,
  };
}

function findExemption(
  subject: HallmarkSubject,
  policy: HallmarkPolicy
): HallmarkExemption | null {
  if (policy.shopExemptByTurnover) return 'SHOP_TURNOVER';

  const metal = subject.metalType || '';
  if (policy.exemptMetals.some(m => m.toLowerCase() === metal.toLowerCase())) {
    return 'METAL_NOT_COVERED';
  }

  const category = subject.category || '';
  if (policy.exemptCategories.some(c => c.toLowerCase() === category.toLowerCase())) {
    return 'CATEGORY_NOT_JEWELLERY';
  }

  // A weight of zero means "not captured", not "weightless" — do not exempt on missing data.
  const weight = Number(subject.netWeight);
  if (Number.isFinite(weight) && weight > 0 && weight < policy.minimumWeightGrams) {
    return 'BELOW_WEIGHT_THRESHOLD';
  }
  return null;
}

export interface HallmarkViolation {
  lineIndex: number;
  sku: string;
  message: string;
}

/**
 * Checks a whole bill. Returns every violation rather than the first, so an operator fixes one
 * trip to the hallmarking centre instead of discovering the pieces one at a time.
 *
 * **Manually-typed "custom item" lines are checked too**, from the line's own typed fields. They
 * carry no tag, but they are one button click away on the billing desk and default to Gold (22K)
 * — so exempting them would leave the whole guard bypassable by anyone who typed the piece in
 * rather than scanning it. A custom line can record its own HUID for exactly this reason.
 *
 * A custom line has no category, so the "not an article of jewellery" exemption cannot apply to
 * it. That is deliberate and matches how a missing weight is treated: absent data must never be
 * read as a qualifying value.
 */
export function findHallmarkViolations(
  lines: Partial<InvoiceItem>[],
  tags: Tag[],
  policy: HallmarkPolicy = DEFAULT_HALLMARK_POLICY
): HallmarkViolation[] {
  const violations: HallmarkViolation[] = [];

  lines.forEach((line, lineIndex) => {
    const tag = line.itemId ? tags.find(t => t.id === line.itemId) : undefined;

    // A catalogue line takes the tag as authoritative; a custom line is judged on what was typed.
    const subject: HallmarkSubject = tag
      ? {
          metalType: tag.metalType,
          category: tag.category,
          netWeight: tag.netWeight,
          huid: tag.huid,
          sku: tag.sku,
          name: tag.name,
        }
      : {
          metalType: line.metalType,
          netWeight: line.netWeight,
          huid: line.huid,
          sku: line.sku,
          name: line.name,
        };

    // An empty row the operator has not filled in yet is not a violation.
    if (!tag && !line.name?.trim() && !Number(line.netWeight)) return;
    // A line pointing at a tag that no longer exists cannot be assessed.
    if (line.itemId && !tag) return;

    const result = assessHallmarkCompliance(subject, policy);

    if (!result.compliant && result.message) {
      violations.push({
        lineIndex,
        sku: tag?.sku || line.name?.trim() || `Line ${lineIndex + 1}`,
        message: result.message,
      });
    }
  });

  return violations;
}

export interface HallmarkGateOutcome {
  violations: HallmarkViolation[];
  /** Checkout must stop. */
  blocked: boolean;
  /** Proceed, but the operator has been told. */
  warned: boolean;
  message: string | null;
}

/**
 * Applies the policy's enforcement mode to a set of violations.
 *
 * Note the violations are computed regardless of mode — switching to WARN does not make a piece
 * compliant, it only changes whether the till stops. Keeping detection and enforcement separate
 * is what lets a shop run in WARN mode and still report accurately on its own exposure.
 */
export function applyHallmarkGate(
  violations: HallmarkViolation[],
  policy: HallmarkPolicy = DEFAULT_HALLMARK_POLICY
): HallmarkGateOutcome {
  if (violations.length === 0 || policy.enforcement === 'OFF') {
    return { violations, blocked: false, warned: false, message: null };
  }

  const summary = violations.length === 1
    ? violations[0].message
    : `${violations.length} pieces on this bill require a BIS HUID: ${violations.map(v => v.sku).join(', ')}.`;

  if (policy.enforcement === 'WARN') {
    return { violations, blocked: false, warned: true, message: `${summary} Proceeding is a compliance risk.` };
  }
  return { violations, blocked: true, warned: false, message: summary };
}

export function validateHallmarkPolicy(policy: Partial<HallmarkPolicy>): string | null {
  const weight = Number(policy.minimumWeightGrams);
  if (!Number.isFinite(weight) || weight < 0) {
    return 'Enter a valid minimum weight in grams.';
  }
  if (weight > 100) {
    // A threshold this high would exempt effectively the whole catalogue.
    return 'A threshold above 100g would exempt almost everything — check the figure.';
  }
  if (!policy.enforcement) return 'Choose how the guard should behave.';
  return null;
}
