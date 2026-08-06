import { describe, it, expect } from 'vitest';
import {
  MEMO_KYC_THRESHOLD_PAISA,
  canIssueFrom,
  memoStatus,
  outstandingLines,
  valueAtRisk,
  isMemoOverdue,
  daysOverdue,
  declaredValueOf,
  validateMemo,
  buildMemo,
  applyIssue,
  settleLine,
  applyReturn,
  summariseMemos,
  memoConversionRate,
  nextMemoNumber,
  type MemoVoucher,
  type MemoDraft,
} from './memoOut';
import type { Tag } from '../types';

const RATE = 665000; // ₹6,650/g in paisa
const rateFor = () => RATE;

const tag = (over: Partial<Tag> = {}): Tag => ({
  id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
  metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 0,
  makingChargeType: 'flat', makingChargeValue: 0, stoneType: 'None', stoneWeight: 0,
  stoneCharge: 0, stockOwnershipType: 'OWNED', status: 'InStock',
  ...over,
} as Tag);

const draft = (over: Partial<MemoDraft> = {}): MemoDraft => ({
  tagIds: ['t1'],
  customerName: 'Shrutika D.',
  customerPhone: '9876543210',
  dueBackDate: '2026-08-10',
  issuedBy: 'Sharda M.',
  ...over,
});

const memo = (over: Partial<MemoVoucher> = {}): MemoVoucher => ({
  ...buildMemo(draft(), [tag()], rateFor, 'MEMO-2026-1', '2026-08-01'),
  ...over,
});

describe('what can go out on memo', () => {
  it('allows sellable stock', () => {
    expect(canIssueFrom('InStock')).toBe(true);
    expect(canIssueFrom('InShowcase')).toBe(true);
  });

  it('refuses anything not sellable — it has to be in the building', () => {
    for (const s of ['MemoOut', 'Sold', 'OutForJobwork', 'TransferInTransit', 'DamagedOrMelted'] as const) {
      expect(canIssueFrom(s)).toBe(false);
    }
  });
});

describe('status is derived from the lines, never stored', () => {
  const twoLines = buildMemo(draft({ tagIds: ['t1', 't2'] }),
    [tag(), tag({ id: 't2', sku: 'RNG-002' })], rateFor, 'M', '2026-08-01');

  it('is Issued while everything is out', () => {
    expect(memoStatus(twoLines)).toBe('Issued');
  });

  it('is PartiallySettled when some has come back', () => {
    expect(memoStatus(settleLine(twoLines, 't1', 'RETURNED'))).toBe('PartiallySettled');
  });

  it('is Closed once every line is settled, however it settled', () => {
    const done = settleLine(settleLine(twoLines, 't1', 'RETURNED'), 't2', 'SOLD');
    expect(memoStatus(done)).toBe('Closed');
  });
});

describe('value at risk', () => {
  it('counts only what is still out', () => {
    const m = memo();
    expect(valueAtRisk(m)).toBe(10 * RATE);
    expect(valueAtRisk(settleLine(m, 't1', 'RETURNED'))).toBe(0);
  });

  it('values metal, stones and making', () => {
    const rich = tag({ stoneCharge: 20000, makingChargeType: 'flat', makingChargeValue: 5000 });
    expect(declaredValueOf([rich], rateFor)).toBe(10 * RATE + 2000000 + 500000);
  });

  it('handles a per-gram making charge', () => {
    const perGram = tag({ makingChargeType: 'per-gram', makingChargeValue: 500 });
    expect(declaredValueOf([perGram], rateFor)).toBe(10 * RATE + 500 * 100 * 10);
  });
});

describe('overdue', () => {
  it('flags an outstanding memo past its date', () => {
    expect(isMemoOverdue(memo({ dueBackDate: '2026-08-01' }), '2026-08-05')).toBe(true);
    expect(daysOverdue(memo({ dueBackDate: '2026-08-01' }), '2026-08-05')).toBe(4);
  });

  it('does NOT flag a memo whose pieces have all come back', () => {
    const closed = settleLine(memo({ dueBackDate: '2026-08-01' }), 't1', 'RETURNED');
    expect(isMemoOverdue(closed, '2026-08-05')).toBe(false);
    expect(daysOverdue(closed, '2026-08-05')).toBe(0);
  });

  it('is not overdue before the due date', () => {
    expect(isMemoOverdue(memo({ dueBackDate: '2026-08-10' }), '2026-08-05')).toBe(false);
  });
});

describe('validateMemo', () => {
  const tags = [tag()];
  const value = 10 * RATE;   // ₹66,500 — under the KYC threshold

  it('accepts a properly recorded memo', () => {
    expect(validateMemo(draft(), tags, [], value)).toBeNull();
  });

  it('REQUIRES a due-back date, or nothing is ever overdue', () => {
    // Without one the piece quietly becomes shrinkage instead of an exception.
    expect(validateMemo(draft({ dueBackDate: '' }), tags, [], value))
      .toMatch(/nothing is ever overdue/i);
  });

  it('requires a contactable number and who authorised it', () => {
    expect(validateMemo(draft({ customerPhone: '12' }), tags, [], value)).toMatch(/leaving the building/i);
    expect(validateMemo(draft({ issuedBy: ' ' }), tags, [], value)).toMatch(/who authorised/i);
  });

  it('refuses a piece that is not sellable stock', () => {
    expect(validateMemo(draft(), [tag({ status: 'Sold' })], [], value)).toMatch(/cannot go out on memo/i);
  });

  it('REFUSES a piece already out on another memo', () => {
    const open = [memo()];
    expect(validateMemo(draft(), tags, open, value)).toMatch(/already out on another memo/i);
  });

  it('allows a piece whose earlier memo is settled', () => {
    const closed = [settleLine(memo(), 't1', 'RETURNED')];
    expect(validateMemo(draft(), tags, closed, value)).toBeNull();
  });

  it('DEMANDS a KYC reference above the threshold', () => {
    // Handing over lakhs of gold against a phone number is not a controlled risk.
    expect(validateMemo(draft(), tags, [], MEMO_KYC_THRESHOLD_PAISA))
      .toMatch(/record a PAN or ID reference/i);
  });

  it('accepts a high-value memo once an ID is on file', () => {
    expect(validateMemo(draft({ kycReference: 'ABCDE1234F' }), tags, [], MEMO_KYC_THRESHOLD_PAISA))
      .toBeNull();
  });

  it('does not demand KYC below the threshold', () => {
    expect(validateMemo(draft(), tags, [], MEMO_KYC_THRESHOLD_PAISA - 1)).toBeNull();
  });
});

describe('applying to tags — always through the state machine', () => {
  it('moves issued pieces to MemoOut', () => {
    expect(applyIssue(memo(), [tag()])[0].status).toBe('MemoOut');
  });

  it('leaves pieces outside the memo alone', () => {
    const after = applyIssue(memo(), [tag(), tag({ id: 't9', sku: 'X' })]);
    expect(after[1].status).toBe('InStock');
  });

  it('never forces an illegal transition', () => {
    expect(applyIssue(memo(), [tag({ status: 'Sold' })])[0].status).toBe('Sold');
  });

  it('returns a piece to InStock, not straight to the showcase', () => {
    // It needs checking before it goes back on display; the state machine allows that next.
    expect(applyReturn('t1', [tag({ status: 'MemoOut' })])[0].status).toBe('InStock');
  });

  it('does not disturb a tag that is not the one returned', () => {
    const after = applyReturn('t1', [tag({ id: 't2', status: 'MemoOut' })]);
    expect(after[0].status).toBe('MemoOut');
  });
});

describe('settleLine', () => {
  it('settles only the named line, and only if still out', () => {
    const m = buildMemo(draft({ tagIds: ['t1', 't2'] }),
      [tag(), tag({ id: 't2', sku: 'RNG-002' })], rateFor, 'M');
    const once = settleLine(m, 't1', 'SOLD', '2026-08-03');
    expect(once.lines[0]).toMatchObject({ outcome: 'SOLD', settledOn: '2026-08-03' });
    expect(once.lines[1].outcome).toBe('OUT');
  });

  it('does not re-settle an already settled line', () => {
    const m = settleLine(memo(), 't1', 'RETURNED', '2026-08-03');
    expect(settleLine(m, 't1', 'SOLD', '2026-08-09').lines[0]).toMatchObject({
      outcome: 'RETURNED', settledOn: '2026-08-03',
    });
  });
});

describe('summariseMemos', () => {
  const memos = [
    memo({ id: 'm1', dueBackDate: '2026-08-01' }),                                  // overdue, out
    settleLine(memo({ id: 'm2' }), 't1', 'SOLD'),                                   // closed, sold
    settleLine(memo({ id: 'm3' }), 't1', 'RETURNED'),                               // closed, returned
  ];

  it('counts open memos and pieces still out', () => {
    const s = summariseMemos(memos, '2026-08-05');
    expect(s.openMemos).toBe(1);
    expect(s.piecesOut).toBe(1);
  });

  it('reports value at risk and the overdue slice of it', () => {
    const s = summariseMemos(memos, '2026-08-05');
    expect(s.valueAtRiskPaisa).toBe(10 * RATE);
    expect(s.overdueMemos).toBe(1);
    expect(s.overdueValuePaisa).toBe(10 * RATE);
  });

  it('counts pieces that converted to a sale', () => {
    expect(summariseMemos(memos, '2026-08-05').convertedToSale).toBe(1);
  });

  it('handles an empty register', () => {
    expect(summariseMemos([], '2026-08-05')).toMatchObject({ openMemos: 0, valueAtRiskPaisa: 0 });
  });

  it('computes the conversion rate over settled lines only', () => {
    // One sold, one returned — 50%. The number that says whether the risk is earning its keep.
    expect(memoConversionRate(memos)).toBe(50);
  });

  it('returns zero conversion when nothing has settled yet', () => {
    expect(memoConversionRate([memo()])).toBe(0);
  });
});

describe('nextMemoNumber', () => {
  const at = new Date('2026-08-06');

  it('starts at 1 and continues from the highest', () => {
    expect(nextMemoNumber([], at)).toBe('MEMO-2026-1');
    expect(nextMemoNumber([{ memoNumber: 'MEMO-2026-4' }] as MemoVoucher[], at)).toBe('MEMO-2026-5');
  });
});
