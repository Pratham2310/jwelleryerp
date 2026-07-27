import { describe, it, expect } from 'vitest';
import {
  canAdvanceStage,
  nextStage,
  isOnFloor,
  canReceiveFinishedGoods,
  receiptBlockedReason,
  summariseJobWork,
  nextJobNumber,
  STAGE_ORDER,
  BOARD_STAGES,
} from './jobWork';
import type { JobWork, JobWorkStage } from '../types';

function job(over: Partial<JobWork> = {}): JobWork {
  return {
    id: 'j1',
    jobNo: 'JOB-2026-001',
    karigarId: 'kar-1',
    karigarName: 'Ramesh Lohar',
    designName: 'Peacock Ring',
    category: 'Rings',
    metalType: 'Gold (22K)',
    goldIssued: 15,
    issueDate: '2026-07-01',
    dueDate: '2026-08-01',
    stage: 'Casting',
    priority: 'Normal',
    stonesIssued: 'None',
    metalLossRecorded: 0,
    receiptStatus: 'Pending',
    createdAt: '2026-07-01',
    ...over,
  };
}

describe('jobWork stage pipeline', () => {
  it('advances one stage at a time through the full pipeline', () => {
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      expect(canAdvanceStage(STAGE_ORDER[i], STAGE_ORDER[i + 1])).toBe(true);
    }
  });

  it('refuses to skip a stage — Hallmark cannot be bypassed', () => {
    expect(canAdvanceStage('Polishing', 'Completed')).toBe(false);
    expect(canAdvanceStage('Casting', 'Polishing')).toBe(false);
    expect(canAdvanceStage('Issued', 'Completed')).toBe(false);
  });

  it('refuses to move backwards or stand still', () => {
    expect(canAdvanceStage('Polishing', 'Filing')).toBe(false);
    expect(canAdvanceStage('Casting', 'Casting')).toBe(false);
    expect(canAdvanceStage('Completed', 'Hallmark')).toBe(false);
  });

  it('has no next stage past Completed', () => {
    expect(nextStage('Completed')).toBeNull();
    expect(nextStage('Hallmark')).toBe('Completed');
    expect(nextStage('Issued')).toBe('Casting');
  });

  it('excludes Issued from the kanban columns but keeps it in the pipeline', () => {
    expect(BOARD_STAGES).not.toContain('Issued');
    expect(STAGE_ORDER).toContain('Issued');
    expect(BOARD_STAGES[BOARD_STAGES.length - 1]).toBe('Completed');
  });

  it('treats everything except Completed as still on the floor', () => {
    expect(isOnFloor(job({ stage: 'Issued' }))).toBe(true);
    expect(isOnFloor(job({ stage: 'Hallmark' }))).toBe(true);
    expect(isOnFloor(job({ stage: 'Completed' }))).toBe(false);
  });
});

describe('canReceiveFinishedGoods — the sync bug this milestone fixes', () => {
  it('blocks booking finished goods while the piece is still on the bench', () => {
    // This is exactly the drift the two separate models allowed: the ledger could mark a job
    // Completed while the kanban still showed it at Casting.
    const j = job({ stage: 'Casting' });
    expect(canReceiveFinishedGoods(j)).toBe(false);
    expect(receiptBlockedReason(j)).toMatch(/still at Casting/i);
  });

  it('allows booking once the job reaches Completed', () => {
    const j = job({ stage: 'Completed' });
    expect(canReceiveFinishedGoods(j)).toBe(true);
    expect(receiptBlockedReason(j)).toBeNull();
  });

  it('blocks double-booking the same job', () => {
    const j = job({ stage: 'Completed', receiptStatus: 'Received' });
    expect(canReceiveFinishedGoods(j)).toBe(false);
    expect(receiptBlockedReason(j)).toMatch(/already been booked/i);
  });

  it('reports the already-booked reason ahead of the stage reason', () => {
    // A received job is definitionally complete; the useful message is the duplication one.
    const j = job({ stage: 'Polishing', receiptStatus: 'Received' });
    expect(receiptBlockedReason(j)).toMatch(/already been booked/i);
  });
});

describe('summariseJobWork', () => {
  it('summarises an empty board without dividing by zero', () => {
    const s = summariseJobWork([]);
    expect(s).toEqual({
      total: 0, onFloor: 0, urgent: 0, awaitingReceipt: 0,
      metalInProduction: 0, averageStageLoss: 0,
    });
  });

  it('counts only on-floor jobs toward metal in production', () => {
    const s = summariseJobWork([
      job({ id: 'a', stage: 'Casting', goldIssued: 10 }),
      job({ id: 'b', stage: 'Completed', goldIssued: 99 }),
    ]);
    expect(s.onFloor).toBe(1);
    expect(s.metalInProduction).toBe(10);
  });

  it('counts urgent and express jobs still on the floor', () => {
    const s = summariseJobWork([
      job({ id: 'a', priority: 'Urgent', stage: 'Filing' }),
      job({ id: 'b', priority: 'Express', stage: 'Setting' }),
      job({ id: 'c', priority: 'Normal', stage: 'Filing' }),
      job({ id: 'd', priority: 'Urgent', stage: 'Completed' }), // finished, not urgent any more
    ]);
    expect(s.urgent).toBe(2);
  });

  it('flags jobs finished on the floor but not yet booked to the ledger', () => {
    const s = summariseJobWork([
      job({ id: 'a', stage: 'Completed', receiptStatus: 'Pending' }),
      job({ id: 'b', stage: 'Completed', receiptStatus: 'Received' }),
      job({ id: 'c', stage: 'Polishing', receiptStatus: 'Pending' }),
    ]);
    expect(s.awaitingReceipt).toBe(1);
  });

  it('averages stage loss over jobs that actually recorded a loss', () => {
    const s = summariseJobWork([
      job({ id: 'a', metalLossRecorded: 0.1 }),
      job({ id: 'b', metalLossRecorded: 0.3 }),
      job({ id: 'c', metalLossRecorded: 0 }), // excluded from the average
    ]);
    expect(s.averageStageLoss).toBe(0.2);
  });
});

describe('nextJobNumber — one unified series replacing WO-/BAG-', () => {
  const now = new Date(2026, 6, 1);

  it('starts at 001 when there are no jobs', () => {
    expect(nextJobNumber([], now)).toBe('JOB-2026-001');
  });

  it('continues from the highest existing number, not the array length', () => {
    const jobs = [
      job({ jobNo: 'JOB-2026-001' }),
      job({ jobNo: 'JOB-2026-007' }),
      job({ jobNo: 'JOB-2026-003' }),
    ];
    expect(nextJobNumber(jobs, now)).toBe('JOB-2026-008');
  });

  it('ignores numbers from other years', () => {
    expect(nextJobNumber([job({ jobNo: 'JOB-2025-099' })], now)).toBe('JOB-2026-001');
  });

  it('is unaffected by legacy WO-/BAG- numbers', () => {
    const jobs = [job({ jobNo: 'WO-2026-005' }), job({ jobNo: 'BAG-2026-902' })];
    expect(nextJobNumber(jobs, now)).toBe('JOB-2026-001');
  });
});
