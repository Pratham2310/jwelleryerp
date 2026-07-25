// Counter-level price override detection & reason logging (PRD §7.1 step 4, §15.1).
// Any billing field edited away from its item-master default is an override that must
// carry a logged reason before the sale can proceed. Milestone 33 adds a Supervisor PIN
// gate on top of this; the reason log itself is the audit trail either way.

export type OverrideField = 'wastagePercent' | 'makingChargeValue' | 'metalRate';

export const OVERRIDE_FIELD_LABEL: Record<OverrideField, string> = {
  wastagePercent: 'Wastage %',
  makingChargeValue: 'Making Charge',
  metalRate: 'Metal Rate',
};

export interface OverrideRecord {
  field: OverrideField;
  originalValue: number;
  newValue: number;
  reason: string;
}

export interface OverrideCandidate {
  field: OverrideField;
  originalValue: number;
  newValue: number;
}

const near = (a: number, b: number) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;

/**
 * Compares a billing line's current values against the defaults it was pulled from,
 * returning every field that has been edited away from its master value.
 * Fields whose master value is unknown (custom rows, no linked Tag) are not overrides —
 * there is no default to deviate from.
 */
export function detectOverrides(
  current: Partial<Record<OverrideField, number>>,
  masterDefaults: Partial<Record<OverrideField, number>> | null
): OverrideCandidate[] {
  if (!masterDefaults) return [];

  const fields: OverrideField[] = ['wastagePercent', 'makingChargeValue', 'metalRate'];
  const out: OverrideCandidate[] = [];

  for (const field of fields) {
    const original = masterDefaults[field];
    const updated = current[field];
    if (original === undefined || updated === undefined) continue;
    if (!near(original, updated)) {
      out.push({ field, originalValue: Number(original), newValue: Number(updated) });
    }
  }

  return out;
}

export function isReasonAcceptable(reason: string): boolean {
  return (reason || '').trim().length >= 5;
}

/**
 * Returns an error message if any detected override lacks an acceptable logged reason.
 */
export function validateOverrideReasons(
  candidates: OverrideCandidate[],
  reasons: Partial<Record<OverrideField, string>>
): string | null {
  const unlogged = candidates.filter(c => !isReasonAcceptable(reasons[c.field] || ''));
  if (unlogged.length === 0) return null;

  const names = unlogged.map(c => OVERRIDE_FIELD_LABEL[c.field]).join(', ');
  return `A manager-approved reason (min. 5 characters) is required for the following overridden field(s): ${names}.`;
}

export function buildOverrideRecords(
  candidates: OverrideCandidate[],
  reasons: Partial<Record<OverrideField, string>>
): OverrideRecord[] {
  return candidates.map(c => ({ ...c, reason: (reasons[c.field] || '').trim() }));
}
