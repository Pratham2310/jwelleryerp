/**
 * BIS Hallmarking & HUID assignment (PRD §11, Handbook Phase 9, Milestone 24).
 *
 * HUID is a legal requirement, not a nicety: since the mandatory hallmarking rules took effect,
 * gold jewellery sold in India above the exemption thresholds must carry a BIS Hallmark and a
 * unique 6-character HUID allotted by an Assaying & Hallmarking Centre (AHC). Until now `Tag.huid`
 * existed and printed on the invoice, but nothing populated it except someone typing a string —
 * there was no dispatch register, no uniqueness enforcement, and no record of certified purity.
 *
 * The two rules that carry real weight here:
 *
 *  1. **A HUID is unique to one physical piece and can never be reused** (PRD §11.1). Reuse is
 *     what a diverted or substituted piece looks like in the data, so uniqueness is checked
 *     globally across every tag, not just within the batch being received.
 *  2. **A failed purity test is an accountability event, not a clerical one** (PRD §11.3). The
 *     AHC certifies actual fineness, which may come back below what the piece was declared as.
 *     That means the shop was about to sell under-karat gold, and the karigar who made it owes
 *     an explanation — so a shortfall is surfaced rather than absorbed.
 */

import type { Tag, HallmarkBatch, HallmarkBatchStatus, HallmarkResult } from '../types';
import { purityPercentForMetal } from './fineGoldLedger';

/** BIS HUID: exactly 6 alphanumeric characters, laser-engraved on the piece. */
export const HUID_PATTERN = /^[0-9A-Z]{6}$/;

export function normaliseHuid(huid: string): string {
  return (huid || '').trim().toUpperCase();
}

export function isValidHuidFormat(huid: string): boolean {
  return HUID_PATTERN.test(normaliseHuid(huid));
}

/**
 * Global uniqueness across every tag ever created — see rule 1 above. `exceptTagId` lets a tag
 * keep its own HUID when a record is being re-saved without changing it.
 */
export function isHuidUnique(huid: string, tags: Tag[], exceptTagId?: string): boolean {
  const target = normaliseHuid(huid);
  return !tags.some(t => t.id !== exceptTagId && normaliseHuid(t.huid || '') === target);
}

export function validateHuidAssignment(
  huid: string,
  tags: Tag[],
  tagId: string,
  /** Other HUIDs being assigned in the same receipt, which are not persisted yet. */
  pendingInBatch: string[] = []
): string | null {
  const value = normaliseHuid(huid);
  if (!value) return 'Enter the HUID engraved by the AHC.';
  if (!isValidHuidFormat(value)) {
    return 'A HUID is exactly 6 alphanumeric characters, e.g. A1B2C3.';
  }
  if (!isHuidUnique(value, tags, tagId)) {
    return `HUID ${value} is already assigned to another piece. A HUID can never be reused.`;
  }
  // Two pieces in the same batch cannot share a HUID either — this is only caught here,
  // because neither has been written to a tag yet.
  if (pendingInBatch.filter(h => normaliseHuid(h) === value).length > 1) {
    return `HUID ${value} appears twice in this batch.`;
  }
  return null;
}

/* ───────────────────────────── Batch lifecycle ───────────────────────────── */

export const BATCH_STATUS_LABEL: Record<HallmarkBatchStatus, string> = {
  Draft: 'Draft',
  AtAHC: 'At AHC',
  Received: 'Received',
  PartiallyReceived: 'Partially Received',
};

const TERMINAL: ReadonlySet<HallmarkBatchStatus> = new Set(['Received', 'PartiallyReceived']);

const TRANSITIONS: Record<HallmarkBatchStatus, HallmarkBatchStatus[]> = {
  Draft: ['AtAHC'],
  AtAHC: ['Received', 'PartiallyReceived'],
  Received: [],
  PartiallyReceived: [],
};

export function canTransitionBatch(from: HallmarkBatchStatus, to: HallmarkBatchStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isBatchSettled(status: HallmarkBatchStatus): boolean {
  return TERMINAL.has(status);
}

/** One dispatch-register series per shop; allocated from the highest existing, not a count. */
export function nextBatchNumber(existing: HallmarkBatch[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `AHC-${year}-`;
  const highest = existing
    .map(b => b.batchNo)
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

export interface DispatchDraft {
  ahcName?: string;
  tagIds?: string[];
}

export function validateDispatchDraft(draft: DispatchDraft, tags: Tag[]): string | null {
  if (!draft.ahcName?.trim()) return 'Name the Assaying & Hallmarking Centre.';
  if (!draft.tagIds?.length) return 'Select at least one piece to send for hallmarking.';

  const selected = tags.filter(t => draft.tagIds!.includes(t.id));
  if (selected.length !== draft.tagIds.length) {
    return 'One or more selected pieces could not be found.';
  }
  // Only a piece awaiting hallmarking may be dispatched; anything else is either already
  // hallmarked, still with the karigar, or on the shop floor.
  const wrongState = selected.find(t => t.status !== 'PendingHallmark');
  if (wrongState) {
    return `${wrongState.sku} is not awaiting hallmarking (currently ${wrongState.status}).`;
  }
  const alreadyHuid = selected.find(t => t.huid);
  if (alreadyHuid) {
    return `${alreadyHuid.sku} already carries HUID ${alreadyHuid.huid}.`;
  }
  return null;
}

/* ───────────────────────── Certified purity variance ───────────────────────── */

/**
 * Measurement noise tolerance in percentage points. BIS allows no *negative* tolerance on
 * marked fineness — a piece must meet what it claims — but assay readings do vary slightly, so
 * a hair's difference is not treated as a shortfall.
 */
export const PURITY_TOLERANCE_PERCENT = 0.2;

export type PurityVarianceSeverity = 'MATCH' | 'OVER_DELIVERED' | 'SHORTFALL';

export interface PurityVariance {
  declaredPercent: number;
  certifiedPercent: number;
  variance: number;
  severity: PurityVarianceSeverity;
  requiresReview: boolean;
  message: string | null;
}

/**
 * Compares the AHC's certified fineness against what the piece was declared as.
 *
 * The two directions are NOT symmetric. A shortfall means the shop was about to sell under-karat
 * gold and the karigar who made the piece owes an explanation, so it demands review. Over-delivery
 * means the shop put in more gold than it charged for — a margin leak worth knowing about, but
 * not an integrity question.
 */
export function assessPurityVariance(metalType: string, certifiedPercent: number): PurityVariance {
  const declared = purityPercentForMetal(metalType);
  const certified = Number(certifiedPercent) || 0;
  const variance = Number((certified - declared).toFixed(3));

  if (variance < -PURITY_TOLERANCE_PERCENT) {
    return {
      declaredPercent: declared,
      certifiedPercent: certified,
      variance,
      severity: 'SHORTFALL',
      requiresReview: true,
      message: `Certified ${certified}% against ${declared}% declared — ${Math.abs(variance).toFixed(2)} points short. Raise with the karigar before this piece is sold.`,
    };
  }
  if (variance > PURITY_TOLERANCE_PERCENT) {
    return {
      declaredPercent: declared,
      certifiedPercent: certified,
      variance,
      severity: 'OVER_DELIVERED',
      requiresReview: false,
      message: `Certified ${certified}% against ${declared}% declared — ${variance.toFixed(2)} points over. The shop gave away metal it did not charge for.`,
    };
  }
  return {
    declaredPercent: declared,
    certifiedPercent: certified,
    variance,
    severity: 'MATCH',
    requiresReview: false,
    message: null,
  };
}

/* ─────────────────────────────── Receipt ─────────────────────────────── */

export function resolveBatchStatus(results: HallmarkResult[]): HallmarkBatchStatus {
  return results.every(r => r.outcome === 'PASSED') ? 'Received' : 'PartiallyReceived';
}

export interface ReceiptValidationInput {
  results: HallmarkResult[];
  tags: Tag[];
}

/**
 * Validates a whole receipt before any of it is applied — a partially-applied batch would leave
 * some pieces hallmarked and others in limbo with no record of why.
 */
export function validateReceipt({ results, tags }: ReceiptValidationInput): string | null {
  if (results.length === 0) return 'Record an outcome for at least one piece.';

  const pendingHuids = results.filter(r => r.outcome === 'PASSED').map(r => r.huid || '');

  for (const result of results) {
    const tag = tags.find(t => t.id === result.tagId);
    const label = tag?.sku ?? result.tagId;

    if (result.outcome === 'PASSED') {
      const huidError = validateHuidAssignment(result.huid || '', tags, result.tagId, pendingHuids);
      if (huidError) return `${label}: ${huidError}`;

      const purity = Number(result.certifiedPurityPercent);
      if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
        return `${label}: enter the purity certified by the AHC (0–100%).`;
      }
    } else {
      if ((result.failureReason ?? '').trim().length < 5) {
        // PRD §11.3 makes a failure an investigation trigger; an unexplained one is useless.
        return `${label}: record why the AHC rejected this piece (at least 5 characters).`;
      }
    }
  }
  return null;
}

export interface HallmarkSummary {
  total: number;
  atAhc: number;
  piecesAtAhc: number;
  awaitingDispatch: number;
  failedPieces: number;
  shortfallPieces: number;
}

export function summariseBatches(batches: HallmarkBatch[], tags: Tag[] = []): HallmarkSummary {
  const atAhc = batches.filter(b => b.status === 'AtAHC');
  const allResults = batches.flatMap(b => b.results ?? []);

  const shortfallPieces = allResults.filter(r => {
    if (r.outcome !== 'PASSED' || r.certifiedPurityPercent === undefined) return false;
    const tag = tags.find(t => t.id === r.tagId);
    if (!tag) return false;
    return assessPurityVariance(tag.metalType, r.certifiedPurityPercent).severity === 'SHORTFALL';
  }).length;

  return {
    total: batches.length,
    atAhc: atAhc.length,
    piecesAtAhc: atAhc.reduce((s, b) => s + b.tagIds.length, 0),
    awaitingDispatch: tags.filter(t => t.status === 'PendingHallmark').length,
    failedPieces: allResults.filter(r => r.outcome === 'FAILED').length,
    shortfallPieces,
  };
}
