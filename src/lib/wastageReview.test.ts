import { describe, it, expect } from 'vitest';
import {
  buildWastageReview,
  pendingReviews,
  summariseReviewQueue,
  canResolveReview,
  reviewBlockedReason,
  resolutionClearsBalance,
  validateReviewNote,
  validateScrapReturn,
} from './wastageReview';
import { assessWastage } from './fineGoldLedger';
import type { JobWork } from '../types';

function job(over: Partial<JobWork> = {}): JobWork {
  return {
    id: 'j1', jobNo: 'JOB-2026-001', karigarId: 'kar-1', karigarName: 'Ramesh Lohar',
    designName: 'Ring', category: 'Rings', metalType: 'Gold (22K)', goldIssued: 100,
    issueDate: '2026-07-01', dueDate: '2026-08-01', stage: 'Completed', priority: 'Normal',
    stonesIssued: 'None', metalLossRecorded: 0, receiptStatus: 'Received',
    createdAt: '2026-07-01', ...over,
  };
}

describe('buildWastageReview', () => {
  it('raises no flag when wastage is within the agreed cap', () => {
    const within = assessWastage(100, 96, 6); // 4% lost vs 6% allowed
    expect(buildWastageReview(within, '2026-07-20')).toBeNull();
  });

  it('raises a Pending flag carrying the excess when the cap is breached', () => {
    const over = assessWastage(100, 90, 6); // 10% lost vs 6% allowed -> 4g excess
    const review = buildWastageReview(over, '2026-07-20');
    expect(review).not.toBeNull();
    expect(review!.status).toBe('Pending');
    expect(review!.excessFineWeight).toBe(4);
    expect(review!.wastagePercent).toBe(10);
    expect(review!.allowedPercent).toBe(6);
    expect(review!.flaggedOn).toBe('2026-07-20');
  });

  it('flags even a marginal breach — the PRD wants the signal, not a tolerance', () => {
    const over = assessWastage(100, 93.9, 6); // 6.1% lost
    expect(buildWastageReview(over, '2026-07-20')).not.toBeNull();
  });
});

describe('review queue', () => {
  it('lists only jobs still awaiting a decision', () => {
    const jobs = [
      job({ id: 'a', wastageReview: { excessFineWeight: 4, wastagePercent: 10, allowedPercent: 6, flaggedOn: '2026-07-20', status: 'Pending' } }),
      job({ id: 'b', wastageReview: { excessFineWeight: 2, wastagePercent: 8, allowedPercent: 6, flaggedOn: '2026-07-19', status: 'WrittenOff' } }),
      job({ id: 'c' }), // never flagged
    ];
    expect(pendingReviews(jobs).map(j => j.id)).toEqual(['a']);
  });

  it('summarises an empty queue without NaN', () => {
    expect(summariseReviewQueue([])).toEqual({
      pendingCount: 0, totalExcessFineWeight: 0,
      worstOffenderKarigarName: null, worstOffenderExcess: 0,
    });
  });

  it('totals the outstanding excess across pending flags only', () => {
    const s = summariseReviewQueue([
      job({ id: 'a', wastageReview: { excessFineWeight: 4, wastagePercent: 10, allowedPercent: 6, flaggedOn: 'x', status: 'Pending' } }),
      job({ id: 'b', wastageReview: { excessFineWeight: 1.5, wastagePercent: 8, allowedPercent: 6, flaggedOn: 'x', status: 'Pending' } }),
      job({ id: 'c', wastageReview: { excessFineWeight: 99, wastagePercent: 50, allowedPercent: 6, flaggedOn: 'x', status: 'WrittenOff' } }),
    ]);
    expect(s.pendingCount).toBe(2);
    expect(s.totalExcessFineWeight).toBe(5.5);
  });

  it('identifies the repeat offender by aggregating excess per karigar', () => {
    // The point of the flag per PRD §6.2 is spotting a pattern, not one bad casting
    const s = summariseReviewQueue([
      job({ id: 'a', karigarName: 'Ramesh', wastageReview: { excessFineWeight: 2, wastagePercent: 9, allowedPercent: 6, flaggedOn: 'x', status: 'Pending' } }),
      job({ id: 'b', karigarName: 'Ramesh', wastageReview: { excessFineWeight: 3, wastagePercent: 9, allowedPercent: 6, flaggedOn: 'x', status: 'Pending' } }),
      job({ id: 'c', karigarName: 'Hariprasad', wastageReview: { excessFineWeight: 4, wastagePercent: 9, allowedPercent: 6, flaggedOn: 'x', status: 'Pending' } }),
    ]);
    // Ramesh totals 5g across two jobs, beating Hariprasad's single 4g job
    expect(s.worstOffenderKarigarName).toBe('Ramesh');
    expect(s.worstOffenderExcess).toBe(5);
  });
});

describe('resolving a review', () => {
  const pending = job({ wastageReview: { excessFineWeight: 4, wastagePercent: 10, allowedPercent: 6, flaggedOn: 'x', status: 'Pending' } });

  it('allows resolving a pending flag', () => {
    expect(canResolveReview(pending)).toBe(true);
    expect(reviewBlockedReason(pending)).toBeNull();
  });

  it('blocks resolving a flag twice', () => {
    const done = job({ wastageReview: { ...pending.wastageReview!, status: 'WrittenOff' } });
    expect(canResolveReview(done)).toBe(false);
    expect(reviewBlockedReason(done)).toMatch(/already resolved/i);
  });

  it('blocks reviewing a job that was never flagged', () => {
    expect(canResolveReview(job())).toBe(false);
    expect(reviewBlockedReason(job())).toMatch(/no excess-wastage flag/i);
  });

  it('only a write-off clears the karigar balance — recovery leaves them owing it', () => {
    expect(resolutionClearsBalance('WrittenOff')).toBe(true);
    expect(resolutionClearsBalance('RecoveredFromKarigar')).toBe(false);
    expect(resolutionClearsBalance('Pending')).toBe(false);
  });

  it('requires a meaningful note — this is the audit trail for a possible loss', () => {
    expect(validateReviewNote('')).toMatch(/Record why/i);
    expect(validateReviewNote('ok')).toMatch(/Record why/i);
    expect(validateReviewNote('   ')).toMatch(/Record why/i);
    expect(validateReviewNote('Bad casting batch, accepted by owner')).toBeNull();
  });
});

describe('validateScrapReturn', () => {
  it('accepts a sane scrap return', () => {
    expect(validateScrapReturn({ grossWeight: 2.5, purityPercent: 91.6 })).toBeNull();
  });

  it('requires a weight and a purity', () => {
    expect(validateScrapReturn({ grossWeight: 0, purityPercent: 91.6 })).toMatch(/weight of scrap/i);
    expect(validateScrapReturn({ grossWeight: 2.5, purityPercent: 0 })).toMatch(/purity/i);
  });

  it('catches a millesimal typed into the purity field, as elsewhere in the app', () => {
    expect(validateScrapReturn({ grossWeight: 2.5, purityPercent: 916 })).toMatch(/millesimal/i);
  });
});
