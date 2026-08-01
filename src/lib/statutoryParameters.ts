/**
 * Statutory Parameters & Supervisor Approval (PRD §15.3, Handbook Phase 12, Milestones 33–34).
 *
 * ─── Why the thresholds cannot stay constants ─────────────────────────────────────────
 * PAN at ₹2,00,000 (Rule 114B), TCS, the PMLA cash-transaction report — these are *policy*, not
 * arithmetic. They move by notification, and when one does a shop must be able to comply the
 * same day rather than wait for a release. This is the same argument the Tax Master (M21) settled
 * for GST rates, and the same one the Rate Master (M48) settled for metal rates.
 *
 * `statutoryChecks.ts` keeps `PAN_THRESHOLD` as the shipped default so nothing that already
 * imports it breaks, but every check now takes the configured value when one is supplied. A
 * missing configuration falls back to the statutory figure rather than to zero — falling back to
 * zero would make PAN mandatory on every sale and stop the shop trading, which is a worse failure
 * than the one it was guarding against.
 *
 * ─── Why supervisor approval is not just a permission ─────────────────────────────────
 * Milestone 32 answers "may this person do it". This answers "was it authorised *this time*".
 * They are different questions: a manager may legitimately hold `billing.override` and still need
 * a second pair of eyes on a ₹50,000 discount. The approval is recorded with who gave it, so the
 * audit trail names a person rather than a role.
 */

import type { StatutoryParameters, ApprovalRecord, ApprovalKind } from '../types';
import { PAN_THRESHOLD } from './statutoryChecks';
import { roundMoney } from './money';

/** The figures in force as shipped. Editable at runtime — that is the whole point. */
export const DEFAULT_STATUTORY_PARAMETERS: StatutoryParameters = {
  panThreshold: PAN_THRESHOLD,          // Rule 114B
  tcsThreshold: 500000,                 // s.206C(1F)/(1H)
  tcsRatePercent: 1,
  pmlaCtrThreshold: 1000000,            // Cash Transaction Report
  /** Above this, an override or discount needs a supervisor's PIN (Milestone 33). */
  supervisorApprovalThreshold: 25000,
  effectiveFrom: '2026-04-01',
};

export interface ParameterDef {
  key: keyof StatutoryParameters;
  label: string;
  /** The statute or rule it comes from, so an accountant can check it against the source. */
  authority: string;
  unit: 'money' | 'percent' | 'date';
}

export const PARAMETER_DEFS: ParameterDef[] = [
  { key: 'panThreshold', label: 'PAN / Form 60 mandatory at', authority: 'Income Tax Rule 114B', unit: 'money' },
  { key: 'tcsThreshold', label: 'TCS applies above', authority: 'Income Tax s.206C(1F)/(1H)', unit: 'money' },
  { key: 'tcsRatePercent', label: 'TCS rate', authority: 'Income Tax s.206C', unit: 'percent' },
  { key: 'pmlaCtrThreshold', label: 'Cash Transaction Report at', authority: 'PMLA', unit: 'money' },
  { key: 'supervisorApprovalThreshold', label: 'Supervisor approval needed above', authority: 'Shop policy', unit: 'money' },
];

/* ─────────────────────────────── Threshold checks ─────────────────────────────── */

/** A missing configuration falls back to the statutory default, never to zero. */
function threshold(params: StatutoryParameters | null, key: keyof StatutoryParameters): number {
  const configured = Number(params?.[key]);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : Number(DEFAULT_STATUTORY_PARAMETERS[key]) || 0;
}

export function isPanRequiredFor(total: number, params: StatutoryParameters | null): boolean {
  return roundMoney(total) >= threshold(params, 'panThreshold');
}

export function isTcsApplicable(total: number, params: StatutoryParameters | null): boolean {
  return roundMoney(total) > threshold(params, 'tcsThreshold');
}

export function tcsAmount(total: number, params: StatutoryParameters | null): number {
  if (!isTcsApplicable(total, params)) return 0;
  const rate = Number(params?.tcsRatePercent ?? DEFAULT_STATUTORY_PARAMETERS.tcsRatePercent) || 0;
  return roundMoney((roundMoney(total) * rate) / 100);
}

/**
 * PMLA Cash Transaction Report flag. Applies to the CASH component only — a ₹15,00,000 sale
 * settled by bank transfer is not a cash transaction, and flagging it would bury the genuine
 * cases in noise.
 */
export function requiresCashTransactionReport(
  cashAmount: number, params: StatutoryParameters | null
): boolean {
  return roundMoney(cashAmount) >= threshold(params, 'pmlaCtrThreshold');
}

export function requiresSupervisorApproval(
  amount: number, params: StatutoryParameters | null
): boolean {
  return roundMoney(Math.abs(amount)) > threshold(params, 'supervisorApprovalThreshold');
}

export function validateStatutoryParameters(draft: Partial<StatutoryParameters>): string | null {
  for (const def of PARAMETER_DEFS) {
    const value = Number(draft[def.key]);
    if (!Number.isFinite(value) || value < 0) {
      return `${def.label} must be a positive number.`;
    }
    if (def.unit === 'percent' && value > 100) {
      return `${def.label} cannot exceed 100%.`;
    }
  }

  // A PAN threshold of zero would make a declaration mandatory on every sale and stop the shop
  // trading — a worse failure than the one the check exists to prevent.
  if (Number(draft.panThreshold) === 0) {
    return 'A PAN threshold of zero would demand a declaration on every sale. Enter the notified figure.';
  }

  if (Number(draft.tcsThreshold) < Number(draft.panThreshold)) {
    // Not illegal, but almost always a transposition — TCS bites above PAN in practice.
    return 'TCS usually applies above the PAN threshold, not below it. Check the two figures.';
  }

  if (!draft.effectiveFrom) return 'Set the date these figures take effect from.';
  return null;
}

/* ─────────────────────────────── Supervisor approval ─────────────────────────────── */

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  PRICE_OVERRIDE: 'Price override',
  LARGE_DISCOUNT: 'Large discount',
  INVOICE_CANCELLATION: 'Invoice cancellation',
};

/**
 * Verifies a supervisor PIN.
 *
 * The PIN is compared against roles that hold the approving permission, so authority comes from
 * the permission matrix rather than a second list that could drift out of step with it. In a
 * frontend-only build the PIN lives in `localStorage` like everything else — it establishes
 * *who authorised this*, not secrecy, and the module header says so.
 */
export interface SupervisorPin {
  roleName: string;
  supervisorName: string;
  pin: string;
}

export function verifySupervisorPin(
  pin: string,
  supervisors: SupervisorPin[]
): SupervisorPin | null {
  const entered = (pin || '').trim();
  if (entered.length < 4) return null;
  return supervisors.find(s => s.pin === entered) ?? null;
}

/** Seeded so a fresh install can approve something on day one. Editable on the admin screen. */
export const DEFAULT_SUPERVISOR_PINS: SupervisorPin[] = [
  { roleName: 'Owner', supervisorName: 'Prathamesh S.', pin: '4821' },
  { roleName: 'Store Manager', supervisorName: 'Sharda M.', pin: '9930' },
];

export const SUPERVISOR_PIN_NOTICE =
  'PINs are stored in this browser like the rest of the data. They establish who authorised a '
  + 'transaction for the audit trail — they are not a security boundary until there is a server.';

/**
 * A supervisor must hold a role that can actually override a price, otherwise the approval says
 * nothing: someone without the authority signing off is not a second pair of eyes, it is a
 * signature. Two supervisors sharing a PIN would make the log name the wrong person, so PINs are
 * unique.
 */
export function validateSupervisor(
  draft: SupervisorPin,
  existing: SupervisorPin[],
  approvingRoleNames: string[]
): string | null {
  if (!draft.supervisorName.trim()) {
    return 'Name the supervisor — the log records a person, not a role.';
  }
  if (!/^\d{4,6}$/.test((draft.pin || '').trim())) {
    return 'The PIN must be 4 to 6 digits.';
  }
  if (!approvingRoleNames.some(r => r.toLowerCase() === draft.roleName.trim().toLowerCase())) {
    return `${draft.roleName || 'That role'} cannot override a price, so it cannot approve one. Grant the permission first.`;
  }
  const clash = existing.find(
    s => s.pin === draft.pin.trim() && s.supervisorName !== draft.supervisorName
  );
  if (clash) {
    return `That PIN already belongs to ${clash.supervisorName}. A shared PIN would name the wrong approver.`;
  }
  return null;
}

export interface ApprovalRequest {
  kind: ApprovalKind;
  amount: number;
  reason: string;
  requestedBy: string;
}

export function validateApproval(
  request: ApprovalRequest,
  pin: string,
  supervisors: SupervisorPin[]
): string | null {
  if ((request.reason ?? '').trim().length < 5) {
    return 'Record why this needs approval — the reason is what the audit trail keeps.';
  }
  if (!(pin || '').trim()) return 'Enter the supervisor PIN.';

  const supervisor = verifySupervisorPin(pin, supervisors);
  if (!supervisor) return 'That PIN was not recognised.';

  // Self-approval defeats the purpose: the whole point is a second pair of eyes.
  if (supervisor.supervisorName.trim().toLowerCase() === request.requestedBy.trim().toLowerCase()) {
    return 'A supervisor cannot approve their own request — that is what the second pair of eyes is for.';
  }
  return null;
}

export function buildApprovalRecord(
  request: ApprovalRequest,
  supervisor: SupervisorPin,
  at: string = new Date().toISOString()
): ApprovalRecord {
  return {
    id: `apr-${Date.now()}`,
    kind: request.kind,
    amount: roundMoney(request.amount),
    reason: request.reason.trim(),
    requestedBy: request.requestedBy,
    approvedBy: supervisor.supervisorName,
    approverRole: supervisor.roleName,
    approvedAt: at,
  };
}

export interface ApprovalSummary {
  total: number;
  byKind: { kind: ApprovalKind; count: number; value: number }[];
  largestApproval: number;
}

export function summariseApprovals(records: ApprovalRecord[]): ApprovalSummary {
  const kinds: ApprovalKind[] = ['PRICE_OVERRIDE', 'LARGE_DISCOUNT', 'INVOICE_CANCELLATION'];
  return {
    total: records.length,
    byKind: kinds
      .map(kind => {
        const list = records.filter(r => r.kind === kind);
        return { kind, count: list.length, value: roundMoney(list.reduce((s, r) => s + r.amount, 0)) };
      })
      .filter(r => r.count > 0),
    largestApproval: records.reduce((max, r) => Math.max(max, r.amount), 0),
  };
}
