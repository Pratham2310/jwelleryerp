import { describe, it, expect } from 'vitest';
import { reconcileStockAudit, auditDiscrepancySummary } from './stockAudit';
import type { Tag } from '../types';

function makeTag(id: string, sku: string, status: Tag['status'], netWeight = 10): Tag {
  return {
    id, sku, itemDesignId: 'design-1', name: sku, category: 'Rings', metalType: 'Gold (22K)',
    grossWeight: netWeight, netWeight, wastagePercent: 3, makingChargeType: 'per-gram', makingChargeValue: 400,
    stoneType: 'None', stoneWeight: 0, stoneCharge: 0, stockOwnershipType: 'OWNED', status,
  };
}

describe('stockAudit.reconcileStockAudit', () => {
  const t1 = makeTag('t1', 'SKU-001', 'InStock', 10);
  const t2 = makeTag('t2', 'SKU-002', 'InShowcase', 20);
  const t3 = makeTag('t3', 'SKU-003', 'OutForJobwork', 5); // not expected in the tray
  const allTags = [t1, t2, t3];
  const expected = [t1, t2];

  it('flags an omitted expected tag as missing', () => {
    const result = reconcileStockAudit(expected, ['SKU-001'], allTags);
    expect(result.matchedTags.map(t => t.id)).toEqual(['t1']);
    expect(result.missingTags.map(t => t.id)).toEqual(['t2']);
    expect(result.extraScans).toEqual([]);
  });

  it('flags a scanned code with no matching tag as an unknown extra', () => {
    const result = reconcileStockAudit(expected, ['SKU-001', 'SKU-002', 'GHOST-999'], allTags);
    expect(result.missingTags).toEqual([]);
    expect(result.extraScans).toEqual([{ code: 'ghost-999', tag: null }]);
  });

  it('flags a scanned tag that exists but is not expected in this tray as extra', () => {
    const result = reconcileStockAudit(expected, ['SKU-001', 'SKU-002', 'SKU-003'], allTags);
    expect(result.missingTags).toEqual([]);
    expect(result.extraScans).toHaveLength(1);
    expect(result.extraScans[0].tag?.id).toBe('t3');
  });

  it('matches by tag id as well as sku, case-insensitively', () => {
    const result = reconcileStockAudit(expected, ['t1', 'SKU-002'], allTags);
    expect(result.matchedTags.map(t => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('deduplicates repeated scans of the same code', () => {
    const result = reconcileStockAudit(expected, ['SKU-001', 'sku-001', 'SKU-001'], allTags);
    expect(result.matchedTags).toHaveLength(1);
    expect(result.missingTags.map(t => t.id)).toEqual(['t2']);
  });

  it('a perfect scan of every expected tag has no discrepancies', () => {
    const result = reconcileStockAudit(expected, ['SKU-001', 'SKU-002'], allTags);
    const summary = auditDiscrepancySummary(result);
    expect(summary).toEqual({ matchedCount: 2, missingCount: 0, missingWeight: 0, extraCount: 0, extraWeight: 0 });
  });

  it('summary reports missing/extra counts and weights correctly', () => {
    const result = reconcileStockAudit(expected, ['SKU-001', 'SKU-003'], allTags);
    const summary = auditDiscrepancySummary(result);
    expect(summary.matchedCount).toBe(1);
    expect(summary.missingCount).toBe(1);
    expect(summary.missingWeight).toBe(20); // t2
    expect(summary.extraCount).toBe(1);
    expect(summary.extraWeight).toBe(5); // t3
  });
});
