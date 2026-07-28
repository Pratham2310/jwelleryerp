import { describe, it, expect } from 'vitest';
import {
  canTransitionTransfer,
  isSettled,
  nextTransferNumber,
  validateTransferDraft,
  transferValue,
  requiresEWayBill,
  resolveReceiptStatus,
  summariseTransfers,
  DEFAULT_EWAY_THRESHOLD,
} from './stockTransfer';
import { isSellable } from './tagStateMachine';
import type { StockTransfer, StockTransferStatus, Tag, MetalRate } from '../types';

function tag(over: Partial<Tag> = {}): Tag {
  return {
    id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
    metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 3,
    makingChargeType: 'per-gram', makingChargeValue: 400, stoneType: 'None',
    stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED', status: 'InStock',
    branchId: 'br-1', ...over,
  };
}

function transfer(over: Partial<StockTransfer> = {}): StockTransfer {
  return {
    id: 'tr1', transferNo: 'TRF-2026-001', fromBranchId: 'br-1', toBranchId: 'br-2',
    tagIds: ['t1'], status: 'Draft', createdOn: '2026-07-01', ...over,
  };
}

const rates: MetalRate[] = [
  { id: 'r1', metalType: 'Gold (22K)', purity: '91.6%', ratePerGram: 6650, change24h: 0, history24h: [] },
];

describe('transfer lifecycle', () => {
  const legal: [StockTransferStatus, StockTransferStatus][] = [
    ['Draft', 'InTransit'],
    ['InTransit', 'Received'],
    ['InTransit', 'PartiallyReceived'],
    ['InTransit', 'Rejected'],
  ];
  it.each(legal)('allows %s -> %s', (a, b) => expect(canTransitionTransfer(a, b)).toBe(true));

  const illegal: [StockTransferStatus, StockTransferStatus][] = [
    ['Draft', 'Received'], // goods must physically move first
    ['Received', 'InTransit'], // a settled transfer is never reopened
    ['Rejected', 'InTransit'],
    ['PartiallyReceived', 'Received'],
    ['InTransit', 'Draft'],
    ['InTransit', 'InTransit'],
  ];
  it.each(illegal)('blocks %s -> %s', (a, b) => expect(canTransitionTransfer(a, b)).toBe(false));

  it('treats every landed outcome as settled', () => {
    expect(isSettled('Received')).toBe(true);
    expect(isSettled('PartiallyReceived')).toBe(true);
    expect(isSettled('Rejected')).toBe(true);
    expect(isSettled('Draft')).toBe(false);
    expect(isSettled('InTransit')).toBe(false);
  });
});

describe('D-7: a tag in transit is sellable at NEITHER branch', () => {
  it('is the whole reason TransferInTransit is not a sellable state', () => {
    // If this ever becomes true, two counters could sell the same physical ornament.
    expect(isSellable('TransferInTransit')).toBe(false);
    expect(isSellable('InStock')).toBe(true);
    expect(isSellable('InShowcase')).toBe(true);
  });
});

describe('nextTransferNumber', () => {
  const now = new Date(2026, 6, 1);
  it('starts at 001', () => expect(nextTransferNumber([], now)).toBe('TRF-2026-001'));

  it('continues from the highest number, not the array length', () => {
    const list = [transfer({ transferNo: 'TRF-2026-001' }), transfer({ transferNo: 'TRF-2026-009' })];
    expect(nextTransferNumber(list, now)).toBe('TRF-2026-010');
  });

  it('ignores other years', () => {
    expect(nextTransferNumber([transfer({ transferNo: 'TRF-2025-099' })], now)).toBe('TRF-2026-001');
  });
});

describe('validateTransferDraft', () => {
  const tags = [
    tag({ id: 't1', sku: 'A-1', branchId: 'br-1', status: 'InStock' }),
    tag({ id: 't2', sku: 'B-2', branchId: 'br-2', status: 'InStock' }),
    tag({ id: 't3', sku: 'C-3', branchId: 'br-1', status: 'OutForJobwork' }),
  ];

  it('accepts a well-formed draft', () => {
    expect(validateTransferDraft({ fromBranchId: 'br-1', toBranchId: 'br-2', tagIds: ['t1'] }, tags)).toBeNull();
  });

  it('requires both branches and at least one piece', () => {
    expect(validateTransferDraft({ toBranchId: 'br-2', tagIds: ['t1'] }, tags)).toMatch(/dispatching/i);
    expect(validateTransferDraft({ fromBranchId: 'br-1', tagIds: ['t1'] }, tags)).toMatch(/destination/i);
    expect(validateTransferDraft({ fromBranchId: 'br-1', toBranchId: 'br-2', tagIds: [] }, tags)).toMatch(/at least one/i);
  });

  it('refuses a transfer to the same branch', () => {
    expect(validateTransferDraft({ fromBranchId: 'br-1', toBranchId: 'br-1', tagIds: ['t1'] }, tags))
      .toMatch(/must be different/i);
  });

  it('refuses to dispatch a piece that is not at the source branch', () => {
    expect(validateTransferDraft({ fromBranchId: 'br-1', toBranchId: 'br-2', tagIds: ['t2'] }, tags))
      .toMatch(/not held at the dispatching branch/i);
  });

  it('refuses to dispatch a piece that is not currently available', () => {
    // Without this, a piece already out for jobwork could be dispatched a second time
    expect(validateTransferDraft({ fromBranchId: 'br-1', toBranchId: 'br-2', tagIds: ['t3'] }, tags))
      .toMatch(/not available to dispatch/i);
  });

  it('refuses a selection containing an unknown id', () => {
    expect(validateTransferDraft({ fromBranchId: 'br-1', toBranchId: 'br-2', tagIds: ['ghost'] }, tags))
      .toMatch(/could not be found/i);
  });
});

describe('transferValue & e-Way Bill threshold (PRD §9.5)', () => {
  it('values metal plus stones, excluding making charge', () => {
    // A branch transfer is a movement of goods, not a sale — there is no value addition
    const v = transferValue([tag({ netWeight: 10, stoneCharge: 5000, makingChargeValue: 99999 })], rates);
    expect(v).toBe(10 * 6650 + 5000);
  });

  it('sums a multi-piece consignment', () => {
    const v = transferValue([tag({ id: 'a', netWeight: 1 }), tag({ id: 'b', netWeight: 2 })], rates);
    expect(v).toBe(3 * 6650);
  });

  it('is zero for an empty consignment', () => {
    expect(transferValue([], rates)).toBe(0);
  });

  it('flags an e-Way Bill above the threshold and not at or below it', () => {
    expect(requiresEWayBill(DEFAULT_EWAY_THRESHOLD + 1)).toBe(true);
    expect(requiresEWayBill(DEFAULT_EWAY_THRESHOLD)).toBe(false);
    expect(requiresEWayBill(0)).toBe(false);
  });

  it('honours a state-specific threshold, since jewellery thresholds vary by state', () => {
    expect(requiresEWayBill(30000, 25000)).toBe(true);
    expect(requiresEWayBill(30000, 100000)).toBe(false);
  });
});

describe('resolveReceiptStatus', () => {
  it('is Received when every piece is accepted', () => {
    expect(resolveReceiptStatus(['a', 'b'], ['a', 'b'])).toBe('Received');
  });

  it('is Rejected when nothing is accepted', () => {
    expect(resolveReceiptStatus([], ['a', 'b'])).toBe('Rejected');
  });

  it('is PartiallyReceived on a mixed outcome — a piece can arrive damaged', () => {
    expect(resolveReceiptStatus(['a'], ['a', 'b'])).toBe('PartiallyReceived');
  });
});

describe('summariseTransfers', () => {
  it('summarises an empty register', () => {
    expect(summariseTransfers([])).toEqual({
      total: 0, inTransit: 0, awaitingDispatch: 0, piecesInTransit: 0,
    });
  });

  it('counts pieces currently in flight, not just transfers', () => {
    const s = summariseTransfers([
      transfer({ id: 'a', status: 'InTransit', tagIds: ['t1', 't2'] }),
      transfer({ id: 'b', status: 'InTransit', tagIds: ['t3'] }),
      transfer({ id: 'c', status: 'Draft', tagIds: ['t4'] }),
      transfer({ id: 'd', status: 'Received', tagIds: ['t5'] }),
    ]);
    expect(s.total).toBe(4);
    expect(s.inTransit).toBe(2);
    expect(s.piecesInTransit).toBe(3);
    expect(s.awaitingDispatch).toBe(1);
  });
});
