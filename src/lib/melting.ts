/**
 * Melting Workflow (Milestone 43, PRD §6.3).
 *
 * Converts old-gold lots and written-off tags back into raw metal stock.
 *
 * ─── Two rules physics gives us for free, and one the law gives us ────────────────────
 *
 *   1. **You cannot get more gold out than went in.** Recovered fine weight above the input's
 *      fine content is not an unusually good melt, it is a data-entry error or a mixed-up batch,
 *      and it must be refused rather than booked as a gain. This is the single most important
 *      check in the module: silently accepting it would create gold out of nothing and corrupt
 *      every valuation downstream.
 *   2. **Input = recovered + loss, always.** The loss is not a plug figure to be typed in
 *      independently; it is derived, so the batch reconciles by construction. A shop that can
 *      type both numbers can produce a batch that does not balance.
 *
 *   3. **Melting destroys identity.** A hallmarked piece that goes into the crucible takes its
 *      HUID with it — that number certified *that ornament*, and carrying it onto the resulting
 *      raw metal would attach a BIS certification to something never assayed. So the output tag
 *      is created without an HUID, and the melted tags are terminal.
 *
 * Excess loss beyond a tolerance is flagged for review rather than blocked, following the same
 * pattern as excess wastage on job work (Milestone 18): a genuinely bad melt happens, and the
 * shop needs it recorded and visible, not made impossible to enter.
 */

import type { Tag, OldGoldVoucher, MetalStandard, ItemCategory } from '../types';
import { canTransition, type TagStatus } from './tagStateMachine';
import { roundWeight, sumWeight, weightEquals } from './money';

/** Normal refining loss on a mixed melt. Beyond this the batch is flagged, not refused. */
export const EXPECTED_MELT_LOSS_PERCENT = 2;

/** Past this, something went wrong — a bad crucible, contaminated scrap, or a mis-weighed input. */
export const MELT_LOSS_REVIEW_PERCENT = 5;

export type MeltBatchStatus = 'Draft' | 'Completed';

export interface MeltInput {
  kind: 'TAG' | 'OLD_GOLD_LOT';
  refId: string;
  /** What went in, as weighed at the crucible. */
  grossWeight: number;
  /** Assayed/known purity of that input, as a percentage. */
  purityPercent: number;
}

export interface MeltBatch {
  id: string;
  batchNo: string;
  date: string;
  inputs: MeltInput[];
  inputGrossWeight: number;
  /** What the inputs' purities say *should* come out. */
  expectedFineWeight: number;
  /** What actually came out of the crucible, weighed. */
  actualFineWeight: number;
  /** Derived: input gross less what was recovered. Never typed in. */
  lossWeight: number;
  lossPercent: number;
  needsReview: boolean;
  status: MeltBatchStatus;
  meltedBy: string;
  note?: string;
  branchId?: string;
  /** The raw-metal tag this batch produced, once completed. */
  outputTagId?: string;
}

/* ─────────────────────────────── Inputs ─────────────────────────────── */

/**
 * A tag can be melted from a written-off state or from unsold stock — a shop melts slow-moving
 * pieces to recover the metal, which is the whole point of PRD §6.3. It cannot be melted once
 * sold (not ours) or already melted (it no longer exists).
 */
export const MELTABLE_TAG_STATUSES: TagStatus[] = [
  'RawMetal', 'ReceivedFromKarigar', 'PendingHallmark', 'Hallmarked',
  'InStock', 'InShowcase', 'Returned',
];

/**
 * A written-off piece (Milestone 42) and an already-melted one both sit in `DamagedOrMelted`, so
 * the status alone cannot tell them apart — and re-melting the same piece would invent metal that
 * does not exist. The batch history is what distinguishes them: a tag already consumed by a melt
 * is spent, everything else physically in the shop can go in the crucible.
 */
export function isMeltableTag(tag: Tag, batches: MeltBatch[] = []): boolean {
  const alreadyMelted = batches.some(b =>
    b.inputs.some(i => i.kind === 'TAG' && i.refId === tag.id)
  );
  if (alreadyMelted) return false;
  return MELTABLE_TAG_STATUSES.includes(tag.status) || tag.status === 'DamagedOrMelted';
}

/**
 * Purity implied by the metal standard, used as the assay basis when melting a finished piece.
 *
 * Two notations are in play and they mean different things: gold is marked in karats out of 24,
 * while silver and platinum are marked in parts per thousand. Reading `Silver (999)` as anything
 * but 99.9% would under-state the fine content of every silver melt.
 */
export function purityOfMetal(metalType: MetalStandard): number {
  const karat = /(\d+)\s*K/i.exec(metalType);
  if (karat) return roundWeight((Number(karat[1]) / 24) * 100);

  const fineness = /\((\d{3})\)/.exec(metalType);
  if (fineness) return roundWeight(Number(fineness[1]) / 10);

  return 100;
}

export function tagAsMeltInput(tag: Tag): MeltInput {
  return {
    kind: 'TAG',
    refId: tag.id,
    grossWeight: tag.grossWeight || tag.netWeight,
    purityPercent: purityOfMetal(tag.metalType),
  };
}

export function lotAsMeltInput(lot: OldGoldVoucher): MeltInput {
  return {
    kind: 'OLD_GOLD_LOT',
    refId: lot.id,
    grossWeight: lot.grossWeight,
    purityPercent: lot.testedPurityPercent,
  };
}

/** Fine metal the inputs actually contain — the ceiling on what any melt can recover. */
export function expectedFineWeight(inputs: MeltInput[]): number {
  return roundWeight(
    inputs.reduce((sum, i) => sum + (i.grossWeight * i.purityPercent) / 100, 0)
  );
}

export function inputGrossWeight(inputs: MeltInput[]): number {
  return roundWeight(sumWeight(inputs.map(i => i.grossWeight)));
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export function validateMeltBatch(
  inputs: MeltInput[],
  actualFineWeight: number,
  meltedBy: string
): string | null {
  if (inputs.length === 0) return 'Add at least one piece or lot to the batch.';
  if (!(meltedBy ?? '').trim()) return 'Record who ran the melt.';

  const gross = inputGrossWeight(inputs);
  if (gross <= 0) return 'The batch has no input weight.';

  const actual = Number(actualFineWeight);
  if (!Number.isFinite(actual) || actual <= 0) {
    return 'Enter the fine weight actually recovered.';
  }

  // Physics, not policy: gold cannot be created in a crucible.
  if (roundWeight(actual) > gross) {
    return `Recovered ${actual.toFixed(3)} g from an input of ${gross.toFixed(3)} g. `
      + 'A melt cannot produce more metal than went in — check the weighing.';
  }

  const expected = expectedFineWeight(inputs);
  if (roundWeight(actual) > roundWeight(expected * 1.02)) {
    // A small overshoot is assay tolerance; a large one means the purity assumptions are wrong.
    return `Recovered ${actual.toFixed(3)} g against an expected fine content of ${expected.toFixed(3)} g. `
      + 'Recovering materially more fine metal than the inputs contain means a purity is mis-stated.';
  }
  return null;
}

/* ─────────────────────────────── Building ─────────────────────────────── */

export function buildMeltBatch(
  inputs: MeltInput[],
  actualFineWeight: number,
  meltedBy: string,
  batchNo: string,
  date: string = new Date().toISOString().slice(0, 10),
  note?: string,
  branchId?: string
): MeltBatch {
  const gross = inputGrossWeight(inputs);
  const actual = roundWeight(actualFineWeight);
  // Derived, never typed: the batch reconciles by construction.
  const loss = roundWeight(gross - actual);
  const lossPercent = gross > 0 ? roundWeight((loss / gross) * 100) : 0;

  return {
    id: `melt-${Date.now()}`,
    batchNo,
    date,
    inputs: [...inputs],
    inputGrossWeight: gross,
    expectedFineWeight: expectedFineWeight(inputs),
    actualFineWeight: actual,
    lossWeight: loss,
    lossPercent,
    needsReview: lossPercent > MELT_LOSS_REVIEW_PERCENT,
    status: 'Completed',
    meltedBy: meltedBy.trim(),
    note: note?.trim() || undefined,
    branchId,
  };
}

/** The reconciliation the milestone is tested on: recovered + loss must equal what went in. */
export function reconcilesToInput(batch: MeltBatch): boolean {
  return weightEquals(batch.actualFineWeight + batch.lossWeight, batch.inputGrossWeight);
}

/**
 * The raw-metal tag a completed batch produces.
 *
 * Deliberately created with **no HUID and no certificate**: the identity of every piece that went
 * into the crucible died there. Carrying a hallmark forward would attach a BIS certification to
 * metal that was never assayed in this form.
 */
export function buildOutputTag(
  batch: MeltBatch,
  metalType: MetalStandard,
  sku: string
): Tag {
  return {
    id: `tag-melt-${batch.id}`,
    sku,
    itemDesignId: '',
    name: `Recovered fine metal — ${batch.batchNo}`,
    category: 'Other' as ItemCategory,
    metalType,
    grossWeight: batch.actualFineWeight,
    netWeight: batch.actualFineWeight,
    wastagePercent: 0,
    makingChargeType: 'flat',
    makingChargeValue: 0,
    stoneType: 'None',
    stoneWeight: 0,
    stoneCharge: 0,
    stockOwnershipType: 'OWNED',
    status: 'RawMetal',
    branchId: batch.branchId,
    taggedOn: batch.date,
  } as Tag;
}

/** Melted tags are terminal — the piece no longer exists in any form. */
export function applyMeltToTags(batch: MeltBatch, tags: Tag[]): Tag[] {
  const meltedIds = batch.inputs.filter(i => i.kind === 'TAG').map(i => i.refId);
  return tags.map(tag => {
    if (!meltedIds.includes(tag.id)) return tag;
    if (tag.status === 'DamagedOrMelted') return tag;
    if (!canTransition(tag.status, 'DamagedOrMelted')) return tag;
    return { ...tag, status: 'DamagedOrMelted' as TagStatus };
  });
}

export function applyMeltToLots(batch: MeltBatch, lots: OldGoldVoucher[]): OldGoldVoucher[] {
  const meltedIds = batch.inputs.filter(i => i.kind === 'OLD_GOLD_LOT').map(i => i.refId);
  return lots.map(lot => {
    if (!meltedIds.includes(lot.id)) return lot;
    const input = batch.inputs.find(i => i.refId === lot.id);
    // Each lot's share of the recovery, in proportion to the fine metal it contributed —
    // splitting evenly would credit a 60%-purity lot the same as a 92% one.
    const lotFine = input ? (input.grossWeight * input.purityPercent) / 100 : 0;
    const share = batch.expectedFineWeight > 0 ? lotFine / batch.expectedFineWeight : 0;
    return {
      ...lot,
      status: 'Melted' as OldGoldVoucher['status'],
      recoveredFineWeight: roundWeight(batch.actualFineWeight * share),
      meltedOn: batch.date,
    };
  });
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface MeltSummary {
  batches: number;
  totalInput: number;
  totalRecovered: number;
  totalLoss: number;
  averageLossPercent: number;
  needingReview: number;
}

export function summariseMelts(batches: MeltBatch[]): MeltSummary {
  const totalInput = roundWeight(sumWeight(batches.map(b => b.inputGrossWeight)));
  const totalLoss = roundWeight(sumWeight(batches.map(b => b.lossWeight)));
  return {
    batches: batches.length,
    totalInput,
    totalRecovered: roundWeight(sumWeight(batches.map(b => b.actualFineWeight))),
    totalLoss,
    // Weighted by input rather than a mean of percentages: a 1 g batch losing 10% must not
    // drag the shop's figure around as hard as a 500 g batch losing 2%.
    averageLossPercent: totalInput > 0 ? roundWeight((totalLoss / totalInput) * 100) : 0,
    needingReview: batches.filter(b => b.needsReview).length,
  };
}

export function nextBatchNumber(existing: MeltBatch[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `MELT-${year}-`;
  const highest = existing
    .filter(b => b.batchNo.startsWith(prefix))
    .reduce((max, b) => Math.max(max, Number(b.batchNo.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}
