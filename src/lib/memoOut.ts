/**
 * Approval / Memo-Out Workflow (Milestone 56, PRD §5.5).
 *
 * A customer takes a piece home to show the family before deciding. In Indian jewellery retail
 * this is routine and it is how a large sale often closes — but it is also the moment the shop's
 * most valuable stock walks out of the door on a promise.
 *
 * The `MemoOut` tag status has existed since Milestone 4 and the state machine already allows
 * `InStock → MemoOut → {InStock, Sold}`. What was missing is the workflow around it: who took it,
 * when it is due back, what it is worth, and what happens when it does not come back.
 *
 * ─── Memo stock is still the shop's asset ─────────────────────────────────────────────
 * This is the one case where "in stock" and "sellable" genuinely differ. The piece is still owned
 * by the shop and still on its balance sheet — but it cannot be sold to a walk-in, because it is
 * not in the building. `inventoryDashboard.ts` already separates these two ideas
 * (`HELD_NOT_SELLABLE`), and this module is why that distinction had to exist.
 *
 * Contrast with a repair (M54), which is the mirror image: the customer's property held by the
 * shop, rather than the shop's property held by the customer. Neither belongs in sellable stock,
 * and they belong on opposite sides of the balance sheet.
 *
 * ─── Why KYC above a threshold ────────────────────────────────────────────────────────
 * Handing over ₹5,00,000 of gold against a phone number is not a controlled risk. Above a
 * configurable value the memo requires an identity reference on file. That is a shop-policy
 * control rather than a statutory one, so the threshold is data, not a constant (same argument as
 * Milestone 34).
 */

import type { Tag } from '../types';
import { canTransition, isSellable, type TagStatus } from './tagStateMachine';
import { roundMoney, sumMoney } from './money';

export type MemoLineOutcome = 'OUT' | 'RETURNED' | 'SOLD';

export interface MemoLine {
  tagId: string;
  sku: string;
  /** Value when it left the shop. What is at risk is what it was worth on the day. */
  declaredValuePaisa: number;
  outcome: MemoLineOutcome;
  settledOn?: string;
}

export type MemoStatus = 'Issued' | 'PartiallySettled' | 'Closed';

export interface MemoVoucher {
  id: string;
  memoNumber: string;
  issuedOn: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  /** PAN, Aadhaar reference or similar. Required above `MEMO_KYC_THRESHOLD_PAISA`. */
  kycReference?: string;
  dueBackDate: string;
  issuedBy: string;
  lines: MemoLine[];
  note?: string;
  branchId?: string;
}

/** Above this, an identity reference is required. Shop policy, so it lives as data. */
export const MEMO_KYC_THRESHOLD_PAISA = 10000000; // ₹1,00,000

/** Statuses a piece may go out on memo from — it has to be sellable stock in the building. */
export function canIssueFrom(status: TagStatus): boolean {
  return isSellable(status) && canTransition(status, 'MemoOut');
}

/* ─────────────────────────────── Derived state ─────────────────────────────── */

/**
 * Status is **derived from the lines**, never stored. A memo with three pieces where two came
 * back and one sold is settled; storing a status alongside the lines is how the two drift apart.
 */
export function memoStatus(memo: MemoVoucher): MemoStatus {
  const out = memo.lines.filter(l => l.outcome === 'OUT').length;
  if (out === 0) return 'Closed';
  if (out < memo.lines.length) return 'PartiallySettled';
  return 'Issued';
}

export function outstandingLines(memo: MemoVoucher): MemoLine[] {
  return memo.lines.filter(l => l.outcome === 'OUT');
}

/** What is still out of the building on this memo, at the value it left at. */
export function valueAtRisk(memo: MemoVoucher): number {
  return roundMoney(sumMoney(outstandingLines(memo).map(l => l.declaredValuePaisa)));
}

export function isMemoOverdue(
  memo: MemoVoucher,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  return outstandingLines(memo).length > 0 && memo.dueBackDate < today;
}

export function daysOverdue(
  memo: MemoVoucher,
  today: string = new Date().toISOString().slice(0, 10)
): number {
  if (!isMemoOverdue(memo, today)) return 0;
  const due = new Date(`${memo.dueBackDate}T00:00:00Z`).getTime();
  const now = new Date(`${today}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((now - due) / 86400000));
}

/* ─────────────────────────────── Issuing ─────────────────────────────── */

export interface MemoDraft {
  tagIds: string[];
  customerName: string;
  customerPhone: string;
  kycReference?: string;
  dueBackDate: string;
  issuedBy: string;
}

export function declaredValueOf(tags: Tag[], ratePerGramPaisaFor: (metalType: string) => number): number {
  return roundMoney(
    tags.reduce((sum, t) => {
      const rate = ratePerGramPaisaFor(t.metalType);
      const making = t.makingChargeType === 'flat'
        ? (t.makingChargeValue || 0) * 100
        : (t.makingChargeValue || 0) * 100 * t.netWeight;
      return sum + (t.netWeight * rate) + ((t.stoneCharge || 0) * 100) + making;
    }, 0)
  );
}

export function validateMemo(
  draft: MemoDraft,
  tags: Tag[],
  openMemos: MemoVoucher[],
  totalValuePaisa: number
): string | null {
  if (draft.tagIds.length === 0) return 'Select at least one piece to send out.';
  if (!draft.customerName?.trim()) return 'Record who is taking the pieces.';
  if (!/^\d{10}$/.test((draft.customerPhone ?? '').replace(/\D/g, '').slice(-10))) {
    return 'A contactable phone number is required — stock is leaving the building.';
  }
  if (!draft.dueBackDate) {
    // Without a due date nothing is ever overdue, and the piece quietly becomes shrinkage.
    return 'Set a date the pieces are due back. Without one, nothing is ever overdue.';
  }
  if (!draft.issuedBy?.trim()) return 'Record who authorised the memo.';

  const selected = tags.filter(t => draft.tagIds.includes(t.id));
  if (selected.length !== draft.tagIds.length) return 'One or more selected pieces no longer exist.';

  const notSellable = selected.find(t => !canIssueFrom(t.status));
  if (notSellable) {
    return `${notSellable.sku} cannot go out on memo from ${notSellable.status}.`;
  }

  // A piece already out on another memo cannot go out again — it is not in the building.
  const alreadyOut = new Set(
    openMemos.flatMap(m => outstandingLines(m).map(l => l.tagId))
  );
  const clash = selected.find(t => alreadyOut.has(t.id));
  if (clash) return `${clash.sku} is already out on another memo.`;

  if (totalValuePaisa >= MEMO_KYC_THRESHOLD_PAISA && !draft.kycReference?.trim()) {
    return `Pieces worth ₹${Math.round(totalValuePaisa / 100).toLocaleString('en-IN')} are leaving `
      + 'the shop. Record a PAN or ID reference before issuing.';
  }
  return null;
}

export function buildMemo(
  draft: MemoDraft,
  tags: Tag[],
  ratePerGramPaisaFor: (metalType: string) => number,
  memoNumber: string,
  issuedOn: string = new Date().toISOString().slice(0, 10),
  branchId?: string
): MemoVoucher {
  const selected = tags.filter(t => draft.tagIds.includes(t.id));
  return {
    id: `memo-${Date.now()}`,
    memoNumber,
    issuedOn,
    customerName: draft.customerName.trim(),
    customerPhone: draft.customerPhone.trim(),
    kycReference: draft.kycReference?.trim() || undefined,
    dueBackDate: draft.dueBackDate,
    issuedBy: draft.issuedBy.trim(),
    branchId,
    lines: selected.map(t => ({
      tagId: t.id,
      sku: t.sku,
      declaredValuePaisa: declaredValueOf([t], ratePerGramPaisaFor),
      outcome: 'OUT' as MemoLineOutcome,
    })),
  };
}

/** Moves the selected tags to `MemoOut`, always through the state machine. */
export function applyIssue(memo: MemoVoucher, tags: Tag[]): Tag[] {
  const ids = memo.lines.map(l => l.tagId);
  return tags.map(tag => {
    if (!ids.includes(tag.id)) return tag;
    if (!canTransition(tag.status, 'MemoOut')) return tag;
    return { ...tag, status: 'MemoOut' as TagStatus };
  });
}

/* ─────────────────────────────── Settling ─────────────────────────────── */

export function settleLine(
  memo: MemoVoucher,
  tagId: string,
  outcome: Exclude<MemoLineOutcome, 'OUT'>,
  settledOn: string = new Date().toISOString().slice(0, 10)
): MemoVoucher {
  return {
    ...memo,
    lines: memo.lines.map(l =>
      l.tagId === tagId && l.outcome === 'OUT' ? { ...l, outcome, settledOn } : l
    ),
  };
}

/**
 * A returned piece goes back to `InStock` — not `InShowcase`, because it needs checking before it
 * is displayed again, and the state machine allows the move on from there.
 */
export function applyReturn(tagId: string, tags: Tag[]): Tag[] {
  return tags.map(tag => {
    if (tag.id !== tagId) return tag;
    if (!canTransition(tag.status, 'InStock')) return tag;
    return { ...tag, status: 'InStock' as TagStatus };
  });
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface MemoSummary {
  openMemos: number;
  piecesOut: number;
  valueAtRiskPaisa: number;
  overdueMemos: number;
  overdueValuePaisa: number;
  convertedToSale: number;
}

export function summariseMemos(
  memos: MemoVoucher[],
  today: string = new Date().toISOString().slice(0, 10)
): MemoSummary {
  const open = memos.filter(m => memoStatus(m) !== 'Closed');
  const overdue = memos.filter(m => isMemoOverdue(m, today));

  return {
    openMemos: open.length,
    piecesOut: open.reduce((n, m) => n + outstandingLines(m).length, 0),
    valueAtRiskPaisa: roundMoney(sumMoney(open.map(valueAtRisk))),
    overdueMemos: overdue.length,
    overdueValuePaisa: roundMoney(sumMoney(overdue.map(valueAtRisk))),
    convertedToSale: memos.reduce(
      (n, m) => n + m.lines.filter(l => l.outcome === 'SOLD').length, 0
    ),
  };
}

/**
 * Conversion rate — of everything that has come back one way or the other, how much sold. The
 * number that tells an owner whether letting stock out is earning its risk.
 */
export function memoConversionRate(memos: MemoVoucher[]): number {
  const settled = memos.flatMap(m => m.lines.filter(l => l.outcome !== 'OUT'));
  if (settled.length === 0) return 0;
  const sold = settled.filter(l => l.outcome === 'SOLD').length;
  return Math.round((sold / settled.length) * 1000) / 10;
}

export function nextMemoNumber(existing: MemoVoucher[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `MEMO-${year}-`;
  const highest = existing
    .filter(m => m.memoNumber.startsWith(prefix))
    .reduce((max, m) => Math.max(max, Number(m.memoNumber.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}
