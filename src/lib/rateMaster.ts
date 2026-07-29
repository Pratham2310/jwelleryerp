/**
 * Metal Rate Master — append-only rate history (PRD §4.2, decision D-4, Milestone 48).
 *
 * Built ahead of its number because the behaviour it replaces was a live defect, not a missing
 * feature. The Dashboard let anyone overwrite `MetalRate.ratePerGram` in place: no history, no
 * audit trail, and no sanity check — any positive number was accepted. That single field drives
 * metal value on every invoice line, old-gold buyback valuation, and stock-transfer declared
 * value (and therefore the e-Way Bill threshold), so three things were wrong at once:
 *
 *  1. **No history.** "Why was this bill priced at ₹6,650/g?" was unanswerable once the rate
 *     moved. Rate history is exactly what a disputed bill or an audit asks for.
 *  2. **No fat-finger guard.** Typing 66500 instead of 6650 silently mispriced every subsequent
 *     sale until a human noticed. PRD §4.2 requires a deviation guard.
 *  3. **D-4 violated.** The Rate Master is specified as append-only/event-sourced and was being
 *     UPDATEd. `src/lib/taxMaster.ts` (Milestone 21) already does this correctly for tax; this
 *     brings metal rates in line.
 *
 * A rate version is never edited or deleted. A correction is a NEW version — which is also why
 * `effectiveFrom` is a full timestamp rather than a date: gold moves intraday, and two rates on
 * the same day must still order deterministically.
 */

import type { MetalRate, MetalRateVersion } from '../types';
import { purityPercentForMetal } from './fineGoldLedger';

/**
 * PRD §4.2 asks for a "fat-finger (>2–5%) change guard". 5% is the outer bound of that range:
 * gold genuinely can move a few percent in a day, so a tighter default would cry wolf on real
 * movements and train staff to click through the warning — which is worse than no warning.
 * Beyond this, a written reason is required; it is never a hard block, because a real 8% jump
 * can happen and the shop must still be able to trade.
 */
export const FAT_FINGER_THRESHOLD_PERCENT = 5;

/** Beyond this a change is almost certainly a decimal slip rather than a market move. */
export const IMPLAUSIBLE_CHANGE_PERCENT = 50;

export function deviationPercent(newRate: number, previousRate: number): number {
  const prev = Number(previousRate) || 0;
  if (prev <= 0) return 0;
  return ((Number(newRate) || 0) - prev) / prev * 100;
}

export type RateChangeSeverity = 'NORMAL' | 'NEEDS_REASON' | 'IMPLAUSIBLE';

export interface RateChangeAssessment {
  deviationPercent: number;
  absDeviationPercent: number;
  severity: RateChangeSeverity;
  requiresReason: boolean;
  message: string | null;
}

export function assessRateChange(newRate: number, previousRate: number): RateChangeAssessment {
  const deviation = deviationPercent(newRate, previousRate);
  const abs = Math.abs(deviation);
  const rounded = Number(deviation.toFixed(2));
  const direction = deviation > 0 ? 'increase' : 'decrease';

  if (abs > IMPLAUSIBLE_CHANGE_PERCENT) {
    return {
      deviationPercent: rounded,
      absDeviationPercent: Number(abs.toFixed(2)),
      severity: 'IMPLAUSIBLE',
      requiresReason: true,
      message: `That is a ${abs.toFixed(1)}% ${direction} — check for a misplaced decimal point before confirming.`,
    };
  }
  if (abs > FAT_FINGER_THRESHOLD_PERCENT) {
    return {
      deviationPercent: rounded,
      absDeviationPercent: Number(abs.toFixed(2)),
      severity: 'NEEDS_REASON',
      requiresReason: true,
      message: `${abs.toFixed(2)}% ${direction} exceeds the ${FAT_FINGER_THRESHOLD_PERCENT}% guard — record why.`,
    };
  }
  return {
    deviationPercent: rounded,
    absDeviationPercent: Number(abs.toFixed(2)),
    severity: 'NORMAL',
    requiresReason: false,
    message: null,
  };
}

/**
 * The rate version in force for a metal at a given instant.
 *
 * This is what makes an old invoice explainable: pass the invoice's timestamp and get the rate
 * that was actually live when it was billed, not today's. Versions at or before the instant
 * qualify; the latest of those wins.
 */
export function resolveRateAt(
  metalType: string,
  versions: MetalRateVersion[],
  atIso: string
): MetalRateVersion | null {
  const applicable = versions.filter(v => v.metalType === metalType && v.effectiveFrom <= atIso);
  if (applicable.length === 0) return null;
  return applicable.reduce((latest, v) => (v.effectiveFrom > latest.effectiveFrom ? v : latest));
}

export function currentRateVersion(
  metalType: string,
  versions: MetalRateVersion[],
  now: Date = new Date()
): MetalRateVersion | null {
  return resolveRateAt(metalType, versions, now.toISOString());
}

/** Full history for a metal, newest first, with the change each version represented. */
export interface RateHistoryRow extends MetalRateVersion {
  deltaPercent: number | null;
  deltaAmount: number | null;
}

export function buildRateHistory(metalType: string, versions: MetalRateVersion[]): RateHistoryRow[] {
  const ordered = versions
    .filter(v => v.metalType === metalType)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  return ordered
    .map((v, i) => {
      const prev = i > 0 ? ordered[i - 1].ratePerGram : null;
      return {
        ...v,
        deltaAmount: prev === null ? null : Number((v.ratePerGram - prev).toFixed(2)),
        deltaPercent: prev === null ? null : Number(deviationPercent(v.ratePerGram, prev).toFixed(2)),
      };
    })
    .reverse();
}

export interface RateVersionDraft {
  metalType?: string;
  ratePerGram?: number;
  setBy?: string;
  overrideReason?: string;
}

export function validateRateVersion(
  draft: RateVersionDraft,
  previous: MetalRateVersion | null
): string | null {
  if (!draft.metalType?.trim()) return 'Select the metal this rate applies to.';

  const rate = Number(draft.ratePerGram);
  if (!Number.isFinite(rate) || rate <= 0) return 'Enter a rate greater than zero.';

  if (previous) {
    const assessment = assessRateChange(rate, previous.ratePerGram);
    if (assessment.requiresReason && (draft.overrideReason ?? '').trim().length < 5) {
      return `${assessment.message} (at least 5 characters)`;
    }
    if (rate === previous.ratePerGram) {
      // Appending an identical rate adds a row that explains nothing and clutters the audit trail.
      return 'That is the same as the current rate — nothing to record.';
    }
  }
  return null;
}

/**
 * Appends a new version. Returns a NEW array; no existing row is touched, which is the whole
 * point of D-4 — a historical rate must stay exactly as it was recorded.
 */
export function appendRateVersion(
  versions: MetalRateVersion[],
  incoming: MetalRateVersion
): MetalRateVersion[] {
  return [...versions, incoming];
}

/**
 * PRD §4.2: derive the lower-purity rates from the 24K base.
 *
 * Returned as a SUGGESTION, never applied silently. In practice a shop's 22K counter rate is
 * not exactly 91.6% of its 24K rate — the seed data is 7250 and 6650, where strict derivation
 * gives 6641 — because the quoted rate absorbs local premium and rounding. Overwriting a
 * deliberately-set counter rate with arithmetic would quietly change what customers are charged.
 */
export function derivePurityRate(base24kRate: number, metalType: string): number {
  const purity = purityPercentForMetal(metalType);
  const base = Number(base24kRate) || 0;
  // 24K is itself 99.9% fine, so the ratio is against that rather than a notional 100%.
  const base24Purity = purityPercentForMetal('Gold (24K)');
  return Math.round((base * purity) / base24Purity);
}

export interface DerivedRateSuggestion {
  metalType: string;
  currentRate: number;
  derivedRate: number;
  differenceAmount: number;
  differencePercent: number;
}

export function buildDerivedSuggestions(
  base24kRate: number,
  rates: MetalRate[]
): DerivedRateSuggestion[] {
  return rates
    .filter(r => r.metalType.startsWith('Gold (') && r.metalType !== 'Gold (24K)')
    .map(r => {
      const derived = derivePurityRate(base24kRate, r.metalType);
      return {
        metalType: r.metalType,
        currentRate: r.ratePerGram,
        derivedRate: derived,
        differenceAmount: derived - r.ratePerGram,
        differencePercent: Number(deviationPercent(derived, r.ratePerGram).toFixed(2)),
      };
    });
}

/**
 * Projects the append-only versions back into the `MetalRate[]` shape the rest of the app
 * already consumes, so the versions become the single source of truth without every screen
 * having to change. Mirrors how Milestone 16 made karigar balances derived rather than stored.
 *
 * `history24h` is now REAL — the last 8 recorded versions — where it used to be a decorative
 * array that shifted a value in on each edit. `change24h` is measured against the newest version
 * older than 24 hours, falling back to the earliest known version when the history is shorter.
 */
export function projectCurrentRates(
  versions: MetalRateVersion[],
  base: MetalRate[],
  now: Date = new Date()
): MetalRate[] {
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  return base.map(rate => {
    const forMetal = versions
      .filter(v => v.metalType === rate.metalType && v.effectiveFrom <= now.toISOString())
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

    if (forMetal.length === 0) return rate;

    const current = forMetal[forMetal.length - 1];
    const older = forMetal.filter(v => v.effectiveFrom <= dayAgo);
    const reference = older.length > 0 ? older[older.length - 1] : forMetal[0];

    return {
      ...rate,
      ratePerGram: current.ratePerGram,
      change24h: Number(deviationPercent(current.ratePerGram, reference.ratePerGram).toFixed(2)),
      history24h: forMetal.slice(-8).map(v => v.ratePerGram),
    };
  });
}

/**
 * One-time migration for shops that already have rates but no version history.
 *
 * Reconstructs an opening trail from the existing `history24h` points so the sparkline keeps
 * showing real movement instead of resetting to a flat line. The points are spaced backwards
 * over the past 24 hours and marked `MIGRATED`, so nobody mistakes a reconstructed timestamp
 * for a genuinely recorded one.
 */
export function seedVersionsFromRates(rates: MetalRate[], now: Date = new Date()): MetalRateVersion[] {
  const versions: MetalRateVersion[] = [];

  for (const rate of rates) {
    const points = rate.history24h?.length ? rate.history24h : [rate.ratePerGram];
    const stepMs = (24 * 3600 * 1000) / Math.max(points.length, 1);

    points.forEach((point, i) => {
      const at = new Date(now.getTime() - (points.length - 1 - i) * stepMs);
      versions.push({
        id: `rv-${rate.metalType.replace(/\W+/g, '')}-${i}`,
        metalType: rate.metalType,
        ratePerGram: point,
        effectiveFrom: at.toISOString(),
        setBy: 'System (migrated)',
        source: 'MIGRATED',
      });
    });
  }
  return versions;
}
