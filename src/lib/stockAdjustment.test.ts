import { describe, it, expect } from 'vitest';
import {
  ADJUSTMENT_REASONS,
  reasonDef,
  isAdjustable,
  adjustmentValue,
  adjustmentWeight,
  validateAdjustment,
  buildAdjustment,
  applyAdjustment,
  summariseAdjustments,
  nextAdjustmentNumber,
  type StockAdjustment,
  type AdjustmentDraft,
} from './stockAdjustment';
import type { Tag, MetalRate } from '../types';
import type { TagStatus } from './tagStateMachine';

const tag = (over: Partial<Tag> = {}): Tag => ({
  id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
  metalType: 'Gold (22K)', grossWeight: 10, netWeight: 8, wastagePercent: 0,
  makingChargeType: 'per-gram', makingChargeValue: 500, stoneType: 'None',
  stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED', status: 'InStock',
  ...over,
} as Tag);

const rates: MetalRate[] = [{ metalType: 'Gold (22K)', ratePerGram: 6650 } as MetalRate];

const draft = (over: Partial<AdjustmentDraft> = {}): AdjustmentDraft => ({
  tagIds: ['t1'], reason: 'DAMAGED',
  note: 'Dropped during cleaning, shank snapped beyond repair.',
  adjustedBy: 'Prathamesh S.', ...over,
});

describe('ITC reversal is per reason — the rule that costs real money', () => {
  it('reverses credit on goods actually lost or destroyed (s.17(5)(h))', () => {
    expect(reasonDef('DAMAGED').requiresItcReversal).toBe(true);
    expect(reasonDef('LOST').requiresItcReversal).toBe(true);
    expect(reasonDef('SHRINKAGE').requiresItcReversal).toBe(true);
  });

  it('does NOT reverse credit on a book correction — nothing was destroyed', () => {
    // Reversing here would hand back money the shop is entitled to keep.
    expect(reasonDef('CORRECTION').requiresItcReversal).toBe(false);
  });

  it('explains every reason, because the note is what an auditor reads', () => {
    for (const r of ADJUSTMENT_REASONS) {
      expect(r.note.length).toBeGreaterThan(20);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it('falls back to a real reason rather than crashing on an unknown one', () => {
    expect(reasonDef('NOPE' as never).key).toBe('DAMAGED');
  });
});

describe('isAdjustable', () => {
  it('allows write-off from states where the shop physically holds the piece', () => {
    for (const s of ['InStock', 'InShowcase', 'Hallmarked', 'Returned'] as TagStatus[]) {
      expect(isAdjustable(s)).toBe(true);
    }
  });

  it('refuses a sold piece — it is not the shop\'s to write off', () => {
    expect(isAdjustable('Sold')).toBe(false);
  });

  it('refuses an already-written-off piece, which would double-count the loss', () => {
    expect(isAdjustable('DamagedOrMelted')).toBe(false);
  });

  it('refuses a piece in transit — the other branch accounts for it', () => {
    expect(isAdjustable('TransferInTransit')).toBe(false);
  });
});

describe('valuation', () => {
  it('includes making charge, unlike a branch transfer', () => {
    // A transfer is a movement; a write-off is a real loss, and the making already spent
    // on the piece is lost with it.
    expect(adjustmentValue([tag()], rates)).toBe(8 * 6650 + 500 * 8);
  });

  it('handles a flat making charge', () => {
    expect(adjustmentValue([tag({ makingChargeType: 'flat', makingChargeValue: 2500 })], rates))
      .toBe(8 * 6650 + 2500);
  });

  it('adds stone charge', () => {
    expect(adjustmentValue([tag({ stoneCharge: 12000 })], rates)).toBe(8 * 6650 + 4000 + 12000);
  });

  it('values an unknown metal at zero rate rather than crashing', () => {
    expect(adjustmentValue([tag({ metalType: 'Gold (18K)' })], rates)).toBe(4000);
  });

  it('sums weight across the selection', () => {
    expect(adjustmentWeight([tag(), tag({ id: 't2', netWeight: 12.5 })])).toBe(20.5);
  });
});

describe('validateAdjustment', () => {
  const tags = [tag()];

  it('accepts a properly reasoned write-off', () => {
    expect(validateAdjustment(draft(), tags)).toBeNull();
  });

  it('requires a selection', () => {
    expect(validateAdjustment(draft({ tagIds: [] }), tags)).toMatch(/at least one piece/i);
  });

  it('requires a real narrative, not a one-word reason', () => {
    expect(validateAdjustment(draft({ note: 'damaged' }), tags)).toMatch(/audit trail/i);
  });

  it('requires who authorised it', () => {
    expect(validateAdjustment(draft({ adjustedBy: '  ' }), tags)).toMatch(/who is authorising/i);
  });

  it('refuses a piece that is not in an adjustable state, naming it', () => {
    expect(validateAdjustment(draft(), [tag({ status: 'Sold' })])).toMatch(/RNG-001 cannot be written off/i);
  });

  it('refuses a selection referencing a piece that no longer exists', () => {
    expect(validateAdjustment(draft({ tagIds: ['t1', 'ghost'] }), tags)).toMatch(/no longer exist/i);
  });
});

describe('buildAdjustment', () => {
  it('snapshots weight, value and the ITC decision at write-off time', () => {
    const a = buildAdjustment(draft(), [tag()], rates, 'ADJ-2026-1', '2026-08-01');
    expect(a).toMatchObject({
      adjustmentNo: 'ADJ-2026-1', reason: 'DAMAGED',
      weightWrittenOff: 8, valueWrittenOff: 57200, itcReversed: true,
    });
  });

  it('records no ITC reversal for a correction', () => {
    const a = buildAdjustment(draft({ reason: 'CORRECTION' }), [tag()], rates, 'ADJ-2026-2');
    expect(a.itcReversed).toBe(false);
  });

  it('trims the note and the authoriser', () => {
    const a = buildAdjustment(
      draft({ note: '  Snapped beyond repair during polishing.  ', adjustedBy: ' Sharda M. ' }),
      [tag()], rates, 'ADJ-2026-3'
    );
    expect(a.note).toBe('Snapped beyond repair during polishing.');
    expect(a.adjustedBy).toBe('Sharda M.');
  });
});

describe('applyAdjustment', () => {
  it('moves the piece to DamagedOrMelted', () => {
    const a = buildAdjustment(draft(), [tag()], rates, 'ADJ-2026-1');
    expect(applyAdjustment(a, [tag()])[0].status).toBe('DamagedOrMelted');
  });

  it('leaves pieces outside the voucher alone', () => {
    const a = buildAdjustment(draft(), [tag()], rates, 'ADJ-2026-1');
    const after = applyAdjustment(a, [tag(), tag({ id: 't2', sku: 'RNG-002' })]);
    expect(after[1].status).toBe('InStock');
  });

  it('NEVER forces an illegal transition, even if the voucher names the tag', () => {
    // The state machine is the authority; this module cannot overrule it.
    const a: StockAdjustment = { ...buildAdjustment(draft(), [tag()], rates, 'ADJ-2026-1'), tagIds: ['t1'] };
    const sold = [tag({ status: 'Sold' })];
    expect(applyAdjustment(a, sold)[0].status).toBe('Sold');
  });

  it('does not delete the tag — the record of the loss is the point', () => {
    const a = buildAdjustment(draft(), [tag()], rates, 'ADJ-2026-1');
    expect(applyAdjustment(a, [tag()])).toHaveLength(1);
  });
});

describe('summariseAdjustments', () => {
  const mk = (over: Partial<StockAdjustment> = {}): StockAdjustment => ({
    id: 'a1', adjustmentNo: 'ADJ-2026-1', date: '2026-08-01', tagIds: ['t1'],
    reason: 'DAMAGED', note: 'n', adjustedBy: 'P', weightWrittenOff: 8,
    valueWrittenOff: 50000, itcReversed: true, ...over,
  });

  it('summarises an empty book', () => {
    expect(summariseAdjustments([])).toMatchObject({ count: 0, totalValue: 0, itcToReverse: 0, byReason: [] });
  });

  it('groups by reason and totals value and weight', () => {
    const s = summariseAdjustments([mk(), mk({ id: 'a2', reason: 'LOST', valueWrittenOff: 30000 })]);
    expect(s.count).toBe(2);
    expect(s.totalValue).toBe(80000);
    expect(s.totalWeight).toBe(16);
    expect(s.byReason).toHaveLength(2);
  });

  it('excludes corrections from the ITC reversal base', () => {
    const s = summariseAdjustments([
      mk(), mk({ id: 'a2', reason: 'CORRECTION', itcReversed: false, valueWrittenOff: 90000 }),
    ]);
    expect(s.totalValue).toBe(140000);
    expect(s.itcToReverse).toBe(50000);
  });

  it('omits reasons with nothing against them', () => {
    expect(summariseAdjustments([mk()]).byReason).toHaveLength(1);
  });
});

describe('nextAdjustmentNumber', () => {
  const at = new Date('2026-08-01');

  it('starts the year at 1', () => {
    expect(nextAdjustmentNumber([], at)).toBe('ADJ-2026-1');
  });

  it('continues from the highest, not the count — so deleting never reissues a number', () => {
    const existing = [
      { adjustmentNo: 'ADJ-2026-1' }, { adjustmentNo: 'ADJ-2026-7' },
    ] as StockAdjustment[];
    expect(nextAdjustmentNumber(existing, at)).toBe('ADJ-2026-8');
  });

  it('ignores another year\'s series', () => {
    expect(nextAdjustmentNumber([{ adjustmentNo: 'ADJ-2025-99' }] as StockAdjustment[], at))
      .toBe('ADJ-2026-1');
  });
});
