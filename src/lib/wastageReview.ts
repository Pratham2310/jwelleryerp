/**
 * Excess-wastage review workflow (PRD §6.2, Milestone 18).
 *
 * PRD §6.2: "Excess wastage beyond the agreed % is flagged for owner review (possible
 * loss/theft indicator)." Before Milestone 16 the code did the opposite — `Math.min()`
 * silently capped the deduction so the excess vanished, meaning a karigar could lose metal
 * repeatedly and nothing would ever surface it.
 *
 * Milestone 16 stopped absorbing it (the excess now stays on the karigar's balance).
 * This module adds the review itself: the owner decides whether the SHOP absorbs the loss
 * (written off, clearing the balance) or the KARIGAR bears it (stays payable).
 */

import type { JobWork, WastageReview, WastageReviewStatus } from '../types';
import type { WastageAssessment } from './fineGoldLedger';

export const REVIEW_STATUS_LABEL: Record<WastageReviewStatus, string> = {
  Pending: 'Awaiting Owner Review',
  WrittenOff: 'Written Off by Shop',
  RecoveredFromKarigar: 'Recovered from Karigar',
};

/** Builds the review record raised at receipt time, or null when wastage was within the cap. */
export function buildWastageReview(
  assessment: WastageAssessment,
  flaggedOn: string
): WastageReview | null {
  if (!assessment.isExcessive) return null;
  return {
    excessFineWeight: assessment.excessFineWeight,
    wastagePercent: assessment.wastagePercent,
    allowedPercent: assessment.allowedPercent,
    flaggedOn,
    status: 'Pending',
  };
}

/** Jobs still awaiting an owner decision — the review queue. */
export function pendingReviews(jobs: JobWork[]): JobWork[] {
  return jobs.filter(j => j.wastageReview?.status === 'Pending');
}

export interface ReviewQueueSummary {
  pendingCount: number;
  totalExcessFineWeight: number;
  worstOffenderKarigarName: string | null;
  worstOffenderExcess: number;
}

/**
 * Aggregates the queue. `worstOffender` matters operationally: a single over-cap job is
 * usually a bad casting, but one karigar repeatedly topping the list is the signal PRD §6.2
 * is actually asking the system to surface.
 */
export function summariseReviewQueue(jobs: JobWork[]): ReviewQueueSummary {
  const pending = pendingReviews(jobs);

  const byKarigar = new Map<string, number>();
  for (const j of pending) {
    const excess = j.wastageReview?.excessFineWeight ?? 0;
    byKarigar.set(j.karigarName, (byKarigar.get(j.karigarName) ?? 0) + excess);
  }

  let worstName: string | null = null;
  let worstExcess = 0;
  for (const [name, excess] of byKarigar) {
    if (excess > worstExcess) {
      worstName = name;
      worstExcess = excess;
    }
  }

  return {
    pendingCount: pending.length,
    totalExcessFineWeight: Number(
      pending.reduce((s, j) => s + (j.wastageReview?.excessFineWeight ?? 0), 0).toFixed(3)
    ),
    worstOffenderKarigarName: worstName,
    worstOffenderExcess: Number(worstExcess.toFixed(3)),
  };
}

/** A review is only actionable once, and only while Pending. */
export function canResolveReview(job: JobWork): boolean {
  return job.wastageReview?.status === 'Pending';
}

export function reviewBlockedReason(job: JobWork): string | null {
  if (!job.wastageReview) return 'This job has no excess-wastage flag to review.';
  if (job.wastageReview.status !== 'Pending') {
    return `This flag was already resolved as "${REVIEW_STATUS_LABEL[job.wastageReview.status]}".`;
  }
  return null;
}

/**
 * Whether resolving this way should append a ledger entry clearing the excess.
 * Writing it off is the shop absorbing the loss, so the karigar's balance must drop.
 * Recovering from the karigar leaves the balance alone — they still owe it.
 */
export function resolutionClearsBalance(status: WastageReviewStatus): boolean {
  return status === 'WrittenOff';
}

export function validateReviewNote(note: string): string | null {
  if ((note || '').trim().length < 5) {
    return 'Record why this excess is being written off or recovered — it is the audit trail for a possible loss.';
  }
  return null;
}

// ---------- Scrap & unused stone return (PRD §6.2 workflow step 3) ----------

export interface ScrapReturnInput {
  grossWeight: number;
  purityPercent: number;
}

export function validateScrapReturn(input: Partial<ScrapReturnInput>): string | null {
  const g = Number(input.grossWeight) || 0;
  const p = Number(input.purityPercent) || 0;
  if (g <= 0) return 'Enter the weight of scrap / filings being returned.';
  if (p <= 0) return 'Record the purity of the returned scrap.';
  if (p > 100) return 'Purity is a percentage (e.g. 91.6), not a millesimal value.';
  return null;
}
