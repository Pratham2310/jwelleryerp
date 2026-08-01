/**
 * Goods Receipt Note — GRN (PRD §6.1, Milestone 39).
 *
 * This is the milestone that closes the actual hole. Until now stock existed only because the
 * seed data said so; a receipt is where bought metal and pieces become real records.
 *
 * ─── Two things this has to get right ─────────────────────────────────────────────────
 *
 * **1. Tested purity is not ordered purity, and the difference is money.**
 * A bullion contract specifies a fineness. What arrives is assayed, and if it comes in below
 * spec the shop has paid for gold it did not receive. The gap is small in percentage points and
 * large in rupees: 100g contracted at 99.9% and delivered at 99.5% is 0.4g of fine gold, roughly
 * ₹2,900 at 7,250/g. `assessPurityVariance()` states the shortfall in grams AND in money, so it
 * is a claim against the supplier rather than a rounding curiosity nobody notices.
 *
 * **2. Received goods enter the Tag lifecycle, they do not bypass it.**
 * Raw metal becomes a Tag at `RawMetal` — a state the machine has always had and nothing has
 * ever produced until now. Finished goods enter at `PendingHallmark`, NOT `InStock`, unless the
 * supplier already supplied a HUID. That matters: entering at `InStock` would let a purchased
 * piece be sold without ever passing the Milestone 25 hallmarking guard, which is exactly the
 * compliance hole that guard exists to close.
 *
 * A supplier-supplied HUID is checked for global uniqueness with the same Milestone 24 validator
 * used at the assaying centre — a HUID belongs to one physical piece for its whole life, wherever
 * it was first engraved.
 */

import type {
  GoodsReceipt, GoodsReceiptLine, PurchaseOrder, PurchaseOrderLine, Tag, ItemDesign, MetalStandard,
} from '../types';
import { financialYearOf } from './eInvoice';
import { sumWeight, roundWeight, multiplyMoney, roundMoney } from './money';
import { validateHuidAssignment } from './hallmarking';

/**
 * Assay tolerance for a *contracted* purchase, in percentage points.
 *
 * Deliberately tighter than the 0.2 used for hallmarking (`hallmarking.ts`): a hallmark assay
 * certifies what a finished ornament turned out to be, whereas a bullion purchase is bought to a
 * stated fineness. A dealer delivering 0.15 points under spec is short-changing the shop, not
 * exhibiting measurement noise.
 */
export const PURCHASE_PURITY_TOLERANCE = 0.05;

export interface PurityVariance {
  orderedPurityPercent: number;
  testedPurityPercent: number;
  /** Percentage points, positive when the delivery is finer than contracted. */
  variancePoints: number;
  fineGoldExpected: number;
  fineGoldActual: number;
  /** Positive = the shop received less fine gold than it contracted for. */
  fineGoldShortfall: number;
  /** Rupee impact, or null when the rate is not yet fixed and so cannot be valued. */
  valueImpact: number | null;
  severity: 'MATCH' | 'SHORTFALL' | 'OVER_DELIVERED';
  requiresReview: boolean;
  message: string | null;
}

export function assessPurityVariance(
  orderedPurityPercent: number,
  testedPurityPercent: number,
  receivedWeight: number,
  ratePerGram?: number
): PurityVariance {
  const ordered = Number(orderedPurityPercent) || 0;
  const tested = Number(testedPurityPercent) || 0;
  const weight = roundWeight(receivedWeight);

  const fineGoldExpected = roundWeight((weight * ordered) / 100);
  const fineGoldActual = roundWeight((weight * tested) / 100);
  const fineGoldShortfall = roundWeight(fineGoldExpected - fineGoldActual);
  const variancePoints = Number((tested - ordered).toFixed(3));

  // Only valuable when a rate exists — an unfixed-rate purchase has no price to value against.
  const valueImpact = ratePerGram && ratePerGram > 0
    ? roundMoney(multiplyMoney(fineGoldShortfall, ratePerGram))
    : null;

  if (variancePoints < -PURCHASE_PURITY_TOLERANCE) {
    const money = valueImpact !== null ? ` — about ₹${Math.abs(valueImpact).toLocaleString('en-IN')} of gold` : '';
    return {
      orderedPurityPercent: ordered, testedPurityPercent: tested, variancePoints,
      fineGoldExpected, fineGoldActual, fineGoldShortfall, valueImpact,
      severity: 'SHORTFALL',
      requiresReview: true,
      message: `Assayed ${tested}% against ${ordered}% contracted — ${Math.abs(fineGoldShortfall).toFixed(3)}g of fine gold short${money}. Raise it with the supplier before booking the invoice.`,
    };
  }

  if (variancePoints > PURCHASE_PURITY_TOLERANCE) {
    return {
      orderedPurityPercent: ordered, testedPurityPercent: tested, variancePoints,
      fineGoldExpected, fineGoldActual, fineGoldShortfall, valueImpact,
      severity: 'OVER_DELIVERED',
      requiresReview: false,
      message: `Assayed ${tested}% against ${ordered}% contracted — ${Math.abs(fineGoldShortfall).toFixed(3)}g finer than ordered.`,
    };
  }

  return {
    orderedPurityPercent: ordered, testedPurityPercent: tested, variancePoints,
    fineGoldExpected, fineGoldActual, fineGoldShortfall, valueImpact,
    severity: 'MATCH', requiresReview: false, message: null,
  };
}

/** Weight delivered against weight ordered. Short delivery is normal; over-delivery is not an error. */
export function weightVariance(orderedWeight: number, receivedWeight: number): number {
  return roundWeight(roundWeight(receivedWeight) - roundWeight(orderedWeight));
}

/* ─────────────────────────────── Numbering ─────────────────────────────── */

export function nextGrnNumber(existing: GoodsReceipt[], onIsoDate: string): string {
  const prefix = `GRN-${financialYearOf(onIsoDate)}-`;
  const highest = existing
    .map(g => g.grnNumber)
    .filter(n => n?.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

/* ─────────────────────────────── Piece weights ─────────────────────────────── */

/**
 * Parses the per-piece weights of a finished-goods receipt.
 *
 * Each piece is weighed individually rather than the total being divided by the count. That is
 * decision **D-6**: "no two Tags of the same design are identical", and averaging would create
 * stock whose recorded weights are all subtly wrong — every one of which then prices a sale.
 */
export function parsePieceWeights(input: string): number[] {
  return (input || '')
    .split(/[,\s]+/)
    .map(v => v.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0)
    .map(roundWeight);
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export interface GrnDraft {
  supplierId?: string;
  receiptDate?: string;
  purchaseOrderId?: string;
  supplierDcNumber?: string;
  lines?: GoodsReceiptLine[];
  branchId?: string;
}

export function validateGrnDraft(draft: GrnDraft, allTags: Tag[] = []): string | null {
  if (!draft.supplierId) return 'Select the supplier the goods came from.';
  if (!draft.receiptDate) return 'Set the receipt date.';
  if (!draft.branchId) return 'Select the branch receiving the goods.';

  const lines = draft.lines ?? [];
  if (lines.length === 0) return 'Add at least one received line.';

  // HUIDs supplied across this receipt, so two pieces in one delivery cannot share one.
  const pendingHuids = lines.flatMap(l => l.pieceHuids ?? []).filter(Boolean);

  for (const [i, line] of lines.entries()) {
    const label = line.description?.trim() || `Line ${i + 1}`;
    if (!line.description?.trim()) return `Line ${i + 1}: describe what was received.`;

    if (line.kind === 'RAW_METAL') {
      if (!line.metalType) return `${label}: select the metal received.`;
      const weight = Number(line.receivedWeight);
      if (!Number.isFinite(weight) || weight <= 0) return `${label}: enter the weight received.`;

      const tested = Number(line.testedPurityPercent);
      if (!Number.isFinite(tested) || tested <= 0 || tested > 100) {
        // Without a tested purity there is nothing to compare against, and the shortfall that
        // this whole milestone exists to catch would pass unnoticed.
        return `${label}: enter the assayed purity (0–100%). It is what the shortfall check compares against.`;
      }
    } else {
      const weights = line.pieceWeights ?? [];
      const qty = Number(line.receivedQty);
      if (!Number.isInteger(qty) || qty <= 0) return `${label}: enter a whole number of pieces.`;
      if (weights.length !== qty) {
        return `${label}: ${qty} piece(s) received but ${weights.length} weight(s) entered — each piece is weighed individually.`;
      }
      if (weights.some(w => w <= 0)) return `${label}: every piece needs a positive weight.`;
      if (!line.itemDesignId) return `${label}: select which design these pieces are.`;

      for (const huid of line.pieceHuids ?? []) {
        if (!huid?.trim()) continue;
        const err = validateHuidAssignment(huid, allTags, '', pendingHuids);
        if (err) return `${label}: ${err}`;
      }
    }
  }
  return null;
}

/* ─────────────────────────────── Effects ─────────────────────────────── */

/**
 * Builds the Tag records a receipt creates.
 *
 * Raw metal lands at `RawMetal`; finished goods at `PendingHallmark` unless the supplier already
 * engraved a HUID, in which case `InStock`. Entering finished goods straight into `InStock`
 * without a HUID would let a purchased piece be sold without ever meeting the Milestone 25
 * guard — the precise hole that guard exists to close.
 */
export function buildReceivedTags(
  grn: GoodsReceipt,
  designs: ItemDesign[],
  existingTagCount: number
): Tag[] {
  const created: Tag[] = [];
  let seq = existingTagCount;

  for (const line of grn.lines) {
    if (line.kind === 'RAW_METAL') {
      seq += 1;
      const weight = roundWeight(line.receivedWeight || 0);
      created.push({
        id: `tag-grn-${grn.id}-${seq}`,
        sku: `RAW-${(line.metalType || '').replace(/\D/g, '') || 'XX'}-${String(seq).padStart(4, '0')}`,
        itemDesignId: '',
        name: line.description,
        category: 'Coins', // bullion is the closest existing category; not a sellable ornament
        metalType: (line.metalType || 'Gold (24K)') as MetalStandard,
        grossWeight: weight,
        netWeight: weight,
        wastagePercent: 0,
        makingChargeType: 'flat',
        makingChargeValue: 0,
        stoneType: 'None',
        stoneWeight: 0,
        stoneCharge: 0,
        stockOwnershipType: 'OWNED',
        status: 'RawMetal',
        branchId: grn.branchId,
      });
      continue;
    }

    const design = designs.find(d => d.id === line.itemDesignId);
    (line.pieceWeights ?? []).forEach((weight, i) => {
      seq += 1;
      const huid = (line.pieceHuids ?? [])[i]?.trim() || undefined;
      created.push({
        id: `tag-grn-${grn.id}-${seq}`,
        sku: `${design?.designCode || 'PUR'}-${String(seq).padStart(4, '0')}`,
        itemDesignId: line.itemDesignId || '',
        name: design?.name || line.description,
        category: design?.category || 'Rings',
        metalType: (design?.metalType || 'Gold (22K)') as MetalStandard,
        grossWeight: roundWeight(weight),
        netWeight: roundWeight(weight),
        wastagePercent: design?.defaultWastagePercent ?? 0,
        makingChargeType: design?.defaultMakingChargeType ?? 'per-gram',
        makingChargeValue: design?.defaultMakingChargeValue ?? 0,
        stoneType: design?.defaultStoneType ?? 'None',
        stoneWeight: 0,
        stoneCharge: 0,
        huid,
        stockOwnershipType: 'OWNED',
        // A supplier-hallmarked piece is sellable; anything else must be hallmarked first.
        status: huid ? 'InStock' : 'PendingHallmark',
        branchId: grn.branchId,
      });
    });
  }
  return created;
}

/** Folds a receipt back onto its purchase order's line progress (Milestone 38). */
export function applyReceiptToPo(po: PurchaseOrder, grn: GoodsReceipt): PurchaseOrder {
  const lines: PurchaseOrderLine[] = po.lines.map(poLine => {
    const received = grn.lines.filter(g => g.purchaseOrderLineId === poLine.id);
    if (received.length === 0) return poLine;

    if (poLine.kind === 'RAW_METAL') {
      return {
        ...poLine,
        receivedWeight: sumWeight([
          poLine.receivedWeight || 0,
          ...received.map(r => r.receivedWeight || 0),
        ]),
      };
    }
    return {
      ...poLine,
      receivedQty: (poLine.receivedQty || 0) + received.reduce((s, r) => s + (r.receivedQty || 0), 0),
    };
  });

  return { ...po, lines, status: po.status === 'Sent' ? 'PartiallyReceived' : po.status };
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface GrnSummary {
  total: number;
  metalReceived: number;
  piecesReceived: number;
  linesWithShortfall: number;
  shortfallFineGold: number;
  shortfallValue: number;
}

export function summariseGrns(receipts: GoodsReceipt[]): GrnSummary {
  const allLines = receipts.flatMap(r => r.lines);
  const shortfalls = allLines
    .filter(l => l.kind === 'RAW_METAL' && l.orderedPurityPercent && l.testedPurityPercent)
    .map(l => assessPurityVariance(
      l.orderedPurityPercent!, l.testedPurityPercent!, l.receivedWeight || 0, l.ratePerGram
    ))
    .filter(v => v.severity === 'SHORTFALL');

  return {
    total: receipts.length,
    metalReceived: sumWeight(allLines.filter(l => l.kind === 'RAW_METAL').map(l => l.receivedWeight || 0)),
    piecesReceived: allLines.reduce((s, l) => s + (l.receivedQty || 0), 0),
    linesWithShortfall: shortfalls.length,
    shortfallFineGold: sumWeight(shortfalls.map(v => v.fineGoldShortfall)),
    shortfallValue: shortfalls.reduce((s, v) => s + (v.valueImpact || 0), 0),
  };
}
