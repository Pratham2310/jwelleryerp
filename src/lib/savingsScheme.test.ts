import { describe, it, expect } from 'vitest';
import {
  addMonths,
  monthsElapsed,
  maturityDate,
  computeBonus,
  deriveEnrollmentBalance,
  canRedeem,
  redemptionBlockReason,
  computePrematureClosure,
  validateScheme,
  validateEnrollment,
  validateInstalment,
  nextEnrollmentNumber,
  nextInstalmentReceiptNumber,
  summariseSchemeLiability,
  buildPassbook,
  bonusLabel,
  CASH_REFUND_BLOCK_NOTICE,
} from './savingsScheme';
import type { SavingsScheme, SchemeEnrollment, SchemeInstalment } from '../types';

function scheme(over: Partial<SavingsScheme> = {}): SavingsScheme {
  return {
    id: 'sch-1', schemeCode: 'SN11', name: 'Swarna Nidhi 11+1',
    tenureMonths: 11, bonusType: 'EXTRA_INSTALMENT', bonusValue: 1,
    installmentAmount: 5000, isFixedInstallment: true,
    redemptionRule: 'JEWELLERY_ONLY', prematureClosurePenaltyPercent: 10,
    isActive: true, ...over,
  };
}

function enrollment(over: Partial<SchemeEnrollment> = {}): SchemeEnrollment {
  return {
    id: 'en-1', enrollmentNo: 'SCH-2026-001', customerId: 'cust-1', schemeId: 'sch-1',
    startDate: '2026-01-15', installmentAmount: 5000, status: 'Active', ...over,
  };
}

/** n instalments paid on the due date each month. */
function paid(n: number, amount = 5000, start = '2026-01-15'): SchemeInstalment[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i}`, enrollmentId: 'en-1', installmentNo: i + 1, amount,
    paidOn: addMonths(start, i), mode: 'Cash' as const, receiptNo: `SR-2026-000${i + 1}`,
  }));
}

describe('date helpers', () => {
  it('adds months', () => {
    expect(addMonths('2026-01-15', 11)).toBe('2026-12-15');
    expect(addMonths('2026-01-15', 0)).toBe('2026-01-15');
  });

  it('clamps a short month instead of rolling into the next one', () => {
    // 31 Jan + 1 month must be 28 Feb, not 3 March.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap year
  });

  it('counts whole elapsed months only', () => {
    expect(monthsElapsed('2026-01-15', '2026-03-14')).toBe(1); // a day short of 2
    expect(monthsElapsed('2026-01-15', '2026-03-15')).toBe(2);
    expect(monthsElapsed('2026-03-15', '2026-01-15')).toBe(0); // never negative
  });
});

describe('computeBonus (PRD §12.2)', () => {
  it('gives the free instalment at the ENROLLED amount, which is what was promised', () => {
    expect(computeBonus(scheme(), enrollment(), 55000)).toBe(5000);
    expect(computeBonus(scheme({ bonusValue: 2 }), enrollment(), 55000)).toBe(10000);
  });

  it('computes a percentage bonus off the principal actually paid', () => {
    expect(computeBonus(scheme({ bonusType: 'PERCENTAGE', bonusValue: 8 }), enrollment(), 55000)).toBe(4400);
  });

  it('gives nothing for a no-bonus scheme', () => {
    expect(computeBonus(scheme({ bonusType: 'NONE', bonusValue: 0 }), enrollment(), 55000)).toBe(0);
  });

  it('labels each bonus type for display', () => {
    expect(bonusLabel(scheme())).toBe('1 free instalment');
    expect(bonusLabel(scheme({ bonusValue: 2 }))).toBe('2 free instalments');
    expect(bonusLabel(scheme({ bonusType: 'PERCENTAGE', bonusValue: 8 }))).toBe('8% of principal');
    expect(bonusLabel(scheme({ bonusType: 'NONE' }))).toBe('No bonus');
  });
});

describe('deriveEnrollmentBalance — the balance is folded, never stored', () => {
  it('sums the instalments actually received', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(3), '2026-04-15');
    expect(b.principalPaid).toBe(15000);
    expect(b.instalmentsPaid).toBe(3);
    expect(b.balance).toBe(15000);
  });

  it('withholds the bonus until maturity, even when fully paid', () => {
    // Crediting early would overstate both the customer's balance and the shop's liability.
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(11), '2026-11-15');
    expect(b.isFullyPaid).toBe(true);
    expect(b.isMatured).toBe(false);
    expect(b.bonusAccrued).toBe(0);
    expect(b.balance).toBe(55000);
  });

  it('credits the bonus once matured AND fully paid', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(11), '2026-12-15');
    expect(b.isMatured).toBe(true);
    expect(b.bonusAccrued).toBe(5000);
    expect(b.balance).toBe(60000);
  });

  it('withholds the bonus from a matured but under-paid scheme', () => {
    // Otherwise someone could pay one instalment, wait, and collect the shop's contribution.
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(4), '2026-12-15');
    expect(b.isMatured).toBe(true);
    expect(b.isFullyPaid).toBe(false);
    expect(b.bonusAccrued).toBe(0);
    expect(b.balance).toBe(20000);
    expect(b.lapsed).toBe(true);
  });

  it('counts dues from the start date, so a customer who stopped shows as missed not idle', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(3), '2026-08-15');
    expect(b.instalmentsDue).toBe(8);
    expect(b.instalmentsMissed).toBe(5);
  });

  it('never counts more dues than the tenure', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(2), '2030-01-01');
    expect(b.instalmentsDue).toBe(11);
    expect(b.instalmentsMissed).toBe(9);
  });

  it('treats the first instalment as due on the start date itself', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), [], '2026-01-15');
    expect(b.instalmentsDue).toBe(1);
    expect(b.instalmentsMissed).toBe(1);
  });

  it('points at the next due date and drops it once fully paid', () => {
    expect(deriveEnrollmentBalance(enrollment(), scheme(), paid(3), '2026-04-15').nextDueDate).toBe('2026-04-15');
    expect(deriveEnrollmentBalance(enrollment(), scheme(), paid(11), '2026-12-15').nextDueDate).toBeNull();
  });

  it('handles an enrollment with no instalments at all', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), [], '2026-01-15');
    expect(b.principalPaid).toBe(0);
    expect(b.balance).toBe(0);
  });

  it('ignores instalments belonging to another enrollment', () => {
    const others: SchemeInstalment[] = [{
      id: 'x', enrollmentId: 'en-OTHER', installmentNo: 1, amount: 99999,
      paidOn: '2026-02-15', mode: 'Cash', receiptNo: 'SR-2026-9999',
    }];
    expect(deriveEnrollmentBalance(enrollment(), scheme(), [...paid(2), ...others], '2026-03-15').principalPaid)
      .toBe(10000);
  });
});

describe('redemption gating', () => {
  it('allows redemption on a matured, fully-paid scheme', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(11), '2026-12-15');
    expect(canRedeem(b, enrollment())).toBe(true);
    expect(redemptionBlockReason(b, enrollment())).toBeNull();
  });

  it('refuses before maturity and says when it matures', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(11), '2026-11-15');
    expect(canRedeem(b, enrollment())).toBe(false);
    expect(redemptionBlockReason(b, enrollment())).toMatch(/Matures on 2026-12-15/);
  });

  it('refuses a matured scheme with unpaid instalments and says how many', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(9), '2026-12-15');
    expect(redemptionBlockReason(b, enrollment())).toMatch(/2 instalment\(s\) unpaid/);
  });

  it('refuses an already-settled enrollment', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(11), '2026-12-15');
    expect(redemptionBlockReason(b, enrollment({ status: 'Redeemed' }))).toMatch(/already been redeemed/i);
    expect(redemptionBlockReason(b, enrollment({ status: 'Closed' }))).toMatch(/closed early/i);
  });
});

describe('premature closure', () => {
  it('forfeits the bonus and deducts the penalty from principal', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(5), '2026-06-15');
    const c = computePrematureClosure(scheme(), enrollment(), b);
    expect(c.principalPaid).toBe(25000);
    expect(c.penalty).toBe(2500); // 10%
    expect(c.payableAsJewelleryCredit).toBe(22500);
    expect(c.forfeitedBonus).toBe(5000);
  });

  it('returns the residue as jewellery credit — never as cash', () => {
    // The BUIDS Act line: a refund in cash turns an advance into a deposit.
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(5), '2026-06-15');
    const c = computePrematureClosure(scheme(), enrollment(), b);
    expect(c).toHaveProperty('payableAsJewelleryCredit');
    expect(c).not.toHaveProperty('cashRefund');
    expect(CASH_REFUND_BLOCK_NOTICE).toMatch(/Banning of Unregulated Deposit Schemes Act 2019/);
    expect(CASH_REFUND_BLOCK_NOTICE).toMatch(/jewellery only/i);
  });

  it('never goes negative on a 100% penalty', () => {
    const b = deriveEnrollmentBalance(enrollment(), scheme(), paid(2), '2026-03-15');
    expect(computePrematureClosure(scheme({ prematureClosurePenaltyPercent: 100 }), enrollment(), b)
      .payableAsJewelleryCredit).toBe(0);
  });
});

describe('validateScheme', () => {
  it('accepts a well-formed scheme', () => {
    expect(validateScheme(scheme())).toBeNull();
  });

  it('requires a name, code, tenure and instalment', () => {
    expect(validateScheme({ ...scheme(), name: '' })).toMatch(/name/i);
    expect(validateScheme({ ...scheme(), schemeCode: '' })).toMatch(/code is required/i);
    expect(validateScheme({ ...scheme(), tenureMonths: 0 })).toMatch(/at least one month/i);
    expect(validateScheme({ ...scheme(), installmentAmount: 0 })).toMatch(/instalment amount/i);
  });

  it('rejects an implausible tenure', () => {
    expect(validateScheme({ ...scheme(), tenureMonths: 240 })).toMatch(/not a savings scheme/i);
  });

  it('rejects a bonus that exceeds the tenure or doubles the money', () => {
    expect(validateScheme({ ...scheme(), bonusValue: 12 })).toMatch(/cannot exceed the tenure/i);
    expect(validateScheme({ ...scheme(), bonusType: 'PERCENTAGE', bonusValue: 150 })).toMatch(/more than double/i);
  });

  it('does not police the bonus value on a no-bonus scheme', () => {
    expect(validateScheme({ ...scheme(), bonusType: 'NONE', bonusValue: 999 })).toBeNull();
  });

  it('rejects an out-of-range closure penalty', () => {
    expect(validateScheme({ ...scheme(), prematureClosurePenaltyPercent: 150 })).toMatch(/between 0 and 100/i);
  });

  it('rejects a duplicate scheme code', () => {
    expect(validateScheme({ ...scheme(), id: 'new' }, [scheme()])).toMatch(/already in use/i);
  });
});

describe('validateEnrollment', () => {
  const s = scheme();

  it('accepts a well-formed enrollment', () => {
    expect(validateEnrollment(enrollment(), s, [])).toBeNull();
  });

  it('requires a customer, scheme and start date', () => {
    expect(validateEnrollment({ ...enrollment(), customerId: '' }, s, [])).toMatch(/select the customer/i);
    expect(validateEnrollment(enrollment(), null, [])).toMatch(/select a scheme/i);
    expect(validateEnrollment({ ...enrollment(), startDate: '' }, s, [])).toMatch(/start date/i);
  });

  it('refuses enrolment into a closed scheme', () => {
    expect(validateEnrollment(enrollment(), scheme({ isActive: false }), [])).toMatch(/no longer open/i);
  });

  it('enforces a fixed instalment exactly', () => {
    expect(validateEnrollment({ ...enrollment(), installmentAmount: 4000 }, s, [])).toMatch(/fixed instalment/i);
    expect(validateEnrollment({ ...enrollment(), installmentAmount: 6000 }, s, [])).toMatch(/fixed instalment/i);
  });

  it('enforces a minimum on a flexible scheme but allows more', () => {
    const flex = scheme({ isFixedInstallment: false });
    expect(validateEnrollment({ ...enrollment(), installmentAmount: 4000 }, flex, [])).toMatch(/minimum instalment/i);
    expect(validateEnrollment({ ...enrollment(), installmentAmount: 9000 }, flex, [])).toBeNull();
  });

  it('refuses a second live enrollment in the same scheme', () => {
    // Two live enrollments would make the passbook ambiguous.
    expect(validateEnrollment({ ...enrollment(), id: 'new' }, s, [enrollment()])).toMatch(/already has a live enrollment/i);
  });

  it('allows re-enrolling once the previous one is settled', () => {
    expect(validateEnrollment({ ...enrollment(), id: 'new' }, s, [enrollment({ status: 'Redeemed' })])).toBeNull();
  });
});

describe('validateInstalment', () => {
  const s = scheme();

  it('accepts a due instalment', () => {
    const b = deriveEnrollmentBalance(enrollment(), s, paid(3), '2026-04-15');
    expect(validateInstalment(enrollment(), s, b, 5000)).toBeNull();
  });

  it('refuses once the tenure is fully paid', () => {
    const b = deriveEnrollmentBalance(enrollment(), s, paid(11), '2026-12-15');
    expect(validateInstalment(enrollment(), s, b, 5000)).toMatch(/already paid/i);
  });

  it('refuses against a settled enrollment', () => {
    const b = deriveEnrollmentBalance(enrollment(), s, paid(3), '2026-04-15');
    expect(validateInstalment(enrollment({ status: 'Redeemed' }), s, b, 5000)).toMatch(/redeemed/i);
  });

  it('enforces the fixed amount', () => {
    const b = deriveEnrollmentBalance(enrollment(), s, paid(3), '2026-04-15');
    expect(validateInstalment(enrollment(), s, b, 4000)).toMatch(/fixed/i);
  });

  it('requires a positive amount', () => {
    const b = deriveEnrollmentBalance(enrollment(), s, paid(3), '2026-04-15');
    expect(validateInstalment(enrollment(), s, b, 0)).toMatch(/amount received/i);
  });
});

describe('numbering', () => {
  const now = new Date(2026, 0, 15);
  it('allocates enrollment numbers from the highest, not a count', () => {
    expect(nextEnrollmentNumber([], now)).toBe('SCH-2026-001');
    expect(nextEnrollmentNumber([enrollment({ enrollmentNo: 'SCH-2026-009' })], now)).toBe('SCH-2026-010');
  });

  it('allocates receipt numbers on their own series', () => {
    expect(nextInstalmentReceiptNumber([], now)).toBe('SR-2026-0001');
    expect(nextInstalmentReceiptNumber(paid(3), now)).toBe('SR-2026-0004');
  });
});

describe('summariseSchemeLiability (PRD §12.4 — a balance-sheet figure)', () => {
  const s = scheme();

  it('summarises an empty book', () => {
    expect(summariseSchemeLiability([], [], [])).toMatchObject({ totalLiability: 0, activeEnrollments: 0 });
  });

  it('totals principal plus accrued bonus as the shop’s liability', () => {
    const l = summariseSchemeLiability([enrollment()], [s], paid(11), '2026-12-15');
    expect(l.principalCollected).toBe(55000);
    expect(l.bonusAccrued).toBe(5000);
    expect(l.totalLiability).toBe(60000);
    expect(l.maturedAwaitingRedemption).toBe(1);
  });

  it('drops a redeemed enrollment — it is settled, not owed', () => {
    const l = summariseSchemeLiability([enrollment({ status: 'Redeemed' })], [s], paid(11), '2026-12-15');
    expect(l.totalLiability).toBe(0);
  });

  it('reports overdue collections separately from liability', () => {
    const l = summariseSchemeLiability([enrollment()], [s], paid(3), '2026-08-15');
    expect(l.overdueEnrollments).toBe(1);
    expect(l.overdueAmount).toBe(25000); // 5 missed x 5000
    expect(l.totalLiability).toBe(15000); // still only what was actually collected
  });

  it('counts a lapsed enrollment apart from an active one', () => {
    const l = summariseSchemeLiability([enrollment()], [s], paid(4), '2027-06-15');
    expect(l.lapsedEnrollments).toBe(1);
    expect(l.activeEnrollments).toBe(0);
  });

  it('skips an enrollment whose scheme no longer exists rather than crashing', () => {
    expect(summariseSchemeLiability([enrollment()], [], paid(3)).totalLiability).toBe(0);
  });
});

describe('buildPassbook (Milestone 27)', () => {
  it('produces a running balance per instalment', () => {
    const rows = buildPassbook(enrollment(), scheme(), paid(3), '2026-04-15');
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.runningBalance)).toEqual([5000, 10000, 15000]);
    expect(rows[0].particulars).toMatch(/Instalment 1 of 11/);
  });

  it('states the shop’s bonus as its own final row', () => {
    // Folding it into the last instalment would hide the scheme's whole selling point.
    const rows = buildPassbook(enrollment(), scheme(), paid(11), '2026-12-15');
    expect(rows).toHaveLength(12);
    expect(rows[11].particulars).toMatch(/Maturity bonus \(1 free instalment\)/);
    expect(rows[11].amount).toBe(5000);
    expect(rows[11].runningBalance).toBe(60000);
  });

  it('shows no bonus row before it is earned', () => {
    expect(buildPassbook(enrollment(), scheme(), paid(11), '2026-11-15')).toHaveLength(11);
  });

  it('is empty for an enrollment with no receipts', () => {
    expect(buildPassbook(enrollment(), scheme(), [], '2026-01-15')).toEqual([]);
  });
});
