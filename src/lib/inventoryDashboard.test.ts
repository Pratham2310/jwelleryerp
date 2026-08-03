import { describe, it, expect } from 'vitest';
import {
  isHeldNotSellable,
  isOnHand,
  valueOf,
  inventoryHeadline,
  stockByPurity,
  stockByCategory,
  stockByOwnership,
  lifecycleDistribution,
  inventoryAgeingOnHand,
  slowMovingCapital,
  reconcileInventory,
} from './inventoryDashboard';
import type { Tag, MetalRate } from '../types';

const rates: MetalRate[] = [
  { metalType: 'Gold (22K)', ratePerGram: 6650 } as MetalRate,
  { metalType: 'Gold (18K)', ratePerGram: 5440 } as MetalRate,
];

const tag = (over: Partial<Tag> = {}): Tag => ({
  id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
  metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 0,
  makingChargeType: 'flat', makingChargeValue: 5000, stoneType: 'None', stoneWeight: 0,
  stoneCharge: 0, stockOwnershipType: 'OWNED', status: 'InStock', taggedOn: '2026-07-01',
  ...over,
} as Tag);

const TODAY = '2026-08-01';

describe('what counts as stock', () => {
  it('separates sellable from held-not-sellable', () => {
    expect(isHeldNotSellable('MemoOut')).toBe(true);
    expect(isHeldNotSellable('IssuedToKarigar')).toBe(true);
    expect(isHeldNotSellable('InStock')).toBe(false);
  });

  it('counts both as on hand', () => {
    expect(isOnHand('InStock')).toBe(true);
    expect(isOnHand('MemoOut')).toBe(true);
  });

  it('EXCLUDES pieces that have left the business', () => {
    for (const s of ['Sold', 'ReturnedToSupplier', 'DamagedOrMelted'] as const) {
      expect(isOnHand(s)).toBe(false);
    }
  });
});

describe('valuation', () => {
  it('is metal plus stone, excluding making — unsold stock has not realised its value addition', () => {
    expect(valueOf(tag(), rates)).toBe(66500);
    expect(valueOf(tag({ stoneCharge: 20000 }), rates)).toBe(86500);
  });

  it('values an unrated metal at zero rather than crashing', () => {
    expect(valueOf(tag({ metalType: 'Platinum (950)' }), rates)).toBe(0);
  });
});

describe('inventoryHeadline', () => {
  const tags = [
    tag({ id: 'a', status: 'InStock' }),
    tag({ id: 'b', status: 'InShowcase' }),
    tag({ id: 'c', status: 'MemoOut' }),
    tag({ id: 'd', status: 'Sold' }),
    tag({ id: 'e', status: 'DamagedOrMelted' }),
  ];

  it('counts only sellable pieces as sellable', () => {
    const h = inventoryHeadline(tags, rates);
    expect(h.sellablePieces).toBe(2);
    expect(h.sellableValue).toBe(133000);
  });

  it('counts memo stock as held but not sellable', () => {
    expect(inventoryHeadline(tags, rates).heldNotSellablePieces).toBe(1);
  });

  it('never includes sold or written-off pieces in on-hand value', () => {
    expect(inventoryHeadline(tags, rates).totalOnHandValue).toBe(199500);
  });

  it('separates financed stock from what the shop actually owns', () => {
    // GML and consignment sit on the shelf looking identical to owned stock; a valuation
    // that does not separate them overstates the business.
    const h = inventoryHeadline([
      tag({ id: 'a', stockOwnershipType: 'OWNED' }),
      tag({ id: 'b', stockOwnershipType: 'GML_FINANCED' }),
      tag({ id: 'c', stockOwnershipType: 'CONSIGNMENT' }),
    ], rates);
    expect(h.totalOnHandValue).toBe(199500);
    expect(h.financedValue).toBe(133000);
    expect(h.ownedValue).toBe(66500);
  });

  it('handles empty stock', () => {
    expect(inventoryHeadline([], rates)).toMatchObject({ sellablePieces: 0, totalOnHandValue: 0, ownedValue: 0 });
  });
});

describe('breakdowns', () => {
  const tags = [
    tag({ id: 'a', metalType: 'Gold (22K)', category: 'Rings' }),
    tag({ id: 'b', metalType: 'Gold (18K)', category: 'Chains' }),
    tag({ id: 'c', metalType: 'Gold (22K)', category: 'Rings' }),
  ];

  it('groups by purity, largest value first', () => {
    const rows = stockByPurity(tags, rates);
    expect(rows[0].key).toBe('Gold (22K)');
    expect(rows[0].pieces).toBe(2);
    expect(rows[0].value).toBe(133000);
  });

  it('shares sum to 100% across slices', () => {
    const total = stockByPurity(tags, rates).reduce((s, r) => s + r.sharePercent, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('groups by category', () => {
    expect(stockByCategory(tags, rates).find(r => r.key === 'Rings')?.pieces).toBe(2);
  });

  it('labels ownership types in plain words', () => {
    const rows = stockByOwnership([tag({ stockOwnershipType: 'GML_FINANCED' })], rates);
    expect(rows[0].label).toBe('Gold metal loan');
  });

  it('excludes gone pieces from every breakdown', () => {
    const rows = stockByPurity([...tags, tag({ id: 'z', status: 'Sold' })], rates);
    expect(rows.reduce((n, r) => n + r.pieces, 0)).toBe(3);
  });

  it('handles empty stock without dividing by zero', () => {
    expect(stockByPurity([], rates)).toEqual([]);
  });
});

describe('lifecycleDistribution', () => {
  it('counts every status present, busiest first', () => {
    const rows = lifecycleDistribution([
      tag({ id: 'a', status: 'InStock' }), tag({ id: 'b', status: 'InStock' }),
      tag({ id: 'c', status: 'Sold' }),
    ]);
    expect(rows[0]).toMatchObject({ status: 'InStock', pieces: 2 });
    expect(rows[1]).toMatchObject({ status: 'Sold', pieces: 1 });
  });

  it('uses the human label from the state machine', () => {
    expect(lifecycleDistribution([tag({ status: 'MemoOut' })])[0].label).toBe('Memo Out');
  });
});

describe('ageing', () => {
  const tags = [
    tag({ id: 'new', taggedOn: '2026-07-20' }),
    tag({ id: 'mid', taggedOn: '2026-03-01' }),
    tag({ id: 'old', taggedOn: '2024-01-01' }),
    tag({ id: 'undated', taggedOn: undefined }),
  ];

  it('buckets by age', () => {
    const rows = inventoryAgeingOnHand(tags, rates, TODAY);
    expect(rows.find(r => r.bucket === '0-90')?.pieces).toBe(1);
    expect(rows.find(r => r.bucket === '365+')?.pieces).toBe(1);
  });

  it('INCLUDES held-not-sellable stock, unlike the sellable-only report', () => {
    // Metal sitting with a karigar for eight months is exactly the capital this surfaces.
    const rows = inventoryAgeingOnHand([tag({ status: 'IssuedToKarigar', taggedOn: '2025-01-01' })], rates, TODAY);
    expect(rows.find(r => r.bucket === '365+')?.pieces).toBe(1);
  });

  it('keeps undated pieces in their own bucket, never as new', () => {
    const rows = inventoryAgeingOnHand(tags, rates, TODAY);
    expect(rows.find(r => r.bucket === 'unknown')?.pieces).toBe(1);
    expect(rows.find(r => r.bucket === '0-90')?.pieces).toBe(1);
  });

  it('omits empty buckets rather than printing zero rows', () => {
    expect(inventoryAgeingOnHand([tag()], rates, TODAY)).toHaveLength(1);
  });

  it('reports slow-moving capital over the threshold', () => {
    // `mid` is 153 days old, so at a 180-day threshold only `old` (365+) counts.
    const rows = inventoryAgeingOnHand(tags, rates, TODAY);
    const slow = slowMovingCapital(rows, 180);
    expect(slow.pieces).toBe(1);
    expect(slow.value).toBe(66500);
  });

  it('widens the net at the 90-day threshold, catching the 153-day piece too', () => {
    const rows = inventoryAgeingOnHand(tags, rates, TODAY);
    const slow = slowMovingCapital(rows, 90);
    expect(slow.pieces).toBe(2);
    expect(slow.value).toBe(133000);
  });

  it('surfaces undated pieces separately rather than burying them', () => {
    const rows = inventoryAgeingOnHand(tags, rates, TODAY);
    expect(slowMovingCapital(rows, 180).undatedPieces).toBe(1);
  });
});

describe('reconcileInventory — the milestone criterion, made executable', () => {
  const tags = [
    tag({ id: 'a' }), tag({ id: 'b', metalType: 'Gold (18K)', taggedOn: '2025-01-01' }),
    tag({ id: 'c', status: 'MemoOut', stockOwnershipType: 'CONSIGNMENT' }),
    tag({ id: 'd', status: 'Sold' }),
    tag({ id: 'e', status: 'DamagedOrMelted' }),
    tag({ id: 'f', taggedOn: undefined }),
  ];

  it('every check passes against real stock', () => {
    for (const c of reconcileInventory(tags, rates)) {
      expect(c.passes, `${c.label}: ${c.detail}`).toBe(true);
    }
  });

  it('passes on empty stock too', () => {
    for (const c of reconcileInventory([], rates)) expect(c.passes).toBe(true);
  });

  it('reports five checks with readable detail', () => {
    const checks = reconcileInventory(tags, rates);
    expect(checks).toHaveLength(5);
    for (const c of checks) expect(c.detail.length).toBeGreaterThan(0);
  });
});
