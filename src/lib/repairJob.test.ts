import { describe, it, expect } from 'vitest';
import {
  ALL_REPAIR_STATUSES,
  TERMINAL_REPAIR_STATUSES,
  UNEXPLAINED_LOSS_TOLERANCE_MG,
  canTransitionRepair,
  nextRepairStatuses,
  isInCustody,
  validateIntake,
  buildRepairJob,
  weightDifference,
  validateDelivery,
  applyDelivery,
  applyStatus,
  summariseCustody,
  isOverdue,
  nextJobNumber,
  toGrams,
  type RepairJob,
  type RepairIntake,
} from './repairJob';

const intake = (over: Partial<RepairIntake> = {}): RepairIntake => ({
  customerName: 'Shrutika D.',
  customerPhone: '9876543210',
  itemDescription: '22K chain, broken clasp, 18 inch',
  metalType: 'Gold (22K)',
  grossWeightInMg: 24650,
  reportedFault: 'Clasp snapped at the spring ring',
  quotedChargePaisa: 80000,
  ...over,
});

const job = (over: Partial<RepairJob> = {}): RepairJob => ({
  ...buildRepairJob(intake(), 'REP-2026-1', '2026-08-01'),
  ...over,
});

describe('lifecycle', () => {
  it('starts in custody at Received', () => {
    expect(buildRepairJob(intake(), 'REP-2026-1').status).toBe('Received');
    expect(isInCustody('Received')).toBe(true);
  });

  it('walks the normal path', () => {
    expect(canTransitionRepair('Received', 'Assessed')).toBe(true);
    expect(canTransitionRepair('Assessed', 'WithKarigar')).toBe(true);
    expect(canTransitionRepair('WithKarigar', 'Ready')).toBe(true);
    expect(canTransitionRepair('Ready', 'Delivered')).toBe(true);
  });

  it('allows an in-house repair to skip the karigar', () => {
    expect(canTransitionRepair('Assessed', 'Ready')).toBe(true);
  });

  it('can hand the piece back unrepaired from any stage before delivery', () => {
    for (const s of ['Received', 'Assessed', 'WithKarigar', 'Ready'] as const) {
      expect(canTransitionRepair(s, 'ReturnedUnrepaired')).toBe(true);
    }
  });

  it('has exactly two terminal states, and both mean the piece has left', () => {
    const terminal = ALL_REPAIR_STATUSES.filter(s => nextRepairStatuses(s).length === 0);
    expect(terminal.sort()).toEqual([...TERMINAL_REPAIR_STATUSES].sort());
    for (const s of TERMINAL_REPAIR_STATUSES) expect(isInCustody(s)).toBe(false);
  });

  it('refuses to skip straight from Received to Delivered', () => {
    expect(canTransitionRepair('Received', 'Delivered')).toBe(false);
  });

  it('cannot resurrect a delivered job', () => {
    expect(canTransitionRepair('Delivered', 'Ready')).toBe(false);
    expect(applyStatus(job({ status: 'Delivered' }), 'Ready').status).toBe('Delivered');
  });
});

describe('validateIntake', () => {
  it('accepts a properly recorded intake', () => {
    expect(validateIntake(intake())).toBeNull();
  });

  it('REQUIRES a weight at intake — there is nothing to reconcile against without one', () => {
    expect(validateIntake(intake({ grossWeightInMg: 0 }))).toMatch(/nothing to reconcile/i);
  });

  it('requires a contactable number, because the shop is holding their property', () => {
    expect(validateIntake(intake({ customerPhone: '123' }))).toMatch(/holding their property/i);
  });

  it('requires an identifying description and the reported fault', () => {
    expect(validateIntake(intake({ itemDescription: ' ' }))).toMatch(/describe the piece/i);
    expect(validateIntake(intake({ reportedFault: '' }))).toMatch(/fault/i);
  });

  it('allows a zero quote for a goodwill repair', () => {
    expect(validateIntake(intake({ quotedChargePaisa: 0 }))).toBeNull();
  });

  it('refuses a negative quote', () => {
    expect(validateIntake(intake({ quotedChargePaisa: -1 }))).toMatch(/quote a charge/i);
  });
});

describe('weight reconciliation', () => {
  it('reports metal added when the piece comes back heavier', () => {
    expect(weightDifference(job(), 24800)).toEqual({ addedMg: 150, removedMg: 0 });
  });

  it('reports metal removed when it comes back lighter', () => {
    expect(weightDifference(job(), 24600)).toEqual({ addedMg: 0, removedMg: 50 });
  });

  it('reports neither when the weight is unchanged', () => {
    expect(weightDifference(job(), 24650)).toEqual({ addedMg: 0, removedMg: 0 });
  });
});

describe('validateDelivery', () => {
  const ready = job({ status: 'Ready' });
  const good = { grossWeightOutMg: 24700, metalChargePaisa: 12000, finalChargePaisa: 80000, deliveredBy: 'Sharda M.' };

  it('accepts a properly weighed delivery', () => {
    expect(validateDelivery(ready, good)).toBeNull();
  });

  it('refuses delivery from any state but Ready', () => {
    expect(validateDelivery(job({ status: 'WithKarigar' }), good)).toMatch(/only be delivered from Ready/i);
  });

  it('REFUSES to hand the piece back without weighing it', () => {
    expect(validateDelivery(ready, { ...good, grossWeightOutMg: 0 })).toMatch(/weigh the piece/i);
  });

  it('FLAGS an unexplained shortfall rather than absorbing it', () => {
    // Metal that vanishes between intake and delivery is where disputes and pilferage live.
    const short = { ...good, grossWeightOutMg: 24650 - (UNEXPLAINED_LOSS_TOLERANCE_MG + 100) };
    expect(validateDelivery(ready, short)).toMatch(/lighter than at intake/i);
  });

  it('tolerates a small loss from filing and polishing', () => {
    expect(validateDelivery(ready, { ...good, grossWeightOutMg: 24650 - 20 })).toBeNull();
  });

  it('requires who handed it over', () => {
    expect(validateDelivery(ready, { ...good, deliveredBy: ' ' })).toMatch(/who handed/i);
  });
});

describe('applyDelivery', () => {
  const ready = job({ status: 'Ready' });

  it('records the weight out and what changed', () => {
    const done = applyDelivery(ready, {
      grossWeightOutMg: 24800, metalChargePaisa: 12000,
      finalChargePaisa: 80000, deliveredBy: 'Sharda M.',
    }, '2026-08-05');
    expect(done).toMatchObject({
      status: 'Delivered', grossWeightOutMg: 24800, metalAddedMg: 150,
      metalRemovedMg: 0, deliveredOn: '2026-08-05',
    });
  });

  it('keeps the metal charge separate from the labour charge', () => {
    // Metal the shop supplied is a sale of goods; the repair itself is a service. They are
    // taxed differently and must not be merged into one figure.
    const done = applyDelivery(ready, {
      grossWeightOutMg: 24800, metalChargePaisa: 12000,
      finalChargePaisa: 80000, deliveredBy: 'S',
    });
    expect(done.metalChargePaisa).toBe(12000);
    expect(done.finalChargePaisa).toBe(80000);
  });

  it('preserves the intake weight, so the record stays auditable', () => {
    const done = applyDelivery(ready, {
      grossWeightOutMg: 24800, metalChargePaisa: 0, finalChargePaisa: 0, deliveredBy: 'S',
    });
    expect(done.grossWeightInMg).toBe(24650);
  });
});

describe('summariseCustody — a disclosure, never a stock figure', () => {
  const jobs = [
    job({ id: 'a', status: 'Received' }),
    job({ id: 'b', status: 'WithKarigar' }),
    job({ id: 'c', status: 'Ready' }),
    job({ id: 'd', status: 'Delivered', finalChargePaisa: 80000, metalChargePaisa: 12000 }),
    job({ id: 'e', status: 'ReturnedUnrepaired' }),
  ];

  it('counts only pieces still physically held', () => {
    const s = summariseCustody(jobs, '2026-08-10');
    expect(s.inCustody).toBe(3);
  });

  it('totals the weight of CUSTOMER property held, excluding what has left', () => {
    expect(summariseCustody(jobs, '2026-08-10').custodyWeightMg).toBe(24650 * 3);
  });

  it('counts what is ready and what is out with a karigar', () => {
    const s = summariseCustody(jobs, '2026-08-10');
    expect(s.readyForCollection).toBe(1);
    expect(s.withKarigar).toBe(1);
  });

  it('totals charges collected across metal and labour', () => {
    expect(summariseCustody(jobs, '2026-08-10').chargesCollectedPaisa).toBe(92000);
  });

  it('handles an empty register', () => {
    expect(summariseCustody([], '2026-08-10')).toMatchObject({ inCustody: 0, custodyWeightMg: 0 });
  });
});

describe('overdue', () => {
  it('flags a promised date that has passed while still in custody', () => {
    expect(isOverdue(job({ status: 'Ready', promisedDate: '2026-08-01' }), '2026-08-05')).toBe(true);
  });

  it('does NOT flag a delivered job, however late it was', () => {
    expect(isOverdue(job({ status: 'Delivered', promisedDate: '2026-08-01' }), '2026-08-05')).toBe(false);
  });

  it('does not flag a job with no promised date', () => {
    expect(isOverdue(job({ status: 'Ready', promisedDate: undefined }), '2026-08-05')).toBe(false);
  });

  it('counts overdue jobs in the summary', () => {
    const s = summariseCustody([
      job({ id: 'a', status: 'Ready', promisedDate: '2026-08-01' }),
      job({ id: 'b', status: 'Ready', promisedDate: '2026-08-20' }),
    ], '2026-08-05');
    expect(s.overdue).toBe(1);
  });
});

describe('nextJobNumber & toGrams', () => {
  const at = new Date('2026-08-04');

  it('starts at 1 and continues from the highest, never the count', () => {
    expect(nextJobNumber([], at)).toBe('REP-2026-1');
    expect(nextJobNumber([{ jobNumber: 'REP-2026-7' }] as RepairJob[], at)).toBe('REP-2026-8');
  });

  it('ignores another year', () => {
    expect(nextJobNumber([{ jobNumber: 'REP-2025-99' }] as RepairJob[], at)).toBe('REP-2026-1');
  });

  it('converts milligrams to grams for display', () => {
    expect(toGrams(24650)).toBe(24.65);
  });
});
