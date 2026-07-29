/**
 * Gold Savings Schemes — "Swarna Nidhi" (PRD §12, Handbook Phase 10, Milestone 26).
 *
 * The customer commits a fixed monthly instalment for a fixed tenure (commonly 11 months); at
 * maturity the shop adds a bonus (typically the 12th instalment free) and the accumulated value
 * is redeemed **against jewellery**. Before this milestone the app had one hardcoded scheme
 * expressed as three loose fields on `Customer`, with a mutable `savingsSchemeBalance` that
 * billing decremented directly.
 *
 * ─── Two rules that are not negotiable ────────────────────────────────────────────────
 *
 * 1. **No cash refund.** Under the Banning of Unregulated Deposit Schemes Act 2019, a jeweller
 *    taking money against future goods is on the right side of the line only while it stays a
 *    purchase advance. Paying it back as cash makes it a deposit, which an unregistered shop
 *    cannot lawfully accept. So redemption is jewellery-only and there is deliberately no
 *    cash-out function in this module — not a missing feature, an intentional absence
 *    (Handbook §1.6.1 / D-11).
 *
 * 2. **The balance is DERIVED, never stored.** It is folded from the append-only instalment
 *    receipts, the same way karigar balances (M16) and metal rates (M48) work. A stored balance
 *    cannot answer "which instalments make this up", which is exactly what a customer disputing
 *    their passbook asks — and this is money the shop genuinely owes, so it belongs on the
 *    balance sheet as a liability (PRD §12.4) rather than as a number someone can edit.
 *
 * The bonus is accrued **only at maturity and only when the tenure was fully paid**. Crediting it
 * earlier would overstate both the customer's balance and the shop's liability, and would let
 * someone collect the shop's contribution by paying one instalment and redeeming.
 */

import type {
  SavingsScheme,
  SchemeEnrollment,
  SchemeInstalment,
  SchemeEnrollmentStatus,
} from '../types';

/** Adds whole months, clamping the day so 31 Jan + 1 month lands on 28/29 Feb rather than 3 Mar. */
export function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** Whole months elapsed between two dates, never negative. */
export function monthsElapsed(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  if (to < from) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function maturityDate(enrollment: SchemeEnrollment, scheme: SavingsScheme): string {
  return addMonths(enrollment.startDate, scheme.tenureMonths);
}

/**
 * The shop's contribution at maturity (PRD §12.2 bonus types).
 *
 * `EXTRA_INSTALMENT` is the common Indian form — "pay 11, get the 12th free" — and is computed
 * from the enrolled instalment amount rather than from what was actually paid, because that is
 * what the customer was promised at enrolment.
 */
export function computeBonus(
  scheme: SavingsScheme,
  enrollment: SchemeEnrollment,
  principalPaid: number
): number {
  switch (scheme.bonusType) {
    case 'EXTRA_INSTALMENT':
      return Math.round(scheme.bonusValue * enrollment.installmentAmount);
    case 'PERCENTAGE':
      return Math.round(principalPaid * (scheme.bonusValue / 100));
    case 'NONE':
    default:
      return 0;
  }
}

export interface EnrollmentBalance {
  principalPaid: number;
  instalmentsPaid: number;
  /** How many instalments should have been paid by now, capped at the tenure. */
  instalmentsDue: number;
  instalmentsMissed: number;
  bonusAccrued: number;
  /** principal + bonus — what the customer can redeem against jewellery. */
  balance: number;
  isMatured: boolean;
  isFullyPaid: boolean;
  maturityDate: string;
  nextDueDate: string | null;
  /** Set when the tenure lapsed without the instalments being completed. */
  lapsed: boolean;
}

/**
 * Folds an enrollment's instalment receipts into its current position.
 *
 * `instalmentsDue` deliberately counts from the start date rather than from the last payment, so
 * a customer who stopped paying in month 3 of an 11-month scheme shows 8 missed rather than
 * appearing merely idle. That figure drives the collection-overdue report (PRD §12.4).
 */
export function deriveEnrollmentBalance(
  enrollment: SchemeEnrollment,
  scheme: SavingsScheme,
  instalments: SchemeInstalment[],
  today: string = new Date().toISOString().slice(0, 10)
): EnrollmentBalance {
  const mine = instalments.filter(i => i.enrollmentId === enrollment.id);
  const principalPaid = mine.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const instalmentsPaid = mine.length;

  const matures = maturityDate(enrollment, scheme);
  const isMatured = today >= matures;
  const isFullyPaid = instalmentsPaid >= scheme.tenureMonths;

  const elapsed = monthsElapsed(enrollment.startDate, today);
  // The first instalment is due on the start date itself, hence the +1.
  const instalmentsDue = Math.min(scheme.tenureMonths, elapsed + 1);
  const instalmentsMissed = Math.max(0, instalmentsDue - instalmentsPaid);

  // The shop's contribution is earned, not given: matured AND fully paid.
  const bonusAccrued = isMatured && isFullyPaid ? computeBonus(scheme, enrollment, principalPaid) : 0;

  const nextDueDate = isFullyPaid ? null : addMonths(enrollment.startDate, instalmentsPaid);

  return {
    principalPaid,
    instalmentsPaid,
    instalmentsDue,
    instalmentsMissed,
    bonusAccrued,
    balance: principalPaid + bonusAccrued,
    isMatured,
    isFullyPaid,
    maturityDate: matures,
    nextDueDate,
    lapsed: isMatured && !isFullyPaid,
  };
}

/** Redemption is allowed only once the scheme has matured AND been paid in full. */
export function canRedeem(balance: EnrollmentBalance, enrollment: SchemeEnrollment): boolean {
  if (enrollment.status !== 'Active' && enrollment.status !== 'Matured') return false;
  return balance.isMatured && balance.isFullyPaid;
}

export function redemptionBlockReason(
  balance: EnrollmentBalance,
  enrollment: SchemeEnrollment
): string | null {
  if (canRedeem(balance, enrollment)) return null;
  if (enrollment.status === 'Redeemed') return 'This enrollment has already been redeemed.';
  if (enrollment.status === 'Closed') return 'This enrollment was closed early.';
  if (!balance.isMatured) {
    return `Matures on ${balance.maturityDate}. Close it early instead if the customer cannot wait.`;
  }
  return `${balance.instalmentsMissed} instalment(s) unpaid — the bonus is only earned on a fully paid tenure.`;
}

export interface PrematureClosure {
  principalPaid: number;
  penalty: number;
  /** What the customer may still spend on jewellery. Never paid out in cash — see the header. */
  payableAsJewelleryCredit: number;
  forfeitedBonus: number;
}

/**
 * Early exit (PRD §12.2 "premature closure penalty rules").
 *
 * The bonus is forfeited outright — it is the shop's reward for the customer completing the
 * tenure — and a penalty is deducted from the principal. Even so the residue is returned as
 * jewellery credit, never as cash, for the reason in the module header.
 */
export function computePrematureClosure(
  scheme: SavingsScheme,
  enrollment: SchemeEnrollment,
  balance: EnrollmentBalance
): PrematureClosure {
  const penalty = Math.round(balance.principalPaid * (scheme.prematureClosurePenaltyPercent / 100));
  return {
    principalPaid: balance.principalPaid,
    penalty,
    payableAsJewelleryCredit: Math.max(0, balance.principalPaid - penalty),
    forfeitedBonus: computeBonus(scheme, enrollment, balance.principalPaid),
  };
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export function validateScheme(draft: Partial<SavingsScheme>, existing: SavingsScheme[] = []): string | null {
  if (!draft.name?.trim()) return 'Give the scheme a name.';
  if (!draft.schemeCode?.trim()) return 'A scheme code is required.';

  const tenure = Number(draft.tenureMonths);
  if (!Number.isInteger(tenure) || tenure < 1) return 'Tenure must be at least one month.';
  if (tenure > 120) return 'A tenure beyond 120 months is not a savings scheme.';

  const instalment = Number(draft.installmentAmount);
  if (!Number.isFinite(instalment) || instalment <= 0) return 'Enter the instalment amount.';

  const bonus = Number(draft.bonusValue);
  if (draft.bonusType !== 'NONE') {
    if (!Number.isFinite(bonus) || bonus < 0) return 'Enter a valid bonus value.';
    if (draft.bonusType === 'PERCENTAGE' && bonus > 100) {
      return 'A bonus above 100% would more than double the customer’s money — check the figure.';
    }
    if (draft.bonusType === 'EXTRA_INSTALMENT' && bonus > tenure) {
      return 'The free-instalment bonus cannot exceed the tenure itself.';
    }
  }

  const penalty = Number(draft.prematureClosurePenaltyPercent);
  if (!Number.isFinite(penalty) || penalty < 0 || penalty > 100) {
    return 'Premature closure penalty must be between 0 and 100%.';
  }

  if (existing.some(s => s.id !== draft.id && s.schemeCode.toLowerCase() === draft.schemeCode!.trim().toLowerCase())) {
    return `Scheme code ${draft.schemeCode.trim()} is already in use.`;
  }
  return null;
}

export function validateEnrollment(
  draft: Partial<SchemeEnrollment>,
  scheme: SavingsScheme | null,
  existing: SchemeEnrollment[] = []
): string | null {
  if (!draft.customerId) return 'Select the customer enrolling.';
  if (!scheme) return 'Select a scheme.';
  if (!scheme.isActive) return `${scheme.name} is no longer open for enrolment.`;
  if (!draft.startDate) return 'Set the start date.';

  const amount = Number(draft.installmentAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter the monthly instalment amount.';
  if (scheme.isFixedInstallment && amount !== scheme.installmentAmount) {
    return `${scheme.name} has a fixed instalment of ₹${scheme.installmentAmount.toLocaleString('en-IN')}.`;
  }
  if (!scheme.isFixedInstallment && amount < scheme.installmentAmount) {
    return `${scheme.name} has a minimum instalment of ₹${scheme.installmentAmount.toLocaleString('en-IN')}.`;
  }

  // One live enrollment per customer per scheme; a second would make the passbook ambiguous.
  const duplicate = existing.some(
    e => e.customerId === draft.customerId && e.schemeId === scheme.id &&
      (e.status === 'Active' || e.status === 'Matured')
  );
  if (duplicate) return 'This customer already has a live enrollment in that scheme.';
  return null;
}

export function validateInstalment(
  enrollment: SchemeEnrollment,
  scheme: SavingsScheme,
  balance: EnrollmentBalance,
  amount: number
): string | null {
  if (enrollment.status !== 'Active') {
    return `This enrollment is ${enrollment.status.toLowerCase()} — no further instalments can be taken.`;
  }
  if (balance.isFullyPaid) {
    return `All ${scheme.tenureMonths} instalments are already paid.`;
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 'Enter the amount received.';
  if (scheme.isFixedInstallment && value !== enrollment.installmentAmount) {
    return `This scheme takes a fixed ₹${enrollment.installmentAmount.toLocaleString('en-IN')} per instalment.`;
  }
  return null;
}

/* ─────────────────────────────── Numbering & reporting ─────────────────────────────── */

export function nextEnrollmentNumber(existing: SchemeEnrollment[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `SCH-${year}-`;
  const highest = existing
    .map(e => e.enrollmentNo)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

export function nextInstalmentReceiptNumber(existing: SchemeInstalment[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `SR-${year}-`;
  const highest = existing
    .map(i => i.receiptNo)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

export interface SchemeLiabilitySummary {
  activeEnrollments: number;
  maturedAwaitingRedemption: number;
  lapsedEnrollments: number;
  principalCollected: number;
  bonusAccrued: number;
  /** PRD §12.4: real money the shop owes in jewellery value — a balance-sheet figure. */
  totalLiability: number;
  overdueEnrollments: number;
  overdueAmount: number;
}

export function summariseSchemeLiability(
  enrollments: SchemeEnrollment[],
  schemes: SavingsScheme[],
  instalments: SchemeInstalment[],
  today: string = new Date().toISOString().slice(0, 10)
): SchemeLiabilitySummary {
  let principalCollected = 0, bonusAccrued = 0, activeEnrollments = 0;
  let maturedAwaitingRedemption = 0, lapsedEnrollments = 0, overdueEnrollments = 0, overdueAmount = 0;

  for (const enrollment of enrollments) {
    const scheme = schemes.find(s => s.id === enrollment.schemeId);
    if (!scheme) continue;
    // A redeemed or closed enrollment is settled — it is no longer a liability.
    if (enrollment.status === 'Redeemed' || enrollment.status === 'Closed') continue;

    const balance = deriveEnrollmentBalance(enrollment, scheme, instalments, today);
    principalCollected += balance.principalPaid;
    bonusAccrued += balance.bonusAccrued;

    if (balance.lapsed) lapsedEnrollments += 1;
    else if (balance.isMatured && balance.isFullyPaid) maturedAwaitingRedemption += 1;
    else activeEnrollments += 1;

    if (balance.instalmentsMissed > 0 && !balance.isFullyPaid) {
      overdueEnrollments += 1;
      overdueAmount += balance.instalmentsMissed * enrollment.installmentAmount;
    }
  }

  return {
    activeEnrollments,
    maturedAwaitingRedemption,
    lapsedEnrollments,
    principalCollected,
    bonusAccrued,
    totalLiability: principalCollected + bonusAccrued,
    overdueEnrollments,
    overdueAmount,
  };
}

export interface PassbookRow {
  installmentNo: number;
  date: string;
  particulars: string;
  amount: number;
  runningBalance: number;
}

/**
 * Printable passbook (Milestone 27). The bonus appears as its own final row rather than being
 * folded into the last instalment, because the customer needs to see the shop's contribution
 * stated separately — that is the whole selling point of the scheme.
 */
export function buildPassbook(
  enrollment: SchemeEnrollment,
  scheme: SavingsScheme,
  instalments: SchemeInstalment[],
  today: string = new Date().toISOString().slice(0, 10)
): PassbookRow[] {
  const mine = instalments
    .filter(i => i.enrollmentId === enrollment.id)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.installmentNo - b.installmentNo);

  let running = 0;
  const rows: PassbookRow[] = mine.map(i => {
    running += Number(i.amount) || 0;
    return {
      installmentNo: i.installmentNo,
      date: i.paidOn,
      particulars: `Instalment ${i.installmentNo} of ${scheme.tenureMonths} · ${i.mode} · ${i.receiptNo}`,
      amount: Number(i.amount) || 0,
      runningBalance: running,
    };
  });

  const balance = deriveEnrollmentBalance(enrollment, scheme, instalments, today);
  if (balance.bonusAccrued > 0) {
    running += balance.bonusAccrued;
    rows.push({
      installmentNo: scheme.tenureMonths + 1,
      date: balance.maturityDate,
      particulars: `Maturity bonus (${bonusLabel(scheme)}) credited by the shop`,
      amount: balance.bonusAccrued,
      runningBalance: running,
    });
  }
  return rows;
}

export function bonusLabel(scheme: SavingsScheme): string {
  switch (scheme.bonusType) {
    case 'EXTRA_INSTALMENT':
      return `${scheme.bonusValue} free instalment${scheme.bonusValue === 1 ? '' : 's'}`;
    case 'PERCENTAGE':
      return `${scheme.bonusValue}% of principal`;
    default:
      return 'No bonus';
  }
}

export const STATUS_LABEL: Record<SchemeEnrollmentStatus, string> = {
  Active: 'Active',
  Matured: 'Matured',
  Redeemed: 'Redeemed',
  Closed: 'Closed Early',
  Lapsed: 'Lapsed',
};

/**
 * The compliance line shown wherever a scheme balance is handled (Milestone 27, Handbook D-11).
 * Kept here rather than inline in a component so every surface states it identically.
 */
export const CASH_REFUND_BLOCK_NOTICE =
  'Redeemable against jewellery only. Under the Banning of Unregulated Deposit Schemes Act 2019, ' +
  'scheme collections are advances against future goods — refunding them in cash would make them ' +
  'deposits, which the shop is not registered to accept.';
