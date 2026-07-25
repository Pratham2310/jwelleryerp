import type { Tag } from '../types';

// Physical Stock Audit / Reconciliation (Milestone 6). Pure, unit-tested reconciliation
// of a scanned-tray sequence against the system's expected on-premises Tag list.

export interface AuditExtraScan {
  code: string;
  tag: Tag | null; // null = the scanned code doesn't match any Tag in the system at all
}

export interface AuditResult {
  matchedTags: Tag[]; // expected tags that were scanned
  missingTags: Tag[]; // expected tags that were NOT scanned
  extraScans: AuditExtraScan[]; // scanned codes that shouldn't have been found in this tray
}

const normalize = (s: string) => s.trim().toLowerCase();

export function reconcileStockAudit(expectedTags: Tag[], scannedCodes: string[], allTags: Tag[]): AuditResult {
  const expectedIds = new Set(expectedTags.map(t => t.id));
  const uniqueCodes = Array.from(new Set(scannedCodes.map(normalize))).filter(Boolean);

  const matchedTags: Tag[] = [];
  const extraScans: AuditExtraScan[] = [];

  for (const code of uniqueCodes) {
    const tag = allTags.find(t => normalize(t.sku) === code || normalize(t.id) === code) || null;
    if (tag && expectedIds.has(tag.id)) {
      matchedTags.push(tag);
    } else {
      extraScans.push({ code, tag });
    }
  }

  const matchedIds = new Set(matchedTags.map(t => t.id));
  const missingTags = expectedTags.filter(t => !matchedIds.has(t.id));

  return { matchedTags, missingTags, extraScans };
}

export interface AuditSummary {
  matchedCount: number;
  missingCount: number;
  missingWeight: number;
  extraCount: number;
  extraWeight: number;
}

export function auditDiscrepancySummary(result: AuditResult): AuditSummary {
  return {
    matchedCount: result.matchedTags.length,
    missingCount: result.missingTags.length,
    missingWeight: result.missingTags.reduce((sum, t) => sum + t.netWeight, 0),
    extraCount: result.extraScans.length,
    extraWeight: result.extraScans.reduce((sum, e) => sum + (e.tag?.netWeight || 0), 0),
  };
}
