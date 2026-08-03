/**
 * Stock Adjustment & Write-Off Voucher (Milestone 42, PRD §5.4).
 *
 * ─── Writing off is not deleting ──────────────────────────────────────────────────────
 * A piece that is damaged, lost or miscounted must leave sellable stock and stock valuation, but
 * the *record* stays. Deleting the tag would erase the loss along with the piece, which is the
 * one thing a write-off exists to document. So the tag moves — through the state machine, never
 * by direct assignment — to `DamagedOrMelted`, and the voucher carries who wrote it off and why.
 *
 * ─── The rule that costs real money: ITC reversal ─────────────────────────────────────
 * GST s.17(5)(h) blocks input tax credit on goods "lost, stolen, destroyed, written off or
 * disposed of by way of gift or free samples". Credit already claimed on a piece that is then
 * written off has to be reversed — a shop that writes off stock without reversing is carrying
 * credit it is not entitled to.
 *
 * But **a correction is not a destruction**. Fixing a counting error means the piece was never
 * physically lost — the books were wrong, not the stock. Reversing credit on a correction would
 * hand back money the shop is entitled to keep. That distinction is the reason `requiresItcReversal`
 * exists per reason rather than being applied to every adjustment, and it is tested.
 */

import type { Tag, MetalRate } from '../types';
import { canTransition, type TagStatus } from './tagStateMachine';
import { roundMoney, roundWeight, sumWeight } from './money';

export type AdjustmentReason = 'DAMAGED' | 'LOST' | 'SHRINKAGE' | 'CORRECTION';

export interface AdjustmentReasonDef {
  key: AdjustmentReason;
  label: string;
  /** Whether s.17(5)(h) bites. A correction is a bookkeeping fix, not a loss of goods. */
  requiresItcReversal: boolean;
  note: string;
}

export const ADJUSTMENT_REASONS: AdjustmentReasonDef[] = [
  {
    key: 'DAMAGED', label: 'Damaged beyond repair', requiresItcReversal: true,
    note: 'Goods destroyed — input tax credit claimed on this piece must be reversed (s.17(5)(h)).',
  },
  {
    key: 'LOST', label: 'Lost or stolen', requiresItcReversal: true,
    note: 'Goods lost or stolen — credit must be reversed, and a theft may also need a police report.',
  },
  {
    key: 'SHRINKAGE', label: 'Shortage found on audit', requiresItcReversal: true,
    note: 'A physical shortage is a loss of goods, so credit is reversed even though nobody saw it go.',
  },
  {
    key: 'CORRECTION', label: 'Book correction (piece never existed)', requiresItcReversal: false,
    note: 'The record was wrong, not the stock. Nothing was destroyed, so no credit is reversed.',
  },
];

export function reasonDef(reason: AdjustmentReason): AdjustmentReasonDef {
  return ADJUSTMENT_REASONS.find(r => r.key === reason) ?? ADJUSTMENT_REASONS[0];
}

export interface StockAdjustment {
  id: string;
  adjustmentNo: string;
  date: string;
  tagIds: string[];
  reason: AdjustmentReason;
  /** Mandatory. The narrative is the entire audit value of the document. */
  note: string;
  adjustedBy: string;
  branchId?: string;
  /** Snapshot at write-off time — rates move, and the loss is the loss on the day it happened. */
  weightWrittenOff: number;
  valueWrittenOff: number;
  itcReversed: boolean;
}

/**
 * Statuses a piece can legally be written off from: it must be physically in the shop's hands.
 * A `Sold` piece belongs to the customer; a `TransferInTransit` piece is the other branch's
 * problem to account for; an already-written-off piece would double-count the loss.
 */
export const ADJUSTABLE_STATUSES: TagStatus[] = [
  'RawMetal', 'ReceivedFromKarigar', 'PendingHallmark', 'Hallmarked',
  'InStock', 'InShowcase', 'Returned',
];

export function isAdjustable(status: TagStatus): boolean {
  // Checked against the state machine too, so this list can never authorise an illegal move.
  return ADJUSTABLE_STATUSES.includes(status) && canTransition(status, 'DamagedOrMelted');
}

/**
 * Valued at metal + stone + making, unlike a branch transfer (which excludes making because it is
 * a movement, not a disposal). A write-off is a real loss to the business, and the making charge
 * already spent on the piece is lost with it.
 */
export function adjustmentValue(tags: Tag[], rates: MetalRate[]): number {
  return roundMoney(
    tags.reduce((sum, t) => {
      const rate = rates.find(r => r.metalType === t.metalType)?.ratePerGram ?? 0;
      const making = t.makingChargeType === 'flat'
        ? (t.makingChargeValue || 0)
        : (t.makingChargeValue || 0) * t.netWeight;
      return sum + t.netWeight * rate + (t.stoneCharge || 0) + making;
    }, 0)
  );
}

export function adjustmentWeight(tags: Tag[]): number {
  return roundWeight(sumWeight(tags.map(t => t.netWeight)));
}

export interface AdjustmentDraft {
  tagIds: string[];
  reason: AdjustmentReason;
  note: string;
  adjustedBy: string;
}

export function validateAdjustment(draft: AdjustmentDraft, tags: Tag[]): string | null {
  if (draft.tagIds.length === 0) {
    return 'Select at least one piece to adjust.';
  }
  if ((draft.note ?? '').trim().length < 10) {
    // The same argument as the M10 override reason: a write-off with "damaged" as its whole
    // explanation tells a later auditor nothing about what actually happened.
    return 'Describe what happened in at least a sentence — the note is the audit trail.';
  }
  if (!(draft.adjustedBy ?? '').trim()) {
    return 'Record who is authorising this write-off.';
  }

  const selected = tags.filter(t => draft.tagIds.includes(t.id));
  if (selected.length !== draft.tagIds.length) {
    return 'One or more selected pieces no longer exist.';
  }

  const illegal = selected.find(t => !isAdjustable(t.status));
  if (illegal) {
    return `${illegal.sku} cannot be written off from ${illegal.status}. `
      + 'Only pieces physically in the shop can be adjusted.';
  }
  return null;
}

export function buildAdjustment(
  draft: AdjustmentDraft,
  tags: Tag[],
  rates: MetalRate[],
  adjustmentNo: string,
  date: string = new Date().toISOString().slice(0, 10),
  branchId?: string
): StockAdjustment {
  const selected = tags.filter(t => draft.tagIds.includes(t.id));
  return {
    id: `adj-${Date.now()}`,
    adjustmentNo,
    date,
    tagIds: [...draft.tagIds],
    reason: draft.reason,
    note: draft.note.trim(),
    adjustedBy: draft.adjustedBy.trim(),
    branchId,
    weightWrittenOff: adjustmentWeight(selected),
    valueWrittenOff: adjustmentValue(selected, rates),
    itcReversed: reasonDef(draft.reason).requiresItcReversal,
  };
}

/**
 * Applies the write-off to the tags. Every move goes through `canTransition`, so a status this
 * module has no right to change is left exactly as it was rather than being forced.
 */
export function applyAdjustment(adjustment: StockAdjustment, tags: Tag[]): Tag[] {
  return tags.map(tag => {
    if (!adjustment.tagIds.includes(tag.id)) return tag;
    if (!canTransition(tag.status, 'DamagedOrMelted')) return tag;
    return { ...tag, status: 'DamagedOrMelted' as TagStatus };
  });
}

export interface AdjustmentSummary {
  count: number;
  totalValue: number;
  totalWeight: number;
  byReason: { reason: AdjustmentReason; count: number; value: number }[];
  itcToReverse: number;
}

/**
 * `itcToReverse` is the *stock value* on which credit must be reversed, not the tax itself —
 * the rate depends on what was originally claimed at purchase, which lives on the purchase
 * invoice rather than on the tag. Naming it as a base rather than as a tax figure keeps the
 * screen from implying a precision it does not have.
 */
export function summariseAdjustments(adjustments: StockAdjustment[]): AdjustmentSummary {
  return {
    count: adjustments.length,
    totalValue: roundMoney(adjustments.reduce((s, a) => s + a.valueWrittenOff, 0)),
    totalWeight: roundWeight(sumWeight(adjustments.map(a => a.weightWrittenOff))),
    byReason: ADJUSTMENT_REASONS
      .map(def => {
        const rows = adjustments.filter(a => a.reason === def.key);
        return {
          reason: def.key,
          count: rows.length,
          value: roundMoney(rows.reduce((s, a) => s + a.valueWrittenOff, 0)),
        };
      })
      .filter(r => r.count > 0),
    itcToReverse: roundMoney(
      adjustments.filter(a => a.itcReversed).reduce((s, a) => s + a.valueWrittenOff, 0)
    ),
  };
}

export function nextAdjustmentNumber(
  existing: StockAdjustment[],
  now: Date = new Date()
): string {
  const year = now.getFullYear();
  const prefix = `ADJ-${year}-`;
  const highest = existing
    .filter(a => a.adjustmentNo.startsWith(prefix))
    .reduce((max, a) => Math.max(max, Number(a.adjustmentNo.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}
