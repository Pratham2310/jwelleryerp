import { describe, it, expect } from 'vitest';
import { detectOverrides, validateOverrideReasons, buildOverrideRecords, isReasonAcceptable } from './priceOverrides';

describe('priceOverrides.detectOverrides', () => {
  const master = { wastagePercent: 3.5, makingChargeValue: 450, metalRate: 6650 };

  it('detects nothing when every field matches its master default', () => {
    expect(detectOverrides({ ...master }, master)).toEqual([]);
  });

  it('detects a single overridden field', () => {
    const result = detectOverrides({ ...master, wastagePercent: 1.0 }, master);
    expect(result).toEqual([{ field: 'wastagePercent', originalValue: 3.5, newValue: 1.0 }]);
  });

  it('detects multiple simultaneous overrides', () => {
    const result = detectOverrides({ wastagePercent: 1, makingChargeValue: 200, metalRate: 6650 }, master);
    expect(result.map(r => r.field).sort()).toEqual(['makingChargeValue', 'wastagePercent']);
  });

  it('treats a custom row with no master defaults as having no overrides', () => {
    expect(detectOverrides({ wastagePercent: 99 }, null)).toEqual([]);
  });

  it('ignores negligible floating-point drift', () => {
    expect(detectOverrides({ ...master, wastagePercent: 3.5001 }, master)).toEqual([]);
  });
});

describe('priceOverrides.validateOverrideReasons', () => {
  const candidates = [
    { field: 'wastagePercent' as const, originalValue: 3.5, newValue: 1 },
    { field: 'makingChargeValue' as const, originalValue: 450, newValue: 200 },
  ];

  it('passes when there are no overrides at all', () => {
    expect(validateOverrideReasons([], {})).toBeNull();
  });

  it('blocks when an override has no reason', () => {
    expect(validateOverrideReasons(candidates, {})).toMatch(/Wastage %.*Making Charge/);
  });

  it('blocks when a reason is too short to be meaningful', () => {
    const err = validateOverrideReasons(candidates, { wastagePercent: 'ok', makingChargeValue: 'Loyal customer discount' });
    expect(err).toMatch(/Wastage %/);
    expect(err).not.toMatch(/Making Charge/);
  });

  it('passes when every override carries an acceptable reason', () => {
    expect(validateOverrideReasons(candidates, {
      wastagePercent: 'Festival offer approved by owner',
      makingChargeValue: 'Price matched against competitor quote',
    })).toBeNull();
  });

  it('rejects whitespace-only reasons', () => {
    expect(isReasonAcceptable('     ')).toBe(false);
  });
});

describe('priceOverrides.buildOverrideRecords', () => {
  it('attaches the trimmed reason to each override for the audit log', () => {
    const records = buildOverrideRecords(
      [{ field: 'metalRate', originalValue: 6650, newValue: 6400 }],
      { metalRate: '  Bulk purchase negotiated rate  ' }
    );
    expect(records).toEqual([
      { field: 'metalRate', originalValue: 6650, newValue: 6400, reason: 'Bulk purchase negotiated rate' },
    ]);
  });
});
