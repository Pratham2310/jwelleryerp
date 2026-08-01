/**
 * Purchase Order (PRD §6.1, Milestone 38).
 *
 * The first step of the procurement chain: PO → Goods Receipt (M39) → Purchase Invoice (M40).
 * A shop buys raw bullion from dealers and finished pieces from wholesalers, and until this
 * milestone there was no document recording either intent.
 *
 * ─── The one that is easy to get wrong: unfixed-rate purchases ─────────────────────────
 * Bullion is very often bought on an **unfixed** basis. The shop books the metal now and fixes
 * the rate later — at delivery, or on a nominated date — because gold moves daily and neither
 * side wants to carry that risk at order time. An unfixed PO therefore has a *weight* but **no
 * rupee value at all** until the rate is fixed.
 *
 * That is why `poValue()` returns `null` rather than 0 for an unfixed order. Zero would quietly
 * flow into a commitment total and understate what the shop has actually agreed to buy; a made-up
 * value using today's rate would be worse, because it would look authoritative while being a
 * guess. Callers must handle "not yet priced" explicitly, and the UI says so in words.
 */

import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, MetalRate } from '../types';
import { financialYearOf } from './eInvoice';
import { sumMoney, sumWeight, roundWeight } from './money';

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  Draft: 'Draft',
  Sent: 'Sent to Supplier',
  PartiallyReceived: 'Partially Received',
  Closed: 'Closed',
  Cancelled: 'Cancelled',
};

const TERMINAL: ReadonlySet<PurchaseOrderStatus> = new Set(['Closed', 'Cancelled']);

const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  Draft: ['Sent', 'Cancelled'],
  // Receipts drive the middle of the lifecycle; a PO can also be closed short or cancelled.
  Sent: ['PartiallyReceived', 'Closed', 'Cancelled'],
  PartiallyReceived: ['Closed', 'Cancelled'],
  Closed: [],
  Cancelled: [],
};

export function canTransitionPo(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isPoSettled(status: PurchaseOrderStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * `PO-<FY>-nnn`, e.g. `PO-2026-27-014`.
 *
 * The series is per financial year because that is how a purchase register is read and audited.
 * `financialYearOf()` is reused from Milestone 22 rather than re-deriving April–March here — an
 * off-by-one at the year boundary would silently restart the series mid-year.
 */
export function nextPoNumber(existing: PurchaseOrder[], onIsoDate: string): string {
  const fy = financialYearOf(onIsoDate);
  const prefix = `PO-${fy}-`;
  const highest = existing
    .map(p => p.poNumber)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

/* ─────────────────────────────── Line progress ─────────────────────────────── */

export interface LineProgress {
  ordered: number;
  received: number;
  outstanding: number;
  isComplete: boolean;
  /** Received more than ordered — a real occurrence with bullion, and worth surfacing. */
  isOverReceived: boolean;
  unit: 'g' | 'pcs';
}

export function lineProgress(line: PurchaseOrderLine): LineProgress {
  const raw = line.kind === 'RAW_METAL';
  const ordered = raw ? roundWeight(line.orderedWeight || 0) : Math.max(0, line.orderedQty || 0);
  const received = raw ? roundWeight(line.receivedWeight || 0) : Math.max(0, line.receivedQty || 0);
  return {
    ordered,
    received,
    outstanding: Math.max(0, raw ? roundWeight(ordered - received) : ordered - received),
    isComplete: received >= ordered && ordered > 0,
    isOverReceived: received > ordered,
    unit: raw ? 'g' : 'pcs',
  };
}

/**
 * The status a PO's receipts imply.
 *
 * Deliberately does NOT return `Closed` merely because nothing is outstanding on paper — closing
 * is a decision, not an arithmetic result. A shop may close a PO short when a dealer cannot
 * supply the balance, and may leave a fully-received PO open pending the invoice. This returns
 * what the receipts justify; `canTransitionPo()` governs what is actually allowed.
 */
export function resolvePoStatusFromReceipts(po: PurchaseOrder): PurchaseOrderStatus {
  if (isPoSettled(po.status)) return po.status;
  const anyReceived = po.lines.some(l => lineProgress(l).received > 0);
  if (!anyReceived) return po.status === 'Draft' ? 'Draft' : 'Sent';
  return 'PartiallyReceived';
}

/** True when every line has been received in full — what makes closing reasonable. */
export function isFullyReceived(po: PurchaseOrder): boolean {
  return po.lines.length > 0 && po.lines.every(l => lineProgress(l).isComplete);
}

/* ─────────────────────────────── Valuation ─────────────────────────────── */

/**
 * The committed value of a PO, or `null` when it cannot yet be known.
 *
 * Returns null for an UNFIXED-rate order — see the module header. Callers must render that as
 * "rate to be fixed", never as ₹0.
 */
export function poValue(po: PurchaseOrder): number | null {
  if (po.rateBasis === 'UNFIXED') return null;

  return sumMoney(po.lines.map(line => {
    if (line.kind === 'RAW_METAL') {
      return (line.orderedWeight || 0) * (line.ratePerGram || 0);
    }
    return (line.orderedQty || 0) * (line.ratePerPiece || 0);
  }));
}

/** Fine-gold weight committed, which is meaningful even when the rupee value is not. */
export function poCommittedWeight(po: PurchaseOrder): number {
  return sumWeight(
    po.lines.filter(l => l.kind === 'RAW_METAL').map(l => l.orderedWeight || 0)
  );
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export interface PoDraft {
  supplierId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  rateBasis?: PurchaseOrder['rateBasis'];
  lines?: PurchaseOrderLine[];
  branchId?: string;
}

export function validatePoDraft(draft: PoDraft): string | null {
  if (!draft.supplierId) return 'Select the supplier this order goes to.';
  if (!draft.orderDate) return 'Set the order date.';
  if (!draft.branchId) return 'Select the branch the goods will be delivered to.';

  if (draft.expectedDeliveryDate && draft.expectedDeliveryDate < draft.orderDate) {
    return 'Expected delivery cannot be before the order date.';
  }

  const lines = draft.lines ?? [];
  if (lines.length === 0) return 'Add at least one line to the order.';

  for (const [i, line] of lines.entries()) {
    const label = line.description?.trim() || `Line ${i + 1}`;
    if (!line.description?.trim()) return `Line ${i + 1}: describe what is being ordered.`;

    if (line.kind === 'RAW_METAL') {
      if (!line.metalType) return `${label}: select the metal.`;
      const weight = Number(line.orderedWeight);
      if (!Number.isFinite(weight) || weight <= 0) return `${label}: enter the weight to order.`;

      const purity = Number(line.purityPercent);
      if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
        return `${label}: enter the purity being bought (0–100%).`;
      }
    } else {
      const qty = Number(line.orderedQty);
      if (!Number.isInteger(qty) || qty <= 0) return `${label}: enter a whole number of pieces.`;
    }

    /**
     * A FIXED-rate order must actually carry the rate. Without it the order has no value, which
     * is indistinguishable from an unfixed order — and the whole point of choosing FIXED is that
     * the price was agreed up front.
     */
    if (draft.rateBasis === 'FIXED') {
      const rate = line.kind === 'RAW_METAL' ? Number(line.ratePerGram) : Number(line.ratePerPiece);
      if (!Number.isFinite(rate) || rate <= 0) {
        return `${label}: a fixed-rate order needs an agreed rate. Choose "rate to be fixed" if it is not settled yet.`;
      }
    }
  }
  return null;
}

export function validatePoCancellation(po: PurchaseOrder, reason: string): string | null {
  if (isPoSettled(po.status)) {
    return `${po.poNumber} is already ${PO_STATUS_LABEL[po.status].toLowerCase()}.`;
  }
  // Cancelling an order goods have already arrived against would orphan those receipts.
  if (po.lines.some(l => lineProgress(l).received > 0)) {
    return 'Goods have already been received against this order — close it short instead of cancelling.';
  }
  if (reason.trim().length < 5) return 'Record why the order is being cancelled.';
  return null;
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface PoSummary {
  total: number;
  open: number;
  awaitingDelivery: number;
  partiallyReceived: number;
  overdue: number;
  committedValue: number;
  /** POs whose value is genuinely unknown because the rate is not yet fixed. */
  unpricedOrders: number;
  committedWeight: number;
}

export function summarisePos(
  pos: PurchaseOrder[],
  today: string = new Date().toISOString().slice(0, 10)
): PoSummary {
  const live = pos.filter(p => !isPoSettled(p.status));
  const priced = live.map(poValue).filter((v): v is number => v !== null);

  return {
    total: pos.length,
    open: live.length,
    awaitingDelivery: live.filter(p => p.status === 'Sent').length,
    partiallyReceived: live.filter(p => p.status === 'PartiallyReceived').length,
    overdue: live.filter(p => p.expectedDeliveryDate && p.expectedDeliveryDate < today).length,
    committedValue: sumMoney(priced),
    unpricedOrders: live.length - priced.length,
    committedWeight: sumWeight(live.map(poCommittedWeight)),
  };
}

/** Open orders a goods receipt can be booked against (Milestone 39). */
export function receivablePos(pos: PurchaseOrder[], supplierId?: string): PurchaseOrder[] {
  return pos.filter(p =>
    (p.status === 'Sent' || p.status === 'PartiallyReceived') &&
    (!supplierId || p.supplierId === supplierId)
  );
}

export function metalRateFor(metalType: string, rates: MetalRate[]): number {
  return rates.find(r => r.metalType === metalType)?.ratePerGram ?? 0;
}
