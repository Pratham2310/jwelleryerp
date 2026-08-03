import { describe, it, expect } from 'vitest';
import {
  MELT_LOSS_REVIEW_PERCENT,
  isMeltableTag,
  purityOfMetal,
  tagAsMeltInput,
  lotAsMeltInput,
  expectedFineWeight,
  inputGrossWeight,
  validateMeltBatch,
  buildMeltBatch,
  reconcilesToInput,
  buildOutputTag,
  applyMeltToTags,
  applyMeltToLots,
  summariseMelts,
  nextBatchNumber,
  type MeltBatch,
  type MeltInput,
} from './melting';
import type { Tag, OldGoldVoucher } from '../types';

const tag = (over: Partial<Tag> = {}): Tag => ({
  id: 't1', sku: 'RNG-001', itemDesignId: 'd1', name: 'Ring', category: 'Rings',
  metalType: 'Gold (22K)', grossWeight: 10, netWeight: 10, wastagePercent: 0,
  makingChargeType: 'flat', makingChargeValue: 0, stoneType: 'None', stoneWeight: 0,
  stoneCharge: 0, stockOwnershipType: 'OWNED', status: 'InStock', huid: 'AB1234',
  ...over,
} as Tag);

const lot = (over: Partial<OldGoldVoucher> = {}): OldGoldVoucher => ({
  id: 'ogv1', voucherNumber: 'OGV-2026-1', date: '2026-08-01', customerName: 'C',
  customerPhone: 'x', itemDescription: 'bangle', grossWeight: 20, testedPurityPercent: 75,
  meltingLossPercent: 2, netPayableWeight: 14.7, buybackRatePerGram: 6000,
  buybackValue: 88200, settlementMode: 'AdjustAgainstPurchase', status: 'InSafe',
  ...over,
} as OldGoldVoucher);

/** 10 g at 91.667% + 20 g at 75% = 9.167 + 15 = 24.167 g fine, from 30 g gross. */
const inputs = (): MeltInput[] => [tagAsMeltInput(tag()), lotAsMeltInput(lot())];

describe('purity', () => {
  it('derives purity from the karat mark', () => {
    expect(purityOfMetal('Gold (22K)')).toBe(91.667);
    expect(purityOfMetal('Gold (24K)')).toBe(100);
    expect(purityOfMetal('Gold (18K)')).toBe(75);
  });

  it('reads silver and platinum as parts per thousand, not karats', () => {
    // Two different notations: reading 999 as anything but 99.9% would under-state the fine
    // content of every silver melt.
    expect(purityOfMetal('Silver (999)')).toBe(99.9);
    expect(purityOfMetal('Platinum (950)')).toBe(95);
  });
});

describe('inputs', () => {
  it('totals gross weight across pieces and lots', () => {
    expect(inputGrossWeight(inputs())).toBe(30);
  });

  it('computes the fine metal the batch actually contains', () => {
    expect(expectedFineWeight(inputs())).toBeCloseTo(24.167, 2);
  });

  it('takes a lot\'s assayed purity, not an assumed one', () => {
    expect(lotAsMeltInput(lot({ testedPurityPercent: 62.5 })).purityPercent).toBe(62.5);
  });
});

describe('isMeltableTag', () => {
  it('allows melting unsold stock — recovering metal from slow movers is the point', () => {
    expect(isMeltableTag(tag({ status: 'InStock' }))).toBe(true);
    expect(isMeltableTag(tag({ status: 'InShowcase' }))).toBe(true);
  });

  it('allows melting a written-off piece', () => {
    expect(isMeltableTag(tag({ status: 'DamagedOrMelted' }))).toBe(true);
  });

  it('refuses a sold piece', () => {
    expect(isMeltableTag(tag({ status: 'Sold' }))).toBe(false);
  });

  it('REFUSES a piece already consumed by a batch — re-melting invents metal', () => {
    // Written-off and already-melted share a status, so history is what tells them apart.
    const batch = buildMeltBatch([tagAsMeltInput(tag())], 9, 'P', 'MELT-2026-1');
    expect(isMeltableTag(tag({ status: 'DamagedOrMelted' }), [batch])).toBe(false);
  });
});

describe('validateMeltBatch — physics first', () => {
  it('accepts a plausible melt', () => {
    expect(validateMeltBatch(inputs(), 23.9, 'Prathamesh S.')).toBeNull();
  });

  it('REFUSES recovering more than went in — gold is not created in a crucible', () => {
    expect(validateMeltBatch(inputs(), 31, 'P')).toMatch(/cannot produce more metal than went in/i);
  });

  it('refuses recovering materially more fine metal than the inputs contain', () => {
    // Under gross but over the fine content: a purity is mis-stated.
    expect(validateMeltBatch(inputs(), 27, 'P')).toMatch(/purity is mis-stated/i);
  });

  it('allows a small overshoot as assay tolerance', () => {
    expect(validateMeltBatch(inputs(), 24.4, 'P')).toBeNull();
  });

  it('requires inputs, a recovery figure and an operator', () => {
    expect(validateMeltBatch([], 10, 'P')).toMatch(/at least one piece/i);
    expect(validateMeltBatch(inputs(), 0, 'P')).toMatch(/fine weight actually recovered/i);
    expect(validateMeltBatch(inputs(), 23, ' ')).toMatch(/who ran the melt/i);
  });

  it('refuses a negative or non-numeric recovery', () => {
    expect(validateMeltBatch(inputs(), -5, 'P')).toMatch(/fine weight actually recovered/i);
    expect(validateMeltBatch(inputs(), NaN, 'P')).toMatch(/fine weight actually recovered/i);
  });
});

describe('buildMeltBatch', () => {
  it('DERIVES loss so the batch reconciles by construction', () => {
    const b = buildMeltBatch(inputs(), 23.9, 'P', 'MELT-2026-1', '2026-08-01');
    expect(b.lossWeight).toBe(6.1);
    expect(reconcilesToInput(b)).toBe(true);
  });

  it('reconciles for any recovery figure, which is the milestone criterion', () => {
    for (const recovered of [10, 18.25, 23.9, 24.167]) {
      expect(reconcilesToInput(buildMeltBatch(inputs(), recovered, 'P', 'B'))).toBe(true);
    }
  });

  it('flags a bad melt for review rather than blocking it', () => {
    // A genuinely bad melt happens; the shop needs it visible, not impossible to record.
    const bad = buildMeltBatch(inputs(), 20, 'P', 'MELT-2026-2');
    expect(bad.lossPercent).toBeGreaterThan(MELT_LOSS_REVIEW_PERCENT);
    expect(bad.needsReview).toBe(true);
  });

  it('does not flag a normal melt', () => {
    expect(buildMeltBatch(inputs(), 29.5, 'P', 'MELT-2026-3').needsReview).toBe(false);
  });
});

describe('buildOutputTag — melting destroys identity', () => {
  const batch = buildMeltBatch(inputs(), 23.9, 'P', 'MELT-2026-1', '2026-08-01');

  it('produces raw metal at the recovered fine weight', () => {
    const out = buildOutputTag(batch, 'Gold (24K)', 'RAW-001');
    expect(out.status).toBe('RawMetal');
    expect(out.netWeight).toBe(23.9);
  });

  it('carries NO HUID — that number certified an ornament that no longer exists', () => {
    expect(buildOutputTag(batch, 'Gold (24K)', 'RAW-001').huid).toBeUndefined();
  });

  it('carries no stone or making charge', () => {
    const out = buildOutputTag(batch, 'Gold (24K)', 'RAW-001');
    expect(out.stoneCharge).toBe(0);
    expect(out.makingChargeValue).toBe(0);
  });
});

describe('applying a melt', () => {
  const batch = buildMeltBatch(inputs(), 23.9, 'P', 'MELT-2026-1', '2026-08-01');

  it('takes melted tags permanently out of sellable stock', () => {
    expect(applyMeltToTags(batch, [tag()])[0].status).toBe('DamagedOrMelted');
  });

  it('leaves tags outside the batch alone', () => {
    const after = applyMeltToTags(batch, [tag(), tag({ id: 't9', status: 'InStock' })]);
    expect(after[1].status).toBe('InStock');
  });

  it('marks lots melted and dates them', () => {
    const after = applyMeltToLots(batch, [lot()]);
    expect(after[0].status).toBe('Melted');
    expect(after[0].meltedOn).toBe('2026-08-01');
  });

  it('splits recovery by fine content contributed, not evenly', () => {
    // The 20 g @ 75% lot contributes 15 of 24.167 g fine — about 62%, not 50%.
    const after = applyMeltToLots(batch, [lot()]);
    expect(after[0].recoveredFineWeight).toBeCloseTo(23.9 * (15 / 24.167), 2);
  });

  it('the recovered shares across all inputs sum to what came out', () => {
    const twoLots = [lotAsMeltInput(lot()), lotAsMeltInput(lot({ id: 'ogv2', grossWeight: 10, testedPurityPercent: 91.667 }))];
    const b = buildMeltBatch(twoLots, 25, 'P', 'MELT-2026-4');
    const after = applyMeltToLots(b, [lot(), lot({ id: 'ogv2', grossWeight: 10, testedPurityPercent: 91.667 })]);
    const total = after.reduce((s, l) => s + (l.recoveredFineWeight || 0), 0);
    expect(total).toBeCloseTo(25, 2);
  });
});

describe('summariseMelts', () => {
  const b = (input: number, recovered: number, no: string): MeltBatch =>
    buildMeltBatch([{ kind: 'TAG', refId: 'x', grossWeight: input, purityPercent: 100 }], recovered, 'P', no);

  it('summarises an empty book', () => {
    expect(summariseMelts([])).toMatchObject({ batches: 0, totalInput: 0, averageLossPercent: 0 });
  });

  it('weights the average loss by input, not by batch count', () => {
    // A 1 g batch losing 10% must not drag the figure as hard as a 500 g batch losing 2%.
    const s = summariseMelts([b(1, 0.9, 'A'), b(500, 490, 'B')]);
    expect(s.totalInput).toBe(501);
    expect(s.averageLossPercent).toBeCloseTo((10.1 / 501) * 100, 2);
    expect(s.averageLossPercent).toBeLessThan(6);
  });

  it('counts batches needing review', () => {
    expect(summariseMelts([b(100, 90, 'A'), b(100, 99, 'B')]).needingReview).toBe(1);
  });
});

describe('nextBatchNumber', () => {
  const at = new Date('2026-08-01');

  it('starts at 1 and continues from the highest', () => {
    expect(nextBatchNumber([], at)).toBe('MELT-2026-1');
    expect(nextBatchNumber([{ batchNo: 'MELT-2026-4' }] as MeltBatch[], at)).toBe('MELT-2026-5');
  });
});
