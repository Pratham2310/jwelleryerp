/**
 * Inter-Branch Stock Transfer — IBST (PRD §2/§9.5, Milestone 20).
 *
 * The load-bearing rule here is decision D-7: "a tag can never be sellable at two branches
 * simultaneously." That is satisfied structurally rather than by convention — a dispatched
 * Tag moves to `TransferInTransit`, which `isSellable()` returns false for, so the piece is
 * invisible to BOTH branches' sellable stock until it is accepted somewhere. There is no
 * window in which two counters could sell the same physical ornament.
 */

import type { StockTransfer, StockTransferStatus, Tag, MetalRate, Branch } from '../types';

export const TRANSFER_STATUS_LABEL: Record<StockTransferStatus, string> = {
  Draft: 'Draft',
  InTransit: 'In Transit',
  Received: 'Received',
  PartiallyReceived: 'Partially Received',
  Rejected: 'Rejected — Returned',
};

/** Terminal once the goods have landed somewhere; a settled transfer is never reopened. */
const TERMINAL: ReadonlySet<StockTransferStatus> = new Set([
  'Received',
  'PartiallyReceived',
  'Rejected',
]);

const TRANSITIONS: Record<StockTransferStatus, StockTransferStatus[]> = {
  Draft: ['InTransit'],
  // The destination decides: everything accepted, everything refused, or a mix.
  InTransit: ['Received', 'PartiallyReceived', 'Rejected'],
  Received: [],
  PartiallyReceived: [],
  Rejected: [],
};

export function canTransitionTransfer(from: StockTransferStatus, to: StockTransferStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isSettled(status: StockTransferStatus): boolean {
  return TERMINAL.has(status);
}

/** One consecutive transfer series per shop — a challan series, not a tax-invoice series. */
export function nextTransferNumber(existing: StockTransfer[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `TRF-${year}-`;
  const highest = existing
    .map(t => t.transferNo)
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

export interface TransferDraft {
  fromBranchId?: string;
  toBranchId?: string;
  tagIds?: string[];
}

export function validateTransferDraft(draft: TransferDraft, tags: Tag[]): string | null {
  if (!draft.fromBranchId) return 'Select the branch dispatching the stock.';
  if (!draft.toBranchId) return 'Select the destination branch.';
  if (draft.fromBranchId === draft.toBranchId) {
    return 'Source and destination branch must be different.';
  }
  if (!draft.tagIds?.length) return 'Select at least one piece to transfer.';

  // Every selected piece must actually be at the source branch and sellable right now —
  // otherwise a piece already out for jobwork or in another transfer could be dispatched twice.
  const selected = tags.filter(t => draft.tagIds!.includes(t.id));
  if (selected.length !== draft.tagIds.length) {
    return 'One or more selected pieces could not be found.';
  }
  const wrongBranch = selected.find(t => t.branchId !== draft.fromBranchId);
  if (wrongBranch) {
    return `${wrongBranch.sku} is not held at the dispatching branch.`;
  }
  const notAvailable = selected.find(t => t.status !== 'InStock' && t.status !== 'InShowcase');
  if (notAvailable) {
    return `${notAvailable.sku} is not available to dispatch (currently ${notAvailable.status}).`;
  }
  return null;
}

/**
 * Declared value of the consignment, used for the e-Way Bill threshold check.
 * Valued at metal + stone, deliberately excluding making charge: a stock transfer between a
 * shop's own branches is a movement of goods, not a sale, so there is no value addition to
 * declare (PRD §9.5).
 */
export function transferValue(tags: Tag[], rates: MetalRate[]): number {
  return Math.round(
    tags.reduce((sum, t) => {
      const rate = rates.find(r => r.metalType === t.metalType)?.ratePerGram ?? 0;
      return sum + t.netWeight * rate + (t.stoneCharge || 0);
    }, 0)
  );
}

/**
 * PRD §9.5: an e-Way Bill is required above a state-notified threshold, "commonly ₹50,000,
 * but many states have special thresholds specifically for jewellery... must be configurable
 * per state." The default below is the common figure; making it genuinely per-state is
 * Milestone 34's Statutory Parameters screen. The actual e-Way Bill generation is Milestone 22 —
 * this only flags that one is needed.
 */
export const DEFAULT_EWAY_THRESHOLD = 50000;

export function requiresEWayBill(value: number, threshold: number = DEFAULT_EWAY_THRESHOLD): boolean {
  return (Number(value) || 0) > threshold;
}

export interface TransferSummary {
  total: number;
  inTransit: number;
  awaitingDispatch: number;
  piecesInTransit: number;
}

export function summariseTransfers(transfers: StockTransfer[]): TransferSummary {
  const inTransit = transfers.filter(t => t.status === 'InTransit');
  return {
    total: transfers.length,
    inTransit: inTransit.length,
    awaitingDispatch: transfers.filter(t => t.status === 'Draft').length,
    piecesInTransit: inTransit.reduce((s, t) => s + t.tagIds.length, 0),
  };
}

/**
 * Resolves the final status from a per-piece accept/reject decision at the destination.
 * Partial receipt is the realistic case — a consignment can arrive with one piece damaged.
 */
export function resolveReceiptStatus(acceptedIds: string[], allIds: string[]): StockTransferStatus {
  if (acceptedIds.length === 0) return 'Rejected';
  if (acceptedIds.length === allIds.length) return 'Received';
  return 'PartiallyReceived';
}

export function branchName(branches: Branch[], id: string): string {
  return branches.find(b => b.id === id)?.name ?? 'Unknown branch';
}
