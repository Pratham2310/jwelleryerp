import { describe, it, expect } from 'vitest';
import {
  normaliseHuid,
  isValidHuidFormat,
  isHuidUnique,
  validateHuidAssignment,
  canTransitionBatch,
  isBatchSettled,
  nextBatchNumber,
  validateDispatchDraft,
  assessPurityVariance,
  resolveBatchStatus,
  validateReceipt,
  summariseBatches,
  PURITY_TOLERANCE_PERCENT,
} from './hallmarking';
import { canTransition } from './tagStateMachine';
import type { Tag, HallmarkBatch, HallmarkBatchStatus, HallmarkResult } from '../types';

function tag(over: Partial<Tag> = {}): Tag {
  return {
    id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
    metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 3,
    makingChargeType: 'per-gram', makingChargeValue: 400, stoneType: 'None',
    stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED',
    status: 'PendingHallmark', branchId: 'br-1', ...over,
  };
}

function batch(over: Partial<HallmarkBatch> = {}): HallmarkBatch {
  return {
    id: 'b1', batchNo: 'AHC-2026-001', ahcName: 'Zaveri AHC',
    tagIds: ['t1'], status: 'AtAHC', dispatchedOn: '2026-07-29', ...over,
  };
}

describe('HUID format (PRD §11.1 — 6-character alphanumeric)', () => {
  it('accepts a valid code and uppercases it', () => {
    expect(isValidHuidFormat('A1B2C3')).toBe(true);
    expect(isValidHuidFormat('a1b2c3')).toBe(true);
    expect(normaliseHuid('  a1b2c3 ')).toBe('A1B2C3');
  });

  it('rejects anything that is not exactly six alphanumerics', () => {
    expect(isValidHuidFormat('A1B2C')).toBe(false);
    expect(isValidHuidFormat('A1B2C34')).toBe(false);
    expect(isValidHuidFormat('A1B2C-')).toBe(false);
    expect(isValidHuidFormat('')).toBe(false);
  });
});

describe('HUID uniqueness — a HUID can never be reused', () => {
  const tags = [tag({ id: 't1', huid: 'A1B2C3' }), tag({ id: 't2', huid: 'D4E5F6' })];

  it('detects a collision against any existing tag', () => {
    expect(isHuidUnique('A1B2C3', tags)).toBe(false);
    expect(isHuidUnique('ZZ9999', tags)).toBe(true);
  });

  it('is case-insensitive, so lowercase entry cannot slip a duplicate through', () => {
    expect(isHuidUnique('a1b2c3', tags)).toBe(false);
  });

  it('lets a tag keep its own HUID on re-save', () => {
    expect(isHuidUnique('A1B2C3', tags, 't1')).toBe(true);
  });

  it('rejects assignment of a HUID already on the books', () => {
    // Reuse is what a substituted or diverted piece looks like in the data.
    expect(validateHuidAssignment('A1B2C3', tags, 't9')).toMatch(/never be reused/i);
  });

  it('catches two pieces in the SAME batch sharing a HUID', () => {
    // Neither is persisted yet, so a tag-level check alone would miss this.
    const pending = ['ZZ1111', 'ZZ1111'];
    expect(validateHuidAssignment('ZZ1111', tags, 't3', pending)).toMatch(/twice in this batch/i);
  });

  it('accepts a genuinely new, well-formed HUID', () => {
    expect(validateHuidAssignment('ZZ1111', tags, 't3', ['ZZ1111'])).toBeNull();
  });

  it('requires a HUID at all', () => {
    expect(validateHuidAssignment('', tags, 't3')).toMatch(/enter the huid/i);
  });
});

describe('batch lifecycle', () => {
  const legal: [HallmarkBatchStatus, HallmarkBatchStatus][] = [
    ['Draft', 'AtAHC'],
    ['AtAHC', 'Received'],
    ['AtAHC', 'PartiallyReceived'],
  ];
  it.each(legal)('allows %s -> %s', (a, b) => expect(canTransitionBatch(a, b)).toBe(true));

  const illegal: [HallmarkBatchStatus, HallmarkBatchStatus][] = [
    ['Draft', 'Received'], // the goods must physically go to the AHC first
    ['Received', 'AtAHC'], // a settled batch is never reopened
    ['PartiallyReceived', 'Received'],
    ['AtAHC', 'Draft'],
    ['AtAHC', 'AtAHC'],
  ];
  it.each(illegal)('blocks %s -> %s', (a, b) => expect(canTransitionBatch(a, b)).toBe(false));

  it('treats both landed outcomes as settled', () => {
    expect(isBatchSettled('Received')).toBe(true);
    expect(isBatchSettled('PartiallyReceived')).toBe(true);
    expect(isBatchSettled('AtAHC')).toBe(false);
  });
});

describe('a failed piece has somewhere legal to go (Milestone 24 state-machine edge)', () => {
  it('returns to the shop for rework rather than being melted', () => {
    // Before M24 the only exits from PendingHallmark were Hallmarked or DamagedOrMelted, which
    // would have forced melting down a rectifiable piece and destroyed the evidence.
    expect(canTransition('PendingHallmark', 'ReceivedFromKarigar')).toBe(true);
    expect(canTransition('PendingHallmark', 'Hallmarked')).toBe(true);
  });

  it('can be re-submitted for hallmarking after rework', () => {
    expect(canTransition('ReceivedFromKarigar', 'PendingHallmark')).toBe(true);
  });

  it('still cannot skip straight to sellable stock from the AHC', () => {
    expect(canTransition('PendingHallmark', 'InStock')).toBe(false);
    expect(canTransition('PendingHallmark', 'Sold')).toBe(false);
  });
});

describe('nextBatchNumber', () => {
  const now = new Date(2026, 6, 29);
  it('starts at 001', () => expect(nextBatchNumber([], now)).toBe('AHC-2026-001'));

  it('continues from the highest, not the array length', () => {
    const list = [batch({ batchNo: 'AHC-2026-001' }), batch({ batchNo: 'AHC-2026-014' })];
    expect(nextBatchNumber(list, now)).toBe('AHC-2026-015');
  });

  it('ignores other years', () => {
    expect(nextBatchNumber([batch({ batchNo: 'AHC-2025-099' })], now)).toBe('AHC-2026-001');
  });
});

describe('validateDispatchDraft', () => {
  const tags = [
    tag({ id: 't1', sku: 'A-1', status: 'PendingHallmark' }),
    tag({ id: 't2', sku: 'B-2', status: 'InStock' }),
    tag({ id: 't3', sku: 'C-3', status: 'PendingHallmark', huid: 'A1B2C3' }),
  ];

  it('accepts a well-formed dispatch', () => {
    expect(validateDispatchDraft({ ahcName: 'Zaveri AHC', tagIds: ['t1'] }, tags)).toBeNull();
  });

  it('requires an AHC and at least one piece', () => {
    expect(validateDispatchDraft({ tagIds: ['t1'] }, tags)).toMatch(/assaying/i);
    expect(validateDispatchDraft({ ahcName: 'Zaveri AHC', tagIds: [] }, tags)).toMatch(/at least one/i);
  });

  it('refuses a piece that is not awaiting hallmarking', () => {
    expect(validateDispatchDraft({ ahcName: 'Zaveri AHC', tagIds: ['t2'] }, tags))
      .toMatch(/not awaiting hallmarking/i);
  });

  it('refuses a piece that already carries a HUID', () => {
    // Re-hallmarking an already-marked piece would mint a second HUID for one ornament.
    expect(validateDispatchDraft({ ahcName: 'Zaveri AHC', tagIds: ['t3'] }, tags))
      .toMatch(/already carries HUID/i);
  });

  it('refuses an unknown id', () => {
    expect(validateDispatchDraft({ ahcName: 'Zaveri AHC', tagIds: ['ghost'] }, tags))
      .toMatch(/could not be found/i);
  });
});

describe('assessPurityVariance — certified vs declared (PRD §11.2 step 3)', () => {
  it('passes a piece certified at its declared fineness', () => {
    const v = assessPurityVariance('Gold (22K)', 91.6);
    expect(v.severity).toBe('MATCH');
    expect(v.requiresReview).toBe(false);
    expect(v.message).toBeNull();
  });

  it('tolerates assay measurement noise', () => {
    expect(assessPurityVariance('Gold (22K)', 91.6 - PURITY_TOLERANCE_PERCENT).severity).toBe('MATCH');
    expect(assessPurityVariance('Gold (22K)', 91.6 + PURITY_TOLERANCE_PERCENT).severity).toBe('MATCH');
  });

  it('flags a shortfall for review — the shop was about to sell under-karat gold', () => {
    const v = assessPurityVariance('Gold (22K)', 90.5);
    expect(v.severity).toBe('SHORTFALL');
    expect(v.requiresReview).toBe(true);
    expect(v.variance).toBeCloseTo(-1.1, 3);
    expect(v.message).toMatch(/karigar/i);
  });

  it('notes over-delivery without treating it as an integrity question', () => {
    // The shop gave away metal it did not charge for: a margin leak, not a fraud signal.
    const v = assessPurityVariance('Gold (22K)', 93);
    expect(v.severity).toBe('OVER_DELIVERED');
    expect(v.requiresReview).toBe(false);
    expect(v.message).toMatch(/gave away metal/i);
  });

  it('compares against the right declared purity per metal', () => {
    expect(assessPurityVariance('Gold (18K)', 75).severity).toBe('MATCH');
    expect(assessPurityVariance('Gold (18K)', 91.6).severity).toBe('OVER_DELIVERED');
    expect(assessPurityVariance('Gold (24K)', 91.6).severity).toBe('SHORTFALL');
  });
});

describe('resolveBatchStatus', () => {
  it('is Received when every piece passed', () => {
    expect(resolveBatchStatus([
      { tagId: 'a', outcome: 'PASSED' }, { tagId: 'b', outcome: 'PASSED' },
    ])).toBe('Received');
  });

  it('is PartiallyReceived when any piece failed', () => {
    expect(resolveBatchStatus([
      { tagId: 'a', outcome: 'PASSED' }, { tagId: 'b', outcome: 'FAILED' },
    ])).toBe('PartiallyReceived');
  });

  it('is PartiallyReceived when everything failed', () => {
    expect(resolveBatchStatus([{ tagId: 'a', outcome: 'FAILED' }])).toBe('PartiallyReceived');
  });
});

describe('validateReceipt — the whole batch is checked before any of it is applied', () => {
  const tags = [
    tag({ id: 't1', sku: 'A-1' }),
    tag({ id: 't2', sku: 'B-2' }),
    tag({ id: 'other', sku: 'Z-9', huid: 'A1B2C3' }),
  ];

  it('accepts a clean receipt', () => {
    const results: HallmarkResult[] = [
      { tagId: 't1', outcome: 'PASSED', huid: 'ZZ1111', certifiedPurityPercent: 91.6 },
      { tagId: 't2', outcome: 'FAILED', failureReason: 'Assay returned 89.2%, below 22K' },
    ];
    expect(validateReceipt({ results, tags })).toBeNull();
  });

  it('requires at least one outcome', () => {
    expect(validateReceipt({ results: [], tags })).toMatch(/at least one piece/i);
  });

  it('names the piece when a HUID collides with an existing one', () => {
    const results: HallmarkResult[] = [
      { tagId: 't1', outcome: 'PASSED', huid: 'A1B2C3', certifiedPurityPercent: 91.6 },
    ];
    expect(validateReceipt({ results, tags })).toMatch(/^A-1: .*never be reused/i);
  });

  it('requires a certified purity on a pass', () => {
    const results: HallmarkResult[] = [{ tagId: 't1', outcome: 'PASSED', huid: 'ZZ1111' }];
    expect(validateReceipt({ results, tags })).toMatch(/purity certified by the AHC/i);
  });

  it('rejects an out-of-range purity', () => {
    const results: HallmarkResult[] = [
      { tagId: 't1', outcome: 'PASSED', huid: 'ZZ1111', certifiedPurityPercent: 140 },
    ];
    expect(validateReceipt({ results, tags })).toMatch(/0–100%/);
  });

  it('demands a reason on a failure, since PRD §11.3 makes it an investigation trigger', () => {
    const results: HallmarkResult[] = [{ tagId: 't2', outcome: 'FAILED', failureReason: 'no' }];
    expect(validateReceipt({ results, tags })).toMatch(/record why the AHC rejected/i);
  });
});

describe('summariseBatches', () => {
  it('summarises an empty register', () => {
    expect(summariseBatches([], [])).toEqual({
      total: 0, atAhc: 0, piecesAtAhc: 0, awaitingDispatch: 0, failedPieces: 0, shortfallPieces: 0,
    });
  });

  it('counts pieces in flight, awaiting dispatch, failed, and short on purity', () => {
    const tags = [
      tag({ id: 't1', metalType: 'Gold (22K)' }),
      tag({ id: 't2', status: 'PendingHallmark' }),
      tag({ id: 't3', status: 'InStock' }),
    ];
    const batches = [
      batch({ id: 'b1', status: 'AtAHC', tagIds: ['t1', 't2'] }),
      batch({
        id: 'b2', status: 'PartiallyReceived', tagIds: ['t1'],
        results: [
          { tagId: 't1', outcome: 'PASSED', huid: 'ZZ1111', certifiedPurityPercent: 90.0 },
          { tagId: 't2', outcome: 'FAILED', failureReason: 'Below 22K on assay' },
        ],
      }),
    ];
    const s = summariseBatches(batches, tags);
    expect(s.total).toBe(2);
    expect(s.atAhc).toBe(1);
    expect(s.piecesAtAhc).toBe(2);
    expect(s.awaitingDispatch).toBe(2);
    expect(s.failedPieces).toBe(1);
    expect(s.shortfallPieces).toBe(1); // 90.0% certified against 91.6% declared
  });
});
