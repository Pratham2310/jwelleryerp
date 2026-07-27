// Unified Karigar Job-Work stage logic (Milestone 17).
//
// The production floor moves a job forward one stage at a time; it must not be possible to
// skip Hallmark, or to reopen a finished job, or to book finished goods against a job that
// hasn't reached the bench yet. Same enforcement discipline as the Tag and Old Gold lifecycles.

import type { JobWork, JobWorkStage } from '../types';

/** Ordered production pipeline. `Issued` is the state a job is in before work starts. */
export const STAGE_ORDER: JobWorkStage[] = [
  'Issued',
  'Casting',
  'Filing',
  'Setting',
  'Polishing',
  'Hallmark',
  'Completed',
];

/** Stages shown as columns on the kanban board (Issued jobs haven't hit the bench yet). */
export const BOARD_STAGES: JobWorkStage[] = STAGE_ORDER.filter(s => s !== 'Issued');

export const STAGE_LABEL: Record<JobWorkStage, string> = {
  Issued: 'Issued',
  Casting: 'Casting',
  Filing: 'Filing',
  Setting: 'Setting',
  Polishing: 'Polishing',
  Hallmark: 'Hallmark',
  Completed: 'Completed',
};

export function stageIndex(stage: JobWorkStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * Production only ever moves forward, one stage at a time. Allowing arbitrary jumps would let
 * a job reach Completed without passing Hallmark, which for gold jewellery is a compliance
 * step, not a formality (PRD §11).
 */
export function canAdvanceStage(from: JobWorkStage, to: JobWorkStage): boolean {
  const a = stageIndex(from);
  const b = stageIndex(to);
  if (a < 0 || b < 0) return false;
  return b === a + 1;
}

export function nextStage(from: JobWorkStage): JobWorkStage | null {
  const i = stageIndex(from);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1];
}

export function isOnFloor(job: JobWork): boolean {
  return job.stage !== 'Completed';
}

/**
 * Finished goods can only be booked back once the piece has actually been completed on the
 * floor, and only once. This is what previously allowed the two screens to disagree: the
 * ledger could mark a job "Completed" while the kanban still showed it at Casting.
 */
export function canReceiveFinishedGoods(job: JobWork): boolean {
  return job.stage === 'Completed' && job.receiptStatus === 'Pending';
}

export function receiptBlockedReason(job: JobWork): string | null {
  if (job.receiptStatus === 'Received') {
    return 'Finished goods for this job have already been booked against the karigar ledger.';
  }
  if (job.stage !== 'Completed') {
    return `This job is still at ${STAGE_LABEL[job.stage]} on the factory floor. Advance it through to Completed before booking finished goods.`;
  }
  return null;
}

export interface JobWorkSummary {
  total: number;
  onFloor: number;
  urgent: number;
  awaitingReceipt: number;
  metalInProduction: number; // gross grams issued for jobs still on the floor
  averageStageLoss: number;
}

export function summariseJobWork(jobs: JobWork[]): JobWorkSummary {
  const onFloor = jobs.filter(isOnFloor);
  const withLoss = jobs.filter(j => j.metalLossRecorded > 0);

  return {
    total: jobs.length,
    onFloor: onFloor.length,
    urgent: onFloor.filter(j => j.priority === 'Urgent' || j.priority === 'Express').length,
    awaitingReceipt: jobs.filter(j => j.stage === 'Completed' && j.receiptStatus === 'Pending').length,
    metalInProduction: Number(onFloor.reduce((s, j) => s + j.goldIssued, 0).toFixed(3)),
    averageStageLoss: withLoss.length
      ? Number((withLoss.reduce((s, j) => s + j.metalLossRecorded, 0) / withLoss.length).toFixed(3))
      : 0,
  };
}

/** Next job number in the unified JOB- series, replacing the old WO-/BAG- split. */
export function nextJobNumber(existing: JobWork[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `JOB-${year}-`;
  const highest = existing
    .map(j => j.jobNo)
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}
