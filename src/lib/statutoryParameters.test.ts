import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATUTORY_PARAMETERS,
  PARAMETER_DEFS,
  isPanRequiredFor,
  isTcsApplicable,
  tcsAmount,
  requiresCashTransactionReport,
  requiresSupervisorApproval,
  validateStatutoryParameters,
  verifySupervisorPin,
  validateSupervisor,
  DEFAULT_SUPERVISOR_PINS,
  validateApproval,
  buildApprovalRecord,
  summariseApprovals,
  APPROVAL_KIND_LABEL,
  type SupervisorPin,
} from './statutoryParameters';
import { PAN_THRESHOLD, isPanRequired } from './statutoryChecks';
import type { StatutoryParameters, ApprovalRecord } from '../types';

const params = (over: Partial<StatutoryParameters> = {}): StatutoryParameters => ({
  ...DEFAULT_STATUTORY_PARAMETERS, ...over,
});

const supervisors: SupervisorPin[] = [
  { roleName: 'Owner', supervisorName: 'Prathamesh S.', pin: '4821' },
  { roleName: 'Store Manager', supervisorName: 'Sharda M.', pin: '9930' },
];

describe('shipped defaults match the statute', () => {
  it('ships the Rule 114B figure and stays in step with statutoryChecks', () => {
    expect(DEFAULT_STATUTORY_PARAMETERS.panThreshold).toBe(200000);
    expect(DEFAULT_STATUTORY_PARAMETERS.panThreshold).toBe(PAN_THRESHOLD);
  });

  it('describes every parameter with the authority it comes from', () => {
    for (const d of PARAMETER_DEFS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.authority.length).toBeGreaterThan(0);
    }
  });
});

describe('thresholds are configurable, which is the point of the milestone', () => {
  it('PAN triggers at the configured figure, not a constant', () => {
    expect(isPanRequiredFor(150000, params({ panThreshold: 100000 }))).toBe(true);
    expect(isPanRequiredFor(150000, params({ panThreshold: 200000 }))).toBe(false);
  });

  it('is inclusive at the threshold, matching Rule 114B wording', () => {
    expect(isPanRequiredFor(200000, params())).toBe(true);
    expect(isPanRequiredFor(199999, params())).toBe(false);
  });

  it('agrees with the original hardcoded check at the default', () => {
    for (const amount of [0, 199999, 200000, 500000]) {
      expect(isPanRequiredFor(amount, params())).toBe(isPanRequired(amount));
    }
  });

  it('falls back to the statutory default when unconfigured — NEVER to zero', () => {
    // Falling back to zero would demand a PAN on every sale and stop the shop trading,
    // a worse failure than the one the check guards against.
    expect(isPanRequiredFor(1000, null)).toBe(false);
    expect(isPanRequiredFor(250000, null)).toBe(true);
  });

  it('ignores a nonsensical configured value and uses the default', () => {
    expect(isPanRequiredFor(1000, params({ panThreshold: 0 }))).toBe(false);
    expect(isPanRequiredFor(1000, params({ panThreshold: NaN }))).toBe(false);
  });
});

describe('TCS', () => {
  it('applies strictly above the threshold', () => {
    expect(isTcsApplicable(500000, params())).toBe(false);
    expect(isTcsApplicable(500001, params())).toBe(true);
  });

  it('computes at the configured rate', () => {
    expect(tcsAmount(600000, params())).toBe(6000);              // 1%
    expect(tcsAmount(600000, params({ tcsRatePercent: 0.5 }))).toBe(3000);
  });

  it('is zero below the threshold rather than a small number', () => {
    expect(tcsAmount(100000, params())).toBe(0);
  });
});

describe('PMLA cash reporting applies to CASH, not the invoice', () => {
  it('flags a large cash component', () => {
    expect(requiresCashTransactionReport(1000000, params())).toBe(true);
  });

  it('does NOT flag a large sale settled by bank', () => {
    // Flagging non-cash settlement would bury the genuine cases in noise.
    expect(requiresCashTransactionReport(0, params())).toBe(false);
  });

  it('honours a reconfigured threshold', () => {
    expect(requiresCashTransactionReport(600000, params({ pmlaCtrThreshold: 500000 }))).toBe(true);
  });
});

describe('supervisor approval threshold', () => {
  it('triggers strictly above the configured amount', () => {
    expect(requiresSupervisorApproval(25000, params())).toBe(false);
    expect(requiresSupervisorApproval(25001, params())).toBe(true);
  });

  it('uses magnitude, so a large negative adjustment still needs approval', () => {
    expect(requiresSupervisorApproval(-50000, params())).toBe(true);
  });
});

describe('validateStatutoryParameters', () => {
  it('accepts the shipped set', () => {
    expect(validateStatutoryParameters(params())).toBeNull();
  });

  it('rejects negative or non-numeric figures', () => {
    expect(validateStatutoryParameters(params({ tcsThreshold: -1 }))).toMatch(/positive number/i);
    expect(validateStatutoryParameters(params({ pmlaCtrThreshold: NaN }))).toMatch(/positive number/i);
  });

  it('rejects a percentage above 100', () => {
    expect(validateStatutoryParameters(params({ tcsRatePercent: 150 }))).toMatch(/cannot exceed 100/i);
  });

  it('refuses a zero PAN threshold and says what it would do', () => {
    expect(validateStatutoryParameters(params({ panThreshold: 0 })))
      .toMatch(/demand a declaration on every sale/i);
  });

  it('catches the likely transposition of PAN and TCS', () => {
    expect(validateStatutoryParameters(params({ tcsThreshold: 100000 })))
      .toMatch(/usually applies above the PAN threshold/i);
  });

  it('requires an effective date', () => {
    expect(validateStatutoryParameters(params({ effectiveFrom: '' }))).toMatch(/take effect from/i);
  });
});

describe('supervisor PIN', () => {
  it('accepts a known PIN', () => {
    expect(verifySupervisorPin('4821', supervisors)?.supervisorName).toBe('Prathamesh S.');
  });

  it('rejects an unknown or too-short PIN', () => {
    expect(verifySupervisorPin('0000', supervisors)).toBeNull();
    expect(verifySupervisorPin('12', supervisors)).toBeNull();
    expect(verifySupervisorPin('', supervisors)).toBeNull();
  });

  it('ignores surrounding whitespace', () => {
    expect(verifySupervisorPin('  4821  ', supervisors)).not.toBeNull();
  });
});

describe('validateSupervisor', () => {
  const approving = ['Owner', 'Store Manager'];
  const draft = { roleName: 'Owner', supervisorName: 'New Person', pin: '1357' };

  it('accepts a named supervisor on an approving role with a fresh PIN', () => {
    expect(validateSupervisor(draft, supervisors, approving)).toBeNull();
  });

  it('requires a person, because the log records a person and not a role', () => {
    expect(validateSupervisor({ ...draft, supervisorName: '  ' }, supervisors, approving))
      .toMatch(/records a person/i);
  });

  it('requires a 4-6 digit PIN', () => {
    expect(validateSupervisor({ ...draft, pin: '12' }, supervisors, approving)).toMatch(/4 to 6 digits/i);
    expect(validateSupervisor({ ...draft, pin: 'abcd' }, supervisors, approving)).toMatch(/4 to 6 digits/i);
  });

  it('refuses a role that cannot override a price in the first place', () => {
    expect(validateSupervisor({ ...draft, roleName: 'Counter Staff' }, supervisors, approving))
      .toMatch(/cannot override a price/i);
  });

  it('refuses a shared PIN, which would name the wrong approver', () => {
    expect(validateSupervisor({ ...draft, pin: '4821' }, supervisors, approving))
      .toMatch(/already belongs to Prathamesh S\./i);
  });

  it('lets an existing supervisor keep their own PIN while being edited', () => {
    expect(validateSupervisor(
      { roleName: 'Owner', supervisorName: 'Prathamesh S.', pin: '4821' }, supervisors, approving
    )).toBeNull();
  });

  it('ships defaults that pass their own validation', () => {
    for (const s of DEFAULT_SUPERVISOR_PINS) {
      expect(validateSupervisor(s, DEFAULT_SUPERVISOR_PINS, approving)).toBeNull();
    }
  });
});

describe('validateApproval', () => {
  const request = {
    kind: 'LARGE_DISCOUNT' as const, amount: 50000,
    reason: 'Wedding package, agreed with owner', requestedBy: 'Sharda M.',
  };

  it('accepts a reasoned request with a valid PIN from someone else', () => {
    expect(validateApproval(request, '4821', supervisors)).toBeNull();
  });

  it('requires a reason — it is what the audit trail keeps', () => {
    expect(validateApproval({ ...request, reason: 'no' }, '4821', supervisors))
      .toMatch(/what the audit trail keeps/i);
  });

  it('requires a PIN, and rejects an unrecognised one', () => {
    expect(validateApproval(request, '', supervisors)).toMatch(/enter the supervisor PIN/i);
    expect(validateApproval(request, '0000', supervisors)).toMatch(/not recognised/i);
  });

  it('REFUSES self-approval — that is the whole point of a second pair of eyes', () => {
    expect(validateApproval(request, '9930', supervisors))
      .toMatch(/cannot approve their own request/i);
  });

  it('is case-insensitive about matching the requester to the approver', () => {
    expect(validateApproval({ ...request, requestedBy: 'sharda m.' }, '9930', supervisors))
      .toMatch(/cannot approve their own/i);
  });
});

describe('buildApprovalRecord', () => {
  it('records who asked and who authorised, not just the role', () => {
    const rec = buildApprovalRecord(
      { kind: 'PRICE_OVERRIDE', amount: 30000, reason: 'Long-standing customer', requestedBy: 'Sharda M.' },
      supervisors[0],
      '2026-08-01T10:00:00.000Z'
    );
    expect(rec).toMatchObject({
      kind: 'PRICE_OVERRIDE', amount: 30000,
      requestedBy: 'Sharda M.', approvedBy: 'Prathamesh S.', approverRole: 'Owner',
    });
    expect(rec.approvedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('labels every approval kind', () => {
    expect(Object.keys(APPROVAL_KIND_LABEL)).toHaveLength(3);
  });
});

describe('summariseApprovals', () => {
  const rec = (over: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
    id: 'a1', kind: 'LARGE_DISCOUNT', amount: 50000, reason: 'r',
    requestedBy: 'S', approvedBy: 'P', approverRole: 'Owner', approvedAt: '2026-08-01', ...over,
  });

  it('summarises an empty log', () => {
    expect(summariseApprovals([])).toMatchObject({ total: 0, byKind: [], largestApproval: 0 });
  });

  it('groups by kind and reports the largest', () => {
    const s = summariseApprovals([
      rec(), rec({ id: 'a2', amount: 30000 }),
      rec({ id: 'a3', kind: 'PRICE_OVERRIDE', amount: 90000 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.largestApproval).toBe(90000);
    expect(s.byKind.find(k => k.kind === 'LARGE_DISCOUNT')).toMatchObject({ count: 2, value: 80000 });
  });

  it('omits kinds with no approvals rather than printing zero rows', () => {
    expect(summariseApprovals([rec()]).byKind).toHaveLength(1);
  });
});
