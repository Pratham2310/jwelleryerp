import { describe, it, expect } from 'vitest';
import {
  deviationPercent,
  assessRateChange,
  resolveRateAt,
  currentRateVersion,
  buildRateHistory,
  validateRateVersion,
  appendRateVersion,
  derivePurityRate,
  buildDerivedSuggestions,
  projectCurrentRates,
  seedVersionsFromRates,
  FAT_FINGER_THRESHOLD_PERCENT,
  IMPLAUSIBLE_CHANGE_PERCENT,
} from './rateMaster';
import type { MetalRate, MetalRateVersion } from '../types';

function version(over: Partial<MetalRateVersion> = {}): MetalRateVersion {
  return {
    id: 'v1',
    metalType: 'Gold (22K)',
    ratePerGram: 6650,
    effectiveFrom: '2026-07-29T10:00:00.000Z',
    setBy: 'Prathamesh S.',
    source: 'MANUAL',
    ...over,
  };
}

function rate(over: Partial<MetalRate> = {}): MetalRate {
  return {
    id: 'r1', metalType: 'Gold (22K)', purity: '91.6%', ratePerGram: 6650,
    change24h: 0, history24h: [], ...over,
  };
}

describe('deviationPercent', () => {
  it('measures the move against the previous rate', () => {
    expect(deviationPercent(6650, 6600)).toBeCloseTo(0.7576, 3);
    expect(deviationPercent(6600, 6650)).toBeCloseTo(-0.7519, 3);
  });

  it('returns zero rather than Infinity when there is no previous rate', () => {
    expect(deviationPercent(6650, 0)).toBe(0);
  });
});

describe('assessRateChange — PRD §4.2 fat-finger guard', () => {
  it('lets a normal daily move through without ceremony', () => {
    // Gold really does move a few percent; warning on that would train staff to click through.
    const a = assessRateChange(6800, 6650);
    expect(a.severity).toBe('NORMAL');
    expect(a.requiresReason).toBe(false);
    expect(a.message).toBeNull();
  });

  it('demands a reason past the threshold', () => {
    const a = assessRateChange(7100, 6650); // ~6.8%
    expect(a.severity).toBe('NEEDS_REASON');
    expect(a.requiresReason).toBe(true);
    expect(a.message).toMatch(/exceeds the 5% guard/i);
  });

  it('treats the threshold itself as still normal', () => {
    const at = 6650 * (1 + FAT_FINGER_THRESHOLD_PERCENT / 100);
    expect(assessRateChange(at, 6650).severity).toBe('NORMAL');
  });

  it('calls out a probable decimal slip specifically', () => {
    // The exact bug this guard exists for: 66500 typed instead of 6650.
    const a = assessRateChange(66500, 6650);
    expect(a.severity).toBe('IMPLAUSIBLE');
    expect(a.message).toMatch(/decimal point/i);
    expect(a.absDeviationPercent).toBe(900);
  });

  it('flags a large drop as readily as a large rise', () => {
    const a = assessRateChange(665, 6650);
    expect(a.severity).toBe('IMPLAUSIBLE');
    expect(a.deviationPercent).toBe(-90);
    expect(a.message).toMatch(/decrease/);
  });

  it('never hard-blocks — a real spike must still be recordable', () => {
    // Beyond the guard the operator supplies a reason; there is no rate they cannot enter.
    const a = assessRateChange(6650 * (1 + IMPLAUSIBLE_CHANGE_PERCENT / 100 + 0.1), 6650);
    expect(a.requiresReason).toBe(true);
    expect(a).not.toHaveProperty('blocked');
  });
});

describe('resolveRateAt — what makes an old invoice explainable', () => {
  const versions = [
    version({ id: 'a', ratePerGram: 6600, effectiveFrom: '2026-07-28T09:00:00.000Z' }),
    version({ id: 'b', ratePerGram: 6650, effectiveFrom: '2026-07-29T10:00:00.000Z' }),
    version({ id: 'c', ratePerGram: 6700, effectiveFrom: '2026-07-29T15:00:00.000Z' }),
  ];

  it('returns the rate live at that instant, not the newest', () => {
    expect(resolveRateAt('Gold (22K)', versions, '2026-07-29T12:00:00.000Z')?.id).toBe('b');
    expect(resolveRateAt('Gold (22K)', versions, '2026-07-28T20:00:00.000Z')?.id).toBe('a');
  });

  it('distinguishes two rates on the same day, which is why this is a timestamp', () => {
    expect(resolveRateAt('Gold (22K)', versions, '2026-07-29T09:00:00.000Z')?.id).toBe('a');
    expect(resolveRateAt('Gold (22K)', versions, '2026-07-29T23:00:00.000Z')?.id).toBe('c');
  });

  it('treats the effective instant as inclusive', () => {
    expect(resolveRateAt('Gold (22K)', versions, '2026-07-29T10:00:00.000Z')?.id).toBe('b');
  });

  it('returns null before any rate existed, rather than guessing', () => {
    expect(resolveRateAt('Gold (22K)', versions, '2020-01-01T00:00:00.000Z')).toBeNull();
  });

  it('does not leak another metal in', () => {
    expect(resolveRateAt('Gold (18K)', versions, '2026-07-29T12:00:00.000Z')).toBeNull();
  });

  it('currentRateVersion is resolveRateAt(now)', () => {
    expect(currentRateVersion('Gold (22K)', versions, new Date('2026-07-29T20:00:00.000Z'))?.id).toBe('c');
  });
});

describe('buildRateHistory', () => {
  const versions = [
    version({ id: 'a', ratePerGram: 6600, effectiveFrom: '2026-07-28T09:00:00.000Z' }),
    version({ id: 'b', ratePerGram: 6650, effectiveFrom: '2026-07-29T10:00:00.000Z' }),
    version({ id: 'x', metalType: 'Gold (18K)', ratePerGram: 5440, effectiveFrom: '2026-07-29T10:00:00.000Z' }),
  ];

  it('lists newest first with the delta each version represented', () => {
    const rows = buildRateHistory('Gold (22K)', versions);
    expect(rows.map(r => r.id)).toEqual(['b', 'a']);
    expect(rows[0].deltaAmount).toBe(50);
    expect(rows[0].deltaPercent).toBeCloseTo(0.76, 2);
  });

  it('leaves the opening version without a delta rather than inventing a zero', () => {
    const rows = buildRateHistory('Gold (22K)', versions);
    expect(rows[1].deltaAmount).toBeNull();
    expect(rows[1].deltaPercent).toBeNull();
  });

  it('is empty for a metal with no history', () => {
    expect(buildRateHistory('Platinum (950)', versions)).toEqual([]);
  });
});

describe('validateRateVersion', () => {
  const previous = version({ ratePerGram: 6650 });

  it('accepts a normal change with no reason', () => {
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 6700 }, previous)).toBeNull();
  });

  it('requires a metal and a positive rate', () => {
    expect(validateRateVersion({ ratePerGram: 6700 }, previous)).toMatch(/select the metal/i);
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 0 }, previous)).toMatch(/greater than zero/i);
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: -5 }, previous)).toMatch(/greater than zero/i);
  });

  it('blocks a beyond-guard change until a reason is given', () => {
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 7500 }, previous))
      .toMatch(/exceeds the 5% guard/i);
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 7500, overrideReason: 'Budget duty hike' }, previous))
      .toBeNull();
  });

  it('rejects a token reason', () => {
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 7500, overrideReason: 'x' }, previous))
      .toMatch(/at least 5 characters/i);
  });

  it('refuses a no-op that would clutter the audit trail', () => {
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 6650 }, previous))
      .toMatch(/same as the current rate/i);
  });

  it('accepts any positive opening rate when there is no history', () => {
    expect(validateRateVersion({ metalType: 'Gold (22K)', ratePerGram: 6650 }, null)).toBeNull();
  });
});

describe('appendRateVersion — D-4: nothing is ever mutated', () => {
  it('adds without touching the existing rows', () => {
    const original = [version({ id: 'a' })];
    const snapshot = JSON.parse(JSON.stringify(original));
    const result = appendRateVersion(original, version({ id: 'b', ratePerGram: 6700 }));

    expect(result).toHaveLength(2);
    expect(original).toEqual(snapshot); // the input array is untouched
    expect(result[0]).toEqual(original[0]);
  });

  it('leaves the superseded rate still resolvable at its own moment', () => {
    let versions = [version({ id: 'a', ratePerGram: 6600, effectiveFrom: '2026-07-28T09:00:00.000Z' })];
    versions = appendRateVersion(versions, version({ id: 'b', ratePerGram: 6650, effectiveFrom: '2026-07-29T10:00:00.000Z' }));
    expect(resolveRateAt('Gold (22K)', versions, '2026-07-28T12:00:00.000Z')?.ratePerGram).toBe(6600);
  });
});

describe('derivePurityRate (PRD §4.2)', () => {
  it('derives 22K and 18K from the 24K base by purity ratio', () => {
    // 7250 x (91.6 / 99.9) = 6647.6 -> 6648
    expect(derivePurityRate(7250, 'Gold (22K)')).toBe(6648);
    expect(derivePurityRate(7250, 'Gold (18K)')).toBe(5443);
  });

  it('returns the base itself for 24K', () => {
    expect(derivePurityRate(7250, 'Gold (24K)')).toBe(7250);
  });

  it('handles a zero base without producing NaN', () => {
    expect(derivePurityRate(0, 'Gold (22K)')).toBe(0);
  });

  it('surfaces the gap against the counter rate instead of overwriting it', () => {
    // A shop's quoted 22K rate absorbs local premium, so it is not exactly the derived figure.
    // Suggesting the difference is correct; silently applying it would change what customers pay.
    const suggestions = buildDerivedSuggestions(7250, [
      rate({ metalType: 'Gold (22K)', ratePerGram: 6650 }),
      rate({ metalType: 'Gold (18K)', ratePerGram: 5440 }),
      rate({ metalType: 'Gold (24K)', ratePerGram: 7250 }),
      rate({ metalType: 'Silver (999)', ratePerGram: 92 }),
    ]);
    expect(suggestions.map(s => s.metalType)).toEqual(['Gold (22K)', 'Gold (18K)']);
    expect(suggestions[0]).toMatchObject({ currentRate: 6650, derivedRate: 6648, differenceAmount: -2 });
  });
});

describe('projectCurrentRates — versions are the source of truth', () => {
  const now = new Date('2026-07-29T18:00:00.000Z');

  it('projects the newest version onto the current-rate view', () => {
    const versions = [
      version({ id: 'a', ratePerGram: 6600, effectiveFrom: '2026-07-28T09:00:00.000Z' }),
      version({ id: 'b', ratePerGram: 6650, effectiveFrom: '2026-07-29T10:00:00.000Z' }),
    ];
    const [projected] = projectCurrentRates(versions, [rate()], now);
    expect(projected.ratePerGram).toBe(6650);
  });

  it('builds the sparkline from real recorded versions', () => {
    const versions = [6500, 6550, 6600, 6650].map((r, i) =>
      version({ id: `v${i}`, ratePerGram: r, effectiveFrom: `2026-07-29T0${i}:00:00.000Z` })
    );
    const [projected] = projectCurrentRates(versions, [rate()], now);
    expect(projected.history24h).toEqual([6500, 6550, 6600, 6650]);
  });

  it('keeps the sparkline to the last 8 points', () => {
    const versions = Array.from({ length: 12 }, (_, i) =>
      version({ id: `v${i}`, ratePerGram: 6600 + i, effectiveFrom: `2026-07-29T${String(i).padStart(2, '0')}:00:00.000Z` })
    );
    const [projected] = projectCurrentRates(versions, [rate()], now);
    expect(projected.history24h).toHaveLength(8);
    expect(projected.history24h.at(-1)).toBe(6611);
  });

  it('measures change24h against the version in force 24h ago', () => {
    const versions = [
      version({ id: 'old', ratePerGram: 6600, effectiveFrom: '2026-07-28T09:00:00.000Z' }),
      version({ id: 'new', ratePerGram: 6666, effectiveFrom: '2026-07-29T12:00:00.000Z' }),
    ];
    const [projected] = projectCurrentRates(versions, [rate()], now);
    expect(projected.change24h).toBe(1); // 6600 -> 6666
  });

  it('ignores a future-dated version', () => {
    const versions = [
      version({ id: 'now', ratePerGram: 6650, effectiveFrom: '2026-07-29T10:00:00.000Z' }),
      version({ id: 'future', ratePerGram: 9999, effectiveFrom: '2027-01-01T00:00:00.000Z' }),
    ];
    const [projected] = projectCurrentRates(versions, [rate()], now);
    expect(projected.ratePerGram).toBe(6650);
  });

  it('leaves a metal untouched when it has no versions at all', () => {
    const [projected] = projectCurrentRates([], [rate({ ratePerGram: 6650 })], now);
    expect(projected.ratePerGram).toBe(6650);
  });
});

describe('seedVersionsFromRates — one-time migration', () => {
  const now = new Date('2026-07-29T18:00:00.000Z');

  it('reconstructs a trail from the existing sparkline so it is not lost', () => {
    const seeded = seedVersionsFromRates([rate({ history24h: [6590, 6610, 6650] })], now);
    expect(seeded).toHaveLength(3);
    expect(seeded.map(v => v.ratePerGram)).toEqual([6590, 6610, 6650]);
  });

  it('marks reconstructed rows so nobody reads them as genuinely recorded', () => {
    const seeded = seedVersionsFromRates([rate({ history24h: [6650] })], now);
    expect(seeded[0].source).toBe('MIGRATED');
    expect(seeded[0].setBy).toMatch(/migrated/i);
  });

  it('orders the trail forwards in time, ending at the current rate', () => {
    const seeded = seedVersionsFromRates([rate({ history24h: [6590, 6610, 6650] })], now);
    const times = seeded.map(v => v.effectiveFrom);
    expect([...times].sort()).toEqual(times);
    expect(seeded.at(-1)!.effectiveFrom).toBe(now.toISOString());
  });

  it('falls back to the current rate when there is no sparkline history', () => {
    const seeded = seedVersionsFromRates([rate({ ratePerGram: 6650, history24h: [] })], now);
    expect(seeded).toHaveLength(1);
    expect(seeded[0].ratePerGram).toBe(6650);
  });

  it('round-trips: projecting the seeded versions reproduces the original rate', () => {
    const original = rate({ ratePerGram: 6650, history24h: [6590, 6610, 6650] });
    const projected = projectCurrentRates(seedVersionsFromRates([original], now), [original], now);
    expect(projected[0].ratePerGram).toBe(6650);
  });
});
