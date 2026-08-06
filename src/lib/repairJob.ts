/**
 * Repair & Service Jobs (Milestone 54, PRD §6.4).
 *
 * A customer brings in their own chain with a broken clasp. The shop takes it, repairs it — often
 * via a karigar — and gives it back. It is the most common counter interaction that the app could
 * not record at all.
 *
 * ─── The rule everything else hangs off: this is NOT stock ────────────────────────────
 * The piece belongs to the customer for the entire time it sits in the shop. It is **custody, not
 * inventory**. Booking it as stock would:
 *
 *   - overstate the balance sheet by the value of goods the shop does not own,
 *   - corrupt every weight-on-hand figure the owner reconciles daily (decision D-2),
 *   - and let someone sell a customer's chain, because sellable stock is defined by tag status.
 *
 * So a repair job **never creates a Tag**. It is its own record with its own lifecycle, and
 * `inventoryDashboard.ts` never sees it. This is the single mistake generic retail POS software
 * makes when asked to handle repairs, and it is expensive to unwind later.
 *
 * ─── Weight in must reconcile with weight out ─────────────────────────────────────────
 * A repair can legitimately add metal (solder, a replacement link) or remove it (filing, a removed
 * fitting). What it cannot do is lose metal silently. So delivery requires a weight-out reading,
 * and the difference is recorded as an explicit `metalAddedMg` / `metalRemovedMg` rather than
 * absorbed. An unexplained shortfall is where disputes and pilferage both live.
 */

import { roundMoney, roundWeight } from './money';

export type RepairStatus =
  | 'Received'
  | 'Assessed'
  | 'WithKarigar'
  | 'Ready'
  | 'Delivered'
  | 'ReturnedUnrepaired';

export const ALL_REPAIR_STATUSES: RepairStatus[] = [
  'Received', 'Assessed', 'WithKarigar', 'Ready', 'Delivered', 'ReturnedUnrepaired',
];

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  Received: 'Received',
  Assessed: 'Assessed & Quoted',
  WithKarigar: 'With Karigar',
  Ready: 'Ready for Collection',
  Delivered: 'Delivered',
  ReturnedUnrepaired: 'Returned Unrepaired',
};

/**
 * The lifecycle. `ReturnedUnrepaired` is reachable from anywhere before delivery, because a shop
 * can always decide a piece is not economically repairable and hand it straight back.
 */
const TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  Received: ['Assessed', 'ReturnedUnrepaired'],
  Assessed: ['WithKarigar', 'Ready', 'ReturnedUnrepaired'],
  WithKarigar: ['Ready', 'ReturnedUnrepaired'],
  Ready: ['Delivered', 'ReturnedUnrepaired'],
  Delivered: [],
  ReturnedUnrepaired: [],
};

/** Both end states are terminal: the piece has left the shop and is no longer in custody. */
export const TERMINAL_REPAIR_STATUSES: RepairStatus[] = ['Delivered', 'ReturnedUnrepaired'];

export function canTransitionRepair(from: RepairStatus, to: RepairStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextRepairStatuses(from: RepairStatus): RepairStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** True while the shop physically holds someone else's property. */
export function isInCustody(status: RepairStatus): boolean {
  return !TERMINAL_REPAIR_STATUSES.includes(status);
}

export interface RepairJob {
  id: string;
  jobNumber: string;
  receivedOn: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;

  itemDescription: string;
  metalType: string;
  /** As weighed at intake, in front of the customer. The number both sides agree on. */
  grossWeightInMg: number;
  reportedFault: string;

  quotedChargePaisa: number;
  promisedDate?: string;
  karigarId?: string;

  status: RepairStatus;

  /** Filled at delivery. */
  grossWeightOutMg?: number;
  metalAddedMg?: number;
  metalRemovedMg?: number;
  /** Metal the shop supplied is a sale of goods, separate from the labour charge. */
  metalChargePaisa?: number;
  finalChargePaisa?: number;
  deliveredOn?: string;
  deliveredBy?: string;

  branchId?: string;
  note?: string;
}

/* ─────────────────────────────── Intake ─────────────────────────────── */

export interface RepairIntake {
  customerName: string;
  customerPhone: string;
  itemDescription: string;
  metalType: string;
  grossWeightInMg: number;
  reportedFault: string;
  quotedChargePaisa: number;
  promisedDate?: string;
}

export function validateIntake(draft: Partial<RepairIntake>): string | null {
  if (!draft.customerName?.trim()) return 'Record who the piece belongs to.';
  if (!/^\d{10}$/.test((draft.customerPhone ?? '').replace(/\D/g, '').slice(-10))) {
    return 'A contactable phone number is required — the shop is holding their property.';
  }
  if (!draft.itemDescription?.trim()) {
    return 'Describe the piece as received, in enough detail to identify it later.';
  }
  if (!Number.isFinite(draft.grossWeightInMg) || (draft.grossWeightInMg ?? 0) <= 0) {
    // Weighed in front of the customer at intake; without it there is nothing to reconcile
    // against on the way out, and no defence in a dispute.
    return 'Weigh the piece at intake — there is nothing to reconcile against without it.';
  }
  if (!draft.reportedFault?.trim()) return 'Record the fault the customer reported.';
  if (!Number.isFinite(draft.quotedChargePaisa) || (draft.quotedChargePaisa ?? 0) < 0) {
    return 'Quote a charge, even if it is zero for a goodwill repair.';
  }
  return null;
}

export function buildRepairJob(
  intake: RepairIntake,
  jobNumber: string,
  receivedOn: string = new Date().toISOString().slice(0, 10),
  branchId?: string,
  customerId?: string
): RepairJob {
  return {
    id: `rep-${Date.now()}`,
    jobNumber,
    receivedOn,
    customerId,
    customerName: intake.customerName.trim(),
    customerPhone: intake.customerPhone.trim(),
    itemDescription: intake.itemDescription.trim(),
    metalType: intake.metalType,
    grossWeightInMg: Math.round(intake.grossWeightInMg),
    reportedFault: intake.reportedFault.trim(),
    quotedChargePaisa: roundMoney(intake.quotedChargePaisa),
    promisedDate: intake.promisedDate,
    status: 'Received',
    branchId,
  };
}

/* ─────────────────────────────── Delivery ─────────────────────────────── */

export interface DeliveryInput {
  grossWeightOutMg: number;
  metalChargePaisa: number;
  finalChargePaisa: number;
  deliveredBy: string;
}

/** Metal may be added or removed by a repair, but the difference must be stated, never absorbed. */
export function weightDifference(job: RepairJob, grossWeightOutMg: number): {
  addedMg: number;
  removedMg: number;
} {
  const diff = Math.round(grossWeightOutMg) - job.grossWeightInMg;
  return {
    addedMg: diff > 0 ? diff : 0,
    removedMg: diff < 0 ? -diff : 0,
  };
}

/** A shortfall beyond this is flagged rather than accepted silently. 50 mg on a repair is a lot. */
export const UNEXPLAINED_LOSS_TOLERANCE_MG = 50;

export function validateDelivery(job: RepairJob, input: Partial<DeliveryInput>): string | null {
  if (job.status !== 'Ready') {
    return `A job can only be delivered from Ready — this one is ${REPAIR_STATUS_LABEL[job.status]}.`;
  }
  if (!Number.isFinite(input.grossWeightOutMg) || (input.grossWeightOutMg ?? 0) <= 0) {
    return 'Weigh the piece before handing it back.';
  }
  if (!input.deliveredBy?.trim()) return 'Record who handed the piece over.';
  if (!Number.isFinite(input.finalChargePaisa) || (input.finalChargePaisa ?? 0) < 0) {
    return 'Record the final charge.';
  }

  const { removedMg } = weightDifference(job, input.grossWeightOutMg as number);
  if (removedMg > UNEXPLAINED_LOSS_TOLERANCE_MG) {
    return `The piece is ${(removedMg / 1000).toFixed(3)} g lighter than at intake. `
      + 'Record what was removed in the note before delivering, or re-weigh.';
  }
  return null;
}

export function applyDelivery(
  job: RepairJob,
  input: DeliveryInput,
  deliveredOn: string = new Date().toISOString().slice(0, 10)
): RepairJob {
  const { addedMg, removedMg } = weightDifference(job, input.grossWeightOutMg);
  return {
    ...job,
    status: 'Delivered',
    grossWeightOutMg: Math.round(input.grossWeightOutMg),
    metalAddedMg: addedMg,
    metalRemovedMg: removedMg,
    metalChargePaisa: roundMoney(input.metalChargePaisa),
    finalChargePaisa: roundMoney(input.finalChargePaisa),
    deliveredOn,
    deliveredBy: input.deliveredBy.trim(),
  };
}

export function applyStatus(job: RepairJob, to: RepairStatus): RepairJob {
  if (!canTransitionRepair(job.status, to)) return job;
  return { ...job, status: to };
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface CustodySummary {
  inCustody: number;
  custodyWeightMg: number;
  overdue: number;
  readyForCollection: number;
  withKarigar: number;
  deliveredThisPeriod: number;
  chargesCollectedPaisa: number;
}

/**
 * `custodyWeightMg` is deliberately reported as **weight of customer property held**, never as a
 * stock figure. It is a custody disclosure, not an asset — the whole point of M54.
 */
export function summariseCustody(
  jobs: RepairJob[],
  today: string = new Date().toISOString().slice(0, 10)
): CustodySummary {
  const held = jobs.filter(j => isInCustody(j.status));
  const delivered = jobs.filter(j => j.status === 'Delivered');

  return {
    inCustody: held.length,
    custodyWeightMg: held.reduce((s, j) => s + j.grossWeightInMg, 0),
    overdue: held.filter(j => !!j.promisedDate && j.promisedDate < today).length,
    readyForCollection: jobs.filter(j => j.status === 'Ready').length,
    withKarigar: jobs.filter(j => j.status === 'WithKarigar').length,
    deliveredThisPeriod: delivered.length,
    chargesCollectedPaisa: roundMoney(
      delivered.reduce((s, j) => s + (j.finalChargePaisa ?? 0) + (j.metalChargePaisa ?? 0), 0)
    ),
  };
}

export function isOverdue(job: RepairJob, today: string = new Date().toISOString().slice(0, 10)): boolean {
  return isInCustody(job.status) && !!job.promisedDate && job.promisedDate < today;
}

export function nextJobNumber(existing: RepairJob[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `REP-${year}-`;
  const highest = existing
    .filter(j => j.jobNumber.startsWith(prefix))
    .reduce((max, j) => Math.max(max, Number(j.jobNumber.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}

/** Grams for display. The store is milligrams (D-12); nothing downstream should re-derive this. */
export function toGrams(mg: number): number {
  return roundWeight(mg / 1000);
}
