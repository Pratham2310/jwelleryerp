import { describe, it, expect } from 'vitest';
import {
  assessPurityVariance,
  weightVariance,
  nextGrnNumber,
  parsePieceWeights,
  validateGrnDraft,
  buildReceivedTags,
  applyReceiptToPo,
  summariseGrns,
  PURCHASE_PURITY_TOLERANCE,
} from './goodsReceipt';
import { isSellable } from './tagStateMachine';
import type { GoodsReceipt, GoodsReceiptLine, PurchaseOrder, ItemDesign, Tag } from '../types';

function rawLine(over: Partial<GoodsReceiptLine> = {}): GoodsReceiptLine {
  return {
    id: 'g1', kind: 'RAW_METAL', description: '100g 24K bullion bar',
    metalType: 'Gold (24K)', receivedWeight: 100,
    orderedPurityPercent: 99.9, testedPurityPercent: 99.9, ratePerGram: 7250, ...over,
  };
}

function goodsLine(over: Partial<GoodsReceiptLine> = {}): GoodsReceiptLine {
  return {
    id: 'g2', kind: 'FINISHED_GOODS', description: 'Temple choker',
    itemDesignId: 'design-2', receivedQty: 2, pieceWeights: [41.2, 39.8], ...over,
  };
}

function grn(over: Partial<GoodsReceipt> = {}): GoodsReceipt {
  return {
    id: 'grn1', grnNumber: 'GRN-2026-27-001', supplierId: 'sup-1',
    receiptDate: '2026-07-20', lines: [rawLine()], createdTagIds: [], branchId: 'br-1', ...over,
  };
}

const designs: ItemDesign[] = [{
  id: 'design-2', designCode: 'NEC-22K-042', name: 'Temple Heritage Kundan Choker',
  category: 'Necklaces', metalType: 'Gold (22K)', defaultWastagePercent: 5,
  defaultMakingChargeType: 'per-gram', defaultMakingChargeValue: 650,
  defaultStoneType: 'Cubic Zirconia', isActive: true,
}];

describe('assessPurityVariance — the gap between contracted and assayed is money', () => {
  it('passes a delivery that meets spec', () => {
    const v = assessPurityVariance(99.9, 99.9, 100, 7250);
    expect(v.severity).toBe('MATCH');
    expect(v.fineGoldShortfall).toBe(0);
    expect(v.message).toBeNull();
  });

  it('quantifies a shortfall in fine grams AND rupees', () => {
    // 100g at 99.9% contracted = 99.9g fine; delivered at 99.5% = 99.5g fine.
    const v = assessPurityVariance(99.9, 99.5, 100, 7250);
    expect(v.severity).toBe('SHORTFALL');
    expect(v.fineGoldExpected).toBe(99.9);
    expect(v.fineGoldActual).toBe(99.5);
    expect(v.fineGoldShortfall).toBeCloseTo(0.4, 3);
    expect(v.valueImpact).toBe(2900); // 0.4g x 7250
    expect(v.requiresReview).toBe(true);
    expect(v.message).toMatch(/0\.400g of fine gold short/);
    expect(v.message).toMatch(/₹2,900/);
  });

  it('tolerates genuine measurement noise', () => {
    expect(assessPurityVariance(99.9, 99.9 - PURCHASE_PURITY_TOLERANCE, 100, 7250).severity).toBe('MATCH');
  });

  it('is tighter than the hallmarking tolerance, because this is a contracted spec', () => {
    // 0.15 points under spec is a dealer short-changing the shop, not assay noise.
    expect(PURCHASE_PURITY_TOLERANCE).toBeLessThan(0.2);
    expect(assessPurityVariance(99.9, 99.75, 100, 7250).severity).toBe('SHORTFALL');
  });

  it('reports over-delivery without demanding review', () => {
    const v = assessPurityVariance(91.6, 92.5, 100, 6650);
    expect(v.severity).toBe('OVER_DELIVERED');
    expect(v.requiresReview).toBe(false);
  });

  it('cannot value the shortfall when the rate is unfixed, and says null rather than zero', () => {
    const v = assessPurityVariance(99.9, 99.5, 100);
    expect(v.severity).toBe('SHORTFALL');
    expect(v.fineGoldShortfall).toBeCloseTo(0.4, 3);
    expect(v.valueImpact).toBeNull();
    expect(v.message).not.toMatch(/₹/);
  });

  it('scales the shortfall with the weight received', () => {
    expect(assessPurityVariance(99.9, 99.5, 1000, 7250).valueImpact).toBe(29000);
  });
});

describe('weightVariance', () => {
  it('is negative on a short delivery and positive on a heavy one', () => {
    expect(weightVariance(100, 98.5)).toBe(-1.5);
    expect(weightVariance(100, 100.5)).toBe(0.5);
    expect(weightVariance(100, 100)).toBe(0);
  });
});

describe('nextGrnNumber', () => {
  it('runs per financial year', () => {
    expect(nextGrnNumber([], '2026-04-01')).toBe('GRN-2026-27-001');
    expect(nextGrnNumber([], '2026-03-31')).toBe('GRN-2025-26-001');
  });

  it('continues from the highest, not the count', () => {
    expect(nextGrnNumber([grn({ grnNumber: 'GRN-2026-27-012' })], '2026-07-20')).toBe('GRN-2026-27-013');
  });
});

describe('parsePieceWeights — every piece is weighed individually (D-6)', () => {
  it('parses comma or space separated weights', () => {
    expect(parsePieceWeights('41.2, 39.8, 40')).toEqual([41.2, 39.8, 40]);
    expect(parsePieceWeights('41.2 39.8')).toEqual([41.2, 39.8]);
  });

  it('drops blanks and non-positive values rather than inventing zeros', () => {
    expect(parsePieceWeights('41.2, , -3, 0, 39.8')).toEqual([41.2, 39.8]);
  });

  it('is empty for empty input', () => {
    expect(parsePieceWeights('')).toEqual([]);
    expect(parsePieceWeights('   ')).toEqual([]);
  });
});

describe('validateGrnDraft', () => {
  const base = { supplierId: 'sup-1', receiptDate: '2026-07-20', branchId: 'br-1' };

  it('accepts a well-formed receipt', () => {
    expect(validateGrnDraft({ ...base, lines: [rawLine()] })).toBeNull();
  });

  it('requires supplier, date, branch and a line', () => {
    expect(validateGrnDraft({ ...base, supplierId: undefined, lines: [rawLine()] })).toMatch(/supplier/i);
    expect(validateGrnDraft({ ...base, receiptDate: undefined, lines: [rawLine()] })).toMatch(/receipt date/i);
    expect(validateGrnDraft({ ...base, branchId: undefined, lines: [rawLine()] })).toMatch(/branch/i);
    expect(validateGrnDraft({ ...base, lines: [] })).toMatch(/at least one/i);
  });

  it('insists on an assayed purity — it is what the shortfall check compares against', () => {
    const err = validateGrnDraft({ ...base, lines: [rawLine({ testedPurityPercent: undefined })] });
    expect(err).toMatch(/assayed purity/i);
    expect(err).toMatch(/shortfall check/i);
  });

  it('requires a weight on raw metal', () => {
    expect(validateGrnDraft({ ...base, lines: [rawLine({ receivedWeight: 0 })] })).toMatch(/weight received/i);
  });

  it('requires one weight per finished piece', () => {
    // Averaging would create stock whose weights are all subtly wrong, and each one prices a sale.
    const err = validateGrnDraft({ ...base, lines: [goodsLine({ receivedQty: 3 })] });
    expect(err).toMatch(/3 piece\(s\) received but 2 weight\(s\)/);
  });

  it('requires a design for finished goods', () => {
    expect(validateGrnDraft({ ...base, lines: [goodsLine({ itemDesignId: undefined })] }))
      .toMatch(/which design/i);
  });

  it('rejects a supplier HUID that collides with existing stock', () => {
    const existing: Tag[] = [{ ...({} as Tag), id: 't9', sku: 'X', huid: 'A1B2C3' } as Tag];
    const err = validateGrnDraft(
      { ...base, lines: [goodsLine({ pieceHuids: ['A1B2C3', ''] })] },
      existing
    );
    expect(err).toMatch(/never be reused/i);
  });

  it('rejects two pieces in one delivery sharing a HUID', () => {
    expect(validateGrnDraft({ ...base, lines: [goodsLine({ pieceHuids: ['ZZ1111', 'ZZ1111'] })] }))
      .toMatch(/twice in this batch/i);
  });

  it('accepts pieces with no supplier HUID at all', () => {
    expect(validateGrnDraft({ ...base, lines: [goodsLine({ pieceHuids: ['', ''] })] })).toBeNull();
  });
});

describe('buildReceivedTags — received goods enter the lifecycle, never bypass it', () => {
  it('creates raw metal at RawMetal, a state nothing produced before this', () => {
    const tags = buildReceivedTags(grn(), designs, 0);
    expect(tags).toHaveLength(1);
    expect(tags[0].status).toBe('RawMetal');
    expect(tags[0].netWeight).toBe(100);
    expect(isSellable(tags[0].status)).toBe(false);
  });

  it('creates one Tag per finished piece, each with its OWN weight', () => {
    const tags = buildReceivedTags(grn({ lines: [goodsLine()] }), designs, 0);
    expect(tags).toHaveLength(2);
    expect(tags.map(t => t.netWeight)).toEqual([41.2, 39.8]);
    expect(tags[0].itemDesignId).toBe('design-2');
    expect(tags[0].metalType).toBe('Gold (22K)');
  });

  it('parks un-hallmarked purchased goods at PendingHallmark, NOT InStock', () => {
    // InStock would let a purchased piece be sold without ever meeting the M25 guard.
    const tags = buildReceivedTags(grn({ lines: [goodsLine()] }), designs, 0);
    expect(tags.every(t => t.status === 'PendingHallmark')).toBe(true);
    expect(tags.every(t => !isSellable(t.status))).toBe(true);
  });

  it('lets a supplier-hallmarked piece go straight to stock, carrying its HUID', () => {
    const tags = buildReceivedTags(
      grn({ lines: [goodsLine({ pieceHuids: ['ZZ1111', ''] })] }), designs, 0);
    expect(tags[0].status).toBe('InStock');
    expect(tags[0].huid).toBe('ZZ1111');
    expect(tags[1].status).toBe('PendingHallmark');
    expect(tags[1].huid).toBeUndefined();
  });

  it('inherits the design defaults so a purchased piece prices correctly', () => {
    const [tag] = buildReceivedTags(grn({ lines: [goodsLine()] }), designs, 0);
    expect(tag.wastagePercent).toBe(5);
    expect(tag.makingChargeValue).toBe(650);
  });

  it('stamps the receiving branch on everything it creates', () => {
    const tags = buildReceivedTags(grn({ branchId: 'br-2', lines: [rawLine(), goodsLine()] }), designs, 0);
    expect(tags.every(t => t.branchId === 'br-2')).toBe(true);
  });

  it('generates unique ids and SKUs across a mixed receipt', () => {
    const tags = buildReceivedTags(grn({ lines: [rawLine(), goodsLine()] }), designs, 5);
    expect(new Set(tags.map(t => t.id)).size).toBe(tags.length);
    expect(new Set(tags.map(t => t.sku)).size).toBe(tags.length);
  });
});

describe('applyReceiptToPo', () => {
  const po: PurchaseOrder = {
    id: 'po1', poNumber: 'PO-2026-27-001', supplierId: 'sup-1', orderDate: '2026-07-01',
    rateBasis: 'FIXED', status: 'Sent', branchId: 'br-1',
    lines: [
      { id: 'pol-1', kind: 'RAW_METAL', description: 'bar', metalType: 'Gold (24K)', orderedWeight: 100, ratePerGram: 7250 },
      { id: 'pol-2', kind: 'FINISHED_GOODS', description: 'choker', orderedQty: 5, ratePerPiece: 1000 },
    ],
  };

  it('folds received weight back onto the ordered line', () => {
    const updated = applyReceiptToPo(po, grn({ lines: [rawLine({ purchaseOrderLineId: 'pol-1', receivedWeight: 40 })] }));
    expect(updated.lines[0].receivedWeight).toBe(40);
    expect(updated.status).toBe('PartiallyReceived');
  });

  it('accumulates across successive receipts rather than overwriting', () => {
    let updated = applyReceiptToPo(po, grn({ lines: [rawLine({ purchaseOrderLineId: 'pol-1', receivedWeight: 40 })] }));
    updated = applyReceiptToPo(updated, grn({ id: 'grn2', lines: [rawLine({ purchaseOrderLineId: 'pol-1', receivedWeight: 60 })] }));
    expect(updated.lines[0].receivedWeight).toBe(100);
  });

  it('counts finished pieces separately', () => {
    const updated = applyReceiptToPo(po, grn({ lines: [goodsLine({ purchaseOrderLineId: 'pol-2', receivedQty: 2 })] }));
    expect(updated.lines[1].receivedQty).toBe(2);
  });

  it('leaves lines the receipt did not touch alone', () => {
    const updated = applyReceiptToPo(po, grn({ lines: [rawLine({ purchaseOrderLineId: 'pol-1', receivedWeight: 40 })] }));
    expect(updated.lines[1].receivedQty).toBeUndefined();
  });

  it('does not reopen a settled order', () => {
    const closed = { ...po, status: 'Closed' as const };
    expect(applyReceiptToPo(closed, grn({ lines: [rawLine({ purchaseOrderLineId: 'pol-1', receivedWeight: 10 })] })).status)
      .toBe('Closed');
  });
});

describe('summariseGrns', () => {
  it('summarises an empty register', () => {
    expect(summariseGrns([])).toMatchObject({ total: 0, metalReceived: 0, linesWithShortfall: 0 });
  });

  it('aggregates metal, pieces and the money lost to short purity', () => {
    const s = summariseGrns([
      grn({ id: 'a', lines: [rawLine({ testedPurityPercent: 99.5 })] }),
      grn({ id: 'b', lines: [rawLine({ id: 'g3', receivedWeight: 50, testedPurityPercent: 99.9 }), goodsLine()] }),
    ]);
    expect(s.total).toBe(2);
    expect(s.metalReceived).toBe(150);
    expect(s.piecesReceived).toBe(2);
    expect(s.linesWithShortfall).toBe(1);
    expect(s.shortfallFineGold).toBeCloseTo(0.4, 3);
    expect(s.shortfallValue).toBe(2900);
  });
});
